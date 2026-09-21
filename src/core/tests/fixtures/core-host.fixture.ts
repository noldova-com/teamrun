/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import {
  TeammatesService,
  ApprovalsService,
  ConversationEngine,
  ConversationsService,
  DatabaseContext,
  EventHub,
  MessagesService,
  ProjectsService,
  ProviderAccountsService,
  ProviderRegistry,
  ProvidersService,
  RequestDispatcher
} from "@noldova/teamrun-core";
import { type Conversation, ConversationCreateParams, type Project, ProjectOpenParams, ProviderAccountCreateParams, type ProviderAccount } from "@noldova/teamrun-protocol";

import { FakeProviderAdapter } from "./fake-provider-adapter.fixture.js";
import { RecordingEventListener } from "./recording-event-listener.fixture.js";
import { TemporaryDataDirectory } from "./temporary-data-directory.fixture.js";

export class CoreHost implements Disposable {
  private static readonly POLL_INTERVAL: number = 5;
  private static readonly POLL_LIMIT: number = 400;

  public readonly directory: TemporaryDataDirectory = new TemporaryDataDirectory();
  public readonly context: DatabaseContext;
  public readonly adapter: FakeProviderAdapter;
  public readonly registry: ProviderRegistry = new ProviderRegistry();
  public readonly events: EventHub = new EventHub();
  public readonly listener: RecordingEventListener = new RecordingEventListener();
  public readonly projects: ProjectsService;
  public readonly conversations: ConversationsService;
  public readonly messages: MessagesService;
  public readonly approvals: ApprovalsService;
  public readonly accounts: ProviderAccountsService;
  public readonly teammates: TeammatesService;
  public readonly providers: ProvidersService;
  public readonly engine: ConversationEngine;
  public readonly dispatcher: RequestDispatcher;

  public constructor(supportsFork: boolean = false) {
    this.adapter = new FakeProviderAdapter("fake", supportsFork);
    this.context = DatabaseContext.open(this.directory.path);
    this.registry.register(this.adapter);
    this.events.subscribe(this.listener);
    this.conversations = new ConversationsService(this.context);
    this.projects = new ProjectsService(this.context, this.conversations);
    this.messages = new MessagesService(this.context);
    this.approvals = new ApprovalsService(this.context);
    this.accounts = new ProviderAccountsService(this.context, this.registry, this.events);
    this.teammates = new TeammatesService(this.context, this.accounts, this.conversations);
    this.providers = new ProvidersService(this.registry, this.accounts);
    this.engine = new ConversationEngine(this.context, this.projects, this.conversations, this.messages, this.approvals,
      this.accounts, this.teammates, this.registry, this.events);
    this.dispatcher = new RequestDispatcher(this.providers, this.accounts, this.projects, this.conversations,
      this.messages, this.approvals, this.engine, this.teammates, this.events);
  }

  public openProject(name: string = "alpha"): Project {
    return this.projects.open(new ProjectOpenParams(join(this.directory.path, name)));
  }

  public createConversation(project: Project = this.openProject(), title: string | null = null): Conversation {
    return this.conversations.create(new ConversationCreateParams(project.id, title));
  }

  public createAccount(provider: string = "fake", label: string = "Work"): ProviderAccount {
    return this.accounts.create(new ProviderAccountCreateParams(provider, label, join(this.directory.path, "profiles", label)));
  }

  public async until(condition: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < CoreHost.POLL_LIMIT; attempt += 1) {
      if (condition())
        return;
      await new Promise(resolve => setTimeout(resolve, CoreHost.POLL_INTERVAL));
    }
    throw new Error("The condition did not become true in time.");
  }

  public [Symbol.dispose](): void {
    this.context[Symbol.dispose]();
    this.directory[Symbol.dispose]();
  }
}
