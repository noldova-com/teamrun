/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Server } from "node:http";

import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ICliCommandHandler, ICliPartContext, ICliSecrets } from "@noldova/desktop.cli";
import type {
  ClientClosure,
  EventChannel,
  IMethodHandler,
  IModuleDatabase,
  IModuleLog,
  IModuleSecrets,
  IModuleSettings,
  IPermissionAnswerer,
  IPermissionDetail,
  IPermissionsContext,
  IRuntimePart,
  IRuntimePartContext,
  IToolDescriptor,
  IToolHandler,
  IToolsContext,
  MethodFailureException,
  Migration,
  PermissionDecision,
  PermissionQuestion,
  RequestContext,
  ToolCall,
  ToolFailure,
  ToolResult,
  ToolSession
} from "@noldova/desktop.runtime";
import type { Exception } from "@noldova/context.exceptions";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import type {
  AppLook,
  ConversationEngine,
  IAcpAgentCatalog,
  IAppDescriptions,
  ICommandStarter,
  IConversationEngine,
  IConversationsService,
  IEventListener,
  ILog,
  IOutsideMessages,
  IPermissionAsker,
  IProjectsService,
  IProvidersService,
  IRunningCommand,
  IRememberedAppGrants,
  ISenderSends,
  ISenderTokens,
  ISharedMcpAccounts,
  ISharedMcpSecrets,
  ISharedMcpSignIn,
  ITeammatesService,
  ITimer,
  ITurnToolSession,
  ITurnToolSessions,
  IWindowsService,
  ProviderKindRegistry,
  RememberedAppGrant,
  RequestDispatcher,
  SharedMcpAccess,
  TeammateCommand,
  ToolCallRecord
} from "@noldova/teamrun.core";
import type { DataRecord, DataSource } from "@noldova/context.data";
import type { SqlConnection, SqlDialect, SqlProvider, SqlQuery, SqlSession } from "@noldova/context.data.sql";
import type {
  Event,
  IMcpTransport,
  McpToolCallParams,
  McpToolListParams,
  MessageSendParams,
  MethodName,
  OutsideConnection,
  PageAuthor,
  SharedMcpAccount
} from "@noldova/teamrun.protocol";
import type { ExecutableLocator, IProcessStarter, ProcessCommand, ProcessOrigin, StartedProcess } from "@noldova/teamrun.providers";
import type { RuntimeTerminalOwners } from "@noldova/terminal.protocol";

/**
 * The base of every exception the runtime package throws, which its callers catch as one.
 */
export declare abstract class RuntimeException extends Exception {
  /**
   * Initializes the exception.
   * @param message What went wrong.
   * @param cause The error that caused it, if any.
   */
  protected constructor(message: string, cause?: unknown);
}

/**
 * Noldova Desktop refused to start a program with a value that isn't an `Error`, which this exception carries as its cause.
 */
export declare class ProcessNotStartedException extends RuntimeException {
  /**
   * The exception's name, `"ProcessNotStartedException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;
  /**
   * The file name of the program Noldova Desktop refused to start.
   */
  public readonly program: string;

  /**
   * Initializes the exception, with its message naming the program.
   * @param program The file name of the program Noldova Desktop refused to start.
   * @param cause The value the start was refused with.
   */
  public constructor(program: string, cause: unknown);
}

/**
 * TeamRun's runtime part cannot do what was asked in its state.
 */
export declare class RuntimePartException extends RuntimeException {
  /**
   * The exception's name, `"RuntimePartException"`, which the class sets itself so that it stays
   * the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message Why.
   */
  public constructor(message: string);
}

/**
 * An installed app as computer use describes it.
 */
export interface IComputerUseAppDescription {
  /**
   * The app's name, as the person knows it.
   */
  readonly name: string;

  /**
   * The app's icon as a square PNG, or `null` when it couldn't be read.
   */
  readonly icon: Uint8Array | null;
}

/**
 * The GitHub module's access service, `git-github.access`, as TeamRun calls it: the signed-in token with its login, or why there is none.
 */
export interface IGitHubAccess {
  /**
   * Answers the token the GitHub module's sign-in holds, with the account's login, or the reason it can't.
   * @param signal Withdraws the call.
   */
  accessAsync(signal: AbortSignal): Promise<{ readonly token: string; readonly login: string } | { readonly reason: string }>;
}

/**
 * Computer use's apps service, `computer-use.apps`, as TeamRun calls it.
 */
export interface IComputerUseApps {
  /**
   * Describes an app by the identity a remembered grant names.
   * @param identity The app's identity: a program's path on Windows, a bundle identifier on macOS.
   * @param signal Aborts the description.
   * @returns The description, or `null` while computer use is off, when no installed app has the identity, when it fails or after its
   * time limit.
   */
  describeAsync(identity: string, signal: AbortSignal): Promise<IComputerUseAppDescription | null>;
}

/**
 * What TeamRun's MCP endpoint serves: the provider sessions' tokens it accepts, and the tools of the turn each token was issued for.
 */
export interface IMcpEndpointHost {
  /**
   * Checks a token a request presents.
   * @param token The bearer token.
   * @returns Whether TeamRun issued it to a provider session whose turn is still open, or kept it for a provider session between turns,
   * and it hasn't expired or been revoked.
   */
  acceptsSessionTokenAsync(token: string): Promise<boolean>;

  /**
   * Lists the tools of the token's turn, from its open tool session.
   * @param params The token.
   * @param signal Stops the listing.
   * @returns The tools.
   */
  listMcpToolsAsync(params: McpToolListParams, signal?: AbortSignal): Promise<readonly JsonObject[]>;

  /**
   * Calls a tool in the token's turn.
   * @param params The token, the tool's name and its arguments.
   * @param signal Stops the call.
   * @returns The tool's result.
   */
  callMcpToolAsync(params: McpToolCallParams, signal?: AbortSignal): Promise<JsonObject>;
}

/**
 * Builds the providers the runtime part offers.
 */
export interface IProviderKindRegistryFactory {
  /**
   * Builds the registry of providers.
   * @param productVersion The app's version, which the providers report to their programs.
   * @param dataDirectory The module's folder, where the providers keep their profiles.
   * @param starter Starts the providers' programs.
   * @param log Where a provider writes what the person can't see otherwise, such as a model listing that failed; none by default.
   * @returns The registry.
   */
  create(productVersion: string, dataDirectory: string, starter: IProcessStarter, log?: ILog | null): ProviderKindRegistry;
  /**
   * The ACP agents' catalog over the same folder; without it the app has no ACP agents.
   */
  createAcpCatalog?(productVersion: string, dataDirectory: string, starter: IProcessStarter, secrets: ISharedMcpSecrets, log?: ILog | null): IAcpAgentCatalog;
}

/**
 * The runtime part's canonical values.
 */
export declare class Resources {
  public static readonly acpAgentsFolderName: string;
  public static readonly acpRegistryFileName: string;
  public static readonly acpIconsFolderName: string;
  public static readonly acpInstallsFolderName: string;
  public static readonly acpRegistryTimeout: number;
  /** How long a request to a shared MCP server or its authorization server may take, in milliseconds. */
  public static readonly sharedMcpRequestTimeout: number;
  /** Why a shared MCP server's sign-in ended when the browser didn't come back in time. */
  public static readonly sharedMcpSignInTimedOut: string;
  /** Why a shared MCP server's sign-in ended when its answer's `state` wasn't the one sent. */
  public static readonly sharedMcpSignInStateMismatch: string;
  /** Why a shared MCP server's sign-in ended when its answer carried neither a code nor an error. */
  public static readonly sharedMcpSignInWithoutCode: string;
  /** Why a shared MCP server has no access token: no sign-in is saved for it. */
  public static readonly sharedMcpSignInMissing: string;
  /** Why a shared MCP server has no access token: it expired with no refresh token. */
  public static readonly sharedMcpSignInExpiredForGood: string;
  /** Why a shared MCP server has no access token: the server refused the refresh. */
  public static readonly sharedMcpRefreshRefused: string;
  /** Why a shared MCP server has no access token: the server refused a token without an expiry, with no refresh token. */
  public static readonly sharedMcpSignInRevoked: string;
  /** The page the browser shows once a sign-in is finished. */
  public static readonly sharedMcpSignedInPage: string;
  /** Why a sign-in ended when the authorization server sent an error, with it. */
  public static formatSharedMcpSignInDenied(reason: string): string;
  /** Why a sign-in ended when its code couldn't be exchanged, with why. */
  public static formatSharedMcpSignInFailed(reason: string): string;
  /** Why a shared MCP server has no access token when its refresh failed, with why. */
  public static formatSharedMcpRefreshFailed(reason: string): string;
  /** The setting that turns outside sessions on, `teamrun.outsideSessions`. */
  public static readonly outsideSessionsSetting: string;
  /** The setting that names the outside endpoint's port, `teamrun.outsidePort`. */
  public static readonly outsidePortSetting: string;
  /** The outside endpoint's port when the setting names none, 47391. */
  public static readonly outsideDefaultPort: number;
  /** The secret that keeps the outside token, `teamrun.outsideToken`. */
  public static readonly outsideTokenSecret: string;
  /** The outside tool that lists the teammates. */
  public static readonly outsideListTool: string;
  /** The outside tool that lists the most recent chats. */
  public static readonly outsideChatsTool: string;
  /** The outside tool that sends a teammate a message. */
  public static readonly outsideSendTool: string;
  /** The outside tool that reads the replies. */
  public static readonly outsideReadTool: string;
  /** The most characters an outside message may hold, 20,000. */
  public static readonly outsideTextLimit: number;
  /** The most message ids one read may name, 50. */
  public static readonly outsideReadLimit: number;
  /** The most seconds one read may wait, 30. */
  public static readonly outsideWaitLimit: number;
  /** Why the outside endpoint refused a token. */
  public static readonly outsideTokenRefused: string;
  /** Why the sessions don't listen when the machine can't keep the token, or the secret call fails for no reason a module can act on. */
  public static readonly outsideTokenUnkept: string;
  /** The connection's note while the sessions listen with a new token, made because the kept one couldn't be decrypted. */
  public static readonly outsideTokenRemade: string;
  /** Why the sessions don't listen when the app has no device identity to keep the token for. */
  public static readonly outsideTokenNoDevice: string;
  /** Why a teammate refused an outside message while it answers an earlier one. */
  public static readonly outsideTeammateBusy: string;
  /** Why a chat refused an outside message while it answers an earlier one. */
  public static readonly outsideChatBusy: string;
  /** Why a send named no teammate the list gives. */
  public static readonly outsideTeammateRequired: string;
  /** Why a send's chat id isn't an id. */
  public static readonly outsideChatRequired: string;
  /** Why a send's text is missing or too long. */
  public static readonly outsideTextRequired: string;
  /** Why a send's `from` isn't text. */
  public static readonly outsideFromNotText: string;
  /** Why a read's message ids are missing or too many. */
  public static readonly outsideIdsRequired: string;
  /** Why a read's wait isn't a whole number from 0 to 30. */
  public static readonly outsideWaitOutOfRange: string;
  /** Why the outside endpoint refused a tool it doesn't have, with its name. */
  public static formatOutsideToolUnknown(name: string): string;
  /** Why the outside endpoint couldn't listen on a port, with the system's error code, if any. */
  public static formatOutsidePortFailure(port: number, code: string | null): string;
  /** The log line for outside sessions settings that couldn't be applied, with the failure's kind. */
  public static formatOutsideNotApplied(kind: string): string;
  /** The log line for an outside endpoint that couldn't listen on a port, with the failure's kind. */
  public static formatOutsideNotListening(port: number, kind: string): string;
  /** The client a tool's request to the part's methods names, `teamrun.tools`. */
  public static readonly toolsClient: string;
  /** The connection a tool's request to the part's methods names, 0, for none. */
  public static readonly toolsConnection: number;
  /** The start of every TeamRun tool's name, `teamrun_`. */
  public static readonly toolPrefix: string;
  /** Terminal's agent tools, which TeamRun's MCP server serves beside its own, by these exact names, and Codex runs without asking, since each asks the person for itself where it must. */
  public static readonly terminalTools: readonly string[];
  /** Computer use's tools as computer-use 0.0.12 declares them, which TeamRun's MCP server serves beside Terminal's, by these exact names, while computer use offers them, and Codex runs without asking, since computer use asks the person for itself before it controls the screen or an app. */
  public static readonly computerUseTools: readonly string[];
  /** The binding of a session's working folder for Terminal's tools, `terminal.folder`. */
  public static readonly terminalFolderBinding: string;
  /** The binding of the terminals the person shared with a session, `terminal.shared`. */
  public static readonly terminalSharedBinding: string;
  /** The binding of the owner a session's terminals take, `terminal.owner`: the chat's, `teamrun.chat/<id>`. */
  public static readonly terminalOwnerBinding: string;
  /** The Browser module's agent tools, which TeamRun's MCP server serves and its providers run without asking, since the module asks the person for itself by each call's risk. */
  public static readonly browserTools: readonly string[];
  /** The Git modules' agent tools, the Git module's eleven and the GitHub module's three, which TeamRun's MCP server serves and its providers run without asking, since each module asks the person for itself where it must. */
  public static readonly gitTools: readonly string[];
  /** The binding of a session's working folder for the Git modules' tools, `git.folder`. */
  public static readonly gitFolderBinding: string;
  /** The binding of the Browser page a session drives, `page`: the chat's own, whose instance is the chat's id. */
  public static readonly browserPageBinding: string;
  /** The binding of the Browser workspace of a session's page, `profileKey`: the chat's project, or `teamrun-chats` outside projects. */
  public static readonly browserProfileBinding: string;
  /** The binding of the agent's name the Browser page shows while the agent acts, `agentName`: the teammate's. */
  public static readonly browserAgentBinding: string;
  /** The Browser module's code for a call whose page isn't open, `browser.viewClosed`, on which TeamRun opens the chat's page and calls again. */
  public static readonly browserViewClosedCode: string;
  /** How long, 250 ms, a Browser call waits before it is called again while the chat's page it opened isn't showing yet. */
  public static readonly pageShowStep: number;
  /** The panel of a chat's own Browser page, `Page`, which a panel tool's answer names as the chat's page. */
  public static readonly pagePanel: string;
  /** The start of a tool answer's origin, `teamrun:`. */
  public static readonly toolOriginPrefix: string;
  /** Noldova Desktop's failure code `Refused`. */
  public static readonly refusedFailure: string;
  /** MCP's content type for an image, `image`. */
  public static readonly mcpImageType: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly listProjectsTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly listChatsTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly listMessagesTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly listApprovalsTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly listProvidersTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly checkProviderTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly listTeammatesTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly openPanelTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly closePanelTool: string;
  /** The command-line command the tool of the same name runs. */
  public static readonly listProjectsCommand: string;
  /** The command-line command the tool of the same name runs. */
  public static readonly listChatsCommand: string;
  /** The command-line command the tool of the same name runs. */
  public static readonly listMessagesCommand: string;
  /** The command-line command the tool of the same name runs. */
  public static readonly listApprovalsCommand: string;
  /** The command-line command the tool of the same name runs. */
  public static readonly listProvidersCommand: string;
  /** The command-line command the tool of the same name runs. */
  public static readonly checkProviderCommand: string;
  /** The command-line command the tool of the same name runs. */
  public static readonly listTeammatesCommand: string;
  /** A tool argument's name, in snake case. */
  public static readonly projectIdArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly chatIdArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly panelArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly beforeArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly limitArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly pendingArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly providerIdArgument: string;
  /** The command-line value a tool argument becomes. */
  public static readonly projectValue: string;
  /** The command-line value a tool argument becomes. */
  public static readonly chatIdValue: string;
  /** The command-line value a tool argument becomes. */
  public static readonly beforeValue: string;
  /** The command-line value a tool argument becomes. */
  public static readonly limitValue: string;
  /** The command-line value a tool argument becomes. */
  public static readonly pendingValue: string;
  /** The command-line value a tool argument becomes. */
  public static readonly providerIdValue: string;
  /** A tool's title. */
  public static readonly listProjectsTitle: string;
  /** A tool's title. */
  public static readonly listChatsTitle: string;
  /** A tool's title. */
  public static readonly listMessagesTitle: string;
  /** A tool's title. */
  public static readonly listApprovalsTitle: string;
  /** A tool's title. */
  public static readonly listProvidersTitle: string;
  /** A tool's title. */
  public static readonly checkProviderTitle: string;
  /** A tool's title. */
  public static readonly listTeammatesTitle: string;
  /** A tool's title. */
  public static readonly openPanelTitle: string;
  /** A tool's title. */
  public static readonly closePanelTitle: string;
  /** A tool's description, for the agent. */
  public static readonly listProjectsDescription: string;
  /** A tool's description, for the agent. */
  public static readonly listChatsDescription: string;
  /** A tool's description, for the agent. */
  public static readonly listMessagesDescription: string;
  /** A tool's description, for the agent. */
  public static readonly listApprovalsDescription: string;
  /** A tool's description, for the agent. */
  public static readonly listProvidersDescription: string;
  /** A tool's description, for the agent. */
  public static readonly checkProviderDescription: string;
  /** A tool's description, for the agent. */
  public static readonly listTeammatesDescription: string;
  /** A tool argument's description, for the agent. */
  public static readonly projectIdDescription: string;
  /** A tool argument's description, for the agent. */
  public static readonly chatIdDescription: string;
  /** A tool argument's description, for the agent. */
  public static readonly beforeDescription: string;
  /** A tool argument's description, for the agent. */
  public static readonly limitDescription: string;
  /** A tool argument's description, for the agent. */
  public static readonly pendingDescription: string;
  /** A tool argument's description, for the agent. */
  public static readonly providerIdDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly openPanelDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly closePanelDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly panelDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly panelChatIdDescription: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly openProjectTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly forgetProjectTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly createChatTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly renameChatTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly moveChatTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly deleteChatTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly addTeammateToChatTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly removeTeammateFromChatTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly sendMessageTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly cancelRepliesTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly createTeammateTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly updateTeammateTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly deleteTeammateTool: string;
  /** A tool's title. */
  public static readonly openProjectTitle: string;
  /** A tool's title. */
  public static readonly forgetProjectTitle: string;
  /** A tool's title. */
  public static readonly createChatTitle: string;
  /** A tool's title. */
  public static readonly renameChatTitle: string;
  /** A tool's title. */
  public static readonly moveChatTitle: string;
  /** A tool's title. */
  public static readonly deleteChatTitle: string;
  /** A tool's title. */
  public static readonly addTeammateToChatTitle: string;
  /** A tool's title. */
  public static readonly removeTeammateFromChatTitle: string;
  /** A tool's title. */
  public static readonly sendMessageTitle: string;
  /** A tool's title. */
  public static readonly cancelRepliesTitle: string;
  /** A tool's title. */
  public static readonly createTeammateTitle: string;
  /** A tool's title. */
  public static readonly updateTeammateTitle: string;
  /** A tool's title. */
  public static readonly deleteTeammateTitle: string;
  /** A tool's description, which the teammate reads. */
  public static readonly openProjectDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly forgetProjectDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly createChatDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly renameChatDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly moveChatDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly deleteChatDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly addTeammateToChatDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly removeTeammateFromChatDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly sendMessageDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly cancelRepliesDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly createTeammateDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly updateTeammateDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly deleteTeammateDescription: string;
  /** A tool argument's name, in snake case. */
  public static readonly folderArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly titleArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly teammateIdArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly textArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly nameArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly roleArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly modelArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly effortArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly wakeWhenDoneArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly contextWindowArgument: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly folderDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly changedProjectIdDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly targetProjectIdDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly newChatProjectIdDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly newChatTitleDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly chatTitleDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly teammateIdDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly messageTextDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly wakeWhenDoneDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly teammateNameDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly roleDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly teammateProviderDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly modelDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly effortDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly contextWindowDescription: string;
  /** A method payload's field that a tool argument fills. */
  public static readonly rootPathField: string;
  /** A method payload's field that a tool argument fills. */
  public static readonly projectIdField: string;
  /** A method payload's field that a tool argument fills. */
  public static readonly conversationIdField: string;
  /** A method payload's field that a tool argument fills. */
  public static readonly teammateIdField: string;
  /** A method payload's field that a tool argument fills. */
  public static readonly titleField: string;
  /** A method payload's field that a tool argument fills. */
  public static readonly nameField: string;
  /** A method payload's field that a tool argument fills. */
  public static readonly roleField: string;
  /** A method payload's field that a tool argument fills. */
  public static readonly providerIdField: string;
  /** A method payload's field that a tool argument fills. */
  public static readonly harnessField: string;
  /** A method payload's field that a tool argument fills. */
  public static readonly modelField: string;
  /** A method payload's field that a tool argument fills. */
  public static readonly effortField: string;
  /** A method payload's field that a tool argument fills. */
  public static readonly speedField: string;
  /** A method payload's field that a teammate's change clears with a new provider. */
  public static readonly modeField: string;
  /** A method payload's field that a tool argument fills, and a teammate's change clears with a new provider. */
  public static readonly contextWindowField: string;
  /** A method payload's field that holds the provider a teammate's change was read on. */
  public static readonly expectedProviderIdField: string;
  /** A permission request detail's label, which the person sees. */
  public static readonly projectLabel: string;
  /** A permission request detail's label, which the person sees. */
  public static readonly folderLabel: string;
  /** A permission request detail's label, which the person sees. */
  public static readonly chatsLabel: string;
  /** A permission request detail's label, which the person sees: how many files a chat without a project holds. */
  public static readonly filesLabel: string;
  /** A permission request detail's label, which the person sees. */
  public static readonly chatLabel: string;
  /** A permission request detail's label, which the person sees. */
  public static readonly teammateLabel: string;
  /** A permission request detail's label, which the person sees. */
  public static readonly nameLabel: string;
  /** A permission request detail's label, which the person sees. */
  public static readonly roleLabel: string;
  /** A permission request detail's label, which the person sees. */
  public static readonly providerLabel: string;
  /** A permission request detail's label, which the person sees. */
  public static readonly modelLabel: string;
  /** A permission request detail's label, which the person sees. */
  public static readonly effortLabel: string;
  /** A permission request detail's label, which the person sees. */
  public static readonly contextWindowLabel: string;
  /** The Provider detail's value when the teammate's provider was deleted and the change keeps it: "No provider". */
  public static readonly noProviderValue: string;
  /** The `Stale` failure's message when what the person allowed changed before TeamRun acted: "What the person allowed changed before TeamRun acted, so nothing changed." */
  public static readonly changedBeforeAllowed: string;
  /** A change tool's refusal of a change its caller's reply couldn't record: "A teammate can't delete the chat it is answering in, since its reply couldn't record the result." */
  public static readonly ownChatRefused: string;
  /** A change tool's refusal to delete a chat of the project its caller answers in, which a running turn keeps from changing: "A teammate can't delete a chat in the project it is answering in, since TeamRun changes no chat of a project while a turn runs there." */
  public static readonly ownProjectChatRefused: string;
  /** A change tool's refusal of a change its caller's reply couldn't record: "A teammate can't forget the project of the chat it is answering in, since its reply couldn't record the result." */
  public static readonly ownProjectRefused: string;
  /** A change tool's refusal of a change its caller's reply couldn't record: "A teammate can't remove itself from the chat it is answering in, since its reply couldn't record the result." */
  public static readonly ownMembershipRefused: string;
  /** A change tool's refusal of a change its caller's reply couldn't record: "A teammate can't delete itself while it answers, since its reply couldn't record the result." */
  public static readonly callerRefused: string;
  /** A change tool's refusal to move a chat whose files the person hasn't agreed to copy: "A teammate can't move a chat without a project whose folder holds files; the person moves it with Move to project… in TeamRun's window, which asks first." */
  public static readonly chatFilesMoveRefused: string;
  /** A change tool's refusal to delete or move a chat whose folder's files it couldn't count, such as an unreadable subfolder: "Couldn't count the chat's files, so nothing changed." */
  public static readonly chatFilesNotCounted: string;
  /** The refusal of a send from a session whose turn has ended: "This call's turn has ended, so it can't send as its teammate." */
  public static readonly noRunningTurn: string;
  /** The refusal of a sub-agent tool call from a session whose turn has ended. */
  public static readonly subAgentNoRunningTurn: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly startSubAgentTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly waitSubAgentsTool: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly stopSubAgentTool: string;
  /** A tool's title. */
  public static readonly startSubAgentTitle: string;
  /** A tool's title. */
  public static readonly waitSubAgentsTitle: string;
  /** A tool's title. */
  public static readonly stopSubAgentTitle: string;
  /** A tool's description, which the teammate reads. */
  public static readonly startSubAgentDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly waitSubAgentsDescription: string;
  /** A tool's description, which the teammate reads. */
  public static readonly stopSubAgentDescription: string;
  /** The read-only agent `teamrun_start_sub_agent` starts: `explorer`. */
  public static readonly explorerAgent: string;
  /** The agent `teamrun_start_sub_agent` starts to work as its caller does: `helper`. */
  public static readonly helperAgent: string;
  /** A tool argument's name, in snake case. */
  public static readonly agentArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly descriptionArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly briefArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly subAgentIdArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly subAgentIdsArgument: string;
  /** A tool argument's name, in snake case. */
  public static readonly secondsArgument: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly agentDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly subAgentDescriptionDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly briefDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly subAgentIdDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly subAgentIdsDescription: string;
  /** A tool argument's description, which the teammate reads. */
  public static readonly secondsDescription: string;
  /** The refusal of a background command from a session whose turn has ended. */
  public static readonly commandNoRunningTurn: string;
  /** A tool's name, as `module.json` declares it. */
  public static readonly runInBackgroundTool: string;
  public static readonly runInBackgroundTitle: string;
  public static readonly runInBackgroundDescription: string;
  public static readonly commandArgument: string;
  public static readonly commandDescription: string;
  public static readonly commandDescriptionDescription: string;
  /** The `data` event of a background command's output. */
  public static readonly dataEvent: string;
  public static readonly utf8Encoding: BufferEncoding;
  public static readonly windowsPlatform: string;
  /** The shell of a background command on Windows when `ComSpec` names none, run with `/d /s /c`. */
  public static readonly windowsShell: string;
  public static readonly windowsShellVariable: string;
  public static readonly windowsShellFlags: readonly string[];
  /** A line break, which `cmd.exe /c` ends a command at. */
  public static readonly windowsLineBreaks: RegExp;
  public static readonly windowsCommandLineBreak: string;
  /** The shell of a background command elsewhere when `SHELL` names none, run with `-c`. */
  public static readonly posixShell: string;
  public static readonly posixShellVariable: string;
  public static readonly posixShellFlag: string;
  /** The failure's message when a permission request ends denied: "The person didn't allow it, so nothing changed." */
  public static readonly permissionDenied: string;
  /** The failure's message when a permission request ends expired: "Nobody answered in time, so nothing changed." */
  public static readonly permissionExpired: string;
  /** The failure's message when a permission request ends withdrawn: "The call ended before the person answered, so nothing changed." */
  public static readonly permissionWithdrawn: string;
  /** A change tool's answer when its method answers nothing: "Done." */
  public static readonly changeDone: string;
  public static readonly clientName: string;
  public static readonly clientTitle: string;
  /**
   * The name the checkpoints module publishes its service under, for the engine's reply checkpoints and rewinds: `checkpoints.service`.
   */
  public static readonly checkpointsServiceName: string;
  /**
   * The name Terminal publishes its owners service under, which closes a deleted chat's terminals: `terminal.owners`.
   */
  public static readonly terminalOwnersServiceName: string;
  public static readonly grokProfileSegments: readonly string[];
  public static readonly opencodeProfileSegments: readonly string[];
  public static readonly cursorProfileSegments: readonly string[];
  public static readonly copilotWorkSegments: readonly string[];
  public static readonly antigravityProfileSegments: readonly string[];
  public static readonly antigravityInstallSegments: readonly string[];
  public static readonly antigravityUnpackTimeout: number;
  public static readonly antigravitySignTimeout: number;
  public static readonly codesignPath: string;
  /**
   * Where Claude Code's downloads are staged, under the data folder; Claude Code's own setup puts it in its own place.
   */
  public static readonly claudeInstallSegments: readonly string[];
  /**
   * Where Copilot's versions are installed on Windows, under the data folder; elsewhere it goes in `~/.local/bin`.
   */
  public static readonly copilotInstallSegments: readonly string[];
  /**
   * How long reading a tool's latest version from its release channel may take when the installations are listed, in milliseconds.
   */
  public static readonly releaseChannelTimeout: number;
  /**
   * How long unpacking a downloaded Codex package may take, in milliseconds.
   */
  public static readonly codexUnpackTimeout: number;
  /**
   * How long unpacking a downloaded Copilot archive may take, in milliseconds.
   */
  public static readonly copilotUnpackTimeout: number;
  /**
   * Where TeamRun installs Cursor's CLI, under the module's data folder: one folder per pinned version.
   */
  public static readonly cursorInstallSegments: readonly string[];
  /**
   * How long unpacking a downloaded Cursor archive may take, in milliseconds.
   */
  public static readonly cursorUnpackTimeout: number;
  public static readonly antigravityTempSegments: readonly string[];
  public static readonly piExtensionSegments: readonly string[];
  public static readonly chainHopLimitSetting: string;
  /**
   * The setting naming the model that titles a new chat.
   */
  public static readonly titleModelSetting: string;
  public static readonly dataSourceName: string;
  public static readonly databaseFileExtension: string;
  public static readonly foreignKeysStatement: string;
  public static readonly requestId: string;
  public static readonly nameSeparator: string;
  public static readonly migrationIdSeparator: string;
  public static readonly migrationIdWordSeparator: string;
  public static readonly environmentNamePattern: RegExp;
  /**
   * The variable that names the app's crash handler pipe, which the programs TeamRun starts and its command scripts go without.
   */
  public static readonly crashPipeVariable: string;
  public static readonly errorField: string;
  public static readonly argumentsField: string;
  public static readonly rejectedStatus: string;
  public static readonly replyWork: string;
  /** The notice kind of a reply that failed off screen, without the module's id: `replyFailed`. */
  public static readonly replyFailedNotice: string;
  /** The window command that opens a chat, without the module's id: `openChat`. */
  public static readonly openChatCommand: string;
  /** The argument naming the chat `openChat` opens: `chatId`. */
  public static readonly openChatIdArgument: string;
  public static readonly rewindWork: string;
  public static readonly moveWork: string;
  public static readonly installWork: string;
  public static readonly signInWork: string;
  public static readonly discoverWork: string;
  public static readonly unsupportedValue: string;
  public static readonly partAlreadyActive: string;
  public static readonly providersDidNotStop: string;
  /**
   * The log line when Noldova Desktop refuses TeamRun as the answerer of permission requests, because the app names another permissions
   * module: "TeamRun answers no permission requests, since it isn't this app's permissions module."
   */
  public static readonly answererNotRegistered: string;
  /**
   * The refusal of an answer from a client other than the app's main process: "Only the person answers this, from TeamRun's window."
   */
  public static readonly mainProcessOnly: string;
  /**
   * The folder in the module's folder that holds the command teammates' turns run: `command`.
   */
  public static readonly commandFolderName: string;

  /**
   * Names a module's database file as Noldova Desktop keeps it in the module's folder: the module's id and `.sqlite`.
   * @param moduleId The module's id.
   * @returns The file's name.
   */
  public static formatDatabaseFileName(moduleId: string): string;

  /**
   * Says why a shared MCP server that signs in with an account is left out while the account's module isn't on.
   * @param account The account.
   * @returns The reason.
   */
  public static formatSharedMcpAccountInactive(account: string): string;

  /** The GitHub module's access service, `git-github.access`, which `SharedMcpAccounts` finds as an optional dependency's service. */
  public static readonly gitHubAccessService: string;

  /**
   * Wraps a background command in the quotes `cmd.exe /s /c` takes away, so the command's own quotes and operators reach
   * the shell as written.
   * @param command The command as the teammate wrote it.
   * @returns The command in quotes.
   */
  public static formatWindowsShellCommand(command: string): string;

  /**
   * Names a method or an event as Noldova Desktop qualifies it: the module's id, a dot, and the name
   * with a lowercase first letter.
   * @param moduleId The module's id.
   * @param name TeamRun's name for the method or event.
   * @returns The qualified name.
   */
  public static formatQualifiedName(moduleId: string, name: string): string;

  /**
   * The command line's words for the module's commands: the app's command, its product slug, then the module's id.
   * @param productSlug The product's slug.
   * @param moduleId The module's id.
   * @returns The words, such as `teamrun teamrun`.
   */
  public static formatCommand(productSlug: string, moduleId: string): string;

  /**
   * The log line for a deleted chat whose terminals could not be closed.
   * @param conversationId The chat's id.
   * @param kind The failure's kind: the error's name, and its code when it has one.
   * @returns The line.
   */
  public static formatChatTerminalsNotClosed(conversationId: string, kind: string): string;

  /**
   * The log line for a deleted chat whose pages could not be removed.
   * @param conversationId The chat's id.
   * @param kind The failure's kind: the error's name, and its code when it has one.
   * @returns The line.
   */
  public static formatChatPagesNotRemoved(conversationId: string, kind: string): string;

  /**
   * The title of a failed reply's notice.
   * @param name The teammate's name, or null for the default teammate.
   * @returns The title, such as "Alice's reply failed".
   */
  public static formatReplyFailed(name: string | null): string;

  /**
   * The log line for a notice Noldova Desktop refused.
   * @param kind The notice's qualified kind.
   * @param failure The failure's kind.
   * @returns The line.
   */
  public static formatNoticeNotPosted(kind: string, failure: string): string;

  /**
   * The log line for an MCP endpoint that could not listen, so that every teammate's turn fails, saying so, until TeamRun restarts.
   * @param kind The failure's kind: the error's name, and its code when it has one.
   * @returns The line, which holds no token.
   */
  public static formatEndpointNotListening(kind: string): string;

  /**
   * The log line for a module's stop of one tool session whose turn TeamRun couldn't end.
   * @param kind The failure's kind: the error's name, and its code when it has one.
   * @returns The line.
   */
  public static formatSessionStopFailed(kind: string): string;

  /**
   * The log line for an error the MCP endpoint's server raised once it listened.
   * @param kind The failure's kind: the error's name, and its code when it has one.
   * @returns The line, which holds no token.
   */
  public static formatEndpointFailed(kind: string): string;

  /**
   * The log line for a command teammates' turns can't run, because its folder could not be written.
   * @param kind The failure's kind: the error's name, and its code when it has one.
   * @returns The line.
   */
  public static formatCommandNotWritten(kind: string): string;

  /**
   * Composes a panel tool's answer: the panel, or the chat it opened or closed.
   * @param panel The panel's name.
   * @param conversationId The chat's id for a chat, else null.
   * @param open Whether the panel was opened.
   * @returns The answer.
   */
  public static formatPanelAnswer(panel: string, conversationId: string | null, open: boolean): string;

  /**
   * The answer of a Browser call that found the chat's page closed when TeamRun couldn't open it: the Browser's failure, then why, so the
   * agent can tell the person.
   * @param failure The Browser's failure message.
   * @param reason Why the page didn't open, such as the person typing.
   * @returns The message.
   */
  public static formatPageNotOpened(failure: string, reason: string): string;

  /**
   * The origin of a tool's answer, which marks the answer untrusted: it holds what people and teammates wrote.
   * @param tool The tool's name.
   * @returns `teamrun:<tool>`.
   */
  public static formatToolOrigin(tool: string): string;

  /**
   * Names a change tool's permission action as Noldova Desktop takes it: the module's id, a dot, and the tool's name without its
   * `teamrun_` prefix in camel case, such as `teamrun.deleteChat`.
   * @param moduleId The module's id.
   * @param tool The tool's name.
   * @returns The action.
   */
  public static formatPermissionAction(moduleId: string, tool: string): string;

  /**
   * The title of the request to forget a project, such as `Forget the project "Site" and delete its 3 chats`.
   * @param name The project's name.
   * @param chats How many chats it has.
   * @returns The title.
   */
  public static formatForgetProjectRequest(name: string, chats: number): string;

  /**
   * The title of the request to delete a chat, naming the files a chat without a project holds.
   * @param title The chat's title.
   * @param files How many files its folder holds; 0 for a chat of a project.
   * @returns The title.
   */
  public static formatDeleteChatRequest(title: string, files: number): string;

  /**
   * The title of the request to remove a teammate from a chat.
   * @param teammate The teammate's name.
   * @param title The chat's title.
   * @returns The title.
   */
  public static formatRemoveTeammateRequest(teammate: string, title: string): string;

  /**
   * The title of the request to stop another chat's replies.
   * @param title The chat's title.
   * @returns The title.
   */
  public static formatCancelRepliesRequest(title: string): string;

  /**
   * The title of the request to add a teammate.
   * @param name The new teammate's name.
   * @returns The title.
   */
  public static formatCreateTeammateRequest(name: string): string;

  /**
   * The title of the request to change a teammate.
   * @param name The teammate's name now.
   * @returns The title.
   */
  public static formatUpdateTeammateRequest(name: string): string;

  /**
   * A context window as a permission request shows it.
   * @param tokens The window in tokens.
   * @returns The window, such as `200,000 tokens`.
   */
  public static formatContextWindowTokens(tokens: number): string;

  /**
   * The title of the request to delete a teammate.
   * @param name The teammate's name.
   * @returns The title.
   */
  public static formatDeleteTeammateRequest(name: string): string;

  /**
   * The refusal of a tool's request for a method the runtime part doesn't register.
   * @param method The method's qualified name.
   * @returns The refusal.
   */
  public static formatNoMethodForTools(method: string): string;

  /**
   * The refusal of a call, through TeamRun's MCP server, of a tool that is neither TeamRun's nor Terminal's.
   * @param tool The tool's name.
   * @returns The refusal.
   */
  public static formatNotTeamRunTool(tool: string): string;

  /**
   * Writes a migration's id as Noldova Desktop accepts it: lowercase, with hyphens for underscores.
   * @param id The chat engine's migration id.
   * @returns The id.
   */
  public static formatMigrationId(id: string): string;

  /**
   * Composes the log line for a program that could not start, naming it by its executable's file name, the provider and
   * the provider's id ending it runs for, and the failure by its kind, never by its message.
   * @param program The executable's file name.
   * @param origin The kind and provider the program runs for, or `null` for a tool that runs for no provider.
   * @param kind The failure's kind: the error's name, and its code when it has one.
   * @returns The line.
   */
  public static formatProgramNotStarted(program: string, origin: ProcessOrigin | null, kind: string): string;
}

/**
 * One of TeamRun's tools: its descriptor, and the command-line command it runs.
 */
export declare class TeamRunTool {
  /** What Noldova Desktop's tool registry takes: the name, title, description, schema, hints, risk and deadline. */
  public readonly descriptor: IToolDescriptor;
  /** The command's name, such as `teamrun.listChats`. */
  public readonly command: string;

  /**
   * Initializes the tool.
   * @param descriptor The descriptor.
   * @param command The command's name.
   * @param values Which command value each argument becomes, by argument name; none by default.
   * @param defaults The command values given when an argument is left out; none by default.
   */
  public constructor(descriptor: IToolDescriptor, command: string, values?: ReadonlyMap<string, string>,
    defaults?: Readonly<Record<string, JsonValue>>);

  /**
   * The command's values for a call's arguments: the defaults, then each argument the call gives, except a `false` flag, which
   * the command takes as unset.
   * @param input The call's checked arguments.
   * @returns The values.
   */
  public toValues(input: JsonObject): Record<string, JsonValue>;
}

/**
 * TeamRun's read-only tools, which teammates reach over MCP: `teamrun_list_projects`, `teamrun_list_chats`, `teamrun_list_messages`,
 * `teamrun_list_approvals`, `teamrun_list_providers`, `teamrun_check_provider` and `teamrun_list_teammates`. Each asks no permission,
 * with a low risk and a deadline of 30 seconds, 60 for a provider's check, and at most 120; `teamrun_list_messages` lists 20 messages
 * when no limit is given. Each is marked read-only, so an MCP client calls it without asking, except a provider's check, marked open-world and not
 * read-only since it can open a session in the provider, so a client such as Codex asks the person first.
 */
export declare class TeamRunTools {
  /** Every tool that runs a command-line command, in the order `module.json` declares them. */
  public static readonly all: readonly TeamRunTool[];
  /**
   * `teamrun_open_panel`: opens a panel, `panel` one of `PanelName`'s values, and `chat_id` with `Chat` only; it asks no permission,
   * and since it isn't marked read-only, it is among the tools each provider runs without asking, as `closePanel` is; it is resumable,
   * since opening or closing a panel again changes nothing, and has a low risk and a deadline of 30 seconds, and at most 120.
   */
  public static readonly openPanel: IToolDescriptor;
  /** `teamrun_close_panel`: closes a panel, with the same arguments, risk and deadline as `openPanel`. */
  public static readonly closePanel: IToolDescriptor;
}

/**
 * Handles `teamrun_open_panel` and `teamrun_close_panel`: asks the windows to open or close the panel, the caller's chat taken
 * from the call's scope.
 */
export declare class PanelTool implements IToolHandler {
  /**
   * Initializes the handler.
   * @param moduleId The module's id, which names a failure's module code.
   * @param windows The open windows.
   * @param open Whether the tool opens the panel; false closes it.
   */
  public constructor(moduleId: string, windows: IWindowsService, open: boolean);

  /**
   * Asks the window that shows the caller's chat, or else the window focused last, to open or close the panel.
   * @param call The call.
   * @returns What the window did, as TeamRun's own text.
   * @throws ToolFailureException `Refused` for an unknown chat, a chat given or left out against its panel, or a window that
   * refuses while the person types, and `Unavailable` when no window answers or for any other failure; the module code is `<module>.<code>`, such as
   * `teamrun.unavailable`.
   */
  public handleAsync(call: ToolCall): Promise<ToolResult>;
}

/**
 * Handles a tool's calls by running its command-line command.
 */
export declare class CommandTool implements IToolHandler {
  /**
   * Initializes the handler.
   * @param moduleId The module's id, which names a failure's module code.
   * @param tool The tool.
   * @param handler The command's handler.
   */
  public constructor(moduleId: string, tool: TeamRunTool, handler: ICliCommandHandler);

  /**
   * Runs the command with the call's values and signal, and a console with no input and no events: asking gives `null`, as at
   * the end of the input, and a listener hears nothing.
   * @param call The call.
   * @returns The lines the command wrote, then its text, one per line, marked untrusted with the tool's origin.
   * @throws ToolFailureException `Refused` for a usage failure or a method's `InvalidParams`, `NotFound`, `Conflict` or
   * `Unauthorized`, and `Unavailable` for any other failure; a method's failure gives the module code `<module>.<code>`, such as
   * `teamrun.notFound`.
   */
  public handleAsync(call: ToolCall): Promise<ToolResult>;
}

/**
 * Which change a teammate's reply can't make because the reply couldn't record its result; a change tool refuses it.
 */
export declare enum ChangeGuard {
  /** No guard. */
  None = "None",
  /** The project of the caller's chat. */
  OwnProject = "OwnProject",
  /** The caller's chat. */
  OwnChat = "OwnChat",
  /** The caller's own membership of its chat. */
  OwnMembership = "OwnMembership",
  /** The calling teammate. */
  Caller = "Caller",
  /** A chat without a project whose folder holds files, which only the person moves, from the window. */
  ChatFiles = "ChatFiles"
}

/**
 * What a change's permission request shows the person, and the state the change acts on.
 */
export declare class ChangeView {
  /** What the change is on: the project's, chat's or teammate's id, the chat's and teammate's ids for a membership, or a new teammate's name. */
  public readonly subject: string;
  /** The request's one-line title. */
  public readonly title: string;
  /** The labeled details the person reads. */
  public readonly details: readonly IPermissionDetail[];
  /** The subject's state as JSON, which must be the same once the person allows the change. */
  public readonly state: string;

  /**
   * Initializes the view.
   * @param subject What the change is on.
   * @param title The title.
   * @param details The details.
   * @param state The state as JSON.
   */
  public constructor(subject: string, title: string, details: readonly IPermissionDetail[], state: string);
}

/**
 * One of TeamRun's change tools: its descriptor, the method it calls, and whether and when it asks the person first.
 */
export declare class TeamRunChange {
  /** What Noldova Desktop's tool registry takes. */
  public readonly descriptor: IToolDescriptor;
  /** The method the tool calls. */
  public readonly method: MethodName;
  /** Whether the tool asks the person before it acts. */
  public readonly asks: boolean;
  /** Whether it asks for a change in the caller's own chat too; when false, it asks only for another chat's. */
  public readonly asksInOwnChat: boolean;
  /** The change it refuses outright. */
  public readonly guard: ChangeGuard;

  /**
   * Initializes the change.
   * @param descriptor The descriptor.
   * @param method The method.
   * @param fields Which payload field each argument fills, by argument name.
   * @param asks Whether it asks first; false by default.
   * @param guard The change it refuses; `None` by default.
   * @param defaults The payload fields given when their arguments are left out; none by default.
   * @param asksInOwnChat Whether it asks in the caller's own chat too; true by default.
   */
  public constructor(descriptor: IToolDescriptor, method: MethodName, fields: ReadonlyMap<string, string>, asks?: boolean, guard?: ChangeGuard,
    defaults?: Readonly<Record<string, JsonValue>>, asksInOwnChat?: boolean);

  /**
   * The method's payload for a call's arguments: the defaults, then the current values, then each argument the call gives.
   * @param input The call's checked arguments.
   * @param current The values a left-out argument keeps; none by default.
   * @returns The payload.
   */
  public payloadOf(input: JsonObject, current?: Readonly<Record<string, JsonValue>>): Record<string, JsonValue>;
}

/**
 * TeamRun's change tools, which teammates reach over MCP: each marks the point it sends, has a deadline of 30 seconds and at most 120,
 * and offers the person only Allow once and Deny. `teamrun_forget_project`, `teamrun_delete_chat` and `teamrun_delete_teammate` are high
 * risk, `teamrun_remove_teammate_from_chat`, `teamrun_cancel_replies`, `teamrun_create_teammate` and `teamrun_update_teammate` medium, and the
 * rest low; the medium and high ones ask the person first, `teamrun_cancel_replies` only for another chat than the caller's.
 */
export declare class TeamRunChanges {
  /** Every tool that calls one method, in the order `module.json` declares them. */
  public static readonly all: readonly TeamRunChange[];
  /**
   * `teamrun_send_message`: sends `text` to `chat_id` as from the calling teammate's turn, without waiting for its replies; it asks nothing.
   * With `wake_when_done`, the turn is woken with a new turn once the replies, and their hand-offs in that chat, have ended.
   */
  public static readonly send: IToolDescriptor;
}

/**
 * Reads what a change acts on, for its permission request and to tell whether it changed before the person allowed it.
 */
export declare class ChangeSubjects {
  /**
   * Initializes the reader.
   * @param projects The projects.
   * @param conversations The chats.
   * @param teammates The teammates.
   * @param providers The providers.
   */
  public constructor(projects: IProjectsService, conversations: IConversationsService, teammates: ITeammatesService, providers: IProvidersService);

  /**
   * The fields a teammate's change clears besides the ones it names: its speed when the call names a model or a provider, and its
   * mode and context window when the call names a provider; none for another change, so a field the call leaves out keeps its value.
   * A call that names a model, effort, context window or provider also carries the provider it read the teammate on, so Core refuses it once the teammate
   * has moved.
   * @param change The change.
   * @param input The call's checked arguments.
   * @returns The cleared fields.
   */
  public clearedOfAsync(change: TeamRunChange, input: JsonObject): Promise<Readonly<Record<string, JsonValue>>>;

  /**
   * What a change that asks first shows the person.
   * @param change The change.
   * @param payload The method's payload.
   * @returns The view, or `null` when what it acts on isn't found, which the method then refuses.
   * @throws {ToolFailureException} `Refused` when it can't count the files of a deleted chat without a project.
   */
  public viewOfAsync(change: TeamRunChange, payload: Readonly<Record<string, JsonValue>>): Promise<ChangeView | null>;

  /**
   * Counts the files in a chat's own folder, without holding up Core's other requests.
   * @param conversationId The chat.
   * @returns How many files it holds.
   * @throws {ToolFailureException} `Refused` when the folder can't be read, so the change does nothing.
   */
  public countFilesOfAsync(conversationId: string): Promise<number>;
}

/**
 * Turns the failure of a method a tool called past its point of no return into the tool's.
 */
export declare class MethodFailures {
  /**
   * The tool failure for a method's failure.
   * @param moduleId The module's id, which names the module code.
   * @param error The failure.
   * @returns `OutcomeUncertain`, as Noldova Desktop reports any failure past the point of no return, with the error's message and, for a method's failure,
   * the module code `<module>.<code>`, such as `teamrun.notFound`.
   */
  public static of(moduleId: string, error: unknown): ToolFailure;

  /**
   * The tool failure for a permission request the person didn't allow.
   * @param decision The request's decision.
   * @returns `Expired` or `Withdrawn` when nobody answered in time or the call ended first, and `Denied` otherwise; each says nothing changed.
   */
  public static ofDecision(decision: PermissionDecision): ToolFailure;
}

/**
 * Handles a change tool's calls: refuses its guarded change, asks the person first when the change does, and calls its method.
 */
export declare class MethodTool implements IToolHandler {
  /**
   * Initializes the handler.
   * @param moduleId The module's id.
   * @param change The change.
   * @param handler The method's handler.
   * @param subjects What reads the change's subject.
   * @param conversations The chats, which give the caller's project.
   */
  public constructor(moduleId: string, change: TeamRunChange, handler: IMethodHandler, subjects: ChangeSubjects, conversations: IConversationsService);

  /**
   * Makes the change for the caller its scope names.
   * @param call The call.
   * @returns The method's answer as JSON, or `Resources.changeDone` when it answers nothing, marked with the tool's origin.
   * @throws ToolFailureException `Refused` for a guarded change; `Denied`, `Expired` or `Withdrawn` when the person didn't allow it;
   * `Stale` when what the person allowed changed first; and the method's failure as `MethodFailures.of` gives it.
   */
  public handleAsync(call: ToolCall): Promise<ToolResult>;
}

/**
 * Handles `teamrun_send_message`: asks the person first through the call's own permission request, so the call's deadline waits for the
 * answer, then sends as the teammate whose running turn opened the call's session, through Core's in-process send that skips Core's own ask.
 */
export declare class SendTool implements IToolHandler {
  /**
   * Initializes the handler.
   * @param moduleId The module's id.
   * @param senders What gives a running turn's sender token.
   * @param sends What describes a send's ask and sends it once allowed.
   * @param teammates The teammates the text may mention.
   */
  public constructor(moduleId: string, senders: ISenderTokens, sends: ISenderSends, teammates: ITeammatesService);

  /**
   * Sends the text, with the teammates it mentions, under the turn's sender token, once the person allows it: a medium-risk request with Allow once
   * and Deny, naming the chat, whose reply it starts as `ISenderSends.describeSendAsync` says, and the text, which TeamRun's approval allows without
   * asking in a mode that skips asking. After an allow it describes the send again and sends only when Starts is unchanged. A send Core would
   * refuse raises no request, and then fails as Core refuses it.
   * @param call The call.
   * @returns The send's result as JSON, marked with the tool's origin.
   * @throws ToolFailureException `Refused` when the session's turn has ended, the person's answer as `MethodFailures.ofDecision` gives it when they
   * didn't allow it, `Stale` when Starts changed before the allow, and Core's failure as `MethodFailures.of` gives it.
   */
  public handleAsync(call: ToolCall): Promise<ToolResult>;
}

/**
 * Handles a sub-agent tool, `teamrun_start_sub_agent`, `teamrun_wait_sub_agents` or `teamrun_stop_sub_agent`, or
 * `teamrun_run_in_background`, for the running turn that opened the call's session.
 */
export declare class SubAgentTool implements IToolHandler {
  /**
   * Initializes the handler.
   * @param moduleId The module's id.
   * @param descriptor The tool's descriptor; the call marks sending when it does.
   * @param handler The method's handler.
   * @param senders What gives a running turn's sender token.
   * @param paramsOf Turns the call's arguments and the turn's sender token into the method's parameters.
   * @param noRunningTurn The refusal when the session's turn has ended; `Resources.subAgentNoRunningTurn` by default.
   */
  public constructor(moduleId: string, descriptor: IToolDescriptor, handler: IMethodHandler, senders: ISenderTokens,
    paramsOf: (input: JsonObject, token: string) => JsonObject, noRunningTurn?: string);

  /**
   * Calls the method under the turn's sender token.
   * @param call The call.
   * @returns The method's answer as JSON, marked with the tool's origin.
   * @throws ToolFailureException `Refused` when the session's turn has ended, and the method's failure as `MethodFailures.of` gives it.
   */
  public handleAsync(call: ToolCall): Promise<ToolResult>;
}

/**
 * The `teamrun_run_in_background` tool's descriptor, and how it turns its arguments into `CommandStartParams`. It runs any command
 * the person's shell runs, so it is destructive, open-world and of high risk: it isn't among a turn's approved tools, so each call
 * asks as the provider's own shell would.
 */
export declare class CommandTools {
  /**
   * The tool, with `command` and `description`.
   */
  public static readonly run: IToolDescriptor;

  /**
   * Turns the call's arguments into the method's parameters.
   * @param input The call's arguments.
   * @param token The turn's sender token.
   * @returns The `CommandStartParams` as JSON.
   */
  public static runParamsOf(input: JsonObject, token: string): JsonObject;
}

/**
 * The sub-agent tools' descriptors, and how each turns its arguments into its method's parameters. Starting and stopping change
 * nothing outside the turn's own reply and stay within the turn's permission, so neither is destructive nor open-world; waiting is
 * read-only and may take up to 50 seconds, inside Codex's 60-second tool timeout.
 */
export declare class SubAgentTools {
  /** `teamrun_start_sub_agent`: starts an explorer or a helper on a brief and answers at once with its row. */
  public static readonly start: IToolDescriptor;
  /** `teamrun_wait_sub_agents`: waits for the turn's sub-agents for at most `seconds`, 30 by default and at most 50. */
  public static readonly wait: IToolDescriptor;
  /** `teamrun_stop_sub_agent`: stops one of the turn's sub-agents, with `teamrun_wait_sub_agents` as its next tool. */
  public static readonly stop: IToolDescriptor;
  /** The three, in the order `module.json` declares them. */
  public static readonly all: readonly IToolDescriptor[];

  /**
   * The parameters of `SubAgentStart`.
   * @param input The call's arguments.
   * @param token The turn's sender token.
   * @throws JsonException when an argument is missing or of the wrong type; it names the argument's path.
   */
  public static startParamsOf(input: JsonObject, token: string): JsonObject;

  /**
   * The parameters of `SubAgentWait`: all of the turn's sub-agents when `sub_agent_ids` is left out, for 30 seconds when `seconds` is.
   * @param input The call's arguments.
   * @param token The turn's sender token.
   * @throws JsonException when an argument is missing or of the wrong type; it names the argument's path.
   */
  public static waitParamsOf(input: JsonObject, token: string): JsonObject;

  /**
   * The parameters of `SubAgentStop`.
   * @param input The call's arguments.
   * @param token The turn's sender token.
   * @throws JsonException when an argument is missing or of the wrong type; it names the argument's path.
   */
  public static stopParamsOf(input: JsonObject, token: string): JsonObject;
}

/**
 * The command-line part's context inside the runtime: it keeps the commands the part registers, answers their requests
 * with the runtime part's own method handlers, and keeps their secrets in the runtime part's own.
 */
export declare class InProcessCliContext implements ICliPartContext {
  /** The module's id. */
  public readonly moduleId: string;
  /** The registered commands, by name. */
  public readonly commands: Map<string, ICliCommandHandler>;
  /** The commands' secrets, kept in the runtime part's own once the command's signal is checked; never read back. */
  public readonly secrets: ICliSecrets;

  /**
   * Initializes the context.
   * @param moduleId The module's id.
   * @param methods The part's method handlers, by qualified name.
   * @param secrets The runtime part's secrets, which the commands' secrets go to.
   */
  public constructor(moduleId: string, methods: ReadonlyMap<string, IMethodHandler>, secrets: IModuleSecrets);

  /**
   * Keeps a command.
   * @param name The command's name.
   * @param handler The command's handler.
   */
  public registerCommand(name: string, handler: ICliCommandHandler): void;

  /**
   * Answers a command's request with the method's handler, as the client `teamrun.tools` on connection 0.
   * @param method The method's qualified name.
   * @param payload The request's payload.
   * @param signal Aborts the request.
   * @returns The method's payload.
   * @throws RuntimePartException when the part registers no such method; the method's own failure reaches the caller.
   */
  public requestAsync(method: string, payload: JsonValue, signal: AbortSignal): Promise<JsonValue>;
}

/**
 * A turn's agent session of Noldova Desktop's tool registry, as TeamRun's MCP server sees it.
 */
export declare class RuntimeToolSession implements ITurnToolSession {
  /**
   * Initializes the session.
   * @param session The registry's session.
   * @param openPage Opens the chat's Browser page, for a Browser tool's call that finds it closed, which then runs again until the page shows,
   * within the tool's deadline; none by default.
   * @param timer Waits between those calls; Node's timers by default.
   * @param record Takes each Browser call's record for its step in the reply: the result's fields, or a failure's code and module code
   * under `failure`, and its first image; none by default.
   * @param calls The served calls in flight, shared with the permission answerer: each call is opened in it under the `callId` it
   * passes to the registry, and closed when the call ends; a set of its own by default.
   */
  public constructor(session: ToolSession, openPage?: ((signal: AbortSignal) => Promise<void>) | null, timer?: ITimer,
    record?: (call: ToolCallRecord) => void, calls?: ServedCalls);

  /**
   * Lists TeamRun's own tools, those named `teamrun_`, as MCP tools: name, title when there is one, description, input schema,
   * output schema when there is one, and the read-only, destructive and open-world hints.
   * @returns The tools.
   */
  public listToolsAsync(): Promise<readonly JsonObject[]>;

  /**
   * Calls one of TeamRun's tools in the session.
   * @param name The tool's name.
   * @param input The arguments.
   * @param signal Withdraws the call.
   * @returns The MCP `tools/call` result: the content, with images as `image` items, and the structured fields as
   * `structuredContent`, or for a failure `isError` with `<code> (<module code>): <message>` and the failure's content; a tool that
   * isn't TeamRun's is refused without a call.
   */
  public callToolAsync(name: string, input: JsonObject, signal: AbortSignal): Promise<JsonObject>;

  /**
   * Ends the registry's session, which aborts its calls in flight.
   */
  public end(): void;
}

/**
 * Signs in to a shared HTTP MCP server with OAuth 2.1 through the MCP SDK's client: discovery from the server's 401 and its metadata, dynamic
 * client registration, the authorization code with PKCE in the person's browser, and a redirect to a one-use listener on 127.0.0.1 at a port the
 * system picks, open for five minutes at most. The client, its tokens and when the access token expires are kept in Noldova Desktop's secret store
 * under the sign-in's reference, never logged or written elsewhere.
 */
export declare class SharedMcpOauth implements ISharedMcpSignIn {
  /**
   * @param secrets Noldova Desktop's secret store of the module.
   * @param expiry Gives each started sign-in the signal whose abort ends it while the browser hasn't answered, with `sharedMcpSignInTimedOut`;
   * by default it aborts after five minutes. Once the answer arrives, the signal no longer ends the sign-in.
   * @param now The clock that expiry is read against.
   * @param deadline Gives each request to the server or its authorization server the signal whose abort ends it; by default it aborts after
   * five seconds.
   */
  public constructor(secrets: IModuleSecrets, expiry?: () => AbortSignal, now?: () => number, deadline?: () => AbortSignal);
  /**
   * Registers the sign-in under `reference` at once, ending an earlier one there without an answer, then asks the server for its 401, registers
   * TeamRun as a client and returns the address of the authorization server's sign-in page, or `null` when a Sign out or a later start of the same
   * reference ended it first. The listener
   * answers one request at its callback path, ending the sign-in: refused when its state isn't the one sent or it carries an error, otherwise the
   * code is exchanged for tokens, which are saved. A request at another path gets 404 and doesn't end it.
   * @throws The server's or the SDK's error when discovery or registration fails, or `RuntimePartException` when the server sends no sign-in page.
   */
  public startAsync(url: string, reference: string, finished: (access: SharedMcpAccess) => void): Promise<string | null>;
  /**
   * Reads the access token; one that expires within a minute is refreshed first, and the new tokens are saved. Refused when no sign-in is saved,
   * none can renew it, or the refresh fails. Reads of the same reference share one refresh.
   * @throws The store's error when it can't read the sign-in.
   */
  public accessAsync(url: string, reference: string): Promise<SharedMcpAccess>;
  /** Removes the saved sign-in. */
  public signOutAsync(reference: string): Promise<void>;
}

/**
 * Answers a shared MCP server's account sign-in from the GitHub module's `git-github.access`, an optional dependency, read afresh for each
 * listing and each turn so signing out of GitHub stops the next turn's token; the token is never logged or kept.
 */
export declare class SharedMcpAccounts implements ISharedMcpAccounts {
  /** @param find Finds the GitHub module's access service, or `null` while that module isn't on at the version TeamRun names. */
  public constructor(find: () => IGitHubAccess | null);
  /** Whether a published service is the GitHub module's access service. */
  public static isGitHubAccess(service: object): service is IGitHubAccess;
  /**
   * @param account The account the server signs in with.
   * @returns The token, granted with no expiry; or refused with the GitHub module's reason, or `formatSharedMcpAccountInactive` while it isn't on.
   * @throws The service's error, or a timeout after five seconds.
   */
  public accessAsync(account: SharedMcpAccount): Promise<SharedMcpAccess>;
}

/**
 * TeamRun's MCP endpoint: streamable HTTP, stateless and with JSON answers, at `/mcp` on 127.0.0.1 and a port the system picks, open while
 * the runtime part is active. A request must name exactly that address and port as its `Host`, and carry no `Origin`, or it gets 403; another
 * path gets 404; a missing, malformed, unknown, expired or revoked bearer token gets 401 with `WWW-Authenticate: Bearer`, as does any token
 * before `serve`; then a method other than POST gets 405. Each POST gets its own MCP server over the SDK's streamable HTTP transport, whose
 * tools are those of the turn the token was issued for. A request that fails otherwise has its connection destroyed. Nothing about a request
 * is logged.
 */
export declare class McpHttpEndpoint {
  /**
   * Initializes the endpoint, which answers the server's requests from now on.
   * @param log Takes a line, with no token, for each error the server raises once it listens.
   * @param server The HTTP server it listens with; a new one by default.
   */
  public constructor(log: ILog, server?: Server);

  /**
   * Starts listening on 127.0.0.1.
   * @param port The port; 0, the default, lets the system pick one.
   * @returns The endpoint's URL, `http://127.0.0.1:<port>/mcp`.
   * @throws The server's listen error, such as `EADDRINUSE` for a port in use, or `RuntimePartException` when the server listens on an address
   * without a port.
   */
  public listenAsync(port?: number): Promise<string>;

  /**
   * Starts answering with a host's tools; until then every request gets 401.
   * @param host The host, the chat engine.
   */
  public serve(host: IMcpEndpointHost): void;

  /**
   * Closes the endpoint and every connection to it; does nothing when it isn't listening.
   */
  public closeAsync(): Promise<void>;
}

/**
 * Answers `OutsideConnectionRead` or `OutsideTokenReset` with the outside connection an action gives.
 */
export declare class OutsideConnectionMethod implements IMethodHandler {
  /**
   * Initializes the method.
   * @param act Reads the connection, or resets its token and reads it.
   */
  public constructor(act: () => Promise<OutsideConnection>);

  /**
   * Runs the action.
   * @returns The connection's JSON.
   * @throws Whatever the action throws.
   */
  public handleAsync(): Promise<JsonValue>;
}

/**
 * Outside sessions: a coding agent running outside TeamRun on this computer reaches the teammates through a second MCP endpoint on
 * 127.0.0.1, on the port `teamrun.outsidePort` names, while `teamrun.outsideSessions` is on. One token, a secret named
 * `Resources.outsideTokenSecret`, opens it; the class keeps only its SHA-256 and compares in constant time. Its three tools list the
 * teammates, send one a message as an outside sender, and read the replies by the handles the sends gave, waiting up to 30 seconds.
 */
export declare class OutsideSessions implements IMcpEndpointHost {
  /**
   * Initializes the sessions; nothing listens until `startAsync`.
   * @param settings The module's settings, for `teamrun.outsideSessions` and `teamrun.outsidePort`.
   * @param secrets The module's secrets, for the token.
   * @param outside The engine's outside list, sends and replies.
   * @param events The events a waiting read wakes on.
   * @param timer The timer that ends a waiting read.
   * @param endpointOf Makes the endpoint each time the sessions start listening.
   * @param log Takes a line when the port can't be opened.
   * @param appWindows The app's windows, whose change, a window opening or closing or the main process connecting or going, applies a token read that waited again.
   */
  public constructor(settings: IModuleSettings, secrets: IModuleSecrets, outside: IOutsideMessages,
    events: { subscribe(listener: IEventListener): Disposable }, timer: ITimer, endpointOf: () => McpHttpEndpoint, log: ILog,
    appWindows: { onChanged(listener: () => void): () => void });

  /**
   * Follows both settings and the app's windows from now on and, without waiting, starts applying them: when the sessions are on,
   * makes the token if there is none and listens on the port. A port that can't be opened leaves the sessions off with the failure
   * that `readAsync` reports. A token read that fails with `SecretFailureReason.NotConnected` leaves them waiting with no failure,
   * and they apply again at the app's next change, or at once when it changed during the read; `Undecryptable` makes and keeps a new token and
   * listens, with the note that `readAsync` reports once that token is kept, until the next apply; `NoDevice` and every other failure leave them off with the
   * failure that `readAsync` reports.
   */
  public startAsync(): Promise<void>;

  /**
   * Reads the connection.
   * @returns Whether the sessions are on, the URL, the token or null before the first, the failure while on, and the note while they listen.
   */
  public readAsync(): Promise<OutsideConnection>;

  /**
   * Makes and saves a new token, ends every waiting read, and forgets every message handle, so the old token's handles read as unknown.
   * @returns The connection with the new token.
   */
  public resetAsync(): Promise<OutsideConnection>;

  /**
   * Stops listening and ends every waiting read for good.
   */
  public closeAsync(): Promise<void>;

  /**
   * Checks a bearer token.
   * @param token The token.
   * @returns True while the sessions are on and the token is theirs.
   */
  public acceptsSessionToken(token: string): boolean;

  /**
   * Checks a bearer token, as the MCP endpoint asks.
   * @param token The token.
   * @returns A promise of true while the sessions are on and the token is theirs.
   */
  public acceptsSessionTokenAsync(token: string): Promise<boolean>;

  /**
   * Lists the three tools.
   * @param params The token.
   * @returns The tools' MCP descriptions.
   * @throws ServiceException `Unauthorized` with `Resources.outsideTokenRefused` for a token it doesn't accept.
   */
  public listMcpToolsAsync(params: McpToolListParams): Promise<readonly JsonObject[]>;

  /**
   * Calls a tool. A refused token, an unknown tool, invalid arguments, an unknown teammate and a busy teammate each answer an MCP tool
   * error; a busy teammate's is `Resources.outsideTeammateBusy`.
   * @param params The token, the tool and its arguments.
   * @param signal Ends a waiting read.
   * @returns The tool's MCP result, its JSON as text.
   * @throws Whatever fails other than a `ServiceException`.
   */
  public callMcpToolAsync(params: McpToolCallParams, signal?: AbortSignal): Promise<JsonObject>;
}

/**
 * TeamRun's MCP server over one request's streamable HTTP transport of the SDK: it hands the server each message the client sends and the
 * transport's close, and checks each message the server sends against the SDK's JSON-RPC schema before the transport sends it.
 */
export declare class McpHttpTransport implements IMcpTransport {
  /** Set by the server: hears each message the client sends. */
  public onmessage?: ((message: unknown) => void) | undefined;
  /** Set by the server: hears the transport's close. */
  public onclose?: (() => void) | undefined;

  /**
   * Initializes the adapter, taking over the transport's message and close handlers.
   * @param transport The SDK's transport.
   */
  public constructor(transport: Pick<StreamableHTTPServerTransport, "onmessage" | "onclose" | "start" | "send" | "close">);

  /** Starts the transport. */
  public start(): Promise<void>;

  /**
   * Sends a message to the client.
   * @param message The JSON-RPC message.
   * @returns Resolves once sent; rejects when the message isn't JSON-RPC, or the transport refuses it.
   */
  public send(message: JsonObject): Promise<void>;

  /** Closes the transport. */
  public close(): Promise<void>;
}

/**
 * Opens each turn's agent session of Noldova Desktop's tool registry, with no bindings.
 */
export declare class RuntimeToolSessions implements ITurnToolSessions {
  /** The tools a provider runs without asking the person, copied on construction. */
  public readonly approvedTools: readonly string[];
  /** The URL of TeamRun's MCP endpoint, or null without one. */
  public readonly endpoint: string | null;

  /**
   * Initializes the sessions.
   * @param tools The part's tool registry.
   * @param approvedTools The tools a provider runs without asking the person.
   * @param endpoint The URL of TeamRun's MCP endpoint; none by default.
   * @param windows The windows, which open a chat's Browser page, asked for by the chat itself; none by default.
   * @param timer Waits for a page the windows opened to show; Node's timers by default.
   * @param calls The served calls in flight, shared by every session it opens and the permission answerer; a set of its own by default.
   */
  public constructor(tools: IToolsContext, approvedTools: readonly string[], endpoint?: string | null,
    windows?: IWindowsService | null, timer?: ITimer, calls?: ServedCalls);

  /**
   * Opens a session, binding Terminal's tools to the chat's working folder, with no shared terminals and the chat as their owner, the Git modules'
   * tools to the same folder, and the Browser's tools to the chat's own page, in the chat's project's workspace, as the teammate.
   * @param scope The session's scope.
   * @param conversationId The chat whose turn the session serves.
   * @param workFolder The chat's working folder: its project's root or its own folder.
   * @param projectId The chat's project, or null outside projects.
   * @param agentName The teammate's name.
   * @param record Takes each Browser call's record for its step in the reply.
   * @returns The session.
   */
  public open(scope: string, conversationId: string, workFolder: string, projectId: string | null, agentName: string,
    record: (call: ToolCallRecord) => void): ITurnToolSession;
}

/**
 * One of the chat engine's methods, answered through its request dispatcher.
 */
export declare class DispatchedMethod implements IMethodHandler {
  /**
   * Initializes the method.
   * @param method TeamRun's name for the method.
   * @param dispatcher The chat engine's dispatcher.
   */
  public constructor(method: string, dispatcher: RequestDispatcher);

  /**
   * Answers a request with the dispatcher's payload.
   * @param context The request.
   * @returns The payload.
   * @throws MethodFailureException when the dispatcher fails the request: its code is the
   * dispatcher's error when Noldova Desktop has one of that name and `Internal` otherwise, and its
   * details hold the dispatcher's `error` and `arguments`.
   */
  public handleAsync(context: RequestContext): Promise<JsonValue>;

  /**
   * Describes an error the chat engine throws outside its dispatcher as the dispatcher would, and wraps it as `handleAsync` does.
   * @param error The error.
   * @returns The method failure to throw.
   */
  public static failureOf(error: unknown): MethodFailureException;
}

/**
 * Removes a deleted chat's pages through the Pages API when a `ConversationDeleted` event names it, logging a removal that fails for
 * Pages' sweep at the next start to finish; other events are left out.
 */
export declare class ChatPagesRemover implements IEventListener {
  /**
   * Initializes the remover.
   * @param pages Pages.
   * @param log The log.
   */
  public constructor(pages: Pick<Pages, "removeChatAsync">, log: ILog);

  /**
   * Starts removing the pages of the chat a `ConversationDeleted` event names, without waiting for it; a removal that fails is logged.
   * @param event The event.
   */
  public onEvent(event: Event): void;
}

/**
 * TeamRun's side of the Pages API: a call's chat and teammate come from its scope, `<chatId>/<teammateId>` or `<chatId>/default` for the
 * chat's own teammate, which authors with no id; its name and folder come from the session's bindings; a chat exists while TeamRun finds it.
 */
export declare class TeamRunPagesHost implements IPagesHost {
  /**
   * Initializes the host.
   * @param conversations The chats.
   */
  public constructor(conversations: Pick<IConversationsService, "findAsync">);

  /** @inheritdoc */
  public chatOf(call: ToolCall): string;

  /**
   * @inheritdoc
   * @throws JsonException when the session has no work folder.
   */
  public folderOf(call: ToolCall): string;

  /** @inheritdoc */
  public authorOf(call: ToolCall): PageAuthor;

  /** @inheritdoc */
  public hasChatAsync(chatId: string): Promise<boolean>;
}

/**
 * Closes a deleted chat's terminals, those Terminal keeps for the owner `teamrun.chat/<id>`, through Terminal's owners service, whether or not a
 * window is open to hear the delete.
 */
export declare class ChatTerminalsCloser implements IEventListener {
  /**
   * Initializes the closer.
   * @param owners Reads Terminal's owners service when a chat is deleted.
   * @param log Takes a line for a chat whose terminals could not be closed, such as when Terminal's service is missing or its close fails.
   */
  public constructor(owners: () => RuntimeTerminalOwners, log: ILog);

  /**
   * Closes the terminals of the chat a `ConversationDeleted` event names, without waiting; other events are left out.
   * @param event The event.
   */
  public onEvent(event: Event): void;
}

/**
 * Publishes the chat engine's events on the module's event channels.
 */
export declare class EventForwarder implements IEventListener {
  /**
   * Initializes the forwarder.
   * @param channels The channel for each of TeamRun's event names.
   */
  public constructor(channels: ReadonlyMap<string, EventChannel>);

  /**
   * Publishes the event's payload on its channel; an event without one is left out.
   * @param event The event.
   */
  public onEvent(event: Event): void;
}

/**
 * Reads the Title model setting.
 */
export declare class TitleModelSetting {
  /**
   * Makes a reader of the setting's current value.
   * @param settings The module's settings.
   * @returns A function giving the value: empty for the chat's own model, or the provider's id and the model's.
   */
  public static readerOf(settings: IModuleSettings): () => string;
}

/**
 * Reads `teamrun.idleCompaction`, whether a provider may compact an idle chat's live session before its prompt cache expires.
 */
export declare class IdleCompactionSetting {
  /**
   * Makes a reader of the setting's current value.
   * @param settings The module's settings.
   * @returns A function giving `false` only when the person turned the setting off, and `true` otherwise.
   */
  public static readerOf(settings: IModuleSettings): () => boolean;
}

/**
 * Reads the teammate hand-off limit, `teamrun.chainHopLimit`, for the chat engine.
 */
export declare class HopLimitSetting {
  /**
   * Returns a function that reads the limit each time it is called, so a change applies to the next hand-off; it gives 0, no hand-offs,
   * for a value that isn't a number.
   * @param settings The module's settings.
   */
  public static readerOf(settings: IModuleSettings): () => number;
}

/**
 * The chat engine's migrations and Pages', as the statements Noldova Desktop applies to the module's database.
 */
export declare class HostedMigrations {
  /**
   * Each migration of the chat engine's catalog, with its id in Noldova Desktop's form and its SQLite statements,
   * and each of `Pages.migrations`, all in the order of their ids.
   */
  public static readonly all: readonly Migration[];
}

/**
 * The method `teamrun.attachmentShare`: it shares the attachment the method it wraps finds, through Noldova Desktop's
 * `IRuntimeFiles.shareAsync`, with the page of the window part that asked, and answers only the share's grant, so neither the file's
 * path nor its bytes reach the window, which loads the file by the grant's address.
 */
export declare class FileShareMethod implements IMethodHandler {
  /**
   * Initializes the method.
   * @param method The method that answers the attachment, a `MessageAttachment` whose path is the file's real path.
   * @param context The runtime part's context, whose files share it; read at each request.
   */
  public constructor(method: IMethodHandler, context: Pick<IRuntimePartContext, "files">);

  /**
   * Shares the attachment the method answers with the asking page, as its own media type.
   * @param request The window part's request.
   * @returns An `AttachmentShare` with the share's grant.
   * @throws MethodFailureException whatever the method throws, and Noldova Desktop's refusals of the share as they are: `Unauthorized` outside
   * a request from a window's page, `InvalidParams` for a file outside the module's folders, `NotFound` for one that can't be read, and
   * `Conflict` when the window holds 256 live grants and shares.
   */
  public handleAsync(request: RequestContext): Promise<JsonValue>;
}

/**
 * The method `teamrun.attachmentPrepare`: for an input by grant, it redeems the grant through Noldova Desktop's `IRuntimeFiles.redeemAsync`
 * in the request that brings it, so only a file the person gave the asking page is read, and has the chat engine copy the open file into
 * transient storage; no bytes or path reach it from the window. Every other input goes to the method it wraps.
 */
export declare class GrantedAttachmentMethod implements IMethodHandler {
  /**
   * Initializes the method.
   * @param method The method that prepares an input by its bytes or saved path.
   * @param context The runtime part's context, whose files redeem the grant; read at each request.
   * @param engine The chat engine, which copies the granted file.
   */
  public constructor(method: IMethodHandler, context: Pick<IRuntimePartContext, "files">, engine: Pick<IConversationEngine, "prepareOpenedAttachmentAsync">);

  /**
   * Prepares the input the request carries.
   * @param request The window part's request, an `AttachmentInput`.
   * @returns The prepared `MessageAttachment`.
   * @throws MethodFailureException `InvalidParams` with "The file's grant is unknown, already used or expired." when Noldova Desktop refuses
   * the grant, and the chat engine's refusals of the copy as the dispatcher would give them; the granted file is closed either way.
   */
  public handleAsync(request: RequestContext): Promise<JsonValue>;
}

/**
 * A method that sends a message, whose requested mode a client other than the app's main process can't raise: before the method sees the request, Core
 * refuses a mode that is neither the chat's chosen responder's mode nor the default teammate's, as `Unauthorized`.
 */
export declare class RequestedModeMethod implements IMethodHandler {
  /**
   * Initializes the method.
   * @param method The method that sends the message.
   * @param engine The engine that checks the requested mode.
   * @param read Reads the message from the request's payload; a payload it can't read goes on unchecked, and is refused there.
   * @param outside Answers a client other than the main process in the method's place, such as by marking a waiting message it adds as from
   * outside; by default, the method answers every client.
   */
  public constructor(method: IMethodHandler, engine: Pick<IConversationEngine, "refuseRaisedModeAsync">, read: (payload: JsonValue) => MessageSendParams,
    outside?: ((payload: JsonValue) => Promise<JsonValue>) | null);

  /**
   * Answers the request through the method at once for the main process, or once its requested mode passes through `outside` when given,
   * else the method.
   * @param request The request.
   * @returns The answer.
   * @throws MethodFailureException `Unauthorized` when Core refuses the mode, or the failure of `outside`.
   */
  public handleAsync(request: RequestContext): Promise<JsonValue>;
}

/**
 * A method only the app's main process may call, the client `ShellClients.mainProcess` that speaks for TeamRun's
 * window, so only the person answers through it: the command line, a module's own entry, and so a program a
 * teammate runs, can't. What the client's name proves on each platform is Noldova Desktop's, in its `RUNTIME.md`.
 */
export declare class MainProcessMethod implements IMethodHandler {
  /**
   * Initializes the method.
   * @param method The method that answers the main process's requests.
   * @param field The payload field that limits the method to the main process only when a request sets it, or `null` to limit every request.
   */
  public constructor(method: IMethodHandler, field?: string | null);

  /**
   * Answers a request of the main process through the method.
   * @param request The request.
   * @returns The method's payload.
   * @throws MethodFailureException `Unauthorized`, with `Resources.mainProcessOnly` and the details
   * `{ error: "Unauthorized", arguments: [] }`, for a request from any other client, which the method never sees;
   * otherwise whatever the method throws.
   */
  public handleAsync(request: RequestContext): Promise<JsonValue>;
}

/**
 * The chat engine's SQL connection over the module's database.
 * It turns on foreign keys, which the chat engine's schema relies on, and runs its work through a `ModuleDatabaseSession`.
 */
export declare class ModuleDatabaseConnection extends SqlConnection {
  /**
   * Initializes the connection and turns on foreign keys.
   * @param dataSource The data source it names.
   * @param database The module's database.
   */
  public constructor(dataSource: DataSource, database: IModuleDatabase);

  /**
   * The SQLite dialect.
   */
  public override get dialect(): SqlDialect;
}

/**
 * The SQL session over the module's database that a `ModuleDatabaseConnection` runs its statements in.
 */
export declare class ModuleDatabaseSession extends SqlSession {
  /**
   * Initializes the session.
   * @param database The module's database.
   */
  public constructor(database: IModuleDatabase);

  /**
   * Whether the session is open; closing leaves the database to its host.
   */
  public override get isOpen(): boolean;

  /**
   * Runs a statement.
   * @param query The statement.
   * @returns How many rows it changed.
   */
  public override executeAsync(query: SqlQuery): Promise<number>;

  /**
   * Runs an insert.
   * @param query The statement.
   * @returns The inserted row's id.
   */
  public override insertAsync(query: SqlQuery): Promise<number>;

  /**
   * Reads rows.
   * @param query The statement.
   * @returns The rows.
   * @throws DataException when a value is not text, a number or null.
   */
  public override queryAsync(query: SqlQuery): Promise<readonly DataRecord[]>;

  /**
   * Closes the session, not the database.
   */
  public override closeAsync(): Promise<void>;
}

/**
 * The chat engine's data provider over the module's database.
 */
export declare class ModuleDatabaseProvider extends SqlProvider {
  /**
   * Initializes the provider.
   * @param database The module's database.
   */
  public constructor(database: IModuleDatabase);

  /**
   * Opens a connection over the module's database.
   * @param dataSource The data source it names.
   * @returns The connection.
   */
  public override openConnection(dataSource: DataSource): ModuleDatabaseConnection;
}

/**
 * The served tool calls in flight across a part's turn sessions, by the id each call passes to the registry as its `callId`, so a
 * permission request can name the call that asked it.
 */
export declare class ServedCalls {
  /**
   * Opens a call.
   * @param tool The tool's served name.
   * @param input The call's input.
   * @returns The call's new id.
   */
  public open(tool: string, input: JsonObject): string;

  /**
   * Closes a call; closing one that isn't open does nothing.
   * @param id The call's id.
   */
  public close(id: string): void;

  /**
   * Finds an open call.
   * @param id The call's id, or `null`.
   * @returns The call's tool and input, or `null` for no id or one that isn't open.
   */
  public find(id: string | null): { readonly tool: string; readonly input: JsonObject } | null;
}

/**
 * TeamRun's answerer of Noldova Desktop's permission requests, as the app's permissions module: it asks the person on the reply
 * whose turn opened the request's session, with the request's Allow once and Deny, and the module's own labels for Allow always and
 * Take over when the request offers them, such as the Browser's `Allow for this chat` and `I'll type it myself`. Computer use's grants of
 * the screen, `computer-use.controlScreen`, and of one app, `computer-use.controlApp`, are the exceptions when they offer Allow always:
 * each is asked with Allow in this chat, and an allowing is answered `AllowedAlways`, which the base remembers for the chat's scope.
 */
export declare class PermissionAnswerer implements IPermissionAnswerer {
  /**
   * Initializes the answerer.
   * @param asker What asks the person on a running reply: the chat engine.
   * @param calls The served calls in flight, shared with the tool sessions, which name the call a request's `callId` is for; a set of
   * its own by default.
   */
  public constructor(asker: IPermissionAsker, calls?: ServedCalls);

  /**
   * Answers one request: `Denied` at once when it doesn't offer Allow once and isn't computer use's grant of the screen or of one
   * app offering Allow always; otherwise a `Permission` approval on the reply, whose payload holds the module, the subject, the risk
   * and the details, a secret's value left out, and the served call that asked, by its tool and input, when the request's `callId`
   * names a call still in flight in `calls` (a request without one, from a Desktop that doesn't name a question's call, names none),
   * and the decision of the person's answer: `AllowedAlways` for such a grant's allowing
   * or the module's allow-always label, `TakenOver` for its take-over label, `AllowedOnce` for Allow once, and `Denied` otherwise.
   * @param question The request, with its module, session and scope.
   * @param signal Aborts when the answer is no longer wanted, which withdraws the approval.
   * @returns `AllowedOnce`, `AllowedAlways`, `TakenOver` or `Denied`.
   */
  public answerAsync(question: PermissionQuestion, signal: AbortSignal): Promise<PermissionDecision>;
}

/**
 * Names the apps of computer use's grants through computer use's apps service, with each icon's PNG as base64.
 */
export declare class RuntimeAppDescriptions implements IAppDescriptions {
  /**
   * Initializes the descriptions.
   * @param find Finds computer use's apps service for each description; `null` while computer use isn't active or has none.
   */
  public constructor(find: () => IComputerUseApps | null);

  /**
   * Tells whether a service found under `computer-use.apps` has the apps service's shape.
   * @param service The service.
   * @returns `true` when it has a `describeAsync` method.
   */
  public static isApps(service: object): service is IComputerUseApps;

  /**
   * Describes an app.
   * @param app The app's identity, as its grant names it.
   * @param signal Aborts the description; by default none.
   * @returns The app's name and its icon's PNG as base64, `null` when it has none; `null` when computer use doesn't describe the app or
   * its apps service isn't found.
   */
  public describeAsync(app: string, signal?: AbortSignal): Promise<AppLook | null>;
}

/**
 * Computer use's grants that Noldova Desktop's permission center remembers allowed always, of one app, `computer-use.controlApp`, or of the
 * screen, `computer-use.controlScreen`, read and revoked through the center; TeamRun keeps no copy of them. Only the app's permissions
 * module may call it.
 */
export declare class RuntimeRememberedAppGrants implements IRememberedAppGrants {
  /**
   * Initializes the grants.
   * @param permissions The part's access to the permission center.
   */
  public constructor(permissions: IPermissionsContext);

  /**
   * Lists the remembered grants, each with its app, `null` for the screen, and the tool scope it was given for.
   * @throws PermissionAccessException when the module isn't the app's permissions module, or Noldova Desktop's database isn't open.
   */
  public list(): readonly RememberedAppGrant[];

  /**
   * Revokes a remembered grant through the center, so computer use refuses the chat's next input to the app without asking, or asks for
   * the screen again at the chat's next session.
   * @returns `false` when the center holds no grant with the id.
   */
  public revoke(id: string): boolean;
}

/**
 * Builds Codex, Claude, Grok, GitHub Copilot and Antigravity with the programs it finds.
 */
export declare class ProviderKindRegistryFactory implements IProviderKindRegistryFactory {
  /**
   * Initializes the factory.
   * @param baseEnvironment The environment the providers clean for their programs.
   * @param locator Finds the providers' programs.
   */
  public constructor(baseEnvironment: NodeJS.ProcessEnv, locator: ExecutableLocator);

  /**
   * The factory for this process's environment and programs.
   * @returns The factory.
   */
  public static fromProcess(): ProviderKindRegistryFactory;

  /**
   * Builds Codex, Claude, Grok, GitHub Copilot and Antigravity, in that order, each with its program or none.
   * @param productVersion The app's version.
   * @param dataDirectory The folder Grok's and Antigravity's default profiles live under, with Copilot's work folder and the Antigravity server TeamRun installs.
   * @param starter Starts the providers' programs.
   * @param log Where GitHub Copilot writes a model listing that failed; none by default.
   * @returns The registry.
   */
  public create(productVersion: string, dataDirectory: string, starter: IProcessStarter, log?: ILog | null): ProviderKindRegistry;

  /**
   * The ACP agents' catalog: the registry's list and icons kept under the app's folder, and each agent installed there per version.
   */
  public createAcpCatalog(productVersion: string, dataDirectory: string, starter: IProcessStarter, secrets: ISharedMcpSecrets, log?: ILog | null): IAcpAgentCatalog;
}

/**
 * Posts `teamrun.replyFailed` for a reply that failed while no window showed its chat, keyed by the chat, titled by the
 * teammate, with the reply's last error as its text and Open chat; it goes once any window shows the chat or the chat is
 * deleted. The runtime part owns it, so every window sees one notice, and Core's windows say which chats are on screen.
 */
export declare class ReplyFailureNotices implements IEventListener, Disposable {
  /**
   * Initializes the notices and starts following the shown chats.
   * @param context The part's context, which posts the notices and logs one it refuses.
   * @param windows Core's windows, which tell whether a window shows a chat and when one does.
   */
  public constructor(context: Pick<IRuntimePartContext, "moduleId" | "postNotification" | "log">, windows: Pick<IWindowsService, "isShown" | "onShown">);

  /**
   * Posts a provider's reply that `MessageUpdated` reports failed, unless a window shows its chat, and dismisses a deleted
   * chat's notice; a refused post goes to the log by its failure's kind.
   * @param event Core's event.
   */
  public onEvent(event: Event): void;

  /**
   * Stops following the shown chats and dismisses the notices still up.
   */
  public [Symbol.dispose](): void;
}

/**
 * Holds back a quit while the chat engine runs a reply.
 */
export declare class ReplyWork implements IEventListener, Disposable {
  /**
   * Initializes the work.
   * @param context The part's context, which begins the work.
   * @param engine The chat engine, whose running replies it counts and waits for.
   */
  public constructor(context: IRuntimePartContext, engine: Pick<ConversationEngine, "activeRunCount" | "waitForIdle">);

  /**
   * Begins the work when a reply runs, and ends it when none does. Once begun, the work also ends when the engine's
   * replies have all ended, completed, failed or stopped, without waiting for another event.
   */
  public onEvent(): void;

  /**
   * Ends the work.
   */
  public [Symbol.dispose](): void;
}

/**
 * The folder of the command teammates' turns run to reach other chats: the runtime's own program in Node mode, with the command
 * line's entry and the runtime's data directory, so it reaches this runtime in a development app and an installed one alike.
 * It holds a `sh` script named after the product's slug, which Bash and other POSIX shells run, and on Windows a `.cmd` beside
 * it, which PowerShell and `cmd.exe` run; the turn's `PATH` leads with the folder.
 * The `.cmd` holds only ASCII, since `cmd.exe` reads it in the console's code page: it reads the program, the entry and the data
 * directory from the turn's `TEAMRUN_COMMAND_PROGRAM`, `TEAMRUN_COMMAND_ENTRY` and `TEAMRUN_COMMAND_DATA_DIR`, and refuses without them.
 * Both clear `CHROME_CRASHPAD_PIPE_NAME`, so the program in Node mode doesn't open the app's crash handler pipe, which a sandboxed shell
 * can't, and write the failure into a `debug.log` in the turn's folder.
 */
export declare class TeammateCommandFolder {
  /**
   * Initializes the folder's writer.
   * @param program The runtime's program, which runs the command line in Node mode.
   * @param entry The command line's entry script.
   * @param platform The platform the commands run on, such as `win32`.
   * @param environment The environment TeamRun started with, whose `PATH` the command `writeAsync` returns extends; on Windows its
   * own spelling of the name, such as `Path`, is kept.
   */
  public constructor(program: string, entry: string, platform: string, environment: Readonly<Record<string, string | undefined>>);

  /**
   * The writer for this process: its program, Noldova Desktop's command line entry, its platform and its environment.
   */
  public static fromProcess(): TeammateCommandFolder;

  /**
   * Writes the folder, `command` in the module's folder, replacing what an earlier start wrote.
   * @param moduleFolder The module's folder, `modules/<id>` in the data directory.
   * @param productSlug The product's slug, the command's name.
   * @param moduleId The module's id.
   * @returns A promise of the command: its words, such as `teamrun teamrun`, and the turn's `PATH`.
   * @throws Error Rejected when the folder or a file can't be written.
   */
  public writeAsync(moduleFolder: string, productSlug: string, moduleId: string): Promise<TeammateCommand>;

  /**
   * Gives the command the folder runs, without writing it, for a turn whose provider starts with the environment.
   * @param moduleFolder The module's folder, `modules/<id>` in the data directory.
   * @param productSlug The product's slug, the command's name.
   * @param moduleId The module's id.
   * @param environment The environment the turn's provider starts with, whose `PATH` the turn's extends; on Windows its own spelling
   * of the name, such as `Path`, is kept.
   * @returns The command: its words, such as `teamrun teamrun`, and the turn's `PATH`.
   */
  public commandOf(moduleFolder: string, productSlug: string, moduleId: string, environment: Readonly<Record<string, string | undefined>>): TeammateCommand;
}

/**
 * TeamRun's runtime part: the chat engine and its providers, its database through the module's
 * context, its methods and its events, each named `<id>.<name>`.
 */
export declare class RuntimePart implements IRuntimePart {
  /**
   * The chat engine's migrations.
   */
  public readonly migrations: readonly Migration[];

  /**
   * Initializes the part; it only sets fields.
   * @param registries Builds the providers; by default from this process's environment and programs.
   * @param productVersion The app's version; by default the runtime's build's.
   * @param commands Writes, as the part activates, the command teammates' instructions name; by default for this process's program.
   * When it can't be written, the part writes a line to its log, and teammates' instructions leave out the note on other chats.
   * @param endpoints Makes, as the part activates, TeamRun's MCP endpoint with the part's log; by default one on its own HTTP server.
   * When it can't listen, the part writes a line to its log and goes on without it, and every teammate's turn fails,
   * saying so.
   */
  public constructor(registries?: IProviderKindRegistryFactory, productVersion?: string | null, commands?: TeammateCommandFolder,
    endpoints?: (log: ILog) => McpHttpEndpoint);

  /**
   * Composes the chat engine over the module's database, with the hand-off limit `HopLimitSetting` reads at each hand-off,
   * finishes the replies a stopped runtime left running, and registers its methods and events, and `TeamRunTools`' tools in
   * Noldova Desktop's tool registry, each running its command-line command in this process. Each teammate's turn opens its own agent
   * session of the registry, which every provider reaches through TeamRun's MCP endpoint.
   * `teamrun.approvalDecide` answers only the app's main process, through `MainProcessMethod`. It registers `PermissionAnswerer` as the
   * app's answerer of permission requests, and answers `ComputerUseGrantList` and `ComputerUseGrantRevoke` through
   * `RuntimeRememberedAppGrants`; when Noldova Desktop refuses it, because the app names another permissions module, the part logs
   * `Resources.answererNotRegistered`, answers none and fails those two methods as `UnknownMethod`.
   * @param context The part's context.
   * @throws RuntimePartException when the part is already active; any other failure undoes the
   * activation and reaches the caller.
   */
  public activateAsync(context: IRuntimePartContext): Promise<void>;

  /**
   * Removes the answerer of permission requests first, so Noldova Desktop denies those still waiting, then waits for the rewinds
   * and the moves still running, so none fails on a closed connection after it has restored or copied files, then ends the
   * replies and the providers' programs, and closes the connection. A rewind, a move, an install and a sign-in each hold a work
   * item while their request runs, so Noldova Desktop asks the person before quitting during one.
   * @throws RuntimePartException when a provider did not stop.
   */
  public deactivateAsync(): Promise<void>;
}

/**
 * Starts a turn's background commands in the person's current environment, which the process starter's `readEnvironmentAsync`
 * reads, through the shell it names, `ComSpec` or `cmd.exe` with `/d /s /c` and the command in quotes, as verbatim arguments,
 * on Windows and `SHELL` or `/bin/sh` with `-c` elsewhere, with a process starter, which under TeamRun is the `RuntimeProcessStarter`, whose stop ends
 * the command and what it started.
 */
export declare class RuntimeCommandStarter implements ICommandStarter {
  /**
   * Initializes the starter.
   * @param starter Starts the shell.
   * @param environment The runtime's own environment, which the starter's `readEnvironmentAsync` is given; `process.env` by default.
   * @param platform The platform whose shell is used; `process.platform` by default.
   */
  public constructor(starter: IProcessStarter, environment?: NodeJS.ProcessEnv, platform?: string);

  /**
   * Refuses a command with a line break on Windows, since `cmd.exe /c` runs only its first line.
   * @param command The command line.
   * @returns `Resources.windowsCommandLineBreak` for such a command, else null.
   */
  public refusalOf(command: string): string | null;

  /**
   * Starts the command.
   * @param command The command line.
   * @param directory The folder it runs in.
   * @param output Receives its output and errors as text as they come.
   * @returns The running command, whose `exited` gives its exit code and signal once its output is read, or the error of the
   * environment's read or of the start; a stop before the environment is read starts nothing.
   */
  public start(command: string, directory: string, output: (text: string) => void): IRunningCommand;
}

/**
 * Starts the providers' programs through Noldova Desktop Runtime, which owns and ends them; a start Runtime refuses
 * emits `error`, then `exit` and `close` with no exit code.
 */
export declare class RuntimeProcessStarter implements IProcessStarter {
  /**
   * Initializes the starter.
   * @param context The part's context.
   * @param workFolder The working folder of a program that names none.
   */
  public constructor(context: IRuntimePartContext, workFolder: string);

  /**
   * Starts the program with the environment's variables as the request's own.
   * @param command How to run the program.
   * @param environment The program's environment; unset variables, names Noldova Desktop refuses and `Resources.crashPipeVariable` are left out, so a provider's Electron tools don't open the app's crash handler pipe.
   * @param directory The program's working folder, or `null` for the work folder.
   * @returns The process.
   */
  public start(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string | null): StartedProcess;

  /**
   * Reads the person's current environment from Noldova Desktop, as `IRuntimePartContext.readEnvironmentAsync` gives it, in place of the one
   * TeamRun started with, so a provider started now sees a tool installed or a variable set since, and on macOS what the login shell
   * exports.
   * @param _own The environment TeamRun started with, which Noldova Desktop's takes the place of.
   * @returns A promise of a copy of the environment, which never rejects.
   */
  public readEnvironmentAsync(_own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv>;
}

/**
 * The `teamrun.windowFocused` method, which also keeps which Noldova Desktop window and connection each TeamRun window
 * reported from, so Core forgets a TeamRun window once its Noldova Desktop window or connection closes, or once its
 * page is replaced, as on a reload, by a page that reports another TeamRun window from the same window.
 */
export declare class WindowClients implements IMethodHandler {
  /**
   * Initializes the method.
   * @param method The method that answers the window reports.
   * @param windows The windows Core knows, which it tells of each TeamRun window that is gone.
   */
  public constructor(method: IMethodHandler, windows: Pick<IWindowsService, "close">);

  /**
   * Answers a window report through the method, then keeps the window's client and tells `windows` that any other
   * TeamRun window that reported from that same client is gone.
   * @param request The request, whose payload is a `WindowFocusedParams`.
   * @returns The method's payload.
   * @throws Whatever the method throws, before the client is kept.
   */
  public handleAsync(request: RequestContext): Promise<JsonValue>;

  /**
   * Tells `windows` that each TeamRun window that reported from the closed window, or from any window of a closed
   * connection, is gone.
   * @param closure The window or connection that closed, as `IRuntimePartContext.onClientClosed` reports it.
   */
  public close(closure: ClientClosure): void;
}

/**
 * A method whose requests each hold a work item while they run, so Noldova Desktop asks the
 * person before quitting during one.
 */
export declare class WorkingMethod implements IMethodHandler {
  /**
   * Initializes the method.
   * @param method The method that answers the requests.
   * @param context Where the work items begin.
   * @param description The work item's text, as the person reads it.
   */
  public constructor(method: IMethodHandler, context: Pick<IRuntimePartContext, "beginWork">, description: string);

  /**
   * Answers a request through the method, holding a work item until it ends.
   * @param request The request.
   * @returns The method's payload.
   * @throws MethodFailureException `Unavailable` once the method is closed, starting no work.
   * @throws Whatever the method throws, once the work item has ended.
   */
  public handleAsync(request: RequestContext): Promise<JsonValue>;

  /**
   * Closes the method, so it refuses every later request as `Unavailable`; the requests already running go on.
   */
  public close(): void;

  /**
   * Waits for the requests still running to end.
   * @returns A promise that resolves once every request running now has ended, whether it
   * succeeded or failed.
   */
  public whenIdle(): Promise<void>;
}

/**
 * What Pages asks of the app it runs in: whose chat a call is for, where that chat's files are, who is calling, and which chats
 * still exist. Pages takes nothing else from the app.
 */
export interface IPagesHost {
  /**
   * The chat a call is for.
   * @param call The call.
   * @returns The chat's id.
   */
  chatOf(call: ToolCall): string;

  /**
   * The folder whose files a call may show as pages.
   * @param call The call.
   * @returns The folder's path.
   * @throws Error when the call's chat has no folder.
   */
  folderOf(call: ToolCall): string;

  /**
   * Who is calling, recorded as a page's author.
   * @param call The call.
   * @returns The author.
   */
  authorOf(call: ToolCall): PageAuthor;

  /**
   * Whether a chat still exists; Pages removes the pages of one that doesn't when it sweeps.
   * @param chatId The chat's id.
   * @returns `true` while the chat exists.
   */
  hasChatAsync(chatId: string): Promise<boolean>;
}

/**
 * The waits Pages' ping takes between its rounds, so a test can run them on its own clock.
 */
export interface IPagesClock {
  /**
   * Waits the given time.
   * @param milliseconds How long to wait.
   * @param signal Ends the wait early, rejecting it.
   */
  delayAsync(milliseconds: number, signal: AbortSignal): Promise<void>;
}

/**
 * Pages, the part that lets a teammate show a page it wrote, behind the small API an app uses: its migrations, its tools, and a chat's
 * removal. It takes a connection to the app's database, data folder, log and an `IPagesHost`, and nothing else of the app, so that it can
 * move to its own module. Showing reads an HTML file of the chat's folder, links resolved, of at most 5 MB as read and as text; showing
 * again with a page's id needs the version last read and is refused `Stale` when the page changed since, as editing is; each change
 * checks the version and writes the next one in one transaction, so of two changes from the same version one is refused. Titles are 1 to 120
 * characters, and each change keeps the page's last 50 versions and writes its current HTML to `pages/<chatId>/<pageId>.html` under the
 * data folder.
 */
export declare class Pages {
  /**
   * Pages' migrations, for the app to apply to its database among its own, by id.
   */
  public static readonly migrations: readonly Migration[];

  /**
   * The page tools, then the canvas tools: showing, editing and each canvas change write only the chat's own pages and canvases and are of
   * low risk; listing and reading are read-only. Each page tool names `teamrun_list_pages` for where things stand, and each canvas tool
   * `teamrun_canvas_read`.
   */
  public static readonly tools: readonly IToolDescriptor[];

  /**
   * Initializes Pages.
   * @param connection The connection to the database that holds Pages' tables, shared with the app's own work on it.
   * @param dataDirectory The data folder for the pages' saved copies.
   * @param host What Pages asks of the app.
   * @param log Where a sweep that can't list the chats, or a chat it can't sweep, is logged, and what serving the window can't do.
   * @param server The HTTP server the page server listens with; a new one by default.
   */
  public constructor(connection: SqlConnection, dataDirectory: string, host: IPagesHost, log: IModuleLog, server?: Server);

  /**
   * Registers the page tools, each answering with the page as JSON, the chat's pages under `pages` and its canvases under `canvases`, or, for reading, the `page`, the
   * `version` read, its `editedBy`, its `html` and `htmlTrust: "untrusted"`; and the canvas tools, each answering with the `canvas`, its
   * `version` and its `manifest`, or, for an artboard's change, the `canvas`, the `artboard` and its `page`. A refusal ends the call
   * `Refused`, `Stale` or `TooLarge`, and anything else as `OutcomeUncertain`.
   * @param moduleId The module's id, which marks each answer's origin.
   * @param tools Where to register them.
   */
  public register(moduleId: string, tools: Pick<IToolsContext, "register">): void;

  /**
   * Serves the window: declares the page events, sending `pageShown` when a tool shows a page, `pageUpdated` when an edit or a
   * restore makes its next version and `pageStopped` when an open view of it misses its ping; registers the page methods, each taking a
   * `PageRequest`, `pageOpen` answering a `PageView`, `pageRead` a version's HTML and `pageRestore` the page; starts the page server
   * on the loopback address; and pings each open `<moduleId>.page` view every 5 seconds with a 3-second timeout. A server that can't
   * listen is logged, and the methods then answer `Unavailable`; an event that can't be sent is logged.
   * @param context The runtime part's context, whose web views are read only when a method or the ping needs them.
   * @param clock The clock the ping waits on.
   */
  public serveAsync(context: Pick<IRuntimePartContext, "moduleId" | "webViews" | "registerMethod" | "declareEvent">, clock: IPagesClock): Promise<void>;

  /**
   * Stops the ping and closes the page server.
   */
  public closeAsync(): Promise<void>;

  /**
   * Removes a chat's pages, their versions and their copies.
   * @param chatId The chat's id.
   */
  public removeChatAsync(chatId: string): Promise<void>;

  /**
   * Removes the pages of every chat the host no longer has, such as one deleted while Pages couldn't hear it; a chat it can't sweep is
   * logged with the failure's kind, and the rest are still swept; a listing of the chats that fails is logged and ends the sweep.
   */
  public sweepAsync(): Promise<void>;
}
