/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  TeammatesService,
  OrganizationService,
  ApprovalsService,
  BackgroundTasksService,
  AttachmentStore,
  ConversationEngine,
  ConversationsService,
  DatabaseContext,
  DraftsService,
  EventHub,
  FolderCheckTimings,
  FolderProbe,
  MessagesService,
  PlanUsageService,
  ProjectsService,
  ProvidersService,
  ProviderKindRegistry,
  ProviderKindsService,
  ReadingPositionsService,
  RequestDispatcher,
  Resources,
  SharedMcpServersService,
  ComputerUseGrantsService,
  ComputerUseGrantTimings,
  WindowsService,
  type ITurnToolSessions,
  type TeammateCommand
} from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import {
  Approval,
  ApprovalDecideParams,
  ApprovalStatus,
  type Conversation,
  ConversationCreateParams,
  type Event,
  EventName,
  type Project,
  ProjectOpenParams,
  ProviderCreateParams,
  type Provider
} from "@noldova/teamrun.protocol";

import { BoundingWork } from "./bounding-work.fixture.js";
import { ChangeSignal } from "./change-signal.fixture.js";
import { FakeCommandStarter } from "./fake-command-starter.fixture.js";
import { FakeCheckpoints } from "./fake-checkpoints.fixture.js";
import { FakeProviderAdapter } from "./fake-provider-adapter.fixture.js";
import { FakeAppDescriptions } from "./fake-app-descriptions.fixture.js";
import { FakeRememberedAppGrants } from "./fake-remembered-app-grants.fixture.js";
import { FakeSharedMcpSecrets } from "./fake-shared-mcp-secrets.fixture.js";
import { FakeSharedMcpAccounts } from "./fake-shared-mcp-accounts.fixture.js";
import { FakeSharedMcpSignIn } from "./fake-shared-mcp-sign-in.fixture.js";
import { HeldFolderStat } from "./held-folder-stat.fixture.js";
import { RecordingEventListener } from "./recording-event-listener.fixture.js";
import { RecordingLog } from "./recording-log.fixture.js";
import { TemporaryDataDirectory } from "./temporary-data-directory.fixture.js";

export class CoreHost implements AsyncDisposable {

  public readonly directory: TemporaryDataDirectory;
  public readonly context: DatabaseContext;
  public readonly adapter: FakeProviderAdapter;
  public readonly registry: ProviderKindRegistry = new ProviderKindRegistry();
  public readonly events: EventHub = new EventHub();
  public readonly listener: RecordingEventListener = new RecordingEventListener();
  public readonly log: RecordingLog = new RecordingLog();
  public readonly checkpoints: FakeCheckpoints = new FakeCheckpoints();
  public readonly folderStat: HeldFolderStat = new HeldFolderStat();
  public readonly timer: ManualTimer = new ManualTimer();
  public readonly folders: FolderProbe = new FolderProbe(this.folderStat.statAsync, new FolderCheckTimings(1_000, 500), this.timer);
  public readonly attachments: AttachmentStore;
  public readonly drafts: DraftsService;
  public readonly projects: ProjectsService;
  public readonly conversations: ConversationsService;
  public readonly messages: MessagesService;
  public readonly approvals: ApprovalsService;
  public readonly tasks: BackgroundTasksService;
  public readonly commands: FakeCommandStarter = new FakeCommandStarter();
  public readonly providers: ProvidersService;
  public readonly teammates: TeammatesService;
  public readonly organization: OrganizationService;
  public readonly kinds: ProviderKindsService;
  public readonly planUsage: PlanUsageService;
  public readonly engine: ConversationEngine;
  public readonly dispatcher: RequestDispatcher;
  public readonly readingPositions: ReadingPositionsService;
  public readonly environment: Record<string, string> = {};
  public readonly secrets: FakeSharedMcpSecrets = new FakeSharedMcpSecrets();
  public readonly signIns: FakeSharedMcpSignIn = new FakeSharedMcpSignIn();
  public readonly accounts: FakeSharedMcpAccounts = new FakeSharedMcpAccounts();
  public readonly sharedServers: SharedMcpServersService;
  public readonly windows: WindowsService;
  public readonly rememberedGrants: FakeRememberedAppGrants = new FakeRememberedAppGrants();
  public readonly appDescriptions: FakeAppDescriptions = new FakeAppDescriptions();
  public readonly computerUseGrants: ComputerUseGrantsService;
  public allowsSends: boolean = true;
  private readonly sends: Set<Promise<void>> = new Set();
  private readonly sendErrors: unknown[] = [];

  private constructor(directory: TemporaryDataDirectory, context: DatabaseContext, supportsFork: boolean, supportsSignIn: boolean, signInTimeout: number | undefined,
    readHopLimit: (() => number) | undefined, readCommand: (() => Promise<TeammateCommand | null>) | undefined, tools: ITurnToolSessions | null, runsCommands: boolean,
    readTitleModel: (() => string) | undefined, readIdleCompaction: (() => boolean) | undefined) {
    this.directory = directory;
    this.context = context;
    this.adapter = new FakeProviderAdapter("fake", supportsFork, supportsSignIn);
    const leave = this.context.projectActivity.leave.bind(this.context.projectActivity);
    this.context.projectActivity.leave = id => {
      leave(id);
      ChangeSignal.notify();
    };
    const connection = this.context.database.connection;
    const runInTransactionAsync = connection.runInTransactionAsync.bind(connection);
    connection.runInTransactionAsync = work => runInTransactionAsync(work).finally(() => ChangeSignal.notify());
    this.registry.register(this.adapter);
    this.events.subscribe(this.listener);
    this.events.subscribe({ onEvent: event => this.allowSend(event) });
    this.attachments = new AttachmentStore(this.directory.path);
    this.drafts = new DraftsService(this.context, this.attachments, this.log);
    this.conversations = new ConversationsService(this.context, this.drafts, this.log);
    this.projects = new ProjectsService(this.context, this.conversations, this.drafts, this.events, this.folders, this.log);
    this.messages = new MessagesService(this.context);
    this.approvals = new ApprovalsService(this.context);
    this.tasks = new BackgroundTasksService(this.events, 0, 50, null, this.context);
    this.providers = new ProvidersService(this.context, this.registry, this.conversations, this.events, signInTimeout, this.log);
    this.organization = new OrganizationService(this.context);
    this.teammates = new TeammatesService(this.context, this.providers, this.conversations, this.organization);
    this.planUsage = new PlanUsageService(this.events, this.timer);
    this.sharedServers = new SharedMcpServersService(this.context, this.providers, this.teammates, this.registry, () => Promise.resolve(this.environment),
      this.secrets, this.signIns, this.accounts, this.events, this.log);
    this.readingPositions = new ReadingPositionsService(this.context);
    this.windows = new WindowsService(this.events, this.conversations, 50);
    this.computerUseGrants = new ComputerUseGrantsService(this.rememberedGrants, this.conversations, this.teammates, this.appDescriptions,
      new ComputerUseGrantTimings(1_000, 60_000), this.timer);
    this.kinds = new ProviderKindsService(this.registry, this.providers, this.events, this.planUsage, this.teammates, this.log);
    this.engine = new ConversationEngine(this.context, this.projects, this.conversations, this.messages, this.approvals,
      this.providers, this.teammates, this.registry, this.events, this.attachments, readHopLimit, this.log, readCommand, this.tasks, this.planUsage, tools,
      this.checkpoints, this.sharedServers, null, runsCommands ? this.commands : null, readTitleModel, readIdleCompaction, this.timer);
    this.dispatcher = new RequestDispatcher(this.kinds, this.providers, this.projects, this.conversations,
      this.messages, this.approvals, this.engine, this.teammates, this.events, this.drafts, null, this.tasks, this.planUsage,
      this.readingPositions, this.windows, this.sharedServers, this.computerUseGrants, null, this.organization);
  }

  public static async createAsync(supportsFork: boolean = false, supportsSignIn: boolean = false, signInTimeout?: number, readHopLimit?: () => number,
    readCommand?: () => Promise<TeammateCommand | null>, tools: ITurnToolSessions | null = null, runsCommands: boolean = true, readTitleModel?: () => string,
    readIdleCompaction?: () => boolean): Promise<CoreHost> {
    const directory = new TemporaryDataDirectory();
    try {
      const context = await DatabaseContext.openAsync(directory.path);
      return new CoreHost(directory, context, supportsFork, supportsSignIn, signInTimeout, readHopLimit, readCommand, tools, runsCommands, readTitleModel,
        readIdleCompaction);
    }
    catch (error) {
      directory[Symbol.dispose]();
      throw error;
    }
  }

  public async openProjectAsync(name: string = "alpha"): Promise<Project> {
    const rootPath = join(this.directory.path, name);
    mkdirSync(rootPath, { recursive: true });
    return this.projects.openAsync(new ProjectOpenParams(rootPath));
  }

  public async createConversationAsync(project?: Project, title: string | null = null): Promise<Conversation> {
    const owner = project ?? await this.openProjectAsync();
    return this.conversations.createAsync(new ConversationCreateParams(owner.id, title));
  }

  public async createProviderAsync(kind: string = "fake", label: string = "Work"): Promise<Provider> {
    return this.providers.createAsync(new ProviderCreateParams(kind, label, join(this.directory.path, "profiles", label)));
  }

  public async providerOfAsync(kind: string = "fake"): Promise<Provider> {
    return (await this.providers.listAsync()).find(t => t.kind === kind && t.label === kind) ?? this.createProviderAsync(kind, kind);
  }

  public async until(what: string, condition: () => boolean | Promise<boolean>, work: BoundingWork | null = null): Promise<void> {
    const ended = work?.endedAsync() ?? null;
    for (;;) {
      const changed = ChangeSignal.next();
      if (await condition())
        return;
      const name = await Promise.race(Object.isNull(ended) ? [changed] : [changed, ended]);
      if (!Object.isUndefined(name) && !await condition())
        throw new Error(`${what} never happened; ${name} ended without it.`);
    }
  }

  public runs(): BoundingWork {
    return new BoundingWork("the engine's runs", this.runsEndAsync());
  }

  public async runsEndAsync(): Promise<void> {
    while (this.engine.activeRunCount > 0) {
      await this.engine.waitForIdle();
      if (this.engine.activeRunCount > 0)
        await ChangeSignal.next();
    }
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    this.planUsage[Symbol.dispose]();
    try {
      await Promise.all(this.sends);
      await this.context[Symbol.asyncDispose]();
    }
    finally {
      this.directory[Symbol.dispose]();
    }
    if (this.sendErrors.length > 0)
      throw this.sendErrors[0];
  }

  private allowSend(event: Event): void {
    if (!this.allowsSends || event.name !== EventName.ApprovalCreated)
      return;
    const approval = Approval.fromJson(event.payload);
    if (approval.nativeKind !== Resources.sendMessageAction)
      return;
    const send = this.allowSendAsync(approval.id).catch((error: unknown) => {
      this.sendErrors.push(error);
    }).finally(() => this.sends.delete(send));
    this.sends.add(send);
  }

  private async allowSendAsync(id: string): Promise<void> {
    if ((await this.approvals.findAsync(id))?.status === ApprovalStatus.Pending)
      await this.engine.decideAsync(new ApprovalDecideParams(id, Resources.allowOnceOptionId));
  }
}
