/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "node:events";

import { CliApplication, CommandRegistry } from "@noldova/teamrun-cli";
import { ProviderRegistry } from "@noldova/teamrun-core";
import { Conversation, Project, ProviderAccount, Teammate } from "@noldova/teamrun-protocol";
import { ProcessInspector, ProcessProbe, ProcessRegistry, RuntimeService, RuntimeSettings } from "@noldova/teamrun-runtime";

import { FakeConsole } from "./fake-console.fixture.js";
import { FakeProviderAdapter } from "./fake-provider-adapter.fixture.js";
import { InProcessConnectionFactory } from "./in-process-connection-factory.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class CliTestHost implements AsyncDisposable {
  public readonly directory: TemporaryDirectory = new TemporaryDirectory();
  public readonly adapter: FakeProviderAdapter = new FakeProviderAdapter();
  public readonly registry: ProviderRegistry = new ProviderRegistry();
  public readonly service: RuntimeService;
  public readonly connections: InProcessConnectionFactory;
  public readonly application: CliApplication;
  public readonly signals: EventEmitter = new EventEmitter();
  public console: FakeConsole = new FakeConsole();

  private constructor() {
    this.registry.register(this.adapter);
    const settings = RuntimeSettings.forPlatform(process.platform, this.directory.resolve("data"), "0.0.1-test", null);
    const processes = new ProcessRegistry(settings.processesPath, process.pid, new ProcessProbe(), ProcessInspector.fromPlatform(process.platform));
    this.service = new RuntimeService(settings, this.registry, processes);
    this.connections = new InProcessConnectionFactory(this.service);
    this.application = new CliApplication(CommandRegistry.createDefault(), this.connections);
  }

  public static async create(): Promise<CliTestHost> {
    const host = new CliTestHost();
    await host.service.start();
    return host;
  }

  public get dataDirectory(): string {
    return this.directory.resolve("data");
  }

  public run(...args: readonly string[]): Promise<number> {
    this.console = new FakeConsole();
    return this.runWith(this.console, ...args);
  }

  public runWith(console: FakeConsole, ...args: readonly string[]): Promise<number> {
    return this.application.run([...args, "--data-dir", this.dataDirectory], console, this.signals);
  }

  public async runJson(...args: readonly string[]): Promise<unknown> {
    const code = await this.run(...args, "--json");
    if (code !== 0)
      throw new Error(`Exit code ${code}: ${this.console.errors.join("; ")}`);

    return JSON.parse(this.console.output);
  }

  public async openProject(name: string = "repo"): Promise<Project> {
    return Project.fromJson(await this.runJson("project-open", this.directory.resolve(name)));
  }

  public async createConversation(project?: Project): Promise<Conversation> {
    const owner = project ?? await this.openProject();
    return Conversation.fromJson(await this.runJson("conversation-new", owner.id, "--title", "Chat"));
  }

  public async createTeammate(name: string = "Alice"): Promise<Teammate> {
    const account = ProviderAccount.fromJson(await this.runJson("account-add", "fake", name, this.directory.resolve("profiles", name)));
    return Teammate.fromJson(await this.runJson("teammate-new", name, account.id));
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.service.stop("test");
    this.directory[Symbol.dispose]();
  }
}
