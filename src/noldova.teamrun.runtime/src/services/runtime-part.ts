/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";

import { CheckpointsService } from "@noldova/checkpoints/runtime";
import {
  type EventChannel,
  type IMethodHandler,
  type IRuntimePart,
  type IRuntimePartContext,
  type Migration,
  PermissionAccessException,
  ProductInfo,
  type Registration,
  RuntimeBuild
} from "@noldova/desktop.runtime";
import "@noldova/context.core";
import {
  ApprovalsService,
  BackgroundTasksService,
  AttachmentStore,
  ConversationEngine,
  ConversationsService,
  DatabaseContext,
  DraftsService,
  EventHub,
  type EventSubscription,
  FolderCheckTimings,
  FolderProbe,
  type ILog,
  MessagesService,
  PlanUsageService,
  ProjectsService,
  ProvidersService,
  type ProviderKindRegistry,
  AcpAgentsService,
  ProviderKindsService,
  ReadingPositionsService,
  RequestDispatcher,
  Resources as CoreResources,
  type TeammateCommand,
  SharedMcpServersService,
  ComputerUseGrantsService,
  ComputerUseGrantTimings,
  NodeTimer,
  TeammatesService,
  OrganizationService,
  WindowsService
} from "@noldova/teamrun.core";
import { CliPart } from "@noldova/teamrun.cli";
import { DataSource, DbContextOptionsBuilder } from "@noldova/context.data";
import { DataFolder, EventName, MessageSendParams, MethodName, WaitingMessageAddParams, WaitingMessageEditParams } from "@noldova/teamrun.protocol";
import { RuntimeTerminalOwners } from "@noldova/terminal.protocol";

import { RuntimePartException } from "../exceptions/runtime-part.exception.js";
import type { IProviderKindRegistryFactory } from "../interfaces/i-provider-kind-registry-factory.js";
import { Resources } from "../resources.js";
import { ChangeSubjects } from "./change-subjects.js";
import { ChatPagesRemover } from "./chat-pages-remover.js";
import { ChatTerminalsCloser } from "./chat-terminals-closer.js";
import { CommandTool } from "./command-tool.js";
import { DispatchedMethod } from "./dispatched-method.js";
import { EventForwarder } from "./event-forwarder.js";
import { FileShareMethod } from "./file-share-method.js";
import { GrantedAttachmentMethod } from "./granted-attachment-method.js";
import { HopLimitSetting } from "./hop-limit-setting.js";
import { IdleCompactionSetting } from "./idle-compaction-setting.js";
import { TitleModelSetting } from "./title-model-setting.js";
import { HostedMigrations } from "./hosted-migrations.js";
import { InProcessCliContext } from "./in-process-cli-context.js";
import { MainProcessMethod } from "./main-process-method.js";
import { MethodTool } from "./method-tool.js";
import { PanelTool } from "./panel-tool.js";
import { ModuleDatabaseProvider } from "./module-database-provider.js";
import { PermissionAnswerer } from "./permission-answerer.js";
import { ProviderKindRegistryFactory } from "./provider-kind-registry-factory.js";
import { ProviderCreateMethod } from "./provider-create-method.js";
import { ProviderUpdateMethod } from "./provider-update-method.js";
import { ReplyFailureNotices } from "./reply-failure-notices.js";
import { ReplyWork } from "./reply-work.js";
import { RequestedModeMethod } from "./requested-mode-method.js";
import { RuntimeAppDescriptions } from "./runtime-app-descriptions.js";
import { RuntimeProcessStarter } from "./runtime-process-starter.js";
import { RuntimeCommandStarter } from "./runtime-command-starter.js";
import { CommandTools } from "./command-tools.js";
import { RuntimeRememberedAppGrants } from "./runtime-remembered-app-grants.js";
import { McpHttpEndpoint } from "./mcp-http-endpoint.js";
import { OutsideConnectionMethod } from "./outside-connection-method.js";
import { OutsideSessions } from "./outside-sessions.js";
import { RuntimeToolSessions } from "./runtime-tool-sessions.js";
import { SendTool } from "./send-tool.js";
import { ServedCalls } from "./served-calls.js";
import { SharedMcpAccounts } from "./shared-mcp-accounts.js";
import { SharedMcpOauth } from "./shared-mcp-oauth.js";
import { SubAgentTool } from "./sub-agent-tool.js";
import { SubAgentTools } from "./sub-agent-tools.js";
import { TeammateCommandFolder } from "./teammate-command-folder.js";
import { WindowClients } from "./window-clients.js";
import { TeamRunChanges } from "./teamrun-changes.js";
import { TeamRunPagesHost } from "./teamrun-pages-host.js";
import { Pages } from "./pages/pages.js";
import { TeamRunTools } from "./teamrun-tools.js";
import { WorkingMethod } from "./working-method.js";

export class RuntimePart implements IRuntimePart {
  private static readonly WORK: ReadonlyMap<string, string> = new Map([
    [MethodName.ConversationRewind, Resources.rewindWork],
    [MethodName.ConversationMove, Resources.moveWork],
    [MethodName.ProviderKindInstall, Resources.installWork],
    [MethodName.ProviderSignIn, Resources.signInWork],
    [MethodName.ProviderProfileDiscover, Resources.discoverWork]
  ]);
  private static readonly AWAITED: ReadonlySet<string> = new Set([MethodName.ConversationRewind, MethodName.ConversationMove]);
  private static readonly OUTSIDE: ReadonlySet<string> = new Set([MethodName.OutsideConnectionRead, MethodName.OutsideTokenReset]);
  private static readonly MAIN_PROCESS_ONLY: ReadonlySet<string> = new Set([MethodName.ApprovalDecide, MethodName.WindowFocused, MethodName.WindowClosed,
    MethodName.WindowReload, MethodName.PanelAnswered, MethodName.ConversationSetMemberMode, MethodName.ConversationSetPlanFirst, MethodName.MessageApprovePlan,
    MethodName.DefaultTeammateSet, MethodName.ConversationResponderSet, MethodName.ComposerDefaultSave, MethodName.AcpLocalCommandAdd, MethodName.SharedMcpServerCreate,
    MethodName.SharedMcpServerUpdate, MethodName.SharedMcpProviderSet, MethodName.SharedMcpTeammateSet, MethodName.SharedMcpSecretSet]);
  private static readonly MODE_SETTING: ReadonlySet<string> = new Set([MethodName.TeammateCreate, MethodName.TeammateUpdate]);

  private readonly registries: IProviderKindRegistryFactory;
  private readonly productVersion: string | null;
  private readonly commands: TeammateCommandFolder;
  private database: DatabaseContext | null = null;
  private engine: ConversationEngine | null = null;
  private tasks: BackgroundTasksService | null = null;
  private readonly endpoints: (log: ILog) => McpHttpEndpoint;
  private endpoint: McpHttpEndpoint | null = null;
  private outside: OutsideSessions | null = null;
  private pages: Pages | null = null;
  private registry: ProviderKindRegistry | null = null;
  private work: ReplyWork | null = null;
  private failures: ReplyFailureNotices | null = null;
  private planUsage: PlanUsageService | null = null;
  private awaited: WorkingMethod[] = [];
  private sweepStop: AbortController | null = null;
  private sweeping: Promise<void> = Promise.resolve();
  private answerer: Registration | null = null;
  private sessionStops: Registration | null = null;
  private subscriptions: EventSubscription[] = [];

  public readonly migrations: readonly Migration[] = HostedMigrations.all;

  public constructor(registries: IProviderKindRegistryFactory = ProviderKindRegistryFactory.fromProcess(), productVersion: string | null = null,
    commands: TeammateCommandFolder = TeammateCommandFolder.fromProcess(), endpoints: (log: ILog) => McpHttpEndpoint = t => new McpHttpEndpoint(t)) {
    this.registries = registries;
    this.productVersion = productVersion;
    this.commands = commands;
    this.endpoints = endpoints;
  }

  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    if (!Object.isNull(this.database))
      throw new RuntimePartException(Resources.partAlreadyActive);

    try {
      await this.composeAsync(context);
    }
    catch (error) {
      await this.deactivateAsync().catch(() => undefined);
      throw error;
    }
  }

  public async deactivateAsync(): Promise<void> {
    this.sweepStop?.abort();
    for (const method of this.awaited)
      method.close();
    this.answerer?.[Symbol.dispose]();
    this.answerer = null;
    this.sessionStops?.[Symbol.dispose]();
    this.sessionStops = null;
    for (const subscription of this.subscriptions)
      subscription[Symbol.dispose]();
    this.subscriptions = [];
    this.work?.[Symbol.dispose]();
    this.work = null;
    this.failures?.[Symbol.dispose]();
    this.failures = null;
    this.planUsage?.[Symbol.dispose]();
    this.planUsage = null;
    try {
      await this.pages?.closeAsync();
      this.pages = null;
      await this.outside?.closeAsync();
      this.outside = null;
      await this.endpoint?.closeAsync();
      this.endpoint = null;
      await Promise.all(this.awaited.map(t => t.whenIdle()));
      if (!Object.isNull(this.engine))
        await this.engine.shutdown();
      const results = await Promise.allSettled((this.registry?.all() ?? []).map(t => t.shutdown()));
      if (results.some(t => t.status === Resources.rejectedStatus))
        throw new RuntimePartException(Resources.providersDidNotStop);
    }
    finally {
      try {
        await this.sweeping;
        await this.tasks?.closeAsync();
      }
      finally {
        this.tasks = null;
        try {
          await this.database?.[Symbol.asyncDispose]();
        }
        finally {
          this.database = null;
          this.engine = null;
          this.registry = null;
          this.awaited = [];
          this.sweepStop = null;
          this.sweeping = Promise.resolve();
        }
      }
    }
  }

  private async composeAsync(context: IRuntimePartContext): Promise<void> {
    const starter = new RuntimeProcessStarter(context, await context.getWorkFolderAsync());
    const version = this.productVersion ?? RuntimeBuild.identity.productVersion;
    const registry = this.registries.create(version, context.moduleFolder, starter,
      context.log);
    this.registry = registry;
    const options = new DbContextOptionsBuilder().use(new ModuleDatabaseProvider(context.database), new DataSource(Resources.dataSourceName, context.moduleFolder));
    const database = DatabaseContext.attach(options, context.moduleFolder);
    this.database = database;
    const events = new EventHub();
    const attachments = new AttachmentStore(database.dataDirectory);
    const drafts = new DraftsService(database, attachments, context.log);
    const conversations = new ConversationsService(database, drafts, context.log);
    const projects = new ProjectsService(database, conversations, drafts, events, new FolderProbe(stat, FolderCheckTimings.createDefault(), new NodeTimer()), context.log);
    const messages = new MessagesService(database);
    const approvals = new ApprovalsService(database);
    const tasks = new BackgroundTasksService(events, undefined, undefined, context.log, database);
    this.tasks = tasks;
    const providers = new ProvidersService(database, registry, conversations, events, undefined, context.log);
    const organization = new OrganizationService(database);
    const teammates = new TeammatesService(database, providers, conversations, organization);
    const planUsage = new PlanUsageService(events);
    this.planUsage = planUsage;
    const kinds = new ProviderKindsService(registry, providers, events, planUsage, teammates, context.log);
    const sharedServers = new SharedMcpServersService(database, providers, teammates, registry, () => context.readEnvironmentAsync(), context.secrets,
      new SharedMcpOauth(context.secrets), new SharedMcpAccounts(() => context.findService(Resources.gitHubAccessService, SharedMcpAccounts.isGitHubAccess)),
      events, context.log);
    const catalog = this.registries.createAcpCatalog?.(version, context.moduleFolder, starter, context.secrets, context.log) ?? null;
    const acpAgents = Object.isNull(catalog) ? null : new AcpAgentsService(database, registry, kinds, providers, catalog, context.secrets, events, context.log);
    await acpAgents?.startAsync();
    const command = await this.writeCommandAsync(context);
    const endpoint = this.endpoints(context.log);
    this.endpoint = endpoint;
    const url = await RuntimePart.listenAsync(endpoint, context);
    const approvedTools = [...[...TeamRunTools.all.map(t => t.descriptor).filter(t => t.hints?.isReadOnly === true), ...TeamRunChanges.all.map(t => t.descriptor),
      TeamRunChanges.send, ...SubAgentTools.all, ...Pages.tools, TeamRunTools.openPanel, TeamRunTools.closePanel].map(t => t.name), ...Resources.terminalTools,
      ...Resources.computerUseTools, ...Resources.browserTools, ...Resources.gitTools];
    const windows = new WindowsService(events, conversations);
    const calls = new ServedCalls();
    const engine = new ConversationEngine(database, projects, conversations, messages, approvals, providers, teammates, registry, events, attachments,
      HopLimitSetting.readerOf(context.settings), context.log, () => this.readCommandAsync(context, command), tasks, planUsage, new RuntimeToolSessions(context.tools, approvedTools, url, windows, new NodeTimer(), calls),
      context.getService(Resources.checkpointsServiceName, CheckpointsService), sharedServers, null, new RuntimeCommandStarter(starter),
      TitleModelSetting.readerOf(context.settings), IdleCompactionSetting.readerOf(context.settings));
    this.engine = engine;
    this.sessionStops = context.tools.onSessionStopped((session, reason) => void engine.stopSessionAsync(session, reason)
      .catch((error: unknown) => context.log.write(Resources.formatSessionStopFailed(CoreResources.formatFailureKind(error)))));
    await drafts.sweepAsync();
    endpoint.serve(engine);
    const channels = new Map<string, EventChannel>(Object.values(EventName).map(t => [t, context.declareEvent(Resources.formatQualifiedName(context.moduleId, t))]));
    this.subscriptions.push(events.subscribe(new EventForwarder(channels)));
    await engine.reconcileAsync();
    this.answerer = RuntimePart.registerAnswerer(context, engine, calls);
    await database.database.connection.runInTransactionAsync(async transaction => {
      const usual = new Map<string, string | null>();
      for (const provider of await providers.listAsync(transaction))
        if (!usual.has(provider.kind))
          usual.set(provider.kind, (await providers.findUsualAsync(provider.kind, transaction))?.id ?? null);
      await conversations.moveProviderlessAsync(kind => usual.get(kind) ?? null, transaction);
    });
    await teammates.moveProviderlessDefaultAsync(async (kind, transaction) => (await providers.findUsualAsync(kind, transaction))?.id ?? null);
    const pages = new Pages(database.database.connection, context.moduleFolder, new TeamRunPagesHost(conversations), context.log);
    await pages.sweepAsync();
    this.pages = pages;
    await pages.serveAsync(context, new NodeTimer());
    const sweepStop = new AbortController();
    this.sweepStop = sweepStop;
    this.sweeping = engine.sweepFoldersAsync(sweepStop.signal);
    const folder = new DataFolder(context.moduleFolder, join(context.moduleFolder, Resources.formatDatabaseFileName(context.moduleId)));
    const apps = new RuntimeAppDescriptions(() => context.findService(Resources.computerUseAppsService, RuntimeAppDescriptions.isApps));
    const grants = Object.isNull(this.answerer) ? null
      : new ComputerUseGrantsService(new RuntimeRememberedAppGrants(context.permissions), conversations, teammates, apps,
        ComputerUseGrantTimings.createDefault(), new NodeTimer());
    const dispatcher = new RequestDispatcher(kinds, providers, projects, conversations, messages, approvals, engine, teammates, events, drafts, folder,
      tasks, planUsage, new ReadingPositionsService(database), windows, sharedServers, grants, acpAgents, organization);
    const methods = new Map<string, IMethodHandler>();
    const clients = new WindowClients(new DispatchedMethod(MethodName.WindowFocused, dispatcher), windows);
    context.onClientClosed(t => clients.close(t));
    const outside = new OutsideSessions(context.settings, context.secrets, engine, events, new NodeTimer(),
      () => this.endpoints(context.log), context.log, context.appWindows);
    this.outside = outside;
    await outside.startAsync();
    context.registerMethod(Resources.formatQualifiedName(context.moduleId, MethodName.OutsideConnectionRead), new OutsideConnectionMethod(() => outside.readAsync()));
    context.registerMethod(Resources.formatQualifiedName(context.moduleId, MethodName.OutsideTokenReset), new OutsideConnectionMethod(() => outside.resetAsync()));
    for (const method of Object.values(MethodName).filter(t => !RuntimePart.OUTSIDE.has(t))) {
      const name = Resources.formatQualifiedName(context.moduleId, method);
      const handler = this.handlerOf(context, engine, providers, method, method === MethodName.WindowFocused ? clients : new DispatchedMethod(method, dispatcher));
      context.registerMethod(name, handler);
      methods.set(name, handler);
    }
    await this.registerToolsAsync(context, methods, windows);
    pages.register(context.moduleId, context.tools);
    RuntimePart.registerChanges(context, methods, new ChangeSubjects(projects, conversations, teammates, providers), conversations, engine, teammates);
    const work = new ReplyWork(context, engine);
    this.work = work;
    const failures = new ReplyFailureNotices(context, windows);
    this.failures = failures;
    const closer = new ChatTerminalsCloser(() => context.getService(Resources.terminalOwnersServiceName, RuntimeTerminalOwners), context.log);
    this.subscriptions.push(events.subscribe(work), events.subscribe(failures), events.subscribe(closer), events.subscribe(new ChatPagesRemover(pages, context.log)));
  }

  private async registerToolsAsync(context: IRuntimePartContext, methods: ReadonlyMap<string, IMethodHandler>, windows: WindowsService): Promise<void> {
    const commands = new InProcessCliContext(context.moduleId, methods, context.secrets);
    await new CliPart({}, Readable.from([])).activateAsync(commands);
    for (const tool of TeamRunTools.all)
      context.tools.register(tool.descriptor, new CommandTool(context.moduleId, tool, commands.commands.get(tool.command)!));
    context.tools.register(TeamRunTools.openPanel, new PanelTool(context.moduleId, windows, true));
    context.tools.register(TeamRunTools.closePanel, new PanelTool(context.moduleId, windows, false));
  }

  private static registerChanges(context: IRuntimePartContext, methods: ReadonlyMap<string, IMethodHandler>, subjects: ChangeSubjects,
    conversations: ConversationsService, engine: ConversationEngine, teammates: TeammatesService): void {
    const handlerOf = (method: MethodName): IMethodHandler => methods.get(Resources.formatQualifiedName(context.moduleId, method))!;
    for (const change of TeamRunChanges.all)
      context.tools.register(change.descriptor, new MethodTool(context.moduleId, change, handlerOf(change.method), subjects, conversations));
    context.tools.register(TeamRunChanges.send, new SendTool(context.moduleId, engine, engine, teammates));
    for (const [tool, method, paramsOf] of [[SubAgentTools.start, MethodName.SubAgentStart, SubAgentTools.startParamsOf],
      [SubAgentTools.wait, MethodName.SubAgentWait, SubAgentTools.waitParamsOf], [SubAgentTools.stop, MethodName.SubAgentStop, SubAgentTools.stopParamsOf]] as const)
      context.tools.register(tool, new SubAgentTool(context.moduleId, tool, handlerOf(method), engine, paramsOf));
    context.tools.register(CommandTools.run, new SubAgentTool(context.moduleId, CommandTools.run, handlerOf(MethodName.CommandStart), engine,
      CommandTools.runParamsOf, Resources.commandNoRunningTurn));
  }

  private static registerAnswerer(context: IRuntimePartContext, engine: ConversationEngine, calls: ServedCalls): Registration | null {
    try {
      return context.permissions.registerAnswerer(new PermissionAnswerer(engine, calls));
    }
    catch (error) {
      if (!(error instanceof PermissionAccessException))
        throw error;
      context.log.write(Resources.answererNotRegistered);
      return null;
    }
  }

  private static async listenAsync(endpoint: McpHttpEndpoint, context: IRuntimePartContext): Promise<string | null> {
    try {
      return await endpoint.listenAsync();
    }
    catch (error) {
      context.log.write(Resources.formatEndpointNotListening(CoreResources.formatFailureKind(error)));
      return null;
    }
  }

  private async readCommandAsync(context: IRuntimePartContext, written: TeammateCommand | null): Promise<TeammateCommand | null> {
    return Object.isNull(written) ? null
      : this.commands.commandOf(context.moduleFolder, ProductInfo.current.slug, context.moduleId, await context.readEnvironmentAsync());
  }

  private async writeCommandAsync(context: IRuntimePartContext): Promise<TeammateCommand | null> {
    try {
      return await this.commands.writeAsync(context.moduleFolder, ProductInfo.current.slug, context.moduleId);
    }
    catch (error) {
      context.log.write(Resources.formatCommandNotWritten(CoreResources.formatFailureKind(error)));
      return null;
    }
  }

  private handlerOf(context: IRuntimePartContext, engine: ConversationEngine, providers: ProvidersService, method: MethodName,
    dispatched: IMethodHandler): IMethodHandler {
    const handler = RuntimePart.MAIN_PROCESS_ONLY.has(method) ? new MainProcessMethod(dispatched)
      : method === MethodName.ProviderCreate ? new ProviderCreateMethod(dispatched)
      : method === MethodName.ProviderUpdate ? new ProviderUpdateMethod(new MainProcessMethod(dispatched, Resources.binaryPathField), providers)
      : RuntimePart.MODE_SETTING.has(method) ? new MainProcessMethod(dispatched, Resources.modeField)
      : method === MethodName.MessageSend ? new RequestedModeMethod(dispatched, engine, t => MessageSendParams.fromJson(t))
      : method === MethodName.WaitingMessageAdd ? new RequestedModeMethod(dispatched, engine, t => WaitingMessageAddParams.fromJson(t).message,
        async t => (await engine.addWaitingAsync(WaitingMessageAddParams.fromJson(t), true)).toJson())
      : method === MethodName.WaitingMessageEdit ? new RequestedModeMethod(dispatched, engine, t => WaitingMessageEditParams.fromJson(t).message,
        async t => (await engine.editWaitingAsync(WaitingMessageEditParams.fromJson(t), true)).toJson())
      : method === MethodName.AttachmentShare || method === MethodName.WrittenImageShare ? new FileShareMethod(dispatched, context)
        : method === MethodName.AttachmentPrepare ? new GrantedAttachmentMethod(dispatched, context, engine) : dispatched;
    const description = RuntimePart.WORK.get(method);
    if (Object.isUndefined(description))
      return handler;
    const working = new WorkingMethod(handler, context, description);
    if (RuntimePart.AWAITED.has(method))
      this.awaited.push(working);
    return working;
  }
}
