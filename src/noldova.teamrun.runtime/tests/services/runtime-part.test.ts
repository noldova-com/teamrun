/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { createServer } from "node:net";
import { delimiter, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { FolderReference, ListRequest } from "@noldova/checkpoints.protocol";
import { AppsService, RuntimePart as ComputerUseRuntimePart } from "@noldova/computer-use.runtime";
import { FailureCode, ShellClients } from "@noldova/desktop.protocol";
import {
  AnswererRegisteredException,
  ClientClosure,
  DataDirectory,
  type IPermissionAnswerer,
  type IPermissionRequest,
  type IToolDescriptor,
  MethodFailureException,
  ModuleDeclaration,
  OwnershipLock,
  ProcessSettings,
  ProcessSupervisor,
  PermissionDecision,
  PermissionDetailKind,
  PermissionOption,
  RegistrationException,
  RememberedPermissionStore,
  RequestContext,
  ShellDatabase,
  ShellMigrations,
  ToolContent,
  ToolDescriptor,
  type ToolFailure,
  ToolFailureCode,
  ToolResult,
  ToolRisk
} from "@noldova/desktop.runtime";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import {
  AcpAgentOffer,
  AcpStoredAgent,
  ApprovalAsk,
  DatabaseContext,
  type ForkRequest,
  type IAcpAgentCatalog,
  type ILog,
  type IProviderAdapter,
  type ISignInListener,
  type ITurnListener,
  MessagesService,
  ProviderKindRegistry,
  ProviderKindVersions,
  Resources,
  type SharedMcpRefusal,
  SignInCheck,
  TaskStart,
  TurnDetail,
  TurnOutcome,
  type TurnRequest,
  TurnResult,
  TurnStart,
  type TurnTools
} from "@noldova/teamrun.core";
import { DataSource, DbContextOptionsBuilder } from "@noldova/context.data";
import {
  AcpAgentIdParams,
  AcpAgentListing,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalScope,
  AuthStatus,
  BackgroundTask,
  BackgroundTaskIdParams,
  BackgroundTaskListParams,
  BackgroundTaskPage,
  BackgroundTaskStatus,
  ComputerUseGrant,
  Conversation,
  ConversationResponder,
  ConversationResponderParams,
  ConversationRewindResult,
  DataFolder,
  DefaultTeammate,
  DefaultTeammateSetParams,
  DetailEventPayload,
  DetailKind,
  EventName,
  type ForkedSession,
  Harness,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageIdParams,
  MessageListParams,
  MessageSendParams,
  MessageSendResult,
  MessageStatus,
  MethodName,
  ObservedSettings,
  OutsideConnection,
  PageEventName,
  PageMethodName,
  Project,
  ProjectIdParams,
  Provenance,
  type Provider,
  ProviderCreateParams,
  ProviderKind,
  ProviderMode,
  ProviderModel,
  ProviderModelList,
  ProviderProfile,
  RequestedSettings,
  SharedMcpProviderSetParams,
  SharedMcpServerDefinition,
  SharedMcpTransport,
  SubAgent,
  SubAgentStatus,
  TeammateCreateParams,
  TeammateUpdateParams
} from "@noldova/teamrun.protocol";
import { ExecutableLocator, type IProcessStarter } from "@noldova/teamrun.providers";
import {
  HostedMigrations,
  type IProviderKindRegistryFactory,
  McpHttpEndpoint,
  ModuleDatabaseProvider,
  ProviderKindRegistryFactory,
  Resources as RuntimeResources,
  RuntimePart,
  RuntimePartException,
  RuntimeToolSession
} from "@noldova/teamrun.runtime";

import { AnsweringAsker } from "../fixtures/answering-asker.fixture.js";
import { CheckpointsModule } from "../fixtures/checkpoints-module.fixture.js";
import { ComputerUseHarness } from "../fixtures/computer-use-harness.fixture.js";
import { DeclaredSettings } from "../fixtures/declared-settings.fixture.js";
import { FakeComputerUseApps } from "../fixtures/fake-computer-use-apps.fixture.js";
import { MemoryModuleDatabase } from "../fixtures/memory-module-database.fixture.js";
import { OpenPermissionCenter } from "../fixtures/open-permission-center.fixture.js";
import { ProductFile } from "../fixtures/product-file.fixture.js";
import { RecordingOutput } from "../fixtures/recording-output.fixture.js";
import { RecordingPartContext } from "../fixtures/recording-part-context.fixture.js";
import { RecordingTerminalOwners } from "../fixtures/recording-terminal-owners.fixture.js";
import { RefusingServer } from "../fixtures/refusing-server.fixture.js";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class RuntimePartTests {
  private static readonly quickStop: ProcessSettings = new ProcessSettings(250);
  private static readonly treeScript: string = [
    "import { spawn } from \"node:child_process\";",
    "import { writeFileSync } from \"node:fs\";",
    "const children = [0, 1].map(() => spawn(process.execPath, [\"-e\", \"setTimeout(() => undefined, 60000)\"], { stdio: \"ignore\" }));",
    "writeFileSync(process.argv[2], [process.pid, ...children.map(t => t.pid)].join(\" \"));",
    "setTimeout(() => undefined, 60000);"
  ].join("\n");
  private static readonly notesTool: IToolDescriptor = {
    name: "notes_delete",
    description: "Deletes a note.",
    inputSchema: { type: "object" },
    hints: { isDestructive: true },
    risk: { default: ToolRisk.High, maximum: ToolRisk.High },
    deadline: { default: 60_000, maximum: 60_000 },
    isResumable: true
  };
  private static readonly notesRequest: IPermissionRequest = {
    action: "notes.deleteItem",
    subject: "item-1",
    title: "Delete the note Groceries",
    details: [{ label: "Token", kind: PermissionDetailKind.Secret, value: "not-kept" }],
    risk: ToolRisk.High,
    options: [PermissionOption.AllowOnce, PermissionOption.Deny]
  };

  @TestMethod
  public async servesTheChatEnginesMethodsAndEventsOverTheModulesDatabase(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const registries = new RecordingRegistries(new ProviderKindRegistry());
    const part = new RuntimePart(registries, "1.2.3");

    await part.activateAsync(context);
    const opened = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path });
    const listed = await RuntimePartTests.callAsync(context, "teamrun.projectList", null);
    const folder = DataFolder.fromJson(await RuntimePartTests.callAsync(context, "teamrun.dataFolderRead", null));
    const outside = OutsideConnection.fromJson(await RuntimePartTests.callAsync(context, "teamrun.outsideConnectionRead", null));
    const reset = OutsideConnection.fromJson(await RuntimePartTests.callAsync(context, "teamrun.outsideTokenReset", null));
    await part.deactivateAsync();

    Assert.areEqual(Object.values(MethodName).length + Object.values(PageMethodName).length, context.methods.size);
    Assert.isTrue(context.methods.has("teamrun.teammateList"));
    Assert.areEqual(Object.values(EventName).length + Object.values(PageEventName).length, context.published.size);
    Assert.areEqual(1, context.published.get("teamrun.stateInvalidated")?.length);
    Assert.isDefined(opened);
    Assert.areEqual(1, (listed as unknown[]).length);
    Assert.areEqual("1.2.3", registries.productVersion);
    Assert.areEqual(directory.path, registries.dataDirectory);
    Assert.isTrue(registries.log === context.log);
    Assert.areEqual(directory.path, folder.path);
    Assert.areEqual(join(directory.path, "teamrun.sqlite"), folder.databaseFile);
    Assert.areEqual(part.migrations, HostedMigrations.all);
    Assert.areEqual(0, context.openWork.size);
    Assert.areEqual("false null null", `${outside.enabled} ${outside.token} ${outside.failure}`);
    Assert.areEqual(context.saved.get("teamrun.outsideToken"), reset.token);
    Assert.isTrue(/^[A-Za-z0-9_-]{43}$/.test(String(reset.token)));
  }

  @TestMethod
  public async asksGitHubsAccessServiceWhenItListsAServerThatSignsInWithGitHub(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const asked: AbortSignal[] = [];
    const access = {
      accessAsync: (signal: AbortSignal) => {
        asked.push(signal);
        return Promise.resolve({ reason: "Sign in to GitHub in Settings, GitHub." });
      }
    };
    const context = new RecordingPartContext(directory.path, database, directory.path, new Map<string, object>([...checkpoints.services, ["git-github.access", access]]));
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");

    await part.activateAsync(context);
    await RuntimePartTests.callAsync(context, "teamrun.sharedMcpServerCreate", SharedMcpServerDefinition.gitHub.toJson());
    const listed = await RuntimePartTests.callAsync(context, "teamrun.sharedMcpServerList", null);
    await part.deactivateAsync();

    Assert.areEqual(1, (listed as unknown[]).length);
    Assert.areEqual(1, asked.length);
    Assert.isFalse(asked[0]?.aborted ?? true);
  }

  @TestMethod
  public async listensForOutsideSessionsOnItsOwnEndpointWhenTheyAreOnAtStartUp(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const settings = new DeclaredSettings();
    const port = await RuntimePartTests.freePortAsync();
    settings.write("teamrun.outsidePort", port);
    settings.write("teamrun.outsideSessions", true);
    context.settings = settings;
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");

    await part.activateAsync(context);
    const outside = OutsideConnection.fromJson(await RuntimePartTests.callAsync(context, "teamrun.outsideConnectionRead", null));
    const refused = await RuntimePartTests.statusOfAsync(outside.url);
    await part.deactivateAsync();

    Assert.areEqual(`true ${context.saved.get("teamrun.outsideToken")} null`, `${outside.enabled} ${outside.token} ${outside.failure}`);
    Assert.isTrue(outside.url.includes(`:${port}`));
    Assert.areEqual(401, refused);
  }

  @TestMethod
  public async sweepsTheDraftFilesNoDraftHoldsAtStartUp(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const stray = join(directory.path, "attachments", "draft-files", "gone");
    mkdirSync(stray, { recursive: true });
    writeFileSync(join(stray, "a.txt"), "a");
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");

    await part.activateAsync(new RecordingPartContext(directory.path, database, directory.path, checkpoints.services));
    await part.deactivateAsync();

    Assert.isFalse(existsSync(stray));
  }

  @TestMethod
  public async writesADraftItCannotReadAtStartUpToTheModuleLog(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    const first = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    await part.activateAsync(first);
    const project = await RuntimePartTests.callAsync(first, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const conversation = await RuntimePartTests.callAsync(first, "teamrun.conversationCreate", { projectId: project.id, title: null }) as { id: string };
    await RuntimePartTests.callAsync(first, "teamrun.draftSave",
      { chatId: conversation.id, text: "Look", attachments: [{ name: "a.txt", mediaType: "text/plain", data: "YQ==", path: null }] });
    await part.deactivateAsync();
    database.run("UPDATE drafts SET json = 'not json' WHERE chatId = ?", conversation.id);
    const second = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);

    await part.activateAsync(second);
    await part.deactivateAsync();

    Assert.areEqual(0, first.lines.length);
    Assert.areEqual(`The draft of the chat ending in "${conversation.id.slice(-12)}" was not read, so its files were kept: JsonException.`, second.lines.join("\n"));
  }

  @TestMethod
  public async preparesAFileByItsGrantThroughItsRegisteredMethodAndRefusesTheGrantOnceUsed(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    const chosen = join(directory.path, "report.pdf");
    writeFileSync(chosen, "report");
    context.granted.grant("g1", chosen);
    await part.activateAsync(context);
    const input = { name: "report.pdf", mediaType: "application/pdf", data: null, path: null, grant: "g1" };

    const prepared = await RuntimePartTests.callAsync(context, "teamrun.attachmentPrepare", input) as { path: string; size: number };
    const copied = readFileSync(prepared.path, "utf8");
    const refused = await RuntimePartTests.callAsync(context, "teamrun.attachmentPrepare", input).then(() => null, (t: unknown) => t);
    await part.deactivateAsync();

    Assert.areEqual("report 6", `${copied} ${prepared.size}`);
    Assert.isInstanceOf(refused, MethodFailureException);
    Assert.areEqual(`${FailureCode.InvalidParams} The file's grant is unknown, already used or expired.`,
      `${(refused as MethodFailureException).failure.code} ${(refused as MethodFailureException).failure.message}`);
  }

  @TestMethod
  public async servesTheAddedAgentsMethodsAndBringsAnAddedAgentBackAtTheNextStart(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const stored = new AcpStoredAgent(MentioningAdapter.id, "Mentioning", { id: MentioningAdapter.id });
    const catalog: IAcpAgentCatalog = {
      listAsync: () => Promise.resolve(new AcpAgentListing([], [], "listed", null)),
      readIconAsync: () => Promise.resolve(null),
      readOfferAsync: () => Promise.resolve(new AcpAgentOffer(stored, null)),
      localOf: () => stored,
      openAsync: () => Promise.resolve(new MentioningAdapter(join(directory.path, "usual"))),
      referencesOf: () => [],
      removeFilesAsync: () => Promise.resolve()
    };
    const firstRegistry = new ProviderKindRegistry();
    const secondRegistry = new ProviderKindRegistry();
    const first = new RuntimePart(new CatalogRegistries(firstRegistry, catalog), "1.2.3");
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    await first.activateAsync(context);

    const added = ProviderKind.fromJson(await RuntimePartTests.callAsync(context, "teamrun.acpAgentAdd", new AcpAgentIdParams(MentioningAdapter.id).toJson()));
    const listed = AcpAgentListing.fromJson(await RuntimePartTests.callAsync(context, "teamrun.acpAgentList", null));
    await first.deactivateAsync();
    const second = new RuntimePart(new CatalogRegistries(secondRegistry, catalog), "1.2.3");
    await second.activateAsync(new RecordingPartContext(directory.path, database, directory.path, checkpoints.services));
    await second.deactivateAsync();

    Assert.areEqual(MentioningAdapter.id, added.id);
    Assert.areEqual("listed", listed.failure);
    Assert.isTrue(firstRegistry.has(MentioningAdapter.id));
    Assert.isTrue(secondRegistry.has(MentioningAdapter.id));
  }

  @TestMethod
  public async givesAChatAndTheDefaultTeammateSavedWithNoProviderTheProviderInTheirKindsUsualFolderAtStartUp(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const usual = join(directory.path, "usual");
    const registry = new ProviderKindRegistry();
    registry.register(new MentioningAdapter(usual));
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    const requested = new RequestedSettings(MentioningAdapter.id, null, null);
    const first = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    await part.activateAsync(first);
    const project = await RuntimePartTests.callAsync(first, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const conversation = await RuntimePartTests.callAsync(first, "teamrun.conversationCreate", { projectId: project.id, title: null }) as { id: string };
    const other = await RuntimePartTests.callAsync(first, "teamrun.conversationCreate", { projectId: project.id, title: null }) as { id: string };
    await RuntimePartTests.callAsync(first, "teamrun.conversationResponderSet",
      new ConversationResponderParams(conversation.id, new ConversationResponder(null, requested), true).toJson());
    await RuntimePartTests.callAsync(first, "teamrun.conversationResponderSet",
      new ConversationResponderParams(other.id, new ConversationResponder(null, new RequestedSettings("gone", null, null)), true).toJson());
    await RuntimePartTests.callAsync(first, "teamrun.defaultTeammateSet", new DefaultTeammateSetParams(new DefaultTeammate(requested)).toJson());
    const provider = await RuntimePartTests.callAsync(first, "teamrun.providerCreate", new ProviderCreateParams(MentioningAdapter.id, "Home", usual).toJson()) as
      { id: string };
    await part.deactivateAsync();
    const second = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);

    await part.activateAsync(second);
    const chats = await RuntimePartTests.callAsync(second, "teamrun.conversationList", new ProjectIdParams(project.id).toJson()) as unknown[];
    const kept = DefaultTeammate.fromJson(await RuntimePartTests.callAsync(second, "teamrun.defaultTeammateRead", null));
    await part.deactivateAsync();

    const chosen = (id: string): string | null | undefined => chats.map(t => Conversation.fromJson(t)).find(t => t.id === id)?.responder?.providerId;
    Assert.areEqual(`${provider.id} null`, `${chosen(conversation.id)} ${chosen(other.id)}`);
    Assert.areEqual(provider.id, kept.providerId);
  }

  @TestMethod
  public async keepsTheDefaultTeammateSavedWithNoProviderWithoutOneWhenItsKindHasNoProviderAtStartUp(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const registry = new ProviderKindRegistry();
    registry.register(new MentioningAdapter(join(directory.path, "usual")));
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    const requested = new RequestedSettings("gone", null, null);
    const first = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    await part.activateAsync(first);
    await RuntimePartTests.callAsync(first, "teamrun.defaultTeammateSet", new DefaultTeammateSetParams(new DefaultTeammate(requested)).toJson());
    await RuntimePartTests.callAsync(first, "teamrun.providerCreate", new ProviderCreateParams(MentioningAdapter.id, "Home", join(directory.path, "usual")).toJson());
    await part.deactivateAsync();
    const second = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);

    await part.activateAsync(second);
    const kept = DefaultTeammate.fromJson(await RuntimePartTests.callAsync(second, "teamrun.defaultTeammateRead", null));
    await part.deactivateAsync();

    Assert.areEqual(JSON.stringify(["gone", null]), JSON.stringify([kept.requested.kind, kept.providerId]));
  }

  @TestMethod
  public async refusesASecondActivationAndRefusesAFailedCallWithItsCode(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    await part.activateAsync(context);

    try {
      await Assert.throwsAsync(() => part.activateAsync(context), RuntimePartException);
      const error = await RuntimePartTests.callAsync(context, "teamrun.teammateDelete", {}).then(() => null, (t: unknown) => t);

      Assert.isInstanceOf(error, MethodFailureException);
      Assert.areEqual(FailureCode.InvalidParams, (error as MethodFailureException).failure.code);
    }
    finally {
      await part.deactivateAsync();
    }
  }

  @TestMethod
  public async undoesAFailedActivationAndReportsAProviderThatDidNotStop(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const refusing = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    refusing.refusedMethod = "teamrun.projectList";
    const registry = new ProviderKindRegistry();
    registry.register({ descriptor: { id: "stubborn" }, shutdown: () => Promise.reject(new Error("The fixture cannot stop.")) } as unknown as IProviderAdapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");

    const refusal = await part.activateAsync(refusing).then(() => null, (t: unknown) => t);
    await part.activateAsync(new RecordingPartContext(directory.path, database, directory.path, checkpoints.services));

    await Assert.throwsAsync(() => part.deactivateAsync(), RuntimePartException);
    await part.deactivateAsync();

    Assert.areEqual("The fixture refuses teamrun.projectList.", (refusal as Error).message);
  }

  @TestMethod
  public async forwardsNothingTheServicesOfAFailedActivationPublish(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const refusing = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    refusing.refusedMethod = "teamrun.panelAnswered";
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    const call = (method: string, payload: JsonObject): Promise<unknown> =>
      refusing.methods.get(method)!.handleAsync(new RequestContext(ShellClients.mainProcess, payload, new AbortController().signal, 2, 7));

    const refusal = await part.activateAsync(refusing).then(() => null, (t: unknown) => t);
    await call("teamrun.windowFocused", { windowId: "w1", shownChatId: null, focused: true });
    await call("teamrun.windowReload", { windowId: "w1" });

    Assert.areEqual("The fixture refuses teamrun.panelAnswered.", (refusal as Error).message);
    Assert.areEqual("[]", JSON.stringify(refusing.published.get("teamrun.windowReloadRequested")));
  }

  @TestMethod
  public async takesDesktopCoresVersionAndThisProcesssProvidersByDefault(): Promise<void> {
    using product = new ProductFile();
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const registries = new RecordingRegistries(new ProviderKindRegistry());
    const part = new RuntimePart(registries);

    await part.activateAsync(new RecordingPartContext(directory.path, database, directory.path, checkpoints.services));
    await part.deactivateAsync();

    Assert.areEqual(product.version, registries.productVersion);
    Assert.areEqual(HostedMigrations.all, new RuntimePart().migrations);
  }

  @TestMethod
  public async registersExactlyTheMethodsAndEventsItsModuleDeclares(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    const declaration = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve("@noldova/teamrun/module.json")), "utf8")) as
      { id: string; contributes: { methods: readonly string[]; events: readonly string[]; tools: readonly string[] } };

    await part.activateAsync(context);
    const methods = [...context.methods.keys()];
    const events = [...context.published.keys()];
    const tools = context.tools.registry.listTools().map(t => t.name);
    await part.deactivateAsync();

    Assert.areEqual(context.moduleId, declaration.id);
    Assert.areEqual([...declaration.contributes.methods].sort().join(","), methods.sort().join(","));
    Assert.areEqual([...declaration.contributes.events].sort().join(","), events.sort().join(","));
    Assert.areEqual([...declaration.contributes.tools].sort().join(","), tools.sort().join(","));
  }

  @TestMethod
  public async holdsWorkWhileARewindRunsAndWaitsForItBeforeClosingTheDatabaseOnQuit(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    await part.activateAsync(context);
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: null }) as { id: string };
    const now = new Date().toISOString();
    {
      await using seeding = DatabaseContext.attach(new DbContextOptionsBuilder().use(new ModuleDatabaseProvider(database), new DataSource("seeding", directory.path)), directory.path);
      await new MessagesService(seeding).insertAsync(new Message("m1", chat.id, 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, now, null, now));
    }

    const rewinding = RuntimePartTests.callAsync(context, "teamrun.conversationRewind", { chatId: chat.id, messageId: "m1", restoreFiles: true });
    const during = [...context.openWork];
    await part.deactivateAsync();
    const rewound = await rewinding as { removedMessageIds: readonly string[] };

    Assert.areEqual("A chat is rewinding.", during.join(","));
    Assert.areEqual("m1", rewound.removedMessageIds.join(","));
    Assert.areEqual(0, context.openWork.size);
  }

  @TestMethod
  public async refusesARewindOrMoveStartedWhileQuittingWaitsForAnotherRewindAndStillWaitsForThatOne(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    await part.activateAsync(context);
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: null }) as { id: string };
    const now = new Date().toISOString();
    {
      await using seeding = DatabaseContext.attach(new DbContextOptionsBuilder().use(new ModuleDatabaseProvider(database), new DataSource("seeding", directory.path)), directory.path);
      await new MessagesService(seeding).insertAsync(new Message("m1", chat.id, 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, now, null, now));
    }

    const rewinding = RuntimePartTests.callAsync(context, "teamrun.conversationRewind", { chatId: chat.id, messageId: "m1", restoreFiles: true });
    const quitting = part.deactivateAsync();
    const refused = await Promise.all([
      RuntimePartTests.callAsync(context, "teamrun.conversationRewind", { chatId: chat.id, messageId: "m1", restoreFiles: true }),
      RuntimePartTests.callAsync(context, "teamrun.conversationMove", { chatId: chat.id, projectId: null })
    ].map(t => t.then(() => null, (error: unknown) => error)));
    const rewound = await rewinding as { removedMessageIds: readonly string[] };
    await quitting;

    Assert.areEqual(`${FailureCode.Unavailable},${FailureCode.Unavailable}`,
      refused.map(t => t instanceof MethodFailureException ? t.failure.code : String(t)).join(","));
    Assert.areEqual("m1", rewound.removedMessageIds.join(","));
    Assert.areEqual(0, context.openWork.size);
  }

  @TestMethod
  public async holdsWorkWhileAMoveCopiesAChatsFilesAndWaitsForItBeforeClosingTheDatabaseOnQuit(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    await part.activateAsync(context);
    const target = join(directory.path, "project");
    mkdirSync(target);
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: target }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: null, title: null }) as { id: string; folder: string };
    for (const name of ["a.txt", "b.txt", "c.txt"])
      writeFileSync(join(chat.folder, name), name);

    const moving = RuntimePartTests.callAsync(context, "teamrun.conversationMove", { chatId: chat.id, projectId: project.id });
    const during = [...context.openWork];
    await part.deactivateAsync();
    const moved = await moving as { projectId: string };

    Assert.areEqual("A chat is moving to a project.", during.join(","));
    Assert.areEqual(project.id, moved.projectId);
    Assert.areEqual("a.txt,b.txt,c.txt", ["a.txt", "b.txt", "c.txt"].filter(t => readFileSync(join(target, t), "utf8") === t).join(","));
    Assert.areEqual(0, context.openWork.size);
  }

  @TestMethod
  public async holdsWorkWhileAnInstallAndASignInRunAndEndsItWhenQuittingStopsThem(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const installing = Promise.withResolvers<void>();
    const signingIn = Promise.withResolvers<void>();
    const stopped = Promise.withResolvers<void>();
    const registry = new ProviderKindRegistry();
    registry.register({
      descriptor: { id: "stub", displayName: "Stub", supportsSignIn: true },
      installation: {
        isInstalled: false,
        unavailable: null,
        missingTool: null,
        install: (): Promise<void> => {
          installing.resolve();
          return stopped.promise;
        },
        readVersions: (): Promise<ProviderKindVersions> => Promise.resolve(ProviderKindVersions.unknown)
      },
      signIn: (): Promise<void> => {
        signingIn.resolve();
        return stopped.promise.then(() => Promise.reject(new Error("The stub stopped.")));
      },
      shutdown: (): Promise<void> => {
        stopped.resolve();
        return Promise.resolve();
      }
    } as unknown as IProviderAdapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    const provider = await RuntimePartTests.callAsync(context, "teamrun.providerCreate", { kind: "stub", label: "Stub", profileDir: directory.path }) as
      { id: string };

    const install = RuntimePartTests.callAsync(context, "teamrun.providerKindInstall", { kind: "stub" }).then(() => "installed", () => "failed");
    const signIn = RuntimePartTests.callAsync(context, "teamrun.providerSignIn", { providerId: provider.id }).then(() => "signed in", () => "failed");
    await Promise.all([installing.promise, signingIn.promise]);
    const during = [...context.openWork].sort();
    await part.deactivateAsync();
    const ended = [await install, await signIn];

    Assert.areEqual("A provider is installing.,A sign-in is running.", during.join(","));
    Assert.areEqual("installed,failed", ended.join(","));
    Assert.areEqual(0, context.openWork.size);
  }

  @TestMethod
  public async holdsWorkWhileASearchForProvidersRuns(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const folder = join(directory.path, ".stub");
    mkdirSync(folder);
    writeFileSync(join(folder, "settings.json"), "{}");
    const checking = Promise.withResolvers<void>();
    const checked = Promise.withResolvers<{ authStatus: string; identity: null }>();
    const registry = new ProviderKindRegistry();
    registry.register({
      descriptor: { id: "stub", displayName: "Stub", profile: null },
      profileSearch: { folders: [folder], entries: ["settings.json"], skipped: [] },
      checkFoundSignIn: () => {
        checking.resolve();
        return checked.promise;
      },
      shutdown: (): Promise<void> => Promise.resolve()
    } as unknown as IProviderAdapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);

    const search = RuntimePartTests.callAsync(context, "teamrun.providerProfileDiscover", { kinds: null });
    await checking.promise;
    const during = [...context.openWork];
    checked.resolve({ authStatus: "LoggedIn", identity: null });
    const found = await search as { profiles: { profileDir: string; authStatus: string }[] };
    await part.deactivateAsync();

    Assert.areEqual("A search for providers is running.", during.join(","));
    Assert.areEqual(`${folder} LoggedIn`, found.profiles.map(t => `${t.profileDir} ${t.authStatus}`).join());
    Assert.areEqual(0, context.openWork.size);
  }

  @TestMethod
  public async publishesAChatTheCliDeletesToEveryWindowAndClosesItsTerminalsWithNoWindow(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const owners = new RecordingTerminalOwners();
    const services = new Map<string, object>([...checkpoints.services, [RuntimeResources.terminalOwnersServiceName, owners]]);
    const context = new RecordingPartContext(directory.path, database, directory.path, services);
    using center = await OpenPermissionCenter.openAsync(context.tools.center);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    await part.activateAsync(context);
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: null }) as { id: string };
    const scope = Resources.formatToolScope(chat.id, null);
    center.store.remember("computer-use", "computer-use.controlApp", "com.example.notes", scope, PermissionDecision.AllowedAlways);

    await context.methods.get("teamrun.conversationDelete")!.handleAsync(new RequestContext("cli", { chatId: chat.id }, new AbortController().signal, 2));
    const listed = await RuntimePartTests.callAsync(context, "teamrun.conversationList", { projectId: project.id });
    await part.deactivateAsync();

    Assert.areEqual(JSON.stringify([{ chatId: chat.id }]), JSON.stringify(context.published.get("teamrun.conversationDeleted")));
    Assert.areEqual(0, (listed as unknown[]).length);
    Assert.areEqual(`teamrun.chat/${chat.id}`, owners.closed.join(","));
    Assert.isNull(center.store.find("computer-use", "computer-use.controlApp", "com.example.notes", scope));
  }

  @TestMethod
  @TestData(ShellClients.commandLine, FailureCode.Unauthorized)
  @TestData("module/teamrun", FailureCode.Unauthorized)
  @TestData(ShellClients.mainProcess, FailureCode.NotFound)
  public async takesAnApprovalAnswerOnlyFromTheAppsMainProcessAndRefusesTheCommandLineAndAModulesOwnEntry(client: string, code: FailureCode): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    await part.activateAsync(context);

    const error = await context.methods.get("teamrun.approvalDecide")!.handleAsync(
      new RequestContext(client, { approvalId: "approval", optionId: "allow" }, new AbortController().signal, 2)).then(() => null, (t: unknown) => t);
    await part.deactivateAsync();

    Assert.isInstanceOf(error, MethodFailureException);
    Assert.areEqual(code, (error as MethodFailureException).failure.code);
  }

  @TestMethod
  public async answersAMessagesDetailsAfterASequenceAndRefusesANegativeOne(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    await part.activateAsync(context);

    const missing = await RuntimePartTests.callAsync(context, "teamrun.messageDetailsAfter", { messageId: "missing", afterSequence: 0, sequences: [] });
    const error = await RuntimePartTests.callAsync(context, "teamrun.messageDetailsAfter", { messageId: "missing", afterSequence: -1, sequences: [] })
      .then(() => null, (t: unknown) => t);
    await part.deactivateAsync();

    Assert.isNull(missing);
    Assert.isInstanceOf(error, MethodFailureException);
    Assert.areEqual(FailureCode.InvalidParams, (error as MethodFailureException).failure.code);
  }

  @TestMethod
  public async sharesAChatsSavedDraftImageWithTheAskingPageByItsRealPathAndAnswersOnlyTheGrant(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    await part.activateAsync(context);
    const project = JsonReader.fromValue(await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path })).readString("id");
    const chat = JsonReader.fromValue(await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project, title: null })).readString("id");
    const draft = JsonReader.fromValue(await RuntimePartTests.callAsync(context, "teamrun.draftSave",
      { chatId: chat, text: "Look", attachments: [{ name: "shot.png", mediaType: "image/png", data: "AAEC", path: null }] }));
    const path = draft.readObjectArray("attachments")[0]!.readString("path");

    const shared = await RuntimePartTests.callAsync(context, "teamrun.attachmentShare", { chatId: chat, path });
    await part.deactivateAsync();

    Assert.areEqual(JSON.stringify({ grant: "1".padStart(32, "0") }), JSON.stringify(shared));
    Assert.areEqual(JSON.stringify([[realpathSync(path), { mediaType: "image/png", lifetime: 600000 }]]), JSON.stringify(context.shares.map(t => [t.file, t.options])));
    Assert.areEqual(chat, JsonReader.fromValue(context.shares[0]!.request.payload).readString("chatId"));
  }

  @TestMethod
  public async sharesACopyOfAnImageAReplyWroteInItsProjectWithTheAskingPageAndAnswersOnlyTheGrant(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    await part.activateAsync(context);
    const project = join(directory.path, "alpha");
    mkdirSync(project);
    const projectId = JsonReader.fromValue(await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: project })).readString("id");
    const chat = JsonReader.fromValue(await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId, title: null })).readString("id");
    const chart = join(project, "chart.png");
    writeFileSync(chart, Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d49484452000000020000000300", "hex"), Buffer.alloc(4)]));
    const now = new Date().toISOString();
    {
      await using seeding = DatabaseContext.attach(new DbContextOptionsBuilder().use(new ModuleDatabaseProvider(database), new DataSource("seeding", directory.path)), directory.path);
      await new MessagesService(seeding).insertAsync(new Message("m1", chat, 0, MessageAuthor.User, null, MessageStatus.Completed,
        [new MessageDetail(0, DetailKind.FileChange, "Wrote", { changes: [{ path: chart, kind: "add" }] }, now)], null, now, null, now));
    }

    const shared = await RuntimePartTests.callAsync(context, "teamrun.writtenImageShare", { chatId: chat, messageId: "m1", path: chart });
    await part.deactivateAsync();

    Assert.areEqual(JSON.stringify({ grant: "1".padStart(32, "0") }), JSON.stringify(shared));
    const [share] = context.shares;
    Assert.areEqual(JSON.stringify([{ mediaType: "image/png", lifetime: 600000 }]), JSON.stringify(context.shares.map(t => t.options)));
    Assert.isDefined(share);
    Assert.areEqual(readFileSync(chart).toString("hex"), readFileSync(share.file).toString("hex"));
    Assert.isTrue(share.file.startsWith(join(directory.path, "shared-images")));
  }

  @TestMethod
  @TestData(0, null)
  @TestData(2, null)
  @TestData(10, null)
  @TestData(100, 11)
  public async stopsATeammateChainAtTheHandOffLimitTheWindowSetAndGivesItTheToolsAndTheProductsCommandFolder(limit: number, handOffs: number | null): Promise<void> {
    using product = new ProductFile();
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const settings = new DeclaredSettings();
    settings.writeFromWindow("teamrun.chainHopLimit", limit);
    context.settings = settings;
    const registry = new ProviderKindRegistry();
    const adapter = new MentioningAdapter();
    adapter.handOffs = handOffs ?? Number.POSITIVE_INFINITY;
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: null }) as { id: string };
    const provider = await RuntimePartTests.callAsync(context, "teamrun.providerCreate",
      { kind: MentioningAdapter.id, label: "Work", profileDir: join(directory.path, "profile") }) as { id: string };
    const team: { id: string }[] = [];
    for (const name of ["Alice", "Bob"])
      team.push(await RuntimePartTests.callAsync(context, "teamrun.teammateCreate",
        new TeammateCreateParams(name, name, provider.id, Harness.Provider, null, null).toJson()) as { id: string });

    const chainEnded = context.whenWorkEnds();
    await RuntimePartTests.callAsync(context, "teamrun.messageSend", new MessageSendParams(chat.id, "@Alice start", null, null, [], [team[0]!.id]).toJson());
    await chainEnded;
    const listed = JSON.stringify(await RuntimePartTests.callAsync(context, "teamrun.messageList", new MessageListParams(chat.id, null).toJson()));
    await part.deactivateAsync();

    Assert.areEqual((handOffs ?? limit) + 1, adapter.turns);
    Assert.areEqual(Object.isNull(handOffs), listed.includes(`${limit} hand-offs`));
    Assert.isTrue(adapter.instructions.every(t => t?.includes("`teamrun_send_message` sends a message") === true && !t.includes(`${product.slug} teamrun`)));
    Assert.isTrue(existsSync(join(directory.path, "command", product.slug)));
    Assert.isTrue(adapter.environments.every(t => Object.values(t).some(u => u.startsWith(join(directory.path, "command")))));
  }

  @TestMethod
  public async givesEachTurnTheCommandsPathAndTheSharedServersByTheEnvironmentDesktopCoreReadsForThatTurn(): Promise<void> {
    using product = new ProductFile();
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const registry = new ProviderKindRegistry();
    const adapter = new MentioningAdapter();
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: null }) as { id: string };
    const provider = await RuntimePartTests.callAsync(context, "teamrun.providerCreate",
      { kind: MentioningAdapter.id, label: "Work", profileDir: join(directory.path, "profile") }) as { id: string };
    const alice = await RuntimePartTests.callAsync(context, "teamrun.teammateCreate",
      new TeammateCreateParams("Alice", "Alice", provider.id, Harness.Provider, null, null).toJson()) as { id: string };
    const server = await RuntimePartTests.callAsync(context, "teamrun.sharedMcpServerCreate",
      new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", ["-y", "search"], ["SEARCH_KEY"], null, [], null).toJson()) as { id: string };
    await RuntimePartTests.callAsync(context, "teamrun.sharedMcpProviderSet", new SharedMcpProviderSetParams(server.id, provider.id, true).toJson());

    for (const environment of [{ PATH: "/before" }, { PATH: "/after", SEARCH_KEY: "set since" }]) {
      context.environment = environment;
      const ended = context.whenWorkEnds();
      await RuntimePartTests.callAsync(context, "teamrun.messageSend", new MessageSendParams(chat.id, "@Alice start", null, null, [], [alice.id]).toJson());
      await ended;
    }
    await part.deactivateAsync();

    const folder = join(directory.path, "command");
    Assert.isTrue(existsSync(join(folder, product.slug)));
    Assert.areEqual(`${folder}${delimiter}/before,${folder}${delimiter}/after`, adapter.environments.map(t => t["PATH"]).join(","));
    Assert.areEqual(",search", adapter.sharedServers.join(","));
  }

  @TestMethod
  public async keepsTheNoteOnTeamRunsToolsAndLogsWhyWhenTheCommandCantBeWritten(): Promise<void> {
    using product = new ProductFile();
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    writeFileSync(join(directory.path, "command"), "");
    const registry = new ProviderKindRegistry();
    const adapter = new MentioningAdapter();
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: null }) as { id: string };
    const provider = await RuntimePartTests.callAsync(context, "teamrun.providerCreate",
      { kind: MentioningAdapter.id, label: "Work", profileDir: join(directory.path, "profile") }) as { id: string };
    const alice = await RuntimePartTests.callAsync(context, "teamrun.teammateCreate",
      new TeammateCreateParams("Alice", "Alice", provider.id, Harness.Provider, null, null).toJson()) as { id: string };

    const ended = context.whenWorkEnds();
    await RuntimePartTests.callAsync(context, "teamrun.messageSend", new MessageSendParams(chat.id, "@Alice start", null, null, [], [alice.id]).toJson());
    await ended;
    await part.deactivateAsync();

    Assert.areEqual(Resources.formatTeammateInstructions("Alice", null, true), adapter.instructions[0]);
    Assert.isFalse(existsSync(join(directory.path, "command", product.slug)));
    Assert.areEqual("TEAMRUN_SENDER_TOKEN", Object.keys(adapter.environments[0] ?? {}).join(","));
    Assert.isTrue(context.lines.some(t => /^Teammates can't reach other chats: TeamRun's command for them could not be written \(Error E[A-Z]+\)\.$/.test(t)),
      context.lines.join("\n"));
  }

  @TestMethod
  public async servesItsToolsToATeammatesTurnThroughDesktopCoresRegistryAndItsEndpoint(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const moduleFolder = join(directory.path, "modules", "teamrun");
    mkdirSync(moduleFolder, { recursive: true });
    const context = new RecordingPartContext(moduleFolder, database, moduleFolder, checkpoints.services);
    const registry = new ProviderKindRegistry();
    const adapter = new ToolCallingAdapter();
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string; rootPath: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Release" }) as { id: string };
    adapter.chatId = chat.id;

    const providerId = await RuntimePartTests.providerIdAsync(context, ToolCallingAdapter.id, directory.path);
    const ended = context.whenWorkEnds();
    await RuntimePartTests.callAsync(context, "teamrun.messageSend",
      new MessageSendParams(chat.id, "List them", new RequestedSettings(ToolCallingAdapter.id, null, null), providerId).toJson());
    await ended;
    const afterTurn = await adapter.request!.tools!.host.callToolAsync("teamrun_list_projects", {}, new AbortController().signal);
    await part.deactivateAsync();

    const [listed, projects, chats, messages, approvals, pending, missing, invalid, foreign] = adapter.answers;
    Assert.areEqual(JSON.stringify(["teamrun_add_teammate_to_chat", "teamrun_cancel_replies", "teamrun_canvas_add_artboard", "teamrun_canvas_arrange", "teamrun_canvas_create", "teamrun_canvas_read", "teamrun_canvas_revise_artboard", "teamrun_check_provider", "teamrun_close_panel",
      "teamrun_create_chat", "teamrun_create_teammate", "teamrun_delete_chat", "teamrun_delete_teammate", "teamrun_edit_page", "teamrun_forget_project", "teamrun_list_approvals",
      "teamrun_list_chats", "teamrun_list_messages", "teamrun_list_pages", "teamrun_list_projects", "teamrun_list_providers", "teamrun_list_teammates", "teamrun_move_chat",
      "teamrun_open_panel", "teamrun_open_project", "teamrun_read_page", "teamrun_remove_teammate_from_chat", "teamrun_rename_chat", "teamrun_run_in_background",
      "teamrun_send_message", "teamrun_show_page", "teamrun_start_sub_agent", "teamrun_stop_sub_agent", "teamrun_update_teammate", "teamrun_wait_sub_agents"]),
      JSON.stringify((listed as JsonObject[]).map(t => t["name"]).sort()));
    const described = (listed as JsonObject[]).find(t => t["name"] === "teamrun_list_messages")!;
    Assert.areEqual("List messages", described["title"]);
    Assert.areEqual(JSON.stringify({ readOnlyHint: true, destructiveHint: false, openWorldHint: false }), JSON.stringify(described["annotations"]));
    Assert.areEqual(JSON.stringify({ readOnlyHint: false, destructiveHint: false, openWorldHint: true }),
      JSON.stringify((listed as JsonObject[]).find(t => t["name"] === "teamrun_check_provider")!["annotations"]));
    Assert.areEqual(JSON.stringify(["chat_id"]), JSON.stringify((described["inputSchema"] as JsonObject)["required"]));
    Assert.isTrue(RuntimePartTests.textOf(projects).startsWith(`${project.id}  `), RuntimePartTests.textOf(projects));
    Assert.areEqual(`${chat.id}  Release  no teammates  replying`, RuntimePartTests.textOf(chats));
    Assert.isTrue(RuntimePartTests.textOf(messages).includes("List them"), RuntimePartTests.textOf(messages));
    Assert.isFalse((messages as JsonObject)["isError"] as boolean);
    Assert.areEqual("(none)", RuntimePartTests.textOf(approvals));
    Assert.areEqual("(none)", RuntimePartTests.textOf(pending));
    Assert.isTrue((missing as JsonObject)["isError"] as boolean);
    Assert.isTrue(RuntimePartTests.textOf(missing).startsWith("Refused (teamrun.notFound): "), RuntimePartTests.textOf(missing));
    Assert.isTrue(RuntimePartTests.textOf(invalid).startsWith("Refused"), RuntimePartTests.textOf(invalid));
    Assert.areEqual("Refused: TeamRun's MCP server serves only TeamRun's, Terminal's, computer use's, the Browser's and the Git modules' tools, not checkpoints_list.", RuntimePartTests.textOf(foreign));
    Assert.isTrue(RuntimePartTests.textOf(afterTurn).startsWith("Unavailable"), RuntimePartTests.textOf(afterTurn));
    Assert.areEqual(JSON.stringify(["browser_click", "browser_console", "browser_navigate", "browser_press_key", "browser_screenshot", "browser_snapshot", "browser_type",
      "browser_wait_for", "computer_batch", "computer_click", "computer_drag", "computer_key", "computer_list_apps", "computer_list_displays", "computer_move",
      "computer_read_window", "computer_request_apps", "computer_screenshot", "computer_scroll", "computer_type", "computer_zoom",
      "git_branches", "git_commit", "git_create_branch", "git_diff", "git_github_pr_checks", "git_github_pr_create", "git_github_read", "git_log", "git_pull", "git_push",
      "git_stage", "git_status", "git_switch_branch", "git_unstage", "teamrun_add_teammate_to_chat", "teamrun_cancel_replies", "teamrun_canvas_add_artboard", "teamrun_canvas_arrange", "teamrun_canvas_create", "teamrun_canvas_read", "teamrun_canvas_revise_artboard", "teamrun_close_panel", "teamrun_create_chat",
      "teamrun_create_teammate", "teamrun_delete_chat", "teamrun_delete_teammate", "teamrun_edit_page", "teamrun_forget_project", "teamrun_list_approvals", "teamrun_list_chats", "teamrun_list_messages", "teamrun_list_pages",
      "teamrun_list_projects", "teamrun_list_providers", "teamrun_list_teammates", "teamrun_move_chat", "teamrun_open_panel", "teamrun_open_project", "teamrun_read_page",
      "teamrun_remove_teammate_from_chat", "teamrun_rename_chat", "teamrun_send_message", "teamrun_show_page", "teamrun_start_sub_agent", "teamrun_stop_sub_agent",
      "teamrun_update_teammate", "teamrun_wait_sub_agents", "terminal_close", "terminal_interrupt",
      "terminal_list", "terminal_open", "terminal_read", "terminal_run", "terminal_write"]),
    JSON.stringify([...RuntimePartTests.toolsOf(adapter).approvedTools].sort()));
    Assert.areEqual(`${chat.id}/default`, context.tools.sessions[0]!.scope);
    Assert.areEqual(JSON.stringify({ "terminal.folder": project.rootPath, "terminal.shared": [], "terminal.owner": `teamrun.chat/${chat.id}`,
      "git.folder": project.rootPath, page: chat.id, profileKey: project.id, agentName: "Tool-calling provider" }),
      JSON.stringify(context.tools.sessions[0]!.bindings));
    const endpoint = RuntimePartTests.toolsOf(adapter).endpoint;
    Assert.isNotNull(endpoint);
    Assert.isTrue(/^http:\/\/127\.0\.0\.1:[1-9]\d*\/mcp$/.test(endpoint.url), endpoint.url);
  }

  @TestMethod
  public async startsWithoutItsEndpointAndLogsWhyWhenItCantListen(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const moduleFolder = join(directory.path, "modules", "teamrun");
    mkdirSync(moduleFolder, { recursive: true });
    const context = new RecordingPartContext(moduleFolder, database, moduleFolder, checkpoints.services);
    const registry = new ProviderKindRegistry();
    const adapter = new ToolCallingAdapter();
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3", undefined, t => new McpHttpEndpoint(t, new RefusingServer()));
    await part.activateAsync(context);
    const projectId = JsonReader.fromValue(await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path })).readString("id");
    const chatId = JsonReader.fromValue(await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId, title: "Release" })).readString("id");
    adapter.chatId = chatId;

    const providerId = await RuntimePartTests.providerIdAsync(context, ToolCallingAdapter.id, directory.path);
    const ended = context.whenWorkEnds();
    await RuntimePartTests.callAsync(context, "teamrun.messageSend",
      new MessageSendParams(chatId, "List them", new RequestedSettings(ToolCallingAdapter.id, null, null), providerId).toJson());
    await ended;
    await part.deactivateAsync();

    Assert.isNull(RuntimePartTests.toolsOf(adapter).endpoint);
    Assert.areEqual(JSON.stringify(["teamrun_close_panel", "teamrun_open_panel"]),
      JSON.stringify(RuntimePartTests.toolsOf(adapter).approvedTools.filter(t => t.endsWith("_panel")).sort()));
    Assert.isTrue(RuntimePartTests.textOf(adapter.answers[1]).startsWith(`${projectId}  `), RuntimePartTests.textOf(adapter.answers[1]));
    const refused = "TeamRun's MCP endpoint could not listen, so every teammate's turn fails, saying so, until TeamRun restarts (Error).";
    Assert.areEqual(1, context.lines.filter(t => t === refused).length, context.lines.join("\n"));
  }

  @TestMethod
  public async makesItsEndpointEvenWhenTheEnvironmentAsksForTheOffSwitchTheBridgeHad(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const moduleFolder = join(directory.path, "modules", "teamrun");
    mkdirSync(moduleFolder, { recursive: true });
    const context = new RecordingPartContext(moduleFolder, database, moduleFolder, checkpoints.services);
    const registry = new ProviderKindRegistry();
    const adapter = new ToolCallingAdapter();
    registry.register(adapter);
    let made = 0;
    process.env["TEAMRUN_MCP_ENDPOINT"] = "off";
    try {
      const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3", undefined, t => {
        made += 1;
        return new McpHttpEndpoint(t);
      });
      await part.activateAsync(context);
      const projectId = JsonReader.fromValue(await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path })).readString("id");
      const chatId = JsonReader.fromValue(await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId, title: "Release" })).readString("id");
      adapter.chatId = chatId;

      const providerId = await RuntimePartTests.providerIdAsync(context, ToolCallingAdapter.id, directory.path);
      const ended = context.whenWorkEnds();
      await RuntimePartTests.callAsync(context, "teamrun.messageSend",
        new MessageSendParams(chatId, "List them", new RequestedSettings(ToolCallingAdapter.id, null, null), providerId).toJson());
      await ended;
      await part.deactivateAsync();

      Assert.areEqual(1, made);
      Assert.isNotNull(RuntimePartTests.toolsOf(adapter).endpoint);
      Assert.isFalse(context.lines.some(t => t.includes("TEAMRUN_MCP_ENDPOINT")), context.lines.join("\n"));
      Assert.isTrue(RuntimePartTests.textOf(adapter.answers[1]).startsWith(`${projectId}  `), RuntimePartTests.textOf(adapter.answers[1]));
    }
    finally {
      delete process.env["TEAMRUN_MCP_ENDPOINT"];
    }
  }

  @TestMethod
  public async asksThePersonOnTheTurnsReplyForAnotherModulesPermissionRequestThroughDesktopCoreKeepingNoSecret(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const registry = new ProviderKindRegistry();
    const adapter = new PermissionAdapter(context);
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    context.tools.registry.register("notes", new ToolDescriptor(RuntimePartTests.notesTool, ["notes_delete"]), {
      handleAsync: async t => new ToolResult([ToolContent.fromText((await t.requestPermissionAsync(RuntimePartTests.notesRequest)).decision, null)])
    }, ["notes_delete"], context.log);
    const created: JsonValue[] = [];
    context.onPublished = (name, payload) => {
      if (name !== "teamrun.approvalCreated")
        return;
      created.push(payload);
      void context.methods.get("teamrun.approvalDecide")!.handleAsync(new RequestContext(ShellClients.mainProcess,
        { approvalId: (payload as JsonObject)["id"] as string, optionId: "allowOnce" }, new AbortController().signal, 3));
    };
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Notes" }) as { id: string };

    const providerId = await RuntimePartTests.providerIdAsync(context, PermissionAdapter.id, directory.path);
    const ended = context.whenWorkEnds();
    await RuntimePartTests.callAsync(context, "teamrun.messageSend",
      new MessageSendParams(chat.id, "Tidy the notes", new RequestedSettings(PermissionAdapter.id, null, null), providerId).toJson());
    await ended;
    await part.deactivateAsync();

    Assert.areEqual("AllowedOnce", adapter.answer);
    Assert.areEqual(1, created.length);
    const approval = created[0] as JsonObject;
    Assert.areEqual(ApprovalKind.Permission, approval["kind"]);
    Assert.areEqual("notes.deleteItem", approval["nativeKind"]);
    Assert.areEqual("Delete the note Groceries", approval["summary"]);
    Assert.areEqual(JSON.stringify({ module: "notes", subject: "item-1", risk: "High", details: [{ label: "Token", kind: "Secret", value: null }] }),
      JSON.stringify(approval["payload"]));
    Assert.isFalse(JSON.stringify([...context.published.values()]).includes("not-kept"));
    Assert.isFalse(JSON.stringify(database.readAll("SELECT json FROM approvals")).includes("not-kept"));
  }

  @TestMethod
  public async answersNoPermissionRequestListsNoGrantAndSaysWhyWhenTheAppNamesAnotherPermissionsModule(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services, "notes");
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");

    await part.activateAsync(context);
    const served = context.methods.has("teamrun.messageSend");
    const grants = await context.methods.get("teamrun.computerUseGrantList")?.handleAsync(
      new RequestContext("cli", null, new AbortController().signal, 2)).then(() => null, (t: unknown) => t);
    await part.deactivateAsync();

    Assert.isTrue(served);
    Assert.areEqual(1, context.lines.filter(t => t === "TeamRun answers no permission requests, since it isn't this app's permissions module.").length);
    Assert.isInstanceOf(grants, MethodFailureException);
    Assert.areEqual(FailureCode.UnknownMethod, grants instanceof MethodFailureException ? grants.failure.code : null);
  }

  @TestMethod
  public async listsTheAppsAndScreenTheCenterRemembersForItsChatsAndRevokesOneThroughItAsTheAppsPermissionsModule(): Promise<void> {
    using directory = new TemporaryDirectory();
    using shellFolder = new TemporaryDirectory();
    using lock = OwnershipLock.acquire(new DataDirectory(shellFolder.path));
    using shell = await ShellDatabase.openAsync(lock, ShellMigrations.all, new Date(), new RecordingOutput());
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const store = new RememberedPermissionStore(shell);
    context.tools.center.open(store);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");

    await part.activateAsync(context);
    const project = Project.fromJson(await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }));
    const chat = Conversation.fromJson(await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Release notes" }));
    const scope = Resources.formatToolScope(chat.id, null);
    store.remember("computer-use", "computer-use.controlApp", "com.example.notes", scope, PermissionDecision.AllowedAlways);
    store.remember("computer-use", "computer-use.controlScreen", "screen", scope, PermissionDecision.AllowedAlways);
    const listed = RuntimePartTests.grantsOf(await RuntimePartTests.callAsync(context, "teamrun.computerUseGrantList", null));
    const revoked = await RuntimePartTests.callAsync(context, "teamrun.computerUseGrantRevoke", { grantId: listed.find(t => t.app !== null)?.id ?? null });
    const left = RuntimePartTests.grantsOf(await RuntimePartTests.callAsync(context, "teamrun.computerUseGrantList", null));
    await part.deactivateAsync();

    Assert.areEqual(JSON.stringify([[chat.id, "Release notes", "com.example.notes"], [chat.id, "Release notes", null]]),
      JSON.stringify(listed.map(t => [t.chatId, t.chatTitle, t.app]).toSorted((a, b) => String(a[2]).localeCompare(String(b[2])))));
    Assert.isTrue(listed.every(t => Object.isNull(t.appName)));
    Assert.isNull(revoked);
    Assert.areEqual(JSON.stringify([null]), JSON.stringify(left.map(t => t.app)));
    Assert.isNull(store.find("computer-use", "computer-use.controlApp", "com.example.notes", scope));
    Assert.areEqual(PermissionDecision.AllowedAlways, store.find("computer-use", "computer-use.controlScreen", "screen", scope));
  }

  @TestMethod
  public async namesEachAllowedAppThroughComputerUsesAppsServiceWhenItFindsOne(): Promise<void> {
    using directory = new TemporaryDirectory();
    using shellFolder = new TemporaryDirectory();
    using lock = OwnershipLock.acquire(new DataDirectory(shellFolder.path));
    using shell = await ShellDatabase.openAsync(lock, ShellMigrations.all, new Date(), new RecordingOutput());
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const apps = new FakeComputerUseApps();
    apps.descriptions.set("com.example.notes", { name: "Notes", icon: Uint8Array.of(0x89, 0x50, 0x4e, 0x47) });
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    context.publishService("computer-use.apps", apps);
    const store = new RememberedPermissionStore(shell);
    context.tools.center.open(store);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");

    await part.activateAsync(context);
    const project = Project.fromJson(await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }));
    const chat = Conversation.fromJson(await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Release notes" }));
    const scope = Resources.formatToolScope(chat.id, null);
    store.remember("computer-use", "computer-use.controlApp", "com.example.notes", scope, PermissionDecision.AllowedAlways);
    store.remember("computer-use", "computer-use.controlScreen", "screen", scope, PermissionDecision.AllowedAlways);
    const listed = RuntimePartTests.grantsOf(await RuntimePartTests.callAsync(context, "teamrun.computerUseGrantList", null));
    await part.deactivateAsync();

    Assert.areEqual(JSON.stringify([["com.example.notes", "Notes", "iVBORw=="], [null, null, null]]),
      JSON.stringify(listed.map(t => [t.app, t.appName, t.appIcon]).toSorted((a, b) => String(a[0]).localeCompare(String(b[0])))));
    Assert.areEqual("com.example.notes", apps.described.join(","));
  }

  @TestMethod
  public async namesEachAllowedAppByItsIdentityWhenWhatItFindsAsTheAppsServiceHasAnotherShape(): Promise<void> {
    using directory = new TemporaryDirectory();
    using shellFolder = new TemporaryDirectory();
    using lock = OwnershipLock.acquire(new DataDirectory(shellFolder.path));
    using shell = await ShellDatabase.openAsync(lock, ShellMigrations.all, new Date(), new RecordingOutput());
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, new Map([...checkpoints.services, ["computer-use.apps", { describe: "Notes" }]]));
    const store = new RememberedPermissionStore(shell);
    context.tools.center.open(store);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");

    await part.activateAsync(context);
    const project = Project.fromJson(await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }));
    const chat = Conversation.fromJson(await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Release notes" }));
    store.remember("computer-use", "computer-use.controlApp", "com.example.notes", Resources.formatToolScope(chat.id, null), PermissionDecision.AllowedAlways);
    const listed = RuntimePartTests.grantsOf(await RuntimePartTests.callAsync(context, "teamrun.computerUseGrantList", null));
    await part.deactivateAsync();

    Assert.areEqual(JSON.stringify([["com.example.notes", null, null]]), JSON.stringify(listed.map(t => [t.app, t.appName, t.appIcon])));
  }

  @TestMethod
  public async refusesToActivateBesideAnotherAnswererAndRemovesItsOwnOnDeactivation(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    const other: IPermissionAnswerer = { answerAsync: () => Promise.resolve(PermissionDecision.Denied) };
    const registered = context.permissions.registerAnswerer(other);

    const refused = await part.activateAsync(context).then(() => null, (t: unknown) => t);
    registered[Symbol.dispose]();
    await part.activateAsync(context);
    Assert.throws(() => context.permissions.registerAnswerer(other), AnswererRegisteredException);
    await part.deactivateAsync();
    const afterwards = context.permissions.registerAnswerer(other);
    afterwards[Symbol.dispose]();

    Assert.isInstanceOf(refused, RegistrationException);
  }

  @TestMethod
  public async listsTheProvidersAndTheTeammatesByNameThroughItsToolsIgnoringCaseWithAnAccentedNameBesideItsLetter(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const moduleFolder = join(directory.path, "modules", "teamrun");
    mkdirSync(moduleFolder, { recursive: true });
    const context = new RecordingPartContext(moduleFolder, database, moduleFolder, checkpoints.services);
    const registry = new ProviderKindRegistry();
    const adapter = new ToolCallingAdapter();
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Release" }) as { id: string };
    adapter.chatId = chat.id;
    const providerIds: string[] = [];
    for (const label of ["zeta", "Émile", "bob", "Alice", "edgar"])
      providerIds.push((await RuntimePartTests.callAsync(context, "teamrun.providerCreate",
        new ProviderCreateParams(ToolCallingAdapter.id, label, join(directory.path, "profiles", label)).toJson()) as { id: string }).id);
    for (const name of ["zoe", "Émile", "bob", "Alice", "edgar"])
      await RuntimePartTests.callAsync(context, "teamrun.teammateCreate", new TeammateCreateParams(name, null, providerIds[0]!, Harness.Provider, null, null).toJson());

    const ended = context.whenWorkEnds();
    await RuntimePartTests.callAsync(context, "teamrun.messageSend",
      new MessageSendParams(chat.id, "List them", new RequestedSettings(ToolCallingAdapter.id, null, null), providerIds[0]!).toJson());
    await ended;
    await part.deactivateAsync();

    const [providers, teammates] = adapter.answers.slice(-2);
    const column = (answer: unknown, index: number): string => RuntimePartTests.textOf(answer).split("\n").filter(t => !t.startsWith(" ")).map(t => t.split("  ")[index]).join();
    Assert.areEqual(["Alice", "bob", "edgar", "Émile", "zeta"].join(), column(providers, 2));
    Assert.areEqual(["Alice", "bob", "edgar", "Émile", "zoe"].join(), column(teammates, 1));
  }

  private static textOf(answer: unknown): string {
    return ((answer as JsonObject)["content"] as JsonObject[])[0]!["text"] as string;
  }

  @TestMethod
  @TestData(ShellClients.commandLine)
  @TestData("module/teamrun")
  public async takesWindowReportsAndPanelAnswersOnlyFromTheAppsMainProcess(client: string): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    await part.activateAsync(context);

    const calls: readonly [string, JsonObject][] = [
      ["teamrun.windowFocused", { windowId: "w1", shownChatId: null }], ["teamrun.windowClosed", { windowId: "w1" }],
      ["teamrun.panelAnswered", { requestId: "r1" }]
    ];
    const errors = await Promise.all(calls.map(([method, payload]) => context.methods.get(method)!.handleAsync(
      new RequestContext(client, payload, new AbortController().signal, 2)).then(() => null, (t: unknown) => t)));
    await part.deactivateAsync();

    Assert.isTrue(errors.every(t => t instanceof MethodFailureException && t.failure.code === FailureCode.Unauthorized));
  }

  @TestMethod
  public async refusesAReloadOfATeamRunWindowWhoseDesktopWindowClosedOrWhosePageWasReplaced(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    await part.activateAsync(context);
    const call = (method: string, payload: JsonObject, window: number): Promise<unknown> =>
      context.methods.get(method)!.handleAsync(new RequestContext(ShellClients.mainProcess, payload, new AbortController().signal, 2, window));
    const reload = (windowId: string): Promise<unknown> => call("teamrun.windowReload", { windowId }, 9).then(() => null, (t: unknown) => t);

    await call("teamrun.windowFocused", { windowId: "w1", shownChatId: null, focused: true }, 7);
    await call("teamrun.windowFocused", { windowId: "w2", shownChatId: null, focused: false }, 8);
    const open = await reload("w1");
    await call("teamrun.windowFocused", { windowId: "w3", shownChatId: null, focused: true }, 7);
    await context.closeClientAsync(new ClientClosure(2, 8));
    const [replaced, closed, current] = [await reload("w1"), await reload("w2"), await reload("w3")];
    await part.deactivateAsync();

    Assert.isNull(open);
    Assert.isNull(current);
    Assert.isTrue([replaced, closed].every(t => t instanceof MethodFailureException && t.failure.code === FailureCode.NotFound));
    Assert.areEqual(JSON.stringify([{ windowId: "w1" }, { windowId: "w3" }]), JSON.stringify(context.published.get("teamrun.windowReloadRequested")));
  }

  @TestMethod
  public async reloadsAWindowAfterARestartOnceTheWindowReportsAgain(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    const before = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const call = (context: RecordingPartContext, method: string, payload: JsonObject): Promise<unknown> =>
      context.methods.get(method)!.handleAsync(new RequestContext(ShellClients.mainProcess, payload, new AbortController().signal, 2, 7));
    const report = { windowId: "w1", shownChatId: null, focused: true };
    await part.activateAsync(before);
    await call(before, "teamrun.windowFocused", report);
    await part.deactivateAsync();

    const after = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    await part.activateAsync(after);
    const unknown = await call(after, "teamrun.windowReload", { windowId: "w1" }).then(() => null, (t: unknown) => t);
    await call(after, "teamrun.windowFocused", report);
    const reloaded = await call(after, "teamrun.windowReload", { windowId: "w1" });
    await part.deactivateAsync();

    Assert.isTrue(unknown instanceof MethodFailureException && unknown.failure.code === FailureCode.NotFound);
    Assert.isNull(reloaded);
    Assert.areEqual(JSON.stringify([{ windowId: "w1" }]), JSON.stringify(after.published.get("teamrun.windowReloadRequested")));
  }

  @TestMethod
  public async tellsWindowsOfTheRepliesAndStepsAnEarlierRuntimeLeftRunning(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    const before = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    await part.activateAsync(before);
    const project = await RuntimePartTests.callAsync(before, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(before, "teamrun.conversationCreate", { projectId: project.id, title: null }) as { id: string };
    await part.deactivateAsync();
    const now = new Date().toISOString();
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false);
    const agent = new MessageDetail(0, DetailKind.SubAgent, "Explore", new SubAgent("t0", null, "Explore", null, SubAgentStatus.Running, true).toJson(), now);
    {
      await using seeding = DatabaseContext.attach(new DbContextOptionsBuilder().use(new ModuleDatabaseProvider(database), new DataSource("seeding", directory.path)), directory.path);
      await new MessagesService(seeding).insertAsync(new Message("r1", chat.id, 0, MessageAuthor.Provider, null, MessageStatus.Running, [agent], provenance, now, now, null));
    }

    const after = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    await part.activateAsync(after);
    await part.deactivateAsync();

    const updated = (after.published.get("teamrun.detailUpdated") ?? []).map(t => DetailEventPayload.fromJson(t));
    Assert.areEqual("r1 0", updated.map(t => `${t.messageId} ${t.detail.sequence}`).join());
    Assert.areEqual(SubAgentStatus.Stopped, SubAgent.fromJson(updated[0]!.detail.payload).status);
    Assert.areEqual(MessageStatus.Interrupted, Message.fromJson(after.published.get("teamrun.messageUpdated")?.[0]).status);
  }

  @TestMethod
  public async opensAPanelThroughItsToolInTheWindowThatShowsTheCallersChat(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const part = new RuntimePart(new RecordingRegistries(new ProviderKindRegistry()), "1.2.3");
    await part.activateAsync(context);
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Release" }) as { id: string };
    const report = (method: string, payload: JsonObject): Promise<unknown> =>
      context.methods.get(method)!.handleAsync(new RequestContext(ShellClients.mainProcess, payload, new AbortController().signal, 2));

    await report("teamrun.windowFocused", { windowId: "mine", shownChatId: chat.id, focused: true });
    await report("teamrun.windowFocused", { windowId: "last", shownChatId: null, focused: true });
    const session = context.tools.openSession(`${chat.id}/default`, {});
    const called = session.callAsync("teamrun_open_panel", { panel: "Teammates" });
    const request = await context.whenPublished("teamrun.panelRequested") as JsonObject;
    const requests = context.published.get("teamrun.panelRequested") ?? [];
    await report("teamrun.panelAnswered", { requestId: request["requestId"]!, windowId: request["windowId"]!, outcome: "Done" });
    const result = await called;
    const refused = await session.callAsync("teamrun_open_panel", { panel: "Terminal" });
    session.end();
    await part.deactivateAsync();

    Assert.areEqual(JSON.stringify(["mine", "Teammates", null, true]),
      JSON.stringify([request["windowId"], request["panel"], request["chatId"], request["open"]]));
    Assert.isFalse(result.isFailure);
    Assert.areEqual("Opened the panel Teammates in a TeamRun window.", result.content[0]!.value);
    Assert.isTrue(refused.isFailure && refused.code === ToolFailureCode.Refused);
    Assert.areEqual(1, requests.length);
  }

  @TestMethod
  public async endsTheTurnOfASessionAPartStopsSaysWhyInItsReplyAndStopsListeningOnceDeactivated(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const registry = new ProviderKindRegistry();
    const adapter = new ChangingAdapter(context);
    adapter.holds = true;
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Work" }) as { id: string };
    const providerId = await RuntimePartTests.providerIdAsync(context, ChangingAdapter.id, directory.path);
    const ended = context.whenWorkEnds();

    await RuntimePartTests.callAsync(context, "teamrun.messageSend",
      new MessageSendParams(chat.id, "Wait", new RequestedSettings(ChangingAdapter.id, null, null), providerId).toJson());
    const session = await context.tools.whenSessionOpens();
    context.tools.stopSession(session.id, "The person took over the page.");
    await ended;
    const listed = JSON.stringify(await RuntimePartTests.callAsync(context, "teamrun.messageList", new MessageListParams(chat.id, null).toJson()));
    const listening = context.tools.sessionStopListeners;
    await part.deactivateAsync();

    Assert.isTrue(listed.includes("The turn was stopped: The person took over the page."), listed);
    Assert.isTrue(listed.includes(`"status":"${MessageStatus.Cancelled}"`), listed);
    Assert.areEqual(1, listening);
    Assert.areEqual(0, context.tools.sessionStopListeners);
  }

  @TestMethod
  public async logsAStopOfASessionWhoseTurnItCannotEndRatherThanLeavingItUnhandled(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const registry = new ProviderKindRegistry();
    const adapter = new ChangingAdapter(context);
    adapter.holds = true;
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Work" }) as { id: string };
    const providerId = await RuntimePartTests.providerIdAsync(context, ChangingAdapter.id, directory.path);
    const sent = MessageSendResult.fromJson(await RuntimePartTests.callAsync(context, "teamrun.messageSend",
      new MessageSendParams(chat.id, "Wait", new RequestedSettings(ChangingAdapter.id, null, null), providerId).toJson()));
    const session = await context.tools.whenSessionOpens();
    const [reply] = sent.replies;
    Assert.isDefined(reply);
    database.run("DELETE FROM messages WHERE id = ?", reply.id);
    const line = RuntimeResources.formatSessionStopFailed("ServiceException");

    context.tools.stopSession(session.id, "The person took over the page.");
    await context.whenLogged(line);
    await part.deactivateAsync();

    Assert.isTrue(context.lines.includes(line), context.lines.join("\n"));
  }

  @TestMethod
  public async makesATurnsChangesThroughItsToolsAskingTheTurnsReplyBeforeARiskyOne(): Promise<void> {
    using directory = new TemporaryDirectory();
    using other = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    using _center = await OpenPermissionCenter.openAsync(context.tools.center);
    const registry = new ProviderKindRegistry();
    const adapter = new ChangingAdapter(context);
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    const created: JsonObject[] = [];
    context.onPublished = (name, payload) => {
      if (name !== "teamrun.approvalCreated")
        return;
      created.push(payload as JsonObject);
      void context.methods.get("teamrun.approvalDecide")!.handleAsync(new RequestContext(ShellClients.mainProcess,
        { approvalId: (payload as JsonObject)["id"] as string, optionId: "allowOnce" }, new AbortController().signal, 3));
    };
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string; name: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Work" }) as { id: string };
    const kept = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Kept" }) as { id: string };
    const archive = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: other.path }) as { id: string; name: string };
    const old = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: archive.id, title: "Old" }) as { id: string };
    adapter.calls = [
      ["teamrun_rename_chat", { chat_id: old.id, title: "Older" }], ["teamrun_delete_chat", { chat_id: old.id }],
      ["teamrun_delete_chat", { chat_id: kept.id }], ["teamrun_send_message", { chat_id: "missing", text: "Noted" }]
    ];

    const providerId = await RuntimePartTests.providerIdAsync(context, ChangingAdapter.id, directory.path);
    const ended = context.whenWorkEnds();
    await RuntimePartTests.callAsync(context, "teamrun.messageSend",
      new MessageSendParams(chat.id, "Tidy up", new RequestedSettings(ChangingAdapter.id, null, null), providerId).toJson());
    await ended;
    const remaining = await RuntimePartTests.callAsync(context, "teamrun.conversationList", { projectId: project.id }) as { id: string }[];
    const archived = await RuntimePartTests.callAsync(context, "teamrun.conversationList", { projectId: archive.id }) as { id: string }[];
    await part.deactivateAsync();

    const [renamed, deleted, busy, sent] = adapter.results as [ToolResult, ToolResult, ToolFailure, ToolFailure];
    Assert.areEqual("Older", (JSON.parse(renamed.content[0]!.value) as { title: string }).title);
    Assert.areEqual("Done.", deleted.content[0]!.value);
    Assert.areEqual("Refused A teammate can't delete a chat in the project it is answering in, since TeamRun changes no chat of a project while a turn runs there.",
      `${busy.code} ${busy.message}`);
    Assert.areEqual("OutcomeUncertain teamrun.notFound teamrun_list_messages", `${sent.code} ${sent.moduleCode} ${sent.nextTool}`);
    Assert.areEqual(1, created.length);
    Assert.areEqual(JSON.stringify([ApprovalKind.Permission, "teamrun.deleteChat", "Delete the chat \"Older\"", { module: "teamrun", subject: old.id, risk: "High",
      details: [{ label: "Chat", kind: "Text", value: "Older" }, { label: "Project", kind: "Text", value: archive.name }] }]),
    JSON.stringify([created[0]!["kind"], created[0]!["nativeKind"], created[0]!["summary"], created[0]!["payload"]]));
    Assert.areEqual(JSON.stringify([[chat.id, kept.id].sort(), []]), JSON.stringify([remaining.map(t => t.id).sort(), archived.map(t => t.id)]));
  }

  @TestMethod
  public async asksBeforeASendOnlyByTeamRunsCardSinceTheProviderHasTheSendApproved(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    context.settings = new DeclaredSettings();
    using _center = await OpenPermissionCenter.openAsync(context.tools.center);
    const registry = new ProviderKindRegistry();
    const adapter = new ChangingAdapter(context);
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    const created: JsonObject[] = [];
    context.onPublished = (name, payload) => {
      if (name !== "teamrun.approvalCreated")
        return;
      created.push(payload as JsonObject);
      void context.methods.get("teamrun.approvalDecide")!.handleAsync(new RequestContext(ShellClients.mainProcess,
        { approvalId: (payload as JsonObject)["id"] as string, optionId: "allowOnce" }, new AbortController().signal, 3));
    };
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Work" }) as { id: string };
    const inbox = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Inbox" }) as { id: string };
    adapter.calls = [["teamrun_send_message", { chat_id: inbox.id, text: "Noted" }]];

    const providerId = await RuntimePartTests.providerIdAsync(context, ChangingAdapter.id, directory.path);
    const ended = context.whenWorkEnds();
    await RuntimePartTests.callAsync(context, "teamrun.messageSend",
      new MessageSendParams(chat.id, "Pass it on", new RequestedSettings(ChangingAdapter.id, null, null), providerId).toJson());
    await ended;
    const listed = JSON.stringify(await RuntimePartTests.callAsync(context, "teamrun.messageList", new MessageListParams(inbox.id, null).toJson()));
    await part.deactivateAsync();

    Assert.areEqual(JSON.stringify([["teamrun.sendMessage", "Send a message to the chat \"Inbox\"", "Medium"]]),
      JSON.stringify(created.map(t => [t["nativeKind"], t["summary"], (t["payload"] as JsonObject)["risk"]])));
    Assert.isTrue(adapter.results[0] instanceof ToolResult, JSON.stringify(adapter.results[0]));
    Assert.isTrue(listed.includes("Noted"), listed);
  }

  @TestMethod
  public async runsABackgroundCommandWhereTheModeAllowsItLeavingTheAskToTheProviderAndRefusesItInAReadOnlyMode(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    using _center = await OpenPermissionCenter.openAsync(context.tools.center);
    const registry = new ProviderKindRegistry();
    const adapter = new CommandModeAdapter();
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    const asked: string[] = [];
    context.onPublished = name => {
      if (name === "teamrun.approvalCreated")
        asked.push(name);
    };
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const providerId = await RuntimePartTests.providerIdAsync(context, CommandModeAdapter.id, directory.path);

    for (const mode of ["look", "ask", "all"]) {
      const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: mode }) as { id: string };
      const answered = adapter.answered(adapter.answers.length + 1);
      await RuntimePartTests.callAsync(context, "teamrun.messageSend",
        new MessageSendParams(chat.id, "Build it", new RequestedSettings(CommandModeAdapter.id, null, null, null, mode), providerId).toJson());
      await answered;
    }
    const approved = RuntimePartTests.toolsOf(adapter).approvedTools;
    await part.deactivateAsync();

    const [refused, askedFor, unrestricted] = adapter.answers;
    Assert.areEqual("Denied (teamrun.readOnlyMode): teamrun_run_in_background can change things, and this chat runs in Look, which changes nothing, "
      + "so TeamRun refused it. Choose another mode to use it.", RuntimePartTests.textOf(refused));
    for (const started of [askedFor, unrestricted]) {
      Assert.isFalse((started as JsonObject)["isError"] as boolean);
      Assert.isTrue(RuntimePartTests.textOf(started).includes("\"command\":\"npm run build\""), RuntimePartTests.textOf(started));
    }
    const written = process.platform === "win32" ? "\"npm run build\"" : "npm run build";
    Assert.areEqual(2, context.requests.filter(t => t.arguments.at(-1) === written).length);
    Assert.areEqual(0, asked.length);
    Assert.isFalse(approved.includes("teamrun_run_in_background"));
  }

  @TestMethod
  public async endsACommandsWholeProcessTreeOnItsTaskStopOnItsChatsDeleteAndAtShutdown(): Promise<void> {
    using directory = new TemporaryDirectory();
    using shellFolder = new TemporaryDirectory();
    using lock = OwnershipLock.acquire(new DataDirectory(shellFolder.path));
    using shell = await ShellDatabase.openAsync(lock, ShellMigrations.all, new Date(), new RecordingOutput());
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const supervisor = ProcessSupervisor.create(shell, process.platform, process.env, new RecordingOutput(), RuntimePartTests.quickStop);
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    using _center = await OpenPermissionCenter.openAsync(context.tools.center);
    context.startProcess = request => supervisor.startAsync("teamrun", request);
    writeFileSync(join(directory.path, "tree.mjs"), RuntimePartTests.treeScript);
    const registry = new ProviderKindRegistry();
    const adapter = new CommandModeAdapter();
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    try {
      await part.activateAsync(context);
      const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
      const providerId = await RuntimePartTests.providerIdAsync(context, CommandModeAdapter.id, directory.path);
      const trees: { chatId: string; taskId: string; pids: number[] }[] = [];
      for (const name of ["stopped", "deleted", "shut"]) {
        const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: name }) as { id: string };
        adapter.command = `"${process.execPath}" tree.mjs ${name}.pids`;
        const ended = context.whenWorkEnds();
        await RuntimePartTests.callAsync(context, "teamrun.messageSend",
          new MessageSendParams(chat.id, "Build it", new RequestedSettings(CommandModeAdapter.id, null, null), providerId).toJson());
        await ended;
        const task = JSON.parse(RuntimePartTests.textOf(adapter.answers.at(-1))) as { id: string };
        trees.push({ chatId: chat.id, taskId: task.id, pids: await RuntimePartTests.pidsAsync(join(directory.path, `${name}.pids`)) });
      }
      const [stopped, deleted, shut] = trees as [typeof trees[0], typeof trees[0], typeof trees[0]];

      await RuntimePartTests.callAsync(context, "teamrun.backgroundTaskStop", { taskId: stopped.taskId });
      const afterStop = await RuntimePartTests.survivorsAsync(stopped.pids);
      const othersAfterStop = [...deleted.pids, ...shut.pids].filter(t => RuntimePartTests.isRunning(t)).length;
      const deleteChat = context.methods.get("teamrun.conversationDelete");
      Assert.isDefined(deleteChat);
      await deleteChat.handleAsync(new RequestContext("cli", { chatId: deleted.chatId }, new AbortController().signal, 2));
      const afterDelete = await RuntimePartTests.survivorsAsync(deleted.pids);
      const othersAfterDelete = shut.pids.filter(t => RuntimePartTests.isRunning(t)).length;
      await part.deactivateAsync();
      const afterShutdown = await RuntimePartTests.survivorsAsync(shut.pids);

      Assert.areEqual(JSON.stringify([3, 3, 3]), JSON.stringify(trees.map(t => t.pids.length)));
      Assert.areEqual(JSON.stringify([[], 6, [], 3, []]), JSON.stringify([afterStop, othersAfterStop, afterDelete, othersAfterDelete, afterShutdown]));
    }
    finally {
      await supervisor.stopAllAsync();
    }
  }

  @TestMethod
  public async listsAChatsBackgroundTasksAfterARestartWithOneThatEndedByItselfAndOneTheQuitStopped(): Promise<void> {
    using directory = new TemporaryDirectory();
    using shellFolder = new TemporaryDirectory();
    using lock = OwnershipLock.acquire(new DataDirectory(shellFolder.path));
    using shell = await ShellDatabase.openAsync(lock, ShellMigrations.all, new Date(), new RecordingOutput());
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const supervisor = ProcessSupervisor.create(shell, process.platform, process.env, new RecordingOutput(), RuntimePartTests.quickStop);
    const before = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    using _center = await OpenPermissionCenter.openAsync(before.tools.center);
    before.startProcess = request => supervisor.startAsync("teamrun", request);
    writeFileSync(join(directory.path, "tree.mjs"), RuntimePartTests.treeScript);
    writeFileSync(join(directory.path, "fails.mjs"), "process.exit(3);");
    const failed = Promise.withResolvers<void>();
    before.onPublished = (name, payload) => {
      if (name === "teamrun.backgroundTaskUpdated" && BackgroundTask.fromJson(payload).status === BackgroundTaskStatus.Failed)
        failed.resolve();
    };
    const registry = new ProviderKindRegistry();
    const adapter = new CommandModeAdapter();
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    try {
      await part.activateAsync(before);
      const project = await RuntimePartTests.callAsync(before, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
      const providerId = await RuntimePartTests.providerIdAsync(before, CommandModeAdapter.id, directory.path);
      const chat = await RuntimePartTests.callAsync(before, "teamrun.conversationCreate", { projectId: project.id, title: "restart" }) as { id: string };
      const run = async (command: string): Promise<void> => {
        adapter.command = command;
        const ended = before.whenWorkEnds();
        await RuntimePartTests.callAsync(before, "teamrun.messageSend",
          new MessageSendParams(chat.id, "Build it", new RequestedSettings(CommandModeAdapter.id, null, null), providerId).toJson());
        await ended;
      };
      await run(`"${process.execPath}" fails.mjs`);
      await failed.promise;
      await adapter.woken.promise;
      while (before.openWork.size > 0)
        await before.whenWorkEnds();
      await run(`"${process.execPath}" tree.mjs shut.pids`);
      const pids = await RuntimePartTests.pidsAsync(join(directory.path, "shut.pids"));
      await part.deactivateAsync();
      const survivors = await RuntimePartTests.survivorsAsync(pids);

      const after = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
      await part.activateAsync(after);
      const listed = BackgroundTaskPage.fromJson(await RuntimePartTests.callAsync(after, "teamrun.backgroundTaskList",
        new BackgroundTaskListParams(chat.id, null, 10).toJson()));
      await part.deactivateAsync();

      const tasks = listed.tasks;
      Assert.areEqual(JSON.stringify([3, []]), JSON.stringify([pids.length, survivors]));
      Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Stopped, BackgroundTaskStatus.Failed]), JSON.stringify(tasks.map(t => t.status)));
      Assert.areEqual(3, tasks[1]?.exitCode);
      Assert.isTrue(tasks[0]?.command.includes("tree.mjs") ?? false);
      Assert.isTrue(tasks[1]?.command.includes("fails.mjs") ?? false);
      Assert.isTrue(tasks.every(t => !Object.isNull(t.endedAt)));
    }
    finally {
      await supervisor.stopAllAsync();
    }
  }

  @TestMethod
  @TestData("claude")
  @TestData("codex")
  @TestData("copilot")
  @TestData("grok")
  @TestData("cursor")
  @TestData("opencode")
  @TestData("antigravity")
  public async runsABackgroundCommandTheProviderCallsAtTheEndpointInEachOfItsModesWakingTheChatWithItsExitCodeOrRefusesItInAReadOnlyOne(kind: string): Promise<void> {
    using directory = new TemporaryDirectory();
    using shellFolder = new TemporaryDirectory();
    using lock = OwnershipLock.acquire(new DataDirectory(shellFolder.path));
    using shell = await ShellDatabase.openAsync(lock, ShellMigrations.all, new Date(), new RecordingOutput());
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const supervisor = ProcessSupervisor.create(shell, process.platform, process.env, new RecordingOutput());
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    using _center = await OpenPermissionCenter.openAsync(context.tools.center);
    context.settings = new DeclaredSettings();
    context.startProcess = request => supervisor.startAsync("teamrun", request);
    writeFileSync(join(directory.path, "fails.mjs"), "console.log('\"one two\"');\nprocess.exit(3);");
    const adapter = new ProviderDouble(RuntimePartTests.realAdapterOf(kind, directory));
    adapter.command = `"${process.execPath}" fails.mjs`;
    const registry = new ProviderKindRegistry();
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    const asked: string[] = [];
    context.onPublished = name => {
      if (name === "teamrun.approvalCreated")
        asked.push(name);
    };
    await part.activateAsync(context);
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const providerId = await RuntimePartTests.providerIdAsync(context, kind, directory.path);

    const seen: string[] = [];
    const expected: string[] = [];
    for (const mode of adapter.modes) {
      const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: mode.id }) as { id: string };
      const answers = adapter.answers.length;
      const wakes = adapter.wakes().length;
      await RuntimePartTests.callAsync(context, "teamrun.messageSend",
        new MessageSendParams(chat.id, "Build it", new RequestedSettings(kind, null, null, null, mode.id), providerId).toJson());
      await adapter.recordedAsync(() => adapter.answers.length > answers && (mode.readOnly || adapter.wakes().length > wakes));
      const answer = RuntimePartTests.textOf(adapter.answers.at(-1));
      if (mode.readOnly) {
        seen.push(answer);
        expected.push(`Denied (teamrun.readOnlyMode): teamrun_run_in_background can change things, and this chat runs in ${mode.name}, which changes nothing, `
          + "so TeamRun refused it. Choose another mode to use it.");
        continue;
      }
      const started = JSON.parse(answer) as { id: string };
      const [task] = BackgroundTaskPage.fromJson(await RuntimePartTests.callAsync(context, "teamrun.backgroundTaskList",
        new BackgroundTaskListParams(chat.id, null, 10).toJson())).tasks;
      const text = `From TeamRun: Your background command "Build the app" (${started.id}) exited with code 3. Its last lines:\n"one two"`;
      const wake = adapter.wakes().at(-1) ?? "";
      seen.push(JSON.stringify([mode.id, task?.id, task?.status, task?.exitCode, wake.includes(text) ? text : wake]));
      expected.push(JSON.stringify([mode.id, started.id, BackgroundTaskStatus.Failed, 3, text]));
    }
    await part.deactivateAsync();
    await supervisor.stopAllAsync();

    Assert.areEqual(JSON.stringify(expected, null, 1), JSON.stringify(seen, null, 1),
      `${JSON.stringify(database.readAll("SELECT state, json FROM chatWakes"))}\n${context.lines.join("\n")}`);
    Assert.isTrue(adapter.modes.some(t => !t.readOnly), adapter.modes.map(t => t.id).join());
    Assert.areEqual(0, asked.length);
  }

  @TestMethod
  @TestData("claude")
  @TestData("codex")
  @TestData("copilot")
  @TestData("grok")
  @TestData("cursor")
  @TestData("opencode")
  @TestData("antigravity")
  public async endsTheTreeOfABackgroundCommandTheProviderStartedOnItsTaskStopItsRepliesStopAndAtShutdownWakingNoOneAndNotesTheRestart(kind: string): Promise<void> {
    using directory = new TemporaryDirectory();
    using shellFolder = new TemporaryDirectory();
    using lock = OwnershipLock.acquire(new DataDirectory(shellFolder.path));
    using shell = await ShellDatabase.openAsync(lock, ShellMigrations.all, new Date(), new RecordingOutput());
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const supervisor = ProcessSupervisor.create(shell, process.platform, process.env, new RecordingOutput(), RuntimePartTests.quickStop);
    const before = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    using _center = await OpenPermissionCenter.openAsync(before.tools.center);
    before.settings = new DeclaredSettings();
    before.startProcess = request => supervisor.startAsync("teamrun", request);
    writeFileSync(join(directory.path, "tree.mjs"), RuntimePartTests.treeScript);
    const adapter = new ProviderDouble(RuntimePartTests.realAdapterOf(kind, directory));
    const registry = new ProviderKindRegistry();
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    try {
      await part.activateAsync(before);
      const project = await RuntimePartTests.callAsync(before, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
      const providerId = await RuntimePartTests.providerIdAsync(before, kind, directory.path);
      const mode = adapter.modes.find(t => !t.readOnly)?.id ?? null;
      const run = async (name: string, holds: boolean): Promise<{ chatId: string; replyId: string; taskId: string; pids: number[] }> => {
        const chat = await RuntimePartTests.callAsync(before, "teamrun.conversationCreate", { projectId: project.id, title: name }) as { id: string };
        adapter.command = `"${process.execPath}" tree.mjs ${name}.pids`;
        adapter.holds = holds;
        const answers = adapter.answers.length;
        const sent = MessageSendResult.fromJson(await RuntimePartTests.callAsync(before, "teamrun.messageSend",
          new MessageSendParams(chat.id, "Build it", new RequestedSettings(kind, null, null, null, mode), providerId).toJson()));
        await adapter.recordedAsync(() => adapter.answers.length > answers);
        const task = JSON.parse(RuntimePartTests.textOf(adapter.answers.at(-1))) as { id: string };
        return { chatId: chat.id, replyId: sent.replies[0]!.id, taskId: task.id, pids: await RuntimePartTests.pidsAsync(join(directory.path, `${name}.pids`)) };
      };
      const stopped = await run("stopped", false);
      const cancelled = await run("cancelled", true);
      const shut = await run("shut", false);

      await RuntimePartTests.callAsync(before, "teamrun.backgroundTaskStop", { taskId: stopped.taskId });
      const afterStop = await RuntimePartTests.survivorsAsync(stopped.pids);
      await RuntimePartTests.callAsync(before, "teamrun.messageCancel", new MessageIdParams(cancelled.replyId).toJson());
      const afterCancel = await RuntimePartTests.survivorsAsync(cancelled.pids);
      const shutRunning = shut.pids.filter(t => RuntimePartTests.isRunning(t)).length;
      await part.deactivateAsync();
      const afterShutdown = await RuntimePartTests.survivorsAsync(shut.pids);

      const after = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
      after.settings = new DeclaredSettings();
      await part.activateAsync(after);
      const note = `TeamRun restarted before your background command ${shut.taskId} ended, so it was stopped and this chat wasn't woken by it.`;
      const messages = JSON.stringify(await RuntimePartTests.callAsync(after, "teamrun.messageList", new MessageListParams(shut.chatId, null).toJson()));
      const statuses: string[][] = [];
      for (const chat of [stopped, cancelled, shut])
        statuses.push(BackgroundTaskPage.fromJson(await RuntimePartTests.callAsync(after, "teamrun.backgroundTaskList",
          new BackgroundTaskListParams(chat.chatId, null, 10).toJson())).tasks.map(t => t.status));
      await part.deactivateAsync();

      Assert.areEqual(JSON.stringify([3, 3, 3]), JSON.stringify([stopped, cancelled, shut].map(t => t.pids.length)));
      Assert.areEqual(JSON.stringify([[], [], 3, []]), JSON.stringify([afterStop, afterCancel, shutRunning, afterShutdown]));
      Assert.areEqual(JSON.stringify([[BackgroundTaskStatus.Stopped], [BackgroundTaskStatus.Stopped], [BackgroundTaskStatus.Stopped]]), JSON.stringify(statuses));
      Assert.isTrue(messages.includes(note), `${JSON.stringify(database.readAll("SELECT state, json FROM chatWakes"))}\n`
        + `${[...before.lines, ...after.lines].join("\n")}\n${messages.slice(-1500)}`);
      Assert.areEqual(0, adapter.wakes().length, adapter.wakes().join("\n"));
    }
    finally {
      await supervisor.stopAllAsync();
    }
  }

  @TestMethod
  public async savesARunningTaskWithItsOutputWhenTheEndpointFailsToClose(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const before = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const registry = new ProviderKindRegistry();
    const adapter = new CommandModeAdapter();
    adapter.reportsTask = true;
    registry.register(adapter);
    let made = 0;
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3", undefined, t => made++ === 0 ? new RefusingToCloseEndpoint(t) : new McpHttpEndpoint(t));
    await part.activateAsync(before);
    const project = await RuntimePartTests.callAsync(before, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const providerId = await RuntimePartTests.providerIdAsync(before, CommandModeAdapter.id, directory.path);
    const chat = await RuntimePartTests.callAsync(before, "teamrun.conversationCreate", { projectId: project.id, title: "restart" }) as { id: string };
    const ended = before.whenWorkEnds();
    await RuntimePartTests.callAsync(before, "teamrun.messageSend",
      new MessageSendParams(chat.id, "Report it", new RequestedSettings(CommandModeAdapter.id, null, null), providerId).toJson());
    await ended;

    await Assert.throwsAsync(() => part.deactivateAsync(), Error);
    const after = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    await part.activateAsync(after);
    const [task] = BackgroundTaskPage.fromJson(await RuntimePartTests.callAsync(after, "teamrun.backgroundTaskList",
      new BackgroundTaskListParams(chat.id, null, 10).toJson())).tasks;
    const read = BackgroundTask.fromJson(await RuntimePartTests.callAsync(after, "teamrun.backgroundTaskRead", new BackgroundTaskIdParams(task!.id).toJson()));
    await part.deactivateAsync();

    Assert.areEqual(BackgroundTaskStatus.Stopped, read.status);
    Assert.areEqual("serving\n", read.output);
  }

  @TestMethod
  public async asksBeforeChangingATeammateWhoseProviderWasDeletedAndKeepsItWithoutOne(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const registry = new ProviderKindRegistry();
    const adapter = new ChangingAdapter(context);
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    const created: JsonObject[] = [];
    context.onPublished = (name, payload) => {
      if (name !== "teamrun.approvalCreated")
        return;
      created.push(payload as JsonObject);
      void context.methods.get("teamrun.approvalDecide")!.handleAsync(new RequestContext(ShellClients.mainProcess,
        { approvalId: (payload as JsonObject)["id"] as string, optionId: "allowOnce" }, new AbortController().signal, 3));
    };
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Work" }) as { id: string };
    const provider = await RuntimePartTests.callAsync(context, "teamrun.providerCreate",
      { kind: ChangingAdapter.id, label: "Gone", profileDir: join(directory.path, "profile") }) as { id: string };
    const teammate = await RuntimePartTests.callAsync(context, "teamrun.teammateCreate",
      new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, null, null).toJson()) as { id: string };
    await RuntimePartTests.callAsync(context, "teamrun.providerDelete", { providerId: provider.id });
    adapter.calls = [["teamrun_update_teammate", { teammate_id: teammate.id, name: "Bea" }]];

    const providerId = await RuntimePartTests.providerIdAsync(context, ChangingAdapter.id, directory.path);
    const ended = context.whenWorkEnds();
    await RuntimePartTests.callAsync(context, "teamrun.messageSend",
      new MessageSendParams(chat.id, "Rename Ada", new RequestedSettings(ChangingAdapter.id, null, null), providerId).toJson());
    await ended;
    const teammates = await RuntimePartTests.callAsync(context, "teamrun.teammateList", null) as { id: string; name: string; providerId: string }[];
    await part.deactivateAsync();

    Assert.areEqual(1, created.length);
    Assert.areEqual(JSON.stringify([{ label: "Teammate", kind: "Text", value: "Ada" }, { label: "Name", kind: "AgentText", value: "Bea" },
      { label: "Provider", kind: "Text", value: "No provider" }]), JSON.stringify((created[0]!["payload"] as { details: JsonValue })["details"]));
    Assert.isTrue(adapter.results[0] instanceof ToolResult);
    Assert.areEqual(JSON.stringify(["Bea", provider.id]), JSON.stringify(teammates.filter(t => t.id === teammate.id).map(t => [t.name, t.providerId])[0]));
  }

  @TestMethod
  public async keepsAWindowsChangesWhenATeammatesToolUpdateLaterRenamesTheTeammate(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const registry = new ProviderKindRegistry();
    const adapter = new ChangingAdapter(context);
    registry.register(adapter);
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    context.onPublished = (name, payload) => {
      if (name === "teamrun.approvalCreated")
        void context.methods.get("teamrun.approvalDecide")!.handleAsync(new RequestContext(ShellClients.mainProcess,
          { approvalId: (payload as JsonObject)["id"] as string, optionId: "allowOnce" }, new AbortController().signal, 3));
    };
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: "Work" }) as { id: string };
    const providerId = await RuntimePartTests.providerIdAsync(context, ChangingAdapter.id, directory.path);
    const teammate = await RuntimePartTests.callAsync(context, "teamrun.teammateCreate",
      new TeammateCreateParams("Ada", null, providerId, Harness.Provider, null, null).toJson()) as { id: string };
    await RuntimePartTests.callAsync(context, "teamrun.teammateUpdate",
      TeammateUpdateParams.of(teammate.id, { model: "model", effort: "high", speed: "fast", mode: "plan" }, providerId).toJson());
    adapter.calls = [["teamrun_update_teammate", { teammate_id: teammate.id, name: "Bea" }]];

    const ended = context.whenWorkEnds();
    await RuntimePartTests.callAsync(context, "teamrun.messageSend",
      new MessageSendParams(chat.id, "Rename Ada", new RequestedSettings(ChangingAdapter.id, null, null), providerId).toJson());
    await ended;
    const teammates = await RuntimePartTests.callAsync(context, "teamrun.teammateList", null) as JsonObject[];
    await part.deactivateAsync();

    Assert.isTrue(adapter.results[0] instanceof ToolResult);
    Assert.areEqual(JSON.stringify(["Bea", providerId, "model", "high", "fast", "plan"]), JSON.stringify(teammates.filter(t => t["id"] === teammate.id)
      .map(t => [t["name"], t["providerId"], t["model"], t["effort"], t["speed"], t["mode"]])[0]));
  }

  @TestMethod
  public async postsAReplyThatFailedWhileNoWindowShowsItsChatAndDismissesItWhenAWindowShowsTheChat(): Promise<void> {
    using directory = new TemporaryDirectory();
    using database = new MemoryModuleDatabase(HostedMigrations.all);
    await using checkpoints = await CheckpointsModule.startAsync();
    const context = new RecordingPartContext(directory.path, database, directory.path, checkpoints.services);
    const registry = new ProviderKindRegistry();
    registry.register(new FailingAdapter());
    const part = new RuntimePart(new RecordingRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    const project = await RuntimePartTests.callAsync(context, "teamrun.projectOpen", { rootPath: directory.path }) as { id: string };
    const chat = await RuntimePartTests.callAsync(context, "teamrun.conversationCreate", { projectId: project.id, title: null }) as { id: string };
    const provider = await RuntimePartTests.callAsync(context, "teamrun.providerCreate",
      { kind: FailingAdapter.id, label: "Work", profileDir: join(directory.path, "profile") }) as { id: string };
    const teammate = await RuntimePartTests.callAsync(context, "teamrun.teammateCreate",
      new TeammateCreateParams("Alice", "Alice", provider.id, Harness.Provider, null, null).toJson()) as { id: string };

    const replyEnded = context.whenWorkEnds();
    await RuntimePartTests.callAsync(context, "teamrun.messageSend", new MessageSendParams(chat.id, "@Alice start", null, null, [], [teammate.id]).toJson());
    await replyEnded;
    const posted = context.shownNotices().map(t => [t.kind.text, t.key, t.title]);
    await context.methods.get("teamrun.windowFocused")!.handleAsync(new RequestContext(ShellClients.mainProcess,
      { windowId: "w1", shownChatId: chat.id, focused: true }, new AbortController().signal, 2));
    const shown = context.shownNotices().length;
    await part.deactivateAsync();

    Assert.areEqual(JSON.stringify([["teamrun.replyFailed", chat.id, "Alice's reply failed"]]), JSON.stringify(posted));
    Assert.areEqual(0, shown);
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async restoresARewoundRepliesFilesThroughTheModuleLeavingTheProjectsGitAlone(withGit: boolean): Promise<void> {
    await using chat = await TeamRunChat.startAsync({ "base.txt": "one\n" }, withGit);
    const git = withGit ? RuntimePartTests.gitState(chat.folder) : null;

    const first = await chat.sendAsync("First", { "base.txt": "first\n", "nested/new.txt": "x\n" });
    const second = await chat.sendAsync("Second", { "base.txt": "second\n" });
    const rewound = await chat.rewindAsync(second.inReplyTo, true);
    const listed = await chat.checkpoints.service.listAsync(new ListRequest(new FolderReference(chat.projectId, chat.folder)));
    const evidence = first.details.find(t => t.kind === DetailKind.FileChange);
    const payload = evidence?.payload as { changes: { path: string; kind: string; diff: string | null }[]; source: string };

    Assert.areEqual(MessageStatus.Completed, first.status);
    Assert.areEqual("Shared working-tree changes (may include other chats or tools): base.txt, nested/new.txt", evidence?.text.replaceAll("\\", "/"));
    Assert.areEqual("workingTree", payload.source);
    Assert.areEqual("update,add", payload.changes.map(t => t.kind).join(","));
    Assert.isTrue(payload.changes[0]?.diff?.includes("-one\n+first") ?? false, payload.changes[0]?.diff ?? "no diff");
    Assert.areEqual(1, rewound.restoredFiles);
    Assert.isNull(rewound.restoreRefusal);
    Assert.areEqual("first\n", readFileSync(join(chat.folder, "base.txt"), "utf8"));
    Assert.areEqual("x\n", readFileSync(join(chat.folder, "nested", "new.txt"), "utf8"));
    Assert.areEqual(`${Resources.formatCheckpointLabel(first.id)},${Resources.formatCheckpointLabel(second.id)},Before restore`,
      [...listed.checkpoints].sort((a, b) => a.time.getTime() - b.time.getTime()).map(t => t.label).join(","));
    Assert.areEqual(git, withGit ? RuntimePartTests.gitState(chat.folder) : null);
    Assert.areEqual(withGit, existsSync(join(chat.folder, ".git")));
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async leavesOutOfARepliesChangesThePathsGitIgnoresButNotItsTrackedFilesAndListsThemAllWithoutGit(withGit: boolean): Promise<void> {
    await using chat = await TeamRunChat.startAsync({ "base.txt": "one\n", ".gitignore": "/_build/\n*.log\n", "kept.log": "old\n" }, withGit);
    if (withGit)
      execFileSync("git", ["add", "-f", "kept.log"], { cwd: chat.folder, windowsHide: true });

    const reply = await chat.sendAsync("Build", { "base.txt": "built\n", "kept.log": "new\n", "_build/out.json": "{}\n", "_build/deep/map.js": "x\n",
      "debug.log": "y\n" });
    const evidence = reply.details.find(t => t.kind === DetailKind.FileChange);
    const payload = evidence?.payload as { changes: { path: string; kind: string; diff: string | null }[] };
    const listed = payload.changes.map(t => relative(chat.folder, t.path).split(sep).join("/")).sort();

    Assert.areEqual(withGit ? "base.txt,kept.log" : "_build/deep/map.js,_build/out.json,base.txt,debug.log,kept.log", listed.join(","));
    Assert.isTrue(payload.changes.every(t => !Object.isNull(t.diff)));
    Assert.isFalse(reply.details.some(t => t.text === Resources.incompleteWorkingTreeEvidence));
  }

  @TestMethod
  public async restoresOnlyThePathsTheRemovedRepliesChangedLeavingAChangeMadeOutsideThemAsItIs(): Promise<void> {
    await using chat = await TeamRunChat.startAsync({ "base.txt": "one\n", "other.txt": "o\n" }, false);
    const reply = await chat.sendAsync("First", { "base.txt": "first\n", "nested/new.txt": "x\n" });
    writeFileSync(join(chat.folder, "other.txt"), "outside\n");
    mkdirSync(join(chat.folder, "late"));
    writeFileSync(join(chat.folder, "late", "file.txt"), "late\n");

    const rewound = await chat.rewindAsync(reply.inReplyTo, true);

    Assert.areEqual(2, rewound.restoredFiles);
    Assert.isNull(rewound.restoreRefusal);
    Assert.areEqual("one\n", readFileSync(join(chat.folder, "base.txt"), "utf8"));
    Assert.isFalse(existsSync(join(chat.folder, "nested")));
    Assert.areEqual("outside\n", readFileSync(join(chat.folder, "other.txt"), "utf8"));
    Assert.areEqual("late\n", readFileSync(join(chat.folder, "late", "file.txt"), "utf8"));
  }

  @TestMethod
  public async restoresNoFilesAndSaysWhyWhenTheProjectsFolderIsGone(): Promise<void> {
    await using chat = await TeamRunChat.startAsync({ "base.txt": "one\n" }, false);
    const reply = await chat.sendAsync("First", { "base.txt": "first\n" });
    rmSync(chat.folder, { recursive: true });

    const rewound = await chat.rewindAsync(reply.inReplyTo, true);

    Assert.isNull(rewound.restoredFiles);
    Assert.areEqual(Resources.formatRestoreRefusal("FolderMissing"), rewound.restoreRefusal);
    Assert.areEqual(2, rewound.removedMessageIds.length);
    Assert.isFalse(existsSync(chat.folder));
  }

  @TestMethod
  public async restoresNoFilesForAReplyTheModuleTookNoCheckpointBefore(): Promise<void> {
    await using chat = await TeamRunChat.startAsync(null, false);
    const reply = await chat.sendAsync("First", {});
    mkdirSync(chat.folder);
    writeFileSync(join(chat.folder, "later.txt"), "later\n");

    const rewound = await chat.rewindAsync(reply.inReplyTo, true);

    Assert.areEqual(MessageStatus.Failed, reply.status);
    Assert.isUndefined(reply.details.find(t => t.kind === DetailKind.FileChange));
    Assert.isNull(rewound.restoredFiles);
    Assert.areEqual(Resources.noCheckpointRefusal, rewound.restoreRefusal);
    Assert.areEqual("later\n", readFileSync(join(chat.folder, "later.txt"), "utf8"));
  }

  @TestMethod
  public async servesEveryToolComputerUseRegistersWhileItsSettingIsOnAndRegistersNoneTeamRunDoesNotList(): Promise<void> {
    const part = new ComputerUseRuntimePart(() => ComputerUseHarness.backend());

    const { registered, served } = await ComputerUseHarness.runAsync(part, new AnsweringAsker([]), async context => {
      await part.activateAsync(context);
      const session = context.tools.openSession(ComputerUseHarness.SCOPE, {});
      return { registered: session.listTools().map(t => t.name), served: (await new RuntimeToolSession(session).listToolsAsync()).map(t => t["name"]) };
    });

    Assert.areEqual(JSON.stringify([...RuntimeResources.computerUseTools].sort()), JSON.stringify([...registered].sort()));
    Assert.areEqual(JSON.stringify(registered), JSON.stringify(served));
  }

  @TestMethod
  public async findsTheAppsServiceComputerUsePublishesOnceItIsActive(): Promise<void> {
    const part = new ComputerUseRuntimePart(() => ComputerUseHarness.backend());

    const service = await ComputerUseHarness.runAsync(part, new AnsweringAsker([]), async context => {
      await part.activateAsync(context);
      return context.getService(ComputerUseHarness.APPS_SERVICE, AppsService);
    });

    Assert.isTrue(service instanceof AppsService);
  }

  @TestMethod
  public async refusesAListedToolAndListsNoneOnceDesktopCoreSwitchesTheModuleOff(): Promise<void> {
    const part = new ComputerUseRuntimePart(() => ComputerUseHarness.backend());
    const asker = new AnsweringAsker([]);

    const { listed, called } = await ComputerUseHarness.runAsync(part, asker, async context => {
      await part.activateAsync(context);
      await part.deactivateAsync();
      return await RuntimePartTests.callListedToolAsync(context);
    });

    Assert.areEqual("[]", JSON.stringify(listed));
    Assert.areEqual(RuntimePartTests.unregistered(), JSON.stringify(called));
    Assert.areEqual(0, asker.asks.length);
  }

  @TestMethod
  public async refusesAListedToolAndListsNoneOnLinuxWhereNoldovaDesktopDoesNotActivateComputerUse(): Promise<void> {
    const manifest = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.resolve("@noldova/computer-use/package.json"))), "module.json"), "utf8")) as
      Readonly<Record<string, unknown>>;
    const declaration = ModuleDeclaration.fromJson({ id: manifest["id"], version: manifest["version"], displayName: manifest["displayName"],
      description: manifest["description"], dependencies: {}, runtimePackage: null, contributes: {}, platforms: manifest["platforms"] });
    const part = new ComputerUseRuntimePart(() => ComputerUseHarness.backend());
    const asker = new AnsweringAsker([]);

    const { listed, called } = await ComputerUseHarness.runAsync(part, asker, async context => await RuntimePartTests.callListedToolAsync(context));

    Assert.areEqual(JSON.stringify([false, true, true]), JSON.stringify(["linux", "win32", "darwin"].map(t => declaration.runsOn(t))));
    Assert.areEqual("[]", JSON.stringify(listed));
    Assert.areEqual(RuntimePartTests.unregistered(), JSON.stringify(called));
    Assert.areEqual(0, asker.asks.length);
  }

  private static async providerIdAsync(context: RecordingPartContext, kind: string, folder: string): Promise<string> {
    const provider = await RuntimePartTests.callAsync(context, "teamrun.providerCreate", new ProviderCreateParams(kind, "Work", join(folder, "profiles", kind)).toJson());
    return (provider as { id: string }).id;
  }

  private static realAdapterOf(kind: string, directory: TemporaryDirectory): IProviderAdapter {
    const locator = new ExecutableLocator(process.platform, process.arch, [], directory.path, undefined, directory.resolve("Windows"), directory.resolve("usr", "bin", "tar"));
    return new ProviderKindRegistryFactory({}, locator).create("1.0.0", directory.path, {} as IProcessStarter).get(kind);
  }

  private static toolsOf(adapter: { readonly request: TurnRequest | null }): TurnTools {
    const tools = adapter.request?.tools;
    Assert.isDefined(tools);
    Assert.isNotNull(tools);
    return tools;
  }

  private static grantsOf(value: unknown): readonly ComputerUseGrant[] {
    return JsonReader.fromValue({ grants: value }).readObjectArray("grants").map(t => ComputerUseGrant.fromJson(t.toJson()));
  }

  private static freePortAsync(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        server.close(() => resolve(port));
      });
    });
  }

  private static statusOfAsync(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const sent = request(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: "Bearer wrong" } },
        response => {
          response.resume();
          resolve(response.statusCode ?? 0);
        });
      sent.once("error", reject);
      sent.end(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }));
    });
  }

  private static async pidsAsync(file: string): Promise<number[]> {
    for (let attempt = 0; attempt < 300; attempt++) {
      const pids = existsSync(file) ? readFileSync(file, "utf8").split(" ").map(Number).filter(t => t > 0) : [];
      if (pids.length === 3)
        return pids;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return [];
  }

  private static async survivorsAsync(pids: readonly number[]): Promise<number[]> {
    for (let attempt = 0; attempt < 300 && pids.some(t => RuntimePartTests.isRunning(t)); attempt++)
      await new Promise(resolve => setTimeout(resolve, 50));
    return pids.filter(t => RuntimePartTests.isRunning(t));
  }

  private static isRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    }
    catch (error) {
      return (error as NodeJS.ErrnoException).code === "EPERM";
    }
  }

  private static callAsync(context: RecordingPartContext, method: string, payload: unknown): Promise<unknown> {
    const handler = context.methods.get(method);
    if (handler === undefined)
      throw new Error(`The part did not register ${method}.`);

    return handler.handleAsync(new RequestContext("tests", payload as null, new AbortController().signal, 1));
  }

  private static gitState(folder: string): string {
    const git = (...args: string[]): string => execFileSync("git", args, { cwd: folder, encoding: "utf8", windowsHide: true });
    return [readFileSync(join(folder, ".git", "index")).toString("base64"), git("for-each-ref")].join("\n");
  }

  private static async callListedToolAsync(context: RecordingPartContext): Promise<{ listed: readonly JsonObject[]; called: JsonObject }> {
    const session = new RuntimeToolSession(context.tools.openSession(ComputerUseHarness.SCOPE, {}));
    return {
      listed: await session.listToolsAsync(),
      called: await session.callToolAsync(ComputerUseHarness.LISTED_TOOL, {}, new AbortController().signal)
    };
  }

  private static unregistered(): string {
    return JSON.stringify({ content: [{ type: "text", text: `Unavailable: The tool ${ComputerUseHarness.LISTED_TOOL} is not registered.` }], isError: true });
  }
}

class RecordingRegistries implements IProviderKindRegistryFactory {
  public readonly registry: ProviderKindRegistry;
  public productVersion: string | null = null;
  public dataDirectory: string | null = null;
  public log: ILog | null | undefined = undefined;

  public constructor(registry: ProviderKindRegistry) {
    this.registry = registry;
  }

  public create(productVersion: string, dataDirectory: string, _starter: IProcessStarter, log?: ILog | null): ProviderKindRegistry {
    this.productVersion = productVersion;
    this.dataDirectory = dataDirectory;
    this.log = log;
    return this.registry;
  }
}

class CatalogRegistries extends RecordingRegistries {
  private readonly catalog: IAcpAgentCatalog;

  public constructor(registry: ProviderKindRegistry, catalog: IAcpAgentCatalog) {
    super(registry);
    this.catalog = catalog;
  }

  public createAcpCatalog(): IAcpAgentCatalog {
    return this.catalog;
  }
}

class ToolCallingAdapter implements IProviderAdapter {
  public static readonly id: string = "tool-calling";

  public readonly descriptor: ProviderKind = new ProviderKind(ToolCallingAdapter.id, "Tool-calling provider", true, false);
  public readonly modes: readonly ProviderMode[] = [];
  public readonly defaultMode: string | null = null;
  public readonly answers: unknown[] = [];
  public chatId: string = "";
  public request: TurnRequest | null = null;

  public checkSignIn(_provider: Provider): Promise<SignInCheck> {
    return Promise.resolve(new SignInCheck(AuthStatus.LoggedIn, null, "1.0.0", null));
  }

  public signIn(_provider: Provider, _signal: AbortSignal, _listener: ISignInListener): Promise<void> {
    return Promise.resolve();
  }

  public listModels(_provider: Provider | null): Promise<ProviderModelList> {
    return Promise.resolve(new ProviderModelList([new ProviderModel("model", "model", "Fixture", ["high"], true, null, true)], true));
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    this.request = request;
    const host = request.tools!.host;
    const observed = new ObservedSettings(ToolCallingAdapter.id, "model", "high", "1.0.0");
    await listener.onStartedAsync(new TurnStart("session-1", false));
    await listener.onObservedAsync(observed);
    this.answers.push(await host.listToolsAsync(signal));
    this.answers.push(await host.callToolAsync("teamrun_list_projects", {}, signal));
    this.answers.push(await host.callToolAsync("teamrun_list_chats", {}, signal));
    this.answers.push(await host.callToolAsync("teamrun_list_messages", { chat_id: this.chatId }, signal));
    this.answers.push(await host.callToolAsync("teamrun_list_approvals", { chat_id: this.chatId, pending: false }, signal));
    this.answers.push(await host.callToolAsync("teamrun_list_approvals", { chat_id: this.chatId, pending: true }, signal));
    this.answers.push(await host.callToolAsync("teamrun_check_provider", { provider_id: "missing" }, signal));
    this.answers.push(await host.callToolAsync("teamrun_list_messages", {}, signal));
    this.answers.push(await host.callToolAsync("checkpoints_list", {}, signal));
    this.answers.push(await host.callToolAsync("teamrun_list_providers", {}, signal));
    this.answers.push(await host.callToolAsync("teamrun_list_teammates", {}, signal));
    await listener.onDetailAsync(new TurnDetail(DetailKind.Text, "Listed.", null, null));
    return new TurnResult(TurnOutcome.Completed, "session-1", observed, null);
  }

  public forkSession(_request: ForkRequest): Promise<ForkedSession> {
    return Promise.reject(new Error("The fixture forks no sessions."));
  }

  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

class FailingAdapter implements IProviderAdapter {
  public static readonly id: string = "failing";

  public readonly descriptor: ProviderKind = new ProviderKind(FailingAdapter.id, "Failing provider", true, false);
  public readonly modes: readonly ProviderMode[] = [];
  public readonly defaultMode: string | null = null;

  public checkSignIn(_provider: Provider): Promise<SignInCheck> {
    return Promise.resolve(new SignInCheck(AuthStatus.LoggedIn, null, "1.0.0", null));
  }

  public signIn(_provider: Provider, _signal: AbortSignal, _listener: ISignInListener): Promise<void> {
    return Promise.resolve();
  }

  public listModels(_provider: Provider | null): Promise<ProviderModelList> {
    return Promise.resolve(new ProviderModelList([new ProviderModel("model", "model", "Fixture", ["high"], true, null, true)], true));
  }

  public runTurn(_request: TurnRequest, _listener: ITurnListener, _signal: AbortSignal): Promise<TurnResult> {
    return Promise.reject(new Error("The provider stopped."));
  }

  public forkSession(_request: ForkRequest): Promise<ForkedSession> {
    return Promise.reject(new Error("The fixture forks no sessions."));
  }

  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

class MentioningAdapter implements IProviderAdapter {
  public static readonly id: string = "mentioning";

  public readonly descriptor: ProviderKind;
  public readonly takesTeamRunTools: boolean = true;
  public readonly modes: readonly ProviderMode[] = [];
  public readonly defaultMode: string | null = null;
  public turns: number = 0;
  public handOffs: number = Number.POSITIVE_INFINITY;
  public readonly instructions: (string | null)[] = [];
  public readonly environments: Readonly<Record<string, string>>[] = [];
  public readonly sharedServers: string[] = [];

  public constructor(usualFolder: string | null = null) {
    this.descriptor = new ProviderKind(MentioningAdapter.id, "Mentioning provider", true, false, null,
      Object.isNull(usualFolder) ? null : new ProviderProfile("MENTIONING_HOME", null, usualFolder));
  }

  public checkSignIn(_provider: Provider): Promise<SignInCheck> {
    return Promise.resolve(new SignInCheck(AuthStatus.LoggedIn, null, "1.0.0", null));
  }

  public signIn(_provider: Provider, _signal: AbortSignal, _listener: ISignInListener): Promise<void> {
    return Promise.resolve();
  }

  public listModels(_provider: Provider | null): Promise<ProviderModelList> {
    return Promise.resolve(new ProviderModelList([new ProviderModel("model", "model", "Fixture", ["high"], true, null, true)], true));
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, _signal: AbortSignal): Promise<TurnResult> {
    this.turns++;
    this.instructions.push(request.instructions);
    this.environments.push(request.environment);
    this.sharedServers.push(request.sharedServers.map(t => t.name).join("+"));
    const session = `session-${this.turns}`;
    const observed = new ObservedSettings(MentioningAdapter.id, "model", "high", "1.0.0");
    await listener.onStartedAsync(new TurnStart(session, false));
    await listener.onObservedAsync(observed);
    const next = request.instructions?.startsWith("Alice") === true ? "@Bob over to you" : "@Alice over to you";
    await listener.onDetailAsync(new TurnDetail(DetailKind.Text, this.turns > this.handOffs ? "Done." : next, null, null));
    return Promise.resolve(new TurnResult(TurnOutcome.Completed, session, observed, null));
  }

  public sharedServerUnavailable(_definition: SharedMcpServerDefinition): SharedMcpRefusal | null {
    return null;
  }

  public forkSession(_request: ForkRequest): Promise<ForkedSession> {
    return Promise.reject(new Error("The fixture forks no sessions."));
  }

  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

class ChangingAdapter implements IProviderAdapter {
  public static readonly id: string = "changing";

  public readonly descriptor: ProviderKind = new ProviderKind(ChangingAdapter.id, "Changing provider", true, false);
  public readonly modes: readonly ProviderMode[] = [];
  public readonly defaultMode: string | null = null;
  public readonly results: (ToolResult | ToolFailure)[] = [];
  public calls: readonly [string, JsonObject][] = [];
  public holds: boolean = false;
  private readonly context: RecordingPartContext;

  public constructor(context: RecordingPartContext) {
    this.context = context;
  }

  public checkSignIn(_provider: Provider): Promise<SignInCheck> {
    return Promise.resolve(new SignInCheck(AuthStatus.LoggedIn, null, "1.0.0", null));
  }

  public signIn(_provider: Provider, _signal: AbortSignal, _listener: ISignInListener): Promise<void> {
    return Promise.resolve();
  }

  public listModels(_provider: Provider | null): Promise<ProviderModelList> {
    return Promise.resolve(new ProviderModelList([new ProviderModel("model", "model", "Fixture", ["high"], true, null, true)], true));
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    const observed = new ObservedSettings(ChangingAdapter.id, "model", "high", "1.0.0");
    await listener.onStartedAsync(new TurnStart("session-1", false));
    await listener.onObservedAsync(observed);
    if (this.holds) {
      await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }));
      return new TurnResult(TurnOutcome.Interrupted, "session-1", observed, null);
    }
    for (const [name, input] of this.calls) {
      if (request.tools?.approvedTools.includes(name) !== true)
        await listener.onApprovalRequested(new ApprovalAsk(name, ApprovalKind.Permission, name, name, input,
          [new ApprovalOption("allowOnce", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once)]));
      this.results.push(await this.context.tools.sessions.at(-1)!.callAsync(name, input));
    }
    return new TurnResult(TurnOutcome.Completed, "session-1", observed, null);
  }

  public forkSession(_request: ForkRequest): Promise<ForkedSession> {
    return Promise.reject(new Error("The fixture forks no sessions."));
  }

  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

class CommandModeAdapter implements IProviderAdapter {
  public static readonly id: string = "command-mode";

  public readonly descriptor: ProviderKind = new ProviderKind(CommandModeAdapter.id, "Command-mode provider", true, false);
  public readonly modes: readonly ProviderMode[] = [new ProviderMode("ask", "Ask"), new ProviderMode("all", "All", null, true),
    new ProviderMode("look", "Look", null, false, true)];
  public readonly defaultMode: string | null = "ask";
  public readonly answers: unknown[] = [];
  public request: TurnRequest | null = null;
  public command: string = "npm run build";
  public reportsTask: boolean = false;
  public readonly woken: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly waiters: [number, () => void][] = [];

  public answered(count: number): Promise<void> {
    const waiting = Promise.withResolvers<void>();
    this.waiters.push([count, waiting.resolve]);
    return waiting.promise;
  }

  public checkSignIn(_provider: Provider): Promise<SignInCheck> {
    return Promise.resolve(new SignInCheck(AuthStatus.LoggedIn, null, "1.0.0", null));
  }

  public signIn(_provider: Provider, _signal: AbortSignal, _listener: ISignInListener): Promise<void> {
    return Promise.resolve();
  }

  public listModels(_provider: Provider | null): Promise<ProviderModelList> {
    return Promise.resolve(new ProviderModelList([new ProviderModel("model", "model", "Fixture", ["high"], true, null, true)], true));
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    const observed = new ObservedSettings(CommandModeAdapter.id, "model", "high", "1.0.0");
    await listener.onStartedAsync(new TurnStart("session-1", false));
    await listener.onObservedAsync(observed);
    if (this.reportsTask) {
      await listener.onTaskStartedAsync(new TaskStart("t1", "npm run dev", () => Promise.resolve()));
      listener.onTaskOutput("t1", "serving\n");
    }
    if (request.prompt.includes("Build it")) {
      this.request = request;
      Assert.isNotNull(request.tools);
      this.answers.push(await request.tools.host.callToolAsync("teamrun_run_in_background", { command: this.command, description: "Build the app" }, signal));
      for (const [count, resolve] of this.waiters)
        if (this.answers.length >= count)
          resolve();
    }
    else
      this.woken.resolve();
    return new TurnResult(TurnOutcome.Completed, "session-1", observed, null);
  }

  public forkSession(_request: ForkRequest): Promise<ForkedSession> {
    return Promise.reject(new Error("The fixture forks no sessions."));
  }

  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

class ProviderDouble implements IProviderAdapter {
  public readonly descriptor: ProviderKind;
  public readonly modes: readonly ProviderMode[];
  public readonly defaultMode: string | null;
  public readonly takesTeamRunTools: boolean;
  public readonly planMode: string | null;
  public readonly answers: unknown[] = [];
  public readonly prompts: string[] = [];
  public command: string = "npm run build";
  public holds: boolean = false;
  private readonly recorded: (() => void)[] = [];

  public constructor(real: IProviderAdapter) {
    this.descriptor = real.descriptor;
    this.modes = real.modes;
    this.defaultMode = real.defaultMode;
    this.takesTeamRunTools = real.takesTeamRunTools === true;
    this.planMode = real.planMode ?? null;
  }

  public async recordedAsync(done: () => boolean): Promise<void> {
    while (!done())
      await new Promise<void>(resolve => this.recorded.push(resolve));
  }

  public wakes(): string[] {
    return this.prompts.filter(t => t.includes("From TeamRun: "));
  }

  public checkSignIn(_provider: Provider): Promise<SignInCheck> {
    return Promise.resolve(new SignInCheck(AuthStatus.LoggedIn, null, "1.0.0", null));
  }

  public signIn(_provider: Provider, _signal: AbortSignal, _listener: ISignInListener): Promise<void> {
    return Promise.resolve();
  }

  public listModels(_provider: Provider | null): Promise<ProviderModelList> {
    return Promise.resolve(new ProviderModelList([new ProviderModel("model", "model", "Fixture", ["high"], true, null, true)], true));
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    const observed = new ObservedSettings(this.descriptor.id, "model", "high", "1.0.0");
    await listener.onStartedAsync(new TurnStart(`${this.descriptor.id}-session`, this.prompts.length > 0));
    await listener.onObservedAsync(observed);
    this.prompts.push(request.prompt);
    this.record();
    const endpoint = request.tools?.endpoint ?? null;
    if (request.prompt.includes("Build it")) {
      if (Object.isNull(endpoint)) {
        this.answers.push({ content: [{ type: "text", text: "The turn has no endpoint." }], isError: true });
        this.record();
        return new TurnResult(TurnOutcome.Completed, `${this.descriptor.id}-session`, observed, null);
      }
      const token = endpoint.issueKept();
      try {
        this.answers.push(await ProviderDouble.callAsync(endpoint.url, token, { command: this.command, description: "Build the app" }));
        this.record();
        if (this.holds && !signal.aborted)
          await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
      }
      finally {
        endpoint.revoke(token);
      }
    }
    return new TurnResult(signal.aborted ? TurnOutcome.Interrupted : TurnOutcome.Completed, `${this.descriptor.id}-session`, observed, null);
  }

  public forkSession(_request: ForkRequest): Promise<ForkedSession> {
    return Promise.reject(new Error("The fixture forks no sessions."));
  }

  public shutdown(): Promise<void> {
    return Promise.resolve();
  }

  private static callAsync(url: string, token: string, input: JsonObject): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const headers = { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` };
      const sent = request(url, { method: "POST", headers }, response => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => { text += chunk; });
        response.on("end", () => resolve(ProviderDouble.resultOf(text) ?? { content: [{ type: "text", text: `${response.statusCode} ${text}` }], isError: true }));
      });
      sent.on("error", reject);
      sent.end(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "teamrun_run_in_background", arguments: input } }));
    });
  }

  private static resultOf(text: string): unknown {
    try {
      return (JSON.parse(text) as JsonObject)["result"] ?? null;
    }
    catch {
      return null;
    }
  }

  private record(): void {
    for (const resolve of this.recorded.splice(0))
      resolve();
  }
}

class RefusingToCloseEndpoint extends McpHttpEndpoint {
  public override async closeAsync(): Promise<void> {
    await super.closeAsync();
    throw new Error("The fixture cannot close.");
  }
}

class PermissionAdapter implements IProviderAdapter {
  public static readonly id: string = "permission-asking";

  public readonly descriptor: ProviderKind = new ProviderKind(PermissionAdapter.id, "Permission-asking provider", true, false);
  public readonly modes: readonly ProviderMode[] = [];
  public readonly defaultMode: string | null = null;
  public answer: string | null = null;
  private readonly context: RecordingPartContext;

  public constructor(context: RecordingPartContext) {
    this.context = context;
  }

  public checkSignIn(_provider: Provider): Promise<SignInCheck> {
    return Promise.resolve(new SignInCheck(AuthStatus.LoggedIn, null, "1.0.0", null));
  }

  public signIn(_provider: Provider, _signal: AbortSignal, _listener: ISignInListener): Promise<void> {
    return Promise.resolve();
  }

  public listModels(_provider: Provider | null): Promise<ProviderModelList> {
    return Promise.resolve(new ProviderModelList([new ProviderModel("model", "model", "Fixture", ["high"], true, null, true)], true));
  }

  public async runTurn(_request: TurnRequest, listener: ITurnListener, _signal: AbortSignal): Promise<TurnResult> {
    const observed = new ObservedSettings(PermissionAdapter.id, "model", "high", "1.0.0");
    await listener.onStartedAsync(new TurnStart("session-1", false));
    await listener.onObservedAsync(observed);
    const result = await this.context.tools.sessions.at(-1)!.callAsync("notes_delete", {});
    this.answer = result instanceof ToolResult ? result.content[0]!.value : null;
    return new TurnResult(TurnOutcome.Completed, "session-1", observed, null);
  }

  public forkSession(_request: ForkRequest): Promise<ForkedSession> {
    return Promise.reject(new Error("The fixture forks no sessions."));
  }

  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

class TeamRunChat implements AsyncDisposable {
  public readonly checkpoints: CheckpointsModule;
  public readonly folder: string;
  public readonly projectId: string;
  private readonly directory: TemporaryDirectory;
  private readonly database: MemoryModuleDatabase;
  private readonly context: RecordingPartContext;
  private readonly part: RuntimePart;
  private readonly adapter: WritingAdapter;
  private readonly chatId: string;
  private readonly teammateId: string;

  private constructor(fields: Pick<TeamRunChat, "checkpoints" | "folder" | "projectId">, directory: TemporaryDirectory, database: MemoryModuleDatabase,
    context: RecordingPartContext, part: RuntimePart, adapter: WritingAdapter, chatId: string, teammateId: string) {
    this.checkpoints = fields.checkpoints;
    this.folder = fields.folder;
    this.projectId = fields.projectId;
    this.directory = directory;
    this.database = database;
    this.context = context;
    this.part = part;
    this.adapter = adapter;
    this.chatId = chatId;
    this.teammateId = teammateId;
  }

  public static async startAsync(files: Readonly<Record<string, string>> | null, withGit: boolean): Promise<TeamRunChat> {
    const directory = new TemporaryDirectory();
    const database = new MemoryModuleDatabase(HostedMigrations.all);
    const checkpoints = await CheckpointsModule.startAsync();
    const folder = directory.resolve("project");
    if (!Object.isNull(files))
      for (const [name, content] of Object.entries(files)) {
        mkdirSync(dirname(join(folder, name)), { recursive: true });
        writeFileSync(join(folder, name), content);
      }
    if (withGit) {
      const git = (...args: string[]): void => {
        execFileSync("git", args, { cwd: folder, windowsHide: true });
      };
      git("init", "-q");
      git("-c", "core.autocrlf=false", "add", "-A");
    }
    const context = new RecordingPartContext(directory.resolve("module"), database, directory.resolve("module"), checkpoints.services);
    const registry = new ProviderKindRegistry();
    const adapter = new WritingAdapter();
    registry.register(adapter);
    const part = new RuntimePart(new FixedRegistries(registry), "1.2.3");
    await part.activateAsync(context);
    const call = (method: string, payload: unknown): Promise<unknown> => TeamRunChat.callAsync(context, method, payload);
    const project = await call("teamrun.projectOpen", { rootPath: folder }) as { id: string; rootPath: string };
    const chat = await call("teamrun.conversationCreate", { projectId: project.id, title: null }) as { id: string };
    const provider = await call("teamrun.providerCreate", { kind: WritingAdapter.id, label: "Work", profileDir: directory.resolve("profile") }) as { id: string };
    const teammate = await call("teamrun.teammateCreate", new TeammateCreateParams("Alice", "Alice", provider.id, Harness.Provider, null, null).toJson()) as
      { id: string };
    return new TeamRunChat({ checkpoints, folder: project.rootPath, projectId: project.id }, directory, database, context, part, adapter, chat.id, teammate.id);
  }

  public async sendAsync(text: string, writes: Readonly<Record<string, string>>): Promise<Message> {
    this.adapter.writes = writes;
    const params = new MessageSendParams(this.chatId, `@Alice ${text}`, null, null, [], [this.teammateId]);
    const ended = this.context.whenWorkEnds();
    await TeamRunChat.callAsync(this.context, "teamrun.messageSend", params.toJson());
    await ended;
    const reply = (await this.messagesAsync()).filter(t => t.author !== MessageAuthor.User).at(-1);
    if (Object.isUndefined(reply))
      throw new Error("The chat has no reply.");
    return reply;
  }

  public async rewindAsync(messageId: string | null, restoreFiles: boolean): Promise<ConversationRewindResult> {
    return ConversationRewindResult.fromJson(await TeamRunChat.callAsync(this.context, "teamrun.conversationRewind",
      { chatId: this.chatId, messageId, restoreFiles }));
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.part.deactivateAsync();
    await this.checkpoints[Symbol.asyncDispose]();
    this.database[Symbol.dispose]();
    this.directory[Symbol.dispose]();
  }

  private async messagesAsync(): Promise<readonly Message[]> {
    await using reading = DatabaseContext.attach(new DbContextOptionsBuilder().use(new ModuleDatabaseProvider(this.database), new DataSource("reading", this.directory.path)),
      this.directory.path);
    return await new MessagesService(reading).listAsync(new MessageListParams(this.chatId, null));
  }

  private static callAsync(context: RecordingPartContext, method: string, payload: unknown): Promise<unknown> {
    const handler = context.methods.get(method);
    if (Object.isUndefined(handler))
      throw new Error(`The part did not register ${method}.`);
    return handler.handleAsync(new RequestContext("tests", payload as null, new AbortController().signal, 1));
  }
}

class FixedRegistries implements IProviderKindRegistryFactory {
  private readonly registry: ProviderKindRegistry;

  public constructor(registry: ProviderKindRegistry) {
    this.registry = registry;
  }

  public create(_productVersion: string, _dataDirectory: string, _starter: IProcessStarter): ProviderKindRegistry {
    return this.registry;
  }
}

class WritingAdapter implements IProviderAdapter {
  public static readonly id: string = "writing";

  public readonly descriptor: ProviderKind = new ProviderKind(WritingAdapter.id, "Writing provider", true, false);
  public readonly modes: readonly ProviderMode[] = [];
  public readonly defaultMode: string | null = null;
  public writes: Readonly<Record<string, string>> = {};
  private turns: number = 0;

  public checkSignIn(_provider: Provider): Promise<SignInCheck> {
    return Promise.resolve(new SignInCheck(AuthStatus.LoggedIn, null, "1.0.0", null));
  }

  public signIn(_provider: Provider, _signal: AbortSignal, _listener: ISignInListener): Promise<void> {
    return Promise.resolve();
  }

  public listModels(_provider: Provider | null): Promise<ProviderModelList> {
    return Promise.resolve(new ProviderModelList([new ProviderModel("model", "model", "Fixture", ["high"], true, null, true)], true));
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, _signal: AbortSignal): Promise<TurnResult> {
    this.turns++;
    await listener.onDetailAsync(new TurnDetail(DetailKind.Command, "write", { command: "write", status: "inProgress" }, "write"));
    for (const [name, content] of Object.entries(this.writes)) {
      mkdirSync(dirname(join(request.workingDirectory, name)), { recursive: true });
      writeFileSync(join(request.workingDirectory, name), content);
    }
    await listener.onDetailAsync(new TurnDetail(DetailKind.Command, "write", { command: "write", status: "completed" }, "write"));
    const session = `session-${this.turns}`;
    const observed = new ObservedSettings(WritingAdapter.id, "model", "high", "1.0.0");
    await listener.onStartedAsync(new TurnStart(session, false));
    await listener.onObservedAsync(observed);
    await listener.onDetailAsync(new TurnDetail(DetailKind.Text, "Done", null, null));
    return new TurnResult(TurnOutcome.Completed, session, observed, null);
  }

  public forkSession(_request: ForkRequest): Promise<ForkedSession> {
    return Promise.reject(new Error("The fixture forks no sessions."));
  }

  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
