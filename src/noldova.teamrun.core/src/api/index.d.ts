/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Stats } from "node:fs";

import { DbContext, type DbContextOptions } from "@noldova/context.data";
import type { Exception } from "@noldova/context.exceptions";
import type { MigrationBuilder, SqlConnection, SqlMigration, SqlTransaction } from "@noldova/context.data.sql";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import type { CaptureRequest, CaptureResult, CompareRequest, CompareResult, DeleteFolderRequest, DeleteFolderResult, PreviewRequest, PreviewResult,
  ReadRequest, ReadResult, RestoreRequest, RestoreResult } from "@noldova/checkpoints.protocol";
import type { ServiceResponseInfo } from "@noldova/teamrun.services";
import type { AcpAgentIdParams, AcpAgentListing, AcpLocalCommandAddParams, IMcpToolHost, McpToolCallParams, McpToolListParams, ProviderSignInCommand } from "@noldova/teamrun.protocol";
import type {
  Approval,
  ApprovalDecideParams,
  ApprovalKind,
  ApprovalOption,
  ApprovalQuestion,
  AttachmentContent,
  AttachmentInput,
  AttachmentReadParams,
  AuthStatus,
  BackgroundTask,
  BackgroundTaskIdParams,
  BackgroundTaskListParams,
  BackgroundTaskPage,
  BackgroundTasksClearedPayload,
  BackgroundTaskStatus,
  CommandStartParams,
  Conversation,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationListParams,
  ConversationMember,
  ChatMemberModeParams,
  ChatMemberSettingsParams,
  ChatPlanFirstParams,
  ConversationMemberParams,
  ConversationMoveParams,
  ConversationPosition,
  ConversationRenameParams,
  ConversationResponderParams,
  ConversationRewindParams,
  ConversationRewindResult,
  ConversationSearchParams,
  ConversationSearchResult,
  ChatFindParams,
  ChatFolderAttachParams,
  ChatFindResult,
  MessageSearchResult,
  DataFolder,
  FirstLaunch,
  DefaultTeammate,
  DefaultTeammateSetParams,
  DetailKind,
  Draft,
  DraftDiscardParams,
  DraftSaveParams,
  Event,
  ForkedSession,
  Message,
  MessageAttachment,
  MessageDetail,
  MessageIdParams,
  MessageListParams,
  MessagePage,
  MessagePageParams,
  MessageSendParams,
  MessageSendResult,
  ChatIdParams,
  WaitingMessage,
  WaitingMessageAddParams,
  WaitingMessageEditParams,
  WaitingMessageIdParams,
  WaitingMessagesPayload,
  ObservedSettings,
  OwnMcpServer,
  PlanUsage,
  PlanUsageParams,
  PlanWindow,
  Project,
  ProjectIdParams,
  ProjectOpenParams,
  ProjectListing,
  ProjectsLayoutSaveParams,
  ComposerDefaultSaveParams,
  Provenance,
  Provider,
  ProviderCreateParams,
  QuestionAnswer,
  ProviderIdentity,
  ProviderIdParams,
  ProviderMcpServerList,
  ProviderProfileDiscoverParams,
  ProviderProfileDiscovery,
  ProviderSignIns,
  ProviderUpdateParams,
  ProviderEnabledParams,
  ProviderKind,
  ProviderKindParams,
  ProviderKindInstallation,
  ProviderListModelsParams,
  ProviderMode,
  ProviderModelList,
  ProviderTool,
  ReadingPositionSaveParams,
  RunOutput,
  SharedMcpAccount,
  SharedMcpProviderSetParams,
  SharedMcpServer,
  SharedMcpServerDefinition,
  SharedMcpServerIdParams,
  ComputerUseGrant,
  ComputerUseGrantIdParams,
  SharedMcpServerListing,
  SharedMcpServerUpdateParams,
  SharedMcpSecretSetParams,
  SharedMcpSignInStarted,
  SharedMcpTeammateSetParams,
  ReplyAction,
  ReplyPage,
  ReplyUsage,
  ReplyPanel,
  Request,
  RequestedSettings,
  Response,
  RoleApplication,
  Teammate,
  TeammateCreateParams,
  TeammateFallback,
  TeammateIdParams,
  TeammateUpdateParams,
  TeammateUsage,
  SubAgent,
  SubAgentStartParams,
  SubAgentStopParams,
  SubAgentWaitParams,
  SubAgentWaitResult,
  PanelAnsweredParams,
  PanelName,
  WindowFocusedParams,
  WindowIdParams,
  WrittenImageReadParams,
  LinkedPaths,
  Department,
  DepartmentCreateParams,
  DepartmentIdParams,
  DepartmentMemberSetParams,
  DepartmentMoveParams,
  DepartmentUpdateParams,
  Organization
} from "@noldova/teamrun.protocol";

/**
 * The kinds of record TeamRun writes to the change feed, as the feed's entity names.
 */
export declare enum ChangeEntity {
  /**
   * Durable participant.
   */
  Teammate = "Teammate",
  /**
   * Membership and native session state.
   */
  ChatMember = "ChatMember",
  /**
   * A `Project`.
   */
  Project = "Project",
  /**
   * A `Chat`.
   */
  Chat = "Chat",
  /**
   * A `Message` with its details.
   */
  Message = "Message",
  /**
   * An `Approval`.
   */
  Approval = "Approval",
  /**
   * A `Provider`.
   */
  Provider = "Provider",
  /**
   * A preference kept in the `preferences` table, such as the default teammate.
   */
  Preference = "Preference",
  /**
   * A `SharedMcpServer` with its switches.
   */
  SharedMcpServer = "SharedMcpServer",

  /** An added ACP agent or a local ACP command. */
  AcpAgent = "AcpAgent",
  /** A `Department`. */
  Department = "Department",
  /** A `DepartmentMember`: a teammate in a department, keyed by the teammate's id. */
  DepartmentMember = "DepartmentMember"
}

/**
 * How a provider's turn ended, as the adapter reports it.
 */
export declare enum TurnOutcome {
  /**
   * The provider finished its reply.
   */
  Completed = "Completed",
  /**
   * The provider or its harness failed; the result carries the error.
   */
  Failed = "Failed",
  /**
   * The turn was interrupted before it finished, by a cancellation or by the provider.
   */
  Interrupted = "Interrupted",
}

/**
 * A turn that denies every approval it is asked for, since it must change nothing.
 */
export declare enum DenyingTurn {
  /**
   * A sub-agent that explores, read-only.
   */
  Explorer = "Explorer",
  /**
   * A request for a chat's title.
   */
  Title = "Title",
  /**
   * A teammate's request for its own summary.
   */
  Summary = "Summary",
}

/**
 * How the person answered a Noldova Desktop permission request, as TeamRun hands it back to the base.
 */
export declare enum PermissionAnswer {
  /**
   * Allowed this once, by the person or by the turn's mode.
   */
  AllowedOnce = "AllowedOnce",
  /**
   * Allowed with the option the base remembers: computer use's Allow in this chat, or the module's own allow-always label.
   */
  AllowedAlways = "AllowedAlways",
  /**
   * Denied, or not answered.
   */
  Denied = "Denied",
  /**
   * The person chose to do it themselves, with the module's take-over label; the call fails as denied.
   */
  TakenOver = "TakenOver",
}

/**
 * Where the reply to an outside message stands.
 */
export declare enum OutsideReplyState {
  /**
   * TeamRun doesn't know the message id, or forgot it when the outside token was reset.
   */
  Unknown = "Unknown",
  /**
   * The reply hasn't started yet.
   */
  Waiting = "Waiting",
  /**
   * The teammate is answering, or waits for the person's approval.
   */
  Working = "Working",
  /**
   * The teammate answered.
   */
  Answered = "Answered",
  /**
   * The reply ended without an answer, or never started.
   */
  Failed = "Failed",
}

/**
 * What carrying a session into another account's profile did, for a Sustain move between two accounts of one provider.
 */
export declare enum SessionCarry {
  /**
   * The session file is in the other profile, at its relative path there, and reads back whole, so the move resumes the session.
   */
  Carried = "Carried",
  /**
   * The provider still runs a task in the session, so it wasn't copied, and the move hands over to a new session.
   */
  Held = "Held",
  /**
   * The provider can't yet resume this session under another account, as a check of it hasn't passed, so it wasn't copied, and the move hands
   * over to a new session.
   */
  Refused = "Refused",
  /**
   * The session file wasn't found, or its copy failed or doesn't read back whole, so the move hands over to a new session.
   */
  Unread = "Unread",
}

/**
 * What a check of a folder found.
 */
export declare enum FolderState {
  /**
   * The path is a folder.
   */
  Present = "Present",
  /**
   * The path is gone, is no longer a folder, or can't be read, such as when access is denied.
   */
  Missing = "Missing",
  /**
   * The check didn't answer before its deadline, such as for a disconnected drive or share.
   */
  Unreachable = "Unreachable",
}

/**
 * Why a provider couldn't use a shared MCP server it was given.
 */
export declare enum SharedMcpFailureKind {
  /**
   * The provider's own settings blocked the server, such as Grok's `allowed_mcp_servers`.
   */
  Blocked = "Blocked",
  /**
   * The provider couldn't connect to the server, or the server failed to start.
   */
  Connection = "Connection",
  /**
   * The server needs the person to sign in through the provider first.
   */
  SignIn = "SignIn",
  /**
   * The provider didn't list TeamRun's tools to the turn before the wait for them ended, for no reason TeamRun could tell; the failure names
   * TeamRun's server, and its reason says what can leave the tools out.
   */
  Unlisted = "Unlisted",
  /**
   * The provider connected none of the turn's MCP servers, TeamRun's own among them, because it doesn't trust the turn's folder, as
   * Gemini CLI does in a folder it doesn't trust; the failure names TeamRun's server, and its reason says how to trust the folder.
   */
  Untrusted = "Untrusted",
}

/**
 * The base of every exception the core package throws, which its callers catch as one.
 */
export declare abstract class CoreException extends Exception {
  /**
   * Initializes the exception.
   * @param message What went wrong.
   */
  protected constructor(message: string);
}

/**
 * An approval came to a turn that must deny it, such as an explorer's or a title or summary request, with no option that denies it.
 */
export declare class ApprovalNotDeniableException extends CoreException {
  /**
   * The exception's name, `"ApprovalNotDeniableException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;
  /**
   * The turn the ask came to.
   */
  public readonly turn: DenyingTurn;
  /**
   * The ask's own summary of what it asked for.
   */
  public readonly summary: string;

  /**
   * Initializes the exception, with its message from the turn and the ask's summary.
   * @param turn The turn the ask came to.
   * @param summary The ask's own summary of what it asked for.
   */
  public constructor(turn: DenyingTurn, summary: string);
}

/**
 * A teammate's own summary request ended without completing, or completed without text.
 */
export declare class OwnSummaryUnansweredException extends CoreException {
  /**
   * The exception's name, `"OwnSummaryUnansweredException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;
  /**
   * How the summary request ended.
   */
  public readonly outcome: TurnOutcome;

  /**
   * Initializes the exception, with its message from how the request ended.
   * @param outcome How the summary request ended.
   */
  public constructor(outcome: TurnOutcome);
}

/**
 * A text that is not a Guid in its hyphenated form was parsed as one.
 */
export declare class GuidFormatException extends CoreException {
  /**
   * The exception's name, `"GuidFormatException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception, with a message saying which form a Guid takes.
   */
  public constructor();
}

/**
 * A wait ran out of time, such as a request an agent did not answer in time.
 */
export declare class TimeoutException extends CoreException {
  /**
   * The exception's name, `"TimeoutException"`, which the class sets itself so that it stays the same in a minified
   * build, and which `Resources.formatFailureKind` gives as the failure's kind.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What ran out of time.
   */
  public constructor(message: string);
}

/**
 * What one provider's adapter does for TeamRun: reports itself, checks sign-in, lists models, and
 * runs turns. Implemented in the providers package; the core only sees this contract, so provider
 * protocol details never enter it.
 */
export interface IProviderAdapter {
  /**
   * The provider as the protocol describes it.
   */
  readonly descriptor: ProviderKind;

  /**
   * How TeamRun installs the provider's program, for a provider TeamRun installs; absent for one the person installs.
   */
  readonly installation?: IProviderKindInstallation;

  /**
   * Where TeamRun looks for this kind's profile folders on this computer, and the entry names that make a folder one; absent for a
   * kind TeamRun finds no profile folders for.
   */
  readonly profileSearch?: ProfileSearch;

  /**
   * The provider's permission modes, as its model list names them; TeamRun's own tools ask by the turn's mode: not at all in an unrestricted
   * mode, and in a read-only one those that change anything are refused. Empty when it lists none.
   */
  readonly modes: readonly ProviderMode[];

  /**
   * The mode a turn runs in when none is chosen, or one it doesn't list is; `null` when it lists no modes.
   */
  readonly defaultMode: string | null;

  /**
   * The read-only mode an Explorer sub-agent runs in, set only where the provider or the system enforces it rather than the model's
   * instructions; absent for a provider that runs no Explorer.
   */
  readonly explorerMode?: string;

  /**
   * Why the provider runs no Explorer, a sentence the person sees in the refusal, for a provider whose own settings could let a command
   * past its read-only mode; absent when the general reason fits.
   */
  readonly explorerUnavailable?: string;

  /**
   * The line a teammate's instructions add on a provider whose own background sub-agents' results don't reach the chat after its turn, asking
   * it to wait for each one's result before its turn ends; absent or `null` when they run on and wake the chat, as Claude's do.
   */
  readonly backgroundSubAgentsNote?: string | null;

  /**
   * Whether the adapter gives its turns TeamRun's tools when the engine serves them. A turn's instructions name the tools only then, and name the command line otherwise;
   * absent or `false` for an adapter that doesn't.
   */
  readonly takesTeamRunTools?: boolean;

  /**
   * The mode a plan-first turn starts in, one of `modes`, read-only; the turn goes on in its requested `mode` once the person approves its plan.
   * Absent or `null` when the provider has none, and then a chat's Plan first doesn't apply to its replies.
   */
  readonly planMode?: string | null;

  /**
   * Checks whether the provider's profile is signed in and reports what the harness says about it.
   * @param provider The provider to check.
   * @returns The check's outcome.
   */
  checkSignIn(provider: Provider): Promise<SignInCheck>;

  /**
   * Checks a profile folder that discovery found, which the person hasn't added, without starting anything that reaches the provider's
   * service, so it reads only what the folder and the provider's offline status say; absent for a kind that can't, whose found folders
   * read as not checked. The full check, `checkSignIn`, runs once the person adds the provider.
   * @param provider The provider discovery made for the found folder, which isn't saved.
   * @returns The check's outcome.
   */
  checkFoundSignIn?(provider: Provider): Promise<SignInCheck>;

  /**
   * Readies a provider's empty profile folder before anything can sign in to it, such as claiming the folder as TeamRun's and making the
   * folders its sign-in terminal gets: one TeamRun just made for a new provider, or an empty one the person chose for a new or moved
   * provider; absent for a kind whose folder needs nothing first.
   * @param provider The new or moved provider, whose folder is empty.
   * @throws Error when the folder can't be readied; the provider isn't added or moved.
   */
  prepareProfile?(provider: Provider): void;

  /**
   * Runs the provider's own sign-in for the provider's profile, with the environment its turns
   * run with, such as one that opens the system browser; called only when the descriptor has
   * `supportsSignIn`.
   * @param provider The provider to sign in.
   * @param signal Aborts the sign-in, which stops the provider tooling.
   * @param listener Where the adapter asks for a page to open, when the provider tooling leaves
   * opening the browser to its client.
   * @returns A promise that resolves when the provider tooling reports the sign-in done.
   */
  signIn(provider: Provider, signal: AbortSignal, listener: ISignInListener): Promise<void>;
  /** The command the provider's agent signs in with in a terminal, `null` when it has none. */
  readSignInCommand?(provider: Provider): Promise<ProviderSignInCommand | null>;

  /**
   * Signs the provider's profile out of the provider with the provider's own tooling, which forgets the profile's sign-in;
   * called only when the descriptor has `supportsSignOut`, and absent for a kind that can't.
   * @param provider The provider to sign out.
   * @returns A promise that resolves when the provider tooling reports the profile signed out, and rejects with why when it
   * doesn't, such as a sign-in it can't forget.
   */
  signOut?(provider: Provider): Promise<void>;

  /**
   * Lists the models the provider offers, through the provider when one is given.
   * @param provider The provider, or `null` for the provider's default profile.
   * @param refresh Whether the person asked to refresh, so an adapter that keeps its list drops it first.
   * @param workingDirectory The folder a chat runs in, for a provider whose project configuration can name its defaults.
   * @returns The models, with whether the same answer says the provider is signed in.
   */
  listModels(provider: Provider | null, refresh?: boolean, workingDirectory?: string | null): Promise<ProviderModelList>;

  /**
   * Runs one turn: delivers the prompt, reports progress through the listener, waits for approval
   * decisions the listener returns, and ends when the provider finishes, fails, or the signal
   * aborts.
   * @param request What to run and where.
   * @param listener Where progress is reported.
   * @param signal Aborted to interrupt the turn.
   * @returns How the turn ended.
   */
  runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult>;

  /**
   * Asks the provider for a provider's plan use now; absent for a provider that reports none.
   * @param provider The provider, or `null` for the provider's default sign-in.
   * @returns The windows the provider reported, each under its own name, and the plan when the same read names it, or `null` when it
   * reported none or the read failed; a figure is never estimated.
   */
  readPlanUsage?(provider: Provider | null): Promise<PlanReading | null>;

  /**
   * Runs a one-shot question outside every chat, such as a chat's title or a handover summary, in a background session of its own and in the
   * provider's restricted mode where it has one; absent for a provider that can't.
   * @param request The isolated turn: no tools, no shared servers, nothing to resume.
   * @param listener Hears the turn, as {@link TitleTurn} and {@link SummaryTurn} do.
   * @param signal Aborts the question.
   * @returns The turn's result, or `null` when the provider runs no isolated turn for the request's provider, without starting it.
   */
  askIsolated?(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult | null>;

  /**
   * Tells the provider that the member of these sessions plans first again, so any query it keeps open for them, such as one whose background
   * task may still start a turn of its own, goes back to its plan mode now; absent for a provider that keeps no query open between turns. It
   * never rejects: a query that doesn't switch is left for its next turn to handle.
   * @param nativeSessionIds The sessions.
   */
  plansFirst?(nativeSessionIds: readonly string[]): Promise<void>;

  /**
   * Says why the provider can't take a shared MCP server, in a full sentence and in a few words as the panel shows them, or `null` when it can;
   * absent for a provider TeamRun passes no shared servers to yet. A provider takes a server as its definition names it, each variable read from
   * the provider's own environment.
   * @param server The server's definition.
   * @param provider The provider the server would reach.
   * @param workingDirectory The turn's folder, whose project files may name the provider's own servers, or `null` for the panel's listing.
   */
  sharedServerUnavailable?(server: SharedMcpServerDefinition, provider: Provider, workingDirectory: string | null): SharedMcpRefusal | null;

  /**
   * The name the provider knows a shared MCP server by, when it reads two names alike; a turn takes the first of the servers it knows by one
   * name, by name order, and leaves out the others with `Resources.formatSharedMcpNameClash`. Absent for a provider that knows each name apart.
   * @param name The server's name.
   */
  sharedServerNamespaceOf?(name: string): string;

  /**
   * Says why the provider can't take a shared MCP server with a saved secret, as `sharedServerUnavailable` does, or `null` when it takes the saved values over
   * its control channel; asked only for a server `sharedServerUnavailable` lets through. Absent for a provider TeamRun passes no saved secrets to
   * yet, which can't take such a server.
   * @param server The server's definition.
   */
  savedSecretsUnavailable?(server: SharedMcpServerDefinition): SharedMcpRefusal | null;

  /**
   * Lists a provider's own MCP servers by name and the state the provider reports without connecting to them, without
   * `teamrun`; reading them never starts a server, runs a hook or connects anything of the person's. Absent for a kind
   * that offers no list.
   * @param provider The provider, or `null` for the provider's default profile.
   * @returns The servers, in the configuration's order, or `null` when the kind offers no list after all.
   * @throws Error when the provider's configuration or list can't be read.
   */
  listOwnMcpServers?(provider: Provider | null): Promise<readonly OwnMcpServer[] | null>;

  /**
   * Forks a native session through one of its turns into a new session that holds the history up
   * to that turn; only when the descriptor says `supportsFork`.
   * @param request The session, the turn, and where the fork works.
   * @returns The forked session, for the descriptor's kind and the request's provider: the new session, or, for a provider that
   * forks when it resumes, the request's session with `resumeAt` set to the request's turn.
   * @throws When the provider cannot fork the session (the caller falls back to a transcript).
   */
  forkSession(request: ForkRequest): Promise<ForkedSession>;

  /**
   * Closes the sessions the adapter keeps open between turns for a deleted chat, and revokes their tokens; a session that runs a turn or
   * background work ends as it would have, and is kept no longer.
   * @param nativeSessionIds The deleted chat's native session ids, as its turns reported them.
   */
  closeSessions?(nativeSessionIds: readonly string[]): Promise<void>;

  /**
   * Reads the summary the provider wrote when it last compacted a session, for a Sustain handover from it.
   * @param provider The account whose profile holds the session, or null for the provider's own.
   * @param nativeSessionId The session.
   * @returns The summary's text, or null when the session has no compaction or its summary can't be read.
   */
  readCompaction?(provider: Provider | null, nativeSessionId: string): Promise<string | null>;

  /**
   * Copies a session's file into another account's profile of the same provider, at the same relative path, so that account resumes it;
   * only the session file goes, never a sign-in, and a copy left by an earlier move is replaced.
   * @param from The account whose profile holds the session, or null for the provider's own.
   * @param to The account the session moves to.
   * @param nativeSessionId The session.
   * @returns Whether the session was carried, or why it wasn't; a failure is logged and answers `SessionCarry.Unread`.
   */
  carrySession?(from: Provider | null, to: Provider, nativeSessionId: string): Promise<SessionCarry>;

  /**
   * Writes the answer to a question posted through `ITurnListener.onQuestionsPosted` as the prompt the provider reads it in;
   * without it, the teammate gets the answer as plain text.
   * @param replyTo The posted ask's `providerRequestId`.
   * @param question The question's text.
   * @param answer The chosen options and the typed text, comma-separated.
   * @returns The prompt.
   */
  formatQuestionReply?(replyTo: string, question: string, answer: string): string;

  /**
   * Stops the adapter's background processes.
   */
  shutdown(): Promise<void>;
}

/**
 * How TeamRun installs a provider's program on this computer.
 */
export interface IProviderKindInstallation {
  /**
   * The one-line reason this computer can't install it, or `null` when it can.
   */
  readonly unavailable: string | null;

  /**
   * The program this computer lacks that installing it needs, such as `unzip` or `tar`, when that is why it can't install; `null` when it can,
   * or when it can't for another reason, such as no build for this computer.
   */
  readonly missingTool: string | null;

  /**
   * Whether the program is installed and ready to start.
   */
  readonly isInstalled: boolean;

  /**
   * The path of a compatible program found outside TeamRun's own install, such as one on `PATH`, that counts as installed; `null` or absent when
   * TeamRun's own copy is installed, or none was found. Core passes it as the installation's `foundPath` while `Installed`.
   */
  readonly foundPath?: string | null;

  /**
   * Why the kind is not installed though a program was found, such as one of a version TeamRun doesn't accept; `null` or absent otherwise.
   * Core shows it as a `NotInstalled` installation's reason when no install failed since.
   */
  readonly notInstalledReason?: string | null;

  /**
   * Reads the installed program's version and the version an install would bring now, each `null` when it can't be read; it never throws, and
   * settles within its own time limits, as Core reads no other versions of the kind until it does.
   */
  readVersions(): Promise<ProviderKindVersions>;

  /**
   * Installs the program, or replaces an installed one with the version an install brings now, leaving nothing behind, and an installed one as it
   * was, when it fails or `signal` stops it.
   * @param progress Called with the bytes received so far and the download's size.
   * @param commit Called once the install can no longer be stopped, such as when a setup that must run to its end starts; `signal` is then
   * never aborted.
   * @returns The installed program's path.
   * @throws Error with the one-line reason when it fails.
   */
  install(progress: (received: number, total: number) => void, signal: AbortSignal, commit: () => void): Promise<string>;
}

/**
 * How TeamRun finds a provider's command-line tool, which the person installs.
 */
export interface IProviderTool {
  /**
   * Looks for the tool afresh, by where its provider installs it and its own version command, so a tool installed since the last check is found.
   * @returns The tool as found, with the provider's official install command for this platform and its subscription page.
   */
  check(): Promise<ProviderTool>;
}

/**
 * What finds the sender token of a running turn by its Noldova Desktop session.
 */
export interface ISenderTokens {
  /**
   * Finds the sender token of the running turn whose Noldova Desktop session this is, which sends as its teammate from its chat.
   * @param session The id of the Noldova Desktop session.
   * @returns The token, or `null` when the session is no running turn's.
   */
  senderTokenOf(session: string): string | null;
}

/**
 * What describes and makes a send with a sender token that the caller has already asked the person about, in the same process only.
 */
export interface ISenderSends {
  /**
   * Describes what a send would ask: its chat and whose reply it starts, as `sendAsync` works them out, without sending or preparing anything.
   * Starts names each teammate that would reply and whose provider exists, is turned on, signed in and registered, or the chat's default
   * teammate, joined by commas; when no one would, it says the message only joins the chat, or that the chain has reached its hand-off limit.
   * @param params The send, with its sender token.
   * @returns The ask, or `null` when `sendAsync` would refuse it.
   */
  describeSendAsync(params: MessageSendParams): Promise<SendAsk | null>;

  /**
   * Sends as `sendAsync` does, without its ask, once the caller's own ask was allowed, and only when who the send starts still reads `starts`.
   * It isn't a method, so nothing a client sends reaches it.
   * @param params The send, with its sender token.
   * @param starts The Starts the person allowed, or `null` when `describeSendAsync` found nothing to ask.
   * @returns The stored message and zero or more pending replies.
   * @throws ServiceException as `sendAsync` does, and named `ErrorCode.Conflict` when who the send starts no longer reads `starts`.
   */
  sendAllowedAsync(params: MessageSendParams, starts: string | null): Promise<MessageSendResult>;
}

/**
 * Messages from a session outside TeamRun, into a teammate's own chat for them, which starts on its provider's asking mode, or into any
 * existing chat. The sender is marked as outside, so the teammate reads the message as data from an unknown sender, and its reply never
 * runs in an unrestricted mode outside the teammate's own outside chat. Each message is known by a random handle.
 */
export interface IOutsideMessages {
  /**
   * Lists the teammates.
   * @returns For each teammate its `id`, `name`, `provider` kind or `null`, `model` and `state`, `working` while it has an open reply
   * and `idle` otherwise.
   */
  listOutsideAsync(): Promise<readonly JsonObject[]>;

  /**
   * Lists the most recent chats that hold a message, at most `Resources.outsideChatsListed`, the one with the latest message first,
   * with no message text.
   * @returns For each chat its `id`, `title`, `project` name or `null`, `teammate`, the `id` and `name` of the teammate a message wakes
   * when it names none, or `null`, its member `teammates` by `id` and `name`, and `state`, `working` while it has an open reply and
   * `idle` otherwise.
   */
  listOutsideChatsAsync(): Promise<readonly JsonObject[]>;

  /**
   * Sends a message into a chat: the given chat, or the teammate's outside chat, which it makes when the teammate has none or its chat is
   * gone. The text's mentions aren't read, so the message starts no one else. In a given chat the reply, and every turn that follows from
   * it, such as a wake or a sub-agent, runs in the teammate's mode there, or the provider's default mode where that one is unrestricted.
   * @param teammateId The teammate's id; with a chat, `null` for the teammate that answers it: its chosen responder, or its only member.
   * @param text The message.
   * @param label The name the outside session gave itself, as `MessageSender.allowsOutsideLabel` takes it.
   * @param chatId The chat's id, or `null` for the teammate's outside chat.
   * @returns The message's handle: 16 random bytes, base64url. The last `Resources.outsideMessagesKept` handles are kept.
   * @throws ServiceException named `ErrorCode.NotFound` for an unknown teammate or chat, `ErrorCode.InvalidParams` for neither a teammate
   * nor a chat, a teammate that isn't the chat's member or a chat with no teammate that answers it, and `ErrorCode.Conflict` while the
   * chat is still answering, or while a background task in it runs and the cap on an unrestricted mode would change the teammate's mode.
   */
  sendOutsideAsync(teammateId: string | null, text: string, label: string, chatId?: string | null): Promise<string>;

  /**
   * Reads where the reply to a message stands.
   * @param messageId The message's handle.
   * @returns The reply; `Unknown` for a handle it doesn't keep.
   */
  readOutsideAsync(messageId: string): Promise<OutsideReply>;

  /**
   * Forgets every handle, so each reads as `Unknown`.
   */
  forgetOutsideAsync(): Promise<void>;
}

/**
 * Where an adapter reports what a sign-in needs from the person.
 */
export interface ISignInListener {
  /**
   * Asks for a page to open in the system browser, such as the provider's sign-in page; the
   * providers service publishes it as `SignInLink` for the window that started the sign-in.
   * @param url The page, as the provider tooling gave it.
   */
  openLink(url: string): void;
}

/**
 * Where an adapter reports a turn's progress. An adapter awaits each callback that returns a promise before it reports the next event,
 * so the listener sees the provider's events one at a time and in their order.
 */
export interface ITurnListener {
  /**
   * Reports that the provider accepted the turn, with the native session it runs in.
   * @param start The session facts.
   */
  onStartedAsync(start: TurnStart): Promise<void>;

  /**
   * Reports one detail of the reply, in order. A sub-agent's details name its `SubAgent` detail by `parentItemId`; a reply that has ended
   * still takes a running sub-agent's own update and details, until the update says it ended.
   * @param detail The detail.
   */
  onDetailAsync(detail: TurnDetail): Promise<void>;

  /**
   * Reports that the provider is thinking without sending text a reply can show, such as a thinking progress frame.
   * Called as often as the provider reports progress; the listener decides what to show.
   */
  onThinking(): void;

  /**
   * Asks for the user's decision on a request the provider made and resolves with the chosen
   * option's id; the adapter keeps the turn waiting meanwhile. Rejects when the reply is cancelled.
   * When `signal` aborts before the decision, the request is withdrawn: its approval is cancelled
   * and announced, and the promise rejects with a `Conflict` `ServiceException`.
   * @param ask What the provider asks.
   * @param signal Aborts when the provider withdraws the request, such as when its own run stops
   * waiting for the answer; already aborted, it rejects with the signal's reason and asks nothing.
   * @returns The chosen option's id.
   */
  onApprovalRequested(ask: ApprovalAsk, signal?: AbortSignal): Promise<string>;

  /**
   * Asks the user the provider's questions as a `Question` approval offering Answer and Skip, naming a sub-agent
   * that asks in its payload's `subAgent` field, as an approval's payload does, and resolves with the answers; the
   * adapter keeps the turn waiting meanwhile. Resolves with the answers
   * to the questions that aren't secret and the secret ones alike, though only the others are stored.
   * Rejects when the reply is cancelled, and when `signal` aborts as `onApprovalRequested` does.
   * @param ask What the provider asks.
   * @param signal Aborts when the provider withdraws the questions.
   * @returns The answers, one per answered question, or `null` when the user skipped them.
   */
  onQuestionsAsked(ask: QuestionAsk, signal?: AbortSignal): Promise<readonly QuestionAnswer[] | null>;

  /**
   * Posts questions the provider asked without waiting, as a `Question` approval offering Answer and Skip whose payload's
   * `replyTo` field holds `ask.providerRequestId`. The card doesn't hold the turn and stays open after the turn ends, until
   * the user answers or skips it, or stops the reply. An answer goes to the teammate as its next message, after a running
   * turn, in the adapter's `formatQuestionReply` when it has one.
   * @param ask What the provider asks; its `providerRequestId` is the id the provider's reply names.
   */
  onQuestionsPostedAsync(ask: QuestionAsk): Promise<void>;

  /**
   * Reports what the provider says about itself: model, effort, harness version, identity.
   * @param observed The observed settings.
   */
  onObservedAsync(observed: ObservedSettings): Promise<void>;

  /**
   * Reports what the reply used, as the provider sent it; each figure it carries replaces the one before, and the others stay.
   * @param usage The figures, `null` where the provider sent none.
   */
  onUsageAsync(usage: ReplyUsage): Promise<void>;

  /**
   * Reports the plan use of the reply's provider, as the provider sent it during the turn.
   * @param windows The windows, each under the provider's own name.
   * @param readAt When the read that answered began, as ISO 8601, so an older read that answers later is known as older.
   */
  onPlanUsageAsync(windows: readonly PlanWindow[], readAt: string): Promise<void>;

  /**
   * Reports a command the provider runs in the background. The adapter may report a task, its output
   * and its end after `runTurn` returns, while the provider still owns it; a repeated start is ignored.
   * @param start The task's provider id, command line, and how to stop it.
   */
  onTaskStartedAsync(start: TaskStart): Promise<void>;

  /**
   * Reports output a running background task wrote.
   * @param taskId The provider's id of the task.
   * @param text The new output.
   */
  onTaskOutput(taskId: string, text: string): void;

  /**
   * Reports how a background task ended; a task that already ended stays as it was.
   * @param end The task's provider id, status and exit code.
   */
  onTaskEndedAsync(end: TaskEnd): Promise<void>;

  /**
   * Reports that the provider started a turn on its own in this reply's session, such as when one of its background tasks ended, so that
   * turn shows as a new reply from the same teammate, after this one.
   * @param wake What started the turn.
   * @returns Where the new turn reports, or `null` when no reply can show it, such as during shutdown.
   */
  onWakeAsync(wake: TurnWake): Promise<WakeTurn | null>;

  /**
   * Reports that the provider couldn't connect to a shared MCP server the turn gave it, or that the server needs a sign-in. The adapter
   * reports only servers from `TurnRequest.sharedServers`, and never the provider's error text, which can hold a header or a token.
   * @param failure The server and why its provider couldn't use it.
   */
  onSharedServerFailedAsync(failure: SharedMcpFailure): Promise<void>;
  /**
   * Reports a title the provider gave its session, from an ACP agent's `session_info_update`; absent on a listener that has no chat to name.
   * @param title The title, which isn't blank.
   */
  onTitleAsync?(title: string): Promise<void>;
  /**
   * Offers a way to steer the running turn: a person's message read by the provider at the turn's next step. The adapter offers it once
   * the turn can take one and withdraws it with `null` before the turn ends; absent on a listener that takes no steer.
   * @param steer Gives the provider the message's text and attachments, resolving `true` once the provider took it and `false` when it
   *   can't, such as when its turn just ended; `null` withdraws it.
   */
  onSteerable?(steer: ((steer: TurnSteer) => Promise<boolean>) | null): void;
}

/**
 * Each provider's plan use as its provider last reported it, from turns or reads, while TeamRun runs; it is not stored.
 */
export interface IPlanUsageService {
  /**
   * Keeps a provider's plan use and publishes `PlanUsageUpdated`, unless the one kept was read later and the plan too; reads that overlap
   * can answer in either order, so the windows come from the latest read and the plan from the latest read that names it or none.
   * @param kind The kind's id.
   * @param providerId The `Provider` id, or `null` for the provider's default sign-in.
   * @param windows The windows the provider reported.
   * @param readAt When the read began, as ISO 8601.
   * @param plan The plan's code the read named, `null` when it named none, which clears the plan, or `undefined`, the default, for a read
   * that doesn't read the plan, such as a reply's, which keeps the plan kept before it.
   * @returns The plan use kept: this one, the later read kept before it, or that read with this one's plan.
   * It is `usedUp` when one of its windows is used up and that window's reset is still to come, `usedUpUntil` the latest such reset, or
   * `null` when a used-up window names none; a newer report with usage left clears it.
   */
  record(kind: string, providerId: string | null, windows: readonly PlanWindow[], readAt: string, plan?: string | null): PlanUsage;

  /**
   * Lists every provider's last plan use, each with whether it is used up, the one state continuity reads too.
   * @returns The plan uses, in the order their providers first reported.
   */
  list(): readonly PlanUsage[];
}

/**
 * Receives the events the core publishes.
 */
export interface IEventListener {
  /**
   * Receives one event.
   * @param event The event.
   */
  onEvent(event: Event): void;
}

/**
 * Where the core publishes its events: the runtime fans them out to attached clients.
 */
export interface IEventSink {
  /**
   * Publishes one event to every listener.
   * @param event The event.
   */
  publish(event: Event): void;
}

/**
 * A file the runtime part opened for the core to copy, such as one it redeemed by its grant; a Node.js `FileHandle` is one.
 */
export interface IOpenedFile {
  /**
   * Reads the open file's status.
   * @returns Whether it is a regular file, its size and its modification time.
   */
  stat(): Promise<Pick<Stats, "isFile" | "size" | "mtimeMs">>;

  /**
   * Reads bytes at a position, without moving the file's own position.
   * @param buffer Where the bytes go.
   * @param offset Where in `buffer` they start.
   * @param length How many bytes to read at most.
   * @param position Where in the file to read from.
   * @returns How many bytes were read; 0 at the end of the file.
   */
  read(buffer: Buffer, offset: number, length: number, position: number): Promise<{ bytesRead: number }>;
}

/**
 * Where the core writes the failures it recovers from: the runtime part passes its module log.
 */
export interface ILog {
  /**
   * Writes one message, without file contents or other user data.
   * @param message The message.
   */
  write(message: string): void;
}

/**
 * What answers a Noldova Desktop permission request by asking the person on a running reply.
 */
export interface IPermissionAsker {
  /**
   * Answers a Noldova Desktop permission request by asking the person on the reply whose turn opened the session, unless the turn runs in an
   * unrestricted permission mode, which asks for nothing: then a request below High risk is allowed without asking, except one whose allowing
   * the base remembers for the chat, which always asks the person.
   * @param session The id of the Noldova Desktop session the request's call is in.
   * @param module The id of the module that raised it.
   * @param ask The request; its payload is a `PermissionPayload`.
   * @param signal Aborts when the answer is no longer wanted.
   * @returns `AllowedOnce` when the person allowed it once, or the turn's mode allowed it; `AllowedAlways` or `TakenOver` when the person chose
   * that option; `Denied` otherwise, and at once, with a log line, when the session is no running turn's.
   */
  askPermissionAsync(session: string, module: string, ask: PermissionAsk, signal: AbortSignal): Promise<PermissionAnswer>;
}

/**
 * The project methods of the catalog (`ProjectList`, `ProjectOpen`, `ProjectForget`) over
 * TeamRun's record, plus the lookup the engine needs.
 */
export interface IProjectsService {
  /**
   * Lists the projects, oldest first.
   * @param transaction The transaction to read in, or none.
   * @returns The projects.
   */
  listProjectsAsync(transaction?: SqlTransaction): Promise<readonly Project[]>;

  /**
   * Lists the projects, oldest first, each with whether its folder is missing, unreachable or no
   * longer a folder. Checks every folder at once, waits a short bound for the checks, and answers
   * with each folder's last known state; a check that ends later still publishes its change.
   * @returns The listings.
   */
  listAsync(): Promise<readonly ProjectListing[]>;

  /**
   * Checks a folder within the probe's deadline. For a project, keeps the state found unless a check
   * that began later already kept one, and publishes `ProjectFolderChanged` when it changes.
   * @param path The folder's path.
   * @param projectId The project the folder belongs to, or `null` for a chat without one.
   * @returns What the check found.
   */
  checkFolderAsync(path: string, projectId: string | null): Promise<FolderState>;
  /**
   * Checks a path a reply links to, through the probe's limit on such reads.
   * @param path The path.
   * @returns What the check found.
   */
  checkLinkedFolderAsync(path: string): Promise<FolderState>;

  /**
   * Finds a project by id.
   * @param projectId The project id.
   * @param transaction The transaction to read in, or none.
   * @returns The project, or `null` when it does not exist.
   */
  findAsync(projectId: string, transaction?: SqlTransaction): Promise<Project | null>;

  /**
   * Opens a folder as a project, creating the project on first open.
   * @param params The absolute path of the folder.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The existing or created project.
   * @throws ServiceException (foundation) named `ErrorCode.InvalidParams` when the path is not absolute.
   */
  openAsync(params: ProjectOpenParams, transaction?: SqlTransaction): Promise<Project>;

  /**
   * Forgets a project; the folder is left untouched.
   * @param params The project id.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The ids of the conversations it deleted.
   * @throws ServiceException (foundation) named `ErrorCode.NotFound` when the project does not exist, and
   * `ErrorCode.Conflict` while the project still has conversations.
   */
  forgetAsync(params: ProjectIdParams, transaction?: SqlTransaction): Promise<readonly string[]>;

  /**
   * Reads the Projects view's layout.
   * @param transaction The transaction to read in, or none.
   * @returns The layout's JSON object, or `null` when none is kept.
   */
  readLayoutAsync(transaction?: SqlTransaction): Promise<JsonObject | null>;

  /**
   * Keeps the Projects view's layout as it is, replacing the one kept.
   * @param params The layout.
   * @returns The layout kept.
   */
  saveLayoutAsync(params: ProjectsLayoutSaveParams): Promise<JsonObject>;
}

/**
 * The conversation methods of the catalog over TeamRun's record, plus the lookup the engine needs.
 */
export interface IConversationsService {
  /**
   * Lists memberships in join order; the conversation must exist.
   */
  listMembersAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<readonly ConversationMember[]>;

  /**
   * Adds a teammate once and marks the conversation edited; repeated additions preserve join time and session state and
   * change nothing.
   */
  addMemberAsync(params: ConversationMemberParams, transaction?: SqlTransaction): Promise<ConversationMember>;

  /**
   * Removes an existing membership while its conversation is idle and marks the conversation edited; missing membership
   * is a no-op.
   */
  removeMemberAsync(params: ConversationMemberParams, transaction?: SqlTransaction): Promise<void>;

  /**
   * Finds a membership by both identities.
   */
  findMemberAsync(params: ConversationMemberParams, transaction?: SqlTransaction): Promise<ConversationMember | null>;

  /**
   * Updates session state for an existing membership, with the account the session belongs to when it isn't the teammate's own, and records the change.
   */
  setMemberSessionAsync(params: ConversationMemberParams, nativeSessionId: string | null, resumedNativeSession: boolean, sessionProviderId?: string | null,
    transaction?: SqlTransaction): Promise<ConversationMember>;

  /**
   * Sets the permission mode of an existing membership, or `null` to follow the teammate's own, keeping its session, and records the change.
   * @throws ServiceException with `NotFound` when the teammate isn't a member of the chat.
   */
  setMemberModeAsync(params: ChatMemberModeParams, transaction?: SqlTransaction): Promise<ConversationMember>;

  /**
   * Sets the model, effort and speed of an existing membership, or `null` to follow the teammate's own, keeping its session and mode, and records the change.
   * @throws ServiceException with `NotFound` when the teammate isn't a member of the chat.
   */
  setMemberSettingsAsync(params: ChatMemberSettingsParams, transaction?: SqlTransaction): Promise<ConversationMember>;

  /**
   * Turns the chat's Plan first on or off for every member, keeping its update time, and records the change; turning it on again makes
   * the members whose plan was approved plan first again, and anything else that changes nothing records nothing.
   * @throws ServiceException with `NotFound` when the chat doesn't exist.
   */
  setPlanFirstAsync(params: ChatPlanFirstParams, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * Records that a member's plan was approved, so that member's replies no longer plan first while the others' still do; keeps the update
   * time, and records nothing when it was already approved or the chat doesn't plan first.
   * @param chatId The chat.
   * @param teammateId The teammate, or `null` for the chat's own provider.
   * @param transaction The transaction to work in, or none for its own.
   * @throws ServiceException with `NotFound` when the chat doesn't exist.
   */
  approvePlanAsync(chatId: string, teammateId: string | null, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * Records that a member's plan is no longer approved, so that member's replies plan first again, as when its approval couldn't go ahead;
   * keeps the update time, and records nothing when it wasn't approved or the chat doesn't plan first.
   * @param chatId The chat.
   * @param teammateId The teammate, or `null` for the chat's own provider.
   * @param transaction The transaction to work in, or none for its own.
   * @throws ServiceException with `NotFound` when the chat doesn't exist.
   */
  reopenPlanAsync(chatId: string, teammateId: string | null, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * Resets memberships for a provider rebind: each chat forgets the teammate's session, and the permission mode, model, effort and speed it chose for the earlier provider.
   * Rejects when an affected conversation has an open reply.
   */
  resetTeammateSessionsAsync(teammateId: string, transaction?: SqlTransaction): Promise<void>;

  /**
   * Forgets the provider sessions a provider's profile directory holds before it moves: the native
   * sessions of the provider's direct replies so far are no longer resumed, a conversation's forked session
   * on it is dropped, and every membership of a teammate on it starts a fresh session; sessions on other
   * providers, and the provider's sessions after the move, are kept.
   * Rejects while a reply on the provider is open.
   */
  resetProviderSessionsAsync(providerId: string, transaction?: SqlTransaction): Promise<void>;

  /**
   * Removes memberships before deleting a teammate; rejects while an affected conversation has an open reply.
   */
  removeTeammateMembersAsync(teammateId: string, transaction?: SqlTransaction): Promise<void>;

  /**
   * Lists a project's conversations, or those without a project, oldest first.
   * @param params The project id, or `null` for the conversations without a project.
   * @param transaction The transaction to read in, or none.
   * @returns The conversations.
   */
  listAsync(params: ConversationListParams, transaction?: SqlTransaction): Promise<readonly Conversation[]>;

  /**
   * Lists the conversations of every project and those without one that hold a message, the one with the latest message first.
   * @param limit How many to list at most.
   * @returns The conversations.
   */
  listRecentAsync(limit: number): Promise<readonly Conversation[]>;

  /**
   * Lists a project's empty conversations, oldest first: those not edited, with no message and no draft text, attachment
   * or missing file, which New chat may reuse; or those without a project.
   * @param params The project id, or `null` for the conversations without a project.
   * @returns The empty conversations.
   */
  listEmptyAsync(params: ConversationListParams): Promise<readonly Conversation[]>;

  /**
   * Finds a conversation by id.
   * @param conversationId The conversation id.
   * @param transaction The transaction to read in, or none.
   * @returns The conversation, or `null` when it does not exist.
   */
  findAsync(conversationId: string, transaction?: SqlTransaction): Promise<Conversation | null>;

  /**
   * Creates a conversation in a project, not edited, with the teammate it starts with as its member when one is given;
   * a `null` title becomes `Resources.defaultConversationTitle`.
   * @param params The project id, the optional title and the optional teammate.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The conversation.
   * @throws ServiceException named `ErrorCode.NotFound` when the project or the teammate does not exist.
   */
  createAsync(params: ConversationCreateParams, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * Renames a conversation and marks it edited.
   * @param params The conversation id and the new title.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The renamed conversation.
   * @throws ServiceException named `ErrorCode.NotFound` when the conversation does not exist.
   */
  renameAsync(params: ConversationRenameParams, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * Gives a chat a title TeamRun made, keeping its update time and its place in the list, unless a person chose one.
   * @param conversationId The chat.
   * @param title The new title.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The chat with its new title, or `null` when the chat is gone or a person chose its title.
   */
  giveTitleAsync(conversationId: string, title: string, transaction?: SqlTransaction): Promise<Conversation | null>;

  /**
   * Marks a conversation as just used, so it lists first among the newest, as a new one does; its title and messages stay.
   * @param params The conversation id.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The conversation with its new update time.
   * @throws ServiceException named `ErrorCode.NotFound` when the conversation does not exist.
   */
  touchAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * Sets or clears the responder chosen in a chat's composer to answer a teammate's message that mentions no one, a
   * teammate or the default teammate's settings, and logs the update; the chat's update time stays, so it keeps its
   * place in the newest-first list. A choice the person made marks the chat edited.
   * @param params The conversation id, the chosen responder, or `null` to clear the choice, and whether the person chose it.
   * @returns The conversation with its chosen responder.
   * @throws ServiceException named `ErrorCode.NotFound` when the conversation, the given teammate or the given provider
   * does not exist; `ErrorCode.InvalidParams` when the provider belongs to another kind than the settings name.
   */
  setResponderAsync(params: ConversationResponderParams, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * Gives each chat whose chosen settings name no provider the provider `providerOf` finds for their kind, and logs each change; a chat
   * it finds none for keeps its choice, which a send then refuses until a provider is chosen. The chats' update times stay.
   * @param providerOf Finds a kind's provider id, or `null`.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The chats it moved.
   */
  moveProviderlessAsync(providerOf: (kind: string) => string | null, transaction?: SqlTransaction): Promise<readonly Conversation[]>;

  /**
   * Moves a conversation under another project and marks it edited. A conversation without a project first has its folder copied
   * into the project's root, asynchronously, while the project and the folder are held from turns, rewinds, moves and deletes;
   * the move is then recorded in a short transaction. A failure in the copy or there removes what the copy made, newest first,
   * trying every one and logging those it couldn't remove, and passes on its own error.
   * @param params The conversation id and the project id.
   * @returns The moved conversation.
   * @throws ServiceException named `ErrorCode.NotFound` when the conversation or the project does not exist, also when the project
   * is forgotten during the copy; `ErrorCode.Conflict` when either is busy, or as `ChatFolders.copyToAsync` refuses the copy.
   */
  moveAsync(params: ConversationMoveParams): Promise<Conversation>;

  /**
   * Deletes a conversation with its messages and approvals, logging every deletion. A conversation without a project keeps its own
   * folder until the engine's `releaseFolderAsync` deletes it.
   * @param params The conversation id.
   * @throws ServiceException named `ErrorCode.NotFound` when the conversation does not exist; `Conflict` while a reply is open or
   *   its folder has an active turn or rewind.
   */
  deleteAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<void>;

  /**
   * Counts the files in a conversation's own folder, its `.git` left out, reading the folder without holding up other requests.
   * @param params The conversation id.
   * @returns The count; 0 for a conversation in a project, or one whose folder is gone.
   * @throws ServiceException named `ErrorCode.NotFound` when the conversation does not exist.
   */
  countFolderFilesAsync(params: ConversationIdParams): Promise<number>;

  /**
   * Attaches an existing folder to a chat without a project, or replaces the one attached, so that its teammates work in it, in place,
   * from the next turn; nothing is copied, and the chat's own folder stays for a detach. The chat's replies keep no checkpoint, since
   * theirs were taken of the folder before, so a rewind to one of them restores no files.
   * @param params The chat and the folder's absolute path, kept resolved.
   * @param check Checks the folder, as the projects service checks a project's folder.
   * @returns The chat, whose `folder` is the attached folder.
   * @throws ServiceException named `ErrorCode.InvalidParams` when the path isn't absolute or the folder isn't present,
   * `ErrorCode.NotFound` for an unknown chat, and `ErrorCode.Conflict` for a chat in a project, while a reply runs in the chat, or while
   * the folder is held.
   */
  attachFolderAsync(params: ChatFolderAttachParams, check: (path: string) => Promise<FolderState>): Promise<Conversation>;

  /**
   * Detaches a chat's attached folder, leaving its files as they are, so that its teammates work in the chat's own folder again from the
   * next turn, and its replies keep no checkpoint, as with an attach; a chat with none attached comes back as it is.
   * @param params The chat id.
   * @returns The chat, whose `folder` is its own folder again.
   * @throws ServiceException named `ErrorCode.NotFound` for an unknown chat, and `ErrorCode.Conflict` while a reply runs in the chat.
   */
  detachFolderAsync(params: ConversationIdParams): Promise<Conversation>;

  /**
   * Removes a conversation's messages from a sequence on, with their approvals.
   * @param conversationId The conversation id.
   * @param fromSequence The sequence of the first message to remove.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The messages removed, in sequence order.
   */
  removeFromAsync(conversationId: string, fromSequence: number, transaction?: SqlTransaction): Promise<readonly Message[]>;

  /**
   * Lists the kept output of a chat's earlier Runs, by message, part and block.
   * @param params The chat's id.
   * @returns The outputs; none for a chat without any.
   * @throws ServiceException named `ErrorCode.NotFound` when the chat does not exist.
   */
  listRunOutputsAsync(params: ConversationIdParams): Promise<readonly RunOutput[]>;

  /**
   * Keeps a Run's output with its block, replacing what the block kept before; it goes with its message, when a rewind removes the
   * message, and with its chat. The chat keeps its newest outputs up to `Resources.runOutputsKeptCharacters`, dropping the oldest saved; an output larger than that isn't saved, and its block keeps nothing.
   * @param output The output, with its chat, message, part and block.
   * @param transaction The transaction to work in, or none for its own.
   * @throws ServiceException named `ErrorCode.NotFound` when the chat does not exist, or the message isn't in it.
   */
  saveRunOutputAsync(output: RunOutput, transaction?: SqlTransaction): Promise<void>;

  /**
   * Marks or clears the conversation's need for a fresh provider session (set by a rewind, cleared by the next send).
   * @param conversationId The conversation id.
   * @param sessionReset The mark.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The conversation as stored.
   */
  setSessionResetAsync(conversationId: string, sessionReset: boolean, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * Records the forked session a rewind made (clearing the reset mark), or forgets it.
   * @param conversationId The conversation id.
   * @param forkedSession The forked session, or `null`.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The conversation as stored.
   */
  setForkedSessionAsync(conversationId: string, forkedSession: ForkedSession | null, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * Finds the conversations whose title or message texts contain a text (case-insensitively for ASCII): one hit per
   * conversation, the title when it matches and else the latest matching message with a snippet, the latest
   * conversation first.
   * @param params The text and the most hits.
   * @returns The hits.
   */
  searchAsync(params: ConversationSearchParams): Promise<ConversationSearchResult>;
  /**
   * Finds chats for the window's search: with a blank text the latest updated, else those whose title contains it
   * (case-insensitively for ASCII), the latest updated first, each with its teammates' names, and how many match in all.
   * @param params The text, possibly blank, and the most chats.
   * @returns The chats and their total.
   */
  findChatsAsync(params: ChatFindParams): Promise<ChatFindResult>;
  /**
   * Finds messages whose text details contain a text of at least 3 characters, case-insensitively, through the message text
   * index, the newest first, each with a snippet around the match, and how many match in all; a shorter text finds none.
   * @param params The text and the most messages.
   * @returns The messages and their total.
   */
  searchMessagesAsync(params: ConversationSearchParams): Promise<MessageSearchResult>;
}

/**
 * The message record: the `MessageList` method plus the reads and writes the engine needs. Writes
 * log to the change feed; the engine publishes the events.
 */
export interface IMessagesService {
  /**
   * Lists a conversation's messages in sequence order, optionally after a sequence.
   * @param params The conversation id and the sequence to start after, or `null` for all.
   * @param transaction The transaction to read in, or none.
   * @returns The messages with their details.
   */
  listAsync(params: MessageListParams, transaction?: SqlTransaction): Promise<readonly Message[]>;

  /**
   * Lists a conversation's messages in sequence order, optionally after a sequence, without their details,
   * which SQLite leaves out before the JSON is read.
   * @param conversationId The conversation's id.
   * @param afterSequence The sequence to start after, or `null` for all.
   * @param transaction The transaction to read in, or none.
   * @returns The messages, each with no details.
   */
  listOutlinesAsync(conversationId: string, afterSequence: number | null, transaction?: SqlTransaction): Promise<readonly Message[]>;

  /**
   * A page of a conversation's messages: the newest ones, the ones before a sequence, or the ones after one, read in one transaction.
   * @param params The conversation id, at most one cursor, and the limit.
   * @param transaction The transaction to read in, or none for its own.
   * @returns The messages in sequence order, and whether messages lie before the first and after the last.
   */
  pageAsync(params: MessagePageParams, transaction?: SqlTransaction): Promise<MessagePage>;

  /**
   * Lists a bounded page of matching provider replies without output or diff bodies, read in one transaction.
   * @param params Conversation, optional exclusive cursor, and page limit.
   * @param panel The panel whose replies to select.
   * @param transaction The transaction to read in, or none for its own.
   * @returns Matching summaries in descending sequence order and adjacent-page flags.
   */
  replyPageAsync(params: MessagePageParams, panel: ReplyPanel, transaction?: SqlTransaction): Promise<ReplyPage>;

  /**
   * Finds a message by id.
   * @param messageId The message id.
   * @param transaction The transaction to read in, or none.
   * @returns The message, or `null` when it does not exist.
   */
  findAsync(messageId: string, transaction?: SqlTransaction): Promise<Message | null>;

  /**
   * Finds the conversation's reply that is pending, running, or awaiting approval.
   * @param conversationId The conversation id.
   * @param transaction The transaction to read in, or none.
   * @returns The open reply, or `null` when there is none.
   */
  findOpenReplyAsync(conversationId: string, transaction?: SqlTransaction): Promise<Message | null>;

  /**
   * Finds the newest recorded native session for the requested kind and provider.
   * @param conversationId The conversation to search.
   * @param kind The kind identifier.
   * @param providerId The provider identifier, or null for the default provider.
   * @param transaction The transaction to read in, or none.
   * @returns The native session identifier, or null when no compatible session is recorded that the
   * provider hasn't forgotten.
   * @remarks Queries the database directly without loading transcript details.
   */
  findResumableSessionAsync(conversationId: string, kind: string, providerId: string | null, transaction?: SqlTransaction): Promise<string | null>;

  /**
   * Finds the context window the newest reply on a provider's kind and model reported, on any account of that kind.
   * @param providerId The provider identifier, whose kind is matched.
   * @param model The requested model, or null for the provider's default.
   * @param transaction The transaction to read in, or none.
   * @returns The window in tokens, or null when no reply on that provider's kind and model reported its context use.
   * @remarks Queries the database directly without loading transcript details.
   */
  findWindowTokensAsync(providerId: string, model: string | null, transaction?: SqlTransaction): Promise<number | null>;

  /**
   * Finds an attachment that one of a conversation's messages holds.
   * @param conversationId The conversation to search.
   * @param path The attachment's saved path.
   * @param transaction The transaction to read in, or none.
   * @returns The attachment's metadata, or null when no message of the conversation holds that path.
   * @remarks Queries the database directly without loading transcripts.
   */
  findAttachmentAsync(conversationId: string, path: string, transaction?: SqlTransaction): Promise<MessageAttachment | null>;
  /**
   * Reads the id of the checkpoint taken of the reply's folder before a reply.
   * @param messageId The reply's id.
   * @param transaction The transaction to read in, or none.
   * @returns The checkpoint's id, or `null` when none was taken or the reply is gone.
   */
  findCheckpointAsync(messageId: string, transaction?: SqlTransaction): Promise<string | null>;

  /**
   * Reads the id of the folder a reply's turn ran in, as `WorkFolder.id` named it.
   * @param messageId The reply's id.
   * @param transaction The transaction to read in, or none.
   * @returns The folder's id, or `null` when the turn never started, ran before the folder was kept, or the reply is gone.
   */
  findCheckpointFolderAsync(messageId: string, transaction?: SqlTransaction): Promise<string | null>;

  /**
   * Lists, for each teammate in each conversation, its latest reply that reports usage, while that reply is in the teammate's current session there.
   */
  listTeammateUsageAsync(): Promise<readonly TeammateUsage[]>;

  /**
   * Lists every reply still pending, running, or awaiting an approval, across conversations.
   */
  listOpenAsync(transaction?: SqlTransaction): Promise<readonly Message[]>;

  /**
   * Lists every message with a `SubAgent` detail still running, across conversations, whether or not the reply has ended.
   */
  listWithRunningSubAgentsAsync(transaction?: SqlTransaction): Promise<readonly Message[]>;

  /**
   * Returns the sequence the conversation's next message takes: `0` for the first.
   * @param conversationId The conversation id.
   * @param transaction The transaction to read in, or none.
   * @returns The next sequence.
   */
  nextSequenceAsync(conversationId: string, transaction?: SqlTransaction): Promise<number>;

  /**
   * Inserts a message and logs the insert.
   * @param message The message.
   * @param transaction The transaction to work in, or none for its own.
   */
  insertAsync(message: Message, transaction?: SqlTransaction): Promise<void>;

  /**
   * Replaces a message's stored form and logs the update.
   * @param message The message.
   * @param transaction The transaction to work in, or none for its own.
   */
  updateAsync(message: Message, transaction?: SqlTransaction): Promise<void>;
  /**
   * Records the id of the checkpoint taken of the reply's folder before a reply.
   * @param messageId The reply's id.
   * @param checkpointId The checkpoint's id.
   * @param transaction The transaction to work in, or none.
   */
  setCheckpointAsync(messageId: string, checkpointId: string, transaction?: SqlTransaction): Promise<void>;

  /**
   * Records the id of the folder a reply's turn runs in, at the turn's start, whether or not its checkpoint is then taken.
   * @param messageId The reply's id.
   * @param folderId The folder's `WorkFolder.id`.
   * @param transaction The transaction to work in, or none.
   */
  setCheckpointFolderAsync(messageId: string, folderId: string, transaction?: SqlTransaction): Promise<void>;
}

/**
 * A conversation's background tasks while TeamRun runs: the reports a reply's adapter makes, the
 * `BackgroundTaskList`, `BackgroundTaskRead` and `BackgroundTaskStop` methods, and the events that follow each change.
 */
export interface IBackgroundTasksService {
  /**
   * Records a running task for a reply and publishes it; a task the reply already reported stays as it is.
   * @param conversationId The `Conversation` id.
   * @param messageId The id of the reply that started the task.
   * @param kind The kind's id.
   * @param start The task's provider id, command line, and how to stop it.
   * @param teammateId The teammate whose reply started the task, so `stopTeammate` finds it; `null`, the default, for the default teammate's.
   * @returns The task, or `null` when the reply already reported it or the conversation was forgotten, whose task is stopped.
   */
  startAsync(conversationId: string, messageId: string, kind: string, start: TaskStart, teammateId?: string | null): Promise<BackgroundTask | null>;

  /**
   * Adds output to a running task, keeping the latest `Resources.maximumBackgroundTaskOutput`
   * characters, and publishes it; nothing for an unknown or ended task or empty text.
   * @param messageId The id of the reply that started the task.
   * @param taskId The provider's id of the task.
   * @param text The new output.
   */
  write(messageId: string, taskId: string, text: string): void;

  /**
   * Ends a running task with the reported status and exit code, and publishes it; nothing for an
   * unknown or ended task.
   * @param messageId The id of the reply that started the task.
   * @param end The task's provider id, status and exit code.
   */
  endAsync(messageId: string, end: TaskEnd): Promise<void>;

  /**
   * Lists a conversation's tasks: running ones newest first, then ended ones by their end, newest
   * first, each with its output left out, so a chat of many tasks fits one answer.
   * @param params The conversation.
   * @returns The tasks.
   */
  listAsync(params: ConversationIdParams): Promise<readonly BackgroundTask[]>;

  /**
   * Lists one page of a conversation's tasks for a window: on the first page every running task,
   * then its finished commands in `listAsync`'s order, at most `limit` a page, each with its command
   * cut to `Resources.maximumListedCommand` characters, so a page fits one answer however many
   * tasks the conversation holds; a finished sub-agent is left out.
   * @param params The conversation, the finished task the page starts after, or `null`, and the limit.
   * @returns The page, with how many finished commands the conversation holds; an empty page when
   * the task it starts after is gone.
   */
  pageAsync(params: BackgroundTaskListParams): Promise<BackgroundTaskPage>;

  /**
   * Reads one task of a conversation already listed, with its output, which comes from the store
   * for a task of an earlier run.
   * @param params The task.
   * @returns The task.
   * @throws ServiceException with `NotFound` for an unknown task.
   */
  readAsync(params: BackgroundTaskIdParams): Promise<BackgroundTask>;

  /**
   * Stops a running task through its provider, then waits for the provider to report the end, at
   * most `Resources.backgroundTaskStopWait`; an ended task is returned as it is. A stop already under way,
   * such as a teammate's, is waited on rather than sent to the provider again.
   * @param params The task.
   * @returns The task after the stop.
   * @throws ServiceException with `ErrorCode.NotFound` for an unknown task, and with
   * `ErrorCode.ProviderError` and the provider's reason when it refuses the stop.
   */
  stop(params: BackgroundTaskIdParams): Promise<BackgroundTask>;

  /**
   * Forgets a conversation's finished tasks, keeping its running ones, and publishes
   * `BackgroundTasksCleared` when it forgot any; a task its provider reports again stays forgotten.
   * @param params The conversation.
   * @returns The conversation and the ids of the tasks forgotten.
   */
  clearFinishedAsync(params: ConversationIdParams): Promise<BackgroundTasksClearedPayload>;

  /**
   * Forgets every task of deleted conversations, leaving them to their providers.
   * @param conversationIds The deleted conversations.
   */
  forget(conversationIds: readonly string[]): void;

  /**
   * Stops, through its provider, each running task a teammate's replies started, in one conversation or in every one, without waiting; each
   * shows `Stopped` once its provider reports the end, and a stop the provider refuses leaves its task running and is logged.
   * @param teammateId The teammate, removed from the conversation or deleted.
   * @param conversationId The conversation it left; `null` for every conversation, when the teammate is deleted.
   */
  stopTeammate(teammateId: string, conversationId: string | null): void;
}

/**
 * TeamRun's open windows, most recently focused first, with the chat each one's middle area shows, and the panel requests
 * the `teamrun_open_panel` and `teamrun_close_panel` tools send them. Noldova Desktop gives a window part no window id, and every
 * window calls the runtime as the app's main process, so each window part makes its own id and reports itself.
 */
export interface IWindowsService {
  /**
   * Keeps a window's shown chat: a focused window goes first, a window that isn't focused keeps its place, and one it doesn't know
   * yet joins last. A window left out for not answering is taken back.
   * @param params The window, its shown chat and whether it has the focus.
   */
  focus(params: WindowFocusedParams): void;

  /**
   * Drops a window, and a request waiting on it asks the next window; nothing for one it doesn't know.
   * @param params The window.
   */
  close(params: WindowIdParams): void;

  /**
   * Takes a window's answer to a panel request, and takes the window back if it was left out for not answering; an answer to a
   * request no longer waiting does nothing more.
   * @param params The request, the window and the outcome.
   */
  answer(params: PanelAnsweredParams): void;

  /**
   * Asks the window part with this id to load again what it failed to load, by publishing `WindowReloadRequested`; any id is
   * passed on, since only the window part it names acts.
   * @param params The window part.
   */
  reload(params: WindowIdParams): void;

  /**
   * Tells whether any open window shows the chat in its middle area.
   * @param conversationId The chat.
   * @returns True when a window last reported it as its shown chat.
   */
  isShown(conversationId: string): boolean;

  /**
   * Calls the listener each time a window reports that it shows a chat, even the one it showed before.
   * @param listener Takes the chat shown.
   * @returns Stops the calls.
   */
  onShown(listener: (conversationId: string) => void): () => void;

  /**
   * Asks one window to open or close a panel: the most recently focused window that shows the caller's chat, else the most
   * recently focused window. It publishes `PanelRequested` and waits for the window's `PanelAnswered`, at most
   * `Resources.panelAnswerWait`; a window that doesn't answer in time is left out until it answers or reports itself again, and
   * the request fails rather than asking another window, which could open the panel twice. A window that closes while asked
   * passes the request to the next.
   * @param panel The panel.
   * @param conversationId The chat to open or close, for `PanelName.Chat` only; null for every other panel.
   * @param open Whether to open the panel; false closes it.
   * @param callerConversationId The chat of the teammate that asked, or null.
   * @param signal Withdraws the request.
   * @returns The id of the window that acted.
   * @throws ServiceException with `ErrorCode.NotFound` for an unknown chat; with `ErrorCode.Conflict` and `Resources.panelRefused`
   * when the window refuses; and with `ErrorCode.Unavailable` and `Resources.panelFailed` when it fails,
   * `Resources.windowDidNotAnswer` when it, or every window left, doesn't answer, or `Resources.noWindowOpen` when no window is open.
   * @throws ArgumentException when `conversationId` is null for `PanelName.Chat` or given for another panel, before any window is
   * asked.
   */
  requestAsync(panel: PanelName, conversationId: string | null, open: boolean, callerConversationId: string | null, signal?: AbortSignal): Promise<string>;
}

/**
 * The approval record: the `ApprovalList` method plus the reads and writes the engine needs.
 */
export interface IApprovalsService {
  /**
   * Lists pending approvals across every conversation, ordered by identifier.
   * @param transaction The transaction to read in; the connection when left out.
   * @returns The pending approvals.
   */
  listPendingAllAsync(transaction?: SqlTransaction): Promise<readonly Approval[]>;

  /**
   * Lists the answered cards of posted questions whose answer the engine hasn't sent yet, ordered by identifier.
   * @param transaction The transaction to read in; the connection when left out.
   * @returns The approvals.
   */
  listUnsentAnswersAsync(transaction?: SqlTransaction): Promise<readonly Approval[]>;

  /**
   * Lists a conversation's pending approvals and its `Question` approvals of any status, oldest first.
   * @param params The conversation id.
   * @returns The approvals.
   */
  listAsync(params: ConversationIdParams): Promise<readonly Approval[]>;

  /**
   * Finds an approval by id.
   * @param approvalId The approval id.
   * @param transaction The transaction to read in; the connection when left out.
   * @returns The approval, or `null` when it does not exist.
   */
  findAsync(approvalId: string, transaction?: SqlTransaction): Promise<Approval | null>;

  /**
   * Lists a message's pending approvals, oldest first.
   * @param messageId The message id.
   * @param transaction The transaction to read in; the connection when left out.
   * @returns The pending approvals.
   */
  listPendingAsync(messageId: string, transaction?: SqlTransaction): Promise<readonly Approval[]>;

  /**
   * Inserts an approval and logs the insert, in one transaction.
   * @param approval The approval.
   * @param transaction The transaction to work in; a new one when left out.
   */
  insertAsync(approval: Approval, transaction?: SqlTransaction): Promise<void>;

  /**
   * Replaces an approval's stored form and logs the update, in one transaction.
   * @param approval The approval.
   * @param transaction The transaction to work in; a new one when left out.
   */
  updateAsync(approval: Approval, transaction?: SqlTransaction): Promise<void>;
}

/**
 * The provider methods of the catalog over TeamRun's record and the registered adapters.
 */
export interface IProvidersService {
  /**
   * Lists the providers by kind, then by label, in `NameOrder`; ties keep the oldest first.
   * @returns The providers.
   */
  listAsync(transaction?: SqlTransaction): Promise<readonly Provider[]>;

  /**
   * Finds a provider by id.
   * @param providerId The provider id.
   * @returns The provider, or `null` when it does not exist.
   */
  findAsync(providerId: string, transaction?: SqlTransaction): Promise<Provider | null>;

  /**
   * Finds the provider added in a kind's usual folder, the folder its tooling uses on this computer when no provider names one, as
   * `ProfileFolderPath.isSame` compares them.
   * @param kind The provider kind.
   * @returns The first such provider, or `null` when none is added there or the kind names no usual folder.
   */
  findUsualAsync(kind: string, transaction?: SqlTransaction): Promise<Provider | null>;

  /**
   * Creates a provider for a profile directory the provider tooling will own; the sign-in status
   * starts unknown. Without a directory, it makes a new, empty one, private to the person, at
   * `profiles/<kind>/<name>` in the data directory, in the same transaction as the provider, and has the kind's `prepareProfile` ready
   * it; when that throws, the folder is removed and the error passes on. A directory the person chose that is empty gets the same
   * `prepareProfile`, and is kept when it throws. The
   * name is the label with `<>:"/\|?*` and control characters as `-`, without leading or trailing
   * dots and spaces, cut to 60 characters, and with `_` before a name Windows reserves, such as
   * `CON`.
   * @param params The kind, the label, and the absolute profile directory or `null`.
   * @returns The provider.
   * @throws ServiceException named `ErrorCode.NotFound` when the kind is not registered,
   * `ErrorCode.InvalidParams` when the directory is not absolute or the label leaves no folder name,
   * and `ErrorCode.Conflict`, with the directory as its argument, when another provider already uses the directory, compared as
   * `ProfileFolderPath` compares folders, or when the new directory already exists, and, with the kind's
   * `singleAccount` as its message and the kind as its argument, when the kind has a `singleAccount` and a provider of it exists;
   * and whatever the kind's `prepareProfile` throws.
   */
  createAsync(params: ProviderCreateParams): Promise<Provider>;

  /**
   * Changes a provider's label and profile directory, and switches its own MCP servers when the parameters say so, keeps its
   * id and provider so its teammates keep it, and publishes `ProviderUpdated`; a new profile directory clears the last
   * sign-in check and forgets the provider sessions kept in the old one; a new directory that is empty gets the kind's `prepareProfile`.
   * It also sets or clears the server path the parameters name, which the runtime takes only from the app's main process.
   * @param params The provider id, the label, the absolute profile directory, the own servers' switch or `null`, and the server path or `null`.
   * @returns The updated provider.
   * @throws ServiceException named `ErrorCode.NotFound` when the provider does not exist,
   * `ErrorCode.InvalidParams` when the directory or a server path is not absolute, a server path names a kind without
   * `choosesServerPath`, or the switch turns on the servers of a kind whose
   * `ownMcpServersUnavailable` says why they can't be, with that reason as the message, and `ErrorCode.Conflict` when the
   * directory changes while a reply on the provider is open, or, with the directory as its argument, when another provider already uses
   * the directory, compared as `ProfileFolderPath` compares folders; and whatever the kind's `prepareProfile` throws, with the provider
   * left as it was.
   */
  updateAsync(params: ProviderUpdateParams): Promise<Provider>;

  /**
   * Enables or disables a provider, keeps its row, folder and settings, and publishes
   * `ProviderUpdated`; disabling it stops its running sign-in.
   * @param params The provider id and whether it is enabled.
   * @returns The updated provider.
   * @throws ServiceException named `ErrorCode.NotFound` when the provider does not exist.
   */
  setEnabledAsync(params: ProviderEnabledParams): Promise<Provider>;

  /**
   * Runs the adapter's sign-in check, records what it observed on the provider as it is when the
   * check ends, and publishes `ProviderUpdated`; a check of a profile directory that was
   * changed while it ran, or of a provider that started signing out while it ran, is dropped, and
   * a provider isn't checked in the profile directory it is signing out of, since its sign-out checks it when it ends.
   * @param params The provider id.
   * @returns The checked provider, or the provider as it is when its check was dropped or skipped.
   * @throws ServiceException named `ErrorCode.NotFound` when the provider does not exist, also
   * when it was deleted while the check ran, and `ErrorCode.Unavailable` when it is disabled.
   */
  checkAsync(params: ProviderIdParams): Promise<Provider>;

  /**
   * Lists a provider's own MCP servers by name and state, through its adapter, for the MCP servers panel.
   * @param params The provider id.
   * @returns The servers; `servers` is `null` for a kind that offers no list.
   * @throws ServiceException named `ErrorCode.NotFound` when the provider does not exist.
   */
  listOwnMcpServersAsync(params: ProviderIdParams): Promise<ProviderMcpServerList>;

  /**
   * Runs the adapter's sign-in for the provider, for at most the service's sign-in timeout, then
   * checks the provider as `checkAsync` does. A cancel, the signal, deleting the provider or the timeout
   * stops it; one that comes after the adapter's sign-in finished still checks the provider. A page
   * the adapter asks to open is published as `SignInLink`.
   * Publishes `ProviderSignInsChanged` when the sign-in starts, and when it ends, after that
   * check.
   * @param params The provider id.
   * @param signal Stops the sign-in when it aborts, as a cancel does.
   * @returns The checked provider, or the provider as it is when the sign-in was cancelled.
   * @throws ServiceException named `ErrorCode.NotFound` when the provider does not exist,
   * `ErrorCode.Unavailable` when it is disabled, its provider can't start a sign-in or the sign-in timed out, and
   * `ErrorCode.Conflict` when the provider is already signing in; the adapter's own failure
   * otherwise.
   */
  signInAsync(params: ProviderIdParams, signal?: AbortSignal): Promise<Provider>;
  /** The command the provider's agent signs in with in a terminal, `null` when it has none. */
  readSignInCommandAsync(params: ProviderIdParams): Promise<ProviderSignInCommand | null>;

  /**
   * Cancels the provider's running sign-in; does nothing when none runs.
   * @param params The provider id.
   */
  cancelSignIn(params: ProviderIdParams): void;

  /**
   * Signs the provider's profile out through its adapter, then runs the sign-in check and records what it observed, so the
   * provider reads signed out, also after the adapter fails or times out; a check that reads it signed out counts as done.
   * A provider disabled meanwhile is recorded `AuthStatus.Unknown` unchecked, and one moved to another folder meanwhile is left
   * unchecked, as its move already recorded it.
   * @param params The provider id.
   * @returns The checked provider, or the provider as it is when it was disabled or moved meanwhile.
   * @throws ServiceException named `ErrorCode.NotFound` when the provider does not exist, `ErrorCode.Unavailable` when it is
   * disabled, its provider can't sign out or the check still reads it signed in, which it records, and `ErrorCode.Conflict` when it
   * is signing in or already signing out; the adapter's own failure when the check after it doesn't read the provider signed out,
   * and the check's failure after a sign-out that didn't fail.
   */
  signOutAsync(params: ProviderIdParams): Promise<Provider>;

  /**
   * Lists the providers whose sign-in runs now, in the order the sign-ins started, so a window that
   * reloaded or opened later can show and cancel them.
   * @returns The running sign-ins.
   */
  listSignIns(): ProviderSignIns;

  /**
   * Looks for profile folders of the given kinds that no provider uses yet: each folder a kind's `profileSearch` names, the folders
   * beside it whose names start with its name, and the kind's folders in TeamRun's own profiles folder. A folder counts only when it
   * holds one of the kind's entry names, and no file in it is opened. Each folder found gets the kind's `checkFoundSignIn`, which reaches
   * no provider's service, never its full `checkSignIn`; a kind without one lists its folders with `AuthStatus.Unknown`, and one whose
   * check fails is listed with `AuthStatus.Error`. A call for the
   * same kinds while one runs gets that one's result; each call leaves out the folders a provider took while the search ran.
   * @param params The kinds to look for, or `null` for every registered kind.
   * @returns The folders found, in the kinds' order, each kind's usual folder first and the rest by label.
   * @throws ServiceException with `NotFound` when a kind isn't registered.
   */
  discoverAsync(params: ProviderProfileDiscoverParams): Promise<ProviderProfileDiscovery>;

  /**
   * Forgets a provider, stopping its sign-in if one runs; the profile directory is left in place.
   * In the same transaction it forgets the default teammate's provider when it is this one, and removes the provider's Sustain entries from
   * every teammate's `fallbacks`, each changed teammate going out on the change feed.
   * @param params The provider id.
   * @throws ServiceException named `ErrorCode.NotFound` when the provider does not exist.
   */
  deleteAsync(params: ProviderIdParams): Promise<void>;

  /**
   * Reads whether the person has finished or skipped the first launch.
   */
  readFirstLaunchAsync(transaction?: SqlTransaction): Promise<FirstLaunch>;

  /**
   * Records that the person finished or skipped the first launch, keeping the first time it was recorded.
   */
  finishFirstLaunchAsync(): Promise<FirstLaunch>;
}

/**
 * The provider methods of the catalog over the registered adapters.
 */
export interface IProviderKindsService {
  /**
   * Lists the registered kinds, each saying whether it can name a chat.
   * @returns Their descriptors.
   */
  list(): readonly ProviderKind[];

  /**
   * Lists the models a provider reports, optionally through a provider of that provider.
   * @param params The kind and the optional provider id.
   * @returns The model names.
   * @throws ServiceException named `ErrorCode.NotFound` when the kind is not registered or the
   * provider does not exist, and `ErrorCode.InvalidParams` when the provider belongs to another
   * provider.
   */
  listModelsAsync(params: ProviderListModelsParams): Promise<readonly string[]>;

  /**
   * Returns provider-discovered models and their reported capabilities, with whether the provider's
   * answer says it is signed in.
   */
  modelCatalogAsync(params: ProviderListModelsParams): Promise<ProviderModelList>;

  /**
   * Lists the providers TeamRun installs at once, each with where its installation stands and the versions last read, and reads each one's
   * versions again in the background unless it is installing or already reading them, publishing `EventName.ProviderKindInstallationChanged`
   * when a read ends; a read that fails keeps the versions it had.
   */
  listInstallations(): Promise<readonly ProviderKindInstallation[]>;

  /**
   * Finds each provider's command-line tool afresh, one entry per kind that has one, all checked at once.
   */
  listTools(): Promise<readonly ProviderTool[]>;

  /**
   * Installs a provider, updates an installed one that has an update, or joins the install already running for it, so every window's request ends
   * with the same result.
   * `ProviderKindInstallationChanged` is published when it starts, at each whole percent, and when it ends.
   * @returns The provider once the install ends: `Installed`, or `NotInstalled` when it was cancelled.
   * @throws ServiceException named `ErrorCode.NotFound` when the kind is not registered, and `ErrorCode.Unavailable` when TeamRun doesn't
   * install it, this computer can't, or the install fails; a failure's reason stays on the provider's `NotInstalled` state, or on its `Installed`
   * state when an update failed, until an install succeeds.
   */
  install(params: ProviderKindParams): Promise<ProviderKindInstallation>;

  /**
   * Stops the provider's running install, if any, for every request that joined it, unless the install can no longer be stopped.
   * @throws ServiceException named `ErrorCode.NotFound` when the kind is not registered, and `ErrorCode.Unavailable` when TeamRun doesn't
   * install it.
   */
  /** Whether the kind has an install running. */
  isInstalling(kind: string): boolean;
  cancelInstall(params: ProviderKindParams): void;

  /**
   * Asks a provider for its plan use now, keeps it and publishes it, unless a read that began later is already kept.
   * @param params The kind and provider.
   * @returns The plan use kept, or `null` when the provider reports none or is disabled, which reads nothing.
   * @throws ServiceException named `ErrorCode.NotFound` when the kind or provider is unknown, and `ErrorCode.InvalidParams` when the provider
   * belongs to another kind.
   */
  readPlanUsageAsync(params: PlanUsageParams): Promise<PlanUsage | null>;
}

/**
 * The message methods that involve a provider: `MessageSend`, `MessageCancel`, and
 * `ApprovalDecide`.
 */
export interface IConversationEngine {
  /**
   * Copies one bounded input into runtime-owned transient storage for a later send.
   */
  prepareAttachment(input: AttachmentInput): MessageAttachment;

  /**
   * Copies a file the runtime part redeemed by the input's grant, from its open handle, into runtime-owned transient storage for a later send.
   * @param input The granted input.
   * @param source The granted file, open; the caller closes it.
   * @returns The prepared attachment's metadata.
   */
  prepareOpenedAttachmentAsync(input: AttachmentInput, source: IOpenedFile): Promise<MessageAttachment>;

  /**
   * Refuses a send's requested mode unless the same kind and mode are the chat's chosen responder's or the default teammate's, so a client
   * other than TeamRun's window can't choose the mode a reply runs in; a send that asks for no mode passes.
   * @param params The send, as a client other than the window's process sent it.
   * @throws ServiceException `Unauthorized` when the mode is refused, with `Resources.unchosenModeRefused` and the kind and mode.
   */
  refuseRaisedModeAsync(params: MessageSendParams): Promise<void>;

  /**
   * Deletes only a transient preparation; never deletes a committed message attachment.
   */
  discardAttachment(attachment: MessageAttachment): void;

  /**
   * Reads the bytes of one of a conversation's attachments: one its messages hold, or one its saved draft holds.
   * @param params The conversation and the attachment's path.
   * @param draft The conversation's saved draft, or `null`.
   * @returns The attachment's name, media type, size and base64 bytes.
   * @throws ServiceException `ErrorCode.NotFound` when neither holds the path, or its file is gone or changed;
   * `ErrorCode.TooLarge` above `maximumAttachmentReadBytes`.
   */
  readAttachmentAsync(params: AttachmentReadParams, draft: Draft | null): Promise<AttachmentContent>;

  /**
   * Finds one of a conversation's attachments, one its messages hold or one its saved draft holds, with the checks `readAttachmentAsync` makes
   * but without reading its bytes, so the runtime part can share the file with a window's page.
   * @param params The conversation and the attachment's path.
   * @param draft The conversation's saved draft, or `null`.
   * @returns The attachment, with its path resolved to the file's real path in the store.
   * @throws ServiceException `ErrorCode.NotFound` when neither holds the path, or its file is gone, changed or reached through a link the store refuses.
   */
  locateAttachmentAsync(params: AttachmentReadParams, draft: Draft | null): Promise<MessageAttachment>;

  /**
   * Says whether the saved file of one of a conversation's message attachments is still there, as a regular file, as `AttachmentStore.exists` reads it.
   * @param params The conversation and the attachment's path.
   * @returns `true` while the file is there, or `false` once it was moved or deleted, or when it is reached through a link the store refuses.
   * @throws ServiceException `ErrorCode.NotFound` when none of the conversation's messages holds the path.
   */
  hasAttachmentAsync(params: AttachmentReadParams): Promise<boolean>;

  /**
   * Says which of the paths a reply links to are folders on this computer, so the window shows a folder rather than asking to open it as a file.
   * @param params The paths, as the window resolved them from the reply's links.
   * @returns The paths that are folders, in the order given; a path that isn't absolute, names a network share or holds a control character is
   * never looked at, and one that is gone, can't be read, is a file or doesn't answer within the folder probe's deadline is left out. Each path
   * is read through the projects' folder probe, off Core's thread.
   */
  listLinkedFolders(params: LinkedPaths): Promise<LinkedPaths>;

  /**
   * Reads the bytes of an image file a reply wrote in its conversation's project, as `WrittenImageReader` finds it in that reply, or one
   * the reply's Markdown draws or links to there, as `WrittenImageReader.markdownImagePathsOf` and `markdownLinkImagePathsOf` find it,
   * or of a generated image the reply saved there, as `WrittenImageReader.generatedPathOf` finds it, or of the copy of a generated image
   * Core stored in its data folder's `images` folder, as `WrittenImageReader.storedPathOf` finds it.
   * @param params The conversation, the reply and the file's path.
   * @returns The file's name, media type, size and base64 bytes.
   * @throws ServiceException `ErrorCode.NotFound` when the conversation, its project or the reply is missing, the reply didn't write,
   * draw, link, save or store the path, or `ProjectImageReader` refuses the file, such as a missing file or one whose bytes aren't an
   * image, read within the project folder or, for a stored copy, within the `images` folder; `ErrorCode.TooLarge` above
   * `maximumAttachmentReadBytes`.
   */
  readWrittenImageAsync(params: WrittenImageReadParams): Promise<AttachmentContent>;

  /**
   * Finds a written image as `readWrittenImageAsync` does, and readies it for a share with a window's page: a copy Core stored in its `images`
   * folder is shared as it is, and a project file as a copy of the checked bytes in the data folder's `shared-images` folder.
   * @param params The conversation, the reply and the file's path.
   * @returns The image, its path the file to share.
   * @throws ServiceException as `readWrittenImageAsync` does, `ErrorCode.NotFound` for an SVG image, and `ErrorCode.TooLarge` when the copies
   * shared within a share's lifetime leave no room for it.
   */
  locateWrittenImageAsync(params: WrittenImageReadParams): Promise<MessageAttachment>;

  /**
   * Stores the user message and all pending replies atomically, then executes replies in responder order.
   * Mentions override the selected responder and join non-members; unavailable named responders are skipped. A teammate's send
   * keeps its sender's own name among its mentions but never starts or joins that teammate, and a responder that is its sender starts
   * no one. When it names no one else and gives no responder or settings, the target chat's chosen responder answers: a chosen teammate
   * when it still exists, is a member and isn't the sender; a chosen default teammate, with its provider, model, effort and provider,
   * when the provider is registered, the chosen provider still exists on that provider, and the sender isn't that chat's own default
   * teammate; a chosen default teammate with no provider starts no one.
   * Otherwise the message is posted and no one starts. A default teammate's send has a `MessageSender` with no teammate id, under its
   * provider's display name. A teammate's reply runs in the permission mode its membership of the chat chose, when its provider lists it,
   * and in the teammate's own mode otherwise, a hand-off's reply included.
   * @param params The message, attachment inputs, resolved mentions and responder selection.
   * @returns The stored message and zero or more pending replies, updated through events.
   * @throws ServiceException named `ErrorCode.NotFound` when the conversation, its project, the
   * kind, or the provider does not exist; `ErrorCode.Conflict` while the conversation has an
   * open reply, unless a teammate's turn sends it; `ErrorCode.InvalidParams` when the provider belongs to another kind,
   * `ErrorCode.Unavailable` when a teammate who would reply, or the chosen provider, is on a disabled provider, which stores
   * nothing; a teammate's hand-off skips such a teammate instead, and `ErrorCode.Unauthorized` when `senderToken` names no running teammate turn,
   * or when a send with it asks for one of its kind's unrestricted modes, which only the person chooses.
   * A send with a sender token first asks the person through the sending turn's approval, `teamrun.sendMessage` at medium risk with Allow once
   * and Deny, naming the chat, whose reply it starts and the text, unless the sending turn's mode is unrestricted; it then works out who it
   * starts again and sends only when that is unchanged.
   * @param signal Ends the wait for the person's answer, which then sends nothing; the sending turn's end ends it too.
   * @throws ServiceException named `ErrorCode.Unauthorized` also when the person denies the send, or the wait ends before an answer, and
   * `ErrorCode.Conflict` when who it starts changed before the person allowed it; each sends nothing.
   */
  sendAsync(params: MessageSendParams, signal?: AbortSignal): Promise<MessageSendResult>;

  /**
   * Cancels one reply of an active send. A working reply stops, its mentions start no one, and the
   * next waiting reply starts; a waiting reply is cancelled at once and leaves the queue. A reply whose turn has ended while its
   * sub-agents still run is cancelled too: its approvals are cancelled, its sub-agents with a task are stopped, and those without one show
   * Stopped; a refused stop leaves that sub-agent running and the reply cancellable, so a later cancel tries it again.
   * @param params The reply's id.
   * @returns The reply once it has ended, or, for a reply whose turn had already ended, once its stops were asked for; the send's other
   * replies keep their turn.
   * @throws ServiceException named `ErrorCode.NotFound` when the message does not exist, `ErrorCode.Conflict` when it is neither an open
   * reply of an active send nor a reply whose work outlives its turn, and `ErrorCode.ProviderError` with the reason when a sub-agent's stop
   * is refused.
   */
  cancelAsync(params: MessageIdParams): Promise<Message>;

  /**
   * Approves the plan a plan-first reply ended with: appends the plan text, approved, to the reply, records that its member's plan is approved, and
   * sends "Go ahead with the plan." to the same responder in its usual mode, as the person.
   * @param params The reply's id.
   * @returns The send's result.
   * @throws ServiceException named `ErrorCode.NotFound` when the message does not exist, `ErrorCode.Conflict` when its plan doesn't wait for
   * approval or a later message follows the reply, and any error `sendAsync` throws; when the send is refused before any message is sent, the plan
   * is left waiting for approval.
   */
  approvePlanAsync(params: MessageIdParams): Promise<MessageSendResult>;

  /**
   * Cancels every open reply of the conversation's active send: the working reply stops and the
   * waiting ones are cancelled before they start.
   * @param params The conversation.
   * @returns After the send has settled, the replies still open when this Stop began, or that joined the send after it began, such as
   * a hand-off's or another chat's teammate's, that ended cancelled and that no Stop which settled earlier has listed. A reply that
   * had already ended, that an earlier Stop is still ending, or that completed before the Stop reached it is left out, so each
   * reply is listed by one Stop at most; of two chat Stops that overlap, such as the window's and `teamrun cancel`, the second
   * answers with none of the replies the first is ending.
   * @throws ServiceException named `ErrorCode.Conflict` when the conversation has no active send.
   */
  cancelConversationAsync(params: ConversationIdParams): Promise<readonly Message[]>;

  /**
   * Adds a person's message to the chat's waiting messages and publishes `WaitingMessagesChanged`. Stop and send stops the chat's
   * running replies; otherwise, when the chat has no running reply, the waiting messages go at once. They go one at a time, through
   * `sendAsync`, once the chat has no running reply, after any answers to its questions: Stop and send ones first, then the others in the
   * order they were added. A send that fails keeps the message with its failure, and the next goes. They are kept in
   * the database: after a restart, `reconcileAsync` sends them.
   * A Steer message goes into a running reply once its turn offers a steer through `ITurnListener.onSteerable`, one at a time per chat:
   * the reply of a teammate it names, or any running reply when it names none. Taken, it leaves the waiting messages and is kept in the
   * chat as a person's message whose `Text` detail names that reply in `Resources.steeredIntoField`, with its files copied as a sent
   * message's; refused, or with a file that can't be copied, it waits as Queue. Until a reply offers a steer, it waits like Queue.
   * A message from outside goes only after `refuseRaisedModeAsync` passes its send again, so a mode the person changed since it was
   * added refuses it, kept with that failure.
   * @param params The send and how it goes.
   * @param fromOutside Whether a client other than TeamRun's window added it; by default, it didn't.
   * @returns The waiting message, as added.
   * @throws ServiceException named `ErrorCode.NotFound` for an unknown chat.
   */
  addWaitingAsync(params: WaitingMessageAddParams, fromOutside?: boolean): Promise<WaitingMessage>;

  /**
   * Lists the chat's waiting messages in the order they go.
   * @param params The chat.
   * @returns The chat's waiting messages.
   * @throws ServiceException named `ErrorCode.NotFound` for an unknown chat.
   */
  listWaitingAsync(params: ChatIdParams): Promise<WaitingMessagesPayload>;

  /**
   * Replaces a waiting message's send, keeping its place and clearing its failure, publishes `WaitingMessagesChanged`, and sends the
   * chat's waiting messages when it has no running reply.
   * @param params The waiting message and its new send.
   * @param fromOutside Whether a client other than TeamRun's window edited it, which makes it a message from outside, as
   * `addWaitingAsync` says; by default, the window did, and a message from outside stays one, since the edit keeps its mode.
   * @returns The edited waiting message.
   * @throws ServiceException named `ErrorCode.NotFound` for an unknown waiting message, or `ErrorCode.InvalidParams` for a send to
   * another chat.
   */
  editWaitingAsync(params: WaitingMessageEditParams, fromOutside?: boolean): Promise<WaitingMessage>;

  /**
   * Removes a waiting message and publishes `WaitingMessagesChanged`.
   * @param params The waiting message.
   * @throws ServiceException named `ErrorCode.NotFound` for an unknown waiting message.
   */
  removeWaitingAsync(params: WaitingMessageIdParams): Promise<void>;

  /**
   * Makes a waiting message Stop and send, clearing its failure, publishes `WaitingMessagesChanged`, and stops the chat's running
   * replies, or sends it when there are none.
   * @param params The waiting message.
   * @returns The waiting message, as Stop and send.
   * @throws ServiceException named `ErrorCode.NotFound` for an unknown waiting message.
   */
  sendWaitingNowAsync(params: WaitingMessageIdParams): Promise<WaitingMessage>;

  /**
   * Sets or clears the chat's chosen responder, as `IConversationsService.setResponderAsync` does, and keeps the last mode chosen
   * for each provider kind of the chat, which TeamRun's tools follow in a turn of the chat's own settings and its wakes: a
   * later choice of a teammate or of another kind leaves it, and the tools take the stricter of it and the turn's starting mode.
   * @param params The conversation id, the chosen responder, or `null` to clear the choice, and whether the person chose it.
   * @returns The conversation with its chosen responder.
   * @throws ServiceException as `IConversationsService.setResponderAsync` does.
   */
  setResponderAsync(params: ConversationResponderParams): Promise<Conversation>;

  /**
   * Drops the modes, the noted shared MCP server failures and the stopped commands kept for deleted chats.
   * @param conversationIds The deleted chats' ids.
   */
  forgetAsync(conversationIds: readonly string[]): Promise<void>;

  /**
   * Drops the stopped commands kept to tell a teammate's next turn, in one chat or in every one.
   * @param teammateId The teammate, removed from the chat or deleted.
   * @param conversationId The chat it left; `null` for every chat, when the teammate is deleted.
   */
  forgetTeammate(teammateId: string, conversationId: string | null): void;

  /**
   * Tells each provider whose plan mode the chat now plans first in the native sessions of the chat's replies it still runs, such as one whose
   * background task runs on, so a query the provider keeps open for them is back in its plan mode before a turn it starts on its own.
   * @param conversationId The chat whose Plan first was turned on.
   * @returns When every such provider has been told.
   */
  planFirstAsync(conversationId: string): Promise<void>;

  /**
   * Decides a pending approval by one of its options, records it, publishes `ApprovalUpdated`, and
   * lets the waiting turn continue. A `Question` approval's Answer carries the answers; the turn gets
   * them all, and the record keeps only the answers to questions that aren't secret. A question posted
   * through `ITurnListener.onQuestionsPosted` has no waiting turn: its Answer becomes the teammate's
   * next message in the chat, sent once the chat has no open reply, and its Skip only closes the card.
   * @param params The approval, the option and, for Answer, the answers.
   * @returns The decided approval.
   * @throws ServiceException named `ErrorCode.NotFound` when the approval does not exist,
   * `ErrorCode.Conflict` when it is already decided, and `ErrorCode.InvalidParams` when the option
   * is not offered, or when answers come with any option but a `Question` approval's Answer, Answer
   * comes without them, or they don't fit its questions: each answer names a question once, picks
   * only its options' labels, picks one at most unless it takes several, and has text only when
   * it takes its own answer.
   */
  decideAsync(params: ApprovalDecideParams): Promise<Approval>;

  /**
   * Removes a message and everything after it, marks the conversation for a fresh provider session, and optionally
   * restores the project's files.
   * @param params Which message to cut from and whether to restore files.
   * @returns The conversation as marked, the ids removed, and how many files the restore changed.
   */
  rewindAsync(params: ConversationRewindParams): Promise<ConversationRewindResult>;

  /**
   * Deletes the own folder of a conversation that is gone or now has a project, after the checkpoints module deletes that folder's
   * checkpoints. A folder whose checkpoints are held up by an interrupted restore, or that the system refuses to delete, is kept and
   * logged, for the next `sweepFoldersAsync`. Never rejects.
   * @param conversationId The conversation id.
   */
  releaseFolderAsync(conversationId: string): Promise<void>;

  /**
   * Releases, as `releaseFolderAsync` does, every own folder in the data folder whose conversation is gone or now has a project; the
   * runtime runs it at its start. It releases no further folder once the signal aborts. Never rejects.
   * @param signal Aborts when the sweep should stop, such as when the runtime part deactivates.
   */
  sweepFoldersAsync(signal: AbortSignal): Promise<void>;

  /**
   * Lists the tools of a running turn, for TeamRun's MCP endpoint: a provider session's token reaches only the turn it was issued for.
   * @param params The provider session's token.
   * @param signal Aborts the listing.
   * @returns MCP tool objects.
   * @throws ServiceException `Unauthorized` for a token the engine didn't issue or no longer holds; `Unavailable` while the member
   * has no running turn.
   */
  listMcpToolsAsync(params: McpToolListParams, signal?: AbortSignal): Promise<readonly JsonObject[]>;

  /**
   * Calls a tool in the agent session of a running turn, which a token reaches as `listMcpToolsAsync` says.
   * @param params The provider session's token, the tool's name and its arguments.
   * @param signal Withdraws the call.
   * @returns The MCP `tools/call` result: `isError` with `Denied` for a token the engine didn't issue or no longer holds, with
   * `Unavailable (teamrun.noRunningTurn)` while the member has no running turn, and with `Denied (teamrun.readOnlyMode)` for a tool the session
   * doesn't list as read-only while the turn runs in a read-only permission mode, such as Plan.
   */
  callMcpToolAsync(params: McpToolCallParams, signal?: AbortSignal): Promise<JsonObject>;

  /**
   * Starts a sub-agent for a running turn: a fresh turn of the same provider and model in the chat's folder, with the brief as its
   * prompt, the sub-agent instructions after the teammate's role, and none of TeamRun's tools, so it can't send or delegate.
   * A Helper runs in the turn's mode with its team MCP servers, one at a time per folder: a Helper started while another runs in the
   * same folder waits for it, as a running row. An Explorer runs at once in the adapter's `explorerMode`, with no team MCP servers,
   * and TeamRun denies every approval it asks for, with a note under its row.
   * Its row is a running `SubAgent` detail in the turn's reply and a background task with the row's id, so the Sub-agents card's Stop
   * and the reply's Stop end it; its details go under the row, its text as notes, and its approvals ask in the reply, naming the row.
   * @param params The turn's sender token, `explorer` or `helper`, the row's title and the brief.
   * @returns The running row, whose `toolUseId` is the sub-agent's id.
   * @throws ServiceException `Unauthorized` for a token of no running turn, or of a turn whose reply was stopped; `InvalidParams` for
   * another agent, or `explorer` on a provider with no `explorerMode`, giving the adapter's `explorerUnavailable` as the reason; `Conflict` when the reply already runs `Resources.subAgentLimit`
   * sub-agents.
   */
  startSubAgentAsync(params: SubAgentStartParams): Promise<SubAgent>;

  /**
   * Waits until one of a running turn's named sub-agents ends, or for at most the given seconds; answers at once when none of them runs.
   * @param params The turn's sender token, the sub-agents' ids (none for all of its reply's) and the most seconds to wait.
   * @returns The named sub-agents that have ended, each with its last message, cut at `Resources.subAgentResultLimit` characters, or
   * why it failed in `summary`, and the ids of those still running.
   * @throws ServiceException `Unauthorized` for a token of no running turn; `NotFound` for an id the turn's reply didn't start.
   */
  waitSubAgents(params: SubAgentWaitParams): Promise<SubAgentWaitResult>;

  /**
   * Stops one of a running turn's sub-agents and waits for its end; one that has ended is answered as it ended.
   * @param params The turn's sender token and the sub-agent's id.
   * @returns The sub-agent's row.
   * @throws ServiceException `Unauthorized` for a token of no running turn; `NotFound` for an id the turn's reply didn't start.
   */
  stopSubAgent(params: SubAgentStopParams): Promise<SubAgent>;

  /**
   * Starts a shell command in the background for a running turn, in the chat's folder, through the engine's command starter.
   * It shows as a running background task of the turn's reply, with its output, so the Background tasks' Stop and the reply's Stop end it.
   * When the turn ends, a command still running waits in a `Command` chat wake, and one that ended during the turn wakes at once: the
   * teammate that started it gets a new turn, one hop past the turn's, quoting its exit code or signal and its last
   * `Resources.commandWakeLines` lines, cut to `Resources.wakeQuoteLength` characters from the end. A command that was stopped, or whose
   * turn was stopped, wakes no one; one that TeamRun's restart ended gets the lost note.
   * @param params The turn's sender token, the command line and what it does.
   * @returns The running task, whose `id` the wake names.
   * @throws ServiceException `Unauthorized` for a token of no running turn, or of a turn whose reply was stopped; `Unavailable` when
   * the engine has no command starter or no background tasks; `Conflict` when the chat already runs `Resources.commandLimit` commands;
   * `NotFound`, starting nothing, when the background tasks have already forgotten the chat, as a delete leaves them.
   */
  startCommandAsync(params: CommandStartParams): Promise<BackgroundTask>;
}

/**
 * One agent session of Noldova Desktop's tool registry, opened for a teammate's turn: it lists and calls the tools, and its end aborts
 * the calls in flight as `SessionEnded`.
 */
export interface ITurnToolSession extends IMcpToolHost {
  /**
   * The Noldova Desktop session's id, which its tool calls and permission requests name.
   */
  readonly id: string;

  /**
   * Ends the session; ending it again does nothing.
   */
  end(): void;
}

/**
 * Opens the agent session of each teammate's turn, and names the tools a provider runs without asking the person.
 */
export interface ITurnToolSessions {
  /**
   * The tools a provider runs without asking the person, since each asks the person itself where it must.
   */
  readonly approvedTools: readonly string[];

  /**
   * The URL of TeamRun's MCP endpoint on the loopback address, or null while it isn't serving.
   */
  readonly endpoint: string | null;

  /**
   * Opens a session.
   * @param scope What the session acts for: `<conversation id>/<teammate id>`, or `<conversation id>/default` for the default teammate.
   * @param conversationId The chat whose turn the session serves.
   * @param workFolder The chat's working folder: its project's root or its own folder.
   * @param projectId The chat's project, or null for a chat outside projects.
   * @param agentName The name of the teammate the turn runs as, which a module may show while the agent acts.
   * @param record Takes what a call kept for the person and not for the agent, such as a Browser call's page and screenshot, for its step.
   * @returns The open session.
   */
  open(scope: string, conversationId: string, workFolder: string, projectId: string | null, agentName: string,
    record: (call: ToolCallRecord) => void): ITurnToolSession;
}

/**
 * Every literal of the core package: the database file name, the migration id, the table names,
 * the column names that no model property provides, the SQL statements of the services, parameter
 * names, and the service messages.
 */
export declare class Resources {
  /**
   * database version unsupported used when the database opens.
   */
  public static readonly databaseVersionUnsupported: string;
  /**
   * Moves a conversation to another project, with its stored JSON and update time.
   */
  public static readonly updateConversationProject: string;
  /**
   * Selects a conversation's newest messages, newest first, up to a limit.
   */
  public static readonly selectNewestMessagesByConversation: string;
  /**
   * Selects a conversation's messages before a sequence number, newest first, up to a limit.
   */
  public static readonly selectMessagesBeforeSequence: string;
  /**
   * Selects a conversation's messages after a sequence number, oldest first, up to a limit.
   */
  public static readonly selectMessagesAfterSequenceLimited: string;
  /**
   * Finds whether a conversation has a message before a sequence number.
   */
  public static readonly selectEarlierMessageExists: string;
  /**
   * Finds whether a conversation has a message after a sequence number.
   */
  public static readonly selectLaterMessageExists: string;
  /**
   * Refusal of a send whose mentioned teammates are not exactly the teammates its text names.
   */
  public static readonly mentionsChanged: string;
  /**
   * Participant execution literal.
   */
  public static readonly instructionsParameterName: string;
  /**
   * Participant execution literal.
   */
  public static readonly freshPromptParameterName: string;
  /**
   * The name of `FolderCheckTimings`' deadline parameter.
   */
  public static readonly deadlineParameterName: string;
  /**
   * The name of `FolderCheckTimings`' list wait parameter.
   */
  public static readonly listWaitParameterName: string;
  /**
   * The parameter name of a shared MCP refusal's full sentence, `reason`.
   */
  public static readonly reasonParameterName: string;
  /**
   * The parameter name of a shared MCP refusal's few words, `short`.
   */
  public static readonly shortParameterName: string;
  /**
   * Participant execution literal.
   */
  public static readonly contextOmissionNote: string;
  /**
   * How many teammate hand-offs a chain takes when nothing sets the limit: 4.
   */
  public static readonly defaultHopLimit: number;
  /** The longest title TeamRun makes, in characters. */
  public static readonly maximumTitleLength: number;
  /** How much of a chat's first message a model reads to make its title, in characters. */
  public static readonly titleOpeningLength: number;
  /** How long one model may take to answer for a title, in milliseconds. */
  public static readonly titleAskTimeout: number;
  /** Between the provider's id and the model's in the Title model setting's value. */
  public static readonly titleModelSeparator: string;
  /** The folder under the data directory where title sessions run. */
  public static readonly titleSessionsDirectoryName: string;
  /** The log line when a title that arrived couldn't be kept. */
  public static readonly titleNotKept: string;
  /** Logged when reading the Title model setting fails, which leaves the chat's model to name the chat. */
  public static readonly titleChoiceNotRead: string;
  /** A label a model may start its title with. */
  public static readonly titleLabelPattern: RegExp;
  /** Marks and punctuation around a title a model answered with. */
  public static readonly titleWrappingPattern: RegExp;
  /**
   * The log line when asking a provider for a title failed, without the provider's error text.
   * @param kind The provider's kind.
   * @returns The line.
   */
  public static formatTitleAskFailed(kind: string): string;
  /**
   * The question a model answers with a chat's title.
   * @param opening The start of the chat's first message.
   * @returns The prompt.
   */
  public static formatTitlePrompt(opening: string): string;
  /**
   * The command a teammate's instructions name when the host gives none: `teamrun teamrun`.
   */
  public static readonly defaultCommand: string;
  /**
   * How many random bytes a teammate turn's sender token holds: 32.
   */
  public static readonly senderTokenBytes: number;
  /** The line every teammate's instructions start with, after its role: keep work of several steps in its own plan tool, which TeamRun shows as the reply's live plan, and never type the plan as a checklist. */
  public static readonly planToolInstructions: string;
  /** How many random bytes a member's MCP token holds before base64url: 32. */
  public static readonly mcpTokenBytes: number;
  /** The refusal of an MCP token that names no member: TeamRun didn't issue it, or its teammate left the chat, or the chat was deleted. */
  public static readonly mcpTokenRefused: string;
  /** How long a provider session's MCP token lasts at most from its issue, in milliseconds: 12 hours. */
  public static readonly sessionTokenLifetime: number;
  /** The refusal of a tool call for a member with no running turn. */
  public static readonly mcpNoRunningTurn: string;
  /** The refusal of a tool call in a turn the person stopped, until that turn ends. */
  public static readonly mcpTurnStopped: string;
  /** Noldova Desktop's failure code `Denied`. */
  public static readonly deniedFailure: string;
  /** Noldova Desktop's failure code `Unavailable`. */
  public static readonly unavailableFailure: string;
  /** The module code of a call for a member with no running turn, `teamrun.noRunningTurn`. */
  public static readonly noRunningTurnCode: string;
  /** The module code of a call in a turn the person stopped, `teamrun.turnStopped`. */
  public static readonly turnStoppedCode: string;
  /** The code of a TeamRun tool that changes things refused in a read-only mode: `teamrun.readOnlyMode`. */
  public static readonly readOnlyModeCode: string;
  /** The last part of the default teammate's session scope, `default`. */
  public static readonly defaultToolScope: string;
  /**
   * What separates a tool session scope's conversation id from its teammate's id: `/`.
   */
  public static readonly toolScopeSeparator: string;
  /**
   * The refusal of a send whose sender token names no running teammate turn.
   */
  public static readonly senderTurnEnded: string;
  /**
   * The module a send's ask names.
   */
  public static readonly sendMessageModule: string;
  /**
   * The action a send's ask names, `teamrun.sendMessage`.
   */
  public static readonly sendMessageAction: string;
  /**
   * The label of a send's chat on its ask.
   */
  public static readonly sendChatLabel: string;
  /**
   * The label of whose reply a send starts on its ask.
   */
  public static readonly sendStartsLabel: string;
  /**
   * The label of a send's text on its ask.
   */
  public static readonly sendMessageLabel: string;
  /**
   * What joins the teammates a send starts.
   */
  public static readonly sendStartsSeparator: string;
  /**
   * What a send's ask names when it starts the chat's default teammate.
   */
  public static readonly sendDefaultTeammate: string;
  /**
   * What a send's ask says when it starts no one.
   */
  public static readonly sendStartsNoOne: string;
  /**
   * What a send's ask says when its chain has reached the hand-off limit, so it starts no one.
   */
  public static readonly sendStopsAtLimit: string;
  /**
   * The refusal of a send the person didn't allow, or whose wait ended first.
   */
  public static readonly sendNotAllowed: string;
  /**
   * The refusal of a send whose Starts changed before the person allowed it.
   */
  public static readonly sendChangedBeforeAllowed: string;
  /**
   * The refusal of a send whose chat moved to another project while it was sent.
   */
  public static readonly chatMovedWhileSent: string;
  /**
   * The refusal of a teammate's send whose reply group ended while it was sent.
   */
  public static readonly replyEndedWhileSent: string;
  /**
   * The refusal of a teammate's send that asks for one of its kind's unrestricted modes, which only the person chooses.
   */
  public static readonly unrestrictedModeRefused: string;
  /**
   * The refusal of a send, from a client other than TeamRun's window, that asks for a mode the person chose neither for the chat nor for the
   * default teammate.
   */
  public static readonly unchosenModeRefused: string;
  /**
   * The agent a turn names to start a Helper sub-agent: `helper`.
   */
  public static readonly helperAgent: string;
  /**
   * A Helper sub-agent row's type: `Helper`.
   */
  public static readonly helperType: string;
  /**
   * The agent a turn names to start an Explorer sub-agent: `explorer`.
   */
  public static readonly explorerAgent: string;
  /**
   * An Explorer sub-agent row's type: `Explorer`.
   */
  public static readonly explorerType: string;
  /**
   * How many sub-agents one reply runs at once: 4.
   */
  public static readonly subAgentLimit: number;
  /**
   * How many background commands one chat runs at once: 4.
   */
  public static readonly commandLimit: number;
  /**
   * How many of a background command's last output characters are kept for its wake.
   */
  public static readonly commandTailLength: number;
  /**
   * How many of a background command's last lines its wake quotes: 20.
   */
  public static readonly commandWakeLines: number;
  /**
   * The line break of a background command's output, `
` or `
`.
   */
  public static readonly commandLinePattern: RegExp;
  /**
   * The refusal of a background command when the engine has no command starter or no background tasks.
   */
  public static readonly commandsUnavailable: string;
  public static readonly millisecondsPerSecond: number;
  /**
   * How many characters of a sub-agent's last message its result keeps: 20,000.
   */
  public static readonly subAgentResultLimit: number;
  /**
   * What joins a sub-agent's id to the ids of its own items and tasks in its parent's reply: `/`.
   */
  public static readonly subAgentItemSeparator: string;
  /**
   * The instructions a sub-agent gets after its teammate's role: that only its last message goes back, and that it addresses no
   * teammate and starts no sub-agent.
   */
  public static readonly subAgentInstructions: string;
  /**
   * History cap, excluding the current user message.
   */
  public static readonly joinPreambleMaximumCharacters: number;
  /**
   * Size of history reads while preparing context.
   */
  public static readonly contextPageSize: number;
  /**
   * Teammate storage literal.
   */
  public static readonly teammatesMigrationId: string;
  /**
   * Teammate storage literal.
   */
  public static readonly teammatesTable: string;
  /**
   * Name of the chat members table.
   */
  public static readonly conversationTeammatesTable: string;
  /**
   * The chat members table's name before the chat names migration, which the earlier migrations still use.
   */
  public static readonly legacyConversationTeammatesTable: string;
  /**
   * Teammate storage literal.
   */
  public static readonly selectTeammates: string;
  /**
   * Teammate storage literal.
   */
  public static readonly selectTeammateById: string;
  /**
   * Teammate storage literal.
   */
  public static readonly selectTeammateByName: string;
  /**
   * Teammate storage literal.
   */
  public static readonly insertTeammate: string;
  /**
   * Teammate storage literal.
   */
  public static readonly updateTeammate: string;
  /**
   * Teammate storage literal.
   */
  public static readonly deleteTeammate: string;
  /**
   * Teammate storage literal.
   */
  public static readonly selectMembersByConversation: string;
  /**
   * Teammate storage literal.
   */
  public static readonly selectMembersByTeammate: string;
  /**
   * Teammate storage literal.
   */
  public static readonly selectMember: string;
  /**
   * Teammate storage literal.
   */
  public static readonly insertMember: string;
  /**
   * Teammate storage literal.
   */
  public static readonly updateMember: string;
  /**
   * Teammate storage literal.
   */
  public static readonly deleteMember: string;
  /**
   * The drafts migration's fixed id.
   */
  public static readonly draftsMigrationId: string;
  /**
   * The approval scopes migration's fixed id.
   */
  public static readonly approvalScopesMigrationId: string;
  /**
   * The id of the one stored option that lasted for the session before options carried a scope:
   * `acceptForSession`.
   */
  public static readonly legacySessionOptionId: string;
  /**
   * Gives each stored approval option a scope: `Session` for `legacySessionOptionId`, `Once` for
   * every other, keeping the options' order.
   */
  public static readonly addApprovalOptionScopes: string;
  /**
   * The forgotten sessions migration's fixed id.
   */
  public static readonly forgottenSessionsMigrationId: string;
  /**
   * Gives each provider a `forgottenSessions` column, the JSON array of native sessions it no longer resumes.
   */
  public static readonly addForgottenSessions: string;
  /**
   * The preferences migration's fixed id, and the table of named preferences it creates, each a JSON value.
   */
  public static readonly preferencesMigrationId: string;
  public static readonly preferencesTable: string;
  /**
   * The name of the default teammate's preference.
   */
  public static readonly defaultTeammatePreference: string;
  /**
   * The name of the Projects view's layout preference.
   */
  public static readonly projectsLayoutPreference: string;
  /**
   * The name of the composer's default choice preference.
   */
  public static readonly composerDefaultPreference: string;
  /**
   * The name of the first launch preference, which records when the first launch was finished or skipped.
   */
  public static readonly firstLaunchPreference: string;
  /**
   * The name of the preference that maps each teammate's id to its outside chat's id.
   */
  public static readonly outsideChatsPreference: string;
  /**
   * The name of the preference that maps each outside message's handle to its message's id.
   */
  public static readonly outsideMessagesPreference: string;
  public static readonly outsideMessageIdBytes: number;
  /**
   * How many outside message handles are kept; the oldest go first.
   */
  public static readonly outsideMessagesKept: number;
  public static readonly outsideMessageIdField: string;
  public static readonly stateField: string;
  public static readonly outsideIdField: string;
  public static readonly outsideNameField: string;
  public static readonly outsideProviderField: string;
  public static readonly outsideModelField: string;
  public static readonly outsideWorkingState: string;
  public static readonly outsideIdleState: string;
  public static readonly replyField: string;
  public static readonly errorField: string;
  public static readonly outsideReplyNotStarted: string;
  public static readonly outsideReplyFailed: string;
  /**
   * How many chats the outside chat list gives at most, the most recent first.
   */
  public static readonly outsideChatsListed: number;
  /**
   * The error for an outside message that names neither a teammate nor a chat.
   */
  public static readonly outsideTeammateOrChatRequired: string;
  public static readonly outsideTitleField: string;
  public static readonly outsideProjectField: string;
  public static readonly outsideTeammateField: string;
  public static readonly outsideTeammatesField: string;
  /**
   * How many random bytes make the id an outside message's tags carry in a transcript, new each time the message is written into one, so
   * its sender can't know the tag that ends it.
   */
  public static readonly outsideTagIdBytes: number;
  public static readonly selectPreference: string;
  public static readonly upsertPreference: string;
  public static readonly deletePreference: string;
  /**
   * The shared MCP servers migration's fixed id, and the table it creates: each server's id, name, JSON and times.
   */
  public static readonly sharedMcpServersMigrationId: string;
  public static readonly sharedMcpServersTable: string;
  public static readonly selectSharedMcpServers: string;
  public static readonly selectSharedMcpServerById: string;
  public static readonly selectSharedMcpServerByName: string;
  public static readonly insertSharedMcpServer: string;
  public static readonly updateSharedMcpServer: string;
  public static readonly deleteSharedMcpServer: string;
  /**
   * The `source` of a reply's note on a shared MCP server left out of its session.
   */
  public static readonly sharedMcpServersSource: string;
  public static readonly sharedMcpServerReservedPrefix: string;
  public static readonly sharedMcpServerNameReserved: string;
  /**
   * The reading positions migration's fixed id, and the table it creates: one reading position per conversation, as JSON.
   */
  public static readonly readingPositionsMigrationId: string;
  public static readonly readingPositionsTable: string;
  /**
   * The chat wakes migration's fixed id, and the table it creates: one wake per row, keyed by id, with its chat, state and JSON.
   */
  public static readonly chatWakesMigrationId: string;
  public static readonly acpAgentsMigrationId: string;
  public static readonly acpAgentsTable: string;
  public static readonly kindColumn: string;
  public static readonly selectAcpAgents: string;
  public static readonly insertAcpAgent: string;
  public static readonly updateAcpAgent: string;
  public static readonly deleteAcpAgent: string;
  /**
   * The note a `/compact` reply shows when its provider's row says it can't compact.
   * @param provider The provider kind's display name.
   * @param reason The row's reason.
   * @returns The note.
   */
  public static formatCompactRefused(provider: string, reason: string): string;
  public static formatAcpAgentNotOpened(kind: string, reason: string): string;
  public static formatAcpAgentAlreadyAdded(id: string): string;
  public static formatAcpAgentNotListed(id: string): string;
  public static formatAcpAgentInUse(name: string): string;
  public static formatAcpAgentInstalling(name: string): string;
  public static formatAcpAgentSecretKept(kind: string, reason: string): string;
  public static readonly chatWakesTable: string;
  /**
   * The waiting messages migration's fixed id, and the table it creates: one waiting message per row, keyed by id, with its chat and JSON.
   */
  public static readonly waitingMessagesMigrationId: string;
  public static readonly waitingMessagesTable: string;
  /** What a waiting message whose send failed for a reason the person can't read says instead. */
  public static readonly waitingMessageNotSent: string;
  public static formatWaitingMessageSkipped(waitingId: string, reason: string): string;
  /**
   * The run outputs migration's fixed id, and the table it creates: one Run's output per row, keyed by its message, part and block, with
   * its chat.
   */
  public static readonly runOutputsMigrationId: string;
  public static readonly runOutputsTable: string;
  /**
   * The message text migration's fixed id: `20261108000000_MessageText`.
   */
  public static readonly messageTextMigrationId: string;
  /**
   * The account limits migration's fixed id: `20261112000000_AccountLimits`.
   */
  public static readonly accountLimitsMigrationId: string;
  /**
   * The table of the accounts that reached a usage limit: `accountLimits`.
   */
  public static readonly accountLimitsTable: string;
  /**
   * The Sustain attempts migration's fixed id: `20261112010000_SustainAttempts`.
   */
  public static readonly sustainAttemptsMigrationId: string;
  /**
   * The table of the accounts each chain of replies tried for a teammate under Sustain: `sustainAttempts`.
   */
  public static readonly sustainAttemptsTable: string;
  public static readonly handoverSummariesMigrationId: string;
  public static readonly handoverSummariesTable: string;
  /**
   * The handover summary kinds migration's fixed id: `20261112040000_HandoverSummaryKinds`.
   */
  public static readonly handoverSummaryKindsMigrationId: string;
  /**
   * Adds the provider kind that wrote each handover summary, empty for one written before it.
   */
  public static readonly addHandoverSummaryKind: string;
  public static readonly checkpointFoldersMigrationId: string;
  public static readonly addMessageCheckpointFolder: string;
  public static readonly checkpointFolderIdColumn: string;
  /** The departments migration's fixed id: `20261120120000_Departments`. */
  public static readonly departmentsMigrationId: string;
  /** The departments table. */
  public static readonly departmentsTable: string;
  /** The table of which teammate is in which department; a teammate has at most one row. */
  public static readonly departmentMembersTable: string;
  /** The department id column of `departmentMembers`. */
  public static readonly departmentIdColumn: string;
  /** Selects every department's JSON. */
  public static readonly selectDepartments: string;
  /** Selects every teammate's department. */
  public static readonly selectDepartmentMembers: string;
  /** Inserts a department. */
  public static readonly insertDepartment: string;
  /** Updates a department's parent and JSON. */
  public static readonly updateDepartment: string;
  /** Deletes a department. */
  public static readonly deleteDepartment: string;
  /** Puts a teammate in a department. */
  public static readonly insertDepartmentMember: string;
  /** Takes a teammate out of its department. */
  public static readonly deleteDepartmentMember: string;
  public static readonly selectHandoverSummary: string;
  public static readonly upsertHandoverSummary: string;
  public static readonly deleteHandoverSummaries: string;
  public static readonly textColumn: string;
  public static readonly summarySessionsDirectoryName: string;
  public static readonly ownSummaryTimeout: number;
  public static readonly summaryTurnNotDeniable: string;
  public static readonly titleTurnNotDeniable: string;
  /**
   * The Sustain attempt reasons migration's fixed id: `20261112020000_SustainAttemptReasons`.
   */
  public static readonly sustainAttemptReasonsMigrationId: string;
  /**
   * Adds each Sustain attempt's `reason`, `limit` for the rows already saved.
   */
  public static readonly addSustainAttemptReason: string;
  /**
   * The reason of an attempt whose account stopped at a usage limit: `limit`.
   */
  public static readonly sustainAttemptLimit: string;
  /**
   * The reason of an attempt skipped because its window has no room for the handover: `noRoom`.
   */
  public static readonly sustainAttemptNoRoom: string;
  /**
   * Records an account a chain tried for a teammate, with why; a later `limit` replaces an earlier `noRoom` for the same account, and nothing
   * replaces a `limit`.
   */
  public static readonly insertSustainAttempt: string;
  /**
   * The statements that create the `messageText` FTS5 table with the trigram tokenizer, one row per message keyed by the
   * message's rowid and holding its text details joined by spaces; the triggers that keep it in step when a message is
   * inserted, its JSON is updated or it is deleted; and the statement that fills it from the messages already saved.
   */
  public static readonly createMessageText: readonly string[];
  /**
   * Selects the messages whose text matches an FTS5 phrase, each with its chat's JSON as `chat`, the last saved first by the index's rowid, so it stops at the limit.
   */
  public static readonly selectMessagesMatching: string;
  /**
   * Counts the messages whose text matches an FTS5 phrase, at most a limit, as `count`.
   */
  public static readonly countMessagesMatching: string;
  /**
   * Selects, among the last saved index rows up to a number, the messages whose text matches a GLOB pattern, each with its chat's
   * JSON as `chat`, the last saved first by the index's rowid, at most a limit; for a text shorter than a trigram, which the index
   * can't match.
   */
  public static readonly selectMessagesContaining: string;
  /**
   * Counts, among the last saved index rows up to a number, the messages whose text matches a GLOB pattern, at most a limit, as
   * `count`.
   */
  public static readonly countMessagesContaining: string;
  /**
   * Counts the last saved index rows, at most a limit, as `count`.
   */
  public static readonly countLatestIndexed: string;
  /**
   * Selects the latest updated chats, at most a limit.
   */
  public static readonly selectLatestChats: string;
  /**
   * Counts every chat, as `count`.
   */
  public static readonly countChats: string;
  /**
   * Selects the chats whose title matches a LIKE pattern, the latest updated first, at most a limit.
   */
  public static readonly selectChatsByTitleLimited: string;
  /**
   * Counts the chats whose title matches a LIKE pattern, as `count`.
   */
  public static readonly countChatsByTitle: string;
  /**
   * Selects the names of a chat's teammates, in the order they joined.
   */
  public static readonly selectTeammateNamesByChat: string;
  /**
   * A trigram's length, 3: the fewest characters the `messageText` index matches; a shorter text is found by reading the
   * index's text.
   */
  public static readonly trigramLength: number;
  /**
   * The most index rows a text shorter than a trigram reads, the last saved: 2,000, so its answer stays in the tens of
   * milliseconds whatever the history's size; past them its result is `capped`.
   */
  public static readonly shortSearchRows: number;
  /**
   * The most matches a message search counts: 1,000; past it the result's total is 1,000 and `capped`.
   */
  public static readonly messageSearchCountCap: number;
  /**
   * The column a message search selects its chat's JSON as: `chat`.
   */
  public static readonly chatColumn: string;
  /**
   * A double quote, which an FTS5 phrase is written in.
   */
  public static readonly quote: string;
  /**
   * How many characters of Run output a chat keeps, 8,000,000, so that its list answers in one frame; a save drops the chat's oldest saved
   * outputs beyond it.
   */
  public static readonly runOutputsKeptCharacters: number;
  public static formatWaitingMessageNotFound(waitingId: string): string;
  public static formatWaitingMessageOtherChat(waitingId: string, chatId: string): string;
  /** The log line for a chat's waiting messages that couldn't be read to show them once one was taken off to send or steer; that one still sends or steers. */
  public static formatWaitingMessagesNotShown(chatId: string, reason: string): string;
  public static formatWaitingMessageNotSent(chatId: string, reason: string): string;
  /** The log line for a chat's background sending that failed; the chat sends again at its next reply's end. */
  public static formatChatSendingStopped(chatId: string, reason: string): string;
  /** The log line for a tool call's record that couldn't be stored; the records after it are still stored. */
  public static formatToolCallNotKept(chatId: string, failureKind: string): string;
  /** The log line for a message the provider took as a steer that couldn't be kept in the chat; the next waiting message goes on. */
  public static formatSteeredMessageNotKept(chatId: string, failureKind: string): string;
  /** The log line for a steer the provider refused with an error; the message waits as Queue. */
  public static formatSteerRefused(replyId: string, failureKind: string): string;
  /** The log line for a waiting message's files that couldn't be removed; the message's own change goes on. */
  public static formatWaitingFilesNotRemoved(waitingId: string, reason: string): string;
  /** The log line for a deleted chat's waiting files that couldn't be removed; the delete goes on. */
  public static formatChatWaitingFilesNotRemoved(chatId: string, reason: string): string;
  /**
   * The background tasks migration's fixed id, and the table it creates: one task per row, keyed by id, with its chat and JSON.
   */
  public static readonly backgroundTasksMigrationId: string;
  public static readonly backgroundTasksTable: string;
  /**
   * The reply identity migration's fixed id, and the JSON path it removes from each stored message and its change feed entries: the person's
   * email, plan, organization and sign-in method a reply kept before, which only the provider's row keeps now.
   */
  public static readonly replyIdentityMigrationId: string;
  public static readonly replyIdentityPath: string;
  /**
   * Reading position storage literal; lists every stored position.
   */
  public static readonly selectReadingPositions: string;
  /**
   * Reading position storage literal; inserts or replaces a conversation's position while the conversation exists.
   */
  public static readonly upsertReadingPosition: string;
  /**
   * Reading position storage literal.
   */
  public static readonly deleteReadingPosition: string;
  /**
   * Reading position storage literal.
   */
  public static readonly deleteReadingPositionAt: string;
  /**
   * Reading position storage literal.
   */
  public static readonly deleteReadingPositionFromSequence: string;
  /**
   * The table holding one draft per conversation.
   */
  public static readonly draftsTable: string;
  /**
   * Draft storage literal.
   */
  public static readonly selectDraft: string;
  /**
   * Draft storage literal; inserts or replaces a conversation's draft.
   */
  public static readonly upsertDraft: string;
  /**
   * Draft storage literal.
   */
  public static readonly deleteDraft: string;
  /**
   * Directory within attachments holding each conversation's draft files, in a folder named by its id.
   */
  public static readonly attachmentDraftFilesDirectoryName: string;
  /**
   * Directory containing durable composer attachments.
   */
  public static readonly attachmentsDirectoryName: string;
  /**
   * Creates a new file without overwriting an existing one.
   */
  public static readonly exclusiveWriteFlag: string;
  /**
   * Parent-directory path segment.
   */
  public static readonly parentDirectory: string;
  /**
   * Attachment count and size diagnostic.
   */
  public static readonly attachmentLimitExceeded: string;
  /**
   * Invalid attachment encoding diagnostic.
   */
  public static readonly attachmentInvalidBase64: string;
  /**
   * Invalid saved-file reference diagnostic.
   */
  public static readonly attachmentOutsideStore: string;
  /**
   * A saved file reached through a link to a network or device path, which is never followed.
   */
  public static readonly attachmentLinkRefused: string;
  /**
   * A file grant Noldova Desktop refuses: unknown, already used, expired or another module's.
   */
  public static readonly attachmentGrantRefused: string;
  /**
   * Bytes an opened file is copied in at a time.
   */
  public static readonly attachmentCopyChunkBytes: number;
  /**
   * Largest base64 input allowed before decoding.
   */
  public static readonly maximumAttachmentEncodedLength: number;
  /**
   * Directory within attachments for transient file preparations.
   */
  public static readonly attachmentDraftsDirectoryName: string;
  /**
   * How many of an id's last characters a log line shows: few enough that the module log's redaction of long opaque values
   * leaves them.
   */
  public static readonly loggedIdLength: number;
  /**
   * How a log line names a reply without a provider.
   */
  public static readonly noLoggedProvider: string;
  /**
   * The failure kind a log line gives a reply whose turn the provider reported as failed.
   */
  public static readonly failedTurnKind: string;
  /**
   * The failure kind a log line gives a sign-in check whose status the provider reported as `Error`.
   */
  public static readonly signInCheckErrorKind: string;
  /**
   * The message for a profile search whose folder isn't an absolute path.
   */
  public static readonly profileSearchFolderNotAbsolute: string;
  /**
   * The message for a profile search with no entry names, or a blank one.
   */
  public static readonly profileSearchWithoutEntries: string;
  /**
   * The name of a profile search's `folders` parameter.
   */
  public static readonly foldersParameterName: string;
  /**
   * The name of a profile search's `entries` parameter.
   */
  public static readonly entriesParameterName: string;
  /**
   * The message for a profile search whose skipped folder isn't an absolute path.
   */
  public static readonly profileSearchSkippedNotAbsolute: string;
  /**
   * The name of a profile search's `skipped` parameter.
   */
  public static readonly skippedParameterName: string;
  /**
   * The leading dots a found folder's name loses in its label, unless they are the whole name.
   */
  public static readonly leadingDotsPattern: RegExp;
  /**
   * Joins the sorted kinds of a running search, so a call for the same kinds finds it.
   */
  public static readonly discoveryKeySeparator: string;
  /**
   * A path a reply links to that names a network share, which `ConversationEngine.listLinkedFolders` never looks at.
   */
  public static readonly linkedNetworkPathPattern: RegExp;
  /**
   * A control character in a path a reply links to, which `ConversationEngine.listLinkedFolders` never looks at.
   */
  public static readonly linkedControlCharacterPattern: RegExp;
  /**
   * Safe extension pattern for generated attachment filenames.
   */
  public static readonly attachmentExtensionPattern: RegExp;
  /**
   * Native image MIME types mapped to file extensions.
   */
  public static readonly attachmentImageExtensions: Readonly<Record<string, string>>;
  /**
   * The exclusive upper sequence bound for an unpositioned reply page.
   */
  public static readonly maximumReplySequence: number;
  /**
   * The native session identifier result column.
   */
  public static readonly nativeSessionIdColumn: string;
  /**
   * Selects the latest compatible native session using the conversation sequence index.
   */
  public static readonly selectResumableSession: string;
  /**
   * The column a context window is read into.
   */
  public static readonly windowTokensColumn: string;
  /**
   * Selects the context window the newest reply on a provider's kind and model reported, on any account of that kind.
   */
  public static readonly selectWindowTokens: string;
  /**
   * Projects requested detail kinds in SQLite before transporting or decoding message JSON.
   */
  public static readonly selectMessageDigest: string;
  /**
   * Selects pending approvals across conversations.
   */
  public static readonly selectAllPendingApprovals: string;
  /**
   * Matches a parent-relative path outside a root.
   */
  public static readonly parentPathPattern: RegExp;
  /**
   * The Git directory or worktree marker name.
   */
  public static readonly gitDirectoryName: string;
  /**
   * The data directory's folder that holds the chats' own folders: `chats`.
   */
  public static readonly chatsDirectoryName: string;
  public static readonly gitHeadFileName: string;
  public static readonly gitConfigFileName: string;
  public static readonly gitObjectsDirectoryName: string;
  public static readonly gitBranchesPath: string;
  /**
   * The `HEAD` of a chat folder's Git root, on a `main` branch with no commit.
   */
  public static readonly chatGitHead: string;
  /**
   * The `config` of a chat folder's Git root.
   */
  public static readonly chatGitConfig: string;
  /**
   * How many times a chat folder's delete is retried while the system holds a file.
   */
  public static readonly removeRetries: number;
  /**
   * The checkpoints module's `Deleted` outcome of a folder's delete.
   */
  public static readonly checkpointsDeleted: string;
  /**
   * Why a chat folder was kept while its checkpoints are held up.
   */
  public static readonly checkpointsHeldUp: string;
  /**
   * Name of the event an abort signal sends: `abort`.
   */
  public static readonly abortEvent: string;
  public static readonly answerOptionId: string;
  public static readonly skipOptionId: string;
  public static readonly answerLabel: string;
  public static readonly skipLabel: string;
  /**
   * The options of every `Question` approval: Answer, approved once, and Skip, denied once.
   */
  public static readonly questionOptions: readonly ApprovalOption[];
  public static readonly allowOnceOptionId: string;
  public static readonly denyOptionId: string;
  public static readonly allowOnceLabel: string;
  public static readonly denyLabel: string;
  /**
   * Allow once, approved once.
   */
  public static readonly allowOnceOption: ApprovalOption;
  /**
   * Deny, denied once.
   */
  public static readonly denyOption: ApprovalOption;
  /**
   * The options of a `Permission` approval whose module gives no labels: Allow once and Deny.
   */
  public static readonly permissionOptions: readonly ApprovalOption[];
  /**
   * The id of the option labelled with the module's allow-always label.
   */
  public static readonly allowAlwaysOptionId: string;
  /**
   * The id of the option labelled with the module's take-over label.
   */
  public static readonly takeOverOptionId: string;
  public static readonly allowInChatOptionId: string;
  public static readonly allowInChatLabel: string;
  /**
   * The options of a `Permission` approval whose allowing the base remembers for the chat, which only computer use's screen and
   * per-app requests are: Allow in this chat, approved for the session, and Deny, denied once.
   */
  public static readonly chatPermissionOptions: readonly ApprovalOption[];
  /**
   * The answer each permission option's id gives; Deny, and any id not listed, gives `Denied`.
   */
  public static readonly permissionAnswers: ReadonlyMap<string, PermissionAnswer>;
  /**
   * Parameter name of an approval identifier.
   */
  public static readonly approvalIdParameterName: string;
  /**
   * Parameter name of a remembered grant's id.
   */
  public static readonly idParameterName: string;
  /**
   * Parameter name of a remembered grant's app identity.
   */
  public static readonly appParameterName: string;
  /**
   * Parameter name of a remembered grant's scope.
   */
  public static readonly scopeParameterName: string;
  /**
   * Parameter name of a background task's provider id.
   */
  public static readonly taskIdParameterName: string;
  /**
   * Parameter name of a background task's command line.
   */
  public static readonly commandParameterName: string;
  /**
   * Parameter name of a background task's status.
   */
  public static readonly statusParameterName: string;
  /**
   * Message for a task end whose status is `Running`.
   */
  public static readonly taskEndRunning: string;
  /**
   * Separator between a reply's id and a provider's task id in the key of a background task.
   */
  public static readonly taskKeySeparator: string;
  /**
   * Milliseconds a background task's output gathers before `BackgroundTaskOutput` publishes it: 100.
   */
  public static readonly backgroundTaskOutputInterval: number;
  /**
   * Milliseconds `BackgroundTaskStop` waits for the provider to report the end after the stop: 10000.
   */
  public static readonly backgroundTaskStopWait: number;
  /**
   * Milliseconds a panel request waits for its window's `PanelAnswered` before it fails and the window is left out: 5000.
   */
  public static readonly panelAnswerWait: number;
  /**
   * Milliseconds a computer-use grants listing waits for all its apps' descriptions together before the rest keep their identities: 1000.
   */
  public static readonly appDescriptionsWait: number;
  /**
   * Milliseconds the computer-use grants service keeps an app's description before a listing asks for it again: 600000.
   */
  public static readonly appDescriptionLifetime: number;
  /**
   * Milliseconds a check of a project's folder waits for its read before it counts the folder unreachable: 3000.
   */
  public static readonly folderCheckDeadline: number;
  /**
   * Paths of one reply that a linked-folder listing checks, the rest counting as not folders: 40, as with
   * an attachment's links.
   */
  public static readonly maximumLinkedFolderPaths: number;
  /**
   * Reads of linked paths that run at once, the others waiting their turn within their deadline: 2. While
   * that many have passed their deadline unanswered, a check of another linked path starts no read.
   */
  public static readonly maximumLinkedFolderChecks: number;
  /**
   * Milliseconds a projects listing waits for its folder checks before it answers each folder's last known state: 500.
   */
  public static readonly projectListWait: number;
  /**
   * The longest a used-up provider waits before it checks the clock against its reset again, 60,000 milliseconds, so the state goes within a
   * minute of the reset after the system sleeps or its clock is set.
   */
  public static readonly usedUpCheckInterval: number;
  /**
   * The failure of a panel request that no window answered.
   */
  public static readonly noWindowOpen: string;
  /**
   * The failure of a panel request whose window didn't answer in time.
   */
  public static readonly windowDidNotAnswer: string;
  /**
   * The refusal of a panel request while the person types in the window.
   */
  public static readonly panelRefused: string;
  /**
   * The failure of a panel request the window couldn't carry out.
   */
  public static readonly panelFailed: string;
  /**
   * File name of the database inside a data directory: `teamrun.db`; the data source is named after it.
   */
  public static readonly databaseFileName: string;
  /**
   * The mode a new profile folder gets where the platform has modes: `0o700`, private to the person.
   */
  public static readonly profileDirectoryMode: number;
  /**
   * Id of the migration that creates the initial schema.
   */
  public static readonly initialMigrationId: string;
  /**
   * Title of a conversation created without one.
   */
  public static readonly defaultConversationTitle: string;
  /**
   * Name of the projects table.
   */
  public static readonly projectsTable: string;
  /**
   * Name of the chats table.
   */
  public static readonly conversationsTable: string;
  /**
   * The chats table's name before the chat names migration, which the earlier migrations still use.
   */
  public static readonly legacyConversationsTable: string;
  /**
   * Name of the messages table.
   */
  public static readonly messagesTable: string;
  /**
   * Name of the approvals table.
   */
  public static readonly approvalsTable: string;
  /**
   * Name of the providers table.
   */
  public static readonly providersTable: string;
  /**
   * The providers table's name before the provider names migration, which the initial and forgotten sessions migrations still use.
   */
  public static readonly legacyProvidersTable: string;
  /**
   * The provider names migration's fixed id, and its statements: the table, its kind column and index, and the change feed's entity, renamed.
   */
  public static readonly providerNamesMigrationId: string;
  public static readonly renameProvidersTable: string;
  public static readonly renameKindColumn: string;
  public static readonly dropLegacyKindIndex: string;
  public static readonly renameProviderEntity: string;
  /**
   * The change feed's table, the statement that creates it as the SQL change feed does, so the migration can rename its entries before the feed's
   * first use, and its payload, entity and entity id columns.
   */
  public static readonly changesTable: string;
  public static readonly createChangesTable: string;
  public static readonly payloadColumn: string;
  public static readonly entityColumn: string;
  public static readonly entityIdColumn: string;
  /**
   * Name of the preferences' name column.
   */
  public static readonly nameColumn: string;
  /**
   * The stored JSON fields the provider names migration renames, each at its known path in its table and its change feed entity's payloads.
   */
  public static readonly renamedProviderFields: readonly RenamedJsonField[];
  /**
   * Name of the column a `COUNT(*)` statement returns.
   */
  public static readonly countColumn: string;
  /**
   * Name of the JSON column every record table has; the other columns are named after the model's properties.
   */
  public static readonly jsonColumn: string;
  /**
   * Name of the messages' sequence column, as a statement returns it.
   */
  public static readonly sequenceColumn: string;
  /**
   * Name of the last-writer-wins timestamp column every record table has.
   */
  public static readonly updatedAtColumn: string;
  /**
   * Deletes a project: `id`.
   */
  public static readonly deleteProject: string;
  /**
   * Inserts a project: `id`, `rootPath`, `json`, `createdAt`, `updatedAt`.
   */
  public static readonly insertProject: string;
  /**
   * Selects a project's JSON: `id`.
   */
  public static readonly selectProjectById: string;
  /**
   * Selects a project's JSON: `rootPath`.
   */
  public static readonly selectProjectByRootPath: string;
  /**
   * Selects every project's JSON, oldest first.
   */
  public static readonly selectProjects: string;
  /**
   * Deletes a conversation: `id`.
   */
  public static readonly deleteConversation: string;
  /**
   * Inserts a conversation: `id`, `projectId`, `json`, `createdAt`, `updatedAt`.
   */
  public static readonly insertConversation: string;
  /**
   * Selects a conversation's JSON: `id`.
   */
  public static readonly selectConversationById: string;
  /**
   * Selects a project's conversations' JSON, oldest first: `projectId`.
   */
  public static readonly selectConversationsByProject: string;
  /**
   * Selects the JSON of every conversation that holds a message, the one with the latest message first: the limit.
   */
  public static readonly selectRecentConversations: string;
  public static readonly selectProviderlessConversations: string;
  /**
   * Replaces a conversation's JSON: `json`, `updatedAt`, `id`.
   */
  public static readonly updateConversation: string;
  /**
   * Selects the conversations whose title matches a LIKE pattern, the latest first.
   */
  public static readonly selectConversationsByTitle: string;
  /**
   * Selects the messages with a text detail matching a LIKE pattern, the latest first, each once.
   */
  public static readonly selectMessagesByText: string;
  /**
   * The characters a LIKE pattern escapes: the backslash, the percent sign, the underscore.
   */
  public static readonly likeEscapePattern: RegExp;
  /**
   * The LIKE escape character: a backslash.
   */
  public static readonly likeEscapePrefix: string;
  /**
   * The LIKE wildcard: a percent sign.
   */
  public static readonly likeWildcard: string;
  /**
   * The GLOB wildcard: an asterisk.
   */
  public static readonly globWildcard: string;
  /**
   * The characters a GLOB pattern puts in brackets to match as written: the asterisk, the question mark, the opening bracket.
   */
  public static readonly globSpecials: string;
  /**
   * The last code point the fold table reads: the end of the Supplementary Multilingual Plane, past which no character has a case.
   */
  public static readonly lastFoldedCodePoint: number;
  /**
   * Runs of whitespace, collapsed in snippets.
   */
  public static readonly whitespacePattern: RegExp;
  /**
   * A single space.
   */
  public static readonly space: string;
  /**
   * How many characters a snippet shows before the match: 40.
   */
  public static readonly snippetLead: number;
  /**
   * How long a snippet is at most: 120 characters.
   */
  public static readonly snippetLength: number;
  /**
   * Deletes a conversation's messages: `conversationId`.
   */
  public static readonly deleteMessagesByConversation: string;
  /**
   * Inserts a message: `id`, `conversationId`, `sequence`, `status`, `json`, `createdAt`, `updatedAt`.
   */
  public static readonly insertMessage: string;
  /**
   * Selects the last sequence of a conversation, when it has messages: `conversationId`.
   */
  public static readonly selectLastSequenceByConversation: string;
  /**
   * Selects a message's JSON: `id`.
   */
  public static readonly selectMessageById: string;
  /**
   * Selects a conversation's messages' JSON after a sequence, in sequence order: `conversationId`, `sequence`.
   */
  public static readonly selectMessagesByConversation: string;
  /**
   * Selects one row when a conversation has an ended reply that ran a command: `conversationId`.
   */
  public static readonly selectCommandReply: string;
  /**
   * Selects a conversation's messages' JSON after a sequence, in sequence order, with their details left out in SQLite:
   * `conversationId`, `sequence`.
   */
  public static readonly selectMessageOutlinesByConversation: string;
  /**
   * Selects the JSON of a conversation's pending, running, or awaiting reply: `conversationId`.
   */
  /**
   * Deletes a conversation's messages from a sequence on: `conversationId`, `sequence`.
   */
  public static readonly deleteMessagesFromSequence: string;
  /**
   * Selects the approvals of a conversation's messages from a sequence on: `conversationId`, `sequence`.
   */
  public static readonly selectApprovalsFromSequence: string;
  /**
   * Deletes the approvals of a conversation's messages from a sequence on: `conversationId`, `sequence`.
   */
  public static readonly deleteApprovalsFromSequence: string;
  /**
   * Selects every reply still pending, running, or awaiting an approval, oldest first.
   */
  public static readonly selectOpenReplies: string;
  /**
   * Selects every message with a sub-agent still running, oldest first; the text search only narrows the rows the details are read from.
   */
  public static readonly selectRepliesWithRunningSubAgents: string;
  public static readonly selectOpenReplyByConversation: string;
  /**
   * Replaces a message's status and JSON: `status`, `json`, `updatedAt`, `id`.
   */
  public static readonly updateMessage: string;
  /**
   * Deletes the approvals of a conversation's messages: `conversationId`.
   */
  public static readonly deleteApprovalsByConversation: string;
  /**
   * Inserts an approval: `id`, `messageId`, `status`, `json`, `createdAt`, `updatedAt`.
   */
  public static readonly insertApproval: string;
  /**
   * Selects an approval's JSON: `id`.
   */
  public static readonly selectApprovalById: string;
  /**
   * Selects the JSON of every approval of a conversation's messages: `conversationId`.
   */
  public static readonly selectApprovalsByConversation: string;
  /**
   * Selects the JSON of the pending approvals of a conversation's messages: `conversationId`.
   */
  public static readonly selectListedApprovalsByConversation: string;
  /**
   * Selects the JSON of a message's pending approvals: `messageId`.
   */
  public static readonly selectPendingApprovalsByMessage: string;
  /**
   * Replaces an approval's status and JSON: `status`, `json`, `updatedAt`, `id`.
   */
  public static readonly updateApproval: string;
  /**
   * Deletes a provider: `id`.
   */
  public static readonly deleteProvider: string;
  /**
   * Inserts a provider: `id`, `kind`, `json`, `createdAt`, `updatedAt`.
   */
  public static readonly insertProvider: string;
  /**
   * Selects a provider's JSON: `id`.
   */
  public static readonly selectProviderById: string;
  /**
   * Selects every provider's JSON, oldest first.
   */
  public static readonly selectProviders: string;
  /**
   * Replaces a provider's JSON: `json`, `updatedAt`, `id`.
   */
  public static readonly updateProvider: string;
  /**
   * Parameter name of the adapter in `ProviderKindRegistry.register`.
   */
  public static readonly adapterParameterName: string;
  public static readonly questionsParameterName: string;
  /**
   * Parameter name of the data directory in `DatabaseContext.open`.
   */
  public static readonly dataDirectoryParameterName: string;
  /**
   * Parameter name of the error in `TurnResult`.
   */
  public static readonly errorParameterName: string;
  /**
   * Parameter name of the action in `TurnResult`.
   */
  public static readonly actionParameterName: string;
  /**
   * Parameter name of the usage limit in `TurnResult`.
   */
  public static readonly limitParameterName: string;
  /**
   * Parameter name of the reset time in `UsageLimit`.
   */
  public static readonly resetsAtParameterName: string;
  /**
   * Parameter name of the message id in `ActiveRun`.
   */
  public static readonly messageIdParameterName: string;
  /**
   * Parameter name of the native kind in `ApprovalAsk`.
   */
  public static readonly nativeKindParameterName: string;
  /**
   * Parameter name of the native session id in `TurnStart` and `TurnResult`.
   */
  public static readonly nativeSessionIdParameterName: string;
  /**
   * Parameter name of the options in `ApprovalAsk`.
   */
  public static readonly optionsParameterName: string;
  /**
   * Parameter name of the prompt in `TurnRequest`.
   */
  public static readonly promptParameterName: string;
  /**
   * Parameter name of the provider item id in `TurnDetail`.
   */
  public static readonly providerItemIdParameterName: string;
  /**
   * Parameter name of the parent's item id in `TurnDetail`.
   */
  public static readonly parentItemIdParameterName: string;
  /**
   * Parameter name of the provider request id in `ApprovalAsk`.
   */
  public static readonly providerRequestIdParameterName: string;
  /**
   * Parameter name of the resumed flag in `TurnStart`.
   */
  public static readonly resumedNativeSessionParameterName: string;
  /**
   * Parameter name of the session to resume in `TurnRequest`.
   */
  public static readonly resumeNativeSessionIdParameterName: string;
  /**
   * Parameter name of the turn to resume at in `TurnRequest`.
   */
  public static readonly resumeAtParameterName: string;
  /**
   * Parameter name of the summary in `ApprovalAsk`.
   */
  public static readonly summaryParameterName: string;
  /**
   * Parameter name of the title in `PermissionAsk`.
   */
  public static readonly titleParameterName: string;
  /**
   * Parameter name of the allow-always label in `PermissionAsk`.
   */
  public static readonly allowAlwaysLabelParameterName: string;
  /**
   * Parameter name of the take-over label in `PermissionAsk`.
   */
  public static readonly takeOverLabelParameterName: string;
  /**
   * Parameter name of the working directory in `TurnRequest`.
   */
  public static readonly workingDirectoryParameterName: string;
  /**
   * Message of the invariant that a failed turn carries its error and no other turn does.
   */
  public static readonly failureErrorMismatch: string;
  /**
   * Message of the invariant that only a failed turn offers an action.
   */
  public static readonly failureActionMismatch: string;
  /**
   * Message of the invariant that only a failed turn reaches a usage limit.
   */
  public static readonly failureLimitMismatch: string;
  /**
   * Message of the invariant that a usage limit's reset time is a date and time.
   */
  public static readonly usageLimitResetUnreadable: string;
  /**
   * The note appended to a reply an earlier runtime left open.
   */
  public static readonly replyInterruptedByStop: string;
  /**
   * The message an approved plan sends to the reply's responder.
   */
  public static readonly planApprovedPrompt: string;
  public static readonly listSeparator: string;
  /** A backslash, which a path the checkpoints module restores never holds. */
  public static readonly windowsPathSeparator: string;
  /** The separator between a kind and its provider's label in a default teammate's sender name: ` · `. */
  public static readonly providerSenderSeparator: string;
  public static readonly lineSeparator: string;
  /**
   * The message that asks a resumed session to compact its context: `/compact`.
   */
  public static readonly compactCommand: string;
  /**
   * What a message that is only a `/` command starts with: `/`, then a name with no space or `/`, then a space or the end.
   */
  public static readonly slashCommandPattern: RegExp;
  /**
   * The note a `/compact` reply shows when there's no session to compact.
   */
  public static readonly nothingToCompact: string;
  public static readonly completedStatus: string;
  /**
   * The `source` of the details read from the working tree rather than reported by the provider: the file-change report,
   * the notes that its evidence is incomplete, that the folder wasn't compared, and that commands ran outside the folder.
   */
  public static readonly workingTreeSource: string;
  /**
   * The payload field of a command step's working folder.
   */
  public static readonly cwdField: string;
  /**
   * The payload field of the folders outside the chat's folder that a reply's commands ran in.
   */
  public static readonly foldersField: string;
  /**
   * The longest list of outside folders, joined, that the note names; past it, the note names the chat's folder.
   */
  public static readonly maximumNamedFoldersLength: number;
  /**
   * The `source` of the note that a chain of teammate hand-offs stopped at the limit, which the window shows as a line under the reply.
   */
  public static readonly handOffSource: string;
  /**
   * The `source` of the note Sustain adds to a reply it moved to another account.
   */
  public static readonly sustainSource: string;
  /**
   * The payload field that marks a reply's error as stopped at a usage limit, so the window shows its one stopped line; an earlier reply's Sustain
   * note with no entry left carries it too.
   */
  public static readonly sustainStoppedField: string;
  /**
   * The payload field of a Sustain note whose move started a new session with a handover: the new session's first prompt as it was sent.
   */
  public static readonly sustainHandoverField: string;
  /**
   * The payload field of a Sustain note with a handover: what the handover carried, one line each, as the note's fold lists them.
   */
  public static readonly sustainCarriedField: string;
  /**
   * The payload field of a Sustain note whose handover left messages out: the line saying the new session reads them with `list-messages`.
   */
  public static readonly sustainReadsField: string;
  public static readonly usageHandOffSource: string;
  public static readonly handedOffField: string;
  /**
   * The `source` of the note at the top of a reply the provider started on its own, which marks what started it; with `taskId` when a task's end did.
   */
  public static readonly wakeSource: string;
  /**
   * The payload field, `true`, that marks a wake note as a provider's compaction of an idle chat.
   */
  public static readonly idleCompactionField: string;
  /**
   * The payload field, `true`, that marks a provider's note that it compacted the session's context, which a Sustain handover's summary follows.
   */
  public static readonly compactionField: string;
  /**
   * The note at the top of the reply that compacts an idle chat before its prompt cache expires.
   */
  public static readonly idleCompactionNote: string;
  /**
   * The `source` of a chat wake's message, with its `wakeId`: the message that tells a turn the work it sent to another chat, or its
   * sub-agent, has ended.
   */
  public static readonly chatWakeSource: string;
  public static readonly addKind: string;
  public static readonly updateKind: string;
  public static readonly deleteKind: string;
  public static readonly transcriptUserPrefix: string;
  public static readonly transcriptAssistantPrefix: string;
  public static readonly transcriptSeparator: string;
  /**
   * What a turn answering a message sent with `wake_when_done` reads after the message: the sender gets its reply by itself when its turn ends, so it only replies.
   */
  public static readonly awaitedReplyNote: string;
  /**
   * Characters of transcript fed to a fresh provider session; the earlier part is dropped beyond it.
   */
  public static readonly maximumTranscriptLength: number;
  /**
   * Parameter name reported for a blank native turn id: `nativeTurnId`.
   */
  public static readonly nativeTurnIdParameterName: string;
  /**
   * Parameter name reported for a blank last turn id: `lastTurnId`.
   */
  public static readonly lastTurnIdParameterName: string;
  public static readonly ellipsis: string;
  /**
   * Lines kept of an added file's diff.
   */
  public static readonly maximumDiffLines: number;
  /**
   * What separates the folders of a path the checkpoints module names.
   */
  public static readonly checkpointPathSeparator: string;
  /**
   * Why a rewind restored no files when no checkpoint was taken before the reply.
   */
  public static readonly noCheckpointRefusal: string;
  /**
   * Why a rewind restored no files when the reply's checkpoint was taken of a folder the chat no longer works in.
   */
  public static readonly checkpointFolderChangedRefusal: string;
  /**
   * Why a rewind restored no files, in plain words, by the checkpoints module's outcome.
   */
  public static readonly restoreRefusals: ReadonlyMap<string, string>;
  public static readonly replyCheckpointsMigrationId: string;
  public static readonly addMessageCheckpoint: string;
  public static readonly checkpointIdColumn: string;
  public static readonly projectlessConversationsMigrationId: string;
  public static readonly deferForeignKeys: string;
  public static readonly copyConversations: string;
  public static readonly dropConversations: string;
  public static readonly restoreConversations: string;
  public static readonly dropConversationsCopy: string;
  /**
   * The chat titles migration's fixed id, and its statements: a chat stored with the earlier default title "New conversation", edited or not,
   * takes "New chat" in its row and in the change feed's payloads for it, with its update time left as it was.
   */
  public static readonly chatTitlesMigrationId: string;
  public static readonly renameDefaultChatTitles: string;
  public static readonly renameDefaultChatTitlesInChanges: string;
  /**
   * The change feed's chat entity before the chat names migration, and the stored chat id field's path before and after it.
   */
  public static readonly legacyChatEntity: string;
  public static readonly legacyChatIdPath: string;
  public static readonly chatIdPath: string;
  /**
   * The chat names migration's fixed id, and its statements: the chat tables and their chat id columns renamed, the indexes on those columns
   * dropped to be created again under the new names, and the change feed's chat entities renamed.
   */
  public static readonly chatNamesMigrationId: string;
  public static readonly renameChatTables: readonly string[];
  public static readonly renameChatIdColumns: readonly string[];
  public static readonly dropLegacyChatIndexes: readonly string[];
  public static readonly renameChatEntities: readonly string[];
  /**
   * The stored JSON fields the chat names migration renames, each at its known path in its table and its change feed entity's payloads, and the
   * tables whose rows also hold the chat id at the top level but have no change feed entity.
   */
  public static readonly renamedChatFields: readonly RenamedJsonField[];
  /**
   * The chat layout names migration's fixed id, and the Projects view layout's fields it renames in the `projectsLayout` preference and its
   * change feed payloads: `pinnedConversations` to `pinnedChats` and `conversationOrder` to `chatOrder`.
   */
  public static readonly chatLayoutNamesMigrationId: string;
  public static readonly renamedLayoutFields: readonly RenamedJsonField[];
  public static readonly chatIdRowTables: readonly string[];
  public static readonly updateMessageCheckpoint: string;
  public static readonly selectMessageCheckpoint: string;
  /**
   * Reads the id of the folder a reply's turn ran in, `null` for a turn from before the folder was kept.
   */
  public static readonly selectMessageCheckpointFolder: string;
  public static readonly updateMessageCheckpointFolder: string;
  /**
   * Bytes above which an added file gets no diff.
   */
  public static readonly maximumDiffBytes: number;
  /**
   * Changed files a reply's working-tree evidence lists at most; the rest are left out.
   */
  public static readonly maximumEvidenceFiles: number;
  /**
   * Bytes of diffs a reply's working-tree evidence reads at most in all; a diff past them is left out.
   */
  public static readonly maximumEvidenceDiffBytes: number;
  /**
   * Milliseconds before a tool's start and after its end within which a file written still counts as written while it ran, for file
   * systems that keep coarse times.
   */
  public static readonly toolWindowSlackMilliseconds: number;
  /**
   * The statuses of a command or file-change step that has ended: Codex's and the ACP agents' `completed`, `failed` and `declined`.
   */
  public static readonly endedToolStatuses: readonly string[];
  /**
   * The field of a terminal tool's step that names its terminal, which keeps running after the step.
   */
  public static readonly terminalIdField: string;
  /**
   * The field of a Claude Code command's input that runs it in the background, past its step.
   */
  public static readonly runInBackgroundField: string;
  /**
   * The start of the key of a step that names neither a tool use nor an item.
   */
  public static readonly unnamedToolWindowPrefix: string;
  /**
   * The start of the key of a background task's window.
   */
  public static readonly taskWindowPrefix: string;
  /**
   * The field of a reply's note that lists, at absolute paths, the files that changed while none of its tools ran.
   */
  public static readonly outsideFilesField: string;
  /**
   * The field, `true`, of a reply's note that its changes details may not list every file it changed, so a rewind past it restores the whole work folder.
   */
  public static readonly partialEvidenceField: string;

  /**
   * How many names a reply's note of changes not made by its tools shows before it counts the rest.
   */
  public static readonly outsideChangesShown: number;
  /**
   * The name of the Git that the evidence asks which changed paths it ignores, looked for in the path's absolute folders with this
   * process's program extension after it.
   */
  public static readonly gitExecutable: string;
  /**
   * The option that runs Git as if started in the folder after it, so Git itself starts in its own folder.
   */
  public static readonly gitFolderOption: string;
  /**
   * The arguments before each Git command that turn the folder's `core.fsmonitor` program off.
   */
  public static readonly gitSafeArguments: readonly string[];
  /**
   * The arguments that list, once and ended by `Resources.nullSeparator`, the untracked paths Git ignores in the folder, a folder ignored
   * whole as one path ending in `/`.
   */
  public static readonly gitListIgnoredArguments: readonly string[];
  /**
   * The arguments that list the index's entries, each ended by `Resources.nullSeparator`, to find its submodules.
   */
  public static readonly gitListStagedArguments: readonly string[];
  /**
   * The arguments that ask Git which of the paths on its input, each ended by `Resources.nullSeparator`, it ignores.
   */
  public static readonly gitCheckIgnoreArguments: readonly string[];
  /**
   * The exit codes with which Git's listings succeed.
   */
  public static readonly gitListedExitCodes: readonly number[];
  /**
   * The exit codes with which Git's ignore check succeeds: some path ignored, or none.
   */
  public static readonly gitCheckedExitCodes: readonly number[];
  /**
   * What begins an index entry that is a submodule.
   */
  public static readonly gitlinkPrefix: string;
  /**
   * What comes before the path in an index entry.
   */
  public static readonly gitStagedPathSeparator: string;
  /**
   * The macOS Git that only stands in for the developer tools' Git, and asks to install them when they are missing.
   */
  public static readonly gitStubPaths: readonly string[];
  /**
   * The macOS program whose presence shows that `Resources.gitStubPaths` stand in for the developer tools' Git.
   */
  public static readonly gitStubMarkerPath: string;
  /**
   * The variable that names macOS's active developer folder, as `xcode-select -p` honours it; when it is set and the folder is missing,
   * the stand-in is passed over.
   */
  public static readonly developerFolderVariable: string;
  /**
   * Where macOS's active developer folder is without `Resources.developerFolderVariable`: the folder `xcode-select` chose, then the
   * Command Line Tools' and Xcode's; when none of them is there, the stand-in is passed over.
   */
  public static readonly developerFolders: readonly string[];
  /**
   * The variable that, set to a positive whole number, replaces `Resources.gitTimeout`; only tests set it.
   */
  public static readonly gitTimeoutVariable: string;
  /**
   * The variable whose folders are looked in for Git, read at each check.
   */
  public static readonly pathVariable: string;
  /**
   * The variable that, set to `Resources.gitOptionalLocksDisabled`, keeps Git from taking the index's lock to refresh it.
   */
  public static readonly gitOptionalLocksVariable: string;
  /**
   * The value of `Resources.gitOptionalLocksVariable` that turns Git's optional locks off.
   */
  public static readonly gitOptionalLocksDisabled: string;
  /**
   * Milliseconds the evidence waits for Git's answer before it ignores nothing.
   */
  public static readonly gitTimeout: number;
  /**
   * Why Git listed no path: the folder is in no repository, or Git couldn't run or ran out of time.
   */
  public static readonly gitIgnoredNone: string;
  /**
   * What ends each path Git reads and writes with `-z`.
   */
  public static readonly nullSeparator: string;
  /**
   * The event a stream emits with a chunk it read.
   */
  public static readonly dataEvent: string;
  /**
   * The event a process or stream emits when it fails.
   */
  public static readonly errorEvent: string;
  /**
   * The event a process emits once it has ended and its streams have closed.
   */
  public static readonly closeEvent: string;
  /**
   * The most cells, the changed lines of the old text times those of the new, a command write's diff compares line by line; past them,
   * texts of as many lines are compared line against line, and others keep one hunk from the first change to the last.
   */
  public static readonly maximumDiffCells: number;
  /**
   * The note on a reply whose working-tree evidence left out files or diffs past its bounds, or was stopped while it was read.
   */
  public static readonly incompleteWorkingTreeEvidence: string;
  /**
   * The note of a reply that ran commands when the chat's folder wasn't compared after it.
   */
  public static readonly uncomparedWorkingTree: string;
  public static readonly utf8Encoding: BufferEncoding;
  /**
   * Lines of unchanged text a command write's diff shows around its change.
   */
  public static readonly diffContextLines: number;
  /**
   * The prefix of an unchanged line in a unified diff.
   */
  public static readonly diffContextPrefix: string;
  /**
   * The prefix of a removed line in a unified diff.
   */
  public static readonly diffRemovedPrefix: string;
  /**
   * The prefix of an added line in a unified diff.
   */
  public static readonly diffAddedPrefix: string;
  /**
   * A carriage return that ends a line read from a file.
   */
  public static readonly trailingCarriageReturnPattern: RegExp;
  /**
   * The home folder as a command names it.
   */
  public static readonly homeFolder: string;
  /**
   * A path a command names from the home folder, such as `~/notes.txt`.
   */
  public static readonly homeTargetPattern: RegExp;
  /**
   * Node's name for Windows.
   */
  public static readonly windowsPlatform: string;
  /**
   * A path that starts at a root but names no drive, which on Windows a POSIX shell and PowerShell read differently.
   */
  public static readonly rootedWithoutDrivePattern: RegExp;
  public static readonly base64Encoding: BufferEncoding;
  /**
   * The directory under the data directory where generated images are stored.
   */
  public static readonly imagesDirectoryName: string;
  /**
   * The directory under the data directory where copies of written images shared with a window's page are kept.
   */
  public static readonly sharedImagesDirectoryName: string;
  /**
   * The most bytes those copies take together, 256 MiB.
   */
  public static readonly sharedImagesByteLimit: number;
  public static readonly imageDataField: string;
  public static readonly subAgentField: string;
  /** The payload field of a posted question's approval naming the provider's id its answer replies to. */
  public static readonly replyToField: string;
  /** The payload field of a user message's `Text` detail holding the prompt the provider gets instead of the shown text. */
  public static readonly promptField: string;
  /**
   * The payload field of a user message's `Text` detail naming the reply it was steered into; the next turn of that reply's session
   * leaves the message out, since the provider already has it.
   */
  public static readonly steeredIntoField: string;
  public static readonly mediaTypeField: string;
  public static readonly storedPathField: string;
  public static readonly filesField: string;
  /**
   * File extension per media type of the images stored.
   */
  public static readonly imageExtensions: Readonly<Record<string, string>>;
  /**
   * Message of the invariant that a resumed native session has an id.
   */
  public static readonly resumedWithoutSession: string;

  /**
   * Historical named author label.
   */
  public static formatParticipantLabel(name: string): string;

  /**
   * How a transcript names a message a teammate sent from another chat: by the chat's title, quoted as a JSON string so that a quote or a
   * line break in it stays inside, and its id, or by its id alone when the chat is gone, then the teammates it was sent to, when it was sent to
   * others than the teammate whose prompt it is in.
   * @param title The chat's current title, or `null` when the chat is gone.
   * @param to The names of the other teammates the message was sent to, `null` for the default teammate; empty names none.
   * @param you Whether it was also sent to the teammate whose prompt it is in, named first as `you` when `to` names anyone.
   */
  public static formatSenderPrefix(name: string, title: string | null, conversationId: string, to?: readonly (string | null)[], you?: boolean): string;

  /**
   * How a transcript names a message a chat's default teammate sent from that chat: as the default teammate, with its provider's display
   * name in parentheses and no `@`, so that it never reads as a teammate of that name, then the chat as `formatSenderPrefix` names it.
   * @param kind The kind's display name.
   * @param title The chat's current title, or `null` when the chat is gone.
   * @param to The names of the other teammates the message was sent to, as `formatSenderPrefix` takes them.
   * @param you Whether it was also sent to the reader, as `formatSenderPrefix` takes it.
   */
  public static formatDefaultSenderPrefix(kind: string, title: string | null, conversationId: string, to?: readonly (string | null)[], you?: boolean): string;

  /**
   * The error for an outside message into a chat that names no teammate and has no teammate that answers it.
   * @param conversationId The chat's id.
   */
  public static formatOutsideNoTeammate(conversationId: string): string;
  public static formatOutsideCapEndsTasks(conversationId: string): string;

  /**
   * The title of a teammate's chat for outside messages.
   * @param name The teammate's name.
   */
  public static formatOutsideChatTitle(name: string): string;

  /**
   * How a transcript names a message from outside TeamRun: from a session that calls itself the quoted label, which no one checked, so the
   * reader treats the message as data from an unknown sender; for the message the turn answers, also that the reader's reply goes back to
   * that session, with no other route to look for.
   * @param label The session's label.
   * @param answering Whether the turn answers this message.
   */
  public static formatOutsideSenderPrefix(label: string, answering?: boolean): string;

  /**
   * An outside message's text, unchanged, between an `outside-message` tag pair whose name carries `id`, after a line saying that only that
   * closing tag ends the message.
   * @param text The text.
   * @param id The tags' id, random for each transcript the message is written into.
   */
  public static formatOutsideText(text: string, id: string): string;

  /**
   * The close of a prompt for a teammate that another teammate's reply hands work to: the handing teammate, then the lines of the reply
   * addressed to this teammate.
   * @param name The handing teammate's name.
   * @param text The lines addressed to this teammate.
   */
  public static formatHandOff(name: string, text: string): string;

  /**
   * The teammates a transcript line was sent to, as " to @A", " to @A and @B" or " to you, @A and the default teammate", or empty when it
   * names no other teammate.
   * @param to The other teammates' names, `null` for the default teammate.
   * @param you Whether it was also sent to the reader, named first as `you`.
   */
  public static formatRecipients(to: readonly (string | null)[], you?: boolean): string;

  /**
   * The scope of a teammate's agent session in a chat: `<conversation id>/<teammate id>`, or `<conversation id>/default`.
   */
  public static formatToolScope(conversationId: string, teammateId: string | null): string;

  /**
   * The failure of a TeamRun tool that isn't read-only, called in a turn whose permission mode only reads, such as Plan.
   * @param tool The tool's name.
   * @param mode The mode's name.
   */
  public static formatReadOnlyModeRefused(tool: string, mode: string): string;

  /**
   * The log line for a permission request whose session is no running turn's, which TeamRun denies without showing it.
   * @param module The id of the module that raised it.
   * @param action The request's action.
   */
  public static formatPermissionWithoutTurn(module: string, action: string): string;

  /**
   * A teammate's instructions, or the default teammate's: its role, when it has one, then `planToolInstructions`, then the adapter's `backgroundSubAgentsNote` when it has one, then, when the turn has the tools or there is a command, the note on handing work to a teammate with a mention
   * that starts the reply or a line, on reading the chats, messages and teammates and reaching other chats' teammates with TeamRun's tools,
   * `teamrun_send_message` among them, when the turn has them, or with `list-chats`, `list-teammates`, `list-messages` and `send` when it
   * doesn't, on how a message a teammate sent from another chat is named, on answering a default teammate by naming no teammate, and on
   * a message sent to other teammates than this one.
   * A turn with the tools gets no command, since a provider's sandbox, such as Codex's, can keep its shell from reaching the app.
   * @param role The teammate's role, or `null`.
   * @param command The app's command and the module's, such as `teamrun teamrun`, that the note's commands begin with, or `null` when the app has none, which leaves the note out of a turn without the tools.
   * @param hasTools Whether the turn has TeamRun's tools, which then replace the commands, and whose note says a read-only mode answers in the reply, since it refuses `teamrun_send_message`; `false` by default.
   * @param subAgentsNote The adapter's `backgroundSubAgentsNote`, or `null`, the default, which leaves it out.
   */
  public static formatTeammateInstructions(role: string | null, command: string | null, hasTools?: boolean, subAgentsNote?: string | null): string;

  /**
   * The note on a reply whose turn a module stopped, from the person's own action, with the module's reason.
   */
  public static formatTurnStopped(reason: string): string;

  /**
   * The note on a teammate's reply, or on a message a teammate sent from another chat, that would go past the hand-off limit: the chain stopped there, and why.
   */
  public static formatChainStopped(limit: number): string;

  /**
   * The note at the top of a reply the provider started on its own: the background task whose end started it, or that a task's end did.
   * @param command The task's command, or `null` when the provider named none.
   */
  public static formatWakeNote(command: string | null): string;

  /**
   * The text of the message that wakes a chat whose sub-agent ended after the turn that started it: the sub-agent, how it ended, and its summary cut
   * at 2,000 characters.
   * @param status The sub-agent's status as it ended.
   * @param summary The sub-agent's summary, or `null` when it ended without one.
   */
  public static formatSubAgentWake(description: string, subAgentId: string, status: string, summary: string | null): string;

  /**
   * The refusal of a background command for a chat that already runs the most commands.
   * @param limit How many one chat runs at once.
   */
  public static formatCommandLimitReached(limit: number): string;

  /**
   * One line of the note that tells a teammate which of its background commands the person stopped.
   * @param description What the command does.
   * @param commandId The command's background task id.
   */
  public static formatStoppedCommand(description: string, commandId: string): string;

  /**
   * The note ahead of a teammate's next prompt in a chat that tells it which of its background commands the person stopped since its last turn
   * there, so it doesn't wait for their wakes.
   * @param lines One `formatStoppedCommand` line per command.
   */
  public static formatStoppedCommands(lines: readonly string[]): string;

  /**
   * The text of the message that wakes a chat whose background command ended: the command, its error, signal or exit code, and its
   * last lines, cut to their last 2,000 characters.
   * @param description What the command does.
   * @param commandId The command's background task id.
   * @param exit How it ended.
   * @param lastLines Its last lines, or an empty string when it wrote none.
   */
  public static formatCommandWake(description: string, commandId: string, exit: CommandExit, lastLines: string): string;

  /**
   * The text of the message that wakes a chat whose background command was still running when TeamRun stopped.
   * @param commandId The command's background task id.
   */
  public static formatCommandWakeLost(commandId: string): string;

  /**
   * A sub-agent's instructions: the teammate's role, when it has one, then `subAgentInstructions`.
   * @param role The teammate's role, or `null`.
   */
  public static formatSubAgentInstructions(role: string | null): string;

  /**
   * The refusal of a sub-agent start that names an agent TeamRun can't run, which names the ones it can.
   * @param agent The agent the start named.
   */
  public static formatSubAgentUnavailable(agent: string): string;

  /**
   * The refusal of an Explorer on a provider with no read-only mode TeamRun can enforce, which names the provider and gives its reason.
   * @param provider The provider's display name.
   * @param reason The provider's own reason, as the adapter's `explorerUnavailable` gives it, or `null` for the general one.
   */
  public static formatExplorerUnavailable(provider: string, reason: string | null): string;

  /**
   * The note under an Explorer's row for an approval TeamRun denied it.
   * @param summary The approval's summary.
   */
  public static formatExplorerDenied(summary: string): string;

  /**
   * The refusal of a sub-agent start for a reply that already runs the most sub-agents.
   * @param limit How many one reply runs at once.
   */
  public static formatSubAgentLimitReached(limit: number): string;

  /**
   * The refusal of a wait or stop that names a sub-agent the turn's reply didn't start.
   * @param subAgentId The id it named.
   */
  public static formatSubAgentNotFound(subAgentId: string): string;

  /**
   * Composes the log line for a sub-agent whose end couldn't be saved.
   */
  public static formatSubAgentNotSaved(subAgentId: string, reason: string): string;

  /**
   * Composes the log line for a sub-agent whose stop failed, logged so the other stops go on.
   */
  public static formatSubAgentNotStopped(subAgentId: string, reason: string): string;

  /**
   * The note after a sub-agent's result that was cut, with how many characters were left out.
   * @param left How many characters were cut.
   */
  public static formatSubAgentResultCut(left: number): string;

  /**
   * Formats a join or continuation for the selected participant: a join opens with who the teammate is, such as "You are @Cursor, a teammate in
   * this TeamRun chat.", then what was said before, and a continuation with the messages since its last reply.
   * @param name The teammate's name, or `null` for the default teammate, which gets only a continuation: its new session takes the transcript preamble.
   * @param joining Whether the teammate starts a new session in the chat.
   * @param transcript The messages it hasn't seen.
   */
  public static formatParticipantContext(name: string | null, joining: boolean, transcript: string): string;

  /**
   * Missing teammate diagnostic.
   */
  public static formatTeammateNotFound(id: string): string;

  /** Missing department diagnostic. */
  public static formatDepartmentNotFound(id: string): string;

  /** Why a teammate outside a department can't lead it. */
  public static formatDepartmentLeaderNotMember(teammate: string, department: string): string;

  /** Why a department can't move under itself or one of its own departments. */
  public static formatDepartmentUnderItself(department: string): string;

  /**
   * Unknown shared MCP server diagnostic.
   */
  public static formatSharedMcpServerNotFound(id: string): string;

  /**
   * Duplicate shared MCP server name diagnostic.
   */
  public static formatSharedMcpServerNameTaken(name: string): string;

  /**
   * Why a provider whose adapter takes no shared MCP servers can't take one.
   */
  public static formatSharedMcpServersUnsupported(provider: string): string;

  /**
   * Why a shared MCP server whose variable isn't set is left out of a session.
   */
  public static formatSharedMcpVariableUnset(variable: string): string;

  /**
   * `formatSharedMcpVariableUnset` in a few words: `<variable> not set`.
   */
  public static formatSharedMcpVariableUnsetShort(variable: string): string;

  /**
   * Why a shared MCP server whose saved secret isn't in Noldova Desktop's secret store on this machine is left out of a session.
   */
  public static formatSharedMcpSecretMissing(variable: string): string;

  /**
   * `formatSharedMcpSecretMissing` in a few words: `<variable>'s saved secret missing`.
   */
  public static formatSharedMcpSecretMissingShort(variable: string): string;

  /**
   * Why a shared MCP server whose saved secret Noldova Desktop's secret store didn't give is left out of a session, with the store's reason.
   */
  public static formatSharedMcpSecretUnreadable(variable: string, reason: string): string;

  /**
   * `formatSharedMcpSecretUnreadable` in a few words: `<variable>'s saved secret unreadable`.
   */
  public static formatSharedMcpSecretUnreadableShort(variable: string): string;

  /**
   * Why a provider that takes no saved secrets can't take a shared MCP server with one.
   */
  public static formatSharedMcpSecretsUnsupported(provider: string): string;

  /**
   * The refusal of a saved secret for a variable the shared MCP server doesn't name.
   */
  public static formatSharedMcpVariableNotNamed(server: string, variable: string): string;

  /**
   * The log's line when a saved secret that no server names any more couldn't be removed, with the store's reason.
   */
  public static formatSharedMcpSecretKept(variable: string, reason: string): string;

  /** The start of a shared MCP server's sign-in reference in Noldova Desktop's secret store, `teamrun.mcpSignIn`. */
  public static readonly sharedMcpSignInReferencePrefix: string;

  /** The bearer token's variable a signed-in server's turn copy names, `TEAMRUN_MCP_ACCESS_TOKEN`. */
  public static readonly sharedMcpAccessVariable: string;

  /** Why a shared MCP server that signs in, with no sign-in yet, is left out of a session. */
  public static readonly sharedMcpSignInNeeded: string;

  /** `sharedMcpSignInNeeded` in a few words, `needs a sign-in`. */
  public static readonly sharedMcpSignInNeededShort: string;

  /** `formatSharedMcpSignInExpired` in a few words, `needs a new sign-in`. */
  public static readonly sharedMcpSignInExpiredShort: string;

  /** `formatSharedMcpServersUnsupported` in a few words, `not passed yet`. */
  public static readonly sharedMcpServersUnsupportedShort: string;

  /** `formatSharedMcpNameClash` in a few words, `name taken in it`. */
  public static readonly sharedMcpNameClashShort: string;

  /** `formatSharedMcpSecretsUnsupported` in a few words, `saved secrets not passed yet`. */
  public static readonly sharedMcpSecretsUnsupportedShort: string;

  /** `formatSharedMcpSignInUnsupported` in a few words, `sign-in not passed yet`. */
  public static readonly sharedMcpSignInUnsupportedShort: string;

  /** The refusal to start a sign-in for a shared MCP server that doesn't sign in. */
  public static formatSharedMcpServerDoesntSignIn(name: string): string;

  /** Why a shared MCP server whose sign-in couldn't be read is left out of a session, with why. */
  public static formatSharedMcpSignInUnreadable(reason: string): string;

  /** Why a shared MCP server whose account's sign-in couldn't be read is left out of a session, with why. */
  public static formatSharedMcpAccountUnreadable(account: string, reason: string): string;

  /** Why a shared MCP server whose sign-in expired is left out of a session, with why. */
  public static formatSharedMcpSignInExpired(reason: string): string;

  /** Why a provider that takes no saved secrets can't take a signed-in shared MCP server. */
  public static formatSharedMcpSignInUnsupported(provider: string): string;

  /** The log's line when a shared MCP server's sign-in couldn't be removed, by the server's name, with the store's reason. */
  public static formatSharedMcpSignInKept(name: string, reason: string): string;

  /** The log's line when a finished sign-in couldn't be kept, by the server's name, with why. */
  public static formatSharedMcpSignInUnsaved(name: string, reason: string): string;

  /**
   * The refusal of a saved secret's reference that another variable, of this server or another, already keeps.
   */
  public static formatSharedMcpSecretTaken(variable: string): string;

  /**
   * The reply's note on a shared MCP server left out of its session, and why.
   */
  public static formatSharedMcpServerLeftOut(name: string, reason: string): string;

  /**
   * Why a turn leaves out a shared MCP server whose name the provider reads as that of another server the turn takes.
   * @param provider The provider's display name.
   * @param other The name of the server the turn takes.
   */
  public static formatSharedMcpNameClash(provider: string, other: string): string;

  /**
   * The reply's note on a shared MCP server its provider couldn't connect to or that needs a sign-in, naming no provider's error text,
   * or that the provider's own settings blocked, with the provider's reason; for a provider that connected none of the turn's MCP servers in
   * a folder it doesn't trust, or that listed none of TeamRun's tools in time, a note that TeamRun's tools aren't in the chat, with the reason.
   */
  public static formatSharedMcpServerFailed(failure: SharedMcpFailure): string;

  /**
   * Duplicate name diagnostic.
   */
  public static formatTeammateNameTaken(name: string): string;

  /**
   * Why a teammate update is refused when another save changed its provider, model or context window while its size was checked.
   */
  public static formatTeammateChangedWhileChecked(name: string): string;

  /**
   * Why a teammate update read on a provider the teammate has since left is refused.
   */
  public static formatTeammateProviderChanged(name: string): string;

  /**
   * Why a context window is refused for a model that offers no choice of one.
   */
  public static readonly contextWindowUnavailable: string;

  /**
   * Why a context window outside the model's bounds is refused: the size in tokens, and the bounds named as "200K" or "1M".
   */
  public static formatContextWindowOutOfBounds(tokens: number, minimum: string, maximum: string): string;

  /**
   * Why Sustain is refused for a teammate whose own provider is of a kind whose usage limits TeamRun can't read: the kind's display name.
   */
  public static formatSustainLimitsUnread(kind: string): string;

  /**
   * Why a Sustain entry naming a provider that doesn't exist is refused.
   */
  public static readonly sustainEntryProviderMissing: string;

  /**
   * Why a Sustain entry on a kind whose usage limits TeamRun can't read is refused: the entry's number and the kind's display name.
   */
  public static formatSustainEntryLimitsUnread(entry: number, kind: string): string;

  /**
   * Why a Sustain entry equal to an earlier one is refused: both entries' numbers (the teammate's own choice being entry 1), the provider as
   * "<kind> · <label>", the model's name, and the effort by the name its model gives it, or else by its id with a capital; a `null` model or effort
   * is named as the default.
   */
  public static formatSustainEntryRepeated(entry: number, earlier: number, provider: string, model: string | null, effortName: string | null,
    effort: string | null): string;

  /**
   * Why a Sustain entry with a model its provider's kind doesn't list is refused: the model and the kind's display name.
   */
  public static formatSustainEntryModelUnlisted(model: string, kind: string): string;

  /**
   * The note on a reply that Sustain moved off an account at its usage limit: the entry it moved to as `formatSustainTarget` names it, and the
   * label of the account that reached its limit; the move starts a new session with a handover.
   */
  public static formatSustainMoved(kind: string, label: string, model: string | null, from: string): string;

  /**
   * The note on a reply that Sustain moved to another account of the same provider, which resumes the same session there: as `formatSustainMoved`,
   * ending "same session".
   */
  public static formatSustainKept(kind: string, label: string, model: string | null, from: string): string;

  /**
   * The note on a reply that Sustain moved to another account of the same provider while the provider still ran a task in the session, so the move
   * starts a new session with a handover: `formatSustainMoved`, then why the session wasn't kept.
   */
  public static formatSustainHeld(kind: string, label: string, model: string | null, from: string): string;

  /**
   * The entry a Sustain note names: the account as `formatSustainAccount` names it, and the model when the entry has one.
   */
  public static formatSustainTarget(kind: string, label: string, model: string | null): string;

  /**
   * An account as every Sustain note names it: the provider's name, then the account's label, even when the two are the same.
   */
  public static formatSustainAccount(kind: string, label: string): string;

  /**
   * The note on a reply that Sustain moved back to the teammate's own account once its usage reset: the entry as `formatSustainTarget` names it.
   */
  public static formatSustainReturned(kind: string, label: string, model: string | null): string;
  public static formatUsageHandedOff(from: string, to: string): string;
  public static formatUsageNoOneLeft(name: string): string;
  public static formatUsageChainStopped(name: string, limit: number): string;

  /**
   * The line a continuation's prompt ends with: what the reply that stopped at a usage limit wrote, and that it goes on from there; or, when it
   * wrote nothing, `sustainStoppedBeforeWriting`.
   */
  public static formatSustainContinued(written: string): string;

  /**
   * The text of a continuation's prompt when the reply that stopped at a usage limit wrote nothing.
   */
  public static readonly sustainStoppedBeforeWriting: string;

  /**
   * The window a handover's target is taken to have when no reply on its provider and model reported one.
   */
  public static readonly handoverDefaultWindowTokens: number;

  /**
   * The least a handover leaves for the provider's own prompt, tools and the work after it.
   */
  public static readonly handoverProviderRoomTokens: number;

  /**
   * The share of the window, as its divisor, a handover leaves for the provider when that is more than `handoverProviderRoomTokens`.
   */
  public static readonly handoverProviderRoomShare: number;

  /**
   * The room a handover leaves for each image the message it answers carries.
   */
  public static readonly handoverImageTokens: number;

  /**
   * The room a handover leaves for each other file the message it answers carries.
   */
  public static readonly handoverFileTokens: number;

  /**
   * The most a handover's history takes, in UTF-8 bytes.
   */
  public static readonly handoverMaximumBytes: number;

  /**
   * The longest tool result a handover keeps whole, in UTF-8 bytes; a longer one keeps half of this from each end.
   */
  public static readonly handoverResultBytes: number;

  /**
   * The payload field that marks a note as a tool call's result.
   */
  public static readonly toolUseIdField: string;

  /**
   * A run of left-out sequence numbers in a handover's left-out line.
   */
  public static formatHandoverRange(from: number, to: number): string;

  /**
   * The line that ends a handover which left messages out, naming them and how the teammate reads them.
   */
  public static formatHandoverLeftOut(ranges: readonly string[], chatId: string): string;

  /**
   * What a handover carried: the chat's first message, by its author when it has one.
   */
  public static formatHandoverCarriedFirst(name: string | null): string;

  /**
   * What a handover carried: the messages kept whole, by sequence ranges, with tool calls as one line each when they hold any, and the results cut.
   */
  public static formatHandoverCarriedWhole(ranges: readonly (readonly [number, number])[], tools: boolean, cuts: readonly number[]): string;

  /**
   * What a handover carried: the messages it left out, by sequence ranges.
   */
  public static formatHandoverCarriedLeftOut(ranges: readonly (readonly [number, number])[]): string;
  /**
   * What a handover carried: the summary, by the provider kind that wrote it, whether it is the session's last compaction summary or one written
   * for the handover, and the messages it covers.
   */
  public static formatHandoverCarriedSummary(author: string, isCompaction: boolean, from: number, to: number): string;

  /**
   * What a handover carried: the message it answers and, for a continuation, what the stopped reply wrote; null when it carries neither.
   */
  public static formatHandoverCarriedAnswer(asked: boolean, continued: boolean): string | null;

  /**
   * The line after what a handover carried when it left messages out: the target's kind reads them with `list-messages`.
   */
  public static formatHandoverReads(kind: string): string;

  /**
   * The line in place of the middle of a tool result a handover cut.
   */
  public static formatHandoverCut(left: number, sequence: number): string;

  /**
   * The compaction summary in a handover, under a line saying it is the session's own summary of the chat before the messages after it.
   */
  public static formatHandoverSummary(summary: string): string;

  /**
   * The line in place of the middle of a compaction summary a handover cut to fit.
   */
  public static formatHandoverSummaryCut(left: number): string;

  /**
   * The prompt of TeamRun's own summary request: what to summarize for the teammate, then the chat before the compaction.
   */
  public static formatOwnSummaryPrompt(history: string): string;

  /**
   * The failure of a summary request that ended without a completed answer.
   */
  public static formatOwnSummaryUnanswered(outcome: string): string;

  /**
   * The log line when TeamRun's own summary couldn't be written, so the handover takes the chat from its beginning.
   */
  public static formatOwnSummaryFailed(providerId: string, reason: string): string;

  /**
   * The log line when a provider couldn't read a session's compaction summary for a handover, which then takes the chat from its beginning.
   */
  public static formatCompactionUnread(providerId: string, reason: string): string;

  /**
   * A tool call in a handover, on one line.
   */
  public static formatHandoverTool(line: string): string;

  /**
   * An entry in `formatSustainAllOut` that was skipped because even the handover's left-out line didn't fit its window.
   */
  public static formatSustainEntryNoRoom(account: string): string;

  /**
   * The end of a reply's stopped line when no Sustain entry is left: why each entry was passed over, in the list's order, such as
   * "Every Sustain entry is out: Claude · Work resets at 18:00, Codex · Team on Nov 14 at 09:00."
   */
  public static formatSustainAllOut(entries: readonly string[]): string;

  /**
   * An account in a reply's stopped line and its Sustain entries: the kind's name and the account's label, as "Claude · Work".
   */
  public static formatStoppedAccount(kind: string, label: string): string;

  /**
   * A reply's error when its turn stopped at a usage limit: "Stopped: Claude · Work reached its usage limit.", then `after`, its reset or the
   * Sustain entries that are out, when there is one.
   */
  public static formatUsageLimitStopped(account: string, after: string | null): string;

  /**
   * The reset in a reply's stopped line, from `formatSustainResetTime`: "It resets at 18:00."
   */
  public static formatUsageLimitResets(time: string): string;

  /**
   * A reset as a local time: "at 18:00" on the same day as `now`, else "on Nov 14 at 09:00".
   */
  public static formatSustainResetTime(resetsAt: string, now: Date): string;

  /**
   * An entry in `formatSustainAllOut` that the reply's chain already tried and whose limit has ended since.
   */
  public static formatSustainEntryTried(account: string): string;

  /**
   * An entry in `formatSustainAllOut` whose account can't reply now, such as one turned off or signed out.
   */
  public static formatSustainEntryUnavailable(account: string): string;

  /**
   * An entry's reset in `formatSustainAllOut`: the account as `formatStoppedAccount` names it and its reset as `formatSustainResetTime` gives it,
   * "Claude · Work resets at 18:00" when `named`, as the list's first entry that is out is, else "Claude · Personal at 21:30"; or that it hasn't
   * said when it resets.
   */
  public static formatSustainEntryReset(account: string, resetsAt: string | null, now: Date, named: boolean): string;

  /**
   * Missing membership diagnostic.
   */
  public static formatMemberNotFound(conversationId: string, teammateId: string): string;

  /**
   * Change-feed key for a membership pair.
   */
  public static memberEntityId(conversationId: string, teammateId: string): string;

  /**
   * Formats the user text and local attachment references.
   * @param text The user text, possibly empty.
   * @param files JSON-encoded name and path records.
   * @returns The prompt, including the data-only file references.
   */
  public static formatAttachmentPrompt(text: string, files: readonly string[]): string;

  /**
   * Adds the line that names the images a turn's model doesn't take.
   * @param prompt The turn's prompt.
   * @param names JSON-encoded names of the images left out.
   * @returns The prompt and the line.
   */
  public static formatImagesLeftOut(prompt: string, names: readonly string[]): string;

  /**
   * Builds the bounded query for a panel's matching replies, omitting text details in SQLite.
   * @param panel The panel whose replies to select.
   * @param ascending Whether to read toward newer replies from an after-sequence cursor.
   * @returns SQL accepting conversation id, exclusive before and after sequences, and limit as parameters.
   */
  public static formatReplyPageQuery(panel: ReplyPanel, ascending: boolean): string;

  /**
   * A statement that moves the value at JSON path `from` to `to` in `column` of `table`, in the rows that have it and match every filter column's value.
   * A row that already has `to` keeps its value there, and `from` goes from every such row.
   */
  public static formatRenameJsonField(table: string, column: string, from: string, to: string, filters: Readonly<Record<string, string>>): string;

  /**
   * A statement that removes the value at JSON `path` from `column` of `table`, in the rows that have it, `null` included, and match every
   * filter column's value.
   */
  public static formatRemoveJsonField(table: string, column: string, path: string, filters: Readonly<Record<string, string>>): string;
  /**
   * Composes the not-found message for an approval.
   */
  public static formatApprovalNotFound(approvalId: string): string;

  /**
   * Composes the not-found message for a TeamRun window that was closed or reloaded.
   */
  public static formatWindowNotFound(windowId: string): string;

  /**
   * Composes the not-found message for a computer-use grant that does not exist or was already revoked.
   */
  public static formatComputerUseGrantNotFound(grantId: string): string;

  /**
   * Names a chat's default teammate as the sender of a message it sends to another chat, as the window names its replies: the kind's display
   * name, then `providerSenderSeparator` and the provider's label, or the kind alone for a provider labelled as its kind.
   * @param kind The provider kind's display name, such as `Codex`.
   * @param label The provider's label, such as `Work`.
   */
  public static formatProviderSender(kind: string, label: string): string;

  /**
   * Composes the conflict message for an approval that is already decided.
   */
  public static formatApprovalNotPending(approvalId: string): string;

  /**
   * Composes the not-found message for a background task.
   */
  public static formatBackgroundTaskNotFound(taskId: string): string;

  /**
   * Composes the log line for a background task whose state couldn't be saved.
   */
  public static formatBackgroundTaskNotSaved(taskId: string, reason: string): string;

  /**
   * Composes the message for a stop the provider refused, with its reason.
   */
  public static formatBackgroundTaskStopFailed(reason: string): string;

  /**
   * Composes the log line for a stop the provider refused for a task of a teammate who left, with the task's id and the failure's kind, never
   * its command.
   */
  public static formatTeammateTaskStopFailed(taskId: string, failureKind: string): string;

  /**
   * Composes the not-found message for a draft's file.
   */
  public static formatDraftFileNotFound(name: string): string;

  /**
   * Composes the refusal of a draft save whose revision is no longer the draft's.
   */
  public static formatDraftStale(conversationId: string): string;

  /**
   * Composes the log line for a draft's files that could not be removed, naming the conversation by its id's last
   * `loggedIdLength` characters.
   */
  public static formatDraftFilesNotRemoved(conversationId: string, reason: string): string;

  /**
   * Composes the log line for a draft the start-up sweep could not read, naming the conversation by its id's last
   * `loggedIdLength` characters.
   */
  public static formatDraftNotRead(conversationId: string, reason: string): string;

  /**
   * Names a failure for a log line by its kind alone: the error's name, and its code when it has one, or the thrown
   * value's type; never its message, which a provider may fill with what it was sent.
   */
  public static formatFailureKind(error: unknown): string;

  /**
   * Names a file removal's failure for a log line: the error's code when it has one, else its name, or the thrown value's type.
   */
  public static formatFailureReason(error: unknown): string;

  /**
   * Names a provider for a log line by its id's last `loggedIdLength` characters, or `noLoggedProvider` without
   * one.
   */
  public static formatLoggedProvider(providerId: string | null): string;

  /**
   * Composes the log line for a reply that ended in an error, with its kind, its provider and the failure's kind.
   */
  public static formatReplyFailed(kind: string, providerId: string | null, failureKind: string): string;

  /**
   * Composes the log line for a sign-in check that failed, with its kind, its provider and the failure's kind.
   */
  public static formatSignInCheckFailed(kind: string, providerId: string, failureKind: string): string;

  /**
   * Composes the log line for a found profile folder whose sign-in check failed, with its kind and the failure's kind only.
   */
  public static formatFoundProfileCheckFailed(kind: string, failureKind: string): string;

  /**
   * Composes the not-found message for a conversation.
   */
  public static formatConversationNotFound(conversationId: string): string;

  /**
   * Composes the not-found message for a message.
   */
  public static formatMessageNotFound(messageId: string): string;

  /**
   * Shows the answer to a posted question in the chat: the question's lines quoted, then the answer.
   * @param question The question's text.
   * @param answer The answer.
   * @returns The message text.
   */
  public static formatQuestionReply(question: string, answer: string): string;

  /**
   * Composes the conflict message for a message that is not a running reply.
   */
  public static formatMessageNotOpen(messageId: string): string;

  /**
   * Composes the internal error for a reply whose message holds no provenance.
   */
  public static formatReplyWithoutProvenance(messageId: string): string;

  /**
   * Composes the invalid-parameters message for a relative profile directory.
   */
  public static formatProfileDirNotAbsolute(profileDir: string): string;

  /**
   * Composes the invalid-parameters message for a relative server path.
   */
  public static formatBinaryPathNotAbsolute(binaryPath: string): string;

  /**
   * Composes the invalid-parameters message for a server path given to a provider whose kind doesn't choose one.
   */
  public static formatBinaryPathUnavailable(kind: string): string;

  /**
   * Composes the conflict message for a new profile folder that already exists.
   */
  public static formatProfileFolderExists(label: string, folder: string): string;

  /**
   * Composes the conflict message for a profile folder another provider already uses, naming that provider and the folder.
   */
  public static formatProfileFolderInUse(label: string, folder: string): string;

  /**
   * Composes the invalid-parameters message for a label that leaves no folder name.
   */
  public static formatProfileFolderNameless(label: string): string;

  /**
   * Composes the not-found message for a project.
   */
  public static formatProjectNotFound(projectId: string): string;

  /**
   * Composes the invalid-parameters message for a provider of another kind.
   */
  public static formatProviderMismatch(providerId: string, kind: string): string;

  /**
   * Composes the invalid-parameters message for a person's send that names a kind and no provider.
   */
  public static formatProviderRequired(kind: string): string;

  /**
   * Composes the not-found message for a provider.
   */
  public static formatProviderNotFound(providerId: string): string;

  /**
   * Composes the message refusing a sign-in check, a sign-in or a send on a disabled provider.
   */
  public static formatProviderDisabled(label: string): string;

  /**
   * Composes the checkpoints id of a folder attached to a chat, from a hash of its path, so every chat attached to one folder shares its
   * checkpoints as a project's chats do.
   */
  public static formatAttachedFolderId(hash: string): string;

  /**
   * Composes the reply's note when the folder attached to its chat is missing or can't be read, so the provider didn't start.
   */
  public static formatAttachedFolderMissing(path: string): string;

  /**
   * Composes the reply's note when the folder attached to its chat didn't answer in time, so the provider didn't start.
   */
  public static formatAttachedFolderUnreachable(path: string): string;

  /**
   * Composes the refusal of a folder to attach that is missing, can't be read or didn't answer in time.
   */
  public static formatFolderNotAttached(path: string): string;

  /**
   * Composes the refusal of a folder to attach whose path isn't absolute.
   */
  public static formatFolderNotAbsolute(path: string): string;

  /**
   * Composes the refusal to attach a folder to a chat in a project.
   */
  public static formatChatInProject(conversationId: string): string;

  /**
   * Composes the reply's note when the project's folder is missing, so the provider didn't start.
   */
  public static formatWorkFolderMissing(path: string): string;

  /**
   * Composes the log line for a check of a project's folder, begun as the project opened, that failed.
   */
  public static formatFolderCheckFailed(path: string, error: string): string;

  /**
   * Composes the reply's note when the check of the project's folder didn't answer before its
   * deadline, so the provider didn't start.
   */
  public static formatWorkFolderUnreachable(path: string): string;

  /**
   * Composes the message refusing a send to a teammate whose provider is disabled.
   */
  public static formatTeammateProviderDisabled(teammate: string, label: string): string;

  /**
   * Explains that TeamRun doesn't install a provider.
   */
  public static formatInstallUnavailable(kind: string): string;

  /**
   * The reason an install failed with when its error gave none.
   */
  public static readonly installFailed: string;
  /**
   * What splits a version into the numbers `ProviderKindVersions` compares: `.`.
   */
  public static readonly versionSeparator: string;

  /**
   * Composes the argument message for registering a provider twice.
   */
  public static formatKindAlreadyRegistered(kind: string): string;

  /**
   * Composes the not-found message for a provider that is not registered.
   */
  public static formatKindNotRegistered(kind: string): string;

  /**
   * Composes a send's ask title, which names its chat.
   */
  public static formatSendMessageRequest(title: string): string;

  /**
   * Composes the conflict message for a conversation whose reply is still open.
   */
  public static formatReplyInProgress(conversationId: string): string;

  /**
   * Composes the conflict message for a reply whose plan doesn't wait for approval.
   */
  public static formatPlanNotAwaitingApproval(messageId: string): string;

  /**
   * Composes the invalid-parameters message for a relative root path.
   */
  public static formatRootPathNotAbsolute(rootPath: string): string;

  /**
   * Composes the text of the error detail appended to a failed reply.
   */
  public static formatTurnFailed(error: string): string;

  /**
   * Composes the not-found message for a message outside the conversation.
   */
  public static formatMessageNotInConversation(messageId: string, conversationId: string): string;

  /**
   * Composes the label of the checkpoint taken of a project's folder before a reply.
   * @param replyId The reply's id.
   */
  public static formatCheckpointLabel(replyId: string): string;

  /**
   * Says, in plain words, why a rewind restored no files, by the checkpoints module's preview or restore outcome.
   * @param outcome The outcome's wire value.
   */
  public static formatRestoreRefusal(outcome: string): string;

  /**
   * Composes the log message for a reply whose checkpoint the checkpoints module didn't take.
   */
  public static formatCheckpointNotTaken(replyId: string, failureKind: string): string;

  /**
   * Composes the log message for a reply whose changes the checkpoints module couldn't compare.
   */
  public static formatChangesNotCompared(replyId: string, failureKind: string): string;

  /**
   * Renders a query as a case-insensitive LIKE pattern with its wildcards escaped.
   * @param query The text to find.
   * @returns The pattern.
   */
  public static formatLikePattern(query: string): string;

  /**
   * Renders the SQL expression for a message row's text details joined by spaces, or null when its JSON isn't valid.
   * @param row The message row's name in the statement, such as `new`.
   * @returns The expression.
   */
  public static formatMessageText(row: string): string;

  /**
   * Renders a text as one FTS5 phrase, its double quotes doubled, so its words and symbols are matched as written.
   * @param query The text to find.
   * @returns The phrase.
   */
  public static formatMatchPhrase(query: string): string;

  /**
   * Renders a text as a GLOB pattern that finds it anywhere, each character that folds with others as a bracket of its fold class,
   * and each GLOB special in brackets, so it matches case-insensitively as the trigram index does.
   * @param query The text to find.
   * @returns The pattern.
   */
  public static formatGlobPattern(query: string): string;

  /**
   * Gives every character up to `lastFoldedCodePoint` that folds with a character, from a table made on the first call: a
   * character folds to the lower case of its upper case, or to its own lower case when its upper case is more than one character,
   * so the final sigma folds with the sigma, the sharp s with the capital sharp s and a titlecase digraph with its two other cases.
   * @param character The character, one code point.
   * @returns The characters that fold with it, itself among them; itself alone when none does.
   */
  public static foldClassOf(character: string): string;

  /**
   * Renders the part of a text around the first match of a query, whitespace collapsed, with an ellipsis where the text
   * goes on.
   * @param text The text.
   * @param query The text found in it.
   * @returns The snippet.
   */
  public static formatSnippet(text: string, query: string): string;

  /**
   * Says that a chat's move into a project was refused, naming the paths the project already holds.
   * @param paths The clashing paths, relative to the chat's folder.
   * @returns The refusal.
   */
  public static formatMoveClash(paths: readonly string[]): string;

  /**
   * Says that a chat's move into a project was refused, naming the links that would point elsewhere once moved.
   * @param paths The links, relative to the chat's folder.
   * @returns The refusal.
   */
  public static formatMoveLinks(paths: readonly string[]): string;

  /**
   * The log line of a move that failed with copies it couldn't remove from the project, which the person removes by hand.
   * @param conversationId The conversation id.
   * @param paths The copies left, in the order the removal tried them.
   * @returns The line.
   */
  public static formatMoveCopiesKept(conversationId: string, paths: readonly string[]): string;

  /**
   * The log line of an answer to a posted question that couldn't be sent.
   * @param conversationId The conversation id.
   * @param reason The failure's name.
   * @returns The line.
   */
  public static formatQuestionReplyNotSent(conversationId: string, reason: string): string;

  /**
   * The log line of a chat folder that was kept.
   * @param conversationId The conversation id.
   * @param reason Why, in plain words or by the failure's name.
   * @returns The line.
   */
  public static formatChatFolderKept(conversationId: string, reason: string): string;

  /**
   * The log line when a provider could not close the sessions a deleted chat kept open between turns.
   * @param kind The provider kind.
   * @param reason Why, by the failure's name.
   * @returns The line.
   */
  public static formatKeptSessionsNotClosed(kind: string, reason: string): string;

  /**
   * The log line of a start whose chats' folders couldn't be listed, so none was released.
   * @param reason The failure's name.
   * @returns The line.
   */
  public static formatChatFoldersNotSwept(reason: string): string;

  /**
   * The log line of a start whose shared images couldn't be cleaned, so the start went on without it.
   * @param reason The failure's name.
   * @returns The line.
   */
  public static formatSharedImagesNotCleaned(reason: string): string;

  /**
   * The log line of a shared image the system wouldn't remove yet, such as one a page still has open, which stays until a later clean.
   * @param name The copy's file name.
   * @param reason The failure's name.
   * @returns The line.
   */
  public static formatSharedImageNotRemoved(name: string, reason: string): string;

  /**
   * Describes a project operation conflict.
   * @param root The occupied project root.
   * @returns The conflict message.
   */
  public static formatProjectBusy(root: string): string;

  /**
   * Composes the prompt of the first message after a rewind: the kept transcript, then the message, said by the user or sent from another chat.
   * @param fromPerson Whether the person wrote the message, rather than a teammate of another chat.
   */
  public static formatTranscriptPreamble(transcript: string, text: string, fromPerson: boolean): string;

  /**
   * Composes the text of the file-change detail read from the working tree.
   */
  public static formatWorkingTreeChanges(names: string): string;

  /**
   * Composes the note that a reply's commands ran in the named folders, outside the chat's folder, where they may have changed files
   * they didn't name.
   */
  public static formatCommandsOutsideFolders(folders: string): string;

  /**
   * Composes the note that a reply's commands ran outside the chat's folder, where they may have changed files they didn't name; the
   * chat's folder is named when the outside folders are too long to name.
   */
  public static formatCommandsOutsideFolder(folder: string): string;

  /**
   * Composes the text of a reply's step that lists the files its commands named and changed outside the chat's folder.
   */
  public static formatCommandWrites(names: string): string;

  /**
   * Composes the text of a reply's note that lists the files that changed in the chat's folder while the reply ran but none of its tools
   * did, which its changes leave out: the first `outsideChangesShown` names, then how many more.
   */
  public static formatOutsideChanges(names: readonly string[]): string;

  /**
   * Composes the file lines of a unified diff, with `/dev/null` for the side where the file didn't exist.
   */
  public static formatDiffFiles(from: string | null, to: string | null): string;

  /**
   * Composes a unified diff's hunk line, from the 0-based first line and the count of lines of the old text and of the new.
   */
  public static formatDiffHunk(oldFirst: number, oldCount: number, newFirst: number, newCount: number): string;

  /**
   * Composes the unified diff of a file added whole.
   */
  public static formatAddedFileDiff(path: string, lines: readonly string[]): string;

  /**
   * Composes the file name of a stored image.
   */
  public static formatImageFileName(messageId: string, sequence: number, extension: string): string;

  /**
   * Composes the invalid-parameters message for a decision option the approval does not offer.
   */
  public static formatAnswersMismatch(approvalId: string): string;
  public static formatUnknownDecisionOption(approvalId: string, optionId: string): string;

  /**
   * Composes the message for a method the protocol does not define.
   */
  public static formatUnknownMethod(method: string): string;
}

/**
 * The migration that creates the initial schema: the record tables with an id, a JSON column, and
 * timestamps beside their indexed columns, declared against the protocol models so column names
 * follow property names. Projects also carry their unique `rootPath`. The change feed's table
 * belongs to the foundation Data packages.
 */
export declare class InitialMigration extends SqlMigration {
  /**
   * Initializes the migration with `Resources.initialMigrationId`.
   */
  public constructor();

  /**
   * Declares the tables, keys, and indexes.
   * @param builder The builder that collects them.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * The migrations of this version of TeamRun, in id order.
 */
export declare class MigrationCatalog {
  /**
   * Every migration, oldest first.
   */
  public static readonly all: readonly SqlMigration[];
}

/**
 * The bookkeeping of one running reply: its abort signal, the cancellation flag, and the decision
 * the turn may be waiting for. A reply whose work outlives its turn, such as a sub-agent or a background
 * task, keeps its decisions open past the turn's close until that work ends.
 */
export declare class ActiveRun {
  /**
   * Id of the reply message the run produces.
   */
  public readonly messageId: string;

  /**
   * Initializes the run.
   * @param messageId Id of the reply message; must not be blank.
   * @throws ArgumentException when the id is blank.
   */
  public constructor(messageId: string);

  /**
   * The signal the adapter watches; aborted by `cancel`.
   */
  public get signal(): AbortSignal;

  /**
   * True once {@link cancel} or {@link cancelAfterTurn} was called.
   */
  public get isCancelled(): boolean;

  /**
   * True while `awaitDecision` is pending.
   */
  public get isAwaitingDecision(): boolean;

  /**
   * True until the run's decisions close: at {@link close}, unless {@link keepOpen} came first, and then at
   * {@link release} or {@link cancel}.
   */
  public get isOpen(): boolean;

  /**
   * Settles once the run's decisions close.
   */
  public get released(): Promise<void>;

  /**
   * Registers one independently addressable approval decision.
   * @param approvalId The nonblank approval id; must not already be pending.
   * @returns The pending decision: the parameters the user decided with.
   * @throws ArgumentException when the identifier is blank.
   * @throws ServiceException when the run is closed or cancelled, or the identifier is already pending.
   */
  public awaitDecision(approvalId: string): Promise<ApprovalDecideParams>;

  /**
   * Checks whether this run is waiting for the named approval.
   * @param approvalId The approval identifier.
   * @returns Whether a live decision exists for the identifier.
   */
  public hasDecision(approvalId: string): boolean;

  /**
   * Resolves only the pending decision `params` names, with `params`.
   * @param params The decision: the approval, the chosen option and any answers.
   * @returns `true` when a decision was pending, `false` otherwise.
   */
  public decide(params: ApprovalDecideParams): boolean;

  /**
   * Rejects only the named pending decision, with a `Conflict` `ServiceException` whose argument is the
   * approval's id, and leaves the run and its other decisions as they are.
   * @param approvalId The approval identifier.
   * @returns `true` when a decision was pending, `false` otherwise.
   */
  public withdraw(approvalId: string): boolean;

  /**
   * Gives a signal for the work after the turn, such as reading what it changed, which only a cancel from now on
   * aborts, so a turn the person stopped still gets that work.
   * @returns The signal, which a later call replaces.
   */
  public afterTurn(): AbortSignal;

  /**
   * Keeps the decisions open past the next {@link close}, for the work that outlives the turn, until
   * {@link release} or {@link cancel}; does nothing once the run is cancelled.
   * @param stopAfterTurn How {@link cancelAfterTurn} stops that work.
   */
  public keepOpen(stopAfterTurn: () => Promise<void>): void;

  /**
   * Marks the run cancelled, rejects every pending decision, also one {@link keepOpen} kept, and aborts the signal and the one
   * {@link afterTurn} gave.
   */
  public cancel(): void;

  /**
   * Cancels a run that {@link keepOpen} kept past its turn: marks it cancelled, rejects every pending decision and refuses later ones, and
   * stops the work that outlives the turn as {@link keepOpen} was told; the run stays open until that work ends, so a later call tries again.
   * @returns Once the stop has been asked for.
   * @throws The stop's error when it is refused.
   */
  public cancelAfterTurn(): Promise<void>;

  /**
   * Closes the turn: aborts the signal and, unless {@link keepOpen} came first, closes the decisions as {@link release} does.
   * Does not mark a completed run as user-cancelled; safe to call repeatedly.
   */
  public close(): void;

  /**
   * Closes the decisions: rejects every pending one, and later ones, with a `Conflict` `ServiceException` whose argument
   * is the message id, and settles {@link released}. Safe to call repeatedly.
   */
  public release(): void;
}

/**
 * A Noldova Desktop permission request as a reply shows it: its action, its title, and a payload with the requesting module,
 * the subject, the risk and the details, which holds no secret's value.
 */
export declare class PermissionAsk {
  /**
   * The request's action, such as `teamrun.deleteChat`.
   */
  public readonly action: string;
  /**
   * One line that tells the person what the agent wants to do.
   */
  public readonly title: string;
  /**
   * The module, the subject, the risk and the details, for the window.
   */
  public readonly payload: JsonValue;
  /**
   * Whether the base remembers the person's allowing for the chat, so the approval offers Allow in this chat instead of Allow once.
   */
  public readonly remembersInChat: boolean;
  /**
   * The module's label for the option the base remembers, such as `Allow for this chat`, offered between Allow once and Deny; `null` for none.
   */
  public readonly allowAlwaysLabel: string | null;
  /**
   * The module's label for doing it oneself, such as `I'll type it myself`, offered after Deny; `null` for none.
   */
  public readonly takeOverLabel: string | null;
  /**
   * The request's id: the base's `PermissionQuestion.id`, which its `PermissionRecord.id` matches, or a new id.
   */
  public readonly id: string;
  /**
   * Whether the card offers Allow once; false for a request that offers only the module's Allow always, such as the Browser's ask to open a
   * site the project hasn't allowed.
   */
  public readonly offersAllowOnce: boolean;

  /**
   * Initializes the ask.
   * @param action The action; must not be blank.
   * @param title The title; must not be blank.
   * @param payload The payload.
   * @param remembersInChat Whether the base remembers the allowing for the chat.
   * @param allowAlwaysLabel The module's allow-always label, or `null`; must not be blank.
   * @param takeOverLabel The module's take-over label, or `null`; must not be blank.
   * @param id The request's id; a new id by default.
   * @param offersAllowOnce Whether the card offers Allow once; true, the default.
   * @throws ArgumentException when a text or a label is blank, or when the ask offers no way to allow: no Allow once, no allowing in the
   * chat and no allow-always label.
   */
  public constructor(action: string, title: string, payload: JsonValue, remembersInChat: boolean, allowAlwaysLabel?: string | null,
    takeOverLabel?: string | null, id?: string, offersAllowOnce?: boolean);
}

/**
 * A provider's request for permission during a turn, as the adapter reports it: the provider's own
 * request id and kind, TeamRun's classification, a summary, the payload, and the options offered.
 */
export declare class ApprovalAsk {
  /**
   * The provider's id of the request.
   */
  public readonly providerRequestId: string;
  /**
   * TeamRun's classification for rendering.
   */
  public readonly kind: ApprovalKind;
  /**
   * The provider's own kind, verbatim.
   */
  public readonly nativeKind: string;
  /**
   * One line for the user.
   */
  public readonly summary: string;
  /**
   * The provider's payload, verbatim.
   */
  public readonly payload: JsonValue;
  /**
   * The options the provider offers; a copy.
   */
  public readonly options: readonly ApprovalOption[];

  /**
   * Initializes the ask.
   * @param providerRequestId The provider's request id; must not be blank.
   * @param kind TeamRun's classification.
   * @param nativeKind The provider's kind; must not be blank.
   * @param summary One line for the user; must not be blank.
   * @param payload The provider's payload.
   * @param options The offered options; at least one.
   * @throws ArgumentException when a text is blank or there are no options.
   */
  public constructor(
    providerRequestId: string,
    kind: ApprovalKind,
    nativeKind: string,
    summary: string,
    payload: JsonValue,
    options: readonly ApprovalOption[]);
}

/**
 * A provider's questions for the user during a turn, as the adapter reports them: the provider's own
 * request id and kind, and the questions in the order asked.
 */
export declare class QuestionAsk {
  /**
   * The provider's id of the request.
   */
  public readonly providerRequestId: string;
  /**
   * The provider's own kind, verbatim.
   */
  public readonly nativeKind: string;
  /**
   * The questions; a copy.
   */
  public readonly questions: readonly ApprovalQuestion[];
  /**
   * The description of the sub-agent that asks, or `null` when the reply's own agent asks.
   */
  public readonly subAgent: string | null;

  /**
   * Initializes the ask.
   * @param providerRequestId The provider's request id; must not be blank.
   * @param nativeKind The provider's kind; must not be blank.
   * @param questions The questions; at least one.
   * @param subAgent The description of the sub-agent that asks; `null` by default, for the reply's own agent.
   * @throws ArgumentException when a text is blank or there are no questions.
   */
  public constructor(providerRequestId: string, nativeKind: string, questions: readonly ApprovalQuestion[], subAgent?: string | null);
}

/**
 * A listener's registration with an `EventHub`; disposing it stops the delivery.
 */
export declare class EventSubscription implements Disposable {
  /**
   * Initializes the subscription over the hub's listener set.
   * @param listeners The hub's listeners.
   * @param listener The registered listener.
   */
  public constructor(listeners: Set<IEventListener>, listener: IEventListener);

  /**
   * True until disposed.
   */
  public get isActive(): boolean;

  /**
   * Removes the listener.
   */
  public [Symbol.dispose](): void;
}

/**
 * The version of a provider's program that is installed and the one an install would bring now.
 */
export declare class ProviderKindVersions {
  /**
   * Both versions unknown.
   */
  public static readonly unknown: ProviderKindVersions;

  /**
   * The installed version, or `null` when it isn't installed or its version can't be read.
   */
  public readonly installed: string | null;
  /**
   * The version an install would bring now, or `null` when it can't be read.
   */
  public readonly latest: string | null;

  /**
   * Initializes the versions.
   * @param installed The installed version, or `null`.
   * @param latest The version an install would bring now, or `null`.
   */
  public constructor(installed: string | null, latest: string | null);

  /**
   * `latest` when both are known and it is newer than `installed`, comparing their dot-separated numbers in order, each missing one as 0 and each
   * number's own suffix ignored, or when `installed` can't be read, so an install a quit cut short can be repaired; otherwise `null`, so an
   * installed version newer than `latest` offers no downgrade.
   */
  public get update(): string | null;
}

/**
 * What a plan read found: the windows and, when the same read names it, the plan.
 */
export declare class PlanReading {
  /**
   * The windows the provider reported, each once.
   */
  public readonly windows: readonly PlanWindow[];
  /**
   * The plan's code as the provider names it, such as Copilot's `planTier`, or `null` when the read named none.
   */
  public readonly plan: string | null;

  /**
   * Initializes the reading.
   * @param windows The windows, copied.
   * @param plan The plan's code, or `null`; defaults to `null`.
   */
  public constructor(windows: readonly PlanWindow[], plan?: string | null);
}

/**
 * What a sign-in check observed.
 */
export declare class SignInCheck {
  /**
   * The observed status.
   */
  public readonly authStatus: AuthStatus;
  /**
   * The observed identity, or `null` when none was reported.
   */
  public readonly identity: ProviderIdentity | null;
  /**
   * The observed harness version, or `null`.
   */
  public readonly harnessVersion: string | null;
  /**
   * The check's error, or `null` when it succeeded.
   */
  public readonly error: string | null;

  /**
   * Initializes the check.
   * @param authStatus The observed status.
   * @param identity The observed identity, or `null`.
   * @param harnessVersion The observed harness version, or `null`.
   * @param error The check's error, or `null`.
   */
  public constructor(authStatus: AuthStatus, identity: ProviderIdentity | null, harnessVersion: string | null, error: string | null);
}

/**
 * Where a kind's profile folders may be on this computer, and the entry names that make a folder one of them.
 */
export declare class ProfileSearch {
  /**
   * The folders to look in, each with the folders beside it whose names start with its name.
   */
  public readonly folders: readonly string[];
  /**
   * The names of files or folders a profile folder of the kind holds; a folder that holds none of them isn't one.
   */
  public readonly entries: readonly string[];
  /**
   * The folders that are never a profile folder of the kind, even when they hold an entry, such as a folder the kind keeps beside its profiles.
   */
  public readonly skipped: readonly string[];

  /**
   * Initializes the search.
   * @param folders The folders to look in, each an absolute path; none for a kind found only in TeamRun's own profiles folder.
   * @param entries The entry names, at least one.
   * @param skipped The folders never offered, each an absolute path; none by default.
   * @throws ArgumentException when a folder or a skipped folder isn't absolute, or when `entries` is empty or holds a blank name.
   */
  public constructor(folders: readonly string[], entries: readonly string[], skipped?: readonly string[]);
}

/**
 * The command a teammate's instructions name for reaching other chats, and what its turn needs to run it.
 */
export declare class TeammateCommand {
  /**
   * The app's command and the module's, such as `teamrun teamrun`, that the note's commands begin with.
   */
  public readonly words: string;
  /**
   * The variables the turn's processes get so that the command runs, such as a `PATH` that leads with the command's folder.
   */
  public readonly environment: Readonly<Record<string, string>>;

  /**
   * Initializes the command.
   * @param words The command's words.
   * @param environment The variables the turn needs; none by default.
   */
  public constructor(words: string, environment?: Readonly<Record<string, string>>);
}

/**
 * TeamRun's tools for one turn: the host that lists and calls them in process, the tools a provider runs without asking, and the
 * member's endpoint, which every provider reaches the tools through.
 */
export declare class TurnTools {
  /**
   * Lists and calls the tools in the member's latest open agent session, so that a provider which keeps its session across turns,
   * as Claude does, reaches each later turn's session, a wake's included; with none open, a listing fails as `Unavailable` and a call
   * answers `Unavailable (teamrun.noRunningTurn)`.
   */
  public readonly host: IMcpToolHost;
  /** The tools a provider runs without asking the person, copied on construction. */
  public readonly approvedTools: readonly string[];
  /** TeamRun's MCP endpoint for this turn's member, for a provider that takes it over HTTP; null while the endpoint isn't serving. */
  public readonly endpoint: McpEndpoint | null;

  /**
   * Initializes the tools.
   * @param host The member's host.
   * @param approvedTools The tools a provider runs without asking the person.
   * @param endpoint The member's endpoint; none by default.
   */
  public constructor(host: IMcpToolHost, approvedTools: readonly string[], endpoint?: McpEndpoint | null);

  /** Settles once the turn's endpoint has first listed the tools, which is when the provider's MCP client has connected to TeamRun's server. */
  public get listed(): Promise<void>;

  /** Whether the turn's endpoint has listed the tools yet, as `listed` settling says. */
  public get isListed(): boolean;

  /** Settles with the error once listing the tools to the turn has failed, which is when the provider's MCP client can't take them. */
  public get failed(): Promise<unknown>;

  /** Settles `listed`; later calls do nothing. */
  public markListed(): void;

  /**
   * Settles `failed` with the error that listing the tools gave; later calls do nothing.
   * @param error The error.
   */
  public markFailed(error: unknown): void;

  /**
   * Moves a kept token to this turn's endpoint session, as `McpEndpoint.adopt` does.
   * @param token The kept token.
   * @returns Whether the token moved; false with no endpoint, or when the endpoint refuses it.
   */
  public adopt(token: string): boolean;
}

/**
 * What one tool call kept for its step in the reply and not for the agent: fields to add to the step's payload, and an image to store
 * with it. The step is the reply's first step not yet given a record whose payload names the same `servedTool` and, when it keeps it,
 * the same `servedInput`: the tool TeamRun's MCP server served and its input, which the providers' readers add to such a call's step.
 */
export declare class ToolCallRecord {
  /**
   * The tool's name as TeamRun's MCP server serves it, such as `browser_click`.
   */
  public readonly tool: string;
  /**
   * The call's input.
   */
  public readonly input: JsonObject;
  /**
   * The fields to add to the step's payload.
   */
  public readonly fields: JsonObject;
  /**
   * The image to store with the step, as base64 data and its media type, or null.
   */
  public readonly image: { readonly data: string; readonly mediaType: string } | null;
  /**
   * The permission request that decided the call, as Noldova Desktop's `PermissionRecord` gives its `id`, `risk`, `decision` and `isRemembered`,
   * or null when the call raised none. The step's payload keeps it as `permission`, with `isAsked`, whether the reply showed a card for it.
   */
  public readonly permission: { readonly id: string; readonly risk: string; readonly decision: string; readonly isRemembered: boolean } | null;

  /**
   * Initializes the record.
   * @param tool The tool's name; not blank.
   * @param input The call's input.
   * @param fields The fields to add to the step's payload.
   * @param image The image to store with the step, or null, the default.
   * @param permission The permission request that decided the call, or null, the default.
   * @throws ArgumentException when the tool's name is blank.
   */
  public constructor(tool: string, input: JsonObject, fields: JsonObject, image?: { readonly data: string; readonly mediaType: string } | null,
    permission?: { readonly id: string; readonly risk: string; readonly decision: string; readonly isRemembered: boolean } | null);

  /**
   * Whether a step's payload is of this call: the same tool, and the same input in any order of its keys, or no input when the
   * provider kept none.
   * @param tool The step's `servedTool` field.
   * @param input The step's `servedInput` field, or undefined when it has none.
   * @returns Whether the step is this call's.
   */
  public isCallOf(tool: JsonValue | undefined, input: JsonValue | undefined): boolean;
}

/**
 * One detail of a reply as the adapter reports it.
 */
export declare class TurnDetail {
  /**
   * The detail's kind.
   */
  public readonly kind: DetailKind;
  /**
   * The detail's text.
   */
  public readonly text: string;
  /**
   * The detail's structured payload, or `null`.
   */
  public readonly payload: JsonValue;
  /**
   * The provider's id of the item, for deduplication, or `null`.
   */
  public readonly providerItemId: string | null;
  /**
   * The provider's item id of the `SubAgent` detail whose sub-agent this detail belongs to, or `null` for a detail of the reply itself.
   */
  public readonly parentItemId: string | null;

  /**
   * Initializes the detail.
   * @param kind The kind.
   * @param text The text.
   * @param payload The payload, or `null`.
   * @param providerItemId The provider's item id, or `null`; a non-null id must not be blank.
   * @param parentItemId The item id of the sub-agent's `SubAgent` detail it belongs to, or `null`, the default; a non-null id must not be
   * blank, and a `Text` detail names none.
   * @throws ArgumentException when a non-null item id is blank, or a `Text` detail names a parent.
   */
  public constructor(kind: DetailKind, text: string, payload: JsonValue, providerItemId: string | null, parentItemId?: string | null);
}

/**
 * What an adapter needs to run one turn.
 */
export declare class TurnRequest {
  /**
   * Saved files for this turn, copied on construction. Images are native provider inputs; other files are referenced in the prompt.
   */
  public readonly attachments: readonly MessageAttachment[];
  /**
   * Optional participant role captured for this user message.
   */
  public readonly instructions: string | null;
  /**
   * Full capped context if a native resume must start a fresh session.
   */
  public readonly freshPrompt: string | null;
  /**
   * Variables the provider sets in the agent's process, copied on construction: the token of a teammate's or the default teammate's turn,
   * which Core revokes when the turn ends, so `teamrun send` run from it during the turn is sent as that teammate from its chat.
   */
  public readonly environment: Readonly<Record<string, string>>;
  /**
   * Whether the user's message asks the resumed session to compact its context: its text, without its mentions, is exactly `/compact`,
   * and it has no files. The provider then sends its own compaction instead of the prompt; when it can't resume the session, or can't
   * compact, it runs no prompt and answers with a note.
   */
  public readonly compacts: boolean;
  /**
   * TeamRun's tools for the turn, which the provider serves to the agent as the MCP server `teamrun`, or `null` when the app gives none.
   */
  public readonly tools: TurnTools | null;
  /**
   * The shared MCP servers the turn's teammate gets, by their definitions; no value is in them, so the provider reads each variable from its own
   * environment, or from `sharedValues` for a saved secret. Empty by default.
   */
  public readonly sharedServers: readonly SharedMcpServerDefinition[];
  /**
   * The saved secrets' values of `sharedServers`, read as the turn starts; held where no serializing or logging reaches them. None by default.
   */
  public readonly sharedValues: SharedMcpValues;
  /**
   * Whether the turn is a background session with no tools, kept out of the provider's own list where it allows.
   */
  public readonly isolated: boolean;
  /**
   * The provider whose profile runs the turn, or `null` for the provider's default profile.
   */
  public readonly provider: Provider | null;
  /**
   * The project folder the turn works in.
   */
  public readonly workingDirectory: string;
  /**
   * The user's message.
   */
  public readonly prompt: string;
  /**
   * The requested provider, model, and effort.
   */
  public readonly requested: RequestedSettings;
  /**
   * The native session to resume, or `null` to start fresh.
   */
  public readonly resumeNativeSessionId: string | null;
  /**
   * The native turn to resume `resumeNativeSessionId` at, forking the session there into a new one, as a `ForkedSession` with
   * `resumeAt` asks; `null` to resume the whole session.
   */
  public readonly resumeAt: string | null;
  /**
   * The instructions for a turn whose adapter gets no listing of TeamRun's tools in time, naming the command line instead, or `null` when `instructions` already do.
   */
  public readonly instructionsWithoutTools: string | null;
  /**
   * The user's message when it is only a `/` command: its text, without its mentions, starts with `/` and a name with no space or `/`, as in
   * `/review src`; `null` otherwise. A provider that passes commands on sends it unwrapped when its agent listed the command, and otherwise runs
   * no prompt and answers with the reason; the others take `prompt` as before.
   */
  public readonly command: string | null;
  /**
   * Whether the person lets the provider compact the chat's live session once it has been idle until shortly before its prompt cache expires;
   * `false` by default. An adapter without such a cache ignores it.
   */
  public readonly compactsWhenIdle: boolean;

  /**
   * Initializes the request.
   * @param provider The provider, or `null`.
   * @param workingDirectory The project folder; must not be blank.
   * @param prompt The user's message; must not be blank.
   * @param requested The requested settings.
   * @param resumeNativeSessionId The session to resume, or `null`; a non-null id must not be blank.
   * @param attachments Saved files for this turn; copied, and empty by default. The prompt already contains their file references.
   * @param instructions The participant role, or `null`.
   * @param instructionsWithoutTools The instructions for a turn whose adapter gets no listing of TeamRun's tools in time, or `null`, the default, when `instructions` already name the command line.
   * @param freshPrompt The prompt for a fresh session, or `null`.
   * @param environment The variables for the agent's process; empty by default.
   * @param compacts Whether the message asks the resumed session to compact; `false` by default.
   * @param tools TeamRun's tools for the turn, or `null`, the default.
   * @param sharedServers The shared MCP servers the turn gets; none by default.
   * @param resumeAt The turn to resume the session at and fork from, or `null`, the default; a non-null id must not be blank.
   * @param adoptSender Routes another sender token to the turn's reply until it ends; refuses every token by default.
   * @param sharedValues The saved secrets' values of `sharedServers`; none by default.
   * @param isolated Whether the turn is a background session with no tools, kept out of the provider's own list where it allows; `false` by default.
   * @param command The message as a `/` command, or `null`, the default; a non-null command must not be blank.
   * @param compactsWhenIdle Whether the provider may compact the chat's live session while it is idle; `false` by default.
   * @throws ArgumentException when a text is blank.
   */
  public constructor(
    provider: Provider | null,
    workingDirectory: string,
    prompt: string,
    requested: RequestedSettings,
    resumeNativeSessionId: string | null,
    attachments?: readonly MessageAttachment[],
    instructions?: string | null,
    freshPrompt?: string | null,
    environment?: Readonly<Record<string, string>>,
    compacts?: boolean,
    tools?: TurnTools | null,
    sharedServers?: readonly SharedMcpServerDefinition[],
    resumeAt?: string | null,
    adoptSender?: (token: string) => boolean,
    sharedValues?: SharedMcpValues,
    instructionsWithoutTools?: string | null,
    isolated?: boolean,
    command?: string | null,
    compactsWhenIdle?: boolean);

  /**
   * Routes the sender token that the provider's process still holds from an earlier turn to this turn's reply until the reply ends, so a
   * `teamrun` command from the process acts as the reply; Codex's thread keeps the environment it was loaded with while the adapter holds it.
   * Refuses a token still routed to a running turn, this turn's own included, and any token once the reply has ended. A copy routes through
   * the same reply.
   * @param token The sender token the process holds.
   * @returns Whether the token now acts as the reply.
   */
  public adoptSender(token: string): boolean;

  /**
   * Gives the request for a model that doesn't take images: its images left out, and a line naming them added to each prompt.
   * @returns This request when it has no images, or a new one.
   */
  public withoutImages(): TurnRequest;

  /**
   * This request with other settings.
   * @param requested The settings to ask for.
   * @returns A new request, the same in all else.
   */
  public withRequested(requested: RequestedSettings): TurnRequest;
}

/**
 * How a turn ended.
 */
export declare class TurnResult {
  /**
   * The outcome.
   */
  public readonly outcome: TurnOutcome;
  /**
   * The native session the turn ran in, or `null` when unknown.
   */
  public readonly nativeSessionId: string | null;
  /**
   * What the provider reported about itself.
   */
  public readonly observed: ObservedSettings;
  /**
   * The error of a failed turn; `null` otherwise.
   */
  public readonly error: string | null;
  /**
   * The provider's own id of the turn, or `null` when the provider has none.
   */
  public readonly nativeTurnId: string | null;
  /**
   * The action a failed turn offers to fix it, such as choosing another model, or `null`.
   */
  public readonly action: ReplyAction | null;
  /**
   * The usage limit a failed turn reached, which moves a teammate with Sustain on to its next entry, or `null` for any other failure.
   */
  public readonly limit: UsageLimit | null;

  /**
   * Initializes the result.
   * @param outcome The outcome.
   * @param nativeSessionId The native session id, or `null`; a non-null id must not be blank.
   * @param observed The observed settings.
   * @param error The error of a failed turn, or `null`.
   * @param nativeTurnId The provider's turn id, or `null` (the default); a non-null id must not be blank.
   * @param action The action a failed turn offers, or `null` (the default).
   * @param limit The usage limit a failed turn reached, or `null` (the default).
   * @throws ArgumentException when a failed turn has no error or another turn has one, a turn that didn't fail offers an action or reaches a
   * limit, or a non-null session or turn id is blank.
   */
  public constructor(outcome: TurnOutcome, nativeSessionId: string | null, observed: ObservedSettings, error: string | null, nativeTurnId?: string | null,
    action?: ReplyAction | null, limit?: UsageLimit | null);
}

/**
 * A usage limit a provider reported as its own kind of failure: the account has no usage left until its limit resets.
 */
export declare class UsageLimit {
  /**
   * When the limit resets, as an ISO 8601 time, or `null` when the provider didn't say.
   */
  public readonly resetsAt: string | null;

  /**
   * Initializes the limit.
   * @param resetsAt When the limit resets, or `null`.
   * @throws ArgumentException when the reset time isn't a date and time.
   */
  public constructor(resetsAt: string | null);
}

/**
 * A 128-bit globally unique identifier, a UUID as RFC 9562 defines it, held in
 * its canonical form: thirty-two lowercase hexadecimal digits in five hyphenated
 * groups. Instances are immutable and compare by that text, which orders them
 * by byte value. Values are created by the factories; there is no public
 * constructor.
 */
export declare class Guid {
  /**
   * The all-zero identifier, `00000000-0000-0000-0000-000000000000`.
   */
  public static readonly empty: Guid;

  /**
   * The RFC 9562 version digit: `4` for random identifiers, `7` for
   * time-ordered ones, `0` for `empty`.
   */
  public get version(): number;

  /**
   * Creates a random version 4 identifier from the host's operating-system
   * random source.
   */
  public static newGuid(): Guid;

  /**
   * Creates a version 7 identifier whose leading 48 bits carry the timestamp
   * as milliseconds since the Unix epoch, so identifiers created later compare
   * greater, followed by random bits. The timestamp defaults to the current
   * time; one that is not an integer, is negative, or does not fit in 48 bits
   * throws `ArgumentOutOfRangeException`.
   */
  public static createVersion7(timestamp?: number): Guid;

  /**
   * Parses the hyphenated form in either letter case and returns the canonical
   * lowercase value. Any other form, including braces or unhyphenated digits,
   * throws `GuidFormatException`.
   */
  public static parse(text: string): Guid;

  /**
   * Parses the hyphenated form in either letter case and returns the canonical
   * lowercase value, or `undefined` when the text is not one.
   */
  public static tryParse(text: string): Guid | undefined;

  /**
   * Returns true when both identifiers hold the same value.
   */
  public equals(other: Guid): boolean;

  /**
   * Orders identifiers by byte value: negative when this one is lower, positive
   * when higher, zero when equal.
   */
  public compareTo(other: Guid): number;

  /**
   * Returns the canonical hyphenated lowercase text.
   */
  public toString(): string;

  private constructor(text: string);
}

/**
 * What to fork: a native session, the turn to fork through, and where the fork works.
 */
export declare class ForkRequest {
  /**
   * The provider whose profile holds the session, or `null` for the provider's default profile.
   */
  public readonly provider: Provider | null;
  /**
   * The project folder the forked session works in.
   */
  public readonly workingDirectory: string;
  /**
   * The native session to fork.
   */
  public readonly nativeSessionId: string;
  /**
   * The provider's id of the last turn to keep, inclusive.
   */
  public readonly lastTurnId: string;
  /**
   * The provider, model, and effort the kept reply asked for.
   */
  public readonly requested: RequestedSettings;

  /**
   * Initializes the request.
   * @param provider The provider, or `null`.
   * @param workingDirectory The project folder; must not be blank.
   * @param nativeSessionId The session to fork; must not be blank.
   * @param lastTurnId The last turn to keep; must not be blank.
   * @param requested The requested settings.
   * @throws ArgumentException when a text is blank.
   */
  public constructor(provider: Provider | null, workingDirectory: string, nativeSessionId: string, lastTurnId: string, requested: RequestedSettings);
}

/**
 * The reply to an outside message, as the outside session reads it.
 */
export declare class OutsideReply {
  /**
   * The message's handle.
   */
  public readonly messageId: string;
  /**
   * Where the reply stands.
   */
  public readonly state: OutsideReplyState;
  /**
   * The answer when `Answered`, the error when `Failed`, otherwise `null`.
   */
  public readonly text: string | null;

  /**
   * Initializes the reply.
   * @param messageId The message's handle.
   * @param state Where the reply stands.
   * @param text The answer or the error; `null` by default.
   */
  public constructor(messageId: string, state: OutsideReplyState, text?: string | null);

  /**
   * Whether the reply has ended: `Unknown`, `Answered` or `Failed`.
   */
  public get hasEnded(): boolean;

  /**
   * Writes the reply as `{ message_id, state }`, the state in lower case, with `reply` when answered and `error` when failed.
   */
  public toJson(): JsonObject;
}

/**
 * What a send with a sender token asks the person before it sends.
 */
export declare class SendAsk {
  /**
   * The id of the chat the send goes to.
   */
  public readonly chatId: string;
  /**
   * The chat's title.
   */
  public readonly chatTitle: string;
  /**
   * The ask's title, which names the chat.
   */
  public readonly title: string;
  /**
   * Whose reply the send starts, as `ISenderSends.describeSendAsync` says.
   */
  public readonly starts: string;

  /**
   * Creates the ask.
   * @param chatId The chat's id.
   * @param chatTitle The chat's title.
   * @param title The ask's title.
   * @param starts Whose reply the send starts.
   */
  public constructor(chatId: string, chatTitle: string, title: string, starts: string);
}

/**
 * An answer to a posted question waiting to go as its conversation's next message.
 */
export declare class QueuedAnswer {
  /**
   * The answered card, marked unsent.
   */
  public readonly approval: Approval;
  /**
   * The provider's id of the question it answers.
   */
  public readonly replyTo: string;
  /**
   * The message that carries the answer.
   */
  public readonly params: MessageSendParams;
  /**
   * What the provider gets in place of the message's text, or `null` to send the text.
   */
  public readonly prompt: string | null;

  public constructor(approval: Approval, replyTo: string, params: MessageSendParams, prompt: string | null);
}

/**
 * A person's message given to a running turn.
 */
export declare class TurnSteer {
  /**
   * The message's text, with its attachments listed as a sent message's prompt lists them.
   */
  public readonly text: string;
  /**
   * The message's attachments, as stored for the chat.
   */
  public readonly attachments: readonly MessageAttachment[];

  public constructor(text: string, attachments: readonly MessageAttachment[]);
}

/**
 * What started a turn the provider began on its own.
 */
export declare class TurnWake {
  /**
   * The provider's id of the background task whose end started the turn, or `null`.
   */
  public readonly taskId: string | null;
  /**
   * That task's command, or `null`.
   */
  public readonly command: string | null;
  /**
   * Whether the provider asks to compact an idle chat's live session before its prompt cache expires, rather than reporting a turn it began.
   */
  public readonly compaction: boolean;

  public constructor(taskId: string | null, command: string | null, compaction?: boolean);
}

/**
 * Where a turn the provider began on its own reports. It keeps every report, approvals included, until its reply follows it, which happens
 * once the chat has no other reply open, and then passes them on in order.
 */
export declare class WakeTurn implements ITurnListener {
  /**
   * The variables that give the turn's process the turn's own sender token.
   */
  public readonly environment: Readonly<Record<string, string>>;

  /**
   * Whether the reply's member plans first when the turn begins, so the provider runs it in its plan mode.
   */
  public readonly planFirst: boolean;

  /**
   * @param environment The variables with the turn's sender token.
   * @param planFirst Whether the reply's member plans first when the turn begins.
   * @param adoptSender Routes another sender token to the turn's reply until it ends; refuses every token by default.
   */
  public constructor(environment: Readonly<Record<string, string>>, planFirst?: boolean, adoptSender?: (token: string) => boolean);

  /**
   * Routes the sender token of the turn whose process runs this one, which that process's environment still holds, to this turn's reply until the reply
   * ends, so a `teamrun` command from the process acts as the reply. Refuses a token still routed to a running turn, this turn's own included, and any
   * token once the reply has ended.
   * @param token The sender token the process holds.
   * @returns Whether the token now acts as the reply.
   */
  public adoptSender(token: string): boolean;

  /**
   * Sets how the provider interrupts the turn, for a Stop on its reply.
   * @param interrupt Interrupts the provider's turn.
   */
  public onInterrupt(interrupt: () => void): void;

  /**
   * Hears the tools TeamRun opens for the turn once its reply follows it, or at once when they are open, so the provider can adopt
   * its process's kept token for them.
   * @param handler Hears the turn's tools.
   * @returns A promise that settles at once while the tools aren't open, and otherwise once the handler has finished.
   */
  public onToolsAsync(handler: (tools: TurnTools) => Promise<void>): Promise<void>;

  /**
   * Hears that the turn's reply follows it, or at once when it already does, so a provider that starts the wake's turn itself starts it only
   * when the chat runs the reply, and never ahead of a reply queued before it.
   * @param handler Hears that the reply follows.
   */
  public onFollowed(handler: () => void): void;

  /**
   * Gives the turn the tools TeamRun opened for it; none changes nothing.
   * @param tools The turn's tools, or null when TeamRun serves none.
   * @returns A promise that settles once each handler waiting for the tools has finished, one at a time in the order they were added; it rejects
   * with the first handler's failure.
   */
  public useToolsAsync(tools: TurnTools | null): Promise<void>;

  /**
   * Interrupts the provider's turn, as for a reply stopped before it started.
   */
  public cancel(): void;

  /**
   * Ends the turn with the provider's result.
   * @param result The result.
   */
  public end(result: TurnResult): void;

  /**
   * Passes the kept reports to the reply's listener one at a time, in order, each after the one before it has finished, and the later ones as they
   * come, until the turn ends. A report that comes while the kept ones are still passing waits behind them; an answer to a kept approval or question
   * returns once all the kept reports have passed.
   * @param target The reply's listener.
   * @param signal Aborts when the reply is stopped, which interrupts the provider's turn.
   * @returns The turn's result, once every kept report has passed; rejects when the listener fails on a kept report.
   */
  public follow(target: ITurnListener, signal: AbortSignal): Promise<TurnResult>;

  /** @inheritdoc */
  public onStartedAsync(start: TurnStart): Promise<void>;
  /** @inheritdoc */
  public onDetailAsync(detail: TurnDetail): Promise<void>;
  /** @inheritdoc */
  public onThinking(): void;
  /** @inheritdoc */
  public onApprovalRequested(ask: ApprovalAsk, signal?: AbortSignal): Promise<string>;

  /**
   * @inheritdoc
   */
  public onQuestionsAsked(ask: QuestionAsk, signal?: AbortSignal): Promise<readonly QuestionAnswer[] | null>;
  /** @inheritdoc */
  public onQuestionsPostedAsync(ask: QuestionAsk): Promise<void>;
  /** @inheritdoc */
  public onObservedAsync(observed: ObservedSettings): Promise<void>;
  /** @inheritdoc */
  public onUsageAsync(usage: ReplyUsage): Promise<void>;
  /** @inheritdoc */
  public onPlanUsageAsync(windows: readonly PlanWindow[], readAt: string): Promise<void>;
  /** @inheritdoc */
  public onTaskStartedAsync(start: TaskStart): Promise<void>;
  /** @inheritdoc */
  public onTaskOutput(taskId: string, text: string): void;
  /** @inheritdoc */
  public onTaskEndedAsync(end: TaskEnd): Promise<void>;
  /**
   * Passes the wake to the reply's listener, or returns `null` before the reply follows the turn.
   * @param wake What started the next turn.
   */
  public onWakeAsync(wake: TurnWake): Promise<WakeTurn | null>;
  /** @inheritdoc */
  public onSharedServerFailedAsync(failure: SharedMcpFailure): Promise<void>;
}

/**
 * The facts an adapter reports when the provider accepts a turn.
 */
export declare class TurnStart {
  /**
   * The native session the turn runs in, or `null` when the provider has none.
   */
  public readonly nativeSessionId: string | null;
  /**
   * Whether the session was resumed rather than started.
   */
  public readonly resumedNativeSession: boolean;
  /**
   * Adapter-reported placement of role instructions.
   */
  public readonly roleApplied: RoleApplication | null;

  /**
   * Initializes the start.
   * @param nativeSessionId The native session id, or `null`; a non-null id must not be blank.
   * @param resumedNativeSession Whether the session was resumed.
   * @throws ArgumentException when a resumed session has no id or a non-null id is blank.
   */
  public constructor(nativeSessionId: string | null, resumedNativeSession: boolean, roleApplied?: RoleApplication | null);
}

/**
 * A command an adapter reports running in the background: the provider's id for it, its command
 * line, and how to stop it through the provider or the process that owns it.
 */
export declare class TaskStart {
  /**
   * The provider's id of the task, unique within its reply.
   */
  public readonly taskId: string;
  /**
   * The command line, as the provider reports it.
   */
  public readonly command: string;
  /**
   * Asks the provider or the owning process to stop the task; rejects with the provider's reason
   * when it refuses. The end arrives through `ITurnListener.onTaskEnded`.
   */
  public readonly stop: () => Promise<void>;
  /**
   * The `SubAgent.toolUseId` of the sub-agent the task runs, so its stop stops that sub-agent, or `null` for a command.
   */
  public readonly subAgentId: string | null;
  /**
   * False for a task that has no stop of its own: Core keeps its stop for the reply's Stop but doesn't list it among the background tasks,
   * so neither its sub-agent's row nor the Background tasks view shows a Stop for it.
   */
  public readonly hasOwnStop: boolean;

  /**
   * Initializes the start.
   * @param taskId The provider's id of the task.
   * @param command The command line.
   * @param stop How to stop the task.
   * @param subAgentId The `SubAgent.toolUseId` of the sub-agent the task runs, or `null`; blank is `null`.
   * @param hasOwnStop Whether the task has a stop of its own; `true` by default.
   * @throws ArgumentException when `taskId` or `command` is blank.
   */
  public constructor(taskId: string, command: string, stop: () => Promise<void>, subAgentId?: string | null, hasOwnStop?: boolean);
}

/**
 * How a background command ended: its exit code, or the signal that ended it, or why it couldn't run.
 */
export declare class CommandExit {
  /**
   * The exit code, or `null` when a signal ended it or it never ran.
   */
  public readonly code: number | null;

  /**
   * The signal that ended it, or `null`.
   */
  public readonly signal: string | null;

  /**
   * Why it couldn't run, or `null` when it ran.
   */
  public readonly error: string | null;

  /**
   * Initializes the exit.
   * @param code The exit code.
   * @param signal The signal.
   * @param error Why it couldn't run; `null` by default.
   */
  public constructor(code: number | null, signal: string | null, error?: string | null);
}

/**
 * How a background task ended, as its provider reports it.
 */
export declare class TaskEnd {
  /**
   * The provider's id of the task.
   */
  public readonly taskId: string;
  /**
   * How the task ended; never `Running`.
   */
  public readonly status: BackgroundTaskStatus;
  /**
   * The reported exit code, or `null` when the provider reports none.
   */
  public readonly exitCode: number | null;

  /**
   * Initializes the end.
   * @param taskId The provider's id of the task.
   * @param status How the task ended.
   * @param exitCode The reported exit code; `null` by default.
   * @throws ArgumentException when `taskId` is blank or `status` is `Running`.
   */
  public constructor(taskId: string, status: BackgroundTaskStatus, exitCode?: number | null);
}

/**
 * TeamRun's record in one data directory: the EF Core-style context over the SQLite database
 * `teamrun.db`, reached through `database` with its migrations and the change feed
 * (`database.changeFeed`, over the framework-owned `__changes` table; payloads are the records'
 * JSON text). The services are the only code that reads and writes through it, and the runtime
 * keeps one context per data directory.
 * @remarks
 * Async disposable: `await using context = await DatabaseContext.openAsync(directory)` closes the connection at the end
 * of the block.
 */
export declare class DatabaseContext extends DbContext<SqlConnection, SqlMigration> {
  /**
   * Coordinates operations on overlapping projects in this runtime.
   */
  public readonly projectActivity: ProjectActivity;
  /**
   * The data directory the database lives in.
   */
  public readonly dataDirectory: string;
  /**
   * The own folders of the conversations without a project, under the data directory.
   */
  public readonly chatFolders: ChatFolders;

  private constructor(options: DbContextOptions<SqlConnection, SqlMigration>, dataDirectory: string);

  /**
   * Opens the data directory's database through `DbContextOptionsBuilder.useSQLite`, creating the
   * directory and file when absent, and applies pending migrations, each in its own transaction.
   * @param dataDirectory The data directory; must not be blank.
   * @returns A promise of the context, which the caller disposes with `await using`.
   * @throws ArgumentException when the directory is blank.
   * @throws ServiceException with versionMismatch when the database's applied migrations aren't a prefix of the catalog's,
   * as for a database a newer version wrote.
   */
  public static openAsync(dataDirectory: string): Promise<DatabaseContext>;

  /**
   * Opens a database whose schema its host has migrated, applying no migrations.
   * @param options The database's provider and data source.
   * @param dataDirectory The data directory, where files beside the database live; must not be blank.
   * @returns The context.
   * @throws ArgumentException when the directory is blank.
   */
  public static attach(options: DbContextOptions<SqlConnection, SqlMigration>, dataDirectory: string): DatabaseContext;
}

/**
 * The own folders of the chats without a project, `<data directory>/chats/<conversation id>`. Each is its own Git root, a
 * `.git` folder with no commit written by TeamRun, so Git and the agents that look for a project's root stop at it instead of
 * walking up to a folder above. The `.git` is never counted, copied, or kept by the checkpoints module.
 */
export declare class ChatFolders {
  /**
   * @param dataDirectory The data directory.
   */
  public constructor(dataDirectory: string);

  /**
   * @param conversationId The conversation id.
   * @returns The folder's path, whether or not it exists.
   */
  public pathOf(conversationId: string): string;

  /**
   * @param conversationId The conversation id.
   * @returns Whether the folder exists.
   */
  public exists(conversationId: string): boolean;

  /**
   * Makes the folder and its Git root when either is missing, keeping what the folder holds.
   * @param conversationId The conversation id.
   * @returns The folder's path.
   * @throws {Error} When the system refuses to make it.
   */
  public prepare(conversationId: string): string;

  /**
   * @returns The ids of the folders under the data directory's `chats` folder, in no set order.
   */
  public list(): readonly string[];

  /**
   * Counts the folder's files, at any depth, its `.git` left out, reading the folder asynchronously.
   * @param conversationId The conversation id.
   * @returns The count; 0 when the folder is missing.
   */
  public countFilesAsync(conversationId: string): Promise<number>;

  /**
   * Copies everything in the folder but its `.git` into a target folder, keeping each path and copying links as they are, reading
   * and writing asynchronously. Refused whole, before anything is copied, when the target already holds one of the paths, unless
   * both are folders, or when a link would point elsewhere once moved.
   * @param conversationId The conversation id.
   * @param target The target folder, a project's root.
   * @param copies Receives each file and folder it makes in the target, in the order it makes them, also when it fails partway,
   * for `removeCopiesAsync`.
   * @throws ServiceException named `ErrorCode.Conflict` with the clashing paths or the links, relative to the folder.
   * @throws {Error} When the system refuses a copy; what it made before stays, listed in `copies`.
   */
  public copyToAsync(conversationId: string, target: string, copies: string[]): Promise<void>;

  /**
   * Removes what a copy made, newest first, trying every one, so the target is as it was.
   * @param copies The paths `copyToAsync` listed.
   * @returns The paths it couldn't remove after retrying a few times, newest first; none when all are gone.
   */
  public static removeCopiesAsync(copies: readonly string[]): Promise<readonly string[]>;

  /**
   * Deletes the folder with what it holds; nothing when it is missing.
   * @param conversationId The conversation id.
   * @throws {Error} When the system refuses, after retrying a few times.
   */
  public remove(conversationId: string): void;
}

/**
 * Checks whether a path is a folder within a deadline, so a disconnected drive or share doesn't hold
 * up its caller. Any failure to read the path counts as missing. Each check reads the path anew, except
 * that while a read of the path has passed its deadline unanswered, a new check waits on that read
 * instead of starting another, so a stalled drive or share holds one thread, not one per check.
 */
export declare class FolderProbe {
  /**
   * Initializes the probe.
   * @param statAsync Reads a path's details, such as `stat` from `node:fs/promises`.
   * @param timings How long a check waits for its read, and a listing for its checks.
   * @param timer Waits out each deadline, a wait that ends once the work it bounds does.
   */
  public constructor(statAsync: (path: string) => Promise<{ isDirectory(): boolean }>, timings: FolderCheckTimings, timer: ITimer);

  /**
   * Checks a path.
   * @param path The path.
   * @returns What the check found, or `FolderState.Unreachable` once the timings' deadline passes.
   */
  public checkAsync(path: string): Promise<FolderState>;

  /**
   * Checks a path a reply links to. At most `Resources.maximumLinkedFolderChecks` such reads run at once,
   * and a check waits its turn within its deadline. While that many reads have passed their deadline
   * unanswered, a check of another path answers `FolderState.Unreachable` at once and starts no read, so
   * links to a stalled share hold at most that many threads, whatever a reply names.
   * @param path The path.
   * @returns What the check found, or `FolderState.Unreachable` once the timings' deadline passes or while
   * the reads are stalled.
   */
  public checkLinkedAsync(path: string): Promise<FolderState>;

  /**
   * Waits for a listing's checks, but no longer than the timings' list wait.
   * @param checks The checks.
   */
  public withinListWaitAsync(checks: Promise<unknown>): Promise<void>;
}

/**
 * How long a check of a project's folder waits for its read, and a projects listing for its checks.
 */
export declare class FolderCheckTimings {
  /**
   * Milliseconds a check waits for its read before it counts the folder unreachable.
   */
  public readonly deadline: number;
  /**
   * Milliseconds a listing waits for its checks before it answers each folder's last known state.
   */
  public readonly listWait: number;

  /**
   * @param deadline Milliseconds a check waits for its read; a positive integer.
   * @param listWait Milliseconds a listing waits for its checks; a positive integer.
   * @throws ArgumentOutOfRangeException when either isn't a positive integer.
   */
  public constructor(deadline: number, listWait: number);

  /**
   * Returns the production timings: `Resources.folderCheckDeadline` and `Resources.projectListWait`.
   * @returns The timings.
   */
  public static createDefault(): FolderCheckTimings;
}

/**
 * Allows concurrent provider turns while excluding rewinds and disruptive metadata operations on overlapping roots.
 * Nested folders of a Git working tree share one root. Coordination belongs to one runtime and does not lock external tools.
 */
export declare class ProjectActivity {
  /**
   * Registers a provider turn alongside any other turns on the same working files.
   * @param rootPath The project's filesystem path.
   * @returns A unique activity key to pass to `leave` when this turn ends.
   * @throws ServiceException when an overlapping root is being rewound.
   * @throws Error when resolving an existing filesystem path fails.
   */
  public enterTurn(rootPath: string): string;

  /**
   * Registers a provider turn as `enterTurn` does, unless an overlapping root is being rewound.
   * @param rootPath The project's filesystem path.
   * @returns A unique activity key to pass to `leave`, or null while an overlapping root is being rewound.
   * @throws Error when resolving an existing filesystem path fails.
   */
  public tryEnterTurn(rootPath: string): string | null;

  /**
   * Waits for the next rewind to end, on any root, or for `releaseWaiting`.
   * @returns A promise that resolves once it has.
   */
  public whenReleasedAsync(): Promise<void>;

  /**
   * Ends every current wait of `whenReleasedAsync`, such as at shutdown.
   */
  public releaseWaiting(): void;

  /**
   * Claims an idle root exclusively for a rewind.
   * @param rootPath The project's filesystem path.
   * @returns A unique activity key to pass to `leave`.
   * @throws ServiceException when an overlapping root is already active.
   * @throws Error when resolving an existing filesystem path fails.
   */
  public enter(rootPath: string): string;

  /**
   * Claims several idle roots exclusively at once, all or none, so roots that overlap each other don't refuse one another.
   * @param rootPaths The filesystem paths.
   * @returns One activity key per path, in order, each to pass to `leave`.
   * @throws ServiceException when a root overlapping any of them is already active; none is then claimed.
   * @throws Error when resolving an existing filesystem path fails.
   */
  public enterAll(rootPaths: readonly string[]): readonly string[];

  /**
   * Releases one turn or rewind without affecting any other activity. Safe to repeat.
   * @param id The key returned by `enter` or `enterTurn`.
   */
  public leave(id: string): void;

  /**
   * Rejects metadata operations that would disrupt an active turn or rewind.
   * @param rootPath The affected project path.
   * @throws ServiceException when an overlapping root is active.
   * @throws Error when resolving an existing filesystem path fails.
   */
  public requireIdle(rootPath: string): void;

  /**
   * The root whose activity a path counts under: the top folder of its Git working tree, or the path itself outside one, with its links resolved,
   * so two projects whose paths reach one folder share it.
   * @param rootPath A filesystem path, which need not exist.
   * @returns The root.
   * @throws Error when resolving an existing filesystem path fails.
   */
  public static rootOf(rootPath: string): string;
}

/**
 * `IProjectsService` over a `DatabaseContext`: each write is the row and its change-feed entry in
 * one transaction. A project's id is a version 7 `Guid`, its name is the folder's name (the path
 * itself for a root folder), and its root path is stored resolved, so the same folder opens the
 * same project.
 */
export declare class ProjectsService implements IProjectsService {
  /**
   * Initializes the service over the context.
   * @param context The context of the data directory.
   * @param conversations The conversations, deleted with their project.
   * @param drafts The drafts whose files go once the project is forgotten, or null.
   * @param events Where a change in a project folder's state is published, or null.
   * @param folders The probe that checks each folder within its deadline, and bounds a listing's wait for its checks.
   * @param log Where a check that fails, begun as a project opens, is written, or null.
   */
  public constructor(context: DatabaseContext, conversations: IConversationsService, drafts: IDraftsService | null, events: IEventSink | null,
    folders: FolderProbe, log: ILog | null);

  /**
   * Lists the projects, oldest first.
   * @param transaction The transaction to read in, or none.
   * @returns The projects.
   */
  public listProjectsAsync(transaction?: SqlTransaction): Promise<readonly Project[]>;

  /**
   * Lists the projects, oldest first, each with whether its folder is missing, unreachable or no
   * longer a folder. Checks every folder at once, waits a short bound for the checks, and answers
   * with each folder's last known state; a check that ends later still publishes its change.
   * @returns The listings.
   */
  public listAsync(): Promise<readonly ProjectListing[]>;

  /**
   * Checks a folder within the probe's deadline. For a project, keeps the state found unless a check
   * that began later, or forgetting the project, already kept one, and publishes `ProjectFolderChanged`
   * when it changes.
   * @param path The folder's path.
   * @param projectId The project the folder belongs to, or `null` for a chat without one.
   * @returns What the check found.
   */
  public checkFolderAsync(path: string, projectId: string | null): Promise<FolderState>;

  /**
   * Checks a path a reply links to, through the probe's limit on such reads.
   * @param path The path.
   * @returns What the check found.
   */
  public checkLinkedFolderAsync(path: string): Promise<FolderState>;

  /**
   * Finds a project by id.
   * @param projectId The project id.
   * @param transaction The transaction to read in, or none.
   * @returns The project, or `null` when it does not exist.
   */
  public findAsync(projectId: string, transaction?: SqlTransaction): Promise<Project | null>;

  /**
   * Opens a folder as a project, creating the project on first open, and checks its folder in the
   * background, publishing a change and logging a check that fails.
   * @param params The absolute path of the folder.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The existing or created project.
   * @throws ServiceException (foundation) named `ErrorCode.InvalidParams` when the path is not absolute.
   */
  public openAsync(params: ProjectOpenParams, transaction?: SqlTransaction): Promise<Project>;

  /**
   * Forgets a project and deletes its conversations with their messages and approvals and logs the deletion with the project's last JSON; the folder is left
   * untouched, and the conversations' draft files go once its own transaction is committed, or once the work is done in the transaction given.
   * @param params The project id.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The ids of the conversations it deleted.
   * @throws ServiceException (foundation) named `ErrorCode.NotFound` when the project does not exist, and
   * `ErrorCode.Conflict` while the project still has conversations.
   */
  public forgetAsync(params: ProjectIdParams, transaction?: SqlTransaction): Promise<readonly string[]>;

  /**
   * Reads the Projects view's layout from the `preferences` table.
   * @param transaction The transaction to read in, or none.
   * @returns The layout's JSON object, or `null` when none is kept.
   */
  public readLayoutAsync(transaction?: SqlTransaction): Promise<JsonObject | null>;

  /**
   * Keeps the Projects view's layout as it is in the `preferences` table, replacing the one kept, and records it in the
   * change feed.
   * @param params The layout.
   * @returns The layout kept.
   */
  public saveLayoutAsync(params: ProjectsLayoutSaveParams): Promise<JsonObject>;
}

/**
 * `IConversationsService` over a `DatabaseContext`; deletion removes approvals, messages, the draft and the
 * conversation in one transaction, logging each row, and then the draft's files.
 */
export declare class ConversationsService implements IConversationsService {
  /**
   * Initializes the service over the context.
   * @param context The context of the data directory.
   * @param drafts The drafts a deleted conversation takes with it, or null when there are none.
   * @param log Where a failed move logs the copies it couldn't remove, or null for none.
   */
  public constructor(context: DatabaseContext, drafts?: IDraftsService | null, log?: ILog | null);

  /**
   * Lists memberships in join order; the conversation must exist.
   */
  public listMembersAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<readonly ConversationMember[]>;

  /**
   * Adds a teammate once and marks the conversation edited; repeated additions preserve join time and session state and
   * change nothing.
   */
  public addMemberAsync(params: ConversationMemberParams, transaction?: SqlTransaction): Promise<ConversationMember>;

  /**
   * Removes an existing membership while its conversation is idle and marks the conversation edited; missing membership
   * is a no-op.
   */
  public removeMemberAsync(params: ConversationMemberParams, transaction?: SqlTransaction): Promise<void>;

  /**
   * Finds a membership by both identities.
   */
  public findMemberAsync(params: ConversationMemberParams, transaction?: SqlTransaction): Promise<ConversationMember | null>;

  /**
   * Updates session state for an existing membership, with the account the session belongs to when it isn't the teammate's own, and records the change.
   */
  public setMemberSessionAsync(params: ConversationMemberParams, nativeSessionId: string | null, resumedNativeSession: boolean,
    sessionProviderId?: string | null, transaction?: SqlTransaction): Promise<ConversationMember>;

  /**
   * Sets the permission mode of an existing membership, or `null` to follow the teammate's own, keeping its session, and records the change.
   * @throws ServiceException with `NotFound` when the teammate isn't a member of the chat.
   */
  public setMemberModeAsync(params: ChatMemberModeParams, transaction?: SqlTransaction): Promise<ConversationMember>;

  /**
   * Sets the model, effort and speed of an existing membership, or `null` to follow the teammate's own, keeping its session and mode, and records the change.
   * @throws ServiceException with `NotFound` when the teammate isn't a member of the chat.
   */
  public setMemberSettingsAsync(params: ChatMemberSettingsParams, transaction?: SqlTransaction): Promise<ConversationMember>;

  /**
   * Turns the chat's Plan first on or off for every member, keeping its update time, and records the change; turning it on again makes
   * the members whose plan was approved plan first again, and anything else that changes nothing records nothing.
   * @throws ServiceException with `NotFound` when the chat doesn't exist.
   */
  public setPlanFirstAsync(params: ChatPlanFirstParams, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * Records that a member's plan was approved, so that member's replies no longer plan first while the others' still do; keeps the update
   * time, and records nothing when it was already approved or the chat doesn't plan first.
   * @param chatId The chat.
   * @param teammateId The teammate, or `null` for the chat's own provider.
   * @param transaction The transaction to work in, or none for its own.
   * @throws ServiceException with `NotFound` when the chat doesn't exist.
   */
  public approvePlanAsync(chatId: string, teammateId: string | null, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * Records that a member's plan is no longer approved, so that member's replies plan first again, as when its approval couldn't go ahead;
   * keeps the update time, and records nothing when it wasn't approved or the chat doesn't plan first.
   * @param chatId The chat.
   * @param teammateId The teammate, or `null` for the chat's own provider.
   * @param transaction The transaction to work in, or none for its own.
   * @throws ServiceException with `NotFound` when the chat doesn't exist.
   */
  public reopenPlanAsync(chatId: string, teammateId: string | null, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * Resets memberships for a provider rebind: each chat forgets the teammate's session, and the permission mode, model, effort and speed it chose for the earlier provider.
   * Rejects when an affected conversation has an open reply.
   */
  public resetTeammateSessionsAsync(teammateId: string, transaction?: SqlTransaction): Promise<void>;

  /**
   * Forgets the provider sessions a provider's profile directory holds before it moves: the native
   * sessions of the provider's direct replies so far are no longer resumed, a conversation's forked session
   * on it is dropped, and every membership of a teammate on it starts a fresh session; sessions on other
   * providers, and the provider's sessions after the move, are kept.
   * Rejects while a reply on the provider is open.
   */
  public resetProviderSessionsAsync(providerId: string, transaction?: SqlTransaction): Promise<void>;

  /**
   * Removes memberships before deleting a teammate; rejects while an affected conversation has an open reply.
   */
  public removeTeammateMembersAsync(teammateId: string, transaction?: SqlTransaction): Promise<void>;

  /**
   * @inheritdoc
   */
  public listAsync(params: ConversationListParams, transaction?: SqlTransaction): Promise<readonly Conversation[]>;

  /**
   * @inheritdoc
   */
  public listRecentAsync(limit: number): Promise<readonly Conversation[]>;

  /**
   * @inheritdoc
   */
  public listEmptyAsync(params: ConversationListParams): Promise<readonly Conversation[]>;

  /**
   * @inheritdoc
   */
  public findAsync(conversationId: string, transaction?: SqlTransaction): Promise<Conversation | null>;

  /**
   * @inheritdoc
   */
  public createAsync(params: ConversationCreateParams, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * @inheritdoc
   */
  public renameAsync(params: ConversationRenameParams, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * @inheritdoc
   */
  public giveTitleAsync(conversationId: string, title: string, transaction?: SqlTransaction): Promise<Conversation | null>;

  /**
   * @inheritdoc
   */
  public touchAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * @inheritdoc
   */
  public setResponderAsync(params: ConversationResponderParams, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * @inheritdoc
   */
  public moveProviderlessAsync(providerOf: (kind: string) => string | null, transaction?: SqlTransaction): Promise<readonly Conversation[]>;

  /**
   * @inheritdoc
   */
  public moveAsync(params: ConversationMoveParams): Promise<Conversation>;

  /**
   * Deletes a conversation as `IConversationsService.deleteAsync` says; given no transaction, it runs in its own and removes the
   * draft's files once that commits, and given one, it leaves the files to the caller.
   */
  public deleteAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<void>;

  /**
   * @inheritdoc
   */
  public countFolderFilesAsync(params: ConversationIdParams): Promise<number>;

  /**
   * @inheritdoc
   */
  public attachFolderAsync(params: ChatFolderAttachParams, check: (path: string) => Promise<FolderState>): Promise<Conversation>;

  /**
   * @inheritdoc
   */
  public detachFolderAsync(params: ConversationIdParams): Promise<Conversation>;

  /**
   * Removes a conversation's messages from a sequence on, with their approvals, logging every deletion.
   * @param conversationId The conversation id.
   * @param fromSequence The sequence of the first message to remove.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The messages removed, in sequence order.
   * @throws ServiceException `NotFound` when the conversation does not exist.
   */
  public removeFromAsync(conversationId: string, fromSequence: number, transaction?: SqlTransaction): Promise<readonly Message[]>;

  /**
   * @inheritdoc
   */
  public listRunOutputsAsync(params: ConversationIdParams): Promise<readonly RunOutput[]>;

  /**
   * @inheritdoc
   */
  public saveRunOutputAsync(output: RunOutput, transaction?: SqlTransaction): Promise<void>;

  /**
   * Marks or clears the conversation's need for a fresh provider session, logging the update.
   * @param conversationId The conversation id.
   * @param sessionReset The mark.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The conversation as stored.
   * @throws ServiceException `NotFound` when the conversation does not exist.
   */
  public setSessionResetAsync(conversationId: string, sessionReset: boolean, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * Records the forked session a rewind made (clearing the reset mark), or forgets it, logging the update.
   * @param conversationId The conversation id.
   * @param forkedSession The forked session, or `null`.
   * @param transaction The transaction to work in, or none for its own.
   * @returns The conversation as stored.
   * @throws ServiceException `NotFound` when the conversation does not exist.
   */
  public setForkedSessionAsync(conversationId: string, forkedSession: ForkedSession | null, transaction?: SqlTransaction): Promise<Conversation>;

  /**
   * Finds the conversations whose title or message texts contain a text through SQLite's `LIKE` over the stored JSON
   * (`json_extract`, `json_each`): one hit per conversation, the title when it matches and else the latest matching
   * message with a snippet, the latest conversation first, at most the limit, read in one transaction.
   * @param params The text and the most hits.
   * @returns The hits.
   */
  public searchAsync(params: ConversationSearchParams): Promise<ConversationSearchResult>;

  /**
   * Finds chats for the window's search through SQLite's `LIKE` over each chat's title: with a blank text the latest updated
   * chats, else those whose title contains it, the latest updated first, at most the limit, each with the names of its
   * teammates in the order they joined, and a count of every chat that matches.
   * @param params The text, possibly blank, and the most chats.
   * @returns The chats and their total.
   */
  public findChatsAsync(params: ChatFindParams): Promise<ChatFindResult>;

  /**
   * Finds messages whose text details contain a text through the `messageText` FTS5 trigram index, as one quoted phrase, so a
   * search reads the index rather than every message's JSON: the newest first, at most the limit, each with its chat, its
   * teammate and a snippet around the match, and a count of every message that matches, at most 1,000 and then `capped`. A
   * text of fewer than 3 characters, which a trigram can't match, is found by reading the text of the last 2,000 index rows with a
   * GLOB that folds case as the index does, and its result is `capped` once older rows go unread.
   * @param params The text, trimmed, and the most messages.
   * @returns The messages and their total.
   */
  public searchMessagesAsync(params: ConversationSearchParams): Promise<MessageSearchResult>;
}

/**
 * `IMessagesService` over a `DatabaseContext`.
 */
export declare class MessagesService implements IMessagesService {
  /**
   * Initializes the service over the context.
   * @param context The context of the data directory.
   */
  public constructor(context: DatabaseContext);

  /**
   * @inheritdoc
   */
  public listAsync(params: MessageListParams, transaction?: SqlTransaction): Promise<readonly Message[]>;

  /**
   * @inheritdoc
   */
  public listOutlinesAsync(conversationId: string, afterSequence: number | null, transaction?: SqlTransaction): Promise<readonly Message[]>;

  /**
   * @inheritdoc
   */
  public pageAsync(params: MessagePageParams, transaction?: SqlTransaction): Promise<MessagePage>;

  /**
   * Lists a bounded page of matching provider replies without output or diff bodies, read in one transaction.
   * @param params Conversation, optional exclusive cursor, and page limit.
   * @param panel The panel whose replies to select.
   * @param transaction The transaction to read in, or none for its own.
   * @returns Matching summaries in descending sequence order and adjacent-page flags.
   */
  public replyPageAsync(params: MessagePageParams, panel: ReplyPanel, transaction?: SqlTransaction): Promise<ReplyPage>;

  /**
   * @inheritdoc
   */
  public findAsync(messageId: string, transaction?: SqlTransaction): Promise<Message | null>;

  /**
   * @inheritdoc
   */
  public findOpenReplyAsync(conversationId: string, transaction?: SqlTransaction): Promise<Message | null>;

  /**
   * Finds the newest recorded native session for the requested kind and provider.
   * @param conversationId The conversation to search.
   * @param kind The kind identifier.
   * @param providerId The provider identifier, or null for the default provider.
   * @returns The native session identifier, or null when no compatible session is recorded that the
   * provider hasn't forgotten.
   * @remarks Queries the database directly without loading transcript details.
   */
  public findResumableSessionAsync(conversationId: string, kind: string, providerId: string | null, transaction?: SqlTransaction): Promise<string | null>;

  /**
   * @inheritdoc
   */
  public findWindowTokensAsync(providerId: string, model: string | null, transaction?: SqlTransaction): Promise<number | null>;

  /**
   * Finds an attachment that one of a conversation's messages holds.
   * @param conversationId The conversation to search.
   * @param path The attachment's saved path.
   * @returns The attachment's metadata, or null when no message of the conversation holds that path.
   * @remarks Queries the database directly without loading transcripts.
   */
  public findAttachmentAsync(conversationId: string, path: string, transaction?: SqlTransaction): Promise<MessageAttachment | null>;
  public findCheckpointAsync(messageId: string, transaction?: SqlTransaction): Promise<string | null>;
  public findCheckpointFolderAsync(messageId: string, transaction?: SqlTransaction): Promise<string | null>;

  /**
   * Lists, for each teammate in each conversation, its latest reply that reports usage, by conversation and then oldest first.
   * @returns One entry per teammate and conversation; none for a pair whose replies report no usage, whose latest such reply is from a session since reset,
   * such as by a provider change, or for replies by no teammate.
   * @remarks Queries the database directly without loading transcripts.
   */
  public listTeammateUsageAsync(): Promise<readonly TeammateUsage[]>;

  /**
   * Lists every reply still pending, running, or awaiting an approval, across conversations, oldest first.
   * @param transaction The transaction to read in, or none.
   * @returns The open replies.
   */
  public listOpenAsync(transaction?: SqlTransaction): Promise<readonly Message[]>;

  /**
   * Lists every message with a `SubAgent` detail still running, across conversations, oldest first.
   * @param transaction The transaction to read in, or none.
   * @returns The messages.
   */
  public listWithRunningSubAgentsAsync(transaction?: SqlTransaction): Promise<readonly Message[]>;

  /**
   * @inheritdoc
   */
  public nextSequenceAsync(conversationId: string, transaction?: SqlTransaction): Promise<number>;

  /**
   * @inheritdoc
   */
  public insertAsync(message: Message, transaction?: SqlTransaction): Promise<void>;

  /**
   * @inheritdoc
   */
  public updateAsync(message: Message, transaction?: SqlTransaction): Promise<void>;
  public setCheckpointAsync(messageId: string, checkpointId: string, transaction?: SqlTransaction): Promise<void>;
  public setCheckpointFolderAsync(messageId: string, folderId: string, transaction?: SqlTransaction): Promise<void>;
}

/**
 * `IApprovalsService` over a `DatabaseContext`.
 */
export declare class ApprovalsService implements IApprovalsService {
  /**
   * Initializes the service over the context.
   * @param context The context of the data directory.
   */
  public constructor(context: DatabaseContext);

  /**
   * Lists pending approvals across every conversation, ordered by identifier.
   * @param transaction The transaction to read in; the connection when left out.
   * @returns The pending approvals.
   */
  public listPendingAllAsync(transaction?: SqlTransaction): Promise<readonly Approval[]>;

  /**
   * @inheritdoc
   */
  public listUnsentAnswersAsync(transaction?: SqlTransaction): Promise<readonly Approval[]>;

  /**
   * @inheritdoc
   */
  public listAsync(params: ConversationIdParams): Promise<readonly Approval[]>;

  /**
   * @inheritdoc
   */
  public findAsync(approvalId: string, transaction?: SqlTransaction): Promise<Approval | null>;

  /**
   * @inheritdoc
   */
  public listPendingAsync(messageId: string, transaction?: SqlTransaction): Promise<readonly Approval[]>;

  /**
   * @inheritdoc
   */
  public insertAsync(approval: Approval, transaction?: SqlTransaction): Promise<void>;

  /**
   * @inheritdoc
   */
  public updateAsync(approval: Approval, transaction?: SqlTransaction): Promise<void>;
}

/**
 * `IBackgroundTasksService`, in memory, and in the database when it is given one, so a chat's tasks stay listed after a restart. A start
 * gives the task TeamRun's id and publishes `BackgroundTaskUpdated`; output gathers for
 * `Resources.backgroundTaskOutputInterval` and publishes `BackgroundTaskOutput`; an end publishes
 * the rest of the output, then `BackgroundTaskUpdated`.
 */
export declare class BackgroundTasksService implements IBackgroundTasksService {
  /**
   * Initializes the service.
   * @param events Where the task events are published.
   * @param outputInterval Milliseconds output gathers before it is published;
   *   `Resources.backgroundTaskOutputInterval` by default.
   * @param stopWait Milliseconds `stop` waits for the provider to report the end;
   *   `Resources.backgroundTaskStopWait` by default.
   * @param log Where a teammate's task stop the provider refuses, and a saved task that can't be read, are written; `null`, the default, for none.
   * @param context The database that keeps each chat's tasks across a restart; `null`, the default, keeps them in memory only.
   */
  public constructor(events: IEventSink, outputInterval?: number, stopWait?: number, log?: ILog | null, context?: DatabaseContext | null);

  /**
   * Saves each task still running as stopped, with its output so far, as TeamRun closes, so the next start lists it; it publishes their
   * gathered output but no end, and keeps them running in this service's list. Nothing is saved after it, so a task that ends later leaves the
   * closed database alone.
   */
  public closeAsync(): Promise<void>;

  /**
   * @inheritdoc
   */
  public startAsync(conversationId: string, messageId: string, kind: string, start: TaskStart, teammateId?: string | null): Promise<BackgroundTask | null>;

  /**
   * @inheritdoc
   */
  public write(messageId: string, taskId: string, text: string): void;

  /**
   * @inheritdoc
   */
  public endAsync(messageId: string, end: TaskEnd): Promise<void>;

  /**
   * @inheritdoc
   */
  public listAsync(params: ConversationIdParams): Promise<readonly BackgroundTask[]>;

  /**
   * @inheritdoc
   */
  public pageAsync(params: BackgroundTaskListParams): Promise<BackgroundTaskPage>;

  /**
   * Reads one task of a conversation already listed, with its output, which comes from the store
   * for a task of an earlier run; once closed, such a task's output stays left out.
   * @param params The task.
   * @returns The task.
   * @throws ServiceException with `NotFound` for an unknown task.
   */
  public readAsync(params: BackgroundTaskIdParams): Promise<BackgroundTask>;

  /**
   * @inheritdoc
   */
  public stop(params: BackgroundTaskIdParams): Promise<BackgroundTask>;

  /**
   * @inheritdoc
   */
  public clearFinishedAsync(params: ConversationIdParams): Promise<BackgroundTasksClearedPayload>;

  /**
   * @inheritdoc
   */
  public forget(conversationIds: readonly string[]): void;

  /**
   * @inheritdoc
   */
  public stopTeammate(teammateId: string, conversationId: string | null): void;
}

/**
 * `IWindowsService` in memory: the windows live while TeamRun runs and are not stored.
 */
export declare class WindowsService implements IWindowsService {
  /**
   * Initializes the service.
   * @param events Where `PanelRequested` and `WindowReloadRequested` are published.
   * @param conversations Where a chat panel's chat is looked up.
   * @param answerWait Milliseconds a request waits for its window's answer; `Resources.panelAnswerWait` by default.
   */
  public constructor(events: IEventSink, conversations: IConversationsService, answerWait?: number);

  /**
   * @inheritdoc
   */
  public focus(params: WindowFocusedParams): void;

  /**
   * @inheritdoc
   */
  public close(params: WindowIdParams): void;

  /**
   * @inheritdoc
   */
  public answer(params: PanelAnsweredParams): void;

  /**
   * @inheritdoc
   */
  public reload(params: WindowIdParams): void;

  /**
   * @inheritdoc
   */
  public isShown(conversationId: string): boolean;

  /**
   * @inheritdoc
   */
  public onShown(listener: (conversationId: string) => void): () => void;

  /**
   * @inheritdoc
   */
  public requestAsync(panel: PanelName, conversationId: string | null, open: boolean, callerConversationId: string | null, signal?: AbortSignal): Promise<string>;
}

/**
 * The registered provider adapters, keyed by provider id.
 */
export declare class ProviderKindRegistry {
  /**
   * Registers an adapter under its descriptor's id, with how TeamRun finds its command-line tool when the person installs one.
   * @param adapter The adapter.
   * @param tool How TeamRun finds the provider's command-line tool; `null` by default, for a provider without one or one TeamRun installs.
   * @throws ArgumentException when the provider is already registered.
   */
  public register(adapter: IProviderAdapter, tool?: IProviderTool | null): void;

  /**
   * Returns whether a provider is registered.
   * @param kind The kind id.
   * @returns `true` when registered.
   */
  /**
   * Takes a kind off the list and returns its adapter, or `null` when it isn't listed.
   */
  public unregister(kind: string): IProviderAdapter | null;

  public has(kind: string): boolean;

  /**
   * Returns a provider's adapter.
   * @param kind The kind id.
   * @returns The adapter.
   * @throws ServiceException named `ErrorCode.NotFound` when the kind is not registered.
   */
  public get(kind: string): IProviderAdapter;

  /**
   * Returns every registered adapter, in registration order.
   * @returns The adapters.
   */
  public all(): readonly IProviderAdapter[];

  /**
   * Returns how TeamRun finds each registered provider's command-line tool, in registration order, for the providers that have one.
   * @returns The tools.
   */
  public tools(): readonly IProviderTool[];
}

/**
 * `IProviderKindsService` over the registry, the providers and the event sink.
 */
export declare class ProviderKindsService implements IProviderKindsService {
  /**
   * Initializes the service.
   * @param registry The registered adapters.
   * @param providers The providers, for `listModelsAsync` through a provider.
   * @param events Where `ProviderKindInstallationChanged` is published.
   * @param planUsage Where `readPlanUsageAsync` keeps what it reads; a `PlanUsageService` on `events` by default.
   * @param teammates Whose speeds `modelCatalogAsync` clears when the catalog no longer lists them; none by default.
   */
  public constructor(registry: ProviderKindRegistry, providers: IProvidersService, events: IEventSink, planUsage?: IPlanUsageService,
    teammates?: ITeammatesService | null);

  /**
   * Lists the registered kinds, each saying whether it can name a chat: whether its adapter has `askIsolated`.
   * @returns Their descriptors.
   */
  public list(): readonly ProviderKind[];

  /**
   * @inheritdoc
   */
  public listModelsAsync(params: ProviderListModelsParams): Promise<readonly string[]>;

  /**
   * Returns provider-discovered models and their reported capabilities, with whether the provider's
   * answer says it is signed in; a teammate of that provider whose model the catalog lists without the teammate's speed loses its speed.
   */
  public modelCatalogAsync(params: ProviderListModelsParams): Promise<ProviderModelList>;

  /**
   * @inheritdoc
   */
  public listInstallations(): Promise<readonly ProviderKindInstallation[]>;

  /**
   * @inheritdoc
   */
  public listTools(): Promise<readonly ProviderTool[]>;

  /**
   * @inheritdoc
   */
  public install(params: ProviderKindParams): Promise<ProviderKindInstallation>;

  /**
   * @inheritdoc
   */
  public isInstalling(kind: string): boolean;
  public cancelInstall(params: ProviderKindParams): void;

  /**
   * @inheritdoc
   */
  public readPlanUsageAsync(params: PlanUsageParams): Promise<PlanUsage | null>;
}

/**
 * Keeps, in the `accountLimits` table, each account that reached a usage limit, so a limit outlives a restart.
 */
export declare class AccountLimits {
  /**
   * Reads and writes the rows in the context's database.
   * @param context The database the rows are kept in.
   */
  public constructor(context: DatabaseContext);

  /**
   * Keeps an account's limit, replacing the one it held.
   * @param providerId The account's provider id.
   * @param seenAt When TeamRun saw the limit, as an ISO 8601 time.
   * @param resetsAt When the limit resets, as an ISO 8601 time, or `null` when the provider didn't say.
   * @param transaction The transaction to write in; the connection when left out.
   */
  public recordAsync(providerId: string, seenAt: string, resetsAt: string | null, transaction?: SqlTransaction): Promise<void>;

  /**
   * Tells whether an account has no usage left: a plan read that began after the account's last limit shows a used-up window, or the
   * limit holds, until its reset time or, with none, until such a read shows room.
   * @param providerId The account's provider id.
   * @param now The time to judge a reset by, in milliseconds since the epoch.
   * @param usage The account's latest plan usage, or `null` when none was read.
   * @param transaction The transaction to read in; the connection when left out.
   * @returns Whether the account is out.
   */
  public isOutAsync(providerId: string, now: number, usage: PlanUsage | null, transaction?: SqlTransaction): Promise<boolean>;

  /**
   * Reads when an account's kept limit resets.
   * @param providerId The account's provider id.
   * @param transaction The transaction to read in; the connection when left out.
   * @returns The reset time, or `null` when the account has no kept limit or its limit named none.
   */
  public resetOfAsync(providerId: string, transaction?: SqlTransaction): Promise<string | null>;
}

/**
 * Chooses, at a turn's start, the Sustain entry a teammate's turn runs on.
 */
/**
 * A turn of the chat as a handover writes it.
 */
export declare class HandoverTurn {
  /**
   * The message's sequence number.
   */
  public readonly sequence: number;
  /**
   * The message as the handover writes it, its author's prefix included.
   */
  public readonly text: string;
  /**
   * Whether a tool result in it was cut by `Handover.cut`.
   */
  public readonly cut: boolean;
  /**
   * Whether it holds tool calls, each written as one line.
   */
  public readonly tools: boolean;

  public constructor(sequence: number, text: string, cut?: boolean, tools?: boolean);
}

/**
 * The history a handover chose.
 */
export declare class HandoverHistory {
  /**
   * The history as the prompt writes it, its left-out line included.
   */
  public readonly text: string;
  /**
   * The indexes of the turns it keeps.
   */
  public readonly kept: ReadonlySet<number>;
  /**
   * The indexes of the turns its summary covers in their place, the chat's first included when the history doesn't keep it; empty when it carries no
   * summary or one without an author, whose turns count as left out.
   */
  public readonly covered: ReadonlySet<number>;

  public constructor(text: string, kept: ReadonlySet<number>, covered?: ReadonlySet<number>);
}

/**
 * A handover prompt and what it carried.
 */
export declare class HandoverPrompt {
  /**
   * The prompt.
   */
  public readonly text: string;
  /**
   * What it carried, one line each: the first message, the summary, the messages kept whole, those left out and the message it answers.
   */
  public readonly carried: readonly string[];
  /**
   * Whether it left messages out that neither its history nor its summary carries.
   */
  public readonly leftOut: boolean;

  public constructor(text: string, carried: readonly string[], leftOut: boolean);
}

/**
 * What a Sustain note keeps of the handover its new session was sent.
 */
export declare class HandoverNote {
  /**
   * The prompt as it was sent.
   */
  public readonly prompt: string;
  /**
   * What it carried, one line each.
   */
  public readonly carried: readonly string[];
  /**
   * The line saying the new session reads what was left out with `list-messages`, or null when nothing was.
   */
  public readonly reads: string | null;

  public constructor(prompt: string, carried: readonly string[], reads: string | null);
}

/**
 * The compaction summary a Sustain handover carries in place of the chat it summarizes.
 */
export declare class HandoverSummary {
  /**
   * The summary the provider wrote.
   */
  public readonly text: string;
  /**
   * The sequence number of the last message it summarizes; every message after it but the chat's first is handed over as it is.
   */
  public readonly through: number;
  /**
   * The name of the provider kind that wrote it, which the Sustain note names; null when the note doesn't name it, and the messages it covers count as left out.
   */
  public readonly author: string | null;
  /**
   * Whether it is the session's own compaction summary; else TeamRun asked for it for the handover.
   */
  public readonly isCompaction: boolean;

  public constructor(text: string, through: number, author?: string | null, isCompaction?: boolean);
}

/**
 * A summary of a chat that a Sustain handover carries, and who wrote it.
 */
export declare class ChatSummary {
  /**
   * The summary.
   */
  public readonly text: string;
  /**
   * The name of the provider kind that wrote it, or null when it is unknown, for a summary kept from before TeamRun recorded it or of a kind no longer installed.
   */
  public readonly author: string | null;
  /**
   * Whether it is the left session's own compaction summary; else TeamRun asked a provider for it for the handover.
   */
  public readonly isCompaction: boolean;

  public constructor(text: string, author: string | null, isCompaction: boolean);
}

/**
 * The first prompt of a new session that a Sustain move starts: a selection of the chat that fits the target's window.
 */
export declare class Handover {
  /**
   * The bytes a handover's history may take: the window, less the provider's room and what the prompt carries besides, at most `maximum`;
   * below zero when the prompt's other texts alone overrun the window, which `build` takes as no room.
   * @param windowTokens The target's window, or null when no reply on its provider's kind and model reported one.
   * @param reserved The prompt's other texts, such as the teammate's instructions and the message it answers.
   * @param attachments The attachments of the message it answers.
   * @param maximum The most the history may take, `handoverMaximumBytes` for a handover; a summary's request takes the whole window.
   */
  public static budgetOf(windowTokens: number | null, reserved: readonly string[], attachments: readonly MessageAttachment[], maximum?: number): number;

  /**
   * Chooses the chat's first turn, then the compaction summary, cut to its start and end when it alone doesn't fit, then turns after it from the
   * newest back until the next older one doesn't fit, and ends with a line naming those left out, the summarized turns included.
   * @param chatId The chat the left-out line names.
   * @param turns The chat's turns, oldest first.
   * @param budget The bytes the history may take, its separators and the left-out line included.
   * @param summary The session's compaction summary, or null for none.
   * @returns The history, every turn when they all fit, or null when they don't and even the left-out line doesn't fit.
   */
  public static build(chatId: string, turns: readonly HandoverTurn[], budget: number, summary?: HandoverSummary | null): string | null;

  /**
   * Chooses as `build` does, and says which turns it kept.
   * @param chatId The chat the left-out line names.
   * @param turns The chat's turns, oldest first.
   * @param budget The bytes the history may take, its separators and the left-out line included.
   * @param summary The session's compaction summary, or null for none.
   * @returns The history and the turns it keeps, the summarized turns not among them, or null when even the left-out line doesn't fit.
   */
  public static choose(chatId: string, turns: readonly HandoverTurn[], budget: number, summary?: HandoverSummary | null): HandoverHistory | null;

  /**
   * What a history carried, one line each: the messages whole when it kept them all; else the first message when kept, the summary by its author
   * and the messages it covers, the later ones kept whole with the results cut, and those neither kept nor covered left out.
   * @param turns The chat's turns, oldest first.
   * @param kept The indexes of the turns the history keeps.
   * @param first The name of the first turn's author, or null when it has none.
   * @param summary The summary the history carries, or null; one without an author is not named, and the turns it covers count as left out.
   * @param covered The indexes of the turns the summary covers, as `choose` says.
   */
  public static carriedOf(turns: readonly HandoverTurn[], kept: ReadonlySet<number>, first: string | null, summary?: HandoverSummary | null,
    covered?: ReadonlySet<number>): string[];

  /**
   * Cuts a tool result longer than `handoverResultBytes` to its start and end, with a line naming its message and how much was left out.
   * @param result The result.
   * @param sequence The sequence number of the message that holds it whole.
   */
  public static cut(result: string, sequence: number): string;

  /**
   * The text's size in UTF-8 bytes, which a handover counts as its tokens.
   */
  public static bytesOf(text: string): number;
}

export declare class SustainRouter {
  /**
   * @param limits The accounts' kept usage limits.
   * @param usages Reads every account's latest plan usage.
   * @param usableAsync Tells whether an entry's account can take a turn now, such as being enabled.
   * @param timer Tells the time a limit's reset is judged by.
   */
  public constructor(limits: AccountLimits, usages: () => readonly PlanUsage[], usableAsync: (providerId: string) => Promise<boolean>, timer: ITimer);

  /**
   * Chooses the entry: the teammate's own while it has usage left or while Sustain is off, else the first usable fallback with usage left,
   * in the list's order or, with `resetsSoonestFirst`, the one whose plan window resets soonest; the teammate's own when none is left.
   * @param teammate The teammate whose turn starts.
   * @param own The teammate's own entry, with the turn's model and effort.
   * @param tried The accounts the reply's chain already tried, which it doesn't take again, the teammate's own included; none by default.
   * @returns The entry the turn runs on, `own` itself when it stays.
   */
  public chooseAsync(teammate: Teammate, own: TeammateFallback, tried?: ReadonlySet<string>): Promise<TeammateFallback>;

  /**
   * Chooses the entry as `chooseAsync` does, but tells when none is left: the teammate's own while it has usage left and the chain hasn't tried it,
   * or while Sustain is off, else the first usable fallback with usage left that the chain hasn't tried.
   * @param teammate The teammate whose reply goes on.
   * @param own The teammate's own entry, with the turn's model and effort.
   * @param tried The accounts the reply's chain already tried, the teammate's own included.
   * @returns The entry, `own` itself when it stays, or `null` when no entry is left.
   */
  public nextAsync(teammate: Teammate, own: TeammateFallback, tried: ReadonlySet<string>): Promise<TeammateFallback | null>;

  /**
   * Tells whether an account has no usage left now: its kept limit hasn't ended, or its plan is used up.
   * @param providerId The account's provider id.
   * @returns Whether it is out.
   */
  public isAccountOutAsync(providerId: string): Promise<boolean>;

  /**
   * Reads when an account's usage resets: its kept limit's reset, else the reset of its used-up plan windows.
   * @param providerId The account's provider id.
   * @returns The reset time, or `null` when neither names one.
   */
  public resetOfAsync(providerId: string): Promise<string | null>;

  /**
   * Tells whether a teammate can't go on: its own account is out and Sustain is off or has no usable fallback with usage left.
   * @param teammate The teammate.
   * @returns Whether it is out.
   */
  public isOutAsync(teammate: Teammate): Promise<boolean>;

}

/**
 * Keeps each provider's plan use in memory and publishes each change.
 */
export declare class PlanUsageService implements IPlanUsageService, Disposable {
  /**
   * Initializes the service.
   * At a used-up provider's `usedUpUntil` it publishes `PlanUsageUpdated` again with the same windows, no longer used up, with no new report.
   * @param events Where `PlanUsageUpdated` is published.
   * @param timer The clock that tells whether a reset has passed and waits for the next one; a `NodeTimer` by default.
   */
  public constructor(events: IEventSink, timer?: ITimer);

  /**
   * @inheritdoc
   */
  public record(kind: string, providerId: string | null, windows: readonly PlanWindow[], readAt: string, plan?: string | null): PlanUsage;

  /**
   * @inheritdoc
   */
  public list(): readonly PlanUsage[];

  /**
   * Stops waiting for the resets; the plan uses kept stay as they are.
   */
  public [Symbol.dispose](): void;
}

/**
 * `IProvidersService` over a `DatabaseContext`, the registry, and the event sink.
 */
export declare class ProvidersService implements IProvidersService {
  /**
   * Initializes the service.
   * @param context The context of the data directory.
   * @param registry The registered adapters, for `createAsync` and `checkAsync`.
   * @param conversations The conversations whose provider sessions a moved profile directory forgets.
   * @param events Where `ProviderUpdated` and `ProviderSignInsChanged` are published.
   * @param signInTimeout How long a sign-in may take, in milliseconds; five minutes by default.
   * @param log Where a sign-in check that throws or reports `Error` is logged, by its kind, provider and failure kind;
   *   nowhere by default.
   */
  public constructor(context: DatabaseContext, registry: ProviderKindRegistry, conversations: IConversationsService, events: IEventSink,
    signInTimeout?: number, log?: ILog | null);

  /**
   * @inheritdoc
   */
  public listAsync(transaction?: SqlTransaction): Promise<readonly Provider[]>;

  /**
   * @inheritdoc
   */
  public findAsync(providerId: string, transaction?: SqlTransaction): Promise<Provider | null>;

  /**
   * @inheritdoc
   */
  public findUsualAsync(kind: string, transaction?: SqlTransaction): Promise<Provider | null>;

  /**
   * @inheritdoc
   */
  public createAsync(params: ProviderCreateParams): Promise<Provider>;

  /**
   * @inheritdoc
   */
  public updateAsync(params: ProviderUpdateParams): Promise<Provider>;

  /**
   * @inheritdoc
   */
  public setEnabledAsync(params: ProviderEnabledParams): Promise<Provider>;

  /**
   * @inheritdoc
   */
  public checkAsync(params: ProviderIdParams): Promise<Provider>;

  /**
   * @inheritdoc
   */
  public signInAsync(params: ProviderIdParams, signal?: AbortSignal): Promise<Provider>;
  public readSignInCommandAsync(params: ProviderIdParams): Promise<ProviderSignInCommand | null>;

  /**
   * @inheritdoc
   */
  public cancelSignIn(params: ProviderIdParams): void;

  /**
   * @inheritdoc
   */
  public signOutAsync(params: ProviderIdParams): Promise<Provider>;

  /**
   * @inheritdoc
   */
  public listSignIns(): ProviderSignIns;

  /**
   * @inheritdoc
   */
  public discoverAsync(params: ProviderProfileDiscoverParams): Promise<ProviderProfileDiscovery>;

  /**
   * @inheritdoc
   */
  public listOwnMcpServersAsync(params: ProviderIdParams): Promise<ProviderMcpServerList>;

  /**
   * @inheritdoc
   */
  public deleteAsync(params: ProviderIdParams): Promise<void>;

  /**
   * @inheritdoc
   */
  public readFirstLaunchAsync(transaction?: SqlTransaction): Promise<FirstLaunch>;

  /**
   * @inheritdoc
   */
  public finishFirstLaunchAsync(): Promise<FirstLaunch>;
}

/**
 * The in-process event bus: the core publishes, the runtime subscribes. Listeners are called in
 * registration order, synchronously.
 */
export declare class EventHub implements IEventSink {
  /**
   * The number of active subscriptions.
   */
  public get listenerCount(): number;

  /**
   * Registers a listener.
   * @param listener The listener.
   * @returns The subscription; dispose it to stop the delivery.
   */
  public subscribe(listener: IEventListener): EventSubscription;

  /**
   * @inheritdoc
   */
  public publish(event: Event): void;
}

/**
 * The bookkeeping of one reply while its turn runs: it is the adapter's `ITurnListener`, persists
 * every change of the reply through the services, and publishes the events. Created by the engine
 * per `send`.
 */
/**
 * One file the working tree shows changed since a turn started.
 */
export declare class WorkingTreeChange {
  /**
   * The absolute path.
   */
  public readonly path: string;
  /**
   * `add`, `update`, or `delete`.
   */
  public readonly kind: string;
  /**
   * The bounded unified diff, or null for a binary or oversized one, or a path the checkpoints module couldn't read.
   */
  public readonly diff: string | null;

  /**
   * Initializes the change.
   * @param path The absolute path.
   * @param kind `add`, `update`, or `delete`.
   * @param diff The unified diff, or `null`.
   */
  public constructor(path: string, kind: string, diff: string | null);
}

/**
 * A file's state, as a reply's run reads it before and after a command that names it as written.
 */
export declare class FileSnapshot {
  /**
   * The state of a path where nothing exists.
   */
  public static readonly missing: FileSnapshot;

  /**
   * Whether anything exists at the path.
   */
  public readonly exists: boolean;
  /**
   * Whether it is a file, not a folder or anything else.
   */
  public readonly isFile: boolean;
  /**
   * The file's size in bytes; 0 for anything else.
   */
  public readonly size: number;
  /**
   * When it was last modified, in milliseconds since the epoch.
   */
  public readonly modified: number;
  /**
   * The file's text, or null when it is binary, larger than `Resources.maximumDiffBytes` or past what the reads have left to read.
   */
  public readonly text: string | null;

  /**
   * Initializes the snapshot.
   * @param exists Whether anything exists at the path.
   * @param isFile Whether it is a file.
   * @param size The file's size in bytes.
   * @param modified When it was last modified, in milliseconds since the epoch.
   * @param text The file's text, or null.
   */
  public constructor(exists: boolean, isFile: boolean, size: number, modified: number, text: string | null);

  /**
   * Returns whether another snapshot of the path shows it unchanged.
   * @param other The other snapshot.
   * @returns Whether both agree on every field, the text only when both read it, as a read past the reads' bytes doesn't.
   */
  public isSameAs(other: FileSnapshot): boolean;
}

/**
 * A run of lines a file's diff removes from the old text and adds from the new.
 */
export declare class DiffRun {
  /**
   * The run's first line in the old text, counted from 0.
   */
  public readonly oldAt: number;
  /**
   * The run's first line in the new text, counted from 0.
   */
  public readonly newAt: number;
  /**
   * How many lines of the old text it removes.
   */
  public readonly removed: number;
  /**
   * How many lines of the new text it adds.
   */
  public readonly added: number;

  /**
   * Initializes the run.
   * @param oldAt The run's first line in the old text, counted from 0.
   * @param newAt The run's first line in the new text, counted from 0.
   * @param removed How many lines of the old text it removes.
   * @param added How many lines of the new text it adds.
   */
  public constructor(oldAt: number, newAt: number, removed: number, added: number);
}

/**
 * The checkpoints module's service, as the engine uses it, which the module's runtime part publishes.
 */
export interface ICheckpointsService {
  captureAsync(request: CaptureRequest, signal?: AbortSignal): Promise<CaptureResult>;
  compareAsync(request: CompareRequest, signal?: AbortSignal): Promise<CompareResult>;
  readAsync(request: ReadRequest, signal?: AbortSignal): Promise<ReadResult>;
  previewRestoreAsync(request: PreviewRequest): Promise<PreviewResult>;
  restoreAsync(request: RestoreRequest): Promise<RestoreResult>;
  deleteFolderAsync(request: DeleteFolderRequest, signal?: AbortSignal): Promise<DeleteFolderResult>;
}

/**
 * What a rewind's restore of a project's folder did: how many paths it changed, or why it changed none, in plain words.
 */
export declare class CheckpointRestore {
  /**
   * How many paths the restore changed, or `null` when it changed none.
   */
  public readonly files: number | null;
  /**
   * Why nothing was restored, in plain words, or `null` when the restore finished.
   */
  public readonly refusal: string | null;

  /**
   * A restore that finished.
   * @param files How many paths it changed.
   */
  public static restored(files: number): CheckpointRestore;

  /**
   * A restore that changed nothing.
   * @param refusal Why, in plain words.
   */
  public static refused(refusal: string): CheckpointRestore;
}

/**
 * A reply's working-tree evidence, read from the checkpoint taken before it: the files it changed, or why the checkpoints module
 * couldn't compare them.
 */
export declare class ReplyEvidence {
  /**
   * The changes kept, at most `Resources.maximumEvidenceFiles`; none when the module couldn't compare.
   */
  public readonly changes: readonly WorkingTreeChange[];
  /**
   * Whether the changes hold every changed file the provider didn't report and Git doesn't ignore, and a diff for each one the budget of
   * `Resources.maximumEvidenceDiffBytes` left room for.
   */
  public readonly isComplete: boolean;
  /**
   * The checkpoints module's outcome when it couldn't compare, or `null` when it did.
   */
  public readonly refusal: string | null;

  /**
   * Evidence the module compared.
   * @param changes The changes kept.
   * @param isComplete Whether nothing was left out.
   */
  public static compared(changes: readonly WorkingTreeChange[], isComplete: boolean): ReplyEvidence;

  /**
   * Evidence the module couldn't compare.
   * @param refusal The module's outcome.
   */
  public static refused(refusal: string): ReplyEvidence;
}

/**
 * The folder a reply works in: its project's root, named by the project's id, a folder attached to its chat, named by its path, or a
 * chat's own folder, named by the conversation's id.
 */
export declare class WorkFolder {
  /**
   * The id the checkpoints module names the folder's checkpoints by.
   */
  public readonly id: string;
  /**
   * The folder's absolute path.
   */
  public readonly path: string;

  /**
   * @param id The id the checkpoints module names the folder's checkpoints by.
   * @param path The folder's absolute path.
   */
  public constructor(id: string, path: string);

  /**
   * The work folder of a folder attached to a chat, named by a hash of its path, compared without case on Windows.
   * @param path The attached folder's absolute path.
   * @param platform The platform the folder is on, as `process.platform` names it, which it is by default.
   * @returns The work folder.
   */
  public static attached(path: string, platform?: string): WorkFolder;
}

/**
 * TeamRun's MCP endpoint as one turn reaches it: its URL, and the bearer tokens a provider session presents to it, each issued for
 * the turn's tool session and revoked when that provider session ends.
 */
export declare class McpEndpoint {
  /** The endpoint's URL on the loopback address. */
  public readonly url: string;

  /**
   * Initializes the endpoint.
   * @param url The endpoint's URL.
   * @param tokens The registry that issues and revokes the tokens.
   * @param session The id of the turn's tool session.
   */
  public constructor(url: string, tokens: SessionTokens, session: string);

  /**
   * Issues a token for a provider session of the turn, to send only as that session's `Authorization` header.
   * @returns The token.
   */
  public issue(): string;

  /**
   * Issues a kept token for a provider session that outlives the turn, as an agent process that follows its background tasks or a Codex
   * thread does: it reaches this turn's tools, and then each later turn's or wake's of the same chat and member that adopts it, until it's
   * revoked as the provider session ends.
   * @returns The token.
   */
  public issueKept(): string;

  /**
   * Moves a kept token to this turn, as the next turn or wake of the provider session that holds it opens.
   * @param token The kept token.
   * @returns Whether it moved: false for a token not kept, revoked or expired, or one of another chat's or member's.
   */
  public adopt(token: string): boolean;

  /**
   * Revokes a token as its provider session ends.
   * @param token The token.
   */
  public revoke(token: string): void;
}

/**
 * A chat member's tool token: the chat and teammate it was issued for, and when that teammate joined, so it stops holding once the member
 * leaves and joins again.
 */
export declare class MemberToken {
  /**
   * The chat's id.
   */
  public readonly conversationId: string;

  /**
   * The teammate's id, or `null` for the chat's default responder.
   */
  public readonly teammateId: string | null;

  /**
   * When the teammate joined the chat, or `null` when it isn't a member.
   */
  public readonly joinedAt: string | null;

  /**
   * @param conversationId The chat's id.
   * @param teammateId The teammate's id, or `null`.
   * @param joinedAt When the teammate joined, or `null`.
   */
  public constructor(conversationId: string, teammateId: string | null, joinedAt: string | null);
}

/**
 * The tool tokens of a chat's members, one per member while it holds, kept only in memory.
 */
export declare class MemberTokens {
  /**
   * @param conversations The chats, read for each member's membership.
   */
  public constructor(conversations: IConversationsService);

  /**
   * Issues a member's token, or gives the one it already holds, dropping tokens that no longer hold; calls for the same member that
   * run at once get the same token.
   * @param conversationId The chat's id.
   * @param teammateId The teammate's id, or `null`.
   * @returns The token: `Resources.mcpTokenBytes` random bytes as base64url.
   */
  public issueAsync(conversationId: string, teammateId: string | null): Promise<string>;

  /**
   * Finds the member a token was issued for, dropping it once it no longer holds.
   * @param token The token.
   * @returns The member, or `null` for a token that doesn't hold.
   */
  public findAsync(token: string): Promise<MemberToken | null>;
}

/**
 * The bearer tokens of provider sessions for TeamRun's MCP endpoint, kept only in memory as their SHA-256 hashes: each names the
 * turn's tool session it was issued for, and lasts until it is revoked, that tool session closes, or `Resources.sessionTokenLifetime`
 * after its issue. A kept token, for a provider session that outlives its turn, outlives its tool session's close too, reaching nothing
 * until a later tool session of the same member adopts it; it keeps every session that adopted it and reaches the latest still open, so a
 * wake that runs beside its turn hands the token back to the turn as it closes.
 */
export declare class SessionTokens {
  /**
   * @param now The clock, in milliseconds; `Date.now` by default.
   */
  public constructor(now?: () => number);

  /**
   * Opens a turn's tool session, whose tokens hold from now until it closes.
   * @param session The tool session's id.
   * @param owner The token of the chat's member the session is for, which never leaves the engine, so a kept token moves only within one membership.
   */
  public open(session: string, owner: string): void;

  /**
   * Closes a turn's tool session and drops its tokens but the kept ones, which go back to the latest other open session that adopted
   * them, or reach nothing, so a provider process kept open after the turn reaches nothing.
   * @param session The tool session's id.
   */
  public close(session: string): void;

  /**
   * Issues a token for a tool session, dropping those that no longer hold; the plaintext leaves only here.
   * @param session The tool session's id.
   * @returns The token: `Resources.mcpTokenBytes` random bytes as base64url.
   */
  public issue(session: string): string;

  /**
   * Issues a kept token for a tool session, as `issue` does: it outlives that session's close, until it's revoked or expires.
   * @param session The tool session's id.
   * @returns The token: `Resources.mcpTokenBytes` random bytes as base64url.
   */
  public issueKept(session: string): string;

  /**
   * Moves a kept token to a later tool session of the same owner, as that provider session's next turn or wake opens; the sessions it
   * reached before keep it, for when the later one closes.
   * @param token The kept token.
   * @param session The later tool session's id.
   * @returns Whether the token moved: false for a token TeamRun didn't issue, one not kept, revoked or expired, one issued for a session
   * that wasn't open, or a session that isn't open or is another owner's.
   */
  public adopt(token: string, session: string): boolean;

  /**
   * Finds the tool session a token reaches: the one it was issued for, or the latest still open that adopted it; a token that no longer
   * holds is dropped.
   * @param token The token a request presents.
   * @returns The session's id, or null when TeamRun didn't issue the token, or no session of it is open, or it expired or was revoked.
   */
  public find(token: string): string | null;

  /**
   * Finds the owner of a token that still holds, a kept one included while no session of it is open.
   * @param token The token a request presents.
   * @returns The owner its session was opened with, or null when TeamRun didn't issue the token, a token that isn't kept has no open
   * session, its session wasn't open at its issue, or it expired or was revoked.
   */
  public ownerOf(token: string): string | null;

  /**
   * Revokes a token, as the provider session that holds it ends; an unknown token is ignored.
   * @param token The token.
   */
  public revoke(token: string): void;
}

/**
 * The background commands the person stopped, kept in memory per chat and per teammate that started them as the note lines that tell the
 * teammate's next turn there, until a completed turn has been told them, the chat is deleted, or the teammate leaves it.
 */
export declare class StoppedCommands {
  /**
   * Keeps a stopped command's line for the teammate's next turn in the chat.
   * @param chatId The chat the command was started from.
   * @param teammateId The teammate whose turn started it; `null` for the chat's own provider.
   * @param line Its `Resources.formatStoppedCommand` line.
   */
  public add(chatId: string, teammateId: string | null, line: string): void;

  /**
   * The lines a teammate's next turn in a chat is told, in the order their commands were stopped.
   * @param chatId The chat.
   * @param teammateId The teammate; `null` for the chat's own provider.
   */
  public of(chatId: string, teammateId: string | null): readonly string[];

  /**
   * Drops the lines a completed turn was told, keeping those added while it ran.
   * @param chatId The chat.
   * @param teammateId The teammate; `null` for the chat's own provider.
   * @param lines The lines the turn was told.
   */
  public told(chatId: string, teammateId: string | null, lines: readonly string[]): void;

  /**
   * Drops the lines of deleted chats.
   * @param chatIds The deleted chats' ids.
   */
  public forget(chatIds: readonly string[]): void;

  /**
   * Drops a teammate's lines, in one chat or in every one.
   * @param teammateId The teammate, removed from the chat or deleted.
   * @param chatId The chat it left; `null` for every chat, when the teammate is deleted.
   */
  public forgetTeammate(teammateId: string, chatId: string | null): void;
}

/**
 * The checkpoints a work folder keeps in the checkpoints module, named to it by the folder's id: one taken before each reply,
 * the folder's changes since it, which are the reply's evidence, a rewind's restore of it through the module's preview, and the
 * delete of them all. The module never reads or writes the folder's own Git, so a folder without Git has them too; only the
 * evidence asks the person's Git, through `GitIgnores`, which changed paths it ignores, as `git status` leaves them out.
 */
export declare class ReplyCheckpoints {
  /**
   * @param service The checkpoints module's service.
   */
  public constructor(service: ICheckpointsService);

  /**
   * Takes a checkpoint of the work folder before a reply.
   * @param folder The work folder.
   * @param replyId The reply's id, which the checkpoint's label names.
   * @param signal Stops the capture, as the reply's Stop and quitting do; none by default.
   * @returns The module's result: the checkpoint, or the outcome for which it took none, as for a missing folder or low disk space.
   * @throws {Error} The signal's reason, when it stops the capture.
   */
  public captureAsync(folder: WorkFolder, replyId: string, signal?: AbortSignal): Promise<CaptureResult>;

  /**
   * Gives the folder's changes since a checkpoint that the provider didn't report and Git doesn't ignore, the first
   * `Resources.maximumEvidenceFiles` of them. Git is asked once with `git check-ignore`, which leaves tracked files in as `git status`
   * does, from the work folder; a folder in no repository, or a Git that can't run, ignores nothing.
   * Each comes with its diff with the folder now: kept only while it is text of at most `Resources.maximumDiffBytes`, and cut to its first
   * `Resources.maximumDiffLines` lines. A path either side couldn't read has none, and neither does a diff past what is left of
   * `Resources.maximumEvidenceDiffBytes`, which the reads never pass: the read cut there spends the rest, so the files after it have none.
   * @param workFolder The work folder.
   * @param checkpoint The checkpoint's id.
   * @param isReported Whether the provider reported the change at an absolute path, which the evidence then leaves out.
   * @param signal Stops the compare and the reads, as the reply's Stop and quitting do; none by default.
   * @returns The changes, at their absolute paths, and whether any were left out; or the module's outcome when it couldn't compare.
   * @throws {Error} The signal's reason, when it stops them.
   */
  public changesSinceAsync(workFolder: WorkFolder, checkpoint: string, isReported: (path: string) => boolean, signal?: AbortSignal): Promise<ReplyEvidence>;

  /**
   * Restores the paths the removed replies changed to a checkpoint through the module's preview, leaving every other path as it is now,
   * or the whole work folder when the files are null. A file outside the work folder, or whose name holds a backslash, is left out.
   * @param workFolder The work folder.
   * @param checkpoint The checkpoint's id.
   * @param files The files the removed replies changed, absolute or relative to the work folder, as their changes details list them,
   * or null when their details may not list them all.
   * @returns How many paths the plan changed, or why nothing was restored.
   */
  public restoreAsync(workFolder: WorkFolder, checkpoint: string, files: readonly string[] | null): Promise<CheckpointRestore>;

  /**
   * Deletes all of the work folder's checkpoints.
   * @param folder The work folder.
   * @param signal Ends the delete when it aborts, as the checkpoints module's `DeleteFolder` does.
   * @returns Whether they are deleted; `false` while an interrupted restore of the folder holds them up.
   * @throws {Error} When the system refuses to move the folder's store aside, or the signal aborts the delete.
   */
  public deleteAsync(folder: WorkFolder, signal?: AbortSignal): Promise<boolean>;
}

/**
 * The paths among a reply's working-tree changes that the person's Git ignores, from one `git ls-files --others --ignored --exclude-standard
 * --directory` walk of the folder, which never lists a tracked file or a path inside a submodule. Git is the one found in the path's absolute
 * folders, started in its own folder with `-C` and with the folder's `core.fsmonitor` program off, so no program the folder names runs.
 */
export declare class GitIgnores {
  /**
   * Gets the paths among `paths`, relative to `folder` with `/` between names, that Git ignores in `folder`: those it lists, those inside
   * a folder it lists, and removed paths whose highest missing folder, or the path itself, it ignores, those in a submodule left out; when the check of the removed
   * paths fails, the listed ones are still given. Git
   * is the first one in the path's absolute folders, read at each call, passing over macOS's stand-in when the active developer
   * folder is missing; it runs for at most `Resources.gitTimeout` milliseconds, or `Resources.gitTimeoutVariable`'s value.
   * @param folder The chat's folder.
   * @param paths The changed paths to check.
   * @param signal Stops the check.
   * @returns The ignored paths: none when no path is given, the folder isn't in a Git repository, no Git is found, or Git can't start, fails,
   * runs out of time or is stopped. It settles only once Git has ended, and throws any other failure.
   */
  public ignoredAsync(folder: string, paths: readonly string[], signal?: AbortSignal): Promise<ReadonlySet<string>>;
}

/**
 * The files a reply's commands name as written outside the chat's folder, read when each command's step first comes and again after the
 * turn, for the reply's working-tree evidence of them.
 */
export declare class CommandWrites {
  /**
   * Initializes the reads for one turn.
   * @param root The chat's folder.
   * @param since When the turn started, in milliseconds since the epoch: a named file modified since then that looks the same both times
   * was written before its first read, and is listed without a diff.
   * @param platform The platform the commands ran on, as `process.platform` names it, which it is by default.
   */
  public constructor(root: string, since: number, platform?: string);

  /**
   * Reads the state of each file a command's step names as written outside the chat's folder, the first time a step names it, for the
   * first `Resources.maximumEvidenceFiles` files.
   * @param payload The command step's payload.
   */
  public note(payload: JsonValue): void;

  /**
   * Reads the named files again and gives those that changed, each added, updated or deleted, with a unified diff of their text when both
   * reads kept it: text of at most `Resources.maximumDiffBytes`, within `Resources.maximumEvidenceDiffBytes` for all the reads.
   * @param isReported Whether the provider reported a change at an absolute path, which the evidence then leaves out.
   * @returns The changes, and whether files were left out because there were too many or a read failed.
   */
  public changesSince(isReported: (path: string) => boolean): ReplyEvidence;

  /**
   * Reads a command step's targets: the files it names, at absolute paths, and the folders where it may write files it doesn't name. A step
   * whose provider gave no targets may write anywhere in the folder it ran in. A path from the home folder resolves there, and on Windows a
   * path rooted without a drive counts as unnamed in its own folder as written, such as `/tmp`, since a POSIX shell and PowerShell read it
   * differently.
   * @param payload The command step's payload.
   * @param root The chat's folder, which the step's `cwd` and the targets resolve against.
   * @param platform The platform the command ran on, as `process.platform` names it, which it is by default.
   * @returns The files and folders.
   */
  public static targetsOf(payload: JsonValue, root: string, platform?: string): { readonly files: readonly string[]; readonly unnamedIn: readonly string[] };

  /**
   * Returns the key two paths to one folder share: its nearest existing ancestor's real path, with the rest of the path after it.
   * @param path The absolute path.
   * @returns The key.
   */
  public static folderKey(path: string): string;

  /**
   * Returns whether a folder key is outside another's.
   * @param root The key of the chat's folder.
   * @param path The key to test.
   * @returns Whether it is outside.
   */
  public static isOutside(root: string, path: string): boolean;

  /**
   * Returns the key two paths to one file share: its folder's real path when it exists, and its name, in lower case.
   * @param path The path.
   * @returns The key.
   */
  public static pathKey(path: string): string;
}

/**
 * The times a reply's own tools ran, from each tool step's start to its end and each background task's, for telling
 * the files they changed from those something else changed in the folder meanwhile, such as a pull, a checkout or another program.
 */
export declare class ToolWindows {
  /**
   * Opens a tool step's window when it first comes, keyed by its tool use or else its item, and closes it when the step ends: its status
   * is one of `Resources.endedToolStatuses`, it carries an `output`, or a note with its tool use and no tool comes. A tool step is a
   * command, a file change, or any step whose payload names its `tool`, such as an ACP delete or move or an MCP tool call. A step Codex marks read-only opens
   * none, and a terminal tool's step or a Claude Code command run in the background stays open until `close`.
   * @param detail The step the provider reported.
   * @param at When it came, in milliseconds since the epoch.
   */
  public note(detail: TurnDetail, at: number): void;

  /**
   * Opens a window, unless it is open or has already closed.
   * @param key The window's key.
   * @param at When it opens, in milliseconds since the epoch.
   */
  public start(key: string, at: number): void;

  /**
   * Closes a window, unless it stays open until `close`.
   * @param key The window's key.
   * @param at When it closes, in milliseconds since the epoch.
   */
  public end(key: string, at: number): void;

  /**
   * Closes every window still open, when the turn ends.
   * @param at When the turn ended, in milliseconds since the epoch.
   */
  public close(at: number): void;

  /**
   * Returns whether a changed file is the tools': at or under a path a tool step reported, in its `files` or as a command's write
   * targets, a move's source and target included, whatever its times, though one at or above the chat's folder covers nothing under
   * it; otherwise whether it was written while a window was open, within
   * `Resources.toolWindowSlackMilliseconds`: the later of its
   * modified and status-change times, so a move or an extract that keeps the old modified time still counts, or for a file that's gone
   * its nearest existing folder's up to the chat's folder. A file whose time can't be read counts as
   * written by the tools.
   * @param path The file's absolute path.
   * @param root The chat's folder.
   * @returns Whether a tool may have written it.
   */
  public covers(path: string, root: string): boolean;
}

/**
 * A chat's title and the first line of a model's answer, as the chat list shows them.
 */
export declare class ConversationTitle {
  /**
   * The first line with text, trimmed and cut to `Resources.maximumTitleLength` with an ellipsis.
   */
  public readonly text: string;

  /**
   * Initializes the title from a chat's first message.
   * @param message The message.
   */
  public constructor(message: string);

  /**
   * Reads a title from what a model answered, without a label, marks, quotes or a closing period.
   * @param answer The model's answer.
   * @returns The title, or `null` when the answer holds none.
   */
  public static ofAnswer(answer: string): string | null;
}

/**
 * The model asked for a chat's title.
 */
export declare class TitleModel {
  /**
   * The provider, or `null` for the kind's usual one.
   */
  public readonly provider: Provider | null;
  /**
   * The provider's kind.
   */
  public readonly kind: string;
  /**
   * The model, or `null` for the provider's default.
   */
  public readonly model: string | null;

  /**
   * Initializes the model.
   * @param provider The provider, or `null` for the kind's usual one.
   * @param kind The provider's kind.
   * @param model The model, or `null` for the provider's default.
   */
  public constructor(provider: Provider | null, kind: string, model: string | null);

  /**
   * Tells whether another model is this one.
   * @param other The other model.
   * @returns Whether both name the same provider and model.
   */
  public isSameAs(other: TitleModel): boolean;
}

/**
 * Names a new chat with a title from a model, in a background session with no tools, without ever holding or failing the chat's turn: the model the
 * setting chooses, then the chat's, and the first characters stay when both fail. A title the person set is never replaced.
 */
export declare class ChatTitles {
  /**
   * Initializes the titles.
   * @param conversations The chats.
   * @param providers The providers, to find the chosen one.
   * @param registry The provider kinds, whose adapters answer.
   * @param events Told when a chat's title changes.
   * @param folder The empty folder title sessions run in, made on the first ask.
   * @param readChoice Reads the Title model setting's value.
   * @param log Takes a failure's provider kind, never its text; none by default.
   * @param timeout How long one model may take, in milliseconds; `Resources.titleAskTimeout` by default.
   */
  public constructor(
    conversations: IConversationsService,
    providers: IProvidersService,
    registry: ProviderKindRegistry,
    events: IEventSink,
    folder: string,
    readChoice: () => string,
    log?: ILog | null,
    timeout?: number);

  /**
   * Starts asking for a chat's title and settles once the models are chosen, without waiting for their answers, asking no model when none can be asked, and takes the chat's agent's own title until its first
   * turn ends.
   * @param chatId The chat.
   * @param opening The chat's first message, with its attachments' names.
   * @param chatModel The model answering the first message, or `null` when none does.
   */
  public beginAsync(chatId: string, opening: string, chatModel: TitleModel | null): Promise<void>;

  /**
   * Takes a title the chat's provider gave its session during the chat's first turn, while no model's title was applied, which ends any ask still
   * running, even after every model failed; later titles are ignored.
   * @param chatId The chat.
   * @param title The provider's title.
   */
  public offerAsync(chatId: string, title: string): Promise<void>;

  /**
   * Stops taking the agent's own title once the chat's first turn ends; the asks still running go on.
   * @param chatId The chat.
   */
  public end(chatId: string): void;

  /**
   * Ends the asks for chats being deleted, and takes no agent title for them.
   * @param chatIds The chats.
   */
  public forget(chatIds: readonly string[]): void;

  /**
   * Ends every ask and waits for them.
   * @returns A promise that settles when none is left.
   */
  public shutdown(): Promise<void>;
}

export declare class ReplyRun implements ITurnListener {
  /**
   * Initializes the run over the pending reply.
   * @param message The pending reply as persisted.
   * @param provenance The reply's provenance.
   * @param run The run's bookkeeping.
   * @param messages Where the reply is persisted.
   * @param approvals Where approvals are persisted.
   * @param events Where events are published.
   * @param dataDirectory The data directory, where generated images are stored as files.
   * @param conversations The conversations, where a teammate's provider session is saved; none by default.
   * @param log Where the reply is logged if it ends in an error, by its kind, provider and failure kind; nowhere by
   *   default.
   * @param tasks Where the reply's background tasks are kept; nowhere by default.
   * @param planUsage Where the plan use the reply's provider reports is kept; nowhere by default.
   * @param wakes Starts the reply for a turn the provider began on its own after this one, told whether this reply still runs, so the provider
   *   runs that turn ahead of it; none by default, so no such turn shows.
   * @param checkpoints Where the reply takes a checkpoint of its work folder before its turn, and reads the files its turn changed as
   *   its evidence; none by default, so the reply has neither.
   * @param folder The folder the reply works in, its project's or its chat's own; none by default.
   * @param titles Takes a title the provider gave its session; none by default.
   * @param steerable Called when the turn offers a steer, so the chat's waiting Steer messages can go into it; none by default.
   * @param account The account the reply runs on, as `Resources.formatStoppedAccount` names it, which a turn stopped at a usage limit names in its
   * error; none by default, when the error says the turn failed as any other.
   */
  public constructor(
    message: Message,
    provenance: Provenance,
    run: ActiveRun,
    messages: IMessagesService,
    approvals: IApprovalsService,
    events: IEventSink,
    dataDirectory: string,
    conversations?: IConversationsService | null,
    log?: ILog | null,
    tasks?: IBackgroundTasksService | null,
    planUsage?: IPlanUsageService | null,
    wakes?: ((source: Message, wake: TurnWake, ahead: boolean) => Promise<WakeTurn | null>) | null,
    checkpoints?: ReplyCheckpoints | null,
    folder?: WorkFolder | null,
    sharedFailures?: ReportedSharedMcpFailures,
    titles?: ChatTitles | null,
    steerable?: (() => Promise<void>) | null,
    account?: string | null);

  /**
   * Ends the stopped line of a turn that stopped at a usage limit with the Sustain entries that are out, in place of its reset.
   * @param entries The entries, as `Resources.formatSustainAllOut` gives them.
   * @returns A promise that settles once the stopped line is stored.
   */
  public noteAllOutAsync(entries: string): Promise<void>;

  /**
   * Whether the turn offers a steer now; never after the run ends.
   */
  public get isSteerable(): boolean;

  /**
   * Returns the files a reply's changes details list: the provider's own reports, a command's writes and the working-tree evidence.
   * @param details The reply's details.
   * @returns The files, as the details list them, absolute or relative to the work folder.
   */
  public static reportedFiles(details: readonly MessageDetail[]): readonly string[];

  /**
   * Returns whether a reply's details may not list every file it changed: its comparison failed, was refused, left files out or was stopped.
   * @param details The reply's details.
   * @returns True when a note of the details says so.
   */
  public static hasPartialEvidence(details: readonly MessageDetail[]): boolean;

  /**
   * Runs the turn to its end: marks the reply running, delegates to the adapter, records the
   * outcome as the reply's final status (`Completed`, `Failed` with an error detail, `Cancelled`
   * with a note when the user cancelled, `Interrupted` otherwise), and cancels approvals still
   * pending. While a sub-agent's row still runs or a background task it reported hasn't ended, the reply's approvals and questions stay open,
   * and a late ask shows a card in the reply without changing its status; once the last of that work ends, or a later report finds the reply deleted,
   * any card still open is cancelled.
   * @param adapter The provider's adapter.
   * @param request What to run.
   * @param notes Notes the reply shows before the provider's own details, such as a shared MCP server left out of the session; none by default.
   * @param moved The Sustain note of a turn that moved to another account, shown before the notes; none by default.
   * @param handover The first prompt the moved turn's new session was sent and what it carried, kept in the Sustain note's payload; none when the turn resumed a session.
   * @param posted Whether the engine already posted the Sustain note as the reply's last detail, before TeamRun's own summary ran; it then takes the
   * final text and payload in place, rather than a second note.
   */
  public executeAsync(adapter: IProviderAdapter, request: TurnRequest, notes?: readonly string[], moved?: string | null, handover?: HandoverNote | null,
    posted?: boolean): Promise<void>;

  /**
   * Runs a turn the provider began on its own as this reply, as `executeAsync` does a turn it asked for: the turn's kept reports first, then the
   * rest until the provider ends it. A failure to store the reply is thrown, for its group to fail.
   * @param wake The turn.
   */
  public followAsync(wake: WakeTurn): Promise<void>;

  /**
   * Keeps why a module stopped the turn, for the note the reply ends with once its turn is cancelled.
   * @param reason Why the module stopped it.
   */
  public noteStop(reason: string): void;

  /**
   * Ends the reply as completed with one note and no turn, as when there's nothing to run.
   * @param note The note.
   * @returns A promise that settles once the reply is stored as completed.
   */
  public answerAsync(note: string): Promise<void>;

  /**
   * @inheritdoc
   */
  public onStartedAsync(start: TurnStart): Promise<void>;

  /**
   * @inheritdoc
   * @remarks
   * Once the reply has ended, the details of its running sub-agents are stored one at a time, in the order they come, each over the reply as stored.
   */
  public onDetailAsync(detail: TurnDetail): Promise<void>;

  /**
   * @inheritdoc
   */
  public onThinking(): void;

  /**
   * Queues what a tool call kept for its step, to add it to the step, which keeps it when the provider reports the step again; a record whose step
   * hasn't come yet waits for it, and a record after the reply ended is dropped. Its image is stored as a step's image is. Records are stored one
   * at a time, in the order they come, and the turn waits for them before it reports its outcome; a record that fails to store is logged as
   * `Resources.formatToolCallNotKept`, and the next one is still stored.
   * @param record The call's record.
   */
  public noteToolCall(record: ToolCallRecord): void;

  /**
   * @inheritdoc
   */
  public onTitleAsync(title: string): Promise<void>;

  /**
   * @inheritdoc
   */
  public onApprovalRequested(ask: ApprovalAsk, signal?: AbortSignal): Promise<string>;

  /**
   * @inheritdoc
   */
  public onQuestionsAsked(ask: QuestionAsk, signal?: AbortSignal): Promise<readonly QuestionAnswer[] | null>;

  /**
   * @inheritdoc
   */
  public onQuestionsPostedAsync(ask: QuestionAsk): Promise<void>;

  /**
   * Reads the provider's id a posted question's answer replies to.
   * @param approval The approval.
   * @returns The payload's `replyTo` of a `Question` approval posted through `onQuestionsPostedAsync`, or `null` for any other approval.
   */
  public static replyToOf(approval: Approval): string | null;

  /**
   * Shows a Noldova Desktop permission request as a `Permission` approval on the reply, with `Resources.chatPermissionOptions` when
   * the ask remembers its allowing for the chat, and otherwise Allow once, the module's allow-always label if it gives one, approved for the
   * session, Deny, and the module's take-over label if it gives one, denied for the session; and waits for the person's answer from the window.
   * @param ask The request.
   * @param signal Aborts when the answer is no longer wanted, at the request's expiry or withdrawal; the approval is then withdrawn.
   * @returns The option the person chose, as `Resources.permissionAnswers` maps it; `Denied` when they denied it, the signal aborted, or
   * the reply ended.
   */
  public onPermissionRequested(ask: PermissionAsk, signal: AbortSignal): Promise<PermissionAnswer>;

  /**
   * @inheritdoc
   */
  public onObservedAsync(observed: ObservedSettings): Promise<void>;

  /**
   * Merges the usage into the reply's provenance and publishes the reply; nothing once the reply has finished.
   * @param usage The figures, `null` where the provider sent none.
   * @returns A promise that settles once the reply is stored.
   */
  public onUsageAsync(usage: ReplyUsage): Promise<void>;

  /**
   * Keeps the plan use under the reply's kind and provider, unless a later read is already kept.
   * @param windows The windows, each under the provider's own name.
   * @param readAt When the read began, as ISO 8601.
   * @returns A promise that settles once a failed turn's error, restated for the plan use, is stored.
   */
  public onPlanUsageAsync(windows: readonly PlanWindow[], readAt: string): Promise<void>;

  /**
   * @inheritdoc
   * @remarks
   * Kept after the reply ends: a provider that still owns the task reports it later. A task reported once the reply's teammate is no longer in
   * the chat, removed or deleted, is stopped at once and not kept. The task keeps the reply's run open from the moment it is reported, while
   * that check reads the chat.
   */
  public onTaskStartedAsync(start: TaskStart): Promise<void>;

  /**
   * @inheritdoc
   */
  public onTaskOutput(taskId: string, text: string): void;

  /**
   * @inheritdoc
   * @remarks
   * An end reported while the task's start is still being recorded waits for that start, so the task ends after it starts.
   */
  public onTaskEndedAsync(end: TaskEnd): Promise<void>;

  /**
   * @inheritdoc
   */
  public onWakeAsync(wake: TurnWake): Promise<WakeTurn | null>;

  /**
   * Notes the failure in the reply, unless its chat already noted the same failure since TeamRun started, or the reply has ended.
   * @param failure The server and why its provider couldn't use it.
   * @returns A promise that settles once the note is stored.
   */
  public onSharedServerFailedAsync(failure: SharedMcpFailure): Promise<void>;

  /**
   * Keeps the turn's steer, or drops it with `null`, and calls `steerable` when one is offered, without waiting for it: a failure of `steerable` is
   * logged as `Resources.formatWaitingMessageNotSent`; ignored after the run ends.
   * @param steer The adapter's steer, or `null`.
   */
  public onSteerable(steer: ((steer: TurnSteer) => Promise<boolean>) | null): void;

  /**
   * Gives the provider a person's message through the turn's steer.
   * @param steer The message's text and attachments.
   * @returns `true` once the provider took it; `false` when the turn offers no steer, or its steer refused or failed, which is logged.
   */
  public steer(steer: TurnSteer): Promise<boolean>;
}

/**
 * `IConversationEngine` over the record, the registry, and the event sink: one open reply per
 * conversation, the provider's session resumed for the same kind and provider, and every change
 * of a reply persisted and published as it happens.
 * A teammate's completed reply that mentions other teammates, outside code and quotation marks, hands
 * the work to them: the reply keeps its resolved mentions, and each other teammate it names joins the conversation and replies after
 * the replies already queued, in mention order, until the chain reaches the hop limit. A failed or
 * cancelled reply, or one after a stop, hands off to no one, and a stop cancels every reply of the chain.
 */
export declare class ConversationEngine implements IConversationEngine, IOutsideMessages, IPermissionAsker, ISenderSends, ISenderTokens {
  /**
   * Initializes the engine.
   * @param context The context of the data directory, for the transaction that records a send.
   * @param projects The projects, for the working directory.
   * @param conversations The conversations.
   * @param messages The messages.
   * @param approvals The approvals.
   * @param providers The providers.
   * @param registry The registered adapters.
   * @param events Where events are published.
   * @param readHopLimit Reads, when a teammate's reply mentions others, how many hand-offs a chain may take; `Resources.defaultHopLimit` by
   * default.
   * @param log Where a reply that ends in an error is logged, by its kind, provider and failure kind; nowhere by default.
   * @param readCommand Reads, when a teammate's turn starts, the command its instructions name and the variables its turn needs to run it,
   * such as a `PATH` led by the command's folder before the one the turn's provider starts with, or `null` when the app has none, and the
   * instructions then leave out the note on other chats; `Resources.defaultCommand` with no variables by default.
   * @param tasks Where replies keep their background tasks; nowhere by default.
   * @param planUsage Where replies keep the plan use their providers report; nowhere by default.
   * @param tools Opens each turn's agent session, which the turn's provider reaches as TeamRun's MCP server; none by default, and the
   * turns then have no tools. The engine issues each member of a chat, a teammate or the chat's default teammate, an MCP token at its
   * first turn, and keeps it until the member leaves the chat, the chat is deleted or the engine ends; each turn, a wake's included,
   * opens its own session, scoped `<conversation id>/<teammate id>` or `<conversation id>/default`, and ends it when the provider's run ends.
   * @param checkpoints The checkpoints module's service, where each reply takes a checkpoint of its project's folder and reads its
   *   evidence, and a rewind restores the folder; none by default, so replies have neither and a rewind restores no files.
   * @param sharedServers Chooses the shared MCP servers each turn gets, and the notes for those left out; none by default.
   * @param sharedImages Keeps the copies of written images shared with a window's page; the data folder's `shared-images` folder by
   * default, which the engine cleans of copies whose shares have ended when it starts.
   * @param commandStarter Starts a turn's background commands; none by default, so `startCommandAsync` is refused.
   * @param readTitleModel Reads the Title model setting's value when a chat's first message is sent: empty for the chat's own model, or the provider's id and the model's joined by `Resources.titleModelSeparator`.
   * @param readIdleCompaction Reads, as each turn starts and again when a provider asks to compact an idle chat, whether the person lets it; on by default.
   * @param timer Tells the time Sustain records a usage limit at and judges its reset by; the system clock by default.
   */
  public constructor(
    context: DatabaseContext,
    projects: IProjectsService,
    conversations: IConversationsService,
    messages: IMessagesService,
    approvals: IApprovalsService,
    providers: IProvidersService,
    teammates: ITeammatesService,
    registry: ProviderKindRegistry,
    events: IEventSink,
    attachments?: AttachmentStore | null,
    readHopLimit?: () => number,
    log?: ILog | null,
    readCommand?: () => Promise<TeammateCommand | null>,
    tasks?: IBackgroundTasksService | null,
    planUsage?: IPlanUsageService | null,
    tools?: ITurnToolSessions | null,
    checkpoints?: ICheckpointsService | null,
    sharedServers?: ISharedMcpServersService | null,
    sharedImages?: SharedImages | null,
    commandStarter?: ICommandStarter | null,
    readTitleModel?: () => string,
    readIdleCompaction?: () => boolean,
    timer?: ITimer);

  /**
   * The number of active sends, including their queued replies and finalization.
   */
  public get activeRunCount(): number;

  /**
   * @inheritdoc
   */
  public prepareAttachment(input: AttachmentInput): MessageAttachment;

  /**
   * @inheritdoc
   */
  public prepareOpenedAttachmentAsync(input: AttachmentInput, source: IOpenedFile): Promise<MessageAttachment>;

  /**
   * @inheritdoc
   */
  public refuseRaisedModeAsync(params: MessageSendParams): Promise<void>;

  /**
   * @inheritdoc
   */
  public discardAttachment(attachment: MessageAttachment): void;

  /**
   * @inheritdoc
   */
  public readAttachmentAsync(params: AttachmentReadParams, draft: Draft | null): Promise<AttachmentContent>;

  /**
   * @inheritdoc
   */
  public locateAttachmentAsync(params: AttachmentReadParams, draft: Draft | null): Promise<MessageAttachment>;

  /**
   * @inheritdoc
   */
  public hasAttachmentAsync(params: AttachmentReadParams): Promise<boolean>;

  /**
   * @inheritdoc
   */
  public listLinkedFolders(params: LinkedPaths): Promise<LinkedPaths>;

  /**
   * @inheritdoc
   */
  public readWrittenImageAsync(params: WrittenImageReadParams): Promise<AttachmentContent>;

  /**
   * @inheritdoc
   */
  public locateWrittenImageAsync(params: WrittenImageReadParams): Promise<MessageAttachment>;

  /**
   * Marks every reply left pending, running, or awaiting an approval by an earlier runtime as interrupted, with a note,
   * and cancels its pending approvals. Marks every sub-agent an earlier runtime left running as stopped, in any reply, and cancels every approval
   * still pending, such as one a sub-agent asked after its reply ended. Keeps open the questions posted through
   * `ITurnListener.onQuestionsPosted`, which wait for no turn, and sends each answer to one that an earlier runtime stored but quit before
   * sending, as its conversation's next message. Removes the waiting files no kept waiting message holds, logging any it can't, and sends the
   * kept waiting messages. Call before the first send.
   * @returns The replies marked interrupted.
   */
  public reconcileAsync(): Promise<readonly Message[]>;

  /**
   * @inheritdoc
   */
  public sendAsync(params: MessageSendParams, signal?: AbortSignal): Promise<MessageSendResult>;

  /**
   * @inheritdoc
   */
  public describeSendAsync(params: MessageSendParams): Promise<SendAsk | null>;

  /**
   * @inheritdoc
   */
  public sendAllowedAsync(params: MessageSendParams, starts: string | null): Promise<MessageSendResult>;

  /**
   * @inheritdoc
   */
  public listOutsideAsync(): Promise<readonly JsonObject[]>;

  /**
   * @inheritdoc
   */
  public sendOutsideAsync(teammateId: string | null, text: string, label: string, chatId?: string | null): Promise<string>;

  /**
   * @inheritdoc
   */
  public listOutsideChatsAsync(): Promise<readonly JsonObject[]>;

  /**
   * @inheritdoc
   */
  public readOutsideAsync(messageId: string): Promise<OutsideReply>;

  /**
   * @inheritdoc
   */
  public forgetOutsideAsync(): Promise<void>;

  /**
   * Ends the turn whose tool session a module stopped, from the person's own action such as a page's Stop or Take over,
   * as the person's own stop of the reply does: the reply ends as cancelled with a note that gives the reason. A session
   * that isn't a running turn's changes nothing, and the chat's next message starts a new turn as usual.
   * @param session The tool session's id.
   * @param reason Why the module stopped it, which the reply's note gives.
   */
  public stopSessionAsync(session: string, reason: string): Promise<void>;

  /**
   * @inheritdoc
   */
  public cancelAsync(params: MessageIdParams): Promise<Message>;

  /**
   * @inheritdoc
   */
  public approvePlanAsync(params: MessageIdParams): Promise<MessageSendResult>;

  /**
   * @inheritdoc
   */
  public cancelConversationAsync(params: ConversationIdParams): Promise<readonly Message[]>;

  /**
   * @inheritdoc
   */
  public addWaitingAsync(params: WaitingMessageAddParams, fromOutside?: boolean): Promise<WaitingMessage>;

  /**
   * @inheritdoc
   */
  public listWaitingAsync(params: ChatIdParams): Promise<WaitingMessagesPayload>;

  /**
   * @inheritdoc
   */
  public editWaitingAsync(params: WaitingMessageEditParams, fromOutside?: boolean): Promise<WaitingMessage>;

  /**
   * @inheritdoc
   */
  public removeWaitingAsync(params: WaitingMessageIdParams): Promise<void>;

  /**
   * @inheritdoc
   */
  public sendWaitingNowAsync(params: WaitingMessageIdParams): Promise<WaitingMessage>;

  /**
   * @inheritdoc
   */
  public setResponderAsync(params: ConversationResponderParams): Promise<Conversation>;

  /**
   * @inheritdoc
   */
  public forgetAsync(conversationIds: readonly string[]): Promise<void>;

  /**
   * @inheritdoc
   */
  public forgetTeammate(teammateId: string, conversationId: string | null): void;

  /**
   * @inheritdoc
   */
  public planFirstAsync(conversationId: string): Promise<void>;

  /**
   * @inheritdoc
   */
  public decideAsync(params: ApprovalDecideParams): Promise<Approval>;

  /**
   * Removes a message and everything after it, marks the conversation so that its next reply starts a fresh provider
   * session fed with the kept transcript, and, when asked, restores the project's folder to the checkpoint the checkpoints
   * module took before the first removed reply, through the module's preview of the restore.
   * @param params Which message to cut from and whether to restore files.
   * @returns The conversation as marked, the ids removed, how many files the restore changed (`null` without one), whether
   * the provider's session continues (forked through the last kept reply when the provider can and every removed reply ran
   * on that session; the transcript otherwise), and, for an asked-for restore that changed nothing, why in plain words.
   * @throws ServiceException `NotFound` for an unknown conversation, project, or message, or a message of another
   * conversation; `Conflict` while a reply is open.
   */
  public rewindAsync(params: ConversationRewindParams): Promise<ConversationRewindResult>;

  /**
   * See {@link IConversationEngine.releaseFolderAsync}.
   */
  public releaseFolderAsync(conversationId: string): Promise<void>;

  /**
   * See {@link IConversationEngine.sweepFoldersAsync}.
   */
  public sweepFoldersAsync(signal: AbortSignal): Promise<void>;

  /**
   * See {@link IConversationEngine.listMcpToolsAsync}.
   */
  public listMcpToolsAsync(params: McpToolListParams, signal?: AbortSignal): Promise<readonly JsonObject[]>;

  /**
   * See {@link IConversationEngine.callMcpToolAsync}.
   */
  public callMcpToolAsync(params: McpToolCallParams, signal?: AbortSignal): Promise<JsonObject>;

  /**
   * See {@link IConversationEngine.startSubAgentAsync}.
   */
  public startSubAgentAsync(params: SubAgentStartParams): Promise<SubAgent>;

  /**
   * See {@link IConversationEngine.waitSubAgents}.
   */
  public waitSubAgents(params: SubAgentWaitParams): Promise<SubAgentWaitResult>;

  /**
   * See {@link IConversationEngine.stopSubAgent}.
   */
  public stopSubAgent(params: SubAgentStopParams): Promise<SubAgent>;

  /**
   * See {@link IConversationEngine.startCommandAsync}.
   */
  public startCommandAsync(params: CommandStartParams): Promise<BackgroundTask>;

  /**
   * Resolves once every running turn has ended and the answers, waiting messages and steers those turns left to send have been sent or kept back.
   */
  public waitForIdle(): Promise<void>;

  /**
   * See {@link IPermissionAsker.askPermissionAsync}.
   */
  public askPermissionAsync(session: string, module: string, ask: PermissionAsk, signal: AbortSignal): Promise<PermissionAnswer>;

  /**
   * Checks a provider session's token for TeamRun's MCP endpoint.
   * @param token The token.
   * @returns Whether a turn's `McpEndpoint` issued it, its member's token still holds, a session of it is still open or it is a kept one,
   * and it hasn't expired or been revoked; a member's own token isn't one. A kept token with no open session is answered as a
   * member with no running turn is.
   */
  public acceptsSessionTokenAsync(token: string): Promise<boolean>;

  /**
   * See {@link ISenderTokens.senderTokenOf}.
   */
  public senderTokenOf(session: string): string | null;

  /**
   * Cancels every running turn, stops every sub-agent, and resolves once they have ended.
   */
  public shutdown(): Promise<void>;
}

/**
 * The one boundary between wire requests and the services: reads the method's parameters,
 * calls the service, and answers with a success carrying the result as JSON or a failure carrying
 * the info: a `ServiceException`'s own info, `ErrorCode.InvalidParams` for a `JsonException` or an
 * `ArgumentException`, `ErrorCode.UnknownMethod` for a method outside the catalog, and
 * `ErrorCode.Internal` for anything else, with the error's message. A deleted conversation, on its
 * own or with its project, publishes `ConversationDeleted` for each, then a catalog change publishes
 * `StateInvalidated`. A teammate created with a context window, or updated so that its provider, model or window changes while it has one,
 * is first checked against the windows its provider's model catalog offers for the model, and refused with `ErrorCode.InvalidParams`
 * when the model offers none or the size is outside them.
 */
export declare class RequestDispatcher {
  /**
   * Initializes the dispatcher over the services.
   * @param providers The provider methods.
   * @param providers The provider methods.
   * @param projects The project methods.
   * @param conversations The conversation methods.
   * @param messages The message listing.
   * @param approvals The approval listing.
   * @param engine The message methods that involve a provider.
   * @param drafts The draft methods; without them the draft methods are unknown.
   * @param dataFolder Where TeamRun keeps its data; without it `DataFolderRead` is unknown.
   * @param tasks The background task methods; without them `BackgroundTaskList` and `BackgroundTaskStop` are unknown.
   * @param planUsage The kept plan use; without it `PlanUsageList` is unknown.
   * @param readingPositions The reading position methods; without them `ReadingPositionList` and `ReadingPositionSave` are unknown.
   * @param windows The open windows; without them `WindowFocused`, `WindowClosed` and `PanelAnswered` are unknown.
   * @param sharedServers The shared MCP server methods; without them the `SharedMcp` methods are unknown.
   * @param acpAgents The added ACP agents' methods; without them the `AcpAgent` and `AcpLocalCommand` methods are unknown.
   * @param organization The organization's methods; without them `OrganizationList` and the `Department` methods are unknown.
   */
  public constructor(
    kinds: IProviderKindsService,
    providers: IProvidersService,
    projects: IProjectsService,
    conversations: IConversationsService,
    messages: IMessagesService,
    approvals: IApprovalsService,
    engine: IConversationEngine,
    teammates: ITeammatesService,
    events?: IEventSink | null,
    drafts?: IDraftsService | null,
    dataFolder?: DataFolder | null,
    tasks?: IBackgroundTasksService | null,
    planUsage?: IPlanUsageService | null,
    readingPositions?: IReadingPositionsService | null,
    windows?: IWindowsService | null,
    sharedServers?: ISharedMcpServersService | null,
    computerUseGrants?: IComputerUseGrantsService | null,
    acpAgents?: IAcpAgentsService | null,
    organization?: IOrganizationService | null);

  /**
   * Answers one request; never throws.
   * @param request The request.
   * @param signal Aborts when the request's caller is gone; a running sign-in stops.
   * @returns The response with the request's id.
   */
  public dispatch(request: Request, signal?: AbortSignal): Promise<Response>;

  /**
   * Describes a failure as the response info a failed request carries: a `ServiceException` keeps its own info, a
   * `JsonException` becomes `InvalidParams` naming the field's path, an `ArgumentException` becomes `InvalidParams`
   * naming the parameter when it has one, and anything else becomes `Internal` with its message.
   * @param error The caught failure.
   * @returns The info for `Response.failure`.
   */
  public static describe(error: unknown): ServiceResponseInfo;
}

/**
 * An image's size in pixels, as it displays.
 */
export declare class ImageSize {
  /**
   * The width in pixels.
   */
  public readonly width: number;
  /**
   * The height in pixels.
   */
  public readonly height: number;
  /**
   * Initializes the size.
   * @param width The width in pixels.
   * @param height The height in pixels.
   */
  public constructor(width: number, height: number);
}

/**
 * Reads an image file inside a project folder, for a reply's written images.
 */
export declare class ProjectImageReader {
  /**
   * Reads an image file whose real path, after symbolic links and junctions, lies inside the project folder's real path.
   * The file is opened without blocking, read whole, and judged by its content; a file that changes while it is read is refused.
   * @param rootPath The project folder.
   * @param path The file's absolute path.
   * @returns The file's name, media type, size and base64 bytes.
   * @throws ServiceException `ErrorCode.NotFound` for a relative path, a path or link that leads outside the folder, a file that is gone,
   * changed or not a regular file, or one that is not a PNG, JPEG, GIF or WebP image; `ErrorCode.TooLarge` above `maximumAttachmentReadBytes`;
   * any error a file call raises that is not the file system's, as it is.
   */
  public static read(rootPath: string, path: string): AttachmentContent;
  /**
   * Reads an image file as `read` does, and readies a PNG, JPEG, GIF or WebP image for a share with a window's page.
   * @param rootPath The folder the file must lie inside.
   * @param path The file's absolute path.
   * @param copies Where a copy of the checked bytes is kept and shared, or `null` to share the file itself, for a file already in the data folder.
   * @returns The file's name, media type and size, and the path to share: the copy's, or the file's real path.
   * @throws ServiceException as `read` does, `ErrorCode.NotFound` for an SVG image, and what `SharedImages.keep` throws.
   */
  public static share(rootPath: string, path: string, copies: SharedImages | null): MessageAttachment;
}

/**
 * Keeps the copies of written images that `ProjectImageReader.share` shares with a window's page, in one folder of the data folder.
 * Each copy is named by the SHA-256 of its bytes and its kind's extension, so two different images never share a name, and an image shared
 * again reuses its copy. A copy is in use until a share's lifetime after it was written or last shared, and is never removed while in use.
 */
export declare class SharedImages {
  /**
   * Creates the store; nothing is written until a copy is kept.
   * @param directory The folder that holds the copies.
   * @param limit The most bytes the copies take together, `sharedImagesByteLimit` by default.
   * @param lifetime How long a copy stays in use after it was written or last shared, `fileShareLifetime` by default.
   * @param now The clock, in milliseconds since the epoch.
   * @param log Where a copy the system won't remove yet is logged; nowhere by default.
   */
  public constructor(directory: string, limit?: number, lifetime?: number, now?: () => number, log?: ILog | null);
  /**
   * Keeps a copy of an image's checked bytes, written whole and flushed to disk before it takes its name, so a crash can't leave a named
   * copy short of bytes, and marks it in use for a share's lifetime.
   * When the copies would pass the limit, the ones no longer in use go first, the longest unused first; a copy the system won't remove yet
   * is logged and stays, as `clean` leaves it.
   * @param bytes The image's bytes.
   * @param mediaType `image/png`, `image/jpeg`, `image/gif` or `image/webp`.
   * @returns The copy's path.
   * @throws ServiceException `ErrorCode.NotFound` for another media type; `ErrorCode.TooLarge` when the copies in use leave no room for it.
   * @throws Any error a removal made to make room raises that is not the file system's, before the new copy is written.
   */
  public keep(bytes: Buffer, mediaType: string): string;
  /**
   * Removes every copy, and any partly written one, that is no longer in use, such as when the engine starts; a copy the system won't
   * remove yet stays for a later clean.
   * @throws Any error a removal raises that is not the file system's.
   */
  public clean(): void;
}

/**
 * Reads a PNG, JPEG, GIF or WebP image's pixel size from its header, without decoding the image.
 * A JPEG's EXIF orientation that turns it a quarter swaps its width and height, so the size is the one it displays at.
 */
export declare class ImageSizeReader {
  /**
   * Reads the size from an image's bytes, whatever their media type says.
   * @param data The image's bytes.
   * @returns The size, or `null` when no header of the four formats can be read or it gives a zero size.
   */
  public static readBuffer(data: Buffer): ImageSize | null;
  /**
   * Names an image's kind from its bytes, whatever its file name says.
   * @param data The image's bytes.
   * @returns `image/png`, `image/gif`, `image/webp` or `image/jpeg` when that format's header reads with a nonzero size; `image/svg+xml` when
   * the first 64 KiB, after any byte order mark, XML declaration, comments and doctype, open an `svg` root element; otherwise `null`.
   */
  public static mediaTypeOf(data: Buffer): string | null;
  /**
   * Reads the size from an image file, reading only the header's segments, in 64 KiB chunks, not the pixels.
   * The file is opened without blocking, and anything but a regular file, such as a named pipe, gives no size.
   * @param path The image file.
   * @returns The size, or `null` when no header of the four formats can be read or it gives a zero size.
   * @throws Error when the file can't be opened or read.
   */
  public static readFile(path: string): ImageSize | null;
}

/**
 * Persists bounded composer attachments beneath the runtime data directory.
 * Files remain available after rewind and history deletion, like generated image assets.
 */
export declare class AttachmentStore {
  /**
   * Selects the storage owner; performs no filesystem writes.
   * @param dataDirectory Runtime data directory.
   */
  public constructor(dataDirectory: string);

  /**
   * Saves one input in transient storage, enforcing the image/file byte limit.
   * An image's record holds its pixel size, read from its header, as every write of this store does.
   * An input by grant is refused with `InvalidParams` here, as by `save` and `saveDraft`: only the runtime part redeems a grant,
   * and it prepares the file with `prepareOpenedAsync`.
   */
  public prepare(input: AttachmentInput): MessageAttachment;

  /**
   * Copies a file the person chose, which the runtime part redeemed by its grant, from its open handle into transient storage,
   * so its bytes never travel in a protocol message.
   * The file must be a regular file within the image/file byte limit; it is copied in 1 MiB chunks into a new store file,
   * and a file whose size or modification time changes while it is copied is refused.
   * A refused or failed copy leaves no file in the store. An image's record holds its pixel size, read from the copy's header.
   * @param input The granted input, whose name and media type the record keeps.
   * @param source The granted file, open; the caller closes it.
   * @returns The prepared attachment's metadata.
   * @throws ServiceException `InvalidParams` when the file can't be read or isn't a regular file, is over its limit,
   * or changed while it was copied, or when the transient directory is reached through a link the store refuses.
   * @throws Error on a failure writing the store's copy.
   */
  public prepareOpenedAsync(input: AttachmentInput, source: IOpenedFile): Promise<MessageAttachment>;

  /**
   * Deletes a direct transient entry; rejects paths outside the transient directory.
   * A transient directory reached through a link the store refuses is left alone.
   */
  public discardPrepared(attachment: MessageAttachment): void;

  /**
   * Copies attachments into uniquely named files, rolling back partial writes on failure.
   * An image's record holds its pixel size, which `ImageSizeReader` reads from the header, or none when the header can't be read.
   * @param inputs New base64 uploads or saved references from this store; at most 10.
   * @returns Saved metadata, with no retained byte buffers.
   * @throws ServiceException for malformed bytes, outside references, a reference or folder reached through a link the store refuses,
   * or limits above ten files / 100 MiB per file / 10 MiB per image.
   * @throws Error on filesystem failure.
   */
  public save(inputs: readonly AttachmentInput[]): readonly MessageAttachment[];

  /**
   * Removes copies whose containing message failed to persist.
   * @param attachments Only metadata returned by this store's current save operation.
   * @throws Error on filesystem failure.
   */
  public discard(attachments: readonly MessageAttachment[]): void;

  /**
   * Removes the sent files of messages that are gone, leaving any path that isn't directly in the store's folder.
   * @param paths The removed messages' attachment paths.
   * @throws Error on filesystem failure.
   */
  public removeSent(paths: readonly string[]): void;

  /**
   * Lists the files directly in the store's folder, where sent messages' files are saved.
   * @returns Their paths, or none when the folder is missing.
   * @throws Error on filesystem failure.
   */
  public listSent(): readonly string[];

  /**
   * Reads a saved attachment's bytes, after checking that its file is still the one saved.
   * The file must resolve inside the store before and after the read, be a regular file of the recorded size on the open handle,
   * and give exactly that many bytes.
   * @param attachment Metadata of a file in this store.
   * @returns The file's bytes.
   * The file is opened without blocking, so a named pipe is refused rather than waited on.
   * @throws ServiceException `ErrorCode.TooLarge` when the recorded size is above `maximumAttachmentReadBytes`, or the name and media type
   * would take the base64 answer past one 16 MiB protocol frame, checked before the file is opened;
   * `ErrorCode.NotFound` when the path is relative, gone, outside the store, reached through a link the store refuses, not a regular file, or of another size,
   * including when it goes or changes between the checks.
   * @throws Error on filesystem failure.
   */
  public load(attachment: MessageAttachment): Buffer;
  /**
   * Finds a saved attachment's file without reading it, after the checks `load` makes before it opens the file.
   * @param attachment Metadata of a file in this store.
   * @returns The attachment with its path resolved to the file's real path, inside the store.
   * @throws ServiceException `ErrorCode.NotFound` when the path is relative, gone, outside the store, reached through a link the store refuses,
   * not a regular file, or of another size.
   * @throws Error on filesystem failure.
   */
  public locateSaved(attachment: MessageAttachment): MessageAttachment;

  /**
   * Saves a draft's files in the conversation's draft folder: a file already there is kept, any other input is copied in.
   * An image's record holds its pixel size, read again from a kept file's header.
   * @param conversationId An existing conversation's id.
   * @param inputs New base64 uploads or saved references from this store; at most 10.
   * @returns The draft's files, in input order; the files written are removed again when one input fails.
   * @throws ServiceException `NotFound` for a reference whose file is gone, or as `save` does for the rest.
   * @throws Error on filesystem failure.
   */
  public saveDraft(conversationId: string, inputs: readonly AttachmentInput[]): readonly MessageAttachment[];

  /**
   * Removes the files in a conversation's draft folder that are not kept, and the folder when none is.
   * A folder reached through a link the store refuses is left alone.
   * @param conversationId An existing conversation's id.
   * @param keep The draft files to keep, matched by file name within the folder, so a moved data folder keeps them.
   * @throws Error on filesystem failure.
   */
  public removeDraftFiles(conversationId: string, keep?: readonly MessageAttachment[]): void;

  /**
   * Saves a waiting message's files in its own folder under its chat's: a file already there is kept, any other input is copied in,
   * so the message keeps them until it goes, also across a restart.
   * @param chatId An existing chat's id.
   * @param waitingId The waiting message's id.
   * @param inputs New base64 uploads or saved references from this store, such as prepared files; at most 10.
   * @returns The message's files, in input order; the files written are removed again when one input fails.
   * @throws ServiceException `InvalidParams` for an id that isn't a plain folder name, or as `saveDraft` does for the rest.
   * @throws Error on filesystem failure.
   */
  public saveWaiting(chatId: string, waitingId: string, inputs: readonly AttachmentInput[]): readonly MessageAttachment[];

  /**
   * Removes a waiting message's files that are not kept, and its folder when none is; without a message, the chat's whole folder.
   * A folder reached through a link the store refuses is left alone.
   * @param chatId An existing chat's id.
   * @param waitingId The waiting message's id, or null for all the chat's.
   * @param keep The files to keep, matched by file name within the folder.
   * @throws ServiceException `InvalidParams` for an id that isn't a plain folder name.
   * @throws Error on filesystem failure.
   */
  public removeWaitingFiles(chatId: string, waitingId?: string | null, keep?: readonly MessageAttachment[]): void;

  /**
   * Lists the conversation ids that have a draft folder.
   * @returns The folder names under the draft files directory, or none when it is reached through a link the store refuses.
   */
  public listDraftFolders(): readonly string[];

  /**
   * Lists the waiting messages' folders, as each chat's id and message id.
   * @returns The folders two levels under the waiting files directory, or none when it is reached through a link the store refuses;
   * a linked chat folder is left out.
   */
  public listWaitingFolders(): readonly (readonly [string, string])[];

  /**
   * Tells whether an attachment's file is still there; one reached through a link the store refuses counts as gone.
   */
  public exists(attachment: MessageAttachment): boolean;

  /**
   * Adds durable file references to a provider prompt or reconstructed transcript.
   * @param text User text, possibly empty.
   * @param attachments Saved file metadata.
   * @returns Original text for no attachments; otherwise text followed by JSON-encoded name/path records.
   */
  public static formatPrompt(text: string, attachments: readonly MessageAttachment[]): string;
}

/**
 * Catalog operations for named participants.
 */
/** The organization under the person: departments, their leaders and their members. */
export interface IOrganizationService {
  /**
   * Returns the organization: every department, and which teammate is in which.
   * @param transaction The transaction to read in, or none.
   */
  listAsync(transaction?: SqlTransaction): Promise<Organization>;

  /**
   * Creates a department last among its siblings and records it in the change feed.
   * @throws ServiceException `NotFound` when the parent isn't a department.
   */
  createAsync(params: DepartmentCreateParams): Promise<Department>;

  /**
   * Renames a department or sets or clears its leader, and records it in the change feed.
   * @throws ServiceException `NotFound` for an unknown department or leader, `InvalidParams` when the leader isn't one of its members.
   */
  updateAsync(params: DepartmentUpdateParams): Promise<Department>;

  /**
   * Moves a department under another parent or to another place among its siblings, numbering the siblings it left and joined
   * from 0 again, and records each change in the change feed; a place past the last puts it last.
   * @throws ServiceException `NotFound` for an unknown department or parent, `InvalidParams` when the parent is the department or under it.
   */
  moveAsync(params: DepartmentMoveParams): Promise<Department>;

  /**
   * Deletes a department in one transaction: its departments take its place under its parent, and its members move to its parent,
   * or to no department when it sits under the person; its leadership goes with it.
   * @throws ServiceException `NotFound` for an unknown department.
   */
  deleteAsync(params: DepartmentIdParams): Promise<void>;

  /**
   * Puts a teammate in a department or in none; a teammate who leads its department stops leading it.
   * @throws ServiceException `NotFound` for an unknown teammate or department.
   */
  setMemberAsync(params: DepartmentMemberSetParams): Promise<void>;

  /**
   * Takes a teammate being deleted out of its department and clears its leadership, in the deleting transaction.
   * @param teammateId The teammate's id.
   * @param transaction The deleting transaction.
   * @returns Whether the teammate was in a department.
   */
  removeTeammateAsync(teammateId: string, transaction: SqlTransaction): Promise<boolean>;
}

/** Keeps the organization in the `departments` and `departmentMembers` tables, recording each change in the change feed. */
export declare class OrganizationService implements IOrganizationService {
  /** Creates the service over the database. */
  public constructor(context: DatabaseContext);

  /**
   * Returns the organization: every department, and which teammate is in which.
   * @param transaction The transaction to read in, or none.
   */
  public listAsync(transaction?: SqlTransaction): Promise<Organization>;

  /**
   * Creates a department last among its siblings and records it in the change feed.
   * @throws ServiceException `NotFound` when the parent isn't a department.
   */
  public createAsync(params: DepartmentCreateParams): Promise<Department>;

  /**
   * Renames a department or sets or clears its leader, and records it in the change feed.
   * @throws ServiceException `NotFound` for an unknown department or leader, `InvalidParams` when the leader isn't one of its members.
   */
  public updateAsync(params: DepartmentUpdateParams): Promise<Department>;

  /**
   * Moves a department under another parent or to another place among its siblings, numbering the siblings it left and joined
   * from 0 again, and records each change in the change feed; a place past the last puts it last.
   * @throws ServiceException `NotFound` for an unknown department or parent, `InvalidParams` when the parent is the department or under it.
   */
  public moveAsync(params: DepartmentMoveParams): Promise<Department>;

  /**
   * Deletes a department in one transaction: its departments take its place under its parent, and its members move to its parent,
   * or to no department when it sits under the person; its leadership goes with it.
   * @throws ServiceException `NotFound` for an unknown department.
   */
  public deleteAsync(params: DepartmentIdParams): Promise<void>;

  /**
   * Puts a teammate in a department or in none; a teammate who leads its department stops leading it.
   * @throws ServiceException `NotFound` for an unknown teammate or department.
   */
  public setMemberAsync(params: DepartmentMemberSetParams): Promise<void>;

  /**
   * Takes a teammate being deleted out of its department and clears its leadership, in the deleting transaction.
   * @param teammateId The teammate's id.
   * @param transaction The deleting transaction.
   * @returns Whether the teammate was in a department.
   */
  public removeTeammateAsync(teammateId: string, transaction: SqlTransaction): Promise<boolean>;
}

export interface ITeammatesService {
  /**
   * Lists participants by name, in `NameOrder`; ties keep creation order.
   */
  listAsync(transaction?: SqlTransaction): Promise<readonly Teammate[]>;

  /**
   * Returns a participant or null.
   */
  findAsync(teammateId: string, transaction?: SqlTransaction): Promise<Teammate | null>;

  /**
   * Creates a unique participant bound to an existing provider.
   */
  createAsync(params: TeammateCreateParams): Promise<Teammate>;

  /**
   * Updates settings in one transaction, changing only the fields `params` names and keeping the stored value of each other one, so two
   * writers that change different fields both keep their change, and of two that change the same field the later one wins.
   * An update whose `expectedProviderId` is no longer the teammate's provider is refused with `Conflict`, so a model, effort, speed or mode
   * chosen under one provider never lands on another.
   * With `checked`, the teammate as its context window was checked, an update is refused with `Conflict` when its provider, model or
   * context window has changed since, so a size checked for one model never lands on another.
   * A provider change requires idle memberships and resets their sessions.
   */
  updateAsync(params: TeammateUpdateParams, checked?: Teammate | null): Promise<Teammate>;

  /**
   * Clears the speed of each teammate of a provider, and of the default teammate on it, unless the provider's catalog lists the model with that
   * speed, and their permission mode unless the catalog lists that mode; a catalog that names no modes clears none. A teammate's context window
   * is cleared too unless the catalog's model offers it.
   * @param providerId The provider whose catalog this is.
   * @param list The provider's catalog.
   * @returns The teammates changed; a cleared default teammate is saved through the preference's own change.
   */
  clearUnlistedAsync(providerId: string, list: ProviderModelList): Promise<readonly Teammate[]>;

  /**
   * Deletes memberships while retaining historical messages and mentions.
   */
  deleteAsync(params: TeammateIdParams): Promise<void>;

  /**
   * Reads the default teammate set in Settings, or `null` when none is set.
   */
  readDefaultAsync(transaction?: SqlTransaction): Promise<DefaultTeammate | null>;

  /**
   * Sets or clears the default teammate a new chat starts from; a chosen provider must exist and belong to the chosen provider.
   * @returns The default teammate set, or `null` when cleared.
   */
  setDefaultAsync(params: DefaultTeammateSetParams, transaction?: SqlTransaction): Promise<DefaultTeammate | null>;

  /**
   * Gives a default teammate whose settings name no provider the provider `providerOf` finds for its kind; with none it stays as it is.
   * @param providerOf Finds a kind's provider id, or `null`, reading through the transaction it is given.
   * @returns The default teammate it set, or `null` when it moved none.
   */
  moveProviderlessDefaultAsync(providerOf: (kind: string, transaction: SqlTransaction) => Promise<string | null>): Promise<DefaultTeammate | null>;

  /**
   * Reads the composer's default choice, the settings last sent that a new chat uses until a default teammate is set.
   * @returns The choice's JSON object, or `null` when none is kept.
   */
  readComposerDefaultAsync(transaction?: SqlTransaction): Promise<JsonObject | null>;

  /**
   * Keeps the composer's default choice as it is, replacing the one kept, unless `onlyIfNone` finds one kept.
   * @param params The choice.
   * @returns The choice kept.
   */
  saveComposerDefaultAsync(params: ComposerDefaultSaveParams): Promise<JsonObject>;
}

/**
 * Persists participants and applies provider and name constraints.
 */
export declare class TeammatesService implements ITeammatesService {
  /**
   * Creates the service with its database, provider and membership owners, and the organization a deleted teammate leaves.
   */
  public constructor(context: DatabaseContext, providers: IProvidersService, conversations: IConversationsService, organization: IOrganizationService);

  /**
   * Lists participants by name, in `NameOrder`; ties keep creation order.
   */
  public listAsync(transaction?: SqlTransaction): Promise<readonly Teammate[]>;

  /**
   * Returns a participant or null.
   */
  public findAsync(teammateId: string, transaction?: SqlTransaction): Promise<Teammate | null>;

  /**
   * Creates a unique participant bound to an existing provider.
   */
  public createAsync(params: TeammateCreateParams): Promise<Teammate>;

  /**
   * Updates settings; a provider change requires idle memberships and resets their sessions.
   */
  public updateAsync(params: TeammateUpdateParams, checked?: Teammate | null): Promise<Teammate>;

  /**
   * @inheritdoc
   */
  public clearUnlistedAsync(providerId: string, list: ProviderModelList): Promise<readonly Teammate[]>;

  /**
   * Deletes memberships while retaining historical messages and mentions; the teammate leaves its department, and a department
   * it led has no leader, in the same transaction.
   */
  public deleteAsync(params: TeammateIdParams): Promise<void>;

  /**
   * Reads the default teammate from the `preferences` table, or `null` when none is set.
   */
  public readDefaultAsync(transaction?: SqlTransaction): Promise<DefaultTeammate | null>;

  /**
   * Stores or removes the default teammate in the `preferences` table and records the change.
   * @throws ServiceException `NotFound` when the provider doesn't exist, or `InvalidParams` when it belongs to another kind.
   */
  public setDefaultAsync(params: DefaultTeammateSetParams, transaction?: SqlTransaction): Promise<DefaultTeammate | null>;

  /**
   * @inheritdoc
   */
  public moveProviderlessDefaultAsync(providerOf: (kind: string, transaction: SqlTransaction) => Promise<string | null>): Promise<DefaultTeammate | null>;

  /**
   * Reads the composer's default choice from the `preferences` table.
   * @returns The choice's JSON object, or `null` when none is kept.
   */
  public readComposerDefaultAsync(transaction?: SqlTransaction): Promise<JsonObject | null>;

  /**
   * Keeps the composer's default choice as it is in the `preferences` table, replacing the one kept unless `onlyIfNone`
   * finds one, and records it in the change feed.
   * @param params The choice.
   * @returns The choice kept.
   */
  public saveComposerDefaultAsync(params: ComposerDefaultSaveParams): Promise<JsonObject>;
}

/**
 * Where each conversation's history was left, which the window part stores and reads back after a restart. A conversation
 * deleted with `ConversationsService.deleteAsync` loses its row with it.
 */
export interface IReadingPositionsService {
  /**
   * Returns every stored position, by conversation id.
   */
  listAsync(): Promise<readonly ConversationPosition[]>;

  /**
   * Stores the positions, clears the cleared conversations' and clears each dropped position while it is still the one
   * stored, in one transaction, skipping a position whose conversation no longer exists.
   */
  saveAsync(params: ReadingPositionSaveParams): Promise<void>;
}

/**
 * Persists reading positions in the module database, one row per conversation.
 */
export declare class ReadingPositionsService implements IReadingPositionsService {
  /**
   * Creates the service over its database.
   */
  public constructor(context: DatabaseContext);

  /**
   * Returns every stored position, by conversation id.
   */
  public listAsync(): Promise<readonly ConversationPosition[]>;

  /**
   * Stores the positions, clears the cleared conversations' and clears each dropped position while it is still the one
   * stored, in one transaction, skipping a position whose conversation no longer exists.
   */
  public saveAsync(params: ReadingPositionSaveParams): Promise<void>;
}

/**
 * A conversation's saved composer draft: text and attachments, whose files stay in the attachments directory.
 */
export interface IDraftsService {
  /**
   * Saves the draft with the next revision; the conversation must exist.
   * @throws ServiceException `NotFound` for an unknown conversation or a reference whose file is gone.
   */
  saveAsync(params: DraftSaveParams): Promise<Draft>;

  /**
   * Returns the draft or null; a file that is gone is left out and named in `missing`.
   */
  readAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<Draft | null>;

  /**
   * Discards the draft and its files, keeping its revision so the next save's never repeats; with a revision, only while
   * the draft is still at it.
   */
  discardAsync(params: DraftDiscardParams): Promise<void>;

  /**
   * Deletes a conversation's draft row in the caller's transaction, or on the connection when none is given.
   */
  forgetAsync(conversationId: string, transaction?: SqlTransaction): Promise<void>;

  /**
   * Removes a conversation's draft files, after its draft row is gone.
   */
  removeFiles(conversationId: string): void;

  /**
   * Removes a deleted conversation's draft files and its waiting messages' files, after its rows are gone.
   */
  removeChatFiles(conversationId: string): void;

  /**
   * Removes the sent files of a deleted conversation's messages, or of the messages a rewind removed, after their rows are gone.
   */
  removeSentFiles(conversationId: string, paths: readonly string[]): void;
}

/**
 * Persists drafts in the module database and their files through an `AttachmentStore`.
 */
export declare class DraftsService implements IDraftsService {
  /**
   * Creates the service over its database, the store that holds the files, and the log for the failures it recovers from.
   */
  public constructor(context: DatabaseContext, attachments: AttachmentStore, log: ILog);

  /**
   * Writes the files first, then the row, in one transaction with the read of the revision; a failed write leaves the earlier draft as it was.
   */
  public saveAsync(params: DraftSaveParams): Promise<Draft>;

  /**
   * Returns the draft or null; a file that is gone is left out and named in `missing`.
   */
  public readAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<Draft | null>;

  /**
   * Discards the draft and its files, keeping its revision so the next save's never repeats; with a revision, only while
   * the draft is still at it.
   */
  public discardAsync(params: DraftDiscardParams): Promise<void>;

  /**
   * Deletes a conversation's draft row in the caller's transaction, or on the connection when none is given.
   */
  public forgetAsync(conversationId: string, transaction?: SqlTransaction): Promise<void>;

  /**
   * Removes a conversation's draft files; a file that cannot go now stays for `sweepAsync`.
   */
  public removeFiles(conversationId: string): void;

  /**
   * Removes a deleted conversation's draft files and its waiting messages' files; a draft file that cannot go now stays for `sweepAsync`, and
   * waiting files that cannot go are logged and swept at the next start.
   */
  public removeChatFiles(conversationId: string): void;

  /**
   * Removes the sent files the paths name; a failure is logged, and the files are swept at the next start.
   */
  public removeSentFiles(conversationId: string, paths: readonly string[]): void;

  /**
   * Removes, at start-up, the draft files no draft holds and the sent files no message names: what a failed removal or a crash
   * after a save or a commit left; a draft that cannot be read keeps its files. A draft it cannot read, like any removal that fails,
   * writes a line to the log.
   */
  public sweepAsync(): Promise<void>;
}

/**
 * Creates the `readingPositions` table: each conversation's reading position as JSON, keyed by its conversation, and its update time.
 */
/**
 * Creates the `sharedMcpServers` table: each shared MCP server's id, unique name, JSON and times.
 */
export declare class SharedMcpServersMigration extends SqlMigration {
  /**
   * Uses the fixed shared MCP servers migration id.
   */
  public constructor();

  /**
   * Creates the table and its unique name index.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * A shared MCP server a provider couldn't use, as its adapter reports it.
 */
export declare class SharedMcpFailure {
  /**
   * The provider's id.
   */
  public readonly providerId: string;
  /**
   * The provider's label, as the person named it.
   */
  public readonly providerLabel: string;
  /**
   * The server's name.
   */
  public readonly server: string;
  /**
   * Why the provider couldn't use it.
   */
  public readonly kind: SharedMcpFailureKind;
  /**
   * The provider's own reason, for a blocked server; `null` otherwise.
   */
  public readonly reason: string | null;
  /**
   * The provider's id, the server and the kind as one text, the same for equal failures.
   */
  public get key(): string;
  public constructor(providerId: string, providerLabel: string, server: string, kind: SharedMcpFailureKind, reason?: string | null);
}

/**
 * The shared MCP server failures each chat has noted since TeamRun started, so a chat notes each one once.
 */
export declare class ReportedSharedMcpFailures {
  /**
   * Records the failure for the chat.
   * @param conversationId The chat.
   * @param failure The failure.
   * @returns `true` the first time the chat has the failure, `false` after.
   */
  public add(conversationId: string, failure: SharedMcpFailure): boolean;

  /**
   * Drops what the chats have noted.
   * @param conversationIds The chats, deleted.
   */
  public forget(conversationIds: readonly string[]): void;
}

/**
 * Why a provider can't take a shared MCP server: the full sentence, and the same reason in a few words for the panel's folded line.
 */
export declare class SharedMcpRefusal {
  /**
   * Why, in a full sentence, as the panel shows it behind Show and a reply's note on a server left out says it.
   */
  public readonly reason: string;
  /**
   * The same reason in a few words, such as `sign-in not passed yet`, or `null` when it has none and the panel shows `reason` instead.
   */
  public readonly short: string | null;
  /**
   * Creates a validated immutable value.
   * @param short The reason in a few words; `null` by default.
   * @throws ArgumentException when `reason` or a given `short` are blank.
   */
  public constructor(reason: string, short?: string | null);
}

/**
 * The shared MCP servers a turn gets, and a note for each server its teammate gets that is left out of the session, with why.
 */
export declare class SharedMcpSelection {
  /**
   * No servers and no notes.
   */
  public static readonly none: SharedMcpSelection;
  /**
   * The servers the turn gets.
   */
  public readonly servers: readonly SharedMcpServerDefinition[];
  /**
   * The reply's notes on the servers left out.
   */
  public readonly notes: readonly string[];
  /**
   * The saved secrets' values of `servers`.
   */
  public readonly values: SharedMcpValues;
  public constructor(servers: readonly SharedMcpServerDefinition[], notes: readonly string[], values?: SharedMcpValues);
}

/**
 * The values of shared MCP servers' saved secrets for one turn, read from Noldova Desktop's secret store as the turn starts. They are kept in a
 * closure, so `JSON.stringify` and `util.inspect` of this object, or of a `TurnRequest` that holds it, show none of them.
 */
export declare class SharedMcpValues {
  /**
   * No values.
   */
  public static readonly none: SharedMcpValues;
  /**
   * Keeps a copy of the values.
   * @param values Each server's values, by the server's name and then the variable's.
   */
  public constructor(values: ReadonlyMap<string, ReadonlyMap<string, string>>);
  /**
   * A variable's saved value for a server, or `undefined` when the variable takes its value from the environment.
   */
  public valueOf(server: string, variable: string): string | undefined;
}

/**
 * The part of Noldova Desktop's secret store that the shared MCP servers use, as a runtime part's `secrets` gives it: TeamRun saves no value
 * itself, since the window saves each one.
 */
export interface ISharedMcpSecrets {
  /**
   * Reads a saved value, or `null` when none is saved on this machine.
   * @throws Error with the store's reason when it can't read the value.
   */
  readAsync(name: string): Promise<string | null>;
  /**
   * Removes a saved value.
   * @throws Error with the store's reason when it can't remove it.
   */
  removeAsync(name: string): Promise<void>;
  /**
   * Says whether a value is saved on this machine.
   * @throws Error with the store's reason when it can't tell.
   */
  isSetAsync(name: string): Promise<boolean>;
}

/**
 * What a shared MCP server's sign-in gives a turn: the current access token, or why the server needs a sign-in again.
 */
export declare class SharedMcpAccess {
  /** The access token, empty when refused. */
  public readonly token: string;
  /** When the token expires, or `null` when the server didn't say. */
  public readonly expiresAt: string | null;
  /** Why the server needs a sign-in again, or `null` when the token can be used. */
  public readonly needsSignIn: string | null;
  private constructor();
  /** A token the turn can use until `expiresAt`. */
  public static granted(token: string, expiresAt: string | null): SharedMcpAccess;
  /** No token, with the reason the server needs a sign-in again. */
  public static refused(reason: string): SharedMcpAccess;
}

/**
 * Answers the token of an account a shared HTTP MCP server signs in with, such as the GitHub module's, which a turn passes as a bearer token;
 * the token is never logged, saved or shown.
 */
export interface ISharedMcpAccounts {
  /**
   * Reads the account's token; refused, with why, when the account isn't signed in or TeamRun can't reach its sign-in.
   * @throws Error with the reason when the sign-in can't be read.
   */
  accessAsync(account: SharedMcpAccount): Promise<SharedMcpAccess>;
}

/**
 * Signs in to a shared HTTP MCP server with OAuth and keeps its tokens in Noldova Desktop's secret store under a reference; tokens never leave it
 * but as the access token a turn passes as a bearer token.
 */
export interface ISharedMcpSignIn {
  /**
   * Starts a sign-in in the browser and returns the address to open, or `null` when a Sign out or a later start of the same reference ended it before it
   * had one; `finished` is called once, when the sign-in ends, fails or times out, and never for one that ended without an answer.
   * @param url The server's address, where discovery starts from its refusal.
   * @param reference Where the tokens are saved.
   */
  startAsync(url: string, reference: string, finished: (access: SharedMcpAccess) => void): Promise<string | null>;
  /**
   * Reads the access token, refreshed first when it expires soon; refused when there is none or the refresh fails.
   * @throws Error with the store's reason when it can't read the tokens.
   */
  accessAsync(url: string, reference: string): Promise<SharedMcpAccess>;
  /**
   * Removes the tokens saved under `reference`.
   * @throws Error with the store's reason when it can't remove them.
   */
  signOutAsync(reference: string): Promise<void>;
}

/**
 * The shared MCP servers and their switches: which provider and teammate gets which server.
 */
export interface ISharedMcpServersService {
  /**
   * Lists every server by name, each with the providers that can't take it and why, and each variable it names with where it takes its value
   * and whether one is there, from the environment read for this list and the secret store: a provider that takes it can't while a variable
   * it names, for its command, a header or its bearer token, isn't set or its saved secret isn't on this machine. Switches of a deleted
   * provider or teammate are left out.
   */
  listAsync(): Promise<readonly SharedMcpServerListing[]>;
  /**
   * Adds a server, off for every provider.
   * @throws ServiceException `Conflict` when the name is taken.
   */
  createAsync(definition: SharedMcpServerDefinition): Promise<SharedMcpServer>;
  /**
   * Changes a server's definition and keeps its switches and the saved secrets of the variables it still names; the others' values are
   * removed from the secret store, and so are its sign-in's tokens when it no longer signs in or its address changed.
   * @throws ServiceException `NotFound` for an unknown server, `Conflict` when the name is taken.
   */
  updateAsync(params: SharedMcpServerUpdateParams): Promise<SharedMcpServer>;
  /**
   * Removes a server, and its saved secrets' values and its sign-in's tokens from the secret store.
   * @throws ServiceException `NotFound` for an unknown server.
   */
  deleteAsync(params: SharedMcpServerIdParams): Promise<void>;
  /**
   * Turns a server on or off for a provider.
   * @throws ServiceException `NotFound` for an unknown server or provider.
   */
  setProviderAsync(params: SharedMcpProviderSetParams): Promise<SharedMcpServer>;
  /**
   * Sets a teammate's setting for a server; `AsProvider` removes its own.
   * @throws ServiceException `NotFound` for an unknown server or teammate.
   */
  setTeammateAsync(params: SharedMcpTeammateSetParams): Promise<SharedMcpServer>;
  /**
   * Sets where a server's variable takes its value: the saved secret the window saved under `reference`, or the environment for `null`. The
   * new reference is kept first, so a turn starting meanwhile still reads a value; then a replaced reference's value is removed from the secret
   * store, and a refusal there is logged by the variable's name only.
   * @throws ServiceException `NotFound` for an unknown server, `InvalidParams` for a variable the server doesn't name, `Conflict` for a reference
   * another variable already keeps.
   */
  setSecretAsync(params: SharedMcpSecretSetParams): Promise<SharedMcpServer>;
  /**
   * Starts a server's sign-in and returns the address the person opens; when it ends, the server keeps its sign-in's state, and the state is
   * published as changed. A sign-in that ends after the server was deleted, stopped signing in or changed its address is removed.
   * @throws ServiceException `NotFound` for an unknown server, `InvalidParams` for a server that doesn't sign in.
   */
  startSignInAsync(params: SharedMcpServerIdParams): Promise<SharedMcpSignInStarted>;
  /**
   * Drops a server's sign-in, then removes its tokens from the secret store, where a refusal is logged by the server's name only.
   * @throws ServiceException `NotFound` for an unknown server.
   */
  signOutOfAsync(params: SharedMcpServerIdParams): Promise<SharedMcpServer>;
  /**
   * Chooses the servers a turn gets, with their saved secrets' values: those that reach the teammate on the provider, left out with a note
   * when the provider can't take one, a variable it names isn't set in the environment read for that turn, or its saved secret isn't on this
   * machine or can't be read; none for a turn without a provider. A server that signs in passes its current access token as its bearer token,
   * under a variable TeamRun names, and is left out while it has no sign-in or its sign-in can't be read or refreshed.
   * @param provider The turn's provider, or `null`.
   * @param teammateId The turn's teammate, or `null` for the chat's default teammate, which follows its provider.
   * @param workingDirectory The turn's folder, which the provider is asked about with each server.
   */
  selectAsync(provider: Provider | null, teammateId: string | null, workingDirectory: string | null): Promise<SharedMcpSelection>;
}

/**
 * Keeps the shared MCP servers in the `sharedMcpServers` table, with no secret value: each names the variables of the runtime's environment that
 * hold its values, and the reference of each saved secret in Noldova Desktop's secret store. A change applies from a provider's next session; the
 * switches of a deleted provider or teammate are dropped at the server's next change.
 */
export declare class SharedMcpServersService implements ISharedMcpServersService {
  /**
   * @param readEnvironment Reads, for each `listAsync` and `selectAsync`, the environment where each variable must be set, such as the one the turn's
   * provider starts with. Its values are never read.
   * @param secrets The secret store, read only by `selectAsync`, for the servers a turn gets.
   * @param signIns The OAuth sign-ins of the servers that sign in.
   * @param accounts The account sign-ins of the servers that sign in with an account, read by `listAsync` to say whether each is signed in and by
   * `selectAsync` for the servers a turn gets.
   * @param events Takes the change of a sign-in that ends after `startSignInAsync` returned; `null` sends none.
   * @param log Takes a line when a saved secret no server names any more can't be removed; `null` by default.
   */
  public constructor(context: DatabaseContext, providers: IProvidersService, teammates: ITeammatesService, registry: ProviderKindRegistry,
    readEnvironment: () => Promise<Readonly<Record<string, string | undefined>>>, secrets: ISharedMcpSecrets, signIns: ISharedMcpSignIn,
    accounts: ISharedMcpAccounts, events: IEventSink | null, log?: ILog | null);
  public listAsync(): Promise<readonly SharedMcpServerListing[]>;
  public createAsync(definition: SharedMcpServerDefinition): Promise<SharedMcpServer>;
  public updateAsync(params: SharedMcpServerUpdateParams): Promise<SharedMcpServer>;
  public deleteAsync(params: SharedMcpServerIdParams): Promise<void>;
  public setProviderAsync(params: SharedMcpProviderSetParams): Promise<SharedMcpServer>;
  public setTeammateAsync(params: SharedMcpTeammateSetParams): Promise<SharedMcpServer>;
  public setSecretAsync(params: SharedMcpSecretSetParams): Promise<SharedMcpServer>;
  public startSignInAsync(params: SharedMcpServerIdParams): Promise<SharedMcpSignInStarted>;
  public signOutOfAsync(params: SharedMcpServerIdParams): Promise<SharedMcpServer>;
  public selectAsync(provider: Provider | null, teammateId: string | null, workingDirectory: string | null): Promise<SharedMcpSelection>;
}

/**
 * A computer-use grant the base's permission center remembers for a tool scope: `computer-use.controlApp`, whose subject is the app, or
 * `computer-use.controlScreen`, the screen.
 */
export declare class RememberedAppGrant {
  /** The remembered grant's id in the permission center. */
  public readonly id: string;
  /** The app's identity, the grant's subject; `null` for the screen. */
  public readonly app: string | null;
  /** The tool scope the grant was given for, `<chatId>/<teammateId or default>`. */
  public readonly scope: string;
  /** When the grant was given. */
  public readonly rememberedAt: Date;
  /**
   * @throws ArgumentException when `id` or `scope` is blank, or `app` is blank but not `null`.
   */
  public constructor(id: string, app: string | null, scope: string, rememberedAt: Date);
}

/**
 * The base's remembered computer-use grants of an app or the screen, which only the app's permissions module may read and revoke; the runtime implements it over
 * the permission center.
 */
export interface IRememberedAppGrants {
  /** Lists the remembered app grants. */
  list(): readonly RememberedAppGrant[];
  /**
   * Revokes a remembered grant.
   * @returns `false` when the center holds no grant with the id.
   */
  revoke(id: string): boolean;
}

/**
 * An installed app as computer use describes it: its name, and its icon as a base64 PNG 64 pixels a side.
 */
export declare class AppLook {
  /** The app's name. */
  public readonly name: string;
  /** The app's icon as a base64 PNG, or `null` when it couldn't be read. */
  public readonly icon: string | null;
  /**
   * @throws ArgumentException when `name` is blank, or `icon` is blank but not `null`.
   */
  public constructor(name: string, icon: string | null);
}

/**
 * Describes an app by its identity, a remembered grant's subject; the runtime implements it over computer use's apps service.
 */
export interface IAppDescriptions {
  /**
   * Describes the app.
   * @param app The app's identity, a lowercase program path on Windows or bundle identifier on macOS.
   * @param signal Ends the description.
   * @returns The app's name and icon, or `null` when it can't be described.
   */
  describeAsync(app: string, signal?: AbortSignal): Promise<AppLook | null>;
}

/**
 * Lists and revokes the computer-use grants, of an app or the screen, remembered for chats.
 */
export interface IComputerUseGrantsService {
  /**
   * Lists the grants, newest first, each with its chat's title and teammate's name where they still exist, and each app's name and icon
   * where they are kept from an earlier listing or can be read before this one's deadline.
   * @param signal Ends the listing.
   */
  listAsync(signal?: AbortSignal): Promise<readonly ComputerUseGrant[]>;
  /**
   * Revokes a grant through the permission center.
   * @throws ServiceException `NotFound` when the id is not a listed grant or the center no longer holds it.
   */
  revoke(params: ComputerUseGrantIdParams): void;
  /** Revokes every grant of the deleted chats, for any of their teammates, since a deleted chat's grant reaches nothing. */
  forget(chatIds: readonly string[]): void;
}

/**
 * How long the computer-use grants service waits for a listing's app descriptions, and keeps each one it finds.
 */
export declare class ComputerUseGrantTimings {
  /**
   * Milliseconds a listing waits for all its descriptions together.
   */
  public readonly describeWait: number;
  /**
   * Milliseconds a found description is kept before a listing asks for it again.
   */
  public readonly lifetime: number;

  /**
   * @param describeWait Milliseconds a listing waits for all its descriptions together; a positive integer.
   * @param lifetime Milliseconds a found description is kept; a positive integer.
   * @throws ArgumentOutOfRangeException when either isn't a positive integer.
   */
  public constructor(describeWait: number, lifetime: number);

  /**
   * Returns the production timings: `Resources.appDescriptionsWait` and `Resources.appDescriptionLifetime`.
   * @returns The timings.
   */
  public static createDefault(): ComputerUseGrantTimings;
}

/**
 * Tells the time and waits a given time, so that a test can drive the clock and the waits of the code that takes it.
 */
export interface ITimer {
  /**
   * Tells the time.
   * @returns The milliseconds since the Unix epoch, or since any fixed start.
   */
  now(): number;

  /**
   * Waits the given time.
   * @param milliseconds How long to wait.
   * @param signal Ends the wait early, rejecting it.
   */
  delayAsync(milliseconds: number, signal: AbortSignal): Promise<void>;
}

/**
 * Starts a turn's background commands for the engine, through the host's shell.
 */
export interface ICommandStarter {
  /**
   * Says why the host's shell can't run a command as written, before it starts.
   * @param command The command line.
   * @returns The reason, which the engine refuses the command with as invalid, or null when the shell runs it.
   */
  refusalOf(command: string): string | null;

  /**
   * Starts a command.
   * @param command The command line, run by the person's shell.
   * @param directory The folder it runs in.
   * @param output Receives its output and errors as they come.
   * @returns The running command.
   */
  start(command: string, directory: string, output: (text: string) => void): IRunningCommand;
}

/**
 * A background command an `ICommandStarter` started.
 */
export interface IRunningCommand {
  /**
   * Resolves, never rejects, with how the command ended, including when it couldn't start.
   */
  readonly exited: Promise<CommandExit>;

  /**
   * Ends the command and what it started.
   */
  stopAsync(): Promise<void>;
}

/**
 * Waits on Node's timers.
 */
export declare class NodeTimer implements ITimer {
  /**
   * Tells the time with `Date.now`.
   * @returns The milliseconds since the Unix epoch.
   */
  public now(): number;

  /**
   * Waits the given time with `node:timers/promises`.
   * @param milliseconds How long to wait.
   * @param signal Ends the wait early, rejecting it.
   */
  public delayAsync(milliseconds: number, signal: AbortSignal): Promise<void>;
}

/**
 * Shows the base's remembered computer-use grants by chat and teammate; a revoke goes to the base, which keeps the only copy of the grants.
 */
export declare class ComputerUseGrantsService implements IComputerUseGrantsService {
  /**
   * @param descriptions Describes each listed app that has no kept description; without it, or where it fails, gives `null` or hasn't
   * answered by the deadline, a grant carries its kept description or no app name or icon.
   * @param timings How long a listing waits for all its descriptions together, at whose deadline the descriptions' signal aborts, and how
   * long a found description is kept before a listing asks for it again; until a new one comes before a deadline, the kept one shows, a
   * `null` answer is not kept, and a revoke drops the app's kept description and any in flight.
   * @param timer Tells the time a description is kept from and waits out each listing's deadline, a wait the listing ends as it returns.
   */
  public constructor(grants: IRememberedAppGrants, conversations: IConversationsService, teammates: ITeammatesService,
    descriptions: IAppDescriptions | null, timings: ComputerUseGrantTimings, timer: ITimer);
  public listAsync(signal?: AbortSignal): Promise<readonly ComputerUseGrant[]>;
  public revoke(params: ComputerUseGrantIdParams): void;
  public forget(chatIds: readonly string[]): void;
}

export declare class ReadingPositionsMigration extends SqlMigration {
  /**
   * Uses the fixed reading positions migration id.
   */
  public constructor();

  /**
   * Creates the table.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Creates the `preferences` table: each preference's name, JSON value and update time.
 */
export declare class PreferencesMigration extends SqlMigration {
  /**
   * Uses the fixed preferences migration id.
   */
  public constructor();

  /**
   * Creates the table.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Gives each message the id of the checkpoint the checkpoints module took of its project's folder before it, for a reply that has one.
 */
export declare class ReplyCheckpointsMigration extends SqlMigration {
  /**
   * Uses the fixed reply checkpoints migration id.
   */
  public constructor();

  /**
   * Adds the messages' `checkpointId` column.
   * @param builder The migration builder.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Gives each chat still stored with the earlier default title "New conversation" the default title "New chat", in its row and in the change
 * feed's payloads for it, edited or not, as `edited` also marks a chosen responder, a move and a teammate added or removed. Its update time
 * stays, so the chat keeps its place in the Explorer and is still named after its first message.
 */
export declare class ChatTitlesMigration extends SqlMigration {
  /**
   * Uses the fixed chat titles migration id.
   */
  public constructor();

  /**
   * Adds the statements that rename the titles in the chats and in the change feed.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Lets a chat have no project: rebuilds the `conversations` table with a nullable `projectId`, still a foreign key to `projects`. It copies the
 * rows aside, drops the table, creates it again and copies them back, with foreign keys deferred so the messages, members, drafts and reading
 * positions that point at the chats stay valid at the commit.
 */
export declare class ProjectlessConversationsMigration extends SqlMigration {
  /**
   * Uses the fixed projectless conversations migration id.
   */
  public constructor();

  /**
   * Adds the statements that rebuild the table and its project index.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Renames the `providerAccounts` table to `providers` and its `provider` column to `kind`, renames the change feed's `ProviderAccount` entity to
 * `Provider`, and moves each stored `providerAccountId` field to `providerId` and each stored kind `provider` field to `kind`, at their known
 * paths only, so a tool input or detail with its own `provider` key keeps it.
 */
export declare class ProviderNamesMigration extends SqlMigration {
  /**
   * Uses the fixed provider names migration id.
   */
  public constructor();

  /**
   * Adds the statements, one per renamed field in its table and one in the change feed.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Renames the `conversations` and `conversationTeammates` tables to `chats` and `chatTeammates`, each `conversationId` column to `chatId` with its
 * indexes created again under the new names, and the change feed's `Conversation` and `ConversationMember` entities to `Chat` and `ChatMember`,
 * and moves each stored `conversationId` field to `chatId` at its known paths, in the rows and in the change feed's payloads.
 */
export declare class ChatNamesMigration extends SqlMigration {
  /**
   * Uses the fixed chat names migration id.
   */
  public constructor();

  /**
   * Adds the statements that rename the tables, columns, indexes, entities and fields.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Renames the Projects view layout's `pinnedConversations` and `conversationOrder` fields to `pinnedChats` and `chatOrder`, in the
 * `projectsLayout` preference and in its change feed payloads, so every window reads the new names and none has to move them.
 */
export declare class ChatLayoutNamesMigration extends SqlMigration {
  /**
   * Uses the fixed chat layout names migration id.
   */
  public constructor();

  /**
   * Adds the statements, one per renamed field in the preference and one in the change feed.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Creates the `backgroundTasks` table: each chat's background tasks, kept across a restart; keyed by id, with the chat (deleted with it), the
 * task's JSON and its last save, and an index on the chat.
 */
export declare class BackgroundTasksMigration extends SqlMigration {
  /**
   * Uses the fixed background tasks migration id.
   */
  public constructor();

  /**
   * Creates the table and its chat index.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Creates the `acpAgents` table: each added ACP agent's or local ACP command's kind, name, JSON and times. A local command's JSON holds references to saved secrets, never their values.
 */
export declare class AcpAgentsMigration extends SqlMigration {
  /**
   * Uses the fixed ACP agents migration id.
   */
  public constructor();

  /**
   * Creates the table.
   */
  public override apply(builder: MigrationBuilder): void;
}

/** An added ACP agent or local ACP command as the `acpAgents` table keeps it; only the catalog reads its JSON. */
export declare class AcpStoredAgent {
  public readonly kind: string;
  public readonly name: string;
  public readonly json: JsonObject;
  public constructor(kind: string, name: string, json: JsonObject);
}

/** A registry agent that can be added, with why it can't on this computer, or `null` when it can. */
export declare class AcpAgentOffer {
  public readonly stored: AcpStoredAgent;
  public readonly unavailable: string | null;
  public constructor(stored: AcpStoredAgent, unavailable: string | null);
}

/** What `AcpAgentsService` needs from the providers' side, which Core can't import: the registry's list, and an adapter for a stored agent. */
export interface IAcpAgentCatalog {
  /** The registry's list for this computer with the stored agents marked; a failed read with no kept list is the listing's `failure`. */
  listAsync(stored: readonly AcpStoredAgent[]): Promise<AcpAgentListing>;
  /** A registry agent's icon as a data address, or `null`. */
  readIconAsync(id: string): Promise<string | null>;
  /** The listed agent as it would be stored, or `null` when it isn't listed for this computer. */
  readOfferAsync(id: string): Promise<AcpAgentOffer | null>;
  /** The local command as it would be stored, under a kind `isTaken` refuses. */
  localOf(params: AcpLocalCommandAddParams, isTaken: (kind: string) => boolean): AcpStoredAgent;
  /** The stored agent's adapter; `save` keeps a newer version once it is installed. */
  openAsync(stored: AcpStoredAgent, save: (json: JsonObject) => Promise<void>): Promise<IProviderAdapter>;
  /** The saved secrets the stored agent refers to. */
  referencesOf(stored: AcpStoredAgent): readonly string[];
  /** Removes the stored agent's installed files as far as it can. */
  removeFilesAsync(stored: AcpStoredAgent): Promise<void>;
}

/** The added ACP agents and local ACP commands. */
export interface IAcpAgentsService {
  listAsync(): Promise<AcpAgentListing>;
  readIconAsync(params: AcpAgentIdParams): Promise<string | null>;
  addAsync(params: AcpAgentIdParams): Promise<ProviderKind>;
  addLocalAsync(params: AcpLocalCommandAddParams): Promise<ProviderKind>;
  removeAsync(params: AcpAgentIdParams): Promise<void>;
}

/**
 * Keeps the added ACP agents and local ACP commands in the `acpAgents` table and registers each as a kind, at start and when added. Adding one publishes
 * `ProviderKindsChanged`; so does removing one, which is refused while it has providers or an install runs, and which forgets its saved secrets and its files.
 * A stored agent that can't be opened at start is logged and left out, and the others still start.
 */
export declare class AcpAgentsService implements IAcpAgentsService {
  public constructor(context: DatabaseContext, registry: ProviderKindRegistry, kinds: IProviderKindsService, providers: IProvidersService, catalog: IAcpAgentCatalog,
    secrets: ISharedMcpSecrets, events: IEventSink, log?: ILog | null);
  /** Registers every stored agent as a kind. */
  public startAsync(): Promise<void>;
  public listAsync(): Promise<AcpAgentListing>;
  public readIconAsync(params: AcpAgentIdParams): Promise<string | null>;
  public addAsync(params: AcpAgentIdParams): Promise<ProviderKind>;
  public addLocalAsync(params: AcpLocalCommandAddParams): Promise<ProviderKind>;
  public removeAsync(params: AcpAgentIdParams): Promise<void>;
}

/**
 * Removes the person's email, plan, organization and sign-in method that each reply kept in its observed settings before, from the stored
 * messages and their change feed entries; only the provider's row keeps them.
 */
export declare class ReplyIdentityMigration extends SqlMigration {
  /**
   * Uses the fixed reply identity migration id.
   */
  public constructor();

  /**
   * Adds the two statements: one on the messages, one on the change feed's message entries.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Creates the `messageText` FTS5 trigram index over each message's text details, its triggers and its first rows, so a message
 * search answers from the index as the person types.
 */
export declare class MessageTextMigration extends SqlMigration {
  /**
   * Uses the fixed message text migration id.
   */
  public constructor();

  /**
   * Creates the table and its triggers, and fills it from the saved messages.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Creates the `accountLimits` table: one row per account that reached a usage limit, keyed by its provider, with when TeamRun saw the
 * limit and when it resets, `null` when the provider didn't say.
 */
export declare class AccountLimitsMigration extends SqlMigration {
  /**
   * Uses the fixed account limits migration id.
   */
  public constructor();

  /**
   * Creates the table.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Creates the `sustainAttempts` table: the accounts a chain of replies tried for a teammate under Sustain, keyed by the chain's first reply, the
 * teammate and the account, with the chat, so a chain tries each entry once and the rows go with the chat.
 */
export declare class SustainAttemptsMigration extends SqlMigration {
  /**
   * Uses the fixed Sustain attempts migration id.
   */
  public constructor();

  /**
   * Creates the table and its index on the chat.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Creates the table of TeamRun's own handover summaries, one per chat and teammate, with the last sequence number each covers.
 */
export declare class HandoverSummariesMigration extends SqlMigration {
  /**
   * Uses the fixed handover summaries migration id.
   */
  public constructor();

  /**
   * Creates the table, keyed by chat and teammate, its chat a foreign key.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Keeps the provider kind that wrote each of TeamRun's own handover summaries, so a Sustain note names it.
 */
export declare class HandoverSummaryKindsMigration extends SqlMigration {
  /**
   * Uses the fixed handover summary kinds migration id.
   */
  public constructor();

  /**
   * Adds the column with `Resources.addHandoverSummaryKind`.
   */
  public override apply(builder: MigrationBuilder): void;
}

/** Adds the `departments` and `departmentMembers` tables; a teammate has at most one membership row. */
export declare class DepartmentsMigration extends SqlMigration {
  /** Uses the fixed departments migration id. */
  public constructor();

  /** Creates both tables, keyed to `teammates` and to each other, with an index on each parent column. */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Keeps the id of the folder each reply's turn ran in, so a rewind restores from that folder's own checkpoints after the chat's folder changes and back.
 */
export declare class CheckpointFoldersMigration extends SqlMigration {
  /**
   * Uses the fixed checkpoint folders migration id.
   */
  public constructor();

  /**
   * Adds the column with `Resources.addMessageCheckpointFolder`; an earlier checkpoint's folder stays empty.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * The listener of a title session: it keeps the answer's last text, refuses every approval and question, and reports nothing else.
 */
export declare class TitleTurn implements ITurnListener {
  /**
   * Runs one isolated turn through the adapter's `askIsolated` and reads its answer.
   * @param adapter The adapter of the title's model.
   * @param request The isolated turn.
   * @param signal Aborts the turn.
   * @returns The answer's last text, or `null` when the adapter runs no isolated turn, or the turn didn't complete or gave none.
   * @throws Whatever `askIsolated` throws.
   */
  public static ask(adapter: IProviderAdapter, request: TurnRequest, signal: AbortSignal): Promise<string | null>;
  /** @inheritdoc */
  public onStartedAsync(): Promise<void>;
  /** @inheritdoc */
  public onDetailAsync(detail: TurnDetail): Promise<void>;
  /** @inheritdoc */
  public onThinking(): void;
  /**
   * Refuses the approval.
   * @param ask What the provider asks.
   * @returns The refusing option's id; rejected when the ask has none.
   */
  public onApprovalRequested(ask: ApprovalAsk): Promise<string>;
  /**
   * Refuses the questions.
   * @returns `null`.
   */
  public onQuestionsAsked(): Promise<readonly QuestionAnswer[] | null>;
  /** @inheritdoc */
  public onQuestionsPostedAsync(): Promise<void>;
  /** @inheritdoc */
  public onObservedAsync(): Promise<void>;
  /** @inheritdoc */
  public onUsageAsync(): Promise<void>;
  /** @inheritdoc */
  public onPlanUsageAsync(): Promise<void>;
  /** @inheritdoc */
  public onTaskStartedAsync(): Promise<void>;
  /** @inheritdoc */
  public onTaskOutput(): void;
  /** @inheritdoc */
  public onTaskEndedAsync(): Promise<void>;
  /**
   * Starts no wake.
   * @returns `null`.
   */
  public onWakeAsync(): Promise<WakeTurn | null>;
  /** @inheritdoc */
  public onSharedServerFailedAsync(): Promise<void>;
}

/**
 * Listens to a one-shot summary request and keeps its answer: every text the reply writes, each item at its latest text.
 */
export declare class SummaryTurn implements ITurnListener {
  /**
   * Runs the request and returns its answer.
   * @param adapter The adapter of the entry the request runs on.
   * @param request The request, isolated and without TeamRun's tools.
   * @param signal Aborts the request.
   * @returns The answer's texts in order, joined by blank lines, or `null` when the adapter runs no isolated turn for the request's provider;
   * it rejects when the request doesn't complete or writes no text.
   */
  public static ask(adapter: IProviderAdapter, request: TurnRequest, signal: AbortSignal): Promise<string | null>;

  public onStartedAsync(): Promise<void>;
  public onDetailAsync(detail: TurnDetail): Promise<void>;
  public onThinking(): void;

  /**
   * Denies the approval with its denying option.
   * @returns The denying option's id; it rejects when the ask has none.
   */
  public onApprovalRequested(ask: ApprovalAsk): Promise<string>;

  /**
   * Answers no question.
   */
  public onQuestionsAsked(): Promise<readonly QuestionAnswer[] | null>;

  public onQuestionsPostedAsync(): Promise<void>;
  public onObservedAsync(): Promise<void>;
  public onUsageAsync(): Promise<void>;
  public onPlanUsageAsync(): Promise<void>;
  public onTaskStartedAsync(): Promise<void>;
  public onTaskOutput(): void;
  public onTaskEndedAsync(): Promise<void>;
  public onWakeAsync(): Promise<WakeTurn | null>;
  public onSharedServerFailedAsync(): Promise<void>;
}

/**
 * Adds the `reason` of each Sustain attempt, why the chain recorded it: it stopped at a usage limit or had no room for the handover.
 */
export declare class SustainAttemptReasonsMigration extends SqlMigration {
  /**
   * Uses the fixed Sustain attempt reasons migration id.
   */
  public constructor();

  /**
   * Adds the column with `Resources.addSustainAttemptReason`.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Creates the `runOutputs` table: the output of each earlier Run on a reply's shell block, kept so it shows after a reload; keyed by
 * the message, its part and the block, with the chat (deleted with it), the output's JSON and its update time, and an index on the chat.
 */
export declare class RunOutputsMigration extends SqlMigration {
  /**
   * Uses the fixed run outputs migration id.
   */
  public constructor();

  /**
   * Creates the table and its chat index.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Creates the `waitingMessages` table: each message a person sent to a chat while its reply ran, to go once it ends; keyed by id, with
 * the chat (deleted with it), the message's JSON and its update time, and an index on the chat.
 */
export declare class WaitingMessagesMigration extends SqlMigration {
  /**
   * Uses the fixed waiting messages migration id.
   */
  public constructor();

  /**
   * Creates the table and its chat index.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Creates the `chatWakes` table: each wake a chat is owed when the work it sent elsewhere, or a sub-agent that outlived its turn, ends;
 * keyed by id, with the woken chat (deleted with it), the wake's state, its JSON and its update time, and an index on the state.
 */
export declare class ChatWakesMigration extends SqlMigration {
  /**
   * Uses the fixed chat wakes migration id.
   */
  public constructor();

  /**
   * Creates the table and its state index.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * A stored JSON field a migration moves: its table, change feed entity, old and new paths, and the row name it is limited to.
 */
export declare class RenamedJsonField {
  public readonly table: string;
  public readonly entity: string;
  public readonly from: string;
  public readonly to: string;
  public readonly name: string | null;

  public constructor(table: string, entity: string, from: string, to: string, name?: string | null);
}

/**
 * Gives each provider the native sessions its moved profile directories held, which a resume skips.
 */
export declare class ForgottenSessionsMigration extends SqlMigration {
  /**
   * Uses the fixed forgotten sessions migration id.
   */
  public constructor();

  /**
   * Adds the column with `Resources.addForgottenSessions`.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Gives every stored approval option the scope options now require.
 */
export declare class ApprovalScopesMigration extends SqlMigration {
  /**
   * Uses the fixed approval scopes migration id.
   */
  public constructor();

  /**
   * Rewrites each stored approval's options with `Resources.addApprovalOptionScopes`.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Additive schema for a draft per conversation.
 */
export declare class DraftsMigration extends SqlMigration {
  /**
   * Uses the fixed drafts migration id.
   */
  public constructor();

  /**
   * Creates the drafts table, keyed by its conversation.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * Additive schema for teammates and conversation memberships.
 */
export declare class TeammatesMigration extends SqlMigration {
  /**
   * Uses the fixed teammates migration id.
   */
  public constructor();

  /**
   * Creates both tables, membership foreign keys and lookup indexes.
   */
  public override apply(builder: MigrationBuilder): void;
}

/**
 * One pending reply with the provider and role snapshot and cancellation state, and the message it answers.
 */
export declare class ReplyWork {
  /**
   * The pending reply whose identity is fixed before any participant runs.
   */
  public readonly message: Message;
  /**
   * The provider captured at send time.
   */
  public readonly provider: Provider | null;
  /**
   * The role captured at send time.
   */
  public readonly instructions: string | null;
  /**
   * The message this reply answers: the person's message, or the teammate's reply that mentioned it.
   */
  public readonly trigger: Message;
  /**
   * Approval and cancellation ownership for this reply.
   */
  public readonly run: ActiveRun;
  /**
   * The turn the provider began on its own that this reply shows, or `null` for a reply to a message.
   */
  public readonly wake: WakeTurn | null;

  /**
   * Captures the immutable inputs and creates reply cancellation state.
   */
  public constructor(message: Message, provider: Provider | null, instructions: string | null, trigger: Message, hop: number, wake?: WakeTurn | null);

  /**
   * How many teammates' mentions led to this reply: 0 for a reply to the person's message, and the longest chain of the hand-offs it joined.
   */
  public get hop(): number;

  /**
   * The reply's provenance: the kind it was asked of, and its provider.
   * @throws ServiceException `Internal` when the reply's message holds no provenance.
   */
  public get provenance(): Provenance;

  /**
   * The other teammates' replies that handed work to this reply's teammate before it started, in the order they ended.
   */
  public get handOffs(): readonly Message[];

  /**
   * Whether the reply's participant has started its turn.
   */
  public get isStarted(): boolean;

  /**
   * Whether the reply has ended: its turn ran, or it was cancelled before it started.
   */
  public get isEnded(): boolean;

  /**
   * Settles once the reply has ended.
   */
  public get ended(): Promise<void>;

  /**
   * The teammates this reply's turn has sent a message to with its sender token, in any chat: those the message named or that answer it.
   * A mention of one of them in the reply hands nothing off, since the reply reports the send.
   */
  public get sentTo(): ReadonlySet<string>;

  /**
   * Joins a hand-off from another teammate's reply before this reply starts, so that it answers both, and keeps the longer chain.
   * @param handOff The handing reply, with its mentions.
   * @param hop The hand-off's chain length: the handing reply's `hop` and one.
   */
  public join(handOff: Message, hop: number): void;

  /**
   * Adds the teammates a send with this reply's sender token went to.
   * @param teammateIds The teammates the send named or started.
   */
  public recordSend(teammateIds: readonly string[]): void;

  /**
   * Marks the reply's turn as started.
   */
  public start(): void;

  /**
   * Marks the reply as ended and settles `ended`; ending it again changes nothing.
   */
  public end(): void;
}

/**
 * Builds capped participant context from existing message history without a stored read cursor.
 */
export declare class ParticipantContext {
  /**
   * Uses the existing message paging boundary, the teammates for the names that mention tokens are written with, and the conversations
   * for the title of the chat a message from another chat came from.
   */
  public constructor(messages: IMessagesService, teammates: ITeammatesService, conversations: IConversationsService);

  /**
   * Returns the current question with intervening context, or a first-join transcript when the session is fresh. Each mention token in a
   * message is written as `@` and the teammate's current full name, the name the message stored when the teammate is gone, or else the
   * token's label. An earlier message from another chat names the teammates whose replies answered it, so that a teammate reads it as sent
   * to them, with the reader as `you` and named only beside others. A teammate that another teammate's reply hands work to gets a close that
   * names that teammate and quotes the parts of the reply addressed to it: from each line that addresses it to the next line that addresses
   * anyone, or the whole reply when no line addresses it. A close that quotes the whole reply leaves it out of the transcript above, and a
   * prompt with no other new message is the close alone.
   * @param handOffs The other teammates' replies that handed work to this reply's teammate before it started, each closing the
   * prompt in the same way.
   */
  public createAsync(reply: Message, sent: Message, nativeSessionId: string | null, forked?: boolean, handOffs?: readonly Message[]): Promise<string>;

  /**
   * Returns the first prompt of a new session that a Sustain move starts: the chat before the reply, or before the reply a continuation goes
   * on from, chosen by `Handover.build` within the target's window, each message with its author, a tool call as one line and a long result
   * cut by `Handover.cut`; then the message it answers, the closes `createAsync` writes, and for a continuation what the failed reply wrote, whole; a hand-off
   * quoted whole in its close is left out of the history, its tool calls and results with it, since the close carries only its text, and the
   * window leaves room for the opening line and the closes.
   * @param reply The reply the prompt is for.
   * @param sent The message it answers.
   * @param continued The reply that stopped at a usage limit, which a continuation goes on from, or null.
   * @param handOffs The other teammates' replies that handed work to this reply's teammate before it started.
   * @param windowTokens The target's window, or null when no reply on its provider's kind and model reported one.
   * @param instructions The teammate's instructions, which the window leaves room for.
   * @param summary The summary of the chat and who wrote it, or null; what it carried names it and the messages it covers; with it, the history is the chat's first message, the summary,
   * and the messages from the last reply of the teammate's, the continued one included, that holds a compaction note of its own, not a
   * sub-agent's, on.
   * @returns The prompt with what it carried, or null when even the handover's left-out line doesn't fit.
   */
  public createHandoverAsync(reply: Message, sent: Message, continued: Message | null, handOffs: readonly Message[], windowTokens: number | null,
    instructions: string | null, summary?: ChatSummary | null): Promise<HandoverPrompt | null>;

  /**
   * Builds the prompt of TeamRun's own summary of the chat a compaction covers, for a session whose provider's summary can't be read.
   * @param reply The reply the handover is for.
   * @param sent The message it answers, left out of the summary.
   * @param continued The reply that stopped at a usage limit, or null.
   * @param windowTokens The window of the entry the request runs on, or null.
   * @returns The last sequence number the summary covers, before the point `compactedAsync` finds, and the prompt, whose chat is chosen as a handover's
   * history is, to the window's budget; or null without a point, or when not even the left-out line fits.
   */
  public createSummaryPromptAsync(reply: Message, sent: Message, continued: Message | null, windowTokens: number | null): Promise<readonly [number, string] | null>;

  /**
   * Whether a reply of the teammate's before the reply, or the continued reply itself, holds a compaction note of its own, not a sub-agent's,
   * so a handover asks for the session's summary only then.
   * @param reply The reply the handover is for.
   * @param continued The reply that stopped at a usage limit, or null.
   */
  public compactedAsync(reply: Message, continued: Message | null): Promise<boolean>;
}
