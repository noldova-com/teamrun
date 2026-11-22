/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Exception } from "@noldova/context.exceptions";
import type { JsonObject, JsonReader, JsonValue } from "@noldova/context.json";
import type { ServiceResponse, ServiceResponseInfo, ServiceResponseStatus } from "@noldova/teamrun.services";

/**
 * What answers TeamRun's MCP server: the tools of one member's running turn.
 */
export interface IMcpToolHost {
  /**
   * Lists the tools.
   * @param signal Aborts the listing when the client cancels it.
   * @returns MCP tool objects, each with its `name`, `description`, `inputSchema` and annotations.
   */
  listToolsAsync(signal: AbortSignal): Promise<readonly JsonObject[]>;
  /**
   * Calls a tool.
   * @param name The tool's name.
   * @param input The call's arguments.
   * @param signal Withdraws the call when the client cancels it.
   * @returns The MCP `tools/call` result, which is `isError` when the tool failed.
   */
  callToolAsync(name: string, input: JsonObject, signal: AbortSignal): Promise<JsonObject>;
}

/**
 * Carries an MCP server's JSON-RPC messages, in the shape of the MCP TypeScript SDK's `Transport`, so the SDK's streamable
 * HTTP transport, which TeamRun's MCP endpoint serves through, fits it.
 */
export interface IMcpTransport {
  /** Set by the server: hears each message the client sends, already parsed. */
  onmessage?: ((message: unknown) => void) | undefined;
  /** Set by the server: hears the transport's close. */
  onclose?: (() => void) | undefined;
  /** Starts carrying messages. */
  start(): Promise<void>;
  /** Sends a message to the client. */
  send(message: JsonObject): Promise<void>;
  /** Closes the transport. */
  close(): Promise<void>;
}

/**
 * Dispatches validated local requests into one process's supported operations.
 */
export interface IRequestDispatcher {
  /**
   * Handles a request, including unsupported-method and application failures.
   * @param request Validated request.
   * @returns The correlated success or failure response.
   */
  dispatch(request: Request): Promise<Response>;
}

/**
 * The fields a teammate update changes; a field left out keeps the teammate's own value, and a field given as `null` clears it.
 */
export interface ITeammateChanges {
  readonly name?: string;
  readonly role?: string | null;
  readonly providerId?: string;
  readonly harness?: Harness;
  readonly model?: string | null;
  readonly effort?: string | null;
  readonly speed?: string | null;
  readonly mode?: string | null;
  readonly contextWindow?: number | null;
  readonly usageHandOffs?: readonly string[];
  readonly sustain?: boolean;
  readonly fallbacks?: readonly TeammateFallback[];
  readonly resetsSoonestFirst?: boolean;
}

/**
 * Reads a typed payload from its JSON value: a model's `fromJson`, or a function over a primitive.
 * The path, `$.payload`, is reported by the `JsonException` the reader throws.
 */
export declare type PayloadReader<T> = (value: JsonValue, path: string) => T;

/**
 * Writes a typed payload as JSON: a model's `toJson`, or a function over a primitive.
 */
export declare type PayloadWriter<T> = (value: T) => JsonValue;

/**
 * Discriminator carried by every wire message in its `kind` field.
 */
export declare enum WireMessageKind {
  /**
   * The first message on a connection, sent by the client.
   */
  Hello = "Hello",
  /**
   * A call from a client to the runtime.
   */
  Request = "Request",
  /**
   * The answer to a request, its result or its failure, or a connection-level answer.
   */
  Response = "Response",
  /**
   * A notification pushed by the runtime.
   */
  Event = "Event"
}

/**
 * Classification of a protocol error, stable across versions so clients can act on it.
 */
export declare enum ErrorCode {
  /**
   * The request's parameters did not satisfy the method's contract.
   */
  InvalidParams = "InvalidParams",
  /**
   * The runtime has no method of the requested name.
   */
  UnknownMethod = "UnknownMethod",
  /**
   * The referenced entity does not exist.
   */
  NotFound = "NotFound",
  /**
   * The request conflicts with the current state, such as starting a run on a busy task.
   */
  Conflict = "Conflict",
  /**
   * The hello carried a missing or wrong capability token.
   */
  Unauthorized = "Unauthorized",
  /**
   * The client's protocol version cannot be served by this runtime.
   */
  VersionMismatch = "VersionMismatch",
  /**
   * A provider failed; the message carries the provider's own explanation.
   */
  ProviderError = "ProviderError",
  /**
   * The runtime cannot serve the request now, for example while stopping.
   */
  Unavailable = "Unavailable",
  /**
   * The answer would exceed what one protocol frame carries, such as an attachment too large to read back.
   */
  TooLarge = "TooLarge",
  /**
   * An unexpected failure inside the runtime.
   */
  Internal = "Internal"
}

/**
 * What a provider asks permission for.
 */
export declare enum ApprovalKind {
  /**
   * Running a shell command.
   */
  Command = "Command",
  /**
   * Writing to files in the workspace.
   */
  FileChange = "FileChange",
  /**
   * Using a tool the provider gates behind a permission, such as a web fetch.
   */
  Tool = "Tool",
  /**
   * Questions for the person, answered with the chosen options or their own text.
   */
  Question = "Question",
  /**
   * A Noldova Desktop permission request from a call of a tool in the reply's turn, such as TeamRun's own
   * `teamrun_delete_chat`: its action, subject, risk and details are in the payload.
   */
  Permission = "Permission"
}

/**
 * What choosing an approval option means for the provider's request.
 */
export declare enum ApprovalOutcome {
  /**
   * The request is granted, for as long as the option's scope says.
   */
  Approved = "Approved",
  /**
   * The request is refused.
   */
  Denied = "Denied"
}

/**
 * How much a Noldova Desktop permission request risks, as the module that raised it says; the values are Noldova Desktop's.
 */
export declare enum PermissionRisk {
  /**
   * Little or nothing is lost if the action is wrong.
   */
  Low = "Low",
  /**
   * The action changes something the person can put back.
   */
  Medium = "Medium",
  /**
   * The action deletes or changes something the person can't easily put back.
   */
  High = "High"
}

/**
 * How the window shows one detail of a permission request; the values are Noldova Desktop's.
 */
export declare enum PermissionDetailKind {
  /**
   * Plain text.
   */
  Text = "Text",
  /**
   * Code or a path, shown in a fixed-width font.
   */
  Code = "Code",
  /**
   * A secret, shown hidden; its value is never kept.
   */
  Secret = "Secret",
  /**
   * Words the agent wrote, shown as such.
   */
  AgentText = "AgentText"
}

/**
 * How long the answer an approval option gives lasts, as the provider defines it.
 */
export declare enum ApprovalScope {
  /**
   * Only this request.
   */
  Once = "Once",
  /**
   * This request and the same kind of request for the rest of the provider's session.
   */
  Session = "Session",
  /**
   * This request and the same kind of request from now on, beyond the session.
   */
  Always = "Always"
}

/**
 * Where an approval request stands.
 */
export declare enum ApprovalStatus {
  /**
   * Waiting for the user's decision.
   */
  Pending = "Pending",
  /**
   * The user allowed it.
   */
  Approved = "Approved",
  /**
   * The user refused it.
   */
  Denied = "Denied",
  /**
   * The reply ended before a decision was made.
   */
  Cancelled = "Cancelled"
}

/**
 * Where a step of an agent's plan stands.
 */
export declare enum PlanStepStatus {
  /**
   * Not started.
   */
  Pending = "Pending",
  /**
   * The step the agent is working on.
   */
  InProgress = "InProgress",
  /**
   * Done.
   */
  Completed = "Completed"
}

/**
 * A plan window a provider reports usage for, named as the provider names it; TeamRun never maps one provider's window onto another's.
 */
export declare enum PlanWindowName {
  /**
   * The rolling 5-hour window, from Claude's `five_hour` or a Codex window of 300 minutes.
   */
  FiveHour = "FiveHour",
  /**
   * The weekly window, from Claude's `seven_day` or a Codex window of 10080 minutes.
   */
  Weekly = "Weekly",
  /**
   * Claude's weekly window for Opus models, `seven_day_opus`.
   */
  WeeklyOpus = "WeeklyOpus",
  /**
   * Claude's weekly window for Sonnet models, `seven_day_sonnet`.
   */
  WeeklySonnet = "WeeklySonnet",
  /**
   * GitHub Copilot's monthly premium requests, `premium_interactions`.
   */
  MonthlyPremiumRequests = "MonthlyPremiumRequests",
  /**
   * GitHub Copilot's monthly chat requests, `chat`.
   */
  MonthlyChatRequests = "MonthlyChatRequests",
  /**
   * GitHub Copilot's monthly code completions, `completions`.
   */
  MonthlyCompletions = "MonthlyCompletions",
  /**
   * Grok's credits in a weekly billing period.
   */
  WeeklyCredits = "WeeklyCredits",
  /**
   * Grok's credits in a monthly billing period, or GitHub Copilot's AI credits, a budget in `ai_credits`.
   */
  MonthlyCredits = "MonthlyCredits",
  /**
   * Codex's credits, a balance with no period, `credits`.
   */
  Credits = "Credits",
  /**
   * A GitHub Copilot budget with no name TeamRun knows, in `providerQuotas`; reported only when the service says it is used up.
   */
  Quota = "Quota"
}

/**
 * How a person's message sent while a reply runs reaches the chat.
 */
export declare enum MessageDelivery {
  /**
   * Read by the running teammate at its next step, in the same turn; until a provider can take it, it waits like `Queue`.
   */
  Steer = "Steer",
  /**
   * Waits, and goes as the next turn once the chat's running replies end.
   */
  Queue = "Queue",
  /**
   * Stops the chat's running replies, and goes as the next turn, before the messages that queue.
   */
  StopAndSend = "StopAndSend"
}

/**
 * Where a background task stands, as its provider or the process that owns it reports it.
 */
export declare enum BackgroundTaskStatus {
  /**
   * The task still runs.
   */
  Running = "Running",
  /**
   * The task ended by itself and its provider reports success.
   */
  Completed = "Completed",
  /**
   * The task ended by itself and its provider reports a failure, or a nonzero exit code.
   */
  Failed = "Failed",
  /**
   * The task was stopped, from TeamRun or by its provider.
   */
  Stopped = "Stopped",
  /**
   * The task ended with the session that owned it, and no status was reported: a Claude task ends
   * with its reply, and a Codex task with the Codex process.
   */
  Ended = "Ended"
}

/**
 * Where a provider TeamRun installs stands on this computer.
 */
export declare enum ProviderKindInstallState {
  /**
   * TeamRun can install it, and it isn't installed.
   */
  NotInstalled = "NotInstalled",
  /**
   * An install is downloading or unpacking it.
   */
  Installing = "Installing",
  /**
   * It is installed and ready to start.
   */
  Installed = "Installed",
  /**
   * TeamRun can't install it on this computer; the reason says why.
   */
  Unavailable = "Unavailable"
}

/**
 * What the last check of a provider observed about its sign-in.
 */
export declare enum AuthStatus {
  /**
   * Never checked, or the check could not tell.
   */
  Unknown = "Unknown",
  /**
   * The provider tooling reported a signed-in account.
   */
  LoggedIn = "LoggedIn",
  /**
   * The provider tooling reported no provider.
   */
  LoggedOut = "LoggedOut",
  /**
   * The provider tooling reported credentials that need a new sign-in.
   */
  Expired = "Expired",
  /**
   * The check itself failed; `Provider.lastError` says why.
   */
  Error = "Error"
}

/**
 * What a detail of a message carries; the renderer picks the presentation from it.
 */
export declare enum DetailKind {
  /**
   * Plain prose.
   */
  Text = "Text",
  /**
   * The provider's reasoning summary, when it emits one.
   */
  Reasoning = "Reasoning",
  /**
   * A command the provider ran; the payload carries output and exit code.
   */
  Command = "Command",
  /**
   * Files the provider changed; the payload carries the paths and diff.
   */
  FileChange = "FileChange",
  /**
   * A note from TeamRun inside a message, such as a resumed session.
   */
  Note = "Note",
  /**
   * The agent's plan as a checklist; the payload is a `ReplyPlan`, and the text summarizes its progress.
   */
  Plan = "Plan",
  /**
   * A sub-agent the agent started, under the step that started it; the payload is a `SubAgent`, and the text is its description.
   * Its own steps are details whose `parentSequence` names it; its text is never the reply's, so no `Text` detail is nested.
   */
  SubAgent = "SubAgent",
  /**
   * An error from the provider or TeamRun.
   */
  Error = "Error"
}

/**
 * Who wrote a message.
 */
export declare enum MessageAuthor {
  /**
   * The user, typing in the chat.
   */
  User = "User",
  /**
   * The provider, replying to the user.
   */
  Provider = "Provider",
  /**
   * TeamRun itself, such as status notes and results.
   */
  TeamRun = "TeamRun"
}

/**
 * Where a message stands. The user's and TeamRun's messages are complete when stored; a provider's
 * moves through the open states.
 */
export declare enum MessageStatus {
  /**
   * Recorded and not yet sent to the provider.
   */
  Pending = "Pending",
  /**
   * The provider is working.
   */
  Running = "Running",
  /**
   * The provider asked for permission and waits for the user.
   */
  AwaitingApproval = "AwaitingApproval",
  /**
   * The message is complete.
   */
  Completed = "Completed",
  /**
   * The provider or TeamRun reported an error; an `error` detail says which.
   */
  Failed = "Failed",
  /**
   * The user stopped the reply.
   */
  Cancelled = "Cancelled",
  /**
   * The runtime stopped before the reply finished, such as on shutdown.
   */
  Interrupted = "Interrupted"
}

/**
 * Known operation identifiers carried in a request's `method` field. Values exactly match the
 * PascalCase member names, such as `ProviderKindList`. Each member describes its parameter and result
 * types; a method without parameters carries `null`, and one without a result answers `null`.
 */
export declare enum MethodName {
  /**
   * Lists saved teammates. Parameters: `null`. Result: an array of `Teammate`.
   */
  TeammateList = "TeammateList",
  /**
   * Creates a teammate. Parameters: `TeammateCreateParams`. Result: `Teammate`.
   */
  TeammateCreate = "TeammateCreate",
  /**
   * Updates a teammate. Parameters: `TeammateUpdateParams`. Result: `Teammate`.
   */
  TeammateUpdate = "TeammateUpdate",
  /**
   * Deletes a teammate. Parameters: `TeammateIdParams`. Result: `null`.
   */
  TeammateDelete = "TeammateDelete",
  /**
   * Lists every organization, each with its departments and where each teammate placed in it sits, by their order, the one every
   * database starts with first. Parameters: `null`. Result: `Organization[]`.
   * Each method below that names an organization fails with `NotFound` when it doesn't exist, and a department of another
   * organization is `NotFound` too.
   */
  OrganizationList = "OrganizationList",
  /**
   * Creates an organization with no departments and no placed teammates, last in the list, and publishes `OrganizationChanged`.
   * Parameters: `OrganizationCreateParams`. Result: `Organization`.
   */
  OrganizationCreate = "OrganizationCreate",
  /**
   * Renames an organization and sets its default folder, and publishes `OrganizationChanged`. A teammate's Organization chat
   * with no folder of its own works in the new folder from its next turn. Parameters: `OrganizationUpdateParams`.
   * Result: `Organization`.
   */
  OrganizationUpdate = "OrganizationUpdate",
  /**
   * Deletes an organization with its departments, placements and layout, and publishes `OrganizationRemoved`; its teammates
   * and their chats stay. Deleting the last organization fails with `Conflict`. Parameters: `OrganizationIdParams`.
   * Result: `null`.
   */
  OrganizationDelete = "OrganizationDelete",
  /**
   * Creates a department, last among the departments under its parent, and publishes `OrganizationChanged`; a leader given is
   * placed in it first, from wherever it was, and leads it, in the same transaction. Parameters: `DepartmentCreateParams`.
   * Result: `Department`; a parent or leader that doesn't exist fails with `NotFound`, and a leader the department would sit under
   * fails with `InvalidParams`.
   */
  DepartmentCreate = "DepartmentCreate",
  /**
   * Renames a department or sets or clears its leader, and publishes `OrganizationChanged`. Parameters: `DepartmentUpdateParams`.
   * Result: `Department`; a leader who isn't a member is placed in it first, last among its teammates, and a leader the department
   * sits under fails with `InvalidParams`.
   */
  DepartmentUpdate = "DepartmentUpdate",
  /**
   * Moves a department under another parent, or to another place among its siblings, and publishes `OrganizationChanged`.
   * Parameters: `DepartmentMoveParams`. Result: `Department`; a parent that doesn't exist fails with `NotFound`, and a move under
   * itself or anything under it fails with `InvalidParams`.
   */
  DepartmentMove = "DepartmentMove",
  /**
   * Deletes a department, moving its teammates and departments to its parent, and publishes `OrganizationChanged`.
   * Parameters: `DepartmentIdParams`. Result: `null`.
   */
  DepartmentDelete = "DepartmentDelete",
  /**
   * Puts a teammate in a department, or in none, and publishes `OrganizationChanged`; a leader who leaves stops leading.
   * Parameters: `DepartmentMemberSetParams`. Result: `null`.
   */
  DepartmentMemberSet = "DepartmentMemberSet",
  /**
   * Places a teammate under the person, a department or another teammate at an order among the teammates there, or takes it
   * out of the organization, and publishes `OrganizationChanged`. A teammate that leaves a department stops leading it; what
   * sits under a teammate that leaves the organization moves to its parent.
   * Parameters: `TeammatePlaceParams`. Result: `null`.
   */
  TeammatePlace = "TeammatePlace",
  /**
   * Reads an Organization view's layout: its collapsed departments and what its cards show.
   * Parameters: `OrganizationIdParams`. Result: the layout's JSON object, or `null` when none is kept.
   */
  OrganizationLayoutRead = "OrganizationLayoutRead",
  /**
   * Keeps the Organization view's layout, replacing the one kept, and publishes `OrganizationLayoutUpdated`. Parameters:
   * `OrganizationLayoutSaveParams`. Result: the layout's JSON object.
   */
  OrganizationLayoutSave = "OrganizationLayoutSave",
  /**
   * Finds a teammate's Organization chat in one organization, or makes it when there is none yet, without sending anything.
   * Parameters: `OrganizationChat`. Result: `Chat`.
   */
  OrganizationChatOpen = "OrganizationChatOpen",
  /**
   * Adds a teammate to a chat. Parameters: `ChatMemberParams`. Result: `ChatMember`.
   */
  ConversationAddMember = "ConversationAddMember",
  /**
   * Removes a teammate from a chat. Parameters: `ChatMemberParams`. Result: `null`.
   */
  ConversationRemoveMember = "ConversationRemoveMember",
  /**
   * Lists chat memberships. Parameters: `ChatIdParams`. Result: an array of `ChatMember`.
   */
  ConversationListMembers = "ConversationListMembers",
  /**
   * Sets a teammate's permission mode in one chat, or `null` to follow the teammate's own; it applies from the teammate's next reply in the chat.
   * Parameters: `ChatMemberModeParams`. Result: `ChatMember`.
   */
  ConversationSetMemberMode = "ConversationSetMemberMode",
  /**
   * Sets a teammate's model, effort and speed in one chat, or `null` to follow the teammate's own; it applies from the teammate's next reply in the chat.
   * Parameters: `ChatMemberSettingsParams`. Result: `ChatMember`.
   */
  ConversationSetMemberSettings = "ConversationSetMemberSettings",
  /**
   * Turns a chat's Plan first on or off for every member; while on, each member's replies start in its provider's plan mode until its own plan is approved.
   * Parameters: `ChatPlanFirstParams`. Result: `Chat`.
   */
  ConversationSetPlanFirst = "ConversationSetPlanFirst",
  /** Prepares one bounded file for a subsequent message; AttachmentInput in, MessageAttachment out. */
  AttachmentPrepare = "AttachmentPrepare",
  /** Discards a prepared MessageAttachment; refuses committed message assets. */
  AttachmentDiscard = "AttachmentDiscard",
  /**
   * Reads the bytes of one of a chat's attachments, from its messages or its saved draft; AttachmentReadParams in, AttachmentContent out.
   * Refuses with NotFound anything that isn't one of them, or whose file is gone or changed, and with TooLarge a file over maximumAttachmentReadBytes.
   */
  AttachmentRead = "AttachmentRead",
  /**
   * Shares one of a chat's attachments, from its messages or its saved draft, with the asking window's page, so the page loads it by
   * address and no bytes pass as text; AttachmentReadParams in, AttachmentShare out.
   * Refuses with NotFound anything that isn't one of them, or whose file is gone or changed, and Noldova Desktop's refusals of the share as they are.
   */
  AttachmentShare = "AttachmentShare",
  /**
   * Says whether the saved file of one of a chat's message attachments is still there; AttachmentReadParams in, a boolean out.
   * Refuses with NotFound anything that isn't one of the chat's message attachments.
   */
  AttachmentExists = "AttachmentExists",
  /**
   * Reads the bytes of an image file a reply wrote in its chat's project; WrittenImageReadParams in, AttachmentContent out.
   * Refuses with NotFound a path WrittenImageReader doesn't find in that reply, one whose real path is outside the project folder,
   * a file that isn't a PNG, JPEG, GIF or WebP image by its content, or one that is gone or changed, and with TooLarge a file over
   * maximumAttachmentReadBytes.
   */
  WrittenImageRead = "WrittenImageRead",
  /**
   * Shares a PNG, JPEG, GIF or WebP image file a reply wrote in its chat's project with the asking window's page, so the page loads it by
   * address and no bytes pass as text; WrittenImageReadParams in, AttachmentShare out. A project file is shared as a copy of the bytes
   * checked as WrittenImageRead checks them, kept in TeamRun's data folder; an image Core stored there is shared as it is.
   * Refuses as WrittenImageRead does, with NotFound an SVG image, with TooLarge when the copies shared within a share's lifetime leave no room
   * for it, and Noldova Desktop's refusals of the share as they are.
   */
  WrittenImageShare = "WrittenImageShare",
  /**
   * Says which of the given paths a reply links to are folders on this computer; LinkedPaths in, LinkedPaths of the paths that are folders out,
   * in the order given. A path that isn't absolute, names a network share, or holds a control character is never looked at, and one that
   * is gone, can't be read, or is a file is left out.
   */
  LinkedFolderList = "LinkedFolderList",
  /** Saves a chat's unsent draft, replacing the one it holds; DraftSaveParams in, Draft out. */
  DraftSave = "DraftSave",
  /** Reads a chat's unsent draft; ChatIdParams in, Draft or null out. */
  DraftRead = "DraftRead",
  /** Discards a chat's unsent draft, at a revision or whatever it holds; DraftDiscardParams in, null out. */
  DraftDiscard = "DraftDiscard",
  /** Lists every chat's stored reading position; no parameters, ChatPosition array out. */
  ReadingPositionList = "ReadingPositionList",
  /** Stores and clears chats' reading positions, skipping a chat that no longer exists; ReadingPositionSaveParams in, null out. */
  ReadingPositionSave = "ReadingPositionSave",
  /** Lists the kept output of a chat's earlier Runs, the person's own and never read by teammates; ChatIdParams in, RunOutput array out. */
  RunOutputList = "RunOutputList",
  /** Keeps a Run's output with its block, replacing what that block kept before; RunOutput in, null out. */
  RunOutputSave = "RunOutputSave",
  /** Reads where TeamRun keeps its data on this computer; no parameters, DataFolder out. */
  DataFolderRead = "DataFolderRead",
  /** Reads whether the person has finished or skipped the first launch; no parameters, FirstLaunch out. */
  FirstLaunchRead = "FirstLaunchRead",
  /** Records that the person finished or skipped the first launch, keeping the first time; no parameters, FirstLaunch out. */
  FirstLaunchFinish = "FirstLaunchFinish",
  /**
   * Pages provider action summaries using MessagePageParams; returns ReplyPage.
   */
  MessageActivityPage = "MessageActivityPage",
  /**
   * Pages file change summaries using MessagePageParams; returns ReplyPage.
   */
  MessageChangesPage = "MessageChangesPage",
  /**
   * Pages the replies with a plan using MessagePageParams; returns ReplyPage.
   */
  MessagePlanPage = "MessagePlanPage",
  /**
   * Pages the replies with a sub-agent of their own using MessagePageParams; returns ReplyPage.
   */
  MessageSubAgentsPage = "MessageSubAgentsPage",
  /**
   * Reads one ReplySummary using MessageIdParams, or null after deletion.
   */
  MessageSummary = "MessageSummary",
  /**
   * Reads one message with its non-text details using MessageIdParams, or null after deletion.
   */
  MessageDetails = "MessageDetails",
  /**
   * Reads one message with only the non-text details after a sequence, and the held ones that changed, using
   * MessageDetailsAfterParams; null after deletion.
   */
  MessageDetailsAfter = "MessageDetailsAfter",

  /**
   * Lists all currently open provider replies; the payload is null.
   */
  MessageListOpen = "MessageListOpen",
  /**
   * Lists all currently pending approvals; the payload is null.
   */
  ApprovalListPending = "ApprovalListPending",
  /**
   * Lists the registered kinds. Parameters: none, `null` on the wire. Result:
   * an array of `ProviderKind`.
   */
  ProviderKindList = "ProviderKindList",
  /**
   * Lists the models a provider reports, optionally through a given provider. Parameters:
   * `ProviderListModelsParams`. Result: an array of model names.
   */
  ProviderListModels = "ProviderListModels",
  ProviderModelCatalog = "ProviderModelCatalog",
  /**
   * Lists the providers TeamRun installs, each with where its installation stands. Parameters: none, `null` on the wire. Result: an array of
   * `ProviderKindInstallation`.
   */
  ProviderKindInstallationList = "ProviderKindInstallationList",
  /**
   * Finds each provider's command-line tool afresh, by where its provider installs it and the tool's own version command. Parameters: none,
   * `null` on the wire. Result: an array of `ProviderTool`, one per kind that has a command-line tool.
   */
  ProviderToolList = "ProviderToolList",
  /**
   * Installs a provider, or joins the install already running for it. Parameters: `ProviderKindParams`. Result: the `ProviderKindInstallation` once
   * it ends: `Installed`, or `NotInstalled` when it was cancelled. A failed install fails the request with its reason, which the next
   * `ProviderKindInstallation` also carries.
   */
  ProviderKindInstall = "ProviderKindInstall",
  /**
   * Stops the provider's running install, if any, for every window that joined it; nothing of it stays. Parameters: `ProviderKindParams`.
   * Result: none, `null` on the wire.
   */
  ProviderKindInstallCancel = "ProviderKindInstallCancel",
  /**
   * Lists the providers. Parameters: none, `null` on the wire. Result:
   * an array of `Provider`.
   */
  ProviderList = "ProviderList",
  /**
   * Creates a provider for a profile directory the provider tooling will own. Parameters:
   * `ProviderCreateParams`. Result: `Provider`.
   */
  ProviderCreate = "ProviderCreate",
  /**
   * Changes a provider's label and profile directory and keeps its id and provider; a
   * new profile directory clears the last sign-in check. Parameters:
   * `ProviderUpdateParams`. Result: `Provider`.
   */
  ProviderUpdate = "ProviderUpdate",
  /**
   * Enables or disables a provider and keeps everything else about it. A disabled provider's
   * sign-in isn't checked, its usage isn't read, and a send to one of its teammates is refused.
   * Parameters: `ProviderEnabledParams`. Result: `Provider`.
   */
  ProviderSetEnabled = "ProviderSetEnabled",
  /**
   * Runs the adapter's sign-in check and records what it observed. Parameters:
   * `ProviderIdParams`. Result: `Provider`.
   */
  ProviderCheck = "ProviderCheck",
  /**
   * Starts the provider's own sign-in for the provider's profile directory, waits up to five
   * minutes for it to finish, then runs the sign-in check and records what it observed. Only a
   * provider whose descriptor has `supportsSignIn`; one sign-in per provider at a time.
   * Parameters: `ProviderIdParams`. Result: `Provider`, unchanged when the sign-in
   * was cancelled.
   */
  ProviderSignIn = "ProviderSignIn",

  /** Reads the command a provider's agent signs in with in a terminal, `null` when it has none. */
  ProviderSignInCommand = "ProviderSignInCommand",

  /** Lists the ACP registry's agents for this computer and the local ACP commands. */
  AcpAgentList = "AcpAgentList",

  /** Reads a registry agent's icon as a data address, `null` when it has none or it can't be read. */
  AcpAgentIcon = "AcpAgentIcon",

  /** Adds a registry agent as a kind. */
  AcpAgentAdd = "AcpAgentAdd",

  /** Adds a local ACP command as a kind. */
  AcpLocalCommandAdd = "AcpLocalCommandAdd",

  /** Removes an added ACP agent or a local ACP command. */
  AcpAgentRemove = "AcpAgentRemove",
  /**
   * Cancels the provider's running sign-in, if any. Parameters: `ProviderIdParams`. Result:
   * none, `null` on the wire.
   */
  ProviderSignInCancel = "ProviderSignInCancel",
  /**
   * Lists the providers whose sign-in runs now, whichever window started it. Parameters: none,
   * `null` on the wire. Result: `ProviderSignIns`.
   */
  ProviderSignInList = "ProviderSignInList",
  /**
   * Signs the provider's profile out of the provider, then runs the sign-in check and records what it observed. Only a provider
   * whose descriptor has `supportsSignOut`, and not while its sign-in runs. Parameters: `ProviderIdParams`. Result: `Provider`.
   */
  ProviderSignOut = "ProviderSignOut",
  /**
   * Lists a provider's own MCP servers by name and state, without `teamrun` and without connecting to any of them; `servers` is
   * `null` for a kind that offers no list. Parameters: `ProviderIdParams`. Result: `ProviderMcpServerList`.
   */
  ProviderOwnMcpServerList = "ProviderOwnMcpServerList",
  /**
   * Looks for profile folders on this computer that no provider uses yet, and asks each kind's own tooling whether each is signed in.
   * A call for the same kinds while one runs gets that one's result. Parameters: `ProviderProfileDiscoverParams`. Result:
   * `ProviderProfileDiscovery`.
   */
  ProviderProfileDiscover = "ProviderProfileDiscover",
  /**
   * Forgets a provider; the profile directory is left in place. Parameters:
   * `ProviderIdParams`. Result: none, `null` on the wire.
   */
  ProviderDelete = "ProviderDelete",
  /**
   * Lists the projects, oldest first, each with whether its folder is missing, unreachable or no
   * longer a folder. Checks every folder at once, waits a short bound for the checks, and answers
   * with each folder's last known state; a check that ends later still publishes its change.
   * Parameters: none, `null` on the wire. Result: an array of `ProjectListing`.
   */
  ProjectList = "ProjectList",
  /**
   * Opens a folder as a project, creating the project on first open. Parameters:
   * `ProjectOpenParams`. Result: `Project`.
   */
  ProjectOpen = "ProjectOpen",
  /**
   * Forgets a project and its chats; the folder is left untouched. Parameters:
   * `ProjectIdParams`. Result: none, `null` on the wire.
   */
  ProjectForget = "ProjectForget",
  /**
   * Reads the Projects view's layout: its pins, its order of projects and chats, and its collapsed projects.
   * Parameters: none. Result: the layout's JSON object, or `null` when none is kept.
   */
  ProjectsLayoutRead = "ProjectsLayoutRead",
  /**
   * Keeps the Projects view's layout, replacing the one kept, and tells every window. Parameters:
   * `ProjectsLayoutSaveParams`. Result: the layout's JSON object.
   */
  ProjectsLayoutSave = "ProjectsLayoutSave",
  /**
   * Lists a project's chats, or the chats without a project. Parameters: `ChatListParams`. Result:
   * an array of `Chat`.
   */
  ConversationList = "ConversationList",
  /**
   * Lists a project's empty chats, or the empty ones without a project: no message, and no draft text, attachment or missing
   * file. Parameters: `ChatListParams`. Result: an array of `Chat`.
   */
  ConversationListEmpty = "ConversationListEmpty",
  /**
   * Creates a chat in a project. Parameters: `ChatCreateParams`. Result:
   * `Chat`.
   */
  ConversationCreate = "ConversationCreate",
  /**
   * Renames a chat. Parameters: `ChatRenameParams`. Result: `Chat`.
   */
  ConversationRename = "ConversationRename",
  /**
   * Marks a chat as just used, so it lists first among the newest. Parameters: `ChatIdParams`. Result:
   * `Chat`.
   */
  ConversationTouch = "ConversationTouch",
  /**
   * Sets or clears the responder chosen in a chat's composer, a teammate or the default teammate's settings and provider, to
   * answer a teammate's message that mentions no one, keeping the chat's update time. With `start`, it sets the responder
   * only when the chat holds none and otherwise changes nothing. Parameters: `ChatResponderParams`. Result: `Chat`, as stored
   * after the request.
   */
  ConversationResponderSet = "ConversationResponderSet",
  /**
   * Reads the default teammate set in Settings, which a new chat starts from. Parameters: none.
   * Result: `DefaultTeammate`, or `null` when none is set.
   */
  DefaultTeammateRead = "DefaultTeammateRead",
  /**
   * Sets or clears the default teammate a new chat starts from; existing chats keep their own choices.
   * Parameters: `DefaultTeammateSetParams`. Result: the `DefaultTeammate` set, or `null` when cleared.
   */
  DefaultTeammateSet = "DefaultTeammateSet",
  /**
   * Reads the composer's default choice, the settings last sent that a new chat uses until a default teammate is set.
   * Parameters: none. Result: the choice's JSON object, or `null` when none is kept.
   */
  ComposerDefaultRead = "ComposerDefaultRead",
  /**
   * Keeps the composer's default choice, replacing the one kept, and tells every window. Parameters:
   * `ComposerDefaultSaveParams`. Result: the choice's JSON object.
   */
  ComposerDefaultSave = "ComposerDefaultSave",
  /**
   * Moves a chat into a project. A chat without a project first has its own folder's files copied into the project,
   * refused whole when the project already holds a file of one of their names, and its folder is then deleted. Refused while a reply
   * runs in the chat, and with `Conflict` naming what runs while a background command, a helper or a teammate's background work of the
   * chat still runs. Parameters: `ChatMoveParams`. Result: the `Chat`.
   */
  ConversationMove = "ConversationMove",
  /**
   * Deletes a chat with its messages and approvals, and a chat without a project also with its own folder and that
   * folder's checkpoints. Parameters: `ChatIdParams`. Result: none, `null` on the wire.
   */
  ConversationDelete = "ConversationDelete",
  /**
   * Counts the files in a chat's own folder, without its `.git`; 0 for a chat in a project. Parameters:
   * `ChatIdParams`. Result: the count, a number.
   */
  ConversationFolderCount = "ConversationFolderCount",
  /**
   * Attaches an existing folder to a chat without a project, or replaces the one attached: its teammates work in it, in place, from the
   * next turn, and nothing is copied; the chat's own folder stays for a detach. Refused with `Conflict` while a reply runs in the chat or
   * its background commands, helpers or a teammate's background work still run, naming them, or for a chat in a project, `NotFound` for an unknown chat, and `InvalidParameters` when the folder isn't an absolute path to a folder
   * TeamRun can read. Parameters: `ChatFolderAttachParams`. Result: the `Chat`.
   */
  ChatFolderAttach = "ChatFolderAttach",
  /**
   * Detaches a chat's attached folder, leaving its files as they are, so that its teammates work in the chat's own folder again from
   * the next turn. Refused with `Conflict` while a reply runs in the chat or its background commands, helpers or a teammate's background
   * work still run, naming them, `NotFound` for an unknown chat. Parameters: `ChatIdParams`.
   * Result: the `Chat`.
   */
  ChatFolderDetach = "ChatFolderDetach",
  /**
   * Removes a message and everything after it, marks the chat so that its next reply starts a fresh provider
   * session fed with the kept transcript, and optionally restores the project's files to the snapshot taken before the
   * removed reply started (git projects). Parameters: `ChatRewindParams`. Result:
   * `ChatRewindResult`. Fails with `Conflict` while a reply is open, `NotFound` for an unknown chat
   * or message, and `Internal` when the messages can't be removed; after files were restored, that refusal says so, with the error's message.
   */
  ConversationRewind = "ConversationRewind",
  /**
   * Finds chats whose title or message texts contain a text, case-insensitively for ASCII, one hit per
   * chat (the title when it matches, else the latest matching message with a snippet), the latest first.
   * Parameters: `ChatSearchParams`. Result: `ChatSearchResult`.
   */
  ConversationSearch = "ConversationSearch",
  /**
   * Finds chats for the window's search: with a blank query the latest updated, else those whose title contains it,
   * case-insensitively for ASCII, the latest updated first, each with its teammates' names, and how many there are in all.
   * Parameters: `ChatFindParams`. Result: `ChatFindResult`.
   */
  ChatFind = "ChatFind",
  /**
   * Finds messages whose text contains a text of at least 3 characters, case-insensitively, through the message text
   * index, the newest first, each with a snippet around the match, and how many there are in all; a shorter text finds
   * none. Parameters: `ChatSearchParams`. Result: `MessageSearchResult`.
   */
  MessageSearch = "MessageSearch",
  /**
   * Lists a chat's messages with their details, optionally after a sequence. Parameters:
   * `MessageListParams`. Result: an array of `Message`.
   */
  MessageList = "MessageList",
  MessagePage = "MessagePage",
  /**
   * Stores the user's message and queues its replies; fails with `Conflict` while a reply is
   * pending or running. Parameters: `MessageSendParams`. Result: `MessageSendResult`.
   */
  MessageSend = "MessageSend",
  /**
   * Cancels one reply: a working reply stops and the next waiting one starts; a waiting reply leaves
   * the queue. Parameters: `MessageIdParams`. Result: `Message`.
   */
  MessageCancel = "MessageCancel",
  /**
   * Approves the plan a plan-first reply ended with: marks it approved, records that its member's plan is approved, and sends "Go ahead with the
   * plan." to the same responder in its usual mode. Parameters: `MessageIdParams`. Result: `MessageSendResult`, that send.
   */
  MessageApprovePlan = "MessageApprovePlan",
  /**
   * Cancels every open reply of a chat's send, the working one and those waiting their
   * turn. Parameters: `ChatIdParams`. Result: an array of `Message`, the replies it stopped.
   */
  ConversationCancel = "ConversationCancel",
  /**
   * Lists a chat's pending approvals and its `Question` approvals of any status, so an
   * answered question stays in the reply. Parameters: `ChatIdParams`. Result: an array of `Approval`.
   */
  ApprovalList = "ApprovalList",
  /**
   * Decides a pending approval by choosing one of its options. Parameters: `ApprovalDecideParams`.
   * Result: `Approval`.
   */
  ApprovalDecide = "ApprovalDecide",
  /**
   * Lists every provider's plan use as its provider last reported it, from turns or reads. Parameters: none. Result: an array of `PlanUsage`.
   */
  PlanUsageList = "PlanUsageList",
  /**
   * Asks the provider for its plan use now, keeps it, and publishes it. Parameters: `PlanUsageParams`. Result: `PlanUsage`, or `null`
   * when the provider reports no plan use.
   */
  PlanUsageRead = "PlanUsageRead",
  /**
   * Lists, for each teammate in each chat, the usage of its latest reply that reports any, while that reply is in the teammate's current
   * session there. Parameters: none. Result: an array of `TeammateUsage`, one per teammate and chat, leaving out the pairs whose replies
   * report none or whose latest such reply is from a session since reset, such as by a provider change.
   */
  TeammateUsageList = "TeammateUsageList",
  /**
   * Lists each teammate's latest completed reply that has text, in any chat. Parameters: none. Result: an array of `TeammateLastReply`,
   * one per teammate that has one.
   */
  TeammateLastReplyList = "TeammateLastReplyList",
  /**
   * Lists a page of a chat's background tasks: every running one on the first page, then its
   * finished commands, newest first and at most `limit` a page, each with its output left out and
   * its command cut to `Resources.maximumListedCommand` characters. A finished sub-agent is not listed.
   * Parameters: `BackgroundTaskListParams`. Result: `BackgroundTaskPage`.
   */
  BackgroundTaskList = "BackgroundTaskList",
  /**
   * Reads one background task of a chat already listed, with its output.
   * Parameters: `BackgroundTaskIdParams`. Result: `BackgroundTask`.
   */
  BackgroundTaskRead = "BackgroundTaskRead",
  /**
   * Stops a running background task through the provider or the process that owns it, and waits
   * for its end. Parameters: `BackgroundTaskIdParams`. Result: `BackgroundTask`.
   */
  BackgroundTaskStop = "BackgroundTaskStop",
  /**
   * Forgets a chat's finished background tasks, keeping its running ones, and publishes
   * `BackgroundTasksCleared`. Parameters: `ChatIdParams`. Result: `BackgroundTasksClearedPayload`.
   */
  BackgroundTaskClearFinished = "BackgroundTaskClearFinished",
  /**
   * Starts a sub-agent for the running turn whose sender token it carries: a fresh turn of that turn's provider, model and mode,
   * in the chat's folder, with the brief as its prompt and none of TeamRun's tools; it shows as a running `SubAgent` row in the
   * turn's reply, with its steps under the row. Refused when the turn has ended, when `agent` is not `helper`, or when the reply
   * already runs four. Parameters: `SubAgentStartParams`. Result: the row's `SubAgent`, whose `toolUseId` is its id.
   */
  SubAgentStart = "SubAgentStart",
  /**
   * Waits until one of the named sub-agents of the running turn's reply ends, or for at most `seconds`, and answers at once when
   * none of them runs. Parameters: `SubAgentWaitParams`. Result: `SubAgentWaitResult`.
   */
  SubAgentWait = "SubAgentWait",
  /**
   * Stops a sub-agent of the running turn's reply and waits for its end. Parameters: `SubAgentStopParams`. Result: its `SubAgent`.
   */
  SubAgentStop = "SubAgentStop",
  /**
   * Runs a shell command in the background for the running turn, in the chat's folder, with the turn's environment. It shows as a
   * running `BackgroundTask` of kind `command` in the chat's Background tasks, with its output and Stop. When the command ends, the
   * teammate that started it is woken with a new turn quoting its exit code, signal and last lines; stopping it, or stopping the
   * turn, ends it without a wake. Refused when the turn has ended or when the chat already runs four.
   * Parameters: `CommandStartParams`. Result: the `BackgroundTask`.
   */
  CommandStart = "CommandStart",
  /**
   * A TeamRun window was focused, or the chat its middle area shows changed; the engine keeps the chat it shows and puts it first
   * in its focus order only when `focused` is true, so a window behind keeps its place and one the engine doesn't know yet joins
   * last. Answers only the app's main process. Parameters: `WindowFocusedParams`. Result: null.
   */
  WindowFocused = "WindowFocused",
  /**
   * A TeamRun window closed; the engine drops it from its focus order. Answers only the app's main process.
   * Parameters: `WindowIdParams`. Result: null.
   */
  WindowClosed = "WindowClosed",
  /**
   * Asks the window part with this id to load again what it failed to load, as its Try again does; the engine publishes
   * `WindowReloadRequested` for it. Answers only the app's main process. Parameters: `WindowIdParams`. Result: null.
   */
  WindowReload = "WindowReload",
  /**
   * The window a `PanelRequested` named answers it with the request's id, its own window id and the `PanelOutcome`. A window
   * that doesn't answer in time fails the request, which goes to no other window; it keeps its place in the focus order but is
   * skipped until it answers or reports itself again. Answers only the app's main process. Parameters: `PanelAnsweredParams`.
   * Result: null.
   */
  PanelAnswered = "PanelAnswered",
  /**
   * Lists the shared MCP servers, each with the providers that can't take it and why. Parameters: `null`. Result: an array of
   * `SharedMcpServerListing`.
   */
  SharedMcpServerList = "SharedMcpServerList",
  /**
   * Adds a shared MCP server, off for every provider. Parameters: `SharedMcpServerDefinition`. Result: `SharedMcpServer`; a taken name is `Conflict`.
   */
  SharedMcpServerCreate = "SharedMcpServerCreate",
  /**
   * Changes a shared MCP server's definition and keeps its switches. Parameters: `SharedMcpServerUpdateParams`. Result: `SharedMcpServer`; an unknown
   * server is `NotFound` and a taken name `Conflict`.
   */
  SharedMcpServerUpdate = "SharedMcpServerUpdate",
  /**
   * Removes a shared MCP server. Parameters: `SharedMcpServerIdParams`. Result: `null`; an unknown server is `NotFound`.
   */
  SharedMcpServerDelete = "SharedMcpServerDelete",
  /**
   * Turns a shared MCP server on or off for a provider. Parameters: `SharedMcpProviderSetParams`. Result: `SharedMcpServer`; an unknown server or
   * provider is `NotFound`.
   */
  SharedMcpProviderSet = "SharedMcpProviderSet",
  /**
   * Sets a teammate's setting for a shared MCP server. Parameters: `SharedMcpTeammateSetParams`. Result: `SharedMcpServer`; an unknown server or
   * teammate is `NotFound`.
   */
  SharedMcpTeammateSet = "SharedMcpTeammateSet",
  /**
   * Sets where one of a shared MCP server's variables takes its value: a `reference` to the saved secret the window saved in Noldova Desktop's
   * secret store, or `null` for this machine's environment, which removes the saved secret. No value crosses this method. Parameters:
   * `SharedMcpSecretSetParams`. Result: `SharedMcpServer`; an unknown server is `NotFound`, and a variable the server doesn't name is
   * `InvalidArgument`.
   */
  SharedMcpSecretSet = "SharedMcpSecretSet",
  /**
   * Starts the OAuth sign-in of a shared HTTP MCP server that signs in: TeamRun finds the server's authorization server from its `401`, registers
   * itself there when it has no client yet, and answers the address the person opens in the browser, with PKCE and a one-use local redirect, or no address
   * when a Sign out or a later start ended it first; the server's `signIn` changes once the browser comes back. Parameters: `SharedMcpServerIdParams`. Result: `SharedMcpSignInStarted`; an unknown
   * server is `NotFound`, and one that doesn't sign in is `InvalidArgument`.
   */
  SharedMcpSignInStart = "SharedMcpSignInStart",
  /**
   * Signs a shared MCP server out: removes its tokens from Noldova Desktop's secret store and its `signIn`. Parameters: `SharedMcpServerIdParams`.
   * Result: `SharedMcpServer`; an unknown server is `NotFound`.
   */
  SharedMcpSignOut = "SharedMcpSignOut",
  /**
   * Lists the apps, and the screen, the permission center remembers a chat may control through computer use, newest first. Only where the app runs on Noldova Desktop.
   * Parameters: none, `null` on the wire. Result: an array of `ComputerUseGrant`; elsewhere `Unavailable`.
   */
  ComputerUseGrantList = "ComputerUseGrantList",
  /**
   * Revokes a remembered computer-use grant: the chat's next input to an app is refused without asking, and the chat's next session asks for the screen again. Parameters:
   * `ComputerUseGrantIdParams`. Result: `null`; an unknown grant is `NotFound`, and elsewhere than Noldova Desktop `Unavailable`.
   */
  ComputerUseGrantRevoke = "ComputerUseGrantRevoke",
  /**
   * Adds a person's message to a chat's waiting messages, at the end, or before the ones that queue when it stops and sends, and
   * publishes `WaitingMessagesChanged`. Stop and send stops the chat's running replies. The waiting messages go one at a time, each
   * as `MessageSend` sends it, once the chat has no running reply and no answer to a question waits; one added to an idle chat goes
   * at once. Steer waits like Queue until a provider can take it into its running turn. Parameters: `WaitingMessageAddParams`.
   * Result: `WaitingMessage`; an unknown chat is `NotFound`, and a send whose `mentionedTeammateIds` aren't the teammates its text
   * mentions, as `MessageSend` resolves them for a person's text, is `Conflict`, as for `WaitingMessageEdit`.
   */
  WaitingMessageAdd = "WaitingMessageAdd",
  /**
   * Lists a chat's waiting messages in the order they go. Parameters: `ChatIdParams`. Result: `WaitingMessagesPayload`; an unknown
   * chat is `NotFound`.
   */
  WaitingMessageList = "WaitingMessageList",
  /**
   * Replaces a waiting message's send, keeping its place and clearing a failure, and publishes `WaitingMessagesChanged`. Parameters:
   * `WaitingMessageEditParams`. Result: `WaitingMessage`; an unknown waiting message is `NotFound`, a send to another chat is
   * `InvalidParams`, and a send whose `mentionedTeammateIds` aren't the teammates its new text mentions, as `MessageSend` resolves them, is
   * `Conflict`: the engine resolves none, so the caller resolves them from the new text.
   */
  WaitingMessageEdit = "WaitingMessageEdit",
  /**
   * Removes a waiting message and publishes `WaitingMessagesChanged`. Parameters: `WaitingMessageIdParams`. Result: `null`; an
   * unknown waiting message is `NotFound`.
   */
  WaitingMessageRemove = "WaitingMessageRemove",
  /**
   * Sends a waiting message now: it becomes Stop and send, goes before the others, clears a failure and stops the chat's running
   * replies. Parameters: `WaitingMessageIdParams`. Result: `WaitingMessage`; an unknown waiting message is `NotFound`.
   */
  WaitingMessageSendNow = "WaitingMessageSendNow",
  /**
   * Reads how a session outside TeamRun reaches teammates: whether the switch is on, the endpoint's URL, its token and why it isn't
   * listening, if it isn't. Parameters: none. Result: `OutsideConnection`.
   */
  OutsideConnectionRead = "OutsideConnectionRead",
  /**
   * Replaces the outside token, so that every outside session's next request is refused, ends their waits and forgets the message ids
   * they were given. Parameters: none. Result: `OutsideConnection`.
   */
  OutsideTokenReset = "OutsideTokenReset",
  /**
   * Reads what a teammate worked on: the folder of the chat it last answered in, every folder of a chat it answered in, and the Markdown and
   * text files its replies created or changed. Parameters: `TeammateIdParams`. Result: `TeammateWork`.
   */
  TeammateWorkRead = "TeammateWorkRead"
}

/**
 * Known event identifiers carried in an event's `name` field. Values exactly match the PascalCase
 * member names, such as `MessageCreated`. Each member describes its payload; models use their JSON form.
 */
export declare enum EventName {
  /**
   * Catalog or connection state changed; clients reload their catalog and active work, preserving message windows. Payload: null.
   */
  StateInvalidated = "StateInvalidated",
  /**
   * The desktop reconnected and may have missed message events; reload catalog, active work, and the selected chat. Payload: null.
   */
  StateResyncRequested = "StateResyncRequested",
  /**
   * A message was stored: the user's, a provider's pending reply, or a note from TeamRun. Payload:
   * `Message`.
   */
  MessageCreated = "MessageCreated",
  /**
   * A message's status, provenance, or end time changed. Payload: `Message`.
   */
  MessageUpdated = "MessageUpdated",
  /**
   * A detail was added to a message. Payload: `DetailEventPayload`.
   */
  DetailAppended = "DetailAppended",
  /**
   * An existing detail changed, such as streamed text or command output. Payload:
   * `DetailEventPayload`.
   */
  DetailUpdated = "DetailUpdated",
  /**
   * A running reply's provider is thinking without text to show. Sent at the first thinking progress of a reply and again
   * only after a detail other than thinking text, and never stored, so a reloaded window does not see it. Payload:
   * `MessageIdParams`.
   */
  ReplyThinking = "ReplyThinking",
  /**
   * A running reply started taking its folder's checkpoint, before its provider starts. Sent before the checkpoint and never stored, so a
   * reloaded window does not see it. Payload: `MessageIdParams`.
   */
  ReplyCheckpointStarted = "ReplyCheckpointStarted",
  /**
   * A running reply's checkpoint ended, taken, not taken, failed or stopped. Never stored. Payload: `MessageIdParams`.
   */
  ReplyCheckpointEnded = "ReplyCheckpointEnded",
  /**
   * A provider asked for permission. Payload: `Approval`.
   */
  ApprovalCreated = "ApprovalCreated",
  /**
   * An approval was decided or cancelled. Payload: `Approval`.
   */
  ApprovalUpdated = "ApprovalUpdated",
  /**
   * A provider's observed state changed after a check. Payload: `Provider`.
   */
  ProviderUpdated = "ProviderUpdated",
  /**
   * A provider's sign-in started or ended. Payload: `ProviderSignIns`, every sign-in
   * that runs now.
   */
  ProviderSignInsChanged = "ProviderSignInsChanged",
  /**
   * A provider's install started, moved on by a whole percent, or ended. Payload: `ProviderKindInstallation`.
   */
  ProviderKindInstallationChanged = "ProviderKindInstallationChanged",

  /** The list of kinds changed: an ACP agent or a local ACP command was added or removed. */
  ProviderKindsChanged = "ProviderKindsChanged",
  /**
   * A provider's sign-in has a page to open in the browser; the window that started the
   * sign-in opens it. Payload: `SignInLinkPayload`.
   */
  SignInLink = "SignInLink",
  /**
   * A chat was cut: every message from a sequence on is gone. Payload: `ChatRewoundPayload`.
   */
  ConversationRewound = "ConversationRewound",
  /**
   * A chat was deleted, on its own or with its project; every window drops it, closes its
   * documents and forgets what it kept of it. Payload: `ChatIdParams`.
   */
  ConversationDeleted = "ConversationDeleted",
  /**
   * A provider's plan use changed, from a turn or a read. Payload: `PlanUsage`.
   */
  PlanUsageUpdated = "PlanUsageUpdated",
  /**
   * A background task started or ended. Payload: `BackgroundTask`, with its output so far.
   */
  BackgroundTaskUpdated = "BackgroundTaskUpdated",
  /**
   * A running background task wrote output. Payload: `BackgroundTaskOutputPayload`.
   */
  BackgroundTaskOutput = "BackgroundTaskOutput",
  /**
   * The Projects view's layout was kept; every window shows it. Payload: the layout's JSON object.
   */
  ProjectsLayoutUpdated = "ProjectsLayoutUpdated",
  /**
   * A check of a project's folder, by a turn, a listing or Open folder, found it missing, unreachable
   * or no longer a folder, or back after that. Payload: `ProjectFolderChange`.
   */
  ProjectFolderChanged = "ProjectFolderChanged",
  /**
   * The composer's default choice was kept; every window uses it. Payload: the choice's JSON object.
   */
  ComposerDefaultUpdated = "ComposerDefaultUpdated",

  /**
   * A chat's finished background tasks were forgotten. Payload: `BackgroundTasksClearedPayload`.
   */
  BackgroundTasksCleared = "BackgroundTasksCleared",
  /**
   * A teammate's tool asked one window to open or close a panel; only that window acts, and answers with `PanelAnswered`.
   * Payload: `PanelRequestedPayload`.
   */
  PanelRequested = "PanelRequested",

  /**
   * A Try again on a failed load's notice asked the window part with this id to load again what it failed to load; only that
   * window part acts. Payload: `WindowIdParams`.
   */
  WindowReloadRequested = "WindowReloadRequested",
  /**
   * A chat's waiting messages changed: one was added, edited, removed, sent, failed or moved to go next. Payload:
   * `WaitingMessagesPayload`, with all of the chat's waiting messages in the order they go.
   */
  WaitingMessagesChanged = "WaitingMessagesChanged",
  /**
   * An organization changed: it was created, renamed or given another folder, a department was created, renamed, moved or deleted,
   * a leader was set or cleared, a teammate changed department, or a deleted teammate left its department. Payload: `Organization`,
   * the whole organization after the change.
   */
  OrganizationChanged = "OrganizationChanged",
  /**
   * An organization was deleted. Payload: `OrganizationIdParams`.
   */
  OrganizationRemoved = "OrganizationRemoved",
  /**
   * An Organization view's layout was saved. Payload: `OrganizationLayoutSaveParams`, the organization's id and the layout.
   */
  OrganizationLayoutUpdated = "OrganizationLayoutUpdated"
}

/**
 * The base of every exception the protocol package throws, which its callers catch as one.
 */
export declare abstract class ProtocolException extends Exception {
  /**
   * Initializes the exception.
   * @param message What went wrong.
   */
  protected constructor(message: string);
}

/**
 * A request to TeamRun's MCP server that it answers with a JSON-RPC error, such as a method it doesn't have.
 */
export declare class McpRequestException extends ProtocolException {
  /**
   * The exception's name, `"McpRequestException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * The JSON-RPC error code the server answers with.
   */
  public readonly code: number;

  /**
   * Initializes the exception.
   * @param code The JSON-RPC error code the server answers with.
   * @param message What went wrong, which the server answers with.
   */
  public constructor(code: number, message: string);
}

/**
 * Every literal of the protocol package: wire field names, the version separator, and message
 * texts. Code reads names only; enum values stay in their enums.
 */
export declare class Resources {
  public static readonly mentionMarker: string;
  public static readonly mentionEscape: string;
  public static readonly mentionBacktick: string;
  public static readonly mentionTilde: string;
  public static readonly mentionFenceLength: number;
  public static readonly mentionCandidatePattern: RegExp;
  public static readonly mentionNextWordPattern: RegExp;
  public static readonly mentionQuotes: ReadonlyMap<string, readonly string[]>;
  public static readonly mentionQuoteWordPattern: RegExp;
  public static readonly mentionAddressLeadPattern: RegExp;
  public static readonly mentionAddressJoinPattern: RegExp;
  /**
   * Participant send protocol literal.
   */
  public static readonly defaultResponderSettingsRequired: string;
  /**
   * Participant send protocol literal.
   */
  public static readonly mentionedTeammateIdsField: string;
  /**
   * Participant send protocol literal.
   */
  public static readonly responderTeammateIdField: string;
  /**
   * Participant send protocol literal.
   */
  public static readonly responderField: string;
  /**
   * The default teammate field of `DefaultTeammateSetParams`.
   */
  public static readonly defaultTeammateField: string;

  /**
   * The layout field of `ProjectsLayoutSaveParams` and `OrganizationLayoutSaveParams`.
   */
  public static readonly layoutField: string;
  /**
   * The choice field of `ComposerDefaultSaveParams`.
   */
  public static readonly choiceField: string;
  /**
   * Participant send protocol literal.
   */
  public static readonly invalidChatResponder: string;
  /** @deprecated Use `invalidChatResponder`; the earlier name goes in a later release. */
  public static readonly invalidConversationResponder: string;
  /**
   * Participant send protocol literal.
   */
  public static readonly roleAppliedField: string;
  /**
   * The field of a failed reply's error detail payload that names the action that fixes the failure, a `ReplyAction`.
   */
  public static readonly actionField: string;
  /** Wire field name. */
  public static readonly teammateIdField: string;
  /** Wire field name of `MessageSender.outside`. */
  public static readonly outsideField: string;
  /** Wire field name. */
  public static readonly teammateNameField: string;
  /** Wire field name. */
  public static readonly roleField: string;
  /** Wire field name. */
  public static readonly harnessField: string;
  /** Wire field name. */
  public static readonly joinedAtField: string;
  /** Wire field name. */
  public static readonly mentionsField: string;
  /** A model name a person may type: a letter or digit, then letters, digits, `.`, `_`, `:`, `/` or `-`, up to 100 characters. */
  public static readonly modelNamePattern: RegExp;
  /** Participant validation literal. */
  public static readonly teammateNamePattern: RegExp;
  /**
   * A default teammate's sender name, after NFC normalization: 1 to 100 characters with no control character and no line or paragraph
   * separator, so that it stays one line in the header providers read.
   */
  public static readonly defaultSenderNamePattern: RegExp;
  /**
   * What an outside sender's label allows: 1 to 40 characters on one line, with no control or format character, line or paragraph separator, or `@`,
   * so that it can't start a mention or hide its text's order.
   */
  public static readonly outsideLabelPattern: RegExp;
  public static readonly teammateNameSpaces: RegExp;
  public static readonly teammateNameSpace: string;
  public static readonly teammateInitialsWords: number;
  /** Participant validation literal. */
  public static readonly teammateNameNormalization: "NFC";
  /**
   * The data directory's folder for the profile folders it makes: `profiles`.
   */
  public static readonly profilesDirectoryName: string;
  /**
   * The most characters a new profile folder's name keeps from its label: 60, so at most 240 bytes
   * in UTF-8, under the 255 that file systems allow.
   */
  public static readonly profileFolderNameLimit: number;
  /**
   * What a profile folder's name can't hold: `<>:"/\|?*` and control characters.
   */
  public static readonly profileFolderUnsafePattern: RegExp;
  /**
   * The dots and spaces a profile folder's name can't start or end with.
   */
  public static readonly profileFolderEdgePattern: RegExp;
  /**
   * The names Windows reserves for devices, alone or before an extension, such as `CON`, `nul.txt`, `COM0` or `LPT¹`.
   */
  public static readonly reservedFolderNamePattern: RegExp;
  /**
   * What goes before a reserved profile folder name: `_`.
   */
  public static readonly profileFolderReservedPrefix: string;
  /**
   * What stands in for each character a profile folder's name can't hold: `-`.
   */
  public static readonly profileFolderReplacement: string;
  /**
   * The separators a folder path's end can carry, which `ProfileFolderPath` leaves out.
   */
  public static readonly trailingFolderSeparatorPattern: RegExp;
  /**
   * A Windows path: one that starts with a drive letter or holds a backslash, which `ProfileFolderPath` compares in any case.
   */
  public static readonly windowsPathPattern: RegExp;
  /** Why a default teammate's sender name is refused: it is blank, longer than 100 characters, or holds a line break or other control character. */
  public static readonly invalidDefaultSenderName: string;
  /** Why an outside sender's label is refused: it is blank, longer than 40 characters, or holds a line break, other control or format character, or `@`. */
  public static readonly invalidOutsideLabel: string;
  /** Why an outside sender with a teammate id is refused. */
  public static readonly outsideSenderWithTeammate: string;
  /** Participant validation literal. */
  public static readonly invalidTeammateName: string;
  /** Participant validation literal. */
  public static readonly invalidHarness: string;
  /** Why a teammate update that changes no field is refused. */
  public static readonly emptyTeammateUpdate: string;
  /** Why a teammate update that sets its model, effort, speed or mode without the provider it read, or a new one, is refused. */
  public static readonly teammateUpdateProviderUnread: string;
  /** Participant validation literal. */
  public static readonly invalidTeammateAuthor: string;
  /** Participant validation literal. */
  public static readonly invalidMessageMentions: string;
  public static readonly invalidMessageSender: string;
  public static readonly senderField: string;
  public static readonly senderTokenField: string;
  /** The refusal of a send that names its sender other than by its turn's token. */
  public static readonly senderFromTokenOnly: string;
  public static readonly wakeWhenDoneField: string;
  public static readonly wakeFromTokenOnly: string;
  public static readonly deliveryField: string;
  /** The refusal of a waiting message with a teammate's sender token. */
  public static readonly waitingFromPersonOnly: string;
  /** The refusal of a chat's waiting messages that hold another chat's. */
  public static readonly waitingMessageOfAnotherChat: string;
  /**
   * The longest command `CommandStart` runs, in characters.
   */
  public static readonly maximumCommandLength: number;
  public static readonly commandTooLong: string;
  public static readonly wakeIdField: string;
  /** The variable that carries the token of the teammate's turn a process runs for. */
  public static readonly senderTokenVariable: string;
  public static readonly descriptionField: string;
  public static readonly isDefaultField: string;
  public static readonly resolvedModelField: string;
  public static readonly supportsImagesField: string;
  /** Name of a provider model's default effort level field: `defaultEffort`. */
  public static readonly defaultEffortField: string;
  /** Name of a provider model's effort level names field: `effortNames`. */
  public static readonly effortNamesField: string;
  /** Name of a provider model's speeds field: `speeds`. */
  public static readonly speedsField: string;
  /** Name of a provider model's default speed field: `defaultSpeed`. */
  public static readonly defaultSpeedField: string;
  /** Name of a requested, observed or teammate speed field: `speed`. */
  public static readonly speedField: string;
  /** Name of the observed settings' field saying why the requested speed can't serve: `speedUnavailable`. */
  public static readonly speedUnavailableField: string;
  /** Name of a teammate's, an update's and requested settings' chosen context window field: `contextWindow`. */
  public static readonly contextWindowField: string;
  /** Name of a provider model's context windows field: `contextWindows`. */
  public static readonly contextWindowsField: string;
  /** Name of a provider model's field saying why it can't be chosen: `unavailableReason`. */
  public static readonly unavailableReasonField: string;
  /** Name of a provider model's field naming the effort the provider's configuration sets: `configuredEffort`. */
  public static readonly configuredEffortField: string;
  /** Name of a model's context windows' presets field: `presets`. */
  public static readonly presetsField: string;
  /** Name of a model's context windows' smallest size field: `minimum`. */
  public static readonly minimumField: string;
  /** Name of a model's context windows' largest size field: `maximum`. */
  public static readonly maximumField: string;
  public static readonly reportedField: string;
  /** Tokens in a thousand, the unit a context window's name counts in below a million. */
  public static readonly thousandTokens: number;
  /** Tokens in a million, the unit of a context window's name such as `1M`. */
  public static readonly millionTokens: number;
  /** A context window's size as a person types it: a number of up to seven digits and three decimals, then optionally a space and `K` or `M`, in either case. */
  public static readonly contextWindowSizePattern: RegExp;
  /** The unit after a context window's size in thousands: `K`. */
  public static readonly thousandUnit: string;
  /** The unit after a context window's size in millions: `M`. */
  public static readonly millionUnit: string;
  /** Name of a provider model list's modes field: `modes`. */
  public static readonly modesField: string;
  /** Name of a provider model list's plan mode field: `planMode`. */
  public static readonly planModeField: string;
  /** Name of a provider model list's default mode field: `defaultMode`. */
  public static readonly defaultModeField: string;
  /** Name of a provider model list's field saying its default model takes any listed model's effort level: `defaultTakesListedEfforts`. */
  public static readonly defaultTakesListedEffortsField: string;
  /** Name of a requested or teammate permission mode field: `mode`. */
  public static readonly modeField: string;
  /** Name of a chat member's own model, effort and speed field: `settings`. */
  public static readonly settingsField: string;
  /** Name of the field naming the account a chat member's session runs on: `sessionProviderId`. */
  public static readonly sessionProviderIdField: string;
  /** Name of the field saying a chat or a turn plans first: `planFirst`. */
  public static readonly planFirstField: string;
  /** Name of a chat's field for the teammates whose plan was approved since Plan first turned on: `approvedPlanTeammates`. */
  public static readonly approvedPlanTeammatesField: string;
  /** Name of a chat's field saying its own provider's plan was approved since Plan first turned on: `approvedResponderPlan`. */
  public static readonly approvedResponderPlanField: string;
  /** Name of a chat's field saying a person chose its title. */
  public static readonly titleChosenField: string;
  /** Name of a chat's field for the existing folder a person attached to it: `attachedFolder`. */
  public static readonly attachedFolderField: string;
  /** Name of a chat's field for the organization and teammate whose Organization chat it is: `organizationChat`. */
  public static readonly organizationChatField: string;
  /** Name of the field for an organization's id: `organizationId`. */
  public static readonly organizationIdField: string;
  /** Name of a teammate update's field for the provider its sender read: `expectedProviderId`. */
  public static readonly expectedProviderIdField: string;
  /** Name of a provider mode's field saying it lifts the provider's restrictions: `unrestricted`. */
  public static readonly unrestrictedField: string;
  /**
   * Attachment array wire key.
   */
  public static readonly attachmentsField: string;
  /**
   * Media type wire key.
   */
  public static readonly mediaTypeField: string;
  /**
   * Base64 payload wire key.
   */
  public static readonly dataField: string;
  /**
   * File share grant wire key.
   */
  public static readonly grantField: string;
  /**
   * Byte size wire key.
   */
  public static readonly sizeField: string;
  /**
   * Invalid attachment source diagnostic.
   */
  public static readonly attachmentSourceRequired: string;
  /**
   * Too many attachments in a draft diagnostic.
   */
  public static readonly draftAttachmentsTooMany: string;
  /**
   * Invalid draft revision diagnostic.
   */
  public static readonly draftRevisionInvalid: string;
  /**
   * Invalid draft save revision diagnostic.
   */
  public static readonly draftBaseRevisionInvalid: string;
  /**
   * A reading position save that names a chat twice diagnostic.
   */
  public static readonly readingPositionRepeated: string;
  /**
   * Maximum files in one send: 10.
   */
  public static readonly maximumAttachments: number;
  /**
   * The effort levels from lowest to highest, as the providers name them, for ordering levels gathered from several models; a level not in it comes after them.
   */
  public static readonly effortLevelOrder: readonly string[];
  /**
   * Maximum raw bytes per file: 100 MiB.
   */
  public static readonly maximumAttachmentBytes: number;
  /**
   * Maximum bytes per native image: 10 MiB.
   */
  public static readonly maximumAttachmentImageBytes: number;
  /**
   * Maximum bytes AttachmentRead returns: 12 MiB less 64 KiB, so the base64 answer and its envelope fit one 16 MiB protocol frame.
   */
  public static readonly maximumAttachmentReadBytes: number;
  /**
   * How long a file share TeamRun asks Noldova Desktop for lives, ten minutes, the longest it allows; a copy shared for WrittenImageShare stays
   * at least that long after its last share.
   */
  public static readonly fileShareLifetime: number;
  /**
   * PNG, JPEG, GIF and WebP MIME types accepted for native image input.
   */
  public static readonly attachmentImageMediaTypes: readonly string[];

  /**
   * The maximumPreviewTitleLength protocol value.
   */
  public static readonly maximumPreviewTitleLength: number;
  /**
   * The previewField protocol value.
   */
  public static readonly previewField: string;
  /**
   * The filesField protocol value.
   */
  public static readonly filesField: string;
  /**
   * The repliesField protocol value.
   */
  public static readonly repliesField: string;
  /**
   * The additionsField protocol value.
   */
  public static readonly additionsField: string;
  /**
   * The deletionsField protocol value.
   */
  public static readonly deletionsField: string;
  /**
   * The hasDiffField protocol value.
   */
  public static readonly hasDiffField: string;
  /**
   * The imageGenerationItemType protocol value.
   */
  public static readonly imageGenerationItemType: string;
  /**
   * The itemTypeField protocol value.
   */
  public static readonly itemTypeField: string;
  /**
   * The workingTreeSource protocol value.
   */
  public static readonly workingTreeSource: string;
  /**
   * Lines kept of a diff Core reports: a working-tree diff with this many lines and no line separator at its end was cut.
   */
  public static readonly maximumDiffLines: number;
  /**
   * The handOffSource protocol value: the `source` of the note that a chain of teammate hand-offs stopped at the limit.
   */
  public static readonly handOffSource: string;
  /**
   * The usageHandOffSource protocol value: the `source` of the note that ends a reply that ran no turn because its teammate was out of usage, handed off or not.
   */
  public static readonly usageHandOffSource: string;
  /**
   * The chatWakeSource protocol value: the `source` of the message a chat's wake posts when the work it sent to another chat ends, whose text is what its teammate reads.
   */
  public static readonly chatWakeSource: string;
  /**
   * The wakeReceivedSource protocol value: the `source` of the note at the top of a reply that a chat's wake started, which names the chat and its replies for the person.
   */
  public static readonly wakeReceivedSource: string;
  /**
   * Name of the field carrying the ID of the chat a wake came from: `wakeChatId`.
   */
  public static readonly wakeChatField: string;
  /**
   * Name of the field carrying a wake's replies for the person, each with its teammate's `name`, its `status` and its `text` or null: `wakeReplies`.
   */
  public static readonly wakeRepliesField: string;
  /**
   * Name of the field carrying the ID of the reply a chat's wake started: `wakeReplyId`.
   */
  public static readonly wakeReplyField: string;
  /**
   * Name of the field saying why a chat's wake brought no replies back, `lost` or `chatDeleted`, absent when they came back: `wakeEnd`.
   */
  public static readonly wakeEndField: string;
  /**
   * Name of the field carrying, for a sub-agent's or background command's wake, what the person sees of it: its `kind`, `subAgent` or
   * `command`, its `name`, how it `ending`, in words without IDs, or null while it never ended, and its result `text` or null: `wakeTask`.
   */
  public static readonly wakeTaskField: string;
  /**
   * The `kind` of a sub-agent's wake in `wakeTask`: `subAgent`.
   */
  public static readonly wakeSubAgentTask: string;
  /**
   * The `kind` of a background command's wake in `wakeTask`: `command`.
   */
  public static readonly wakeCommandTask: string;
  /**
   * Name of the field carrying how a sub-agent or background command ended, in words: `ending`.
   */
  public static readonly endingField: string;
  /**
   * The `wakeEnd` of a wake TeamRun lost by restarting before the work it sent ended: `lost`.
   */
  public static readonly wakeLostEnd: string;
  /**
   * The `wakeEnd` of a wake whose chat was deleted before the work sent there ended: `chatDeleted`.
   */
  public static readonly wakeChatDeletedEnd: string;
  /**
   * The fixed opening of the text of a chat's wake TeamRun lost by restarting, which tells such a wake stored without a `wakeEnd` apart.
   */
  public static readonly wakeLostOpening: string;
  /**
   * The fixed opening of the text of a chat's wake whose chat was deleted, which tells such a wake stored without a `wakeEnd` apart.
   */
  public static readonly wakeChatDeletedOpening: string;
  /**
   * The fixed opening of the text of a background command's wake TeamRun lost by restarting, which tells such a wake stored without a view apart.
   */
  public static readonly wakeCommandLostOpening: string;
  /**
   * The fixed opening of the text of a sub-agent's wake TeamRun lost by restarting, which tells such a wake stored without a view apart.
   */
  public static readonly wakeSubAgentLostOpening: string;
  /**
   * The resumeSource protocol value: the `source` of the note that a provider could not resume a chat's native session and started a fresh one.
   */
  public static readonly resumeSource: string;
  /**
   * The changesNoteField protocol value: the payload field, `true`, of a working-tree note the Changes panel lists, such as the note that a reply's
   * commands ran outside the chat's folder.
   */
  public static readonly changesNoteField: string;
  /**
   * The writesField protocol value: the payload field of a command step that lists the files its command names as written, as the command
   * gives them, relative to the folder it ran in or absolute.
   */
  public static readonly writesField: string;
  /**
   * The unnamedWritesField protocol value: the payload field of a command step that lists the folders, relative to the folder the command
   * ran in or absolute, where it ran something that may write files it doesn't name.
   */
  public static readonly unnamedWritesField: string;
  /**
   * The texts of the notes that replies stored before TeamRun stopped writing them say when they were cancelled; a cancelled reply's note
   * with one of these texts is its status, not a step.
   */
  public static readonly cancelledReplyNotes: readonly string[];
  /**
   * The sourceField protocol value.
   */
  public static readonly sourceField: string;
  /**
   * The isErrorField protocol value.
   */
  public static readonly isErrorField: string;
  /**
   * Name of the field a provider sets to `true` on a step the person denied: `denied`.
   */
  public static readonly deniedField: string;
  /**
   * The toolUseIdField protocol value.
   */
  public static readonly toolUseIdField: string;
  /**
   * The moveKind protocol value.
   */
  public static readonly moveKind: string;
  /**
   * The jsonObjectStart protocol value.
   */
  public static readonly jsonObjectStart: string;
  /**
   * The typeField protocol value.
   */
  public static readonly typeField: string;
  /**
   * The movePathField protocol value.
   */
  public static readonly movePathField: string;
  /**
   * The diffContextPrefix protocol value.
   */
  public static readonly diffContextPrefix: string;
  /**
   * The diffRemovedPrefix protocol value.
   */
  public static readonly diffRemovedPrefix: string;
  /**
   * The diffAddedPrefix protocol value.
   */
  public static readonly diffAddedPrefix: string;
  /**
   * The diffHunkPrefix protocol value.
   */
  public static readonly diffHunkPrefix: string;
  /**
   * The diffRemovedFilePrefix protocol value.
   */
  public static readonly diffRemovedFilePrefix: string;
  /**
   * The diffAddedFilePrefix protocol value.
   */
  public static readonly diffAddedFilePrefix: string;
  /**
   * The lineSeparator protocol value.
   */
  public static readonly lineSeparator: string;
  /**
   * The contentField protocol value.
   */
  public static readonly contentField: string;
  /**
   * The addKind protocol value.
   */
  public static readonly addKind: string;
  /**
   * The writeTool protocol value.
   */
  public static readonly writeTool: string;
  /**
   * The editsField protocol value.
   */
  public static readonly editsField: string;
  /**
   * The multiEditTool protocol value.
   */
  public static readonly multiEditTool: string;
  /**
   * The newStringField protocol value.
   */
  public static readonly newStringField: string;
  /**
   * The oldStringField protocol value.
   */
  public static readonly oldStringField: string;
  /**
   * The updateKind protocol value.
   */
  public static readonly updateKind: string;
  /**
   * The editTool protocol value.
   */
  public static readonly editTool: string;
  /**
   * The filePathField protocol value.
   */
  public static readonly filePathField: string;
  /**
   * The notebookEditTool protocol value: Claude's tool that changes one cell of a Jupyter notebook.
   */
  public static readonly notebookEditTool: string;
  /**
   * The notebookPathField protocol value: the input field that names the notebook a NotebookEdit changes.
   */
  public static readonly notebookPathField: string;
  /**
   * The newSourceField protocol value: the input field that holds a NotebookEdit's new cell source.
   */
  public static readonly newSourceField: string;
  /**
   * The editModeField protocol value: the input field that says whether a NotebookEdit replaces, inserts or deletes its cell.
   */
  public static readonly editModeField: string;
  /**
   * The deleteEditMode protocol value: the edit mode of a NotebookEdit that deletes its cell.
   */
  public static readonly deleteEditMode: string;
  /**
   * The inputField protocol value.
   */
  public static readonly inputField: string;
  /**
   * The toolField protocol value.
   */
  public static readonly toolField: string;
  public static readonly servedToolField: string;
  public static readonly servedInputField: string;
  /**
   * The diffField protocol value.
   */
  public static readonly diffField: string;
  /**
   * The pathField protocol value.
   */
  public static readonly pathField: string;
  /**
   * The pathsField protocol value.
   */
  public static readonly pathsField: string;
  /**
   * The changesField protocol value.
   */
  public static readonly changesField: string;
  /**
   * The deleteKind protocol value.
   */
  public static readonly deleteKind: string;
  /**
   * The savedPathField protocol value.
   */
  public static readonly savedPathField: string;
  /**
   * The imageDataField protocol value.
   */
  public static readonly imageDataField: string;
  /**
   * The payload field a provider sets to `true` on a step that only reads, searches or lists, such as a Codex command whose every
   * action Codex parsed is a read, a listing or a search.
   */
  public static readonly readOnlyField: string;
  /**
   * The payload `tool` names of steps that only read, search or fetch: Claude Code's reading tools.
   */
  public static readonly readingTools: readonly string[];
  /**
   * The Agent Client Protocol's read, search and fetch tool kinds, which a step's payload `tool` names only on a step with a
   * {@link acpToolCallIdField}.
   */
  public static readonly acpReadingKinds: readonly string[];
  /**
   * The payload field that holds an Agent Client Protocol tool call's id, which only an Agent Client Protocol step carries.
   */
  public static readonly acpToolCallIdField: string;
  /**
   * Matches a path that ends in an image kind's extension.
   */
  public static readonly writtenImagePathPattern: RegExp;
  /**
   * Finds absolute paths to image files within a reply's text.
   */
  public static readonly writtenImagePathSearch: RegExp;
  /**
   * The backslash protocol value.
   */
  public static readonly backslash: string;
  /**
   * The slash protocol value.
   */
  public static readonly slash: string;
  /**
   * Matches a path's trailing slashes.
   */
  public static readonly trailingSlashesPattern: RegExp;
  /**
   * The beforeSequenceField protocol value.
   */
  public static readonly beforeSequenceField: string;
  /**
   * The kindsField protocol value.
   */
  public static readonly kindsField: string;
  /**
   * The messagesField protocol value.
   */
  public static readonly messagesField: string;
  /**
   * The hasEarlierField protocol value.
   */
  public static readonly hasEarlierField: string;
  /**
   * The hasLaterField protocol value.
   */
  public static readonly hasLaterField: string;
  /**
   * The ranCommandsField protocol value.
   */
  public static readonly ranCommandsField: string;
  /**
   * The countField protocol value.
   */
  public static readonly countField: string;
  /**
   * The maximumPageSize protocol value.
   */
  public static readonly maximumPageSize: number;
  /**
   * The pageCursorsMismatch protocol value.
   */
  public static readonly pageCursorsMismatch: string;

  /**
   * The protocol version this package implements as `major.minor` text, stamped by the build from
   * the root manifest's `teamrun.protocolVersion`. A `0` major means pre-release.
   */
  public static readonly protocolVersion: string;
  /**
   * Separator between the parts of a protocol version: `.`.
   */
  public static readonly versionSeparator: string;
  /**
   * Decimal major/minor text pattern; the parser requires the match to cover the entire input.
   */
  public static readonly versionTextPattern: RegExp;
  /**
   * Name of the field that carries a message's `WireMessageKind`, a provider kind's id, or another kind: `kind`.
   */
  public static readonly kindField: string;
  /**
   * Name of the field that correlates requests and responses: `id`.
   */
  public static readonly idField: string;
  /**
   * Name of the hello's version field: `version`.
   */
  public static readonly versionField: string;
  /**
   * Name of a provider tool's found field: `found`.
   */
  public static readonly foundField: string;
  /**
   * Name of a provider tool's install command field: `installCommand`.
   */
  public static readonly installCommandField: string;
  /**
   * Name of a provider tool's subscribe page field: `subscribeUrl`.
   */
  public static readonly subscribeUrlField: string;
  /**
   * Name of the first launch's finished time field: `finishedAt`.
   */
  public static readonly finishedAtField: string;
  /**
   * Name of a protocol version's major field: `major`.
   */
  public static readonly majorField: string;
  /**
   * Name of a protocol version's minor field: `minor`.
   */
  public static readonly minorField: string;
  /**
   * Name of the hello's token field: `token`.
   */
  public static readonly tokenField: string;
  /**
   * Name of the hello's client field: `client`.
   */
  public static readonly clientField: string;
  /**
   * Name of a request's method field: `method`.
   */
  public static readonly methodField: string;
  /**
   * Name of an error's message field: `message`.
   */
  public static readonly messageField: string;
  /**
   * Name of an error's detail field: `detail`.
   */
  public static readonly detailField: string;
  /**
   * Name of an event's name field: `name`.
   */
  public static readonly nameField: string;
  /**
   * Name of the field that carries a request's parameters, a response's result, or an event's
   * payload: `payload`.
   */
  public static readonly payloadField: string;
  /**
   * Name of the response field that carries the failure's info: `info`.
   */
  public static readonly infoField: string;
  /**
   * Name of the info field that carries the failure's arguments: `arguments`.
   */
  public static readonly argumentsField: string;
  /**
   * Path reported for a response's payload when a reader rejects it: `$.payload`.
   */
  public static readonly payloadPath: string;
  /**
   * Name of the creation timestamp field of a model: `createdAt`.
   */
  public static readonly createdAtField: string;
  /**
   * Name of a message detail's field naming the sub-agent detail it belongs to: `parentSequence`.
   */
  public static readonly parentSequenceField: string;
  /**
   * Name of a sub-agent's field saying whether it runs in the background: `isBackground`.
   */
  public static readonly isBackgroundField: string;
  public static readonly isTeamRunField: string;
  /**
   * Name of a sub-agent's field counting its tool calls: `toolUses`.
   */
  public static readonly toolUsesField: string;
  /**
   * Name of a sub-agent's field counting its tokens: `tokens`.
   */
  public static readonly tokensField: string;
  /**
   * Name of a sub-agent's field giving how long it has run, in milliseconds: `durationMs`.
   */
  public static readonly durationMsField: string;
  /**
   * Name of the last-update timestamp field of a model: `updatedAt`.
   */
  public static readonly updatedAtField: string;
  /** Name of a department's leader field: `leaderId`. */
  public static readonly leaderIdField: string;
  /** Name of a department's order field among its siblings: `order`. */
  public static readonly orderField: string;
  /** Name of a department id field: `departmentId`. */
  public static readonly departmentIdField: string;
  /** Name of an organization's departments field: `departments`. */
  public static readonly departmentsField: string;
  /** Name of a department's or placement's parent field: `parent`. */
  public static readonly parentField: string;
  /** Name of an organization's placements field: `placements`. */
  public static readonly placementsField: string;
  /** What a department name may be: 1 to 100 characters with no line break or other control character. */
  public static readonly departmentNamePattern: RegExp;
  /** Why a department name is refused: it is blank, longer than 100 characters, or holds a line break or other control character. */
  public static readonly invalidDepartmentName: string;
  /** Why a department's order is refused: it isn't a whole number from 0. */
  public static readonly invalidDepartmentOrder: string;
  /** Why a department naming itself as its parent is refused. */
  public static readonly departmentOwnParent: string;
  /** Why a department update that changes nothing is refused. */
  public static readonly emptyDepartmentUpdate: string;
  /** Why an organization with two departments of one id is refused. */
  public static readonly duplicateDepartment: string;
  /** Why a parent that names no id for a teammate or department, or an id for the person, is refused. */
  public static readonly organizationParentIdRequired: string;
  /** Why a teammate or department under itself, directly or through others, is refused. */
  public static readonly organizationNodeUnderItself: string;
  /** Why a place's order that isn't a whole number from 0 is refused. */
  public static readonly invalidOrganizationOrder: string;
  /** Why a parent that is neither the person, a placed teammate nor one of the organization's departments is refused. */
  public static readonly unknownOrganizationParent: string;
  /** Why an organization that places a teammate twice is refused. */
  public static readonly teammatePlacedTwice: string;
  /** Why an organization name that isn't 1 to 100 characters on one line is refused. */
  public static readonly invalidOrganizationName: string;
  /** Why a blank default folder is refused. */
  public static readonly blankOrganizationFolder: string;
  /** Why an organization's order in the list that isn't a whole number from 0 is refused. */
  public static readonly invalidOrganizationListOrder: string;
  /** The id of the organization every database starts with, "My organization". */
  public static readonly defaultOrganizationId: string;
  /** Why moving the person is refused. */
  public static readonly personCannotMove: string;
  /**
   * Name of a draft's revision field: `revision`.
   */
  public static readonly revisionField: string;
  /**
   * Name of the field listing a draft's files that are gone: `missing`.
   */
  public static readonly missingField: string;
  public static readonly stateField: string;
  public static readonly reasonField: string;
  /** Name of a shared MCP server unavailability's reason in a few words: `short`. */
  public static readonly shortField: string;
  public static readonly receivedField: string;
  public static readonly totalField: string;
  /**
   * Name of the field carrying the newer version an update would install: `update`.
   */
  public static readonly updateField: string;
  public static readonly cancellableField: string;
  /**
   * Name of the field carrying the program an install lacks: `missingTool`.
   */
  public static readonly missingToolField: string;
  /**
   * Name of a kind installation's path of a program found outside TeamRun's own install: `foundPath`.
   */
  public static readonly foundPathField: string;
  /**
   * Name of a provider's label field: `label`.
   */
  public static readonly labelField: string;
  /**
   * Name of a permission detail's value field: `value`.
   */
  public static readonly valueField: string;
  /**
   * Name of a permission payload's requesting module field: `module`.
   */
  public static readonly moduleField: string;
  /**
   * Name of a permission payload's subject field: `subject`.
   */
  public static readonly subjectField: string;
  /**
   * Name of a permission payload's risk field: `risk`.
   */
  public static readonly riskField: string;
  /**
   * Name of a provider's profile directory field: `profileDir`.
   */
  public static readonly profileDirField: string;
  /**
   * Name of a provider's `AuthStatus` field: `authStatus`.
   */
  public static readonly authStatusField: string;
  /**
   * Name of a provider's identity field: `identity`.
   */
  public static readonly identityField: string;
  /**
   * Name of an observed harness version field: `harnessVersion`.
   */
  public static readonly harnessVersionField: string;
  public static readonly unavailableModelField: string;
  /**
   * Name of a provider's last-check timestamp field: `lastCheckedAt`.
   */
  public static readonly lastCheckedAtField: string;
  /**
   * Name of a provider's last-error field: `lastError`.
   */
  public static readonly lastErrorField: string;
  /**
   * Name of a provider identity's email field: `email`.
   */
  public static readonly emailField: string;
  /**
   * Name of a provider identity's plan field: `plan`.
   */
  public static readonly planField: string;
  /**
   * Name of a provider identity's organization field: `organization`.
   */
  public static readonly organizationField: string;
  /**
   * Name of a provider identity's authentication method field: `authMethod`.
   */
  public static readonly authMethodField: string;
  /**
   * Name of a provider identity's user name field: `userName`.
   */
  public static readonly userNameField: string;
  /**
   * The account line of a signed-in provider that reports neither an email nor a user name.
   */
  public static readonly accountNotReported: string;
  /**
   * Name of a project's root path field: `rootPath`.
   */
  public static readonly rootPathField: string;
  /**
   * Name of the field referencing a project: `projectId`.
   */
  public static readonly projectIdField: string;
  /**
   * Name of the field holding a project: `project`.
   */
  public static readonly projectField: string;
  /**
   * Name of the field saying whether a project's folder is missing, unreachable or no longer a
   * folder: `folderMissing`.
   */
  public static readonly folderMissingField: string;
  /**
   * Name of a title field: `title`.
   */
  public static readonly titleField: string;
  /**
   * Name of the field referencing a chat: `chatId`.
   */
  public static readonly chatIdField: string;
  /**
   * The field referencing a chat, under its earlier constant name; its value is `chatId`.
   *
   * @deprecated Use `chatIdField`.
   */
  public static readonly conversationIdField: string;
  /**
   * Name of the field naming the chat a window shows: `shownChatId`.
   */
  public static readonly shownChatIdField: string;
  /**
   * The field naming the chat a window shows, under its earlier constant name; its value is `shownChatId`.
   *
   * @deprecated Use `shownChatIdField`.
   */
  public static readonly shownConversationIdField: string;
  /**
   * Name of the field naming a window: `windowId`.
   */
  public static readonly windowIdField: string;
  /**
   * Name of the field naming a panel request: `requestId`.
   */
  public static readonly requestIdField: string;
  /**
   * Name of the field naming a panel: `panel`.
   */
  public static readonly panelField: string;
  /**
   * Name of the field saying whether a panel opens: `open`.
   */
  public static readonly openField: string;
  /**
   * Name of the field saying whether the person focused the window: `focused`.
   */
  public static readonly focusedField: string;
  /**
   * Name of a message's position field: `sequence`.
   */
  public static readonly sequenceField: string;
  /**
   * Name of a message's `MessageAuthor` field: `author`.
   */
  public static readonly authorField: string;
  /**
   * Name of the field referencing the message a reply answers: `inReplyTo`.
   */
  public static readonly inReplyToField: string;
  /**
   * Name of a message's details field: `details`.
   */
  public static readonly detailsField: string;
  /**
   * Name of a provider message's provenance field: `provenance`.
   */
  public static readonly provenanceField: string;
  /**
   * Name of the field referencing a message: `messageId`.
   */
  public static readonly messageIdField: string;
  /**
   * Name of a reading position's distance field: `distance`.
   */
  public static readonly distanceField: string;
  /**
   * Name of a reading position save's positions field: `positions`.
   */
  public static readonly positionsField: string;
  /**
   * Name of a reading position save's cleared chats field: `cleared`.
   */
  public static readonly clearedField: string;
  /**
   * Name of a reading position save's dropped positions field: `dropped`.
   */
  public static readonly droppedField: string;
  /**
   * Name of a message's text field: `text`.
   */
  public static readonly textField: string;
  /**
   * Name of a plan step's active text field: `activeText`.
   */
  public static readonly activeTextField: string;
  /**
   * Name of a plan's steps field: `steps`.
   */
  public static readonly stepsField: string;
  /**
   * Name of a plan's explanation field: `explanation`.
   */
  public static readonly explanationField: string;
  /**
   * Name of the field saying the person refused a plan-mode plan: `rejected`.
   */
  public static readonly rejectedField: string;
  /**
   * Name of the field saying the person approved a plan-mode plan: `approved`.
   */
  public static readonly approvedField: string;
  /**
   * Name of the field referencing a provider: `providerId`.
   */
  public static readonly providerIdField: string;
  /**
   * Name of the field saying whether a provider is enabled: `enabled`.
   */
  public static readonly enabledField: string;
  /**
   * Name of the field listing providers: `providerIds`.
   */
  public static readonly providerIdsField: string;
  /**
   * Name of a sign-in link's page field: `url`.
   */
  public static readonly urlField: string;
  /**
   * Name of a provenance's requested settings field: `requested`.
   */
  public static readonly requestedField: string;
  /**
   * Name of a provenance's observed settings field: `observed`.
   */
  public static readonly observedField: string;
  /**
   * Name of a model name field: `model`.
   */
  public static readonly modelField: string;
  /**
   * Name of a reasoning effort field: `effort`.
   */
  public static readonly effortField: string;
  /**
   * Name of a provenance's native session field: `nativeSessionId`.
   */
  public static readonly nativeSessionIdField: string;
  /**
   * Name of a provenance's resumed-session flag: `resumedNativeSession`.
   */
  public static readonly resumedNativeSessionField: string;
  /**
   * Name of a provenance's native turn id: `nativeTurnId`.
   */
  public static readonly nativeTurnIdField: string;
  /**
   * Name of a forked session's turn to resume at: `resumeAt`.
   */
  public static readonly resumeAtField: string;
  /**
   * Name of a status field: `status`.
   */
  public static readonly statusField: string;
  /**
   * Name of a reply's start timestamp field: `startedAt`.
   */
  public static readonly startedAtField: string;
  /**
   * Name of a message's end timestamp field: `endedAt`.
   */
  public static readonly endedAtField: string;
  /**
   * Name of an approval's summary field: `summary`.
   */
  public static readonly summaryField: string;
  /**
   * Name of an approval's decision timestamp field: `decidedAt`.
   */
  public static readonly decidedAtField: string;
  /**
   * Name of an approval's provider-defined kind field: `nativeKind`.
   */
  public static readonly nativeKindField: string;
  /**
   * Name of an approval's options field: `options`.
   */
  public static readonly optionsField: string;
  /**
   * Name of an approval's decision field: `decision`.
   */
  public static readonly decisionField: string;
  /**
   * Name of an approval option's outcome field: `outcome`.
   */
  public static readonly outcomeField: string;
  /**
   * Name of an approval option's scope field: `scope`.
   */
  public static readonly scopeField: string;
  /**
   * Name of a provider descriptor's display name field: `displayName`.
   */
  public static readonly displayNameField: string;
  /**
   * Name of a provider model's effort levels field: `effortLevels`.
   */
  public static readonly effortLevelsField: string;
  /**
   * Name of a provider descriptor's resume flag: `supportsResume`.
   */
  public static readonly supportsResumeField: string;
  /**
   * Name of a provider descriptor's sign-in check flag: `supportsSignInCheck`.
   */
  public static readonly supportsSignInCheckField: string;
  /**
   * Name of a provider descriptor's fork flag: `supportsFork`.
   */
  public static readonly supportsForkField: string;
  /**
   * Name of a provider descriptor's sign-in flag: `supportsSignIn`.
   */
  public static readonly supportsSignInField: string;
  /**
   * Name of a provider descriptor's sign-out flag: `supportsSignOut`.
   */
  public static readonly supportsSignOutField: string;
  /**
   * Name of a provider descriptor's command for signing out in the provider's own tool: `signOutCommand`.
   */
  public static readonly signOutCommandField: string;
  /**
   * Name of a provider descriptor's flag for a sign-out command that runs by itself and ends the sign-out: `signOutEndsWithCommand`.
   */
  public static readonly signOutEndsWithCommandField: string;
  /**
   * Name of a provider descriptor's reason that this computer takes one provider of the kind: `singleAccount`.
   */
  public static readonly singleAccountField: string;
  /**
   * Name of a provider descriptor's note on what its own-MCP-servers switch covers: `ownMcpServersNote`.
   */
  public static readonly ownMcpServersNoteField: string;
  /**
   * Name of a provider descriptor's note in a few words: `ownMcpServersShortNote`.
   */
  public static readonly ownMcpServersShortNoteField: string;
  /**
   * Name of a provider descriptor's flag that its sign-in is known for sure only once a prompt runs: `confirmsSignInAtPrompt`.
   */
  public static readonly confirmsSignInAtPromptField: string;
  /**
   * Name of a provider's chosen server path: `binaryPath`.
   */
  public static readonly binaryPathField: string;
  /**
   * Name of a provider descriptor's flag that a provider of the kind can name the server it runs: `choosesServerPath`.
   */
  public static readonly choosesServerPathField: string;
  /**
   * Name of a provider descriptor's flag that TeamRun reads the kind's usage limits: `reportsLimits`.
   */
  public static readonly reportsLimitsField: string;
  /**
   * Name of a provider descriptor's flag that the kind's sessions go on under another of its accounts: `carriesSessions`.
   */
  public static readonly carriesSessionsField: string;
  /**
   * Name of a provider descriptor's flag that the kind's `carriesSessions` was checked rather than assumed: `sessionsChecked`.
   */
  public static readonly sessionsCheckedField: string;
  /**
   * Name of a teammate's list of teammates that take a turn when its usage runs out: `usageHandOffs`.
   */
  public static readonly usageHandOffsField: string;
  /**
   * Name of a teammate's Sustain switch: `sustain`.
   */
  public static readonly sustainField: string;
  /**
   * Name of a teammate's Sustain entries after its own: `fallbacks`.
   */
  public static readonly fallbacksField: string;
  /**
   * Name of a teammate's option that the entry whose usage resets soonest goes first: `resetsSoonestFirst`.
   */
  public static readonly resetsSoonestFirstField: string;
  public static readonly defaultModelNameField: string;
  /**
   * Name of a provider descriptor's flag that its own configuration names its defaults: `followsOwnConfig`.
   */
  public static readonly followsOwnConfigField: string;
  /** Name of a provider descriptor's answers for each ability: `abilities`. */
  public static readonly abilitiesField: string;
  /** Name of a provider's answers keyed by ability: `cells`. */
  public static readonly cellsField: string;
  /** Name of an ability's answer: `answer`. */
  public static readonly answerField: string;
  /**
   * Name of a provider descriptor's flag that it can name a chat: `namesChats`.
   */
  public static readonly namesChatsField: string;
  /**
   * Name of a model list's flag that a read behind it failed: `partial`.
   */
  public static readonly partialField: string;
  /**
   * Name of a model list request's folder: `workingDirectory`.
   */
  public static readonly workingDirectoryField: string;
  /**
   * Name of a message listing's lower bound field: `afterSequence`.
   */
  public static readonly afterSequenceField: string;
  public static readonly restoreFilesField: string;
  /**
   * Name of a search's text: `query`.
   */
  public static readonly queryField: string;
  /**
   * Name of a search's limit: `limit`.
   */
  public static readonly limitField: string;
  /**
   * Name of a search result's hits: `hits`.
   */
  public static readonly hitsField: string;
  /**
   * Name of whether a search's total is capped: `capped`.
   */
  public static readonly cappedField: string;
  /**
   * Name of a search hit's snippet: `snippet`.
   */
  public static readonly snippetField: string;
  /**
   * Name of a found chat's teammates' names: `teammateNames`.
   */
  public static readonly teammateNamesField: string;
  /**
   * The most hits a search may ask for: 100.
   */
  public static readonly maximumSearchLimit: number;
  /**
   * Message of the exception a search limit outside 1–100 raises.
   */
  public static readonly searchLimitOutOfRange: string;
  public static readonly removedMessageIdsField: string;
  public static readonly restoredFilesField: string;
  public static readonly fromSequenceField: string;
  public static readonly sessionResetField: string;
  /**
   * Name of a chat's field that says it was changed, so New chat doesn't reuse it: `edited`.
   */
  public static readonly editedField: string;
  /**
   * Name of the field that says the person chose a chat's responder settings: `chosen`.
   */
  public static readonly chosenField: string;
  /**
   * Name of the field that asks to set a chat's responder only when the chat holds none: `start`.
   */
  public static readonly startField: string;
  /**
   * Name of a chat's forked session field: `forkedSession`.
   */
  public static readonly forkedSessionField: string;
  /**
   * Name of a rewind result's kept-session flag: `sessionKept`.
   */
  public static readonly sessionKeptField: string;
  /**
   * Name of a rewind result's field that says why no files were restored: `restoreRefusal`.
   */
  public static readonly restoreRefusalField: string;
  /**
   * Name of a rewind result's field holding the chat: `chat`.
   */
  public static readonly chatField: string;
  /**
   * A rewind result's chat field, under its earlier constant name; its value is `chat`.
   *
   * @deprecated Use `chatField`.
   */
  public static readonly conversationField: string;
  /**
   * Name of a send result's stored user message field: `sent`.
   */
  public static readonly sentField: string;
  /**
   * Name of the field referencing an approval: `approvalId`.
   */
  public static readonly approvalIdField: string;
  /**
   * Name of the field naming a chosen approval option: `optionId`.
   */
  public static readonly optionIdField: string;
  /**
   * Name of a provenance's reply usage: `usage`.
   */
  public static readonly usageField: string;
  /**
   * Name of a reply's input tokens: `inputTokens`.
   */
  public static readonly inputTokensField: string;
  /**
   * Name of a reply's output tokens: `outputTokens`.
   */
  public static readonly outputTokensField: string;
  /**
   * Name of a reply's cost in US dollars: `costUsd`.
   */
  public static readonly costUsdField: string;
  /**
   * Name of a reply's context use: `context`.
   */
  public static readonly contextField: string;
  /**
   * Name of the tokens in a session's context: `usedTokens`.
   */
  public static readonly usedTokensField: string;
  /**
   * Name of a context window's size in tokens: `windowTokens`.
   */
  public static readonly windowTokensField: string;
  /**
   * Name of the context use at which the provider compacts: `compactAtTokens`.
   */
  public static readonly compactAtTokensField: string;
  /**
   * Name of a plan usage's windows: `windows`.
   */
  public static readonly windowsField: string;
  /**
   * Name of a plan window's used percentage: `usedPercent`.
   */
  public static readonly usedPercentField: string;
  /**
   * Name of a plan window's reset time: `resetsAt`.
   */
  public static readonly resetsAtField: string;
  /**
   * Name of the time a plan usage was read: `readAt`.
   */
  public static readonly readAtField: string;
  /**
   * Name of whether a plan usage is used up: `usedUp`.
   */
  public static readonly usedUpField: string;
  /**
   * Name of the time a plan usage stops being used up: `usedUpUntil`.
   */
  public static readonly usedUpUntilField: string;
  /**
   * A whole window's percentage, 100, the least a used-up window rounds to.
   */
  public static readonly fullPercent: number;
  /**
   * Name of the field naming a background task: `taskId`.
   */
  public static readonly taskIdField: string;
  /**
   * Name of the field holding when a chat's finished background tasks were cleared: `clearedAt`.
   */
  public static readonly clearedAtField: string;
  /**
   * Name of the field carrying a background task's command line: `command`.
   */
  public static readonly commandField: string;
  /**
   * Name of the field carrying a background task's exit code: `exitCode`.
   */
  public static readonly exitCodeField: string;
  /**
   * Name of the field carrying a background task's output, or a Run's kept output: `output`.
   */
  public static readonly outputField: string;
  /**
   * Name of the field carrying the part of a message a Run's block is in: `site`.
   */
  public static readonly siteField: string;
  /**
   * Name of the field carrying a Run's block, by its index in its part of the message: `block`.
   */
  public static readonly blockField: string;
  /**
   * Name of the field carrying a background task's sub-agent: `subAgentId`.
   */
  public static readonly subAgentIdField: string;
  /**
   * Name of the field carrying an approval's questions: `questions`.
   */
  public static readonly questionsField: string;
  /**
   * Name of the field carrying the person's answers to an approval's questions: `answers`.
   */
  public static readonly answersField: string;
  /**
   * Name of the field carrying a question's short header: `header`.
   */
  public static readonly headerField: string;
  /**
   * Name of the field saying whether a question takes several options: `multiple`.
   */
  public static readonly multipleField: string;
  /**
   * Name of the field saying whether a question takes the person's own text: `other`.
   */
  public static readonly otherField: string;
  /**
   * Name of the field saying whether a question's text answer is masked and never stored: `secret`.
   */
  public static readonly secretField: string;
  /**
   * Name of the field naming the question an answer is for: `questionId`.
   */
  public static readonly questionIdField: string;
  /**
   * Name of the field carrying an answer's chosen option labels: `choices`.
   */
  public static readonly choicesField: string;
  /**
   * The most characters of output a background task keeps: its latest 65536.
   */
  public static readonly maximumBackgroundTaskOutput: number;
  /**
   * The most characters of a command a list carries for a background task: its first 4096.
   */
  public static readonly maximumListedCommand: number;
  /**
   * The first UTF-16 code unit of a high surrogate, which a cut command never ends on.
   */
  public static readonly firstHighSurrogate: number;
  /**
   * The last UTF-16 code unit of a high surrogate.
   */
  public static readonly lastHighSurrogate: number;
  /**
   * Name of the field saying a list cut a background task's command: `commandCut`.
   */
  public static readonly commandCutField: string;
  /**
   * Name of the field naming the background task a page starts after: `afterTaskId`.
   */
  public static readonly afterTaskIdField: string;
  /**
   * Name of the field listing background tasks: `tasks`.
   */
  public static readonly tasksField: string;
  /**
   * Message for provenance present on a message that is not a provider's, or absent on one that is.
   */
  public static readonly provenanceMismatch: string;
  /**
   * Message for an end time present on an open message or absent on an ended one.
   */
  public static readonly messageEndMismatch: string;
  /**
   * Message for a start time on a message that is not a provider's reply or on a reply still waiting, or none on a provider's
   * reply that runs or awaits approval.
   */
  public static readonly messageStartMismatch: string;
  /**
   * Message for a provider's message flagged as resumed without a native session id.
   */
  public static readonly resumedWithoutSession: string;

  /**
   * Message for a chat member whose session account is set without a native session.
   */
  public static readonly sessionProviderWithoutSession: string;
  /**
   * Message for an approval whose decision timestamp contradicts its status.
   */
  public static readonly approvalDecisionMismatch: string;
  /**
   * Message for an approval with no options or with duplicate option ids.
   */
  public static readonly approvalWithoutOptions: string;
  /**
   * Message for a text detail that names a sub-agent detail as its parent: the reply's text is always its own.
   */
  public static readonly nestedTextDetail: string;
  /**
   * Message for a decision present on a pending or cancelled approval, or absent on a decided one.
   */
  public static readonly decisionStatusMismatch: string;
  /**
   * Message for a decision that names no offered option.
   */
  public static readonly unknownDecision: string;
  /**
   * Message for a chosen option whose outcome contradicts the approval's status.
   */
  public static readonly decisionOutcomeMismatch: string;
  /**
   * Message for a secret permission detail with a value, or another detail without one.
   */
  public static readonly secretValueMismatch: string;
  /**
   * Message for a question approval with no questions or two sharing an id, or another approval with questions.
   */
  public static readonly questionsKindMismatch: string;
  /**
   * Message for answers on an approval that isn't an approved question approval, or answers naming an unknown or repeated question.
   */
  public static readonly answersStatusMismatch: string;
  /**
   * Message for a question with two options sharing a label.
   */
  public static readonly questionOptionRepeated: string;
  /** The refusal of a model whose default effort level isn't one of its effort levels, or whose named level is neither one of them nor its configured effort. */
  public static readonly effortNotListed: string;
  /** The refusal of a model with two speeds of the same id. */
  public static readonly speedRepeated: string;
  /** The refusal of a model whose default speed isn't one of its speeds. */
  public static readonly speedNotListed: string;
  /** The refusal of a model's context windows whose bounds or presets don't hold together. */
  public static readonly contextWindowsInvalid: string;
  /** The refusal of a chosen context window that isn't a positive whole number of tokens. */
  public static readonly chosenContextWindowInvalid: string;
  /** The refusal of a provider list with two modes of the same id. */
  public static readonly modeRepeated: string;
  /** The refusal of a provider list whose default mode isn't one of its modes. */
  public static readonly modeNotListed: string;
  /** The refusal of a panel request whose chat is missing for a chat panel, or given for another panel. */
  public static readonly panelChatMismatch: string;
  /** @deprecated Use `panelChatMismatch`; the earlier name goes in a later release. */
  public static readonly panelConversationMismatch: string;
  /**
   * Diagnostic for a panel answer whose outcome isn't a `PanelOutcome`.
   */
  public static readonly invalidPanelOutcome: string;
  /** Diagnostic for an ability answer that isn't an `AbilityAnswer`. */
  public static readonly invalidAbilityAnswer: string;
  /** Diagnostic for an ability source that isn't an `AbilitySource`. */
  public static readonly invalidAbilitySource: string;
  /** Diagnostic for a source given with an answer other than `Works`, or missing with `Works`. */
  public static readonly abilitySourceOnlyWhenWorks: string;
  /** Diagnostic for a blank detail, or a missing one with an answer other than `Works`. */
  public static readonly abilityDetailRequired: string;
  /** Diagnostic for a provider's answers that name a key that isn't an ability. */
  public static readonly unknownAbility: string;
  /** An ability's name, as the table and the Settings page show it: `Run and stop a turn`. */
  public static readonly abilityRunTurnName: string;
  /** An ability's name, as the table and the Settings page show it: `Resume a chat`. */
  public static readonly abilityResumeName: string;
  /** An ability's name, as the table and the Settings page show it: `Rewind within the provider's session`. */
  public static readonly abilityForkName: string;
  /** An ability's name, as the table and the Settings page show it: `Compact the context`. */
  public static readonly abilityCompactName: string;
  /** An ability's name, as the table and the Settings page show it: `Images in a message`. */
  public static readonly abilityImagesName: string;
  /** An ability's name, as the table and the Settings page show it: `Files in a message`. */
  public static readonly abilityFilesName: string;
  /** An ability's name, as the table and the Settings page show it: `Steer a message into a running turn`. */
  public static readonly abilitySteerTurnName: string;
  /** An ability's name, as the table and the Settings page show it: `Chat title written by the model`. */
  public static readonly abilityChatTitleName: string;
  /** An ability's name, as the table and the Settings page show it: `Choose a model`. */
  public static readonly abilityChooseModelName: string;
  /** An ability's name, as the table and the Settings page show it: `Choose an effort`. */
  public static readonly abilityChooseEffortName: string;
  /** An ability's name, as the table and the Settings page show it: `Choose a fast speed`. */
  public static readonly abilityChooseSpeedName: string;
  /** An ability's name, as the table and the Settings page show it: `Choose a context size`. */
  public static readonly abilityChooseContextName: string;
  /** An ability's name, as the table and the Settings page show it: `Plan mode`. */
  public static readonly abilityPlanModeName: string;
  /** An ability's name, as the table and the Settings page show it: `Read-only mode`. */
  public static readonly abilityReadOnlyModeName: string;
  /** An ability's name, as the table and the Settings page show it: `Unrestricted mode`. */
  public static readonly abilityUnrestrictedModeName: string;
  /** An ability's name, as the table and the Settings page show it: `Permission cards`. */
  public static readonly abilityPermissionCardsName: string;
  /** An ability's name, as the table and the Settings page show it: `TeamRun's approved tools run without asking`. */
  public static readonly abilityApprovedToolsName: string;
  /** An ability's name, as the table and the Settings page show it: `The provider asks the person questions`. */
  public static readonly abilityQuestionsName: string;
  /** An ability's name, as the table and the Settings page show it: `Plan checklist in the reply`. */
  public static readonly abilityPlanChecklistName: string;
  /** An ability's name, as the table and the Settings page show it: `Tokens and cost of a reply`. */
  public static readonly abilityReplyUsageName: string;
  /** An ability's name, as the table and the Settings page show it: `Plan-limit meters`. */
  public static readonly abilityPlanLimitsName: string;
  /** An ability's name, as the table and the Settings page show it: `Rows for the provider's own sub-agents`. */
  public static readonly abilitySubAgentRowsName: string;
  /** An ability's name, as the table and the Settings page show it: `A background sub-agent outlives its turn`. */
  public static readonly abilityBackgroundSubAgentsName: string;
  /** An ability's name, as the table and the Settings page show it: `Stop one sub-agent`. */
  public static readonly abilityStopSubAgentName: string;
  /** An ability's name, as the table and the Settings page show it: `Follow and stop background commands`. */
  public static readonly abilityBackgroundCommandsName: string;
  /** An ability's name, as the table and the Settings page show it: `TeamRun's explorer sub-agent`. */
  public static readonly abilityExplorerName: string;
  /** An ability's name, as the table and the Settings page show it: `Generated images in the reply`. */
  public static readonly abilityGeneratedImagesName: string;
  /** An ability's name, as the table and the Settings page show it: `TeamRun's tools in a turn`. */
  public static readonly abilityTeamRunToolsName: string;
  /** An ability's name, as the table and the Settings page show it: `Shared MCP servers, stdio`. */
  public static readonly abilitySharedStdioServersName: string;
  /** An ability's name, as the table and the Settings page show it: `Shared MCP servers, HTTP`. */
  public static readonly abilitySharedHttpServersName: string;
  /** An ability's name, as the table and the Settings page show it: `Switch the person's own servers on`. */
  public static readonly abilityOwnServersSwitchName: string;
  /** An ability's name, as the table and the Settings page show it: `List the person's own servers`. */
  public static readonly abilityOwnServersListName: string;
  /** An ability's name, as the table and the Settings page show it: `Sign in from TeamRun`. */
  public static readonly abilitySignInName: string;
  /** An ability's name, as the table and the Settings page show it: `Sign out from TeamRun`. */
  public static readonly abilitySignOutName: string;
  /** An ability's name, as the table and the Settings page show it: `Several accounts`. */
  public static readonly abilitySeveralAccountsName: string;
  /** An ability's name, as the table and the Settings page show it: `Show the signed-in account`. */
  public static readonly abilityAccountName: string;
  /** An ability's name, as the table and the Settings page show it: `Install and update from TeamRun`. */
  public static readonly abilityInstallName: string;
  /** An ability's name, as the table and the Settings page show it: `/compact`. */
  public static readonly abilityCompactCommandName: string;
  /** An ability's name, as the table and the Settings page show it: `Commands the provider lists`. */
  public static readonly abilityListedCommandsName: string;
  /** An ability's name, as the table and the Settings page show it: `Other built-in commands`. */
  public static readonly abilityBuiltInCommandsName: string;
  /** An ability's name, as the table and the Settings page show it: `Custom commands, prompts and skills`. */
  public static readonly abilityCustomCommandsName: string;
  /** An ability's name, as the table and the Settings page show it: `/logout`. */
  public static readonly abilityLogoutCommandName: string;
  /** The answer of an ability that works, before where it comes from. */
  public static readonly abilityWorksLabel: string;
  /** The answer of an ability the provider can't do. */
  public static readonly abilityCannotLabel: string;
  /** The answer of an ability TeamRun hasn't built for the provider. */
  public static readonly abilityNotBuiltLabel: string;
  /** The answer of an ability no one has seen work or fail against the provider. */
  public static readonly abilityNotCheckedLabel: string;
  /** The words a not-built reason starts with, for a control or command that has no answer beside it: `TeamRun doesn't support this for it yet`. */
  public static readonly abilityNotBuiltLead: string;
  /** The marks that may join `abilityNotBuiltLead` to the reason that follows it. */
  public static readonly abilityLeadJoins: string;
  /** The pronoun a reason may start with for the provider, which the Settings page gives as its name: `it `. */
  public static readonly abilityItSubject: string;
  /** The possessive a reason may start with for the provider, which the Settings page gives as its name's: `its `. */
  public static readonly abilityItsSubject: string;
  /** Where an ability comes from: ACP's own methods. */
  public static readonly abilityAcpSource: string;
  /** Where an ability comes from: the provider's addition to ACP. */
  public static readonly abilityAcpAdditionSource: string;
  /** Where an ability comes from: a path outside ACP. */
  public static readonly abilityOutsideSource: string;
  /** Where a working ability comes from, as the Settings page says it: ACP's own methods. */
  public static readonly abilityAcpNote: string;
  /** Where a working ability comes from, as the Settings page says it: the provider's addition to ACP. */
  public static readonly abilityAcpAdditionNote: string;
  /** Where a working ability comes from, as the Settings page says it: a path outside ACP. */
  public static readonly abilityOutsideNote: string;
  /**
   * Message for a question with no options that doesn't take the person's own text either.
   */
  public static readonly questionWithoutAnswer: string;
  /**
   * Message for an answer with a blank or repeated choice.
   */
  public static readonly answerChoiceInvalid: string;
  /**
   * Message for an answer with no choice and no text.
   */
  public static readonly answerWithoutChoice: string;
  /**
   * Message for a token count that isn't a non-negative integer, or a cost that isn't a non-negative number.
   */
  public static readonly usageFigureNegative: string;
  /**
   * Message for a context window or compaction point that isn't a positive integer.
   */
  public static readonly contextWindowInvalid: string;
  /**
   * Message for a plan window's used percentage that isn't a non-negative number.
   */
  public static readonly usedPercentInvalid: string;
  /**
   * Message for a plan usage that names a window twice.
   */
  public static readonly planWindowRepeated: string;
  /**
   * Message for a plan usage that names when it stops being used up while it isn't used up.
   */
  public static readonly usedUpUntilWithoutUsedUp: string;
  /**
   * Message for a running background task with an end time, or an ended one without it.
   */
  public static readonly backgroundTaskEndMismatch: string;
  /**
   * Message for a running background task with an exit code.
   */
  public static readonly backgroundTaskExitMismatch: string;
  /**
   * Message for protocol version text that is not two non-negative decimal integers separated by a dot.
   */
  public static readonly versionTextInvalid: string;
  /**
   * Name of the text parameter of `ProtocolVersion.parse`, reported by its argument exception.
   */
  public static readonly versionParameterName: string;
  /**
   * Message of the invariant that a successful response carries no info.
   */
  public static readonly successForbidsInfo: string;
  /**
   * Message of the invariant that a failed response carries its info.
   */
  public static readonly failureRequiresInfo: string;
  /**
   * Message of the invariant that a failed response carries no payload.
   */
  public static readonly failureForbidsPayload: string;
  /**
   * Message of the invariant that a failure's info is named by an `ErrorCode`.
   */
  public static readonly unknownErrorCode: string;

  /**
   * The start of the Terminal module's owner of a chat's terminals, `teamrun.chat/`, which the chat's id follows; the window part shows, hides
   * and opens a chat's terminals by it, and closes them by it when the chat is deleted.
   */
  public static readonly chatTerminalOwnerPrefix: string;
  /**
   * The Browser workspace, `teamrun-chats`, of a chat outside projects; a chat in a project uses its project's id. A chat's own Browser page
   * document takes the chat's id as its instance, since the Browser takes only a UUID there, so each chat's agents drive its own page.
   */
  public static readonly projectlessPageProfile: string;
  /** The name of TeamRun's MCP server, `teamrun`, under which each provider's configuration names it. */
  public static readonly mcpServerName: string;
  public static readonly transportField: string;
  public static readonly variablesField: string;
  public static readonly headersField: string;
  public static readonly bearerVariableField: string;
  public static readonly signsInField: string;
  public static readonly accountField: string;
  public static readonly gitHubMcpServerName: string;
  public static readonly gitHubMcpServerUrl: string;
  public static readonly signingInField: string;
  public static readonly signInField: string;
  public static readonly expiresAtField: string;
  public static readonly needsSignInField: string;
  public static readonly definitionField: string;
  public static readonly teammatesField: string;
  public static readonly settingField: string;
  public static readonly serverField: string;
  public static readonly serverIdField: string;
  public static readonly unavailableField: string;
  public static readonly onField: string;
  /** A shared MCP server's name: a lowercase letter, then up to 63 lowercase letters, digits, `_` or `-`. */
  public static readonly sharedMcpServerNamePattern: RegExp;
  /** An environment variable's name: letters, digits and `_`, starting with a letter or `_`. */
  public static readonly environmentVariablePattern: RegExp;
  /** A saved secret's reference in Noldova Desktop's secret store: `teamrun.mcpSecret` and 32 lowercase hexadecimal digits. */
  public static readonly sharedMcpSecretReferencePattern: RegExp;
  public static readonly sharedMcpSignInReferencePattern: RegExp;
  public static readonly aboutField: string;
  public static readonly notCheckedField: string;
  public static readonly addedField: string;
  public static readonly agentsField: string;
  public static readonly localCommandsField: string;
  public static readonly failureField: string;
  public static readonly fromOutsideField: string;
  public static readonly failureCodeField: string;
  public static readonly failureModuleCodeField: string;
  /** Name of a Browser step's field for the permission request that decided its call: `permission`, with `risk`, `decision`, `isRemembered` and `isAsked`. */
  public static readonly permissionField: string;
  /** Name of the field that says a remembered answer gave a decision: `isRemembered`. */
  public static readonly isRememberedField: string;
  /** Name of the field that says the reply showed a card for a permission request: `isAsked`. */
  public static readonly isAskedField: string;
  public static readonly noteField: string;
  public static readonly fetchedAtField: string;
  public static readonly environmentField: string;
  /** An HTTP header's name: an HTTP token. */
  public static readonly httpHeaderNamePattern: RegExp;
  /** The protocols an HTTP server's address may have, `http:` and `https:`. */
  public static readonly httpUrlProtocols: readonly string[];
  public static readonly secretQueryNamePattern: RegExp;
  public static readonly authorizationHeaderName: string;
  public static readonly invalidSharedMcpServerName: string;
  public static readonly invalidSharedMcpTransport: string;
  public static readonly invalidSharedMcpStdio: string;
  public static readonly invalidSharedMcpHttp: string;
  public static readonly invalidEnvironmentVariable: string;
  public static readonly duplicateSharedMcpVariable: string;
  public static readonly invalidHttpHeaderName: string;
  public static readonly duplicateHttpHeader: string;
  public static readonly sharedMcpAddressHoldsSecret: string;
  public static readonly authorizationHeaderWithBearer: string;
  public static readonly invalidSharedMcpSignsIn: string;
  public static readonly invalidSharedMcpAccount: string;
  public static readonly duplicateSharedMcpProvider: string;
  public static readonly duplicateSharedMcpTeammate: string;
  public static readonly invalidSharedMcpTeammateSetting: string;
  public static readonly invalidSharedMcpSetting: string;
  public static readonly invalidSharedMcpSignInReference: string;
  public static readonly invalidSharedMcpSignInUrl: string;
  public static readonly sharedMcpSignInWithoutSigningIn: string;
  public static readonly mcpVersionField: string;
  public static readonly mcpJsonRpcVersion: string;
  public static readonly mcpParamsField: string;
  public static readonly mcpResultField: string;
  public static readonly mcpErrorField: string;
  public static readonly mcpCodeField: string;
  public static readonly mcpRequestIdField: string;
  public static readonly mcpProtocolVersionField: string;
  public static readonly mcpCapabilitiesField: string;
  public static readonly mcpServerInfoField: string;
  public static readonly mcpInstructionsField: string;
  public static readonly mcpToolsField: string;
  public static readonly mcpListChangedField: string;
  public static readonly mcpIsErrorField: string;
  public static readonly mcpTextType: string;
  public static readonly mcpInitializeMethod: string;
  public static readonly mcpPingMethod: string;
  public static readonly mcpToolsListMethod: string;
  public static readonly mcpToolsCallMethod: string;
  public static readonly mcpCancelledNotification: string;
  /** The MCP protocol versions the server speaks, the latest first; it answers with a client's own when listed, else the latest. */
  public static readonly mcpProtocolVersions: readonly string[];
  public static readonly mcpParseErrorCode: number;
  public static readonly mcpInvalidRequestCode: number;
  public static readonly mcpUnknownMethodCode: number;
  public static readonly mcpInvalidParamsCode: number;
  public static readonly mcpInternalErrorCode: number;
  public static readonly mcpInvalidRequest: string;
  /** What a kind whose OwnServersSwitch cell refuses can't do, for `formatAbilityRefused`. */
  public static readonly ownServersSwitchAction: string;
  /** Why a shared MCP server that signs in with an account is refused at another origin than the account's own MCP address. */
  public static formatSharedMcpAccountAddress(account: string, origin: string): string;
  /** A context window's name in millions of tokens, such as `1M`. */
  public static formatMillionTokens(millions: number): string;
  /** A context window's name in thousands of tokens, to a tenth, such as `200K`. */
  public static formatThousandTokens(thousands: number): string;
  /**
   * The sentence that says why a provider can't do something, such as `Cursor can't change effort: its models each have one fixed setting.`
   * @param displayName The provider's name.
   * @param action What it can't do, such as `change effort`.
   * @param reason The ability cell's reason, a clause without a final period.
   */
  public static formatAbilityRefused(displayName: string, action: string, reason: string): string;
  /** A reason's subject when it names the provider, such as `Cursor `. */
  public static formatAbilitySubject(displayName: string): string;
  /** A reason's possessive when it names the provider, such as `Cursor's `. */
  public static formatAbilityOwner(displayName: string): string;
  /** The answer of an ability that works, with where it comes from, such as `Works, ACP`. */
  public static formatAbilityWorks(source: string): string;
  /** Diagnostic for a provider's answers that leave out an ability. */
  public static formatAbilityMissing(ability: string): string;
  /** Why a teammate update that names a field it doesn't have is refused. */
  public static formatUnknownTeammateUpdateField(field: string): string;
  /** The JSON-RPC error message for a method the MCP server doesn't have. */
  public static formatMcpUnknownMethod(method: string): string;
  /**
   * The text of a tool call's failure for the agent: its Noldova Desktop failure code, its module code when it has one, and its message,
   * such as `Unavailable (teamrun.noRunningTurn): ...`.
   */
  public static formatMcpToolFailure(code: string, moduleCode: string | null, message: string): string;
}

/**
 * Base of every message that crosses a process boundary.
 *
 * @remarks
 * A message owns its wire form: its constructor checks its invariants, `toJson` produces plain
 * JSON with the kind first, and each subclass declares a static `fromJson` that narrows untrusted
 * input through a `JsonReader`. Instances never cross a boundary; their JSON does.
 */
export declare abstract class WireMessage {
  /**
   * Discriminator written to the wire as the `kind` field.
   */
  public abstract readonly kind: WireMessageKind;

  /**
   * Renders the message as plain JSON.
   * @returns The `kind` field followed by the message's own fields.
   */
  public toJson(): JsonObject;

  /**
   * Renders the message as one line of JSON text, the form sent over a stream.
   * @returns The JSON text without line breaks.
   */
  public toText(): string;

  /**
   * Renders the message's own fields, without the kind.
   * @returns The fields as JSON.
   */
  protected abstract toJsonFields(): JsonObject;
}

/**
 * Version of the wire contract.
 *
 * @remarks
 * Compatibility currently requires an exact major and minor version match. Older and newer
 * protocol versions are rejected; accepting unknown fields does not establish compatibility.
 */
export declare class ProtocolVersion {
  /**
   * The version this package implements, parsed from `Resources.protocolVersion`, which the build
   * stamps from the root manifest. A `0` major means pre-release: the contract may still change
   * between minors.
   */
  public static readonly current: ProtocolVersion;
  /**
   * The major protocol version component.
   */
  public readonly major: number;
  /**
   * The minor protocol version component; compatibility requires an exact match.
   */
  public readonly minor: number;

  /**
   * Initializes the version.
   * @param major The major part, a non-negative integer.
   * @param minor The minor part, a non-negative integer.
   * @throws ArgumentOutOfRangeException when either part is negative or not an integer.
   */
  public constructor(major: number, minor: number);

  /**
   * Parses `major.minor` text, the form used in configuration and shown to users.
   * @param text Two nonempty sequences of ASCII decimal digits separated by one dot, such as `0.1`.
   * Leading zeroes are accepted; signs, whitespace, base prefixes and exponents are rejected.
   * @returns The version.
   * @throws ArgumentException when the text has another form or either component overflows a finite number.
   */
  public static parse(text: string): ProtocolVersion;

  /**
   * Reads a version from untrusted JSON.
   * @param value The untrusted value, expected to be an object with integer `major` and `minor`
   * fields.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The version.
   * @throws JsonException when the value is not such an object.
   */
  public static fromJson(value: unknown, path?: string): ProtocolVersion;

  /**
   * Decides whether a runtime at this version can serve a client.
   * @param client The version the client speaks.
   * @returns `true` when the client's major and minor both equal this version.
   */
  public canServe(client: ProtocolVersion): boolean;

  /**
   * Compares two versions.
   * @param other The version to compare with.
   * @returns `true` when major and minor are both equal.
   */
  public equals(other: ProtocolVersion): boolean;

  /**
   * Renders the version as plain JSON.
   * @returns An object with `major` and `minor` fields.
   */
  public toJson(): JsonObject;

  /**
   * Renders the version as text.
   * @returns The version as `major.minor`, such as `1.0`.
   */
  public toString(): string;
}

/**
 * First message on a connection: the client's protocol version, its capability token, and a name
 * for diagnostics.
 *
 * @remarks
 * The runtime answers a hello with a `Response` when the token is valid and the version can be
 * served, and with a failed `Response` named `Unauthorized` or `VersionMismatch` otherwise.
 */
export declare class Hello extends WireMessage {
  /**
   * Always `WireMessageKind.Hello`.
   */
  public override readonly kind: WireMessageKind;
  /**
   * The protocol version the client speaks.
   */
  public readonly version: ProtocolVersion;
  /**
   * The capability token that authorizes the connection.
   */
  public readonly token: string;
  /**
   * The client's name for diagnostics, such as `cli` or `desktop`.
   */
  public readonly client: string;

  /**
   * Initializes the hello.
   * @param version The protocol version the client speaks.
   * @param token The capability token; must not be blank.
   * @param client The client's name for diagnostics; must not be blank.
   * @throws ArgumentException when the token or the client name is blank.
   */
  public constructor(version: ProtocolVersion, token: string, client: string);

  /**
   * Reads a hello from untrusted JSON.
   * @param value The untrusted value, expected to carry `version`, `token`, and `client`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The hello.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): Hello;

  /**
   * Renders the message's own fields.
   * @returns The `version`, `token`, and `client` fields.
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * A call from a client to the runtime.
 *
 * @remarks
 * The id correlates the `Response`. The payload is the method's own JSON, narrowed by the
 * method's parameter class in the runtime.
 */
export declare class Request extends WireMessage {
  /**
   * Always `WireMessageKind.Request`.
   */
  public override readonly kind: WireMessageKind;
  /**
   * Client-chosen identifier, unique per connection, echoed by the response.
   */
  public readonly id: string;
  /**
   * Name of the runtime method to call.
   */
  public readonly method: string;
  /**
   * The method's parameters as JSON; `null` when the method takes none.
   */
  public readonly payload: JsonValue;

  /**
   * Initializes the request.
   * @param id The client-chosen identifier; must not be blank.
   * @param method The runtime method's name; must not be blank.
   * @param payload The method's parameters as JSON, or `null` for none.
   * @throws ArgumentException when the id or the method is blank.
   */
  public constructor(id: string, method: string, payload: JsonValue);

  /**
   * Reads a request from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `method`, and `payload`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The request.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): Request;

  /**
   * Renders the message's own fields.
   * @returns The `id`, `method`, and `payload` fields.
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * The answer to a request: the service envelope on the wire (D12). A success carries the
 * method's result as the payload; a failure carries the info that says why, named by an
 * `ErrorCode`, and no payload. A `null` id answers a hello or reports a connection-level failure.
 *
 * @remarks
 * `fromServiceResponse` and `withPayload` convert between this message and the foundation's typed
 * `ServiceResponse<T>`, so services and clients never touch the wire form. Instances come from the
 * factories.
 */
export declare class Response extends WireMessage {
  /**
   * Always `WireMessageKind.Response`.
   */
  public override readonly kind: WireMessageKind;
  /**
   * Identifier of the request being answered, or `null` for the answer to a hello or a failure
   * not tied to a request.
   */
  public readonly id: string | null;
  /**
   * Whether the request was honoured.
   */
  public readonly status: ServiceResponseStatus;
  /**
   * Why the request was not honoured, named by an `ErrorCode`; `null` on success.
   */
  public readonly info: ServiceResponseInfo | null;
  /**
   * The method's result as JSON; `null` on failure and when the method returns nothing.
   */
  public readonly payload: JsonValue;

  /**
   * True when the status is `Failure`.
   */
  public get hasErrors(): boolean;

  /**
   * Returns a success.
   * @param id Identifier of the request being answered, or `null`; a non-null id must not be blank.
   * @param payload The method's result as JSON, or `null` for none.
   * @returns The response.
   * @throws ArgumentException when a non-null id is blank.
   */
  public static success(id: string | null, payload: JsonValue): Response;

  /**
   * Returns a failure.
   * @param id Identifier of the failed request, or `null` for a connection-level failure.
   * @param info Why the request was not honoured; its name must be an `ErrorCode` value.
   * @returns The response.
   * @throws ArgumentException when a non-null id is blank or the info's name is not an error code.
   */
  public static failure(id: string | null, info: ServiceResponseInfo): Response;

  /**
   * Converts a typed service response to the wire: a failure keeps its info, a success writes its
   * payload with the writer, or `null` when it has none.
   * @param id Identifier of the request being answered, or `null`.
   * @param response The typed response.
   * @param writePayload Writes the payload as JSON.
   * @returns The response.
   */
  public static fromServiceResponse<T>(id: string | null, response: ServiceResponse<T>, writePayload: PayloadWriter<T>): Response;

  /**
   * Reads a response from untrusted JSON.
   * @param value The untrusted value, expected to carry `id` (possibly `null`), `status`, `info`
   * (an object with `name`, `message`, and `arguments`, or `null`), and `payload`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The response.
   * @throws JsonException when a field is missing or invalid, or the info's name is not an
   * `ErrorCode`; ArgumentException when the status contradicts the info or the payload.
   */
  public static fromJson(value: unknown, path?: string): Response;

  /**
   * Converts to the typed service response: a failure keeps its info, a success reads its payload
   * with the reader at `$.payload`, or carries `null` when there is none.
   * @param readPayload Reads the payload from its JSON value.
   * @returns The typed response.
   * @throws JsonException when the reader rejects the payload.
   */
  public withPayload<T>(readPayload: PayloadReader<T>): ServiceResponse<T>;

  /**
   * Renders the message's own fields.
   * @returns The `id`, `status`, `info`, and `payload` fields.
   */
  protected override toJsonFields(): JsonObject;

  private constructor(id: string | null, status: ServiceResponseStatus, info: ServiceResponseInfo | null, payload: JsonValue);
}

/**
 * A notification pushed by the runtime to every attached client.
 *
 * @remarks
 * The name selects the payload's class; the payload is narrowed by that class in the client.
 */
export declare class Event extends WireMessage {
  /**
   * Always `WireMessageKind.Event`.
   */
  public override readonly kind: WireMessageKind;
  /**
   * Name of the event, such as `run.updated`.
   */
  public readonly name: string;
  /**
   * The event's payload as JSON; `null` when the event carries none.
   */
  public readonly payload: JsonValue;

  /**
   * Initializes the event.
   * @param name The event's name; must not be blank.
   * @param payload The payload as JSON, or `null` for none.
   * @throws ArgumentException when the name is blank.
   */
  public constructor(name: string, payload: JsonValue);

  /**
   * Reads an event from untrusted JSON.
   * @param value The untrusted value, expected to carry `name` and `payload`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The event.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): Event;

  /**
   * Renders the message's own fields.
   * @returns The `name` and `payload` fields.
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * Turns text or a value received at a boundary into the wire message it carries.
 *
 * @remarks
 * This is the protocol's one dispatcher: it reads the `kind` field and hands the value to that
 * kind's `fromJson`. The result is the concrete message; callers narrow it with `instanceof`.
 *
 * @example
 * ```ts
 * const message = new WireDecoder().decodeText(line);
 * if (message instanceof Request)
 *   handle(message.method, message.payload);
 * ```
 */
export declare class WireDecoder {
  /**
   * Decodes one line of JSON text.
   * @param text The JSON text of one message.
   * @returns The concrete message: a `Hello`, `Request`, `Response`, or `Event`.
   * @throws JsonException when the text is not valid JSON, has no known `kind`, or fails that
   * kind's validation.
   */
  public decodeText(text: string): WireMessage;

  /**
   * Decodes an untrusted value that has already been parsed, such as a structured-clone payload.
   * @param value The untrusted value.
   * @returns The concrete message: a `Hello`, `Request`, `Response`, or `Event`.
   * @throws JsonException when the value has no known `kind` or fails that kind's validation.
   */
  public decodeValue(value: unknown): WireMessage;
}

/**
 * A provider's request for permission while producing a message, the choices the provider offers,
 * and the user's decision. TeamRun classifies the request for rendering and owns its status; the
 * provider's own kind and decision vocabulary travel verbatim. TeamRun never decides on the user's
 * behalf; a reply that ends first cancels the request.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class Approval {
  /**
   * Unique identifier.
   */
  public readonly id: string;
  /**
   * The provider's `Message` the request was raised in.
   */
  public readonly messageId: string;
  /**
   * TeamRun's classification of the request, used for rendering.
   */
  public readonly kind: ApprovalKind;
  /**
   * The provider's own name for the request, verbatim, such as `commandExecution` or a tool name.
   */
  public readonly nativeKind: string;
  /**
   * One line for the user, such as the command to run.
   */
  public readonly summary: string;
  /**
   * The provider's own detail, such as the command, its working directory, or the paths; `null`
   * when there is none.
   */
  public readonly payload: JsonValue;
  /**
   * The choices the provider offers, at least one, with distinct ids. The instance keeps its own
   * copy.
   */
  public readonly options: readonly ApprovalOption[];
  /**
   * Where the request stands.
   */
  public readonly status: ApprovalStatus;
  /**
   * The id of the chosen option once approved or denied, `null` while pending or when cancelled.
   */
  public readonly decision: string | null;
  /**
   * ISO 8601 timestamp of the request.
   */
  public readonly createdAt: string;
  /**
   * ISO 8601 timestamp of the decision or cancellation, `null` while pending.
   */
  public readonly decidedAt: string | null;
  /**
   * The questions of a `Question` approval, in the order asked; empty for every other kind.
   */
  public readonly questions: readonly ApprovalQuestion[];
  /**
   * The person's answers once a `Question` approval is approved, at most one per question; `null`
   * otherwise. A secret question's answer is left out, since it is never stored.
   */
  public readonly answers: readonly QuestionAnswer[] | null;

  /**
   * Initializes the approval.
   * @param id Unique identifier.
   * @param messageId The provider's `Message` the request was raised in.
   * @param kind TeamRun's classification of the request, used for rendering.
   * @param nativeKind The provider's own name for the request, verbatim, such as `commandExecution`
   * or a tool name.
   * @param summary One line for the user, such as the command to run.
   * @param payload The provider's own detail, such as the command, its working directory, or the
   * paths; `null` when there is none.
   * @param options The offered choices; copied, so later changes to the array do not reach the
   * approval.
   * @param status Where the request stands.
   * @param decision The id of the chosen option once approved or denied, `null` while pending or
   * when cancelled.
   * @param createdAt ISO 8601 timestamp of the request.
   * @param decidedAt ISO 8601 timestamp of the decision or cancellation, `null` while pending.
   * @param questions The questions of a `Question` approval; empty, the default, for every other
   * kind; copied.
   * @param answers The person's answers to an approved `Question` approval; `null`, the default,
   * otherwise; copied.
   * @throws ArgumentException when the id, message id, native kind, summary, or creation timestamp
   * is blank; when no option is offered or two share an id; when a pending approval has a decision
   * time or a decided one has none; when an approved or denied approval names no decision or a
   * pending or cancelled one names one; when the decision names no offered option; when the
   * chosen option's outcome contradicts the status; when a `Question` approval asks no question,
   * two questions share an id, or another kind asks any; or when answers come on an approval that
   * isn't an approved `Question` approval, or name an unknown or repeated question.
   */
  public constructor(
    id: string,
    messageId: string,
    kind: ApprovalKind,
    nativeKind: string,
    summary: string,
    payload: JsonValue,
    options: readonly ApprovalOption[],
    status: ApprovalStatus,
    decision: string | null,
    createdAt: string,
    decidedAt: string | null,
    questions?: readonly ApprovalQuestion[],
    answers?: readonly QuestionAnswer[] | null);

  /**
   * Reads an approval from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `messageId`, `kind`, `nativeKind`,
   * `summary`, `payload`, the `options` array of objects, `status`, the nullable `decision`,
   * `createdAt`, and the nullable `decidedAt`, and optionally the `questions` and `answers`
   * arrays, which only a `Question` approval carries.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The approval.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): Approval;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `messageId`, `kind`, `nativeKind`, `summary`, `payload`, the
   * `options` array of objects, `status`, the nullable `decision`, `createdAt`, and the nullable
   * `decidedAt`, then the `questions` array when it asks questions and the `answers` array when
   * they were answered.
   */
  public toJson(): JsonObject;

  /**
   * Returns a decided copy: the status follows the chosen option's outcome.
   * @param optionId Id of the chosen option.
   * @param decidedAt ISO 8601 timestamp of the decision.
   * @param answers The person's answers, kept only when the chosen option approves; `null` by
   * default.
   * @returns The copy.
   * @throws ArgumentException when the option is not one of the offered options, or the answers
   * don't fit the approval's questions.
   */
  public withDecision(optionId: string, decidedAt: string, answers?: readonly QuestionAnswer[] | null): Approval;

  /**
   * Returns a cancelled copy, for a request whose reply ended first.
   * @param decidedAt ISO 8601 timestamp of the cancellation.
   * @returns The copy.
   */
  public withCancellation(decidedAt: string): Approval;
}

/**
 * A command that a provider reports running in the background for a reply, or that TeamRun starts
 * for the teammate: what runs, where it stands, and the latest of its output. TeamRun keeps a
 * chat's tasks while it runs; they are not stored.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class BackgroundTask {
  /**
   * TeamRun's id for the task.
   */
  public readonly id: string;
  /**
   * The `Chat` id.
   */
  public readonly chatId: string;
  /**
   * The id of the reply that started the task.
   */
  public readonly messageId: string;
  /**
   * The id of the kind that runs the task.
   */
  public readonly kind: string;
  /**
   * The command line, as the provider reports it.
   */
  public readonly command: string;
  /**
   * Where the task stands.
   */
  public readonly status: BackgroundTaskStatus;
  /**
   * The exit code the provider reports for an ended task, or `null` when it reports none.
   */
  public readonly exitCode: number | null;
  /**
   * ISO 8601 timestamp of the start.
   */
  public readonly startedAt: string;
  /**
   * ISO 8601 timestamp of the end, or `null` while the task runs.
   */
  public readonly endedAt: string | null;
  /**
   * The latest output, at most `Resources.maximumBackgroundTaskOutput` characters, or `null` where
   * a list left it out; `BackgroundTaskRead` gives it.
   */
  public readonly output: string | null;
  /**
   * The `SubAgent.toolUseId` of the sub-agent the task runs, whose stop is the task's, or `null` for a command.
   */
  public readonly subAgentId: string | null;
  /**
   * Whether a list cut the command to its first `Resources.maximumListedCommand` characters;
   * `BackgroundTaskRead` gives the whole command.
   */
  public readonly commandCut: boolean;

  /**
   * Initializes the task.
   * @param id TeamRun's id for the task.
   * @param chatId The `Chat` id.
   * @param messageId The id of the reply that started the task.
   * @param kind The id of the kind that runs the task.
   * @param command The command line.
   * @param status Where the task stands.
   * @param exitCode The reported exit code, or `null`.
   * @param startedAt ISO 8601 timestamp of the start.
   * @param endedAt ISO 8601 timestamp of the end, or `null` while the task runs.
   * @param output The latest output, or `null` where it is left out.
   * @param subAgentId The `SubAgent.toolUseId` of the sub-agent the task runs, or `null`; blank is `null`.
   * @param commandCut Whether a list cut the command; `false` by default.
   * @throws ArgumentException when `id`, `chatId`, `messageId`, `kind`, `command` or
   * `startedAt` is blank, when a running task has an end time or an ended one has none, or when a
   * running task has an exit code.
   */
  public constructor(
    id: string,
    chatId: string,
    messageId: string,
    kind: string,
    command: string,
    status: BackgroundTaskStatus,
    exitCode: number | null,
    startedAt: string,
    endedAt: string | null,
    output: string | null,
    subAgentId?: string | null,
    commandCut?: boolean);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Whether the task still runs.
   */
  public get isRunning(): boolean;

  /**
   * Reads the task from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `conversationId`, `messageId`,
   * `kind`, `command`, `status`, the nullable integer `exitCode`, `startedAt`, the nullable
   * `endedAt`, and `output`, and optionally `subAgentId` and the boolean `commandCut`, `false` when missing.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The task.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): BackgroundTask;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `conversationId`, `messageId`, `kind`, `command`, `status`,
   * the nullable `exitCode`, `startedAt`, the nullable `endedAt`, `output`, `subAgentId` and `commandCut`.
   */
  public toJson(): JsonObject;

  /**
   * Returns a copy with more output, keeping the latest `Resources.maximumBackgroundTaskOutput`
   * characters; a task whose output is left out stays as it is.
   * @param text The new output.
   * @returns The copy.
   */
  public withOutput(text: string): BackgroundTask;

  /**
   * Returns a copy with its output left out, so a list of many tasks stays small; a task with no
   * output keeps its empty text, which says so.
   * @returns The copy.
   */
  public withoutOutput(): BackgroundTask;

  /**
   * Returns a copy for a list whose command, leading spaces left out, is cut to its first `Resources.maximumListedCommand`
   * characters, one fewer when the last would be the first half of a surrogate pair, with `commandCut` set and its output
   * left out, so opening it reads the whole task; a command that fits once its leading spaces are left out isn't cut,
   * and a task whose command fits stays as it is.
   * @returns The copy.
   */
  public withCommandCut(): BackgroundTask;

  /**
   * Returns an ended copy.
   * @param status How the task ended; not `Running`.
   * @param exitCode The reported exit code, or `null`.
   * @param endedAt ISO 8601 timestamp of the end.
   * @returns The copy.
   * @throws ArgumentException when `status` is `Running`.
   */
  public withEnd(status: BackgroundTaskStatus, exitCode: number | null, endedAt: string): BackgroundTask;
}

/**
 * Parameters of `BackgroundTaskList`: a page of a chat's background tasks, the first one when
 * `afterTaskId` is `null`, else the finished tasks after that one; at most `limit` finished tasks.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class BackgroundTaskListParams {
  /**
   * The `Chat` id.
   */
  public readonly chatId: string;
  /**
   * Return the finished tasks after this one, or `null` for the first page.
   */
  public readonly afterTaskId: string | null;
  /**
   * How many finished tasks at most; 1 through 500.
   */
  public readonly limit: number;

  /**
   * Initializes the parameters.
   * @param chatId The `Chat` id.
   * @param afterTaskId Return the finished tasks after this one, or `null` for the first page.
   * @param limit How many finished tasks at most; 1 through 500.
   * @throws ArgumentException when `chatId` or a given `afterTaskId` is blank;
   * `ArgumentOutOfRangeException` when the limit is out of range.
   */
  public constructor(chatId: string, afterTaskId: string | null, limit: number);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `chatId`, the nullable `afterTaskId`,
   * `limit`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): BackgroundTaskListParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `chatId`, `afterTaskId`, `limit`.
   */
  public toJson(): JsonObject;
}

/**
 * One page of a chat's background tasks: on the first page every running task, then the newest
 * finished commands; on a later page only finished commands. Each task leaves its output out and
 * carries at most `Resources.maximumListedCommand` characters of its command.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class BackgroundTaskPage {
  /**
   * The tasks: running ones first, then finished ones, each newest first.
   */
  public readonly tasks: readonly BackgroundTask[];
  /**
   * Whether finished commands lie after the last one; `false` when the page has none.
   */
  public readonly hasLater: boolean;
  /**
   * How many finished commands the whole chat holds.
   */
  public readonly count: number;

  /**
   * Initializes the page.
   * @param tasks The tasks, running ones first.
   * @param hasLater Whether finished commands lie after the last one.
   * @param count How many finished commands the whole chat holds.
   * @throws ArgumentOutOfRangeException when `count` is not a non-negative integer.
   */
  public constructor(tasks: readonly BackgroundTask[], hasLater: boolean, count: number);

  /**
   * Reads the page from untrusted JSON.
   * @param value The untrusted value, expected to carry `tasks`, `hasLater`, `count`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The page.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): BackgroundTaskPage;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `tasks`, `hasLater`, `count`.
   */
  public toJson(): JsonObject;
}

/**
 * One choice a provider offers for an approval request: the provider's own id for it, the label the
 * user sees, what choosing it means, and how long that lasts.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class ApprovalOption {
  /**
   * The provider-defined id, such as `accept` or `acceptForSession`; the adapter maps it back to
   * its own wire.
   */
  public readonly id: string;
  /**
   * The text shown to the user.
   */
  public readonly label: string;
  /**
   * Whether choosing it grants or refuses the request.
   */
  public readonly outcome: ApprovalOutcome;
  /**
   * How long the answer lasts.
   */
  public readonly scope: ApprovalScope;

  /**
   * Initializes the approval option.
   * @param id The provider-defined id, such as `accept` or `acceptForSession`; the adapter maps it
   * back to its own wire.
   * @param label The text shown to the user.
   * @param outcome Whether choosing it grants or refuses the request.
   * @param scope How long the answer lasts.
   * @throws ArgumentException when the id or label is blank.
   */
  public constructor(id: string, label: string, outcome: ApprovalOutcome, scope: ApprovalScope);

  /**
   * Reads an approval option from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `label`, `outcome`, and `scope`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The approval option.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ApprovalOption;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `label`, `outcome`, and `scope`.
   */
  public toJson(): JsonObject;
}

/**
 * One labeled detail of a `Permission` approval, as the request showed it.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class PermissionDetail {
  /**
   * The detail's label.
   */
  public readonly label: string;
  /**
   * How the window shows it.
   */
  public readonly kind: PermissionDetailKind;
  /**
   * The value; `null` exactly when the detail is a secret, whose value is never kept.
   */
  public readonly value: string | null;

  /**
   * Initializes the detail.
   * @param label The label; must not be blank.
   * @param kind How the window shows it.
   * @param value The value; `null` exactly for a secret.
   * @throws ArgumentException when the label is blank, a secret has a value, or another detail has none.
   */
  public constructor(label: string, kind: PermissionDetailKind, value: string | null);

  /**
   * Reads a detail from untrusted JSON.
   * @param value The untrusted value, expected to carry `label`, `kind`, and `value`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The detail.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): PermissionDetail;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `label`, `kind`, and `value`.
   */
  public toJson(): JsonObject;
}

/**
 * The payload of a `Permission` approval: the module that raised the request, what it is on, its risk, its details, and the
 * served tool call that asked, when the request names one.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class PermissionPayload {
  /**
   * The id of the module that raised the request.
   */
  public readonly module: string;
  /**
   * What the action is on, such as a chat's id; `null` when the request names nothing.
   */
  public readonly subject: string | null;
  /**
   * The request's risk.
   */
  public readonly risk: PermissionRisk;
  /**
   * The request's details, in order; a copy.
   */
  public readonly details: readonly PermissionDetail[];
  /**
   * The served tool call that asked, by the tool's served name and its input, as the call's step names them in `servedTool` and
   * `servedInput`; `null` when the request doesn't name its call, such as one raised outside a tool call, or by a Desktop that
   * doesn't name a question's call.
   */
  public readonly served: { readonly tool: string; readonly input: JsonObject } | null;

  /**
   * Initializes the payload.
   * @param module The module's id; must not be blank.
   * @param subject What the action is on, or `null`.
   * @param risk The risk.
   * @param details The details.
   * @param served The served tool call that asked, or `null` (the default) when the request names none.
   * @throws ArgumentException when the module or the served call's tool is blank.
   */
  public constructor(module: string, subject: string | null, risk: PermissionRisk, details: readonly PermissionDetail[],
    served?: { readonly tool: string; readonly input: JsonObject } | null);

  /**
   * Reads a payload from untrusted JSON.
   * @param value The untrusted value, expected to carry `module`, `subject`, `risk`, and `details`, and optionally `servedTool`
   * with its `servedInput` object.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The payload.
   * @throws JsonException when a field is missing or invalid, or `servedTool` comes without its `servedInput`; the exception names
   * the field's path.
   */
  public static fromJson(value: unknown, path?: string): PermissionPayload;

  /**
   * Whether the request was asked by the served call a step names.
   * @param tool The step's `servedTool`.
   * @param input The step's `servedInput`.
   * @returns `true` when the payload names its call and both the tool and the input match it, compared with object keys in any
   * order; `false` otherwise, including for a step without its input.
   */
  public isCallOf(tool: JsonValue | undefined, input: JsonValue | undefined): boolean;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `module`, `subject`, `risk`, and `details`, and `servedTool` and `servedInput` when the payload names
   * its call.
   */
  public toJson(): JsonObject;
}

/**
 * One question of a `Question` approval, as the provider asked it.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class ApprovalQuestion {
  /**
   * The provider's id for the question, or its position when the provider gives none; the adapter
   * maps answers back by it.
   */
  public readonly id: string;
  /**
   * The short header shown as a tag beside the question, such as `Platform`; empty when the
   * provider gives none.
   */
  public readonly header: string;
  /**
   * The question itself.
   */
  public readonly text: string;
  /**
   * The options offered, in order; empty when the question takes only the person's own text.
   */
  public readonly options: readonly QuestionOption[];
  /**
   * Whether the person may choose several options.
   */
  public readonly multiple: boolean;
  /**
   * Whether the person may answer with their own text, as "Other…".
   */
  public readonly other: boolean;
  /**
   * Whether the person's text is masked while typed and never stored.
   */
  public readonly secret: boolean;

  /**
   * Initializes the question.
   * @param id The provider's id for the question, or its position.
   * @param header The short header; empty when the provider gives none.
   * @param text The question itself.
   * @param options The options offered; copied.
   * @param multiple Whether the person may choose several options.
   * @param other Whether the person may answer with their own text.
   * @param secret Whether the person's text is masked and never stored.
   * @throws ArgumentException when the id or text is blank, two options share a label, or the
   * question offers no option and takes no text.
   */
  public constructor(id: string, header: string, text: string, options: readonly QuestionOption[], multiple: boolean, other: boolean, secret: boolean);

  /**
   * Reads a question from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `header`, `text`, the `options` array
   * of objects, `multiple`, `other`, and `secret`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The question.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ApprovalQuestion;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `header`, `text`, the `options` array of objects, `multiple`,
   * `other`, and `secret`.
   */
  public toJson(): JsonObject;
}

/**
 * One option of an `ApprovalQuestion`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class QuestionOption {
  /**
   * The option's text, which is also what an answer names.
   */
  public readonly label: string;
  /**
   * What choosing it means; empty when the provider gives none.
   */
  public readonly description: string;

  /**
   * Initializes the option.
   * @param label The option's text.
   * @param description What choosing it means; empty when the provider gives none.
   * @throws ArgumentException when the label is blank.
   */
  public constructor(label: string, description: string);

  /**
   * Reads an option from untrusted JSON.
   * @param value The untrusted value, expected to carry `label` and `description`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The option.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): QuestionOption;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `label` and `description`.
   */
  public toJson(): JsonObject;
}

/**
 * The person's answer to one `ApprovalQuestion`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class QuestionAnswer {
  /**
   * The id of the question answered.
   */
  public readonly questionId: string;
  /**
   * The labels of the chosen options, in the question's order.
   */
  public readonly choices: readonly string[];
  /**
   * The person's own text, `null` when they gave none.
   */
  public readonly text: string | null;

  /**
   * Initializes the answer.
   * @param questionId The id of the question answered.
   * @param choices The labels of the chosen options; copied.
   * @param text The person's own text; blank text is kept as `null`.
   * @throws ArgumentException when the question id is blank, a choice is blank or repeated, or the
   * answer has no choice and no text.
   */
  public constructor(questionId: string, choices: readonly string[], text: string | null);

  /**
   * Reads an answer from untrusted JSON.
   * @param value The untrusted value, expected to carry `questionId`, the `choices` array of
   * strings, and the nullable `text`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The answer.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): QuestionAnswer;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `questionId`, the `choices` array, and the nullable `text`.
   */
  public toJson(): JsonObject;
}

/**
 * A chat, in a project or without one: the thread in which the user explains work and receives results.
 * Messages and turns reference it; a project can hold many. A chat without a project runs in an empty folder of its own
 * in TeamRun's data folder.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class Chat {
  /**
   * Unique identifier.
   */
  public readonly id: string;
  /**
   * The `Project` id, or `null` for a chat without a project.
   */
  public readonly projectId: string | null;
  /**
   * Display title, by default the first line of the first message.
   */
  public readonly title: string;
  /**
   * ISO 8601 timestamp of creation.
   */
  public readonly createdAt: string;
  /**
   * ISO 8601 timestamp of the last message or change.
   */
  public readonly updatedAt: string;
  /**
   * Whether the next reply must start a fresh provider session fed with the kept transcript (set by a rewind, cleared
   * by the next send).
   */
  public readonly sessionReset: boolean;
  /**
   * The provider session a rewind forked through the last kept reply, or `null`; the next send on
   * that kind and provider resumes it instead of the session the history names. Never set
   * together with `sessionReset`.
   */
  public readonly forkedSession: ForkedSession | null;
  /**
   * The responder chosen in the chat's composer to answer a teammate's message that mentions no one: a teammate, or
   * the default teammate's provider, model, effort and provider. `null` when none is chosen. It may name a teammate
   * that has since been deleted or left the chat, or a provider since removed; a send then treats it as none.
   * Rows stored before it existed read as `null`.
   */
  public readonly responder: ChatResponder | null;
  /**
   * Whether the chat was changed: renamed or moved, a teammate added or removed, or its kind, provider, model, effort
   * or responder chosen by the person. New chat reuses only an empty chat without it. Rows stored before it existed
   * read as `false`.
   */
  public readonly edited: boolean;
  /**
   * The folder a chat without a project works in, its attached folder or else its own folder; `null` in a project. The runtime sets it
   * each time it reads the chat, so a stored value never counts.
   */
  public readonly folder: string | null;
  /**
   * Whether the chat plans first: each member's replies start in its provider's plan mode, until that member's plan is approved or the
   * person turns it off.
   */
  public readonly planFirst: boolean;

  /**
   * The teammates whose plan was approved since Plan first last turned on, whose replies no longer plan first.
   */
  public readonly approvedPlanTeammates: readonly string[];

  /**
   * Whether a plan of the chat's own provider, answering with no teammate, was approved since Plan first last turned on.
   */
  public readonly approvedResponderPlan: boolean;

  /**
   * Whether a person chose the title, which TeamRun then never replaces with one it makes.
   */
  public readonly titleChosen: boolean;

  /**
   * The existing folder a person attached to a chat without a project, which its teammates work in, in place, instead of its own
   * folder; `null` when none is attached, and always in a project. Written only when set.
   */
  public readonly attachedFolder: string | null;
  /**
   * The organization and teammate whose Organization chat this is, or `null` for any other chat. Written only when set.
   */
  public readonly organizationChat: OrganizationChat | null;

  /**
   * Initializes the chat.
   * @param id Unique identifier.
   * @param projectId The `Project` id, or `null` for a chat without a project.
   * @param title Display title: the first line of the first message until a title a model made arrives, or the one a person chose.
   * @param createdAt ISO 8601 timestamp of creation.
   * @param updatedAt ISO 8601 timestamp of the last message or change.
   * @param forkedSession The forked session a rewind left, or `null` (the default).
   * @param sessionReset Whether the next reply must start a fresh provider session fed with the transcript (set by a
   * rewind, cleared by the next send); `false` by default.
   * @param responder The responder chosen to answer a message that mentions no one, or `null` (the default).
   * @param edited Whether the chat was changed; `false` by default.
   * @param folder The chat's own folder, or `null` (the default).
   * @param planFirst Whether the chat plans first; `false` by default.
   * @param approvedPlanTeammates The teammates whose plan was approved since Plan first turned on; none by default.
   * @param approvedResponderPlan Whether the chat's own provider's plan was approved since Plan first turned on; `false` by default.
   * @param titleChosen Whether a person chose the title; `false` by default.
   * @param attachedFolder The folder a person attached, or `null` (the default).
   * @param organizationChat The organization and teammate whose Organization chat this is, or `null` (the default).
   * @throws ArgumentException when the id, a given project id, the title, a timestamp, a given folder, a given attached folder or an
   * approved teammate is blank.
   */
  public constructor(
    id: string,
    projectId: string | null,
    title: string,
    createdAt: string,
    updatedAt: string,
    sessionReset?: boolean,
    forkedSession?: ForkedSession | null,
    responder?: ChatResponder | null,
    edited?: boolean,
    folder?: string | null,
    planFirst?: boolean,
    approvedPlanTeammates?: readonly string[],
    approvedResponderPlan?: boolean,
    titleChosen?: boolean,
    attachedFolder?: string | null,
    organizationChat?: OrganizationChat | null);

  /**
   * Reads a chat from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `projectId`, `title`, `createdAt`,
   * and `updatedAt`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The chat.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): Chat;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `projectId`, `title`, `createdAt`, `updatedAt`, `sessionReset`, `forkedSession`,
   * `responder`, `edited` and `folder`, and `planFirst` only when it is `true`.
   */
  public toJson(): JsonObject;

  /**
   * Returns a copy marked as changed, keeping everything else, its update time included.
   * @returns The copy.
   */
  public asEdited(): Chat;

  /**
   * Returns a copy with the title a person chose, marked as changed.
   * @param title The new display title.
   * @param updatedAt The new update timestamp.
   * @returns The copy.
   */
  public withChosenTitle(title: string, updatedAt: string): Chat;

  /**
   * Returns a copy with another chosen responder, keeping the update time, so choosing one doesn't move the chat in
   * the newest-first list.
   * @param responder The responder chosen to answer a message that mentions no one, or `null` for none.
   * @returns The copy.
   */
  public withResponder(responder: ChatResponder | null): Chat;

  /**
   * Whether a member's replies plan first: the chat plans first and that member's plan wasn't approved since.
   * @param teammateId The teammate, or `null` for the chat's own provider.
   * @returns Whether its replies start in its provider's plan mode.
   */
  public plansFirst(teammateId: string | null): boolean;

  /**
   * Returns a copy that plans first or not, for every member again, keeping the update time, so the choice doesn't move the chat in the
   * newest-first list.
   * @param planFirst Whether the chat plans first.
   * @returns The copy, with no approved plans.
   */
  public withPlanFirst(planFirst: boolean): Chat;

  /**
   * Returns a copy in which a member's plan is approved, so that member's replies no longer plan first while the others' still do.
   * @param teammateId The teammate, or `null` for the chat's own provider.
   * @returns The copy, keeping the update time; this chat itself when it doesn't plan first.
   */
  public withPlanApproved(teammateId: string | null): Chat;

  /**
   * Returns a copy in which a member's plan is no longer approved, so that member's replies plan first again.
   * @param teammateId The teammate, or `null` for the chat's own provider.
   * @returns The copy, keeping the update time; this chat itself when it doesn't plan first.
   */
  public withPlanReopened(teammateId: string | null): Chat;

  /**
   * Returns a copy with another title and update time.
   * @param title The new title; must not be blank.
   * @param updatedAt ISO 8601 timestamp of the change.
   * @returns The copy.
   * @throws ArgumentException when the title or the timestamp is blank.
   */
  public withTitle(title: string, updatedAt: string): Chat;

  /**
   * A copy under another project, which has no folder of its own.
   * @param projectId The id of the project the chat moves to; must not be blank.
   * @param updatedAt ISO 8601 timestamp of the change.
   * @returns The copy.
   * @throws ArgumentException when the project id or the timestamp is blank.
   */
  public withProjectId(projectId: string, updatedAt: string): Chat;

  /**
   * A copy with its own folder set, keeping everything else.
   * @param folder The chat's own folder, or `null`.
   * @returns The copy.
   * @throws ArgumentException when the folder is blank.
   */
  public withFolder(folder: string | null): Chat;

  /**
   * A copy with an attached folder set or cleared, keeping everything else.
   * @param attachedFolder The folder a person attached, or `null` to detach it.
   * @param updatedAt ISO 8601 timestamp of the change.
   * @returns The copy.
   * @throws ArgumentException when the attached folder or the timestamp is blank.
   */
  public withAttachedFolder(attachedFolder: string | null, updatedAt: string): Chat;

  /**
   * Returns a copy with the session-reset mark changed.
   * @param sessionReset The mark.
   * @param updatedAt ISO 8601 timestamp of the change.
   * @returns The copy.
   */
  public withSessionReset(sessionReset: boolean, updatedAt: string): Chat;

  /**
   * Returns a copy with the forked session (and the reset mark cleared).
   * @param forkedSession The forked session, or `null` to clear it.
   * @param updatedAt ISO 8601 timestamp of the change.
   * @returns The copy.
   */
  public withForkedSession(forkedSession: ForkedSession | null, updatedAt: string): Chat;
}

/**
 * @deprecated Use `Chat`; the earlier name goes in a later release.
 */
export declare const Conversation: typeof Chat;
/**
 * @deprecated Use `Chat`; the earlier name goes in a later release.
 */
export type Conversation = Chat;

/**
 * The provider session a rewind forked, bound to the kind and provider it was forked for.
 */
export declare class ForkedSession {
  /**
   * The kind's id.
   */
  public readonly kind: string;
  /**
   * The `Provider` id, or `null` for the provider's default profile.
   */
  public readonly providerId: string | null;
  /**
   * The provider's own id of the forked session, or of the session to fork when `resumeAt` is set.
   */
  public readonly nativeSessionId: string;
  /**
   * The provider's own id of the turn the next turn resumes `nativeSessionId` at, forking it there, for a provider
   * that forks when it resumes; `null` when the session is already forked.
   */
  public readonly resumeAt: string | null;

  /**
   * Initializes the forked session.
   * @param kind The kind id; must not be blank.
   * @param providerId The provider id, or `null`.
   * @param nativeSessionId The forked session id; must not be blank.
   * @param resumeAt The turn to resume at and fork from, or `null`; `null` by default; must not be blank.
   * @throws ArgumentException when a text is blank.
   */
  public constructor(kind: string, providerId: string | null, nativeSessionId: string, resumeAt?: string | null);

  /**
   * Reads the forked session from untrusted JSON.
   * @param value The untrusted value, expected to carry `kind`, the nullable `providerId`,
   * `nativeSessionId`, and the optional, nullable `resumeAt`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The forked session.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ForkedSession;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `kind`, `providerId`, `nativeSessionId`, `resumeAt`.
   */
  public toJson(): JsonObject;

  /**
   * Returns whether a send on the given kind and provider continues this session.
   * @param kind The kind id.
   * @param providerId The provider id, or `null`.
   * @returns `true` when both match.
   */
  public matches(kind: string, providerId: string | null): boolean;
}

/**
 * One entry of a chat: what the user sent, a provider's reply to it, or a note from
 * TeamRun. A message is made of ordered details; a provider's reply also carries the provenance of
 * the run that produced it and moves through the open statuses while that run lasts.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class Message {
  /** Named author id; null for the user and the unnamed default participant. */
  public readonly teammateId: string | null;
  /** The author's name at message creation, retained after rename or deletion. */
  public readonly teammateName: string | null;
  /** Resolved mentions of a user message or a teammate's reply, with their historical names. */
  public readonly mentions: readonly TeammateMention[];
  /**
   * The teammate and chat that sent a user message with `teamrun send` from inside a chat; `null` for one the person sent.
   * Omitted from JSON when `null`.
   */
  public readonly sender: MessageSender | null;
  /**
   * Durable attachment metadata, without file bytes; copied on construction. Empty for older messages.
   */
  public readonly attachments: readonly MessageAttachment[];
  /**
   * Unique identifier.
   */
  public readonly id: string;
  /**
   * The `Chat` the message belongs to.
   */
  public readonly chatId: string;
  /**
   * Position within the chat, a non-negative integer, unique per chat.
   */
  public readonly sequence: number;
  /**
   * Who sent it.
   */
  public readonly author: MessageAuthor;
  /**
   * The `Message` this one answers, or `null` for the user's own messages.
   */
  public readonly inReplyTo: string | null;
  /**
   * Where the message stands.
   */
  public readonly status: MessageStatus;
  /**
   * The ordered pieces of the message; empty while a provider's reply is pending. The instance
   * keeps its own copy.
   */
  public readonly details: readonly MessageDetail[];
  /**
   * Where a provider's reply came from; `null` for every other author.
   */
  public readonly provenance: Provenance | null;
  /**
   * ISO 8601 timestamp of creation; for a provider's reply, the creation time of the message it answers.
   */
  public readonly createdAt: string;
  /**
   * ISO 8601 timestamp when a provider's reply began running; `null` for other authors, for a reply still waiting for its turn,
   * and for one that ended before it ran.
   */
  public readonly startedAt: string | null;
  /**
   * ISO 8601 timestamp when the message reached an ended status, `null` while open.
   */
  public readonly endedAt: string | null;

  /**
   * Initializes the message.
   * @param id Unique identifier.
   * @param chatId The `Chat` the message belongs to.
   * @param sequence Position within the chat, a non-negative integer, unique per
   * chat.
   * @param author Who sent it.
   * @param inReplyTo The `Message` this one answers, or `null` for the user's own messages.
   * @param status Where the message stands.
   * @param details The pieces; copied, so later changes to the array do not reach the message.
   * @param provenance Where a provider's reply came from; `null` for every other author.
   * @param createdAt ISO 8601 timestamp of creation; for a provider's reply, the creation time of the message it answers.
   * @param startedAt ISO 8601 timestamp when a provider's reply began running; `null` for other authors, for a reply still
   * waiting for its turn, and for one that ended before it ran.
   * @param endedAt ISO 8601 timestamp when the message reached an ended status, `null` while open.
   * @param attachments Saved attachment metadata, copied; defaults to empty and is omitted from JSON when empty.
   * @throws ArgumentException when the id, chat id, or creation timestamp is blank, when
   * `inReplyTo` is present but blank, when provenance is present on a message that is not a
   * provider's or absent on one that is, when an end time is present on an open message or
   * absent on an ended one, or when a start time is blank, present on a message that is not a
   * provider's or on a pending one, or absent on a provider's running or awaiting reply, or when
   * mentions are present on a provider's reply that isn't a teammate's, or when a sender is present on a message that is not
   * the user's;
   * `ArgumentOutOfRangeException` when the sequence is negative or not an integer.
   */
  public constructor(
    id: string,
    chatId: string,
    sequence: number,
    author: MessageAuthor,
    inReplyTo: string | null,
    status: MessageStatus,
    details: readonly MessageDetail[],
    provenance: Provenance | null,
    createdAt: string,
    startedAt: string | null,
    endedAt: string | null,
    attachments?: readonly MessageAttachment[],
    teammateId?: string | null,
    teammateName?: string | null,
    mentions?: readonly TeammateMention[],
    sender?: MessageSender | null);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Reads a message from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `conversationId`, the integer
   * `sequence`, `author`, the nullable `inReplyTo`, `status`, the `details` array of objects, the
   * nullable `provenance` object, `createdAt`, the optional nullable `startedAt`, and the nullable `endedAt`.
   * Messages stored before start times were recorded have no `startedAt`: a provider's reply that is not
   * pending then counts from `createdAt`, and every other message has none.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The message.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): Message;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `conversationId`, the integer `sequence`, `author`, the nullable
   * `inReplyTo`, `status`, the `details` array of objects, the nullable `provenance` object,
   * `createdAt`, the nullable `startedAt`, and the nullable `endedAt`.
   */
  public toJson(): JsonObject;

  /**
   * Returns a copy of a waiting reply that began running; the same invariants apply.
   * @param startedAt ISO 8601 timestamp when the reply began running.
   * @returns The copy, with status `Running`, the start time and no end time.
   * @throws ArgumentException when the message is not a provider's reply or the start time is blank.
   */
  public withStart(startedAt: string): Message;

  /**
   * Returns a copy with another status and end time, keeping the start time; the same invariants apply.
   * @param status The new status.
   * @param endedAt The end time, `null` while the message is open.
   * @returns The copy.
   * @throws ArgumentException when the status and the end time disagree, or when the status
   * needs a start time the message does not have.
   */
  public withStatus(status: MessageStatus, endedAt: string | null): Message;

  /**
   * Returns a copy with the detail appended.
   * @param detail The detail to append.
   * @returns The copy.
   */
  public withDetail(detail: MessageDetail): Message;

  /**
   * A copy with these details in place of the message's own.
   * @param details The details.
   * @returns The copy.
   */
  public withDetails(details: readonly MessageDetail[]): Message;

  /**
   * Returns a copy with another provenance.
   * @param provenance The provenance.
   * @returns The copy.
   */
  public withProvenance(provenance: Provenance): Message;

  /**
   * Returns a copy with other resolved mentions, such as those a teammate's reply names.
   * @param mentions The mentions, in the order the text names them.
   * @returns The copy.
   */
  public withMentions(mentions: readonly TeammateMention[]): Message;

  /**
   * Tells whether this reply ended a plan-first turn with a plan that waits for the person's approval: it completed, its plan text is
   * neither approved nor refused, and its chat still plans first for its member.
   * @param chat The reply's chat, or `null` when it isn't known.
   * @returns Whether the reply's plan can be approved.
   */
  public awaitsPlanApproval(chat: Chat | null): boolean;
}

/**
 * One piece of a message: a paragraph, a reasoning summary, a command the provider ran, a set of
 * file changes, a note, or an error. Details are ordered by `sequence` within their message.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class MessageDetail {
  /**
   * Position within the message, a non-negative integer.
   */
  public readonly sequence: number;
  /**
   * What it carries.
   */
  public readonly kind: DetailKind;
  /**
   * The text, possibly empty for kinds whose content is in the payload.
   */
  public readonly text: string;
  /**
   * Structured detail for the kind, such as a command's output; `null` when there is none.
   */
  public readonly payload: JsonValue;
  /**
   * ISO 8601 timestamp of creation.
   */
  public readonly createdAt: string;
  /**
   * The sequence of the `SubAgent` detail whose sub-agent this detail belongs to, or `null` for a detail of the reply itself.
   */
  public readonly parentSequence: number | null;

  /**
   * Initializes the detail.
   * @param sequence Position within the message, a non-negative integer.
   * @param kind What it carries.
   * @param text The text, possibly empty for kinds whose content is in the payload.
   * @param payload Structured detail for the kind, such as a command's output; `null` when there is
   * none.
   * @param createdAt ISO 8601 timestamp of creation.
   * @param parentSequence The sequence of the `SubAgent` detail it belongs to, earlier than its own; `null`, the default, for a
   * detail of the reply itself.
   * @throws ArgumentException when the creation timestamp is blank, or a `Text` detail names a parent; `ArgumentOutOfRangeException`
   * when the sequence is negative or not an integer, or the parent's sequence isn't a non-negative integer below it.
   */
  public constructor(sequence: number, kind: DetailKind, text: string, payload: JsonValue, createdAt: string, parentSequence?: number | null);

  /**
   * Whether the detail belongs to a sub-agent rather than to the reply itself.
   */
  public get isNested(): boolean;

  /**
   * Reads a detail from untrusted JSON.
   * @param value The untrusted value, expected to carry the integer `sequence`, `kind`, `text`,
   * `payload`, and `createdAt`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The detail.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): MessageDetail;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with the integer `sequence`, `kind`, `text`, `payload`, and `createdAt`, and the integer
   * `parentSequence` when the detail belongs to a sub-agent.
   */
  public toJson(): JsonObject;
}

/**
 * Where a sub-agent's run stands.
 */
export declare enum SubAgentStatus {
  /**
   * It runs.
   */
  Running = "Running",
  /**
   * It finished its task.
   */
  Completed = "Completed",
  /**
   * It ended with an error.
   */
  Failed = "Failed",
  /**
   * It was stopped, or its session ended before it said how it ended.
   */
  Stopped = "Stopped"
}

/**
 * A sub-agent an agent started during a reply, whatever runs it: the payload of a `SubAgent` detail.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class SubAgent {
  /**
   * The id of the tool call that started it, as its step's payload names it in `toolUseId`; `null` when no step started it.
   */
  public readonly toolUseId: string | null;
  /**
   * The kind of sub-agent the agent asked for, such as `Explore`; `null` when it named none.
   */
  public readonly type: string | null;
  /**
   * What the agent asked it to do, in a few words.
   */
  public readonly description: string;
  /**
   * The model it runs, once known; `null` before.
   */
  public readonly model: string | null;
  /**
   * Where its run stands.
   */
  public readonly status: SubAgentStatus;
  /**
   * Whether it runs in the background, so the reply can end before it does.
   */
  public readonly isBackground: boolean;
  /**
   * How many tools it has called, as its provider last reported; `null` until reported.
   */
  public readonly toolUses: number | null;
  /**
   * How many tokens it has used, as its provider last reported; `null` until reported.
   */
  public readonly tokens: number | null;
  /**
   * How long it has run, in milliseconds, as its provider last reported; `null` until reported.
   */
  public readonly durationMs: number | null;
  /**
   * Its provider's one-line summary of its progress or its end; `null` when there is none.
   */
  public readonly summary: string | null;
  /**
   * Whether TeamRun itself runs it, as a helper an agent started through TeamRun's own tool, rather than its provider.
   */
  public readonly isTeamRun: boolean;

  /**
   * Initializes the sub-agent.
   * @param toolUseId The id of the tool call that started it; a blank one is kept as `null`.
   * @param type The kind of sub-agent; a blank one is kept as `null`.
   * @param description What it was asked to do.
   * @param model The model it runs; a blank one is kept as `null`.
   * @param status Where its run stands.
   * @param isBackground Whether it runs in the background.
   * @param toolUses Its tool calls so far, a non-negative integer, or `null`, the default.
   * @param tokens Its tokens so far, a non-negative integer, or `null`, the default.
   * @param durationMs Its run time so far in milliseconds, a non-negative integer, or `null`, the default.
   * @param summary Its one-line summary; a blank one, or `null`, the default, is kept as `null`.
   * @param isTeamRun Whether TeamRun itself runs it; `false`, the default.
   * @throws ArgumentException when the description is blank; `ArgumentOutOfRangeException` when a count
   * is negative or not an integer.
   */
  public constructor(toolUseId: string | null, type: string | null, description: string, model: string | null, status: SubAgentStatus,
    isBackground: boolean, toolUses?: number | null, tokens?: number | null, durationMs?: number | null, summary?: string | null,
    isTeamRun?: boolean);

  /**
   * Whether it still runs.
   */
  public get isRunning(): boolean;

  /**
   * Reads a sub-agent from untrusted JSON.
   * @param value The untrusted value, expected to carry `toolUseId`, `type`, `description`, `model`, `status`, `isBackground`, the
   * nullable integers `toolUses`, `tokens` and `durationMs`, `summary`, and `isTeamRun`, `false` when absent.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The sub-agent.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): SubAgent;

  /**
   * Returns a copy with the given fields changed; a field left out, or given as `null`, keeps its value.
   * @param changes The fields to change.
   * @returns The changed copy.
   */
  public with(changes: Partial<Pick<SubAgent, "model" | "status" | "isBackground" | "toolUses" | "tokens" | "durationMs" | "summary">>): SubAgent;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with every field, `isTeamRun` only when it is `true`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `SubAgentStart`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class SubAgentStartParams {
  /**
   * The sender token of the running turn that starts the sub-agent.
   */
  public readonly senderToken: string;

  /**
   * Who runs it: `helper`, the parent's provider, model and mode.
   */
  public readonly agent: string;

  /**
   * Three to six words, the sub-agent row's title.
   */
  public readonly description: string;

  /**
   * The whole task; the sub-agent sees nothing else of the chat.
   */
  public readonly brief: string;

  /**
   * Initializes the parameters.
   * @param senderToken The sender token of the running turn that starts the sub-agent.
   * @param agent Who runs it.
   * @param description The row's title.
   * @param brief The whole task.
   * @throws ArgumentException when a value is blank.
   */
  public constructor(senderToken: string, agent: string, description: string, brief: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `senderToken`, `agent`, `description` and `brief`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): SubAgentStartParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `senderToken`, `agent`, `description` and `brief`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `SubAgentWait`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class SubAgentWaitParams {
  /**
   * The sender token of the running turn whose sub-agents it waits for.
   */
  public readonly senderToken: string;

  /**
   * The sub-agents to wait for; empty for all of the turn's reply's.
   */
  public readonly subAgentIds: readonly string[];

  /**
   * How long to wait at most, from 0 to 50 seconds.
   */
  public readonly seconds: number;

  /**
   * Initializes the parameters.
   * @param senderToken The sender token of the running turn.
   * @param subAgentIds The sub-agents to wait for; empty for all of the turn's reply's.
   * @param seconds How long to wait at most, from 0 to 50 seconds.
   * @throws ArgumentException when the token or an id is blank.
   * @throws ArgumentOutOfRangeException when `seconds` is not a whole number from 0 to 50.
   */
  public constructor(senderToken: string, subAgentIds: readonly string[], seconds: number);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `senderToken`, `subAgentIds` and `seconds`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): SubAgentWaitParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `senderToken`, `subAgentIds` and `seconds`.
   */
  public toJson(): JsonObject;
}

/**
 * The result of `SubAgentWait`: the sub-agents waited for that have ended, and the ids of those still running.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class SubAgentWaitResult {
  /**
   * The ended sub-agents, each with its status and, in `summary`, its last message or why it failed.
   */
  public readonly ended: readonly SubAgent[];

  /**
   * The ids of the sub-agents still running.
   */
  public readonly running: readonly string[];

  /**
   * Initializes the result.
   * @param ended The ended sub-agents.
   * @param running The ids of the sub-agents still running.
   * @throws ArgumentException when a running id is blank.
   */
  public constructor(ended: readonly SubAgent[], running: readonly string[]);

  /**
   * Reads the result from untrusted JSON.
   * @param value The untrusted value, expected to carry `ended` and `running`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The result.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): SubAgentWaitResult;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `ended` and `running`.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `CommandStart`: a background command a running turn starts.
 *
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class CommandStartParams {
  /**
   * The sender token of the running turn that starts the command.
   */
  public readonly senderToken: string;

  /**
   * The command line, run by the person's shell; at most `maximumCommandLength` characters.
   */
  public readonly command: string;

  /**
   * A few words saying what the command does, shown on its row.
   */
  public readonly description: string;

  /**
   * Initializes the parameters.
   * @param senderToken The sender token of the running turn that starts the command.
   * @param command The command line.
   * @param description What the command does.
   * @throws ArgumentException when a value is blank or the command is longer than `maximumCommandLength`.
   */
  public constructor(senderToken: string, command: string, description: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `senderToken`, `command` and `description`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): CommandStartParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `senderToken`, `command` and `description`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `SubAgentStop`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class SubAgentStopParams {
  /**
   * The sender token of the running turn that started the sub-agent.
   */
  public readonly senderToken: string;

  /**
   * The sub-agent's id, as `SubAgentStart` answered it.
   */
  public readonly subAgentId: string;

  /**
   * Initializes the parameters.
   * @param senderToken The sender token of the running turn that started the sub-agent.
   * @param subAgentId The sub-agent's id.
   * @throws ArgumentException when a value is blank.
   */
  public constructor(senderToken: string, subAgentId: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `senderToken` and `subAgentId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): SubAgentStopParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `senderToken` and `subAgentId`.
   */
  public toJson(): JsonObject;
}

/**
 * One step of an agent's plan, as the provider wrote it.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class PlanStep {
  /**
   * What the step does.
   */
  public readonly text: string;
  /**
   * Where it stands.
   */
  public readonly status: PlanStepStatus;
  /**
   * What the agent says while doing it, such as "Running the tests"; `null` when the provider gives none.
   */
  public readonly activeText: string | null;

  /**
   * Initializes the step.
   * @param text What the step does.
   * @param status Where it stands.
   * @param activeText What the agent says while doing it, or `null`.
   * @throws ArgumentException when the text is blank, or the active text is given and blank.
   */
  public constructor(text: string, status: PlanStepStatus, activeText: string | null);

  /**
   * Reads a step from untrusted JSON.
   * @param value The untrusted value, expected to carry `text`, `status` and `activeText`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The step.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): PlanStep;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `text`, `status` and `activeText`.
   */
  public toJson(): JsonObject;
}

/**
 * The agent's plan in a reply. Its checklist is read from each provider's own plan: Claude's to-do tools, Codex's plan
 * updates, or an Agent Client Protocol `plan` update; each update is the whole checklist and replaces the last one in
 * the same reply. Its text is a plan-mode plan, such as the plan Claude's `ExitPlanMode` asks to approve or Codex's
 * `plan` item, stored as its own plan detail with no steps. A plan with neither text nor steps shows nothing.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class ReplyPlan {
  /**
   * The steps, in the agent's order; empty when the agent cleared its plan.
   */
  public readonly steps: readonly PlanStep[];
  /**
   * Why the agent wrote or changed the plan, when the provider says; `null` otherwise, and for blank text.
   */
  public readonly explanation: string | null;
  /**
   * The plan-mode plan as Markdown, trimmed; `null` for a checklist alone, and for blank text.
   */
  public readonly text: string | null;
  /**
   * The text's first non-blank line without its Markdown heading marks; `null` when there's no text.
   */
  public readonly title: string | null;
  /**
   * Whether the person refused to approve the plan text, such as Claude's `ExitPlanMode` plan; always `false` without text.
   */
  public readonly rejected: boolean;
  /**
   * Whether the person approved the plan text, so the agent went on in its usual mode; always `false` without text or when refused.
   */
  public readonly approved: boolean;
  /**
   * How many steps are done.
   */
  public readonly completedCount: number;

  /**
   * Initializes the plan.
   * @param steps The steps, in the agent's order.
   * @param explanation Why the agent wrote or changed the plan, or `null`; blank text is kept as `null`.
   * @param text The plan-mode plan as Markdown, or `null` (the default); blank text is kept as `null`.
   * @param rejected Whether the person refused to approve the text; `false` by default.
   * @param approved Whether the person approved the text; `false` by default.
   */
  public constructor(steps: readonly PlanStep[], explanation: string | null, text?: string | null, rejected?: boolean, approved?: boolean);

  /**
   * Whether the plan has neither text nor steps.
   */
  public get isEmpty(): boolean;

  /**
   * Merges a reply's plan details into the plan the reply shows: the last plan text, with whether it was refused, and the last checklist with steps.
   * Details that aren't plans, plans of another sub-agent or of the reply itself, and plan payloads that don't read, are skipped.
   * @param details The reply's details, in order.
   * @param parentSequence The sequence of the sub-agent whose own plan to merge, or `null` for the reply's plan.
   * @returns The merged plan, or `null` when it would be empty.
   */
  public static ofDetails(details: readonly MessageDetail[], parentSequence?: number | null): ReplyPlan | null;

  /**
   * Reads a plan from untrusted JSON.
   * @param value The untrusted value, expected to carry `steps` and `explanation`, and `text` unless stored before plans had text; a missing
   * `rejected` or `approved` reads as `false`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The plan.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ReplyPlan;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `steps`, `explanation` and `text`, and `rejected` only when the text was refused, `approved` only when it was approved.
   */
  public toJson(): JsonObject;
}

/**
 * What a provider was observed to serve while producing a message, taken from provider events and
 * never from the request. Every part is `null` until observed; a requested value is never copied
 * here.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class ObservedSettings {
  /**
   * The id of the registered kind that served the message, or `null` until known.
   */
  public readonly kind: string | null;
  /**
   * The model the provider reported, or `null` until known.
   */
  public readonly model: string | null;
  /**
   * The reasoning effort the provider reported, or `null` until known.
   */
  public readonly effort: string | null;
  /**
   * The provider tooling's version, or `null` until known.
   */
  public readonly harnessVersion: string | null;
  /**
   * Whether the requested model was missing from the models the provider listed for the profile, so the provider ran its default; the observed
   * model then stays `null`.
   */
  public readonly unavailableModel: boolean;
  /**
   * The id of the speed the provider reported serving, one of the model's `ProviderModel.speeds`,
   * or `null` for its standard speed or until known.
   */
  public readonly speed: string | null;
  /**
   * Why the provider reported the requested speed can't serve now, in its own words or code, such
   * as `cooldown` after a rate limit; the turn then runs at the standard speed. `null` when nothing
   * blocks it or until known.
   */
  public readonly speedUnavailable: string | null;

  /**
   * Initializes the observed settings.
   * @param kind The id of the registered kind that served the message, or `null` until known.
   * @param model The model the provider reported, or `null` until known.
   * @param effort The reasoning effort the provider reported, or `null` until known.
   * @param harnessVersion The provider tooling's version, or `null` until known.
   * @param unavailableModel Whether the requested model was missing from the provider's listed models; `false` by default.
   * @param speed The id of the speed the provider reported serving, or `null`; `null` by default.
   * @param speedUnavailable Why the requested speed can't serve now, or `null`; `null` by default.
   * @throws nothing; every part may be `null`.
   */
  public constructor(
    kind: string | null,
    model: string | null,
    effort: string | null,
    harnessVersion: string | null,
    unavailableModel?: boolean,
    speed?: string | null,
    speedUnavailable?: string | null);

  /**
   * Reads the observed settings from untrusted JSON.
   * @param value The untrusted value, expected to carry the nullable `kind`, `model`, `effort` and
   * `harnessVersion`, and optionally `unavailableModel`, `false` when missing, and the nullable
   * `speed` and `speedUnavailable`, `null` when missing; any other field, such as the `identity`
   * a reply kept before, is ignored.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The observed settings.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ObservedSettings;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with the nullable `kind`, `model`, `effort` and `harnessVersion`,
   * `unavailableModel`, and the nullable `speed` and `speedUnavailable`.
   */
  public toJson(): JsonObject;
}

/**
 * A folder TeamRun works in.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class Project {
  /**
   * Unique identifier.
   */
  public readonly id: string;
  /**
   * Display name, by default the folder's name.
   */
  public readonly name: string;
  /**
   * Absolute path of the folder.
   */
  public readonly rootPath: string;
  /**
  /**
   * ISO 8601 timestamp of creation.
   */
  public readonly createdAt: string;

  /**
   * Initializes the project.
   * @param id Unique identifier.
   * @param name Display name, by default the folder's name.
   * @param rootPath Absolute path of the folder.
   * @param createdAt ISO 8601 timestamp of creation.
   * @throws ArgumentException when the id, name, root path, or creation timestamp is blank.
   */
  public constructor(id: string, name: string, rootPath: string, createdAt: string);

  /**
   * Reads a project from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `name`, `rootPath`, `vcs`, and
   * `createdAt`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The project.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): Project;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `name`, `rootPath`, and `createdAt`.
   */
  public toJson(): JsonObject;
}

/**
 * A project as the project list answers it, with whether its folder is missing, unreachable or no
 * longer a folder.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProjectListing {
  /**
   * The project.
   */
  public readonly project: Project;
  /**
   * Whether the project's folder is missing, unreachable or no longer a folder, as last known when
   * the list answered.
   */
  public readonly folderMissing: boolean;

  /**
   * Initializes the listing.
   * @param project The project.
   * @param folderMissing Whether the project's folder is missing, unreachable or no longer a folder.
   */
  public constructor(project: Project, folderMissing: boolean);

  /**
   * Reads a listing from untrusted JSON.
   * @param value The untrusted value, expected to carry `project` and `folderMissing`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The listing.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProjectListing;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `project` and `folderMissing`.
   */
  public toJson(): JsonObject;
}

/**
 * A project's folder found missing, unreachable or no longer a folder, or back after that, by a
 * turn, a listing or Open folder. The payload of `ProjectFolderChanged`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProjectFolderChange {
  /**
   * The project's identifier.
   */
  public readonly projectId: string;
  /**
   * Whether the project's folder is now missing, unreachable or no longer a folder.
   */
  public readonly folderMissing: boolean;

  /**
   * Initializes the change.
   * @param projectId The project's identifier.
   * @param folderMissing Whether the project's folder is now missing, unreachable or no longer a folder.
   * @throws ArgumentException when the project's identifier is blank.
   */
  public constructor(projectId: string, folderMissing: boolean);

  /**
   * Reads a change from untrusted JSON.
   * @param value The untrusted value, expected to carry `projectId` and `folderMissing`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The change.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProjectFolderChange;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `projectId` and `folderMissing`.
   */
  public toJson(): JsonObject;
}

/**
 * Where a provider's message came from: the provider it ran under, what was requested, what the
 * provider was observed to serve, and the native session it ran in. Present on a provider's message
 * only.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class Provenance {
  /**
   * The `Provider` the run used, or `null` for the provider's default profile.
   */
  public readonly providerId: string | null;
  /**
   * What was asked of the provider.
   */
  public readonly requested: RequestedSettings;
  /**
   * What the provider was observed to serve.
   */
  public readonly observed: ObservedSettings;
  /**
   * The provider's own session or thread id, or `null` until the provider reports one.
   */
  public readonly nativeSessionId: string | null;
  /**
   * `true` when the run continued an existing native session instead of starting one.
   */
  public readonly resumedNativeSession: boolean;
  /**
   * The provider's own id of the turn the reply ran, or `null` when the provider has none; a rewind
   * forks the session through it.
   */
  public readonly nativeTurnId: string | null;
  /**
   * Where the adapter placed role text; not a claim that the model obeyed it.
   */
  public readonly roleApplied: RoleApplication | null;
  /**
   * Preserves identity/session fields while recording the instruction route.
   */
  public withRoleApplied(roleApplied: RoleApplication | null): Provenance;
  /**
   * What the provider reported the reply used, or `null` when it reported nothing. Omitted from JSON when `null`.
   */
  public readonly usage: ReplyUsage | null;
  /**
   * Returns a copy with newer usage merged in: each figure the newer usage carries replaces the one before, and the others stay.
   * @param usage The newer usage.
   * @returns The copy.
   */
  public withUsage(usage: ReplyUsage): Provenance;

  /**
   * Initializes the provenance.
   * @param providerId The `Provider` the run used, or `null` for the provider's
   * default profile.
   * @param requested What was asked of the provider.
   * @param observed What the provider was observed to serve.
   * @param nativeSessionId The provider's own session or thread id, or `null` until the provider
   * reports one.
   * @param resumedNativeSession `true` when the run continued an existing native session instead of
   * starting one.
   * @param nativeTurnId The provider's own turn id, or `null` (the default).
   * @throws ArgumentException when the message is flagged as resumed without a native session id.
   */
  public constructor(
    providerId: string | null,
    requested: RequestedSettings,
    observed: ObservedSettings,
    nativeSessionId: string | null,
    resumedNativeSession: boolean,
    nativeTurnId?: string | null,
    roleApplied?: RoleApplication | null,
    usage?: ReplyUsage | null);

  /**
   * Reads the provenance from untrusted JSON.
   * @param value The untrusted value, expected to carry the nullable `providerId`, the
   * `requested` and `observed` objects, the nullable `nativeSessionId`, the boolean
   * `resumedNativeSession`, and optionally the nullable `nativeTurnId` (`null` when absent).
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The provenance.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): Provenance;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with the nullable `providerId`, the `requested` and `observed`
   * objects, the nullable `nativeSessionId`, the boolean `resumedNativeSession`, and the nullable
   * `nativeTurnId`.
   */
  public toJson(): JsonObject;

  /**
   * Returns a copy with the provider-native session the turn used.
   * @param nativeSessionId The native session id, or `null`.
   * @param resumedNativeSession Whether the session was resumed rather than started.
   * @param nativeTurnId The provider's turn id; the current one by default.
   * @returns The copy.
   * @throws ArgumentException when a resumed session has no id.
   */
  public withNativeSession(nativeSessionId: string | null, resumedNativeSession: boolean, nativeTurnId?: string | null): Provenance;

  /**
   * Returns a copy with the observed settings.
   * @param observed What the provider reported.
   * @returns The copy.
   */
  public withObserved(observed: ObservedSettings): Provenance;
}

/**
 * A provider sign-in TeamRun may use: a label, the profile directory the provider tooling owns, and
 * what the last check observed. TeamRun never reads the directory's contents; credentials stay with
 * the provider. Not a TeamRun provider, which is the user's own provider for optional services.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class Provider {
  /**
   * Unique identifier.
   */
  public readonly id: string;
  /**
   * Id of the registered provider this profile belongs to, such as `codex` or `claude`. The runtime
   * rejects ids no adapter registered.
   */
  public readonly kind: string;
  /**
   * The user's label, such as `Work`.
   */
  public readonly label: string;
  /**
   * Absolute path of the directory the provider tooling uses for this profile.
   */
  public readonly profileDir: string;
  /**
   * What the last check observed.
   */
  public readonly authStatus: AuthStatus;
  /**
   * The identity the last check observed, or `null` when none was observed.
   */
  public readonly identity: ProviderIdentity | null;
  /**
   * The provider tooling's version the last check observed, or `null` when unknown.
   */
  public readonly harnessVersion: string | null;
  /**
   * ISO 8601 timestamp of the last check, or `null` when never checked.
   */
  public readonly lastCheckedAt: string | null;
  /**
   * Why the last check failed, or `null` when it did not.
   */
  public readonly lastError: string | null;
  /**
   * ISO 8601 timestamp of creation.
   */
  public readonly createdAt: string;
  /**
   * `true` while the provider may start replies; a provider stored before the field existed reads as
   * enabled.
   */
  public readonly enabled: boolean;
  /**
   * Whether the provider's own MCP servers, those its own configuration names, reach its sessions; `false` by default, and
   * for a provider stored before the switch.
   */
  public readonly ownMcpServers: boolean;
  /**
   * Absolute path of the server the person chose for this provider, or `null` to run the one TeamRun installed, else a compatible one on `PATH`;
   * only a kind whose `choosesServerPath` is `true` takes one, and a provider stored before the field existed has none.
   */
  public readonly binaryPath: string | null;

  /**
   * Initializes the provider.
   * @param id Unique identifier.
   * @param kind Id of the registered kind; must not be blank.
   * @param label The user's label, such as `Work`.
   * @param profileDir Absolute path of the directory the provider tooling uses for this profile.
   * @param authStatus What the last check observed.
   * @param identity The identity the last check observed, or `null` when none was observed.
   * @param harnessVersion The provider tooling's version the last check observed, or `null` when
   * unknown.
   * @param lastCheckedAt ISO 8601 timestamp of the last check, or `null` when never checked.
   * @param lastError Why the last check failed, or `null` when it did not.
   * @param createdAt ISO 8601 timestamp of creation.
   * @param enabled `true` while the provider may start replies; `true` by default.
   * @param ownMcpServers Whether the provider's own MCP servers reach its sessions; `false` by default.
   * @param binaryPath Absolute path of the server the person chose, or `null`, the default, for none.
   * @throws ArgumentException when the id, provider, label, profile directory, or creation timestamp
   * is blank, or a given `binaryPath` is blank.
   */
  public constructor(
    id: string,
    kind: string,
    label: string,
    profileDir: string,
    authStatus: AuthStatus,
    identity: ProviderIdentity | null,
    harnessVersion: string | null,
    lastCheckedAt: string | null,
    lastError: string | null,
    createdAt: string,
    enabled?: boolean,
    ownMcpServers?: boolean,
    binaryPath?: string | null);

  /**
   * Reads a provider from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `kind`, `label`, `profileDir`,
   * `authStatus`, the nullable `identity`, `harnessVersion`, `lastCheckedAt`, and `lastError`,
   * `createdAt`, and optionally `enabled` (`true` when absent), `ownMcpServers` (`false` when absent) and the nullable `binaryPath`
   * (`null` when absent).
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The provider.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): Provider;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `kind`, `label`, `profileDir`, `authStatus`, the nullable
   * `identity`, `harnessVersion`, `lastCheckedAt`, and `lastError`, `createdAt`, `enabled`, `ownMcpServers` and `binaryPath`.
   */
  public toJson(): JsonObject;

  /**
   * Returns a copy whose own MCP servers are switched on or off; the other copies keep the switch.
   * @param ownMcpServers Whether the provider's own MCP servers reach its sessions.
   * @returns The copy.
   */
  public withOwnMcpServers(ownMcpServers: boolean): Provider;

  /**
   * Returns a copy that runs another server; a new path clears the last check, which was of the server the provider ran before.
   * @param binaryPath Absolute path of the chosen server, or `null` for none.
   * @returns This provider when the path is the same; otherwise the copy.
   * @throws ArgumentException when a given `binaryPath` is blank.
   */
  public withBinaryPath(binaryPath: string | null): Provider;

  /**
   * Returns a copy carrying the outcome of a sign-in check, enabled as this provider is.
   * @param authStatus The observed status.
   * @param identity The observed identity, or `null` when none was reported.
   * @param harnessVersion The observed harness version, or `null`.
   * @param lastCheckedAt ISO 8601 timestamp of the check, or `null`.
   * @param lastError The check's error, or `null` when it succeeded.
   * @returns The copy.
   */
  public withCheck(
    authStatus: AuthStatus,
    identity: ProviderIdentity | null,
    harnessVersion: string | null,
    lastCheckedAt: string | null,
    lastError: string | null): Provider;

  /**
   * Returns a copy with a new label and profile directory, enabled as this provider is. A copy with a
   * different profile directory has an `Unknown` status and no check, since the last check observed
   * the old one.
   * @param label The user's label, such as `Work`.
   * @param profileDir Absolute path of the profile directory.
   * @returns The copy.
   */
  public withProfile(label: string, profileDir: string): Provider;
  /**
   * Returns a copy enabled or disabled; everything else stays as it is.
   * @param enabled `true` to enable the provider, `false` to disable it.
   * @returns The copy.
   */
  public withEnabled(enabled: boolean): Provider;
}

/**
 * What the provider tooling reported about a provider's sign-in. Every part is optional
 * because providers report different subsets; an absent part is unknown, never guessed. A
 * provider's message records the same class as the identity it observed.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class ProviderIdentity {
  /**
   * The provider's email, when the provider reported one.
   */
  public readonly email: string | undefined;
  /**
   * The subscription plan, such as `pro`, when the provider reported one.
   */
  public readonly plan: string | undefined;
  /**
   * The organization or workspace name, when the provider reported one.
   */
  public readonly organization: string | undefined;
  /**
   * How the provider is signed in, such as `oauth` or `apiKey`, when the provider reported it.
   */
  public readonly authMethod: string | undefined;
  /**
   * The account's user name, such as a GitHub login, when the provider reports one instead of an email.
   */
  public readonly userName: string | undefined;

  /**
   * Initializes the identity.
   * @param email? The provider's email, or `undefined` when unknown.
   * @param plan? The plan, or `undefined` when unknown.
   * @param organization? The organization, or `undefined` when unknown.
   * @param authMethod? The method, or `undefined` when unknown.
   * @param userName? The user name, or `undefined` when unknown.
   * @throws ArgumentException when never; all parts are optional.
   */
  public constructor(email?: string, plan?: string, organization?: string, authMethod?: string, userName?: string);

  /**
   * The account to show: the email, else the user name, else `undefined`.
   */
  public get account(): string | undefined;

  /**
   * Reads a identity from untrusted JSON.
   * @param value The untrusted value, expected to carry the optional `email`, `plan`,
   * `organization`, `authMethod` and `userName` strings; absent parts stay absent, `null` is rejected.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The identity.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProviderIdentity;

  /**
   * The account line every surface shows for a provider: its identity's account, else
   * `Resources.accountNotReported` while it is signed in, else `null`.
   * @param authStatus The provider's sign-in state.
   * @param identity What the provider reported about its account, or `null`.
   * @returns The line, or `null` when there is nothing to show.
   */
  public static describeAccount(authStatus: AuthStatus, identity: ProviderIdentity | null): string | null;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with the optional `email`, `plan`, `organization`, `authMethod` and
   * `userName` strings; absent parts stay absent, `null` is rejected.
   */
  public toJson(): JsonObject;
}

/**
 * A registered provider as `ProviderKindList` reports it: the id the protocol carries as text, the
 * name to show, and what the adapter supports. The descriptor is the only place the protocol learns
 * about a provider; nothing else is hardcoded.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderKind {
  /**
   * The registered id, such as `codex`.
   */
  public readonly id: string;
  /**
   * The name shown to the user.
   */
  public readonly displayName: string;
  /**
   * `true` when the adapter can observe a profile's sign-in state.
   */
  public readonly supportsSignInCheck: boolean;
  /**
   * `true` when the adapter can start the provider's own sign-in for a profile.
   */
  public readonly supportsSignIn: boolean;
  /**
   * What the provider calls the model it runs when none is chosen, such as `Auto`; `null` when it
   * has no name for it.
   */
  public readonly defaultModelName: string | null;
  /**
   * How the kind's tooling finds a provider's profile folder, and how a person signs it in from a
   * terminal; `null` when TeamRun doesn't hand the kind a profile folder through a variable.
   */
  public readonly profile: ProviderProfile | null;
  /**
   * `true` when the adapter can sign a profile out of the provider.
   */
  public readonly supportsSignOut: boolean;
  /**
   * What a person types to sign out in the tool's own session, which `profile.toolCommand` opens, such as `/logout`, when
   * TeamRun can't sign it out, or with `signOutEndsWithCommand` the command a terminal runs by itself, such as `opencode auth logout`; `null` when
   * the kind has no such command or TeamRun signs it out.
   */
  public readonly signOutCommand: string | null;
  /**
   * `true` when the terminal runs `signOutCommand` itself, with the profile's variables, and the sign-out ends with it: an exit of 0 closes the
   * terminal and checks the sign-in again, whatever it finds, and another exit leaves the terminal open; `false` when the sign-out ends once
   * the check finds the provider signed out.
   */
  public readonly signOutEndsWithCommand: boolean;
  /**
   * Why this computer takes only one provider of the kind, such as a sign-in every profile shares; `null` when it takes several.
   */
  public readonly singleAccount: string | null;
  /**
   * Whether the provider's own configuration names its default model and effort, which can change outside TeamRun, and a resumed thread keeps its own.
   */
  public readonly followsOwnConfig: boolean;
  /**
   * What the kind's own-MCP-servers switch covers beyond the servers it lists; `null` when nothing.
   */
  public readonly ownMcpServersNote: string | null;
  /**
   * `ownMcpServersNote` in a few words, such as `your Claude account's connectors`, as the MCP servers page's row shows it beside the
   * kind's servers; `null` when the note has no short form or there is no note. A wire value without the field reads as `null`.
   */
  public readonly ownMcpServersShortNote: string | null;
  /**
   * The kind's answer for every ability, or `null` for a kind that states none.
   */
  public readonly abilities: ProviderAbilities | null;
  /**
   * Whether the kind can name a chat in a title session, so the Title model setting offers its models.
   */
  public readonly namesChats: boolean;
  /**
   * Whether the kind's sign-in is known for sure only once a prompt runs, as for an added ACP agent whose session starts with no account, so a
   * provider that reads as signed in may still need to sign in.
   */
  public readonly confirmsSignInAtPrompt: boolean;
  /**
   * Whether a provider of the kind can name the server it runs, in `Provider.binaryPath`.
   */
  public readonly choosesServerPath: boolean;
  /**
   * Whether TeamRun reads the kind's usage limits, so a teammate on it can turn Sustain on and its accounts can be Sustain entries.
   */
  public readonly reportsLimits: boolean;
  /**
   * Whether a session of the kind goes on under another of its accounts, so a Sustain move between two of its accounts keeps the session;
   * when `false`, such a move starts a new session with a handover.
   */
  public readonly carriesSessions: boolean;
  /**
   * Whether `carriesSessions` was checked for the kind; when `false`, it is assumed, and the views say "not yet checked".
   */
  public readonly sessionsChecked: boolean;

  /**
   * Initializes a provider descriptor.
   * @param id The registered id, such as `codex`.
   * @param displayName The name shown to the user.
   * @param supportsSignInCheck `true` when the adapter can observe a profile's sign-in state.
   * @param supportsSignIn `true` when the adapter can start the provider's own sign-in; `false` by default.
   * @param defaultModelName What the provider calls its model when none is chosen; `null` by default.
   * @param profile How the tooling finds a profile folder and signs it in from a terminal; `null` by
   * default.
   * @param supportsSignOut `true` when the adapter can sign a profile out; `false` by default.
   * @param signOutCommand What a person types in the provider's own tool to sign out, or the command a terminal runs; `null` by default.
   * @param signOutEndsWithCommand Whether the terminal runs `signOutCommand` and the sign-out ends with it; `false` by default.
   * @param singleAccount Why this computer takes only one provider of the kind; `null`, the default, when it takes several.
   * @param followsOwnConfig Whether the provider's own configuration names its default model and effort; `false` by default.
   * @param ownMcpServersNote What the kind's own-MCP-servers switch covers beyond the servers it lists; `null` by default.
   * @param abilities The kind's answer for every ability; `null` by default. When given, its Resume, Fork and OwnServersSwitch cells
   * give `supportsResume`, `supportsFork` and `ownMcpServersUnavailable`; without it, `untabled` gives them.
   * @param namesChats Whether the kind can name a chat; `false` by default.
   * @param confirmsSignInAtPrompt Whether the kind's sign-in is known for sure only once a prompt runs; `false` by default.
   * @param untabled The resume, fork and own-servers-switch reason a kind without `abilities` has; none of the three by default.
   * Only `fromJson`, from the JSON it reads, and `withNamesChats`, from the kind it copies, give it.
   * @param ownMcpServersShortNote `ownMcpServersNote` in a few words; `null` by default.
   * @param choosesServerPath Whether a provider of the kind can name the server it runs; `false` by default.
   * @param reportsLimits Whether TeamRun reads the kind's usage limits; `false` by default.
   * @param carriesSessions Whether a session of the kind goes on under another of its accounts; `true` by default, until a check says otherwise.
   * @param sessionsChecked Whether `carriesSessions` was checked rather than assumed; `false` by default.
   * @throws ArgumentException when `id`, `displayName` or a given `signOutCommand`, `singleAccount` or `ownMcpServersShortNote` are blank.
   */
  public constructor(
    id: string,
    displayName: string,
    supportsSignInCheck: boolean,
    supportsSignIn?: boolean,
    defaultModelName?: string | null,
    profile?: ProviderProfile | null,
    supportsSignOut?: boolean,
    signOutCommand?: string | null,
    signOutEndsWithCommand?: boolean,
    singleAccount?: string | null,
    followsOwnConfig?: boolean,
    ownMcpServersNote?: string | null,
    abilities?: ProviderAbilities | null, namesChats?: boolean, confirmsSignInAtPrompt?: boolean,
    untabled?: { readonly resume: boolean; readonly fork: boolean; readonly ownMcpServersUnavailable: string | null }, ownMcpServersShortNote?: string | null,
    choosesServerPath?: boolean,
    reportsLimits?: boolean,
    carriesSessions?: boolean,
    sessionsChecked?: boolean);

  /**
   * `true` when a reply can continue an earlier native session: from the Resume cell when the kind has `abilities`, where only can't and
   * not built make it `false`; without them, from `supportsResume` in the JSON `fromJson` read, or `false` for a kind made by the constructor.
   */
  public get supportsResume(): boolean;

  /**
   * `true` when the adapter can fork a native session through one of its turns (a rewind keeps the provider's own context that way):
   * from the Fork cell when the kind has `abilities`, as for `supportsResume`; without them, from `supportsFork` in the JSON, or `false`.
   */
  public get supportsFork(): boolean;

  /**
   * Why the kind's own MCP servers can't be switched on, which the Providers panel shows beside the switch; `null` when they can:
   * when the kind has `abilities`, the OwnServersSwitch cell's `reasonAgainst` in `Resources.formatAbilityRefused`'s sentence;
   * without them, `ownMcpServersUnavailable` in the JSON, or `null`.
   */
  public get ownMcpServersUnavailable(): string | null;

  /**
   * Returns the descriptor saying whether the kind can name a chat, which Core knows from its adapter.
   * @param namesChats Whether the kind can name a chat.
   * @returns A copy with `namesChats` set.
   */
  public withNamesChats(namesChats: boolean): ProviderKind;

  /**
   * Says why an ability can't be used with this kind, from its row.
   * @param ability The ability.
   * @returns The row's reason when it says can't or not built; `null` when it works or isn't checked, or the kind has no table.
   */
  public reasonAgainst(ability: ProviderAbility): string | null;

  /**
   * Reads a provider descriptor from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `displayName`, `supportsResume`,
   * `supportsSignInCheck`, and optionally `supportsFork`,
   * `supportsSignIn`, `supportsSignOut`, `signOutEndsWithCommand`, `followsOwnConfig`, `namesChats`, `confirmsSignInAtPrompt`, `choosesServerPath`, `reportsLimits` and `sessionsChecked` (each `false` when absent),
   * `carriesSessions` (`true` when absent), and
   * `defaultModelName`, the `profile` object, `ownMcpServersUnavailable`, `signOutCommand`, `singleAccount` and the `abilities` object (each `null` when absent).
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The provider descriptor.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProviderKind;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `displayName`, `supportsResume`, `supportsSignInCheck`, `supportsFork`, `supportsSignIn`, `defaultModelName`,
   * `profile`, `ownMcpServersUnavailable`, `supportsSignOut`, `signOutCommand`, `signOutEndsWithCommand`, `singleAccount`, `followsOwnConfig`,
   * `ownMcpServersNote`, `abilities`, `namesChats`, `confirmsSignInAtPrompt`, `choosesServerPath`, `reportsLimits`, `carriesSessions` and `sessionsChecked`.
   */
  public toJson(): JsonObject;
}

/** What a provider can be asked to do, each answered in its `ProviderAbilities`. */
export declare enum ProviderAbility {
  /** Run a turn and stop it. */
  RunTurn = "RunTurn",
  /** Continue an earlier chat in the provider's own session. */
  Resume = "Resume",
  /** Rewind to a turn and keep the provider's session up to it. */
  Fork = "Fork",
  /** Compact the provider's context on request. */
  Compact = "Compact",
  /** Take images in a message. */
  Images = "Images",
  /** Take files in a message. */
  Files = "Files",
  /** Take a person's message into a running turn. */
  SteerTurn = "SteerTurn",
  /** Title a chat by the model. */
  ChatTitle = "ChatTitle",
  /** Choose a model. */
  ChooseModel = "ChooseModel",
  /** Choose a reasoning effort. */
  ChooseEffort = "ChooseEffort",
  /** Choose a fast speed. */
  ChooseSpeed = "ChooseSpeed",
  /** Choose a context size. */
  ChooseContext = "ChooseContext",
  /** Plan before changing anything. */
  PlanMode = "PlanMode",
  /** Work without changing files. */
  ReadOnlyMode = "ReadOnlyMode",
  /** Work without asking for approvals. */
  UnrestrictedMode = "UnrestrictedMode",
  /** Ask the person's approval in a card. */
  PermissionCards = "PermissionCards",
  /** Run TeamRun's approved tools without asking. */
  ApprovedTools = "ApprovedTools",
  /** Ask the person questions. */
  Questions = "Questions",
  /** Show a plan checklist in the reply. */
  PlanChecklist = "PlanChecklist",
  /** Report a reply's tokens and cost. */
  ReplyUsage = "ReplyUsage",
  /** Report the plan's limit meters. */
  PlanLimits = "PlanLimits",
  /** Show the provider's own sub-agents as rows. */
  SubAgentRows = "SubAgentRows",
  /** Keep a background sub-agent after its turn. */
  BackgroundSubAgents = "BackgroundSubAgents",
  /** Stop one sub-agent. */
  StopSubAgent = "StopSubAgent",
  /** Follow and stop background commands. */
  BackgroundCommands = "BackgroundCommands",
  /** Run TeamRun's read-only explorer sub-agent. */
  Explorer = "Explorer",
  /** Show images the provider generates. */
  GeneratedImages = "GeneratedImages",
  /** Use TeamRun's tools in a turn. */
  TeamRunTools = "TeamRunTools",
  /** Use shared MCP servers over standard input and output. */
  SharedStdioServers = "SharedStdioServers",
  /** Use shared MCP servers over HTTP. */
  SharedHttpServers = "SharedHttpServers",
  /** Switch the person's own MCP servers on. */
  OwnServersSwitch = "OwnServersSwitch",
  /** List the person's own MCP servers. */
  OwnServersList = "OwnServersList",
  /** Sign in from TeamRun. */
  SignIn = "SignIn",
  /** Sign out from TeamRun. */
  SignOut = "SignOut",
  /** Take several accounts on one computer. */
  SeveralAccounts = "SeveralAccounts",
  /** Show the signed-in account. */
  Account = "Account",
  /** Install and update from TeamRun. */
  Install = "Install",
  /** Send `/compact`. */
  CompactCommand = "CompactCommand",
  /** Run the commands the provider lists for the chat. */
  ListedCommands = "ListedCommands",
  /** Run the provider's other built-in commands. */
  BuiltInCommands = "BuiltInCommands",
  /** Run the person's own commands, prompts and skills. */
  CustomCommands = "CustomCommands",
  /** Send `/logout`, TeamRun's sign-out. */
  LogoutCommand = "LogoutCommand"
}

/** How a provider answers one ability. */
export declare enum AbilityAnswer {
  /** It works. */
  Works = "Works",
  /** The provider can't do it, on the path TeamRun uses. */
  Cannot = "Cannot",
  /** The provider can, and TeamRun hasn't built it yet. */
  NotBuilt = "NotBuilt",
  /** No one has seen it work or fail against the provider yet. */
  NotChecked = "NotChecked"
}

/** Where an ability that works comes from. */
export declare enum AbilitySource {
  /** ACP's own methods and updates, which any ACP agent can offer. */
  Acp = "Acp",
  /** A method or field the provider added to ACP. */
  AcpAddition = "AcpAddition",
  /** Outside ACP: the provider's own SDK, a launch flag or variable, a file the provider writes, a separate process or a terminal. */
  Outside = "Outside"
}

/**
 * A provider's answer for one ability: it works, from where; or the provider can't; or TeamRun hasn't built it; or it isn't checked yet; and why.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's path; `toJson` renders the canonical
 * wire shape.
 */
export declare class AbilityCell {
  /** Whether it works, the provider can't, TeamRun hasn't built it, or it isn't checked. */
  public readonly answer: AbilityAnswer;
  /** Where it comes from when it works; `null` otherwise. */
  public readonly source: AbilitySource | null;
  /** Why it can't, isn't built or isn't checked, or, when it works, what it uses or when; `null` when it works with nothing to add. */
  public readonly detail: string | null;

  /**
   * Initializes an answer.
   * @param answer Whether it works, the provider can't, TeamRun hasn't built it, or it isn't checked.
   * @param source Where it comes from: given exactly when it works.
   * @param detail Why it can't, isn't built or isn't checked, required for those answers; or what a working one uses; `null` by default.
   * @throws ArgumentException when `answer` or `source` aren't their enums' values, `source` is given for an answer other than `Works` or
   * missing for `Works`, or `detail` is blank or missing for an answer other than `Works`.
   */
  public constructor(answer: AbilityAnswer, source: AbilitySource | null, detail?: string | null);

  /**
   * An ability that works.
   * @param source Where it comes from.
   * @param detail What it uses or when; `null` by default.
   * @returns The answer.
   * @throws ArgumentException when `detail` is blank.
   */
  public static works(source: AbilitySource, detail?: string | null): AbilityCell;

  /**
   * An ability the provider can't offer.
   * @param reason Why.
   * @returns The answer.
   * @throws ArgumentException when `reason` is blank.
   */
  public static cannot(reason: string): AbilityCell;

  /**
   * An ability TeamRun hasn't built.
   * @param reason Why, or what's missing.
   * @returns The answer.
   * @throws ArgumentException when `reason` is blank.
   */
  public static notBuilt(reason: string): AbilityCell;

  /**
   * An ability no one has seen work or fail against the provider yet.
   * @param reason What is known, and what is missing.
   * @returns The answer.
   * @throws ArgumentException when `reason` is blank.
   */
  public static notChecked(reason: string): AbilityCell;

  /**
   * The answer alone, as the Settings page shows it at a row's end.
   * @returns `Works`, `Can't`, `Not built yet` or `Not checked yet`.
   */
  public get answerLabel(): string;

  /**
   * Where a working ability comes from, as the Settings page says it under the ability's name.
   * @returns A short sentence without a final period, such as `Through ACP`; `null` when the ability doesn't work.
   */
  public get sourceNote(): string | null;

  /**
   * The reason alone, as the Settings page says it beside an answer that already says it isn't built.
   * @returns `detail` without a leading `Resources.abilityNotBuiltLead` and the mark that joins it; `null` when nothing is left or there is no detail.
   */
  public get reasonAlone(): string | null;

  /**
   * The reason alone with the provider named, as the Settings page shows it under an ability's name.
   * @param displayName The provider's name, such as `Cursor`.
   * @returns `reasonAlone`, with a leading `it ` given as `<displayName> ` and `its ` as `<displayName>'s `; `null` when `reasonAlone` is.
   */
  public reasonFor(displayName: string): string | null;

  /**
   * The answer in a few words, as ARCHITECTURE.md's table shows it.
   * @returns `Works` with where it comes from, such as `Works, outside ACP`, or `answerLabel`.
   */
  public get label(): string;

  /**
   * Says why the ability can't be used, for a control to show and a command to answer.
   * @returns The reason when the answer is `Cannot` or `NotBuilt`; `null` when it works or is built but not yet seen.
   */
  public reasonAgainst(): string | null;

  /**
   * Reads an answer from untrusted JSON.
   * @param value The untrusted value, carrying `answer`, `source` and `detail`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The answer.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   * @throws ArgumentException when the fields break the constructor's rules.
   */
  public static fromJson(value: unknown, path?: string): AbilityCell;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `answer`, `source` and `detail`.
   */
  public toJson(): JsonObject;
}

/**
 * A provider's answers for every ability, one `AbilityCell` each.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's path; `toJson` renders the canonical
 * wire shape, with the abilities in `ProviderAbility`'s order.
 */
export declare class ProviderAbilities {
  /** Each ability's name, as the table and the Settings page show it. */
  public static readonly names: Readonly<Record<ProviderAbility, string>>;
  /** The abilities that are `/` commands, in their order, which the Settings page and ARCHITECTURE.md show as a table of their own. */
  public static readonly commands: readonly ProviderAbility[];

  /** The answer for each ability. */
  public readonly cells: Readonly<Record<ProviderAbility, AbilityCell>>;

  /**
   * Initializes the answers.
   * @param cells An answer for every ability.
   * @throws ArgumentException when an ability has no answer or a key isn't an ability.
   */
  public constructor(cells: Readonly<Record<ProviderAbility, AbilityCell>>);

  /**
   * The answer for one ability.
   * @param ability The ability.
   * @returns Its answer.
   */
  public cellOf(ability: ProviderAbility): AbilityCell;

  /**
   * Reads the answers from untrusted JSON.
   * @param value The untrusted value, carrying `cells`, an object with an answer for each ability.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The answers.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   * @throws ArgumentException when an ability has no answer or a key isn't an ability.
   */
  public static fromJson(value: unknown, path?: string): ProviderAbilities;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `cells`.
   */
  public toJson(): JsonObject;
}

/**
 * How a kind's tooling finds a provider's profile folder: the environment variable that names
 * it, such as `CLAUDE_CONFIG_DIR`, and, for a kind a person signs in from a terminal, the login
 * command to show there, such as `claude auth login`. TeamRun shows the command and never runs it,
 * and never reads, stores or passes a credential.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderProfile {
  /**
   * The environment variable the tooling reads the profile folder from: letters, digits and
   * underscores, not starting with a digit.
   */
  public readonly variable: string;
  /**
   * The login command a person runs in a terminal with `variable` set to the profile folder, or
   * `null` when TeamRun starts the sign-in itself or has none to offer.
   */
  public readonly signInCommand: string | null;
  /**
   * The folder the tooling uses on this computer when no provider names one, from `variable` when
   * it is set and otherwise the tooling's own default, or `null` when the kind names none.
   */
  public readonly usualFolder: string | null;
  /**
   * The command that opens the tool's own session in a terminal with `variable` set to the profile folder, where a person
   * signs out with the kind's `signOutCommand`, or `null` when the kind names none.
   */
  public readonly toolCommand: string | null;
  /**
   * The other environment variables a terminal sign-in sets, each to a folder inside the profile folder, named by its path relative to that
   * folder with `/` between names, such as Cursor's `CURSOR_DATA_DIR` at `data`; empty for a kind whose tooling reads only `variable`.
   */
  public readonly signInVariables: Readonly<Record<string, string>>;
  /**
   * The other environment variables a terminal sign-in sets to fixed values, even blank ones, so
   * the person's own settings stay out of the profile's sign-in; empty for most kinds.
   */
  public readonly signInValues: Readonly<Record<string, string>>;
  /**
   * The folders whose providers run in the person's own setup with the person's own sign-in, shared with their own tool, such as Grok's home
   * and the folder TeamRun once made for Grok, so signing such a provider in or out signs their own tool in or out too; empty for most kinds.
   */
  public readonly personFolders: readonly string[];

  /**
   * Initializes a provider profile.
   * @param variable The environment variable that names the profile folder.
   * @param signInCommand The login command to show in a terminal; `null` by default.
   * @param usualFolder The tooling's usual folder on this computer; `null` by default.
   * @param toolCommand The command that opens the tool's own session in a terminal; `null` by default.
   * @param signInVariables The other variables a terminal sign-in sets, by name, each to its folder's path inside the profile folder; none by
   * default. The value is copied.
   * @param signInValues The other variables a terminal sign-in sets, by name, each to its value; none by default. The value is copied.
   * @param personFolders The folders whose providers use the person's own sign-in; none by default. The value is copied.
   * @throws ArgumentException when `variable` isn't an environment variable name, or `signInCommand`, `usualFolder`, `toolCommand` or a person
   * folder is blank, or a sign-in variable isn't an environment variable name, is `variable` itself, or names a folder that isn't
   * inside the profile folder: empty, absolute, with a `.` or `..` name, or with a character other than letters, digits, `.`, `-` and `_`
   * in a name, or a sign-in value's name isn't an environment variable name, is `variable` or a sign-in variable, or its value holds a null
   * character.
   */
  public constructor(variable: string, signInCommand?: string | null, usualFolder?: string | null, toolCommand?: string | null,
    signInVariables?: Readonly<Record<string, string>>, signInValues?: Readonly<Record<string, string>>, personFolders?: readonly string[]);

  /**
   * Reads a provider profile from untrusted JSON.
   * @param value The untrusted value, expected to carry `variable` and the nullable
   * `signInCommand`, and optionally the nullable `usualFolder` and `toolCommand`, each `null` when left out, and `signInVariables` and
   * `signInValues`, none when left out.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The provider profile.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   * @throws ArgumentException when a sign-in variable or value is refused, as the constructor refuses it.
   */
  public static fromJson(value: unknown, path?: string): ProviderProfile;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `variable`, `signInCommand`, `usualFolder`, `toolCommand`, `signInVariables` and `signInValues`.
   */
  public toJson(): JsonObject;
}

/**
 * A profile folder TeamRun found on this computer that no provider uses yet, which the person may add as a provider.
 */
export declare class DiscoveredProfile {
  /** The provider kind whose profile it is. */
  public readonly kind: string;
  /** The folder's absolute path. */
  public readonly profileDir: string;
  /**
   * The name to suggest for the provider: the folder's name without its leading dot, or the kind's display name for its usual folder.
   */
  public readonly label: string;
  /** Whether the folder is the kind's usual one, the folder its tooling uses when no provider names one. */
  public readonly usual: boolean;
  /** The folder's sign-in, as the kind's own tooling reports it; `Unknown` for a kind with no sign-in check. */
  public readonly authStatus: AuthStatus;
  /** Who the folder is signed in as, as the tooling's check reports it, or `null` when it reports nothing. */
  public readonly identity: ProviderIdentity | null;

  /**
   * Initializes a discovered profile.
   * @param kind The provider kind.
   * @param profileDir The folder's absolute path.
   * @param label The suggested name.
   * @param usual Whether it is the kind's usual folder.
   * @param authStatus Its sign-in.
   * @param identity Who it is signed in as; `null` by default.
   * @throws ArgumentException when `kind`, `profileDir` or `label` is blank.
   */
  public constructor(kind: string, profileDir: string, label: string, usual: boolean, authStatus: AuthStatus, identity?: ProviderIdentity | null);

  /**
   * Reads a discovered profile from untrusted JSON.
   * @param value The untrusted value, expected to carry `kind`, `profileDir`, `label`, `usual`, `authStatus` and the nullable `identity`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The discovered profile.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): DiscoveredProfile;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with every field.
   */
  public toJson(): JsonObject;
}

/**
 * Which kinds a search for profile folders looks for.
 */
export declare class ProviderProfileDiscoverParams {
  /** The kinds to look for, or `null` for every registered kind. */
  public readonly kinds: readonly string[] | null;

  /**
   * Initializes the params.
   * @param kinds The kinds, or `null` for every kind; `null` by default.
   * @throws ArgumentException when a kind is blank.
   */
  public constructor(kinds?: readonly string[] | null);

  /**
   * Reads the params from untrusted JSON; `null`, an object without `kinds` and `kinds: null` all mean every kind.
   * @param value The untrusted value.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The params.
   * @throws JsonException when `kinds` isn't an array of strings; the exception names the field's path.
   * @throws ArgumentException when a kind is blank.
   */
  public static fromJson(value: unknown, path?: string): ProviderProfileDiscoverParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `kinds`.
   */
  public toJson(): JsonObject;
}

/**
 * The profile folders a search found that no provider uses yet, by kind, then the usual folder first, then by name.
 */
export declare class ProviderProfileDiscovery {
  /** The folders found. */
  public readonly profiles: readonly DiscoveredProfile[];

  /**
   * Initializes the result.
   * @param profiles The folders found.
   */
  public constructor(profiles: readonly DiscoveredProfile[]);

  /**
   * Reads the result from untrusted JSON.
   * @param value The untrusted value, expected to carry `profiles`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The result.
   * @throws JsonException when a profile is invalid; the exception names its path.
   */
  public static fromJson(value: unknown, path?: string): ProviderProfileDiscovery;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `profiles`.
   */
  public toJson(): JsonObject;
}

/**
 * What a provider's message asked of the provider: which provider, and the model, effort and speed
 * when the user chose them. What the provider actually served is in `ObservedSettings`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class RequestedSettings {
  /**
   * The id of the registered kind.
   */
  public readonly kind: string;
  /**
   * The requested model, or `null` for the provider's default.
   */
  public readonly model: string | null;
  /**
   * The requested reasoning effort, or `null` for the provider's default.
   */
  public readonly effort: string | null;
  /**
   * The id of the requested speed, one of the model's `ProviderModel.speeds`, or `null` for the
   * provider's default.
   */
  public readonly speed: string | null;
  /**
   * The id of the requested permission mode, one of the provider's `ProviderModelList.modes`, or
   * `null` for the mode TeamRun runs the provider with by default.
   */
  public readonly mode: string | null;
  /**
   * Whether the turn starts in its provider's plan mode, `IProviderAdapter.planMode`, and goes on in `mode` once its plan is approved.
   */
  public readonly planFirst: boolean;
  /**
   * The chosen context window in tokens, within the model's `ProviderModel.contextWindows`, or `null` for the provider's own window.
   */
  public readonly contextWindow: number | null;

  /**
   * Initializes the requested settings.
   * @param kind The id of the registered kind.
   * @param model The requested model, or `null` for the provider's default.
   * @param effort The requested reasoning effort, or `null` for the provider's default.
   * @param speed The id of the requested speed, or `null` for the provider's default; `null` by default.
   * @param mode The id of the requested permission mode, or `null` for TeamRun's default; `null` by default.
   * @param planFirst Whether the turn plans first; `false` by default.
   * @param contextWindow The chosen context window in tokens, or `null` for the provider's own; `null` by default.
   * @throws ArgumentException when the provider, the speed or the mode is blank, or the context window isn't a positive whole number.
   */
  public constructor(kind: string, model: string | null, effort: string | null, speed?: string | null, mode?: string | null, planFirst?: boolean,
    contextWindow?: number | null);

  /**
   * Reads the requested settings from untrusted JSON.
   * @param value The untrusted value, expected to carry `kind` and the nullable `model` and
   * `effort`, and optionally the nullable `speed`, `mode` and `contextWindow`, `null` when missing, and `planFirst`, `false` when missing.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The requested settings.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): RequestedSettings;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `kind` and the nullable `model`, `effort`, `speed` and `mode`, `planFirst` only when it is `true`, and `contextWindow` only
   * when one is chosen.
   */
  public toJson(): JsonObject;

  /**
   * Returns the settings with Plan first on or off; the same instance when it already is.
   * @param planFirst Whether the turn plans first.
   * @returns The settings.
   */
  public withPlanFirst(planFirst: boolean): RequestedSettings;
}

/**
 * Parameters of `ApprovalDecide`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ApprovalDecideParams {
  /**
   * The `Approval` id.
   */
  public readonly approvalId: string;
  /**
   * The id of the chosen `ApprovalOption`.
   */
  public readonly optionId: string;
  /**
   * The person's answers to a `Question` approval, a secret question's among them; `null` for
   * every other decision.
   */
  public readonly answers: readonly QuestionAnswer[] | null;

  /**
   * Initializes the parameters.
   * @param approvalId The `Approval` id.
   * @param optionId The id of the chosen `ApprovalOption`.
   * @param answers The person's answers to a `Question` approval; `null`, the default, otherwise;
   * copied.
   * @throws ArgumentException when `approvalId`, `optionId` are blank.
   */
  public constructor(approvalId: string, optionId: string, answers?: readonly QuestionAnswer[] | null);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `approvalId`, `optionId`, and optionally
   * the `answers` array.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ApprovalDecideParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `approvalId` and `optionId`, and the `answers` array when there are
   * answers.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `BackgroundTaskStop`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class BackgroundTaskIdParams {
  /**
   * The `BackgroundTask` id.
   */
  public readonly taskId: string;

  /**
   * Initializes the parameters.
   * @param taskId The `BackgroundTask` id.
   * @throws ArgumentException when `taskId` is blank.
   */
  public constructor(taskId: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `taskId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): BackgroundTaskIdParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `taskId`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ConversationCreate`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatCreateParams {
  /**
   * The `Project` id, or `null` for a chat without a project.
   */
  public readonly projectId: string | null;
  /**
   * The title, or `null` to derive it from the first message.
   */
  public readonly title: string | null;
  /**
   * The id of the teammate the chat starts with, as New chat with a teammate makes it, or `null` for none; joining it
   * this way doesn't count as the person's change. Requests without it read as `null`.
   */
  public readonly teammateId: string | null;

  /**
   * Initializes the parameters.
   * @param projectId The `Project` id, or `null` for a chat without a project.
   * @param title The title, or `null` to derive it from the first message.
   * @param teammateId The teammate the chat starts with, or `null` (the default).
   * @throws ArgumentException when `projectId` is given and blank, or `teammateId` is given and blank.
   */
  public constructor(projectId: string | null, title: string | null, teammateId?: string | null);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry the nullable `projectId`, the nullable `title` and the optional, nullable
   * `teammateId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ChatCreateParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `projectId`, the nullable `title` and the nullable `teammateId`.
   */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatCreateParams`; the earlier name goes in a later release.
 */
export declare const ConversationCreateParams: typeof ChatCreateParams;
/**
 * @deprecated Use `ChatCreateParams`; the earlier name goes in a later release.
 */
export type ConversationCreateParams = ChatCreateParams;

/**
 * Parameters of the methods that address one chat, such as `ConversationDelete`,
 * `ConversationTouch` and `ApprovalList`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatIdParams {
  /**
   * The `Chat` id.
   */
  public readonly chatId: string;

  /**
   * Initializes the parameters.
   * @param chatId The `Chat` id.
   * @throws ArgumentException when `chatId` is blank.
   */
  public constructor(chatId: string);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ChatIdParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `conversationId`.
   */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatIdParams`; the earlier name goes in a later release.
 */
export declare const ConversationIdParams: typeof ChatIdParams;
/**
 * @deprecated Use `ChatIdParams`; the earlier name goes in a later release.
 */
export type ConversationIdParams = ChatIdParams;

/**
 * Saves a chat's unsent draft, replacing what it held: a file the draft already holds, given by its path, is kept, so a
 * later save sends no bytes again; any other file, by bytes or by a path in the attachments store, is copied into the draft.
 */
export declare class DraftSaveParams {
  /**
   * The chat's id.
   */
  public readonly chatId: string;
  /**
   * The text, which may be empty.
   */
  public readonly text: string;
  /**
   * The files, at most 10, in their order.
   */
  public readonly attachments: readonly AttachmentInput[];
  /**
   * The revision of the draft this one replaces, 0 when it replaces none, or `null` to replace whatever the draft holds;
   * a save whose revision is no longer the draft's is refused with `Conflict`, and the draft and its files stay.
   */
  public readonly revision: number | null;
  /**
   * Initializes the parameters.
   * @param chatId Nonblank chat id.
   * @param text The text.
   * @param attachments The files; none by default.
   * @param revision Non-negative safe integer revision, or `null`, the default.
   * @throws ArgumentException when the id is blank, there are more than 10 files or the revision is not a non-negative safe integer.
   */
  public constructor(chatId: string, text: string, attachments?: readonly AttachmentInput[], revision?: number | null);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;
  /**
   * Decodes the parameters.
   * @param value Object with conversationId, text, attachments and an optional nullable revision.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The parameters.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): DraftSaveParams;
  /**
   * Encodes the parameters.
   * @returns The conversationId, text, attachments and revision wire fields.
   */
  public toJson(): JsonObject;
}

/**
 * Names one image file a reply wrote in its chat's project, to read back.
 */
export declare class LinkedPaths {
  /**
   * Paths a reply links to, as the window resolved them: the paths to look at, or the ones that are folders.
   */
  public readonly paths: readonly string[];
  /**
   * Initializes the paths.
   * @param paths Nonblank paths; the list may be empty.
   * @throws ArgumentException when a path is blank.
   */
  public constructor(paths: readonly string[]);

  /**
   * Decodes the paths.
   * @param value Object with paths.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The paths.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): LinkedPaths;
  /**
   * Encodes the paths.
   * @returns The paths wire field.
   */
  public toJson(): JsonObject;
}

export declare class WrittenImageReadParams {
  /**
   * The chat's id.
   */
  public readonly chatId: string;
  /**
   * The id of the reply that wrote the file.
   */
  public readonly messageId: string;
  /**
   * The file's path, as WrittenImageReader finds it in the reply.
   */
  public readonly path: string;
  /**
   * Initializes the parameters.
   * @param chatId Nonblank chat id.
   * @param messageId Nonblank message id.
   * @param path Nonblank file path.
   * @throws ArgumentException when an id or the path is blank.
   */
  public constructor(chatId: string, messageId: string, path: string);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;
  /**
   * Decodes the parameters.
   * @param value Object with conversationId, messageId and path.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The parameters.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): WrittenImageReadParams;
  /**
   * Encodes the parameters.
   * @returns The conversationId, messageId and path wire fields.
   */
  public toJson(): JsonObject;
}

/**
 * Names one attachment of a chat to read back.
 */
export declare class AttachmentReadParams {
  /**
   * The chat's id.
   */
  public readonly chatId: string;
  /**
   * The saved attachment's path, as its MessageAttachment holds it.
   */
  public readonly path: string;
  /**
   * Initializes the parameters.
   * @param chatId Nonblank chat id.
   * @param path Nonblank attachment path.
   * @throws ArgumentException when the id or the path is blank.
   */
  public constructor(chatId: string, path: string);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;
  /**
   * Decodes the parameters.
   * @param value Object with conversationId and path.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The parameters.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): AttachmentReadParams;
  /**
   * Encodes the parameters.
   * @returns The conversationId and path wire fields.
   */
  public toJson(): JsonObject;
}

/**
 * Discards a chat's unsent draft: at a revision, so a draft saved again since a send stays, or whatever it holds.
 */
export declare class DraftDiscardParams {
  /**
   * The chat's id.
   */
  public readonly chatId: string;
  /**
   * The revision to discard, or `null` for whatever the draft holds.
   */
  public readonly revision: number | null;
  /**
   * Initializes the parameters.
   * @param chatId Nonblank chat id.
   * @param revision Positive safe integer revision, or `null`, the default.
   * @throws ArgumentException when the id is blank or the revision is not a positive safe integer.
   */
  public constructor(chatId: string, revision?: number | null);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;
  /**
   * Decodes the parameters.
   * @param value Object with conversationId and a nullable revision.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The parameters.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): DraftDiscardParams;
  /**
   * Encodes the parameters.
   * @returns The conversationId and revision wire fields.
   */
  public toJson(): JsonObject;
}

/**
 * Where a chat's history was left, as the window part stores it: the message the view was at, by id and sequence,
 * and how far the view's top was from that message's top. A chat left at its end has none.
 */
export declare class ChatPosition {
  /**
   * The chat's id.
   */
  public readonly chatId: string;
  /**
   * The id of the message the view was at.
   */
  public readonly messageId: string;
  /**
   * That message's sequence in the chat, from 0.
   */
  public readonly sequence: number;
  /**
   * The distance, in pixels, from the message's top to the view's top.
   */
  public readonly distance: number;
  /**
   * Initializes the position.
   * @param chatId Nonblank chat id.
   * @param messageId Nonblank message id.
   * @param sequence The message's sequence, a whole number from 0.
   * @param distance A finite distance in pixels.
   * @throws ArgumentException when an id is blank.
   * @throws ArgumentOutOfRangeException when the sequence isn't a whole number from 0 or the distance isn't finite.
   */
  public constructor(chatId: string, messageId: string, sequence: number, distance: number);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;
  /**
   * Decodes the position.
   * @param value Object with conversationId, messageId, sequence and distance.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The position.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): ChatPosition;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with conversationId, messageId, sequence and distance.
   */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatPosition`; the earlier name goes in a later release.
 */
export declare const ConversationPosition: typeof ChatPosition;
/**
 * @deprecated Use `ChatPosition`; the earlier name goes in a later release.
 */
export type ConversationPosition = ChatPosition;

/**
 * Who made a page or one of its versions: a teammate by id and name, or, with no id, the chat's own teammate or the person.
 * @remarks
 * Instances are immutable.
 */
export declare class PageAuthor {
  /**
   * The teammate's id, or null for the chat's own teammate or the person.
   */
  public readonly teammateId: string | null;
  /**
   * The name shown for the author.
   */
  public readonly name: string;
  /**
   * Initializes the author.
   * @param teammateId Nonblank teammate id, or null.
   * @param name Nonblank name.
   * @throws ArgumentException when the id or the name is blank.
   */
  public constructor(teammateId: string | null, name: string);

  /**
   * Decodes the author.
   * @param value Object with teammateId and name.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The author.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): PageAuthor;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with teammateId and name.
   */
  public toJson(): JsonObject;
}

/**
 * An HTML page a teammate showed in a chat: its id, title, current version, who made it and who made the current version,
 * the file it was shown from and the current version's size.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class Page {
  /**
   * The page's id.
   */
  public readonly id: string;
  /**
   * The chat the page belongs to.
   */
  public readonly chatId: string;
  /**
   * The page's title.
   */
  public readonly title: string;
  /**
   * The current version, from 1.
   */
  public readonly version: number;
  /**
   * Who made the page's first version.
   */
  public readonly madeBy: PageAuthor;
  /**
   * Who made the current version.
   */
  public readonly editedBy: PageAuthor;
  /**
   * The file in the chat's folder the page was last shown from.
   */
  public readonly path: string;
  /**
   * The current version's size in bytes, as UTF-8.
   */
  public readonly bytes: number;
  /**
   * When the page was made, as an ISO-8601 string.
   */
  public readonly createdAt: string;
  /**
   * When the current version was made, as an ISO-8601 string.
   */
  public readonly updatedAt: string;
  /**
   * Whether the record is an HTML page or a canvas; a stored record without it is a page.
   */
  public readonly kind: PageKind;
  /**
   * Initializes the page.
   * @throws ArgumentException when an id, the title, the path or a time is blank.
   * @throws ArgumentOutOfRangeException when the version isn't a whole number from 1, the size isn't a whole number from 0, or the kind isn't a
   * PageKind.
   */
  public constructor(id: string, chatId: string, title: string, version: number, madeBy: PageAuthor, editedBy: PageAuthor, path: string, bytes: number,
    createdAt: string, updatedAt: string, kind?: PageKind);

  /**
   * Decodes the page.
   * @param value Object with id, chatId, title, version, madeBy, editedBy, path, bytes, createdAt and updatedAt, and an optional kind that defaults to page.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The page.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): Page;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with every field, its authors as objects.
   */
  public toJson(): JsonObject;
}

/**
 * One kept version of a page: its number, who made it and when.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class PageVersion {
  /**
   * The version's number, from 1.
   */
  public readonly version: number;
  /**
   * Who made the version.
   */
  public readonly editedBy: PageAuthor;
  /**
   * When the version was made, as an ISO-8601 string.
   */
  public readonly createdAt: string;
  /**
   * Initializes the version.
   * @throws ArgumentOutOfRangeException when the number isn't a whole number from 1.
   * @throws ArgumentException when the time is blank.
   */
  public constructor(version: number, editedBy: PageAuthor, createdAt: string);

  /**
   * Decodes the version.
   * @param value Object with version, editedBy and createdAt.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The version.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): PageVersion;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with version, editedBy as an object, and createdAt.
   */
  public toJson(): JsonObject;
}

/**
 * What the window needs to show a page: the page, its kept versions newest first, the version to show, the address that loads it
 * from the runtime's page server, and the path of the page's saved copy.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class PageView {
  /**
   * The page.
   */
  public readonly page: Page;
  /**
   * The page's kept versions, newest first.
   */
  public readonly versions: readonly PageVersion[];
  /**
   * The version the address loads, one of the kept versions.
   */
  public readonly version: number;
  /**
   * The kept version the address loads, which `version` names.
   */
  public readonly shown: PageVersion;
  /**
   * The page server's address for this page and version, with the page's key.
   */
  public readonly address: string;
  /**
   * The path of the page's saved copy of its current version.
   */
  public readonly file: string;
  /**
   * Initializes the view.
   * @throws ArgumentOutOfRangeException when the version isn't one of the kept versions.
   * @throws ArgumentException when the address or the file is blank.
   */
  public constructor(page: Page, versions: readonly PageVersion[], version: number, address: string, file: string);

  /**
   * Decodes the view.
   * @param value Object with page, versions, version, address and file.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The view.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): PageView;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with every field, the page and versions as objects.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of a page method: the page's id and a version, or null for the current one.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class PageRequest {
  /**
   * The page's id.
   */
  public readonly pageId: string;
  /**
   * The version asked for, or null for the current one.
   */
  public readonly version: number | null;
  /**
   * Initializes the request.
   * @throws ArgumentException when the id is blank.
   * @throws ArgumentOutOfRangeException when the version isn't null or a whole number from 1.
   */
  public constructor(pageId: string, version?: number | null);

  /**
   * Decodes the request.
   * @param value Object with pageId and version.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The request.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): PageRequest;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with pageId and version.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of the edited page list method: the teammate whose pages and canvases to list.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class PageEditedListRequest {
  /**
   * The teammate's id.
   */
  public readonly teammateId: string;
  /**
   * Initializes the request.
   * @throws ArgumentException when the id is blank.
   */
  public constructor(teammateId: string);

  /**
   * Decodes the request.
   * @param value Object with teammateId.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The request.
   * @throws JsonException for a missing or incorrectly typed field.
   * @throws ArgumentException for a blank id.
   */
  public static fromJson(value: unknown, path?: string): PageEditedListRequest;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with teammateId.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of the page list method: the chat whose pages to list.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class PageListRequest {
  /**
   * The chat's id.
   */
  public readonly chatId: string;
  /**
   * Initializes the request.
   * @throws ArgumentException when the id is blank.
   */
  public constructor(chatId: string);

  /**
   * Decodes the request.
   * @param value Object with chatId.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The request.
   * @throws JsonException for a missing or incorrectly typed field.
   * @throws ArgumentException for a blank id.
   */
  public static fromJson(value: unknown, path?: string): PageListRequest;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with chatId.
   */
  public toJson(): JsonObject;
}

/**
 * The methods Pages' runtime serves its window, each taking a `PageRequest` but `PageList`, which takes a `PageListRequest`, and
 * `PageEditedList`, which takes a `PageEditedListRequest`; values
 * match the member names, and the qualified name starts lowercase, as `teamrun.pageOpen`.
 */
export declare enum PageMethodName {
  /**
   * Answers the `PageView` of the version asked for, or the current one, after giving the page's views the origins they may load.
   */
  PageOpen = "PageOpen",
  /**
   * Answers the HTML of the version asked for, or the current one, as a string.
   */
  PageRead = "PageRead",
  /**
   * Makes the version asked for the page's next version, by the person, and answers the page.
   */
  PageRestore = "PageRestore",
  /**
   * Answers the chat's pages, the most recently changed first, as an array of `Page`.
   */
  PageList = "PageList",
  /**
   * Answers, across chats, the pages and canvases whose latest version the teammate wrote, the most recently changed first, at most 20, as an
   * array of `Page`; a canvas's artboards are left out, as its own.
   */
  PageEditedList = "PageEditedList"
}

/**
 * The events Pages' runtime sends its window, each with the page; values match the member names, and the qualified name starts
 * lowercase, as `teamrun.pageShown`.
 */
export declare enum PageEventName {
  /**
   * A teammate showed the page, new or again.
   */
  PageShown = "PageShown",
  /**
   * The page has a new version from an edit or a restore.
   */
  PageUpdated = "PageUpdated",
  /**
   * An open view of the page didn't answer its ping in time.
   */
  PageStopped = "PageStopped"
}

/**
 * What a page record holds: an HTML page, or a canvas of artboards.
 */
export declare enum PageKind {
  /**
   * An HTML page.
   */
  Page = "Page",
  /**
   * A canvas: its versions hold a manifest of artboards, notes, marks and guides, and each artboard is a page of its own.
   */
  Canvas = "Canvas"
}

/**
 * What a note on a canvas is.
 */
export declare enum CanvasNoteKind {
  /**
   * A section title.
   */
  Title = "Title",
  /**
   * A sticky note.
   */
  Sticky = "Sticky",
  /**
   * A link, with its address.
   */
  Link = "Link"
}

/**
 * What a mark drawn on a canvas is.
 */
export declare enum CanvasMarkKind {
  /**
   * Text at a point.
   */
  Text = "Text",
  /**
   * A rectangle from two corners.
   */
  Rectangle = "Rectangle",
  /**
   * An oval inside two corners.
   */
  Oval = "Oval",
  /**
   * A closed shape through its points.
   */
  Polygon = "Polygon",
  /**
   * A line between two points.
   */
  Line = "Line",
  /**
   * A line with an arrowhead at its end.
   */
  Arrow = "Arrow",
  /**
   * A freehand stroke.
   */
  Pencil = "Pencil",
  /**
   * A freehand highlighter stroke.
   */
  Marker = "Marker",
  /**
   * An image placed between two corners.
   */
  Image = "Image"
}

/**
 * The direction of a guide on a canvas.
 */
export declare enum CanvasAxis {
  /**
   * A guide across the canvas at a y.
   */
  Horizontal = "Horizontal",
  /**
   * A guide down the canvas at an x.
   */
  Vertical = "Vertical"
}

/**
 * A page of a canvas: a named sheet its artboards, notes, marks and guides sit on.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class CanvasPage {
  /**
   * The canvas page's id, unique in the canvas.
   */
  public readonly id: string;
  /**
   * The canvas page's name.
   */
  public readonly name: string;
  /**
   * Initializes the canvas page.
   * @throws ArgumentException when the id or the name is blank.
   * @throws ArgumentOutOfRangeException when the id or the name is over 120 characters.
   */
  public constructor(id: string, name: string);

  /**
   * Decodes the canvas page.
   * @param value Object with id and name.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The canvas page.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): CanvasPage;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with id and name.
   */
  public toJson(): JsonObject;
}

/**
 * An artboard on a canvas: a version of a page, placed at a position and size on one of the canvas's pages.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class CanvasArtboard {
  /**
   * The artboard's id, unique in the canvas.
   */
  public readonly id: string;
  /**
   * The page the artboard shows.
   */
  public readonly pageId: string;
  /**
   * The version of that page the artboard shows, from 1.
   */
  public readonly pageVersion: number;
  /**
   * The id of the canvas page the artboard is on.
   */
  public readonly canvasPage: string;
  /**
   * The artboard's left edge, in canvas pixels.
   */
  public readonly x: number;
  /**
   * The artboard's top edge, in canvas pixels.
   */
  public readonly y: number;
  /**
   * The artboard's width, in canvas pixels.
   */
  public readonly width: number;
  /**
   * The artboard's height, in canvas pixels.
   */
  public readonly height: number;
  /**
   * The artboard's title.
   */
  public readonly title: string;
  /**
   * Whether the artboard is locked against moves.
   */
  public readonly locked: boolean;
  /**
   * Whether the artboard is hidden.
   */
  public readonly hidden: boolean;
  /**
   * The group the artboard is in, or null.
   */
  public readonly group: string | null;
  /**
   * Initializes the artboard.
   * @throws ArgumentException when an id, the canvas page, the title or a group is blank.
   * @throws ArgumentOutOfRangeException when the page version isn't a whole number from 1, a position isn't finite, a size isn't above 0, or the id,
   * the canvas page, the title or the group is over 120 characters.
   */
  public constructor(id: string, pageId: string, pageVersion: number, canvasPage: string, x: number, y: number, width: number, height: number, title: string,
    locked: boolean, hidden: boolean, group: string | null);

  /**
   * Decodes the artboard.
   * @param value Object with id, pageId, pageVersion, canvasPage, x, y, width, height, title, locked, hidden and group.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The artboard.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): CanvasArtboard;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with every field.
   */
  public toJson(): JsonObject;
}

/**
 * A note on a canvas: a title, a sticky note or a link, with who wrote it and when.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class CanvasNote {
  /**
   * The note's id, unique in the canvas.
   */
  public readonly id: string;
  /**
   * The id of the canvas page the note is on.
   */
  public readonly canvasPage: string;
  /**
   * The note's left edge, in canvas pixels.
   */
  public readonly x: number;
  /**
   * The note's top edge, in canvas pixels.
   */
  public readonly y: number;
  /**
   * The note's width, in canvas pixels.
   */
  public readonly width: number;
  /**
   * What the note is.
   */
  public readonly kind: CanvasNoteKind;
  /**
   * The note's text.
   */
  public readonly text: string;
  /**
   * A link's address, or null for a note that isn't a link.
   */
  public readonly href: string | null;
  /**
   * Who wrote the note.
   */
  public readonly author: PageAuthor;
  /**
   * When the note was written, as an ISO-8601 string.
   */
  public readonly at: string;
  /**
   * Initializes the note.
   * @throws ArgumentException when the id, the canvas page, the text or the time is blank, or a link has no address.
   * @throws ArgumentOutOfRangeException when a position isn't finite, the width isn't above 0, the kind isn't a CanvasNoteKind, or the id is over
   * 120 characters.
   */
  public constructor(id: string, canvasPage: string, x: number, y: number, width: number, kind: CanvasNoteKind, text: string, href: string | null,
    author: PageAuthor, at: string);

  /**
   * Decodes the note.
   * @param value Object with id, canvasPage, x, y, width, kind, text, href, author and at.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The note.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): CanvasNote;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with every field, its author as an object.
   */
  public toJson(): JsonObject;
}

/**
 * A mark drawn on a canvas: a shape, a line, a stroke, text or an image, with its style and who drew it.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class CanvasMark {
  /**
   * The mark's id, unique in the canvas.
   */
  public readonly id: string;
  /**
   * The id of the canvas page the mark is on.
   */
  public readonly canvasPage: string;
  /**
   * What the mark is.
   */
  public readonly kind: CanvasMarkKind;
  /**
   * The mark's points, as x and y pairs in canvas pixels.
   */
  public readonly geometry: readonly number[];
  /**
   * The stroke colour, as a CSS colour.
   */
  public readonly colour: string;
  /**
   * The stroke width, in canvas pixels.
   */
  public readonly weight: number;
  /**
   * The fill colour, as a CSS colour, or null for none.
   */
  public readonly fill: string | null;
  /**
   * A text mark's text, or null for a mark that isn't text.
   */
  public readonly text: string | null;
  /**
   * The group the mark is in, or null.
   */
  public readonly group: string | null;
  /**
   * Whether the mark is locked against moves.
   */
  public readonly locked: boolean;
  /**
   * Whether the mark is hidden.
   */
  public readonly hidden: boolean;
  /**
   * Who drew the mark.
   */
  public readonly author: PageAuthor;
  /**
   * Initializes the mark.
   * @throws ArgumentException when the id, the canvas page, the colour, a fill, a text or a group is blank, or a text mark has no text.
   * @throws ArgumentOutOfRangeException when the kind isn't a CanvasMarkKind, the points aren't finite x and y pairs, at least one, the weight isn't
   * above 0, or the id is over 120 characters.
   */
  public constructor(id: string, canvasPage: string, kind: CanvasMarkKind, geometry: readonly number[], colour: string, weight: number, fill: string | null,
    text: string | null, group: string | null, locked: boolean, hidden: boolean, author: PageAuthor);

  /**
   * Decodes the mark.
   * @param value Object with id, canvasPage, kind, geometry, colour, weight, fill, text, group, locked, hidden and author.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The mark.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): CanvasMark;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with every field, its author as an object.
   */
  public toJson(): JsonObject;
}

/**
 * A guide on a canvas page: a line across or down it, for lining things up.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class CanvasGuide {
  /**
   * The id of the canvas page the guide is on.
   */
  public readonly canvasPage: string;
  /**
   * The guide's direction.
   */
  public readonly axis: CanvasAxis;
  /**
   * Where the guide is: a y for a horizontal guide, an x for a vertical one, in canvas pixels.
   */
  public readonly at: number;
  /**
   * Initializes the guide.
   * @throws ArgumentException when the canvas page is blank.
   * @throws ArgumentOutOfRangeException when the axis isn't a CanvasAxis or the position isn't finite.
   */
  public constructor(canvasPage: string, axis: CanvasAxis, at: number);

  /**
   * Decodes the guide.
   * @param value Object with canvasPage, axis and at.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The guide.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): CanvasGuide;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with canvasPage, axis and at.
   */
  public toJson(): JsonObject;
}

/**
 * What one version of a canvas holds: its pages, and the artboards, notes, marks and guides on them.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape, kept as the canvas version's content.
 */
export declare class CanvasManifest {
  /**
   * The canvas's pages, in order; at least one.
   */
  public readonly pages: readonly CanvasPage[];
  /**
   * The artboards, back to front.
   */
  public readonly artboards: readonly CanvasArtboard[];
  /**
   * The notes.
   */
  public readonly notes: readonly CanvasNote[];
  /**
   * The marks, back to front.
   */
  public readonly marks: readonly CanvasMark[];
  /**
   * The guides.
   */
  public readonly guides: readonly CanvasGuide[];
  /**
   * Initializes the manifest.
   * @throws ArgumentException when there are no pages, two pages, artboards, notes or marks share an id, or an item is on a page the canvas doesn't have.
   */
  public constructor(pages: readonly CanvasPage[], artboards: readonly CanvasArtboard[], notes: readonly CanvasNote[], marks: readonly CanvasMark[],
    guides: readonly CanvasGuide[]);

  /**
   * Decodes the manifest.
   * @param value Object with pages, artboards, notes, marks and guides, each an array.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The manifest.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): CanvasManifest;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with each array, its items as objects.
   */
  public toJson(): JsonObject;
}

/**
 * The output of a Run on a reply's shell block, kept with the block so an earlier Run shows it after a reload.
 * It is the person's own: TeamRun never adds it to what a teammate reads.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class RunOutput {
  /**
   * The id of the chat the message is in.
   */
  public readonly chatId: string;
  /**
   * The id of the message whose block ran.
   */
  public readonly messageId: string;
  /**
   * The part of the message the block is in, such as its body.
   */
  public readonly site: string;
  /**
   * The block's index in its part of the message.
   */
  public readonly block: number;
  /**
   * The output, as Terminal's `TerminalRunOutput.toJson` renders it; TeamRun stores it without reading it.
   */
  public readonly output: JsonObject;
  /**
   * Initializes the output.
   * @param chatId The chat's id.
   * @param messageId The message's id.
   * @param site The block's part of the message.
   * @param block The block's index, a whole number from 0.
   * @param output The output's JSON object, copied.
   * @throws ArgumentException when an id or the site is blank.
   * @throws ArgumentOutOfRangeException when the block isn't a whole number from 0.
   */
  public constructor(chatId: string, messageId: string, site: string, block: number, output: JsonObject);
  /**
   * Decodes the output.
   * @param value Object with chatId, messageId, site, block and output.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The output.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): RunOutput;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with chatId, messageId, site, block and output.
   */
  public toJson(): JsonObject;
}

/**
 * Stores some chats' reading positions and clears others', in one request; a chat that no longer exists is
 * skipped.
 */
export declare class ReadingPositionSaveParams {
  /**
   * The positions to store, each replacing the chat's earlier one.
   */
  public readonly positions: readonly ChatPosition[];
  /**
   * The ids of the chats whose position to clear, so they open at their end.
   */
  public readonly cleared: readonly string[];
  /**
   * The positions whose message is gone, each cleared only while the chat's stored position still names its
   * message, so a newer position another window stored stays.
   */
  public readonly dropped: readonly ChatPosition[];
  /**
   * Initializes the parameters.
   * @param positions The positions to store.
   * @param cleared The chats to clear; none by default.
   * @param dropped The positions to clear while still stored; none by default.
   * @throws ArgumentException when a cleared id is blank or a chat is named more than once.
   */
  public constructor(positions: readonly ChatPosition[], cleared?: readonly string[], dropped?: readonly ChatPosition[]);
  /**
   * Decodes the parameters.
   * @param value Object with positions, cleared and dropped.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The parameters.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): ReadingPositionSaveParams;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with positions, cleared and dropped.
   */
  public toJson(): JsonObject;
}

/**
 * The responder a chat's composer chose to answer a teammate's message that mentions no one: either a teammate, or
 * the default teammate's settings with the provider it runs on.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class ChatResponder {
  /**
   * The chosen teammate's id, or `null` when the default teammate is chosen.
   */
  public readonly teammateId: string | null;
  /**
   * The default teammate's provider, model and effort, or `null` when a teammate is chosen.
   */
  public readonly requested: RequestedSettings | null;
  /**
   * The default teammate's provider, or `null` for the provider's default provider or when a teammate is chosen.
   */
  public readonly providerId: string | null;

  /**
   * Initializes the responder.
   * @param teammateId The chosen teammate's id, or `null` for the default teammate.
   * @param requested The default teammate's settings, or `null` (the default) for a teammate.
   * @param providerId The default teammate's provider, or `null` (the default).
   * @throws ArgumentException when both or neither of the teammate and the settings are given, when a provider is
   * given with a teammate, or when a given id is blank.
   */
  public constructor(teammateId: string | null, requested?: RequestedSettings | null, providerId?: string | null);

  /**
   * Reads a responder from untrusted JSON.
   * @param value The untrusted value, expected to carry `teammateId`, `requested` and `providerId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The responder.
   * @throws JsonException when a field is invalid, or the fields don't make a teammate or a default teammate.
   */
  public static fromJson(value: unknown, path?: string): ChatResponder;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `teammateId`, `requested` and `providerId`.
   */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatResponder`; the earlier name goes in a later release.
 */
export declare const ConversationResponder: typeof ChatResponder;
/**
 * @deprecated Use `ChatResponder`; the earlier name goes in a later release.
 */
export type ConversationResponder = ChatResponder;

/**
 * The default teammate set in Settings: the provider, model, effort and provider a new chat starts from.
 *
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class DefaultTeammate {
  /**
   * The provider, model and effort.
   */
  public readonly requested: RequestedSettings;
  /**
   * The provider, or `null` for the provider's default provider.
   */
  public readonly providerId: string | null;

  /**
   * Initializes the default teammate.
   * @param requested The provider, model and effort.
   * @param providerId The provider, or `null` (the default).
   * @throws ArgumentException when the provider id is blank.
   */
  public constructor(requested: RequestedSettings, providerId?: string | null);

  /**
   * Reads a default teammate from untrusted JSON.
   * @param value The untrusted value, expected to carry `requested` and `providerId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The default teammate.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): DefaultTeammate;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `requested` and `providerId`.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `DefaultTeammateSet`: the default teammate to set, or `null` to clear it.
 */
export declare class DefaultTeammateSetParams {
  /**
   * The default teammate, or `null` to clear it.
   */
  public readonly defaultTeammate: DefaultTeammate | null;

  /**
   * Initializes the parameters.
   */
  public constructor(defaultTeammate: DefaultTeammate | null);

  /**
   * Reads the parameters from untrusted JSON.
   * @throws JsonException when `defaultTeammate` is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): DefaultTeammateSetParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `ProjectsLayoutSave`: the Projects view's layout, a JSON object the window defines and TeamRun
 * keeps as it is.
 */
export declare class ProjectsLayoutSaveParams {
  /**
   * The layout.
   */
  public readonly layout: JsonObject;

  /**
   * Whether the layout is saved only when none is kept yet, as when a window moves a layout an earlier version
   * stored; the answer is then the layout that is kept.
   */
  public readonly onlyIfNone: boolean;

  /**
   * Initializes the parameters.
   */
  public constructor(layout: JsonObject, onlyIfNone?: boolean);

  /**
   * Reads the parameters from untrusted JSON; a missing `onlyIfNone` is `false`.
   * @throws JsonException when `layout` is missing or not an object, or `onlyIfNone` is not a boolean.
   */
  public static fromJson(value: unknown, path?: string): ProjectsLayoutSaveParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `ComposerDefaultSave`: the composer's default choice, a JSON object the window defines and TeamRun
 * keeps as it is.
 */
export declare class ComposerDefaultSaveParams {
  /**
   * The choice.
   */
  public readonly choice: JsonObject;

  /**
   * Whether the choice is saved only when none is kept yet, as when a window moves a choice an earlier version stored;
   * the answer is then the choice that is kept.
   */
  public readonly onlyIfNone: boolean;

  /**
   * Initializes the parameters.
   */
  public constructor(choice: JsonObject, onlyIfNone?: boolean);

  /**
   * Reads the parameters from untrusted JSON; a missing `onlyIfNone` is `false`.
   * @throws JsonException when `choice` is missing or not an object, or `onlyIfNone` is not a boolean.
   */
  public static fromJson(value: unknown, path?: string): ComposerDefaultSaveParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `ConversationResponderSet`: a chat and the responder its composer chose to answer a teammate's
 * message that mentions no one.
 */
export declare class ChatResponderParams {
  /**
   * The chat id.
   */
  public readonly chatId: string;
  /**
   * The chosen responder, or `null` to clear the choice.
   */
  public readonly responder: ChatResponder | null;
  /**
   * Whether the person chose it, by picking a kind, provider, model, effort or responder, rather than the composer
   * keeping the settings a chat carries over; a person's choice marks the chat edited. Requests without it read as
   * `false`.
   */
  public readonly chosen: boolean;
  /**
   * Whether to set the responder only when the chat holds none, as the composer's starting choice does, so it never
   * replaces a responder a mention or another window set; a chat that holds one is returned unchanged. Requests without it
   * read as `false`.
   */
  public readonly start: boolean;

  /**
   * Initializes the parameters.
   * @param chatId The chat id.
   * @param responder The chosen responder, or `null` to clear the choice.
   * @param chosen Whether the person chose it; `false` by default.
   * @param start Whether to set it only when the chat holds no responder; `false` by default.
   * @throws ArgumentException when the chat id is blank.
   */
  public constructor(chatId: string, responder: ChatResponder | null, chosen?: boolean, start?: boolean);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, `responder` and the optional `chosen` and `start`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): ChatResponderParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `conversationId`, `responder`, `chosen` and `start`.
   */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatResponderParams`; the earlier name goes in a later release.
 */
export declare const ConversationResponderParams: typeof ChatResponderParams;
/**
 * @deprecated Use `ChatResponderParams`; the earlier name goes in a later release.
 */
export type ConversationResponderParams = ChatResponderParams;

/**
 * Parameters of `ConversationRename`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatRenameParams {
  /**
   * The `Chat` id.
   */
  public readonly chatId: string;
  /**
   * The new title; must not be blank.
   */
  public readonly title: string;

  /**
   * Initializes the parameters.
   * @param chatId The `Chat` id.
   * @param title The new title; must not be blank.
   * @throws ArgumentException when `chatId`, `title` are blank.
   */
  public constructor(chatId: string, title: string);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, `title`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ChatRenameParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `conversationId`, `title`.
   */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatRenameParams`; the earlier name goes in a later release.
 */
export declare const ConversationRenameParams: typeof ChatRenameParams;
/**
 * @deprecated Use `ChatRenameParams`; the earlier name goes in a later release.
 */
export type ConversationRenameParams = ChatRenameParams;

/**
 * Parameters of `ConversationList` and `ConversationListEmpty`: one project's chats, or the chats without a project.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatListParams {
  /**
   * The `Project` id, or `null` for the chats without a project.
   */
  public readonly projectId: string | null;

  /**
   * Initializes the parameters.
   * @param projectId The `Project` id, or `null` for the chats without a project.
   * @throws ArgumentException when `projectId` is blank.
   */
  public constructor(projectId: string | null);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `projectId`, a string or `null`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ChatListParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `projectId`.
   */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatListParams`; the earlier name goes in a later release.
 */
export declare const ConversationListParams: typeof ChatListParams;
/**
 * @deprecated Use `ChatListParams`; the earlier name goes in a later release.
 */
export type ConversationListParams = ChatListParams;

/**
 * Parameters of `ConversationMove`: the chat and the project it moves to.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatMoveParams {
  /**
   * The `Chat` id.
   */
  public readonly chatId: string;
  /**
   * The id of the project the chat moves to; must not be blank.
   */
  public readonly projectId: string;

  /**
   * Initializes the parameters.
   * @param chatId The `Chat` id.
   * @param projectId The id of the project the chat moves to.
   * @throws ArgumentException when `chatId`, `projectId` are blank.
   */
  public constructor(chatId: string, projectId: string);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, `projectId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or blank, naming its path.
   */
  public static fromJson(value: unknown, path?: string): ChatMoveParams;

  /**
   * Renders the wire shape.
   * @returns An object with `conversationId`, `projectId`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ChatFolderAttach`: the chat and the existing folder it works in from then on.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatFolderAttachParams {
  /**
   * The `Chat` id.
   */
  public readonly chatId: string;
  /**
   * The folder's absolute path; must not be blank.
   */
  public readonly folder: string;

  /**
   * Initializes the parameters.
   * @param chatId The `Chat` id.
   * @param folder The folder's absolute path.
   * @throws ArgumentException when `chatId`, `folder` are blank.
   */
  public constructor(chatId: string, folder: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `chatId`, `folder`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or blank, naming its path.
   */
  public static fromJson(value: unknown, path?: string): ChatFolderAttachParams;

  /**
   * Renders the wire shape.
   * @returns An object with `chatId`, `folder`.
   */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatMoveParams`; the earlier name goes in a later release.
 */
export declare const ConversationMoveParams: typeof ChatMoveParams;
/**
 * @deprecated Use `ChatMoveParams`; the earlier name goes in a later release.
 */
export type ConversationMoveParams = ChatMoveParams;

/**
 * Payload of `DetailAppended` and `DetailUpdated`: the message the detail belongs to and the
 * detail itself.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
/**
 * Parameters of `ConversationSearch`: the text to find and how many hits at most.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatSearchParams {
  /**
   * The text to find; must not be blank.
   */
  public readonly query: string;
  /**
   * How many hits at most, 1 to 100.
   */
  public readonly limit: number;

  /**
   * Initializes the parameters.
   * @param query The text to find; must not be blank.
   * @param limit How many hits at most; an integer from 1 to 100.
   * @throws ArgumentException when the query is blank or the limit is outside 1–100.
   */
  public constructor(query: string, limit: number);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `query` and the integer `limit`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ChatSearchParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `query` and `limit`.
   */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatSearchParams`; the earlier name goes in a later release.
 */
export declare const ConversationSearchParams: typeof ChatSearchParams;
/**
 * @deprecated Use `ChatSearchParams`; the earlier name goes in a later release.
 */
export type ConversationSearchParams = ChatSearchParams;

/**
 * One hit of `ConversationSearch`: the chat, and the message that matched when the title did not.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatSearchHit {
  /**
   * The chat id.
   */
  public readonly chatId: string;
  /**
   * The chat's project id, or `null` for a chat without a project.
   */
  public readonly projectId: string | null;
  /**
   * The chat's title.
   */
  public readonly title: string;
  /**
   * The matching message's id, or `null` when the title matched.
   */
  public readonly messageId: string | null;
  /**
   * The title, or the part of the message text around the match.
   */
  public readonly snippet: string;
  /**
   * The matching message's sequence, or `null` when the title matched.
   */
  public readonly sequence: number | null;
  /**
   * The chat's `updatedAt`.
   */
  public readonly updatedAt: string;

  /**
   * Initializes the hit.
   * @param chatId The chat id; must not be blank.
   * @param projectId The project id, or `null` for a chat without a project; must not be blank.
   * @param title The chat's title.
   * @param messageId The matching message's id, or `null`.
   * @param snippet The text shown for the hit.
   * @param updatedAt The chat's `updatedAt`; must not be blank.
   * @throws ArgumentException when an id or the timestamp is blank.
   */
  public constructor(chatId: string, projectId: string | null, title: string, messageId: string | null, snippet: string, updatedAt: string,
    sequence?: number | null);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Reads the hit from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, `projectId`, `title`, the nullable
   * `messageId`, `snippet`, and `updatedAt`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The hit.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ChatSearchHit;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `conversationId`, `projectId`, `title`, `messageId`, `snippet`, `updatedAt`.
   */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatSearchHit`; the earlier name goes in a later release.
 */
export declare const ConversationSearchHit: typeof ChatSearchHit;
/**
 * @deprecated Use `ChatSearchHit`; the earlier name goes in a later release.
 */
export type ConversationSearchHit = ChatSearchHit;

/**
 * Result of `ConversationSearch`: the hits, the latest chat first.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatSearchResult {
  /**
   * The hits, one per chat.
   */
  public readonly hits: readonly ChatSearchHit[];

  /**
   * Initializes the result.
   * @param hits The hits.
   */
  public constructor(hits: readonly ChatSearchHit[]);

  /**
   * Reads the result from untrusted JSON.
   * @param value The untrusted value, expected to carry the `hits` array.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The result.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ChatSearchResult;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `hits`.
   */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatSearchResult`; the earlier name goes in a later release.
 */
export declare const ConversationSearchResult: typeof ChatSearchResult;
/**
 * @deprecated Use `ChatSearchResult`; the earlier name goes in a later release.
 */
export type ConversationSearchResult = ChatSearchResult;

/**
 * Parameters of `ChatFind`: the text a chat's title holds, or blank for the latest chats, and how many chats at most.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatFindParams {
  /**
   * The text to find, trimmed; blank for the latest chats.
   */
  public readonly query: string;
  /**
   * How many chats at most, 1 to 100.
   */
  public readonly limit: number;

  /**
   * Initializes the parameters.
   * @param query The text to find, which is trimmed; blank for the latest chats.
   * @param limit How many chats at most; an integer from 1 to 100.
   * @throws ArgumentException when the limit is outside 1–100.
   */
  public constructor(query: string, limit: number);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry the string `query` and the integer `limit`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ChatFindParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `query` and `limit`.
   */
  public toJson(): JsonObject;
}

/**
 * A chat `ChatFind` found: its id, project, title, the names of its teammates in the order they joined, and when it
 * was last updated.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatFindHit {
  /** The chat's id. */
  public readonly chatId: string;
  /** The chat's project, or `null` for a chat outside projects. */
  public readonly projectId: string | null;
  /** The chat's title, which may be empty. */
  public readonly title: string;
  /** The names of the chat's teammates, in the order they joined. */
  public readonly teammateNames: readonly string[];
  /** When the chat was last updated, as an ISO 8601 timestamp. */
  public readonly updatedAt: string;

  /**
   * Initializes the hit.
   * @throws ArgumentException when the chat id, a non-null project id, a teammate's name or the timestamp is blank.
   */
  public constructor(chatId: string, projectId: string | null, title: string, teammateNames: readonly string[], updatedAt: string);

  /**
   * Reads the hit from untrusted JSON.
   * @param value The untrusted value, expected to carry `chatId`, `projectId`, `title`, `teammateNames` and `updatedAt`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The hit.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ChatFindHit;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with each field.
   */
  public toJson(): JsonObject;
}

/**
 * Result of `ChatFind`: the chats found, the latest updated first, and how many there are in all.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatFindResult {
  /** The chats found, as many as the limit. */
  public readonly hits: readonly ChatFindHit[];
  /** How many chats match in all, which may be more than `hits` holds. */
  public readonly total: number;

  /**
   * Initializes the result.
   * @throws ArgumentOutOfRangeException when the total isn't an integer or is fewer than the hits.
   */
  public constructor(hits: readonly ChatFindHit[], total: number);

  /**
   * Reads the result from untrusted JSON.
   * @param value The untrusted value, expected to carry the `hits` array and the integer `total`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The result.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ChatFindResult;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `hits` and `total`.
   */
  public toJson(): JsonObject;
}

/**
 * A message `MessageSearch` found: its chat, the chat's project and title, the message's id and sequence, who
 * wrote it, a snippet of its text around the match, and when it was written.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessageSearchHit {
  /** The message's chat. */
  public readonly chatId: string;
  /** The chat's project, or `null` for a chat outside projects. */
  public readonly projectId: string | null;
  /** The chat's title, which may be empty. */
  public readonly chatTitle: string;
  /** The message's id. */
  public readonly messageId: string;
  /** The message's sequence in its chat. */
  public readonly sequence: number;
  /** Who wrote the message: the person or a sender in their place, a provider, or TeamRun. */
  public readonly author: MessageAuthor;
  /** The name a `User` message was sent as, such as "TeamRun" or a teammate's, or `null` for the person's own. */
  public readonly senderName: string | null;
  /** The name of the teammate whose reply this is, or `null` for a message no teammate wrote. */
  public readonly teammateName: string | null;
  /** The provider a `Provider` message came from, or `null` when it names none. */
  public readonly providerId: string | null;
  /** The kind of provider a `Provider` message came from, as observed or else as requested, or `null` for any other message. */
  public readonly providerKind: string | null;
  /** The message's text around the match, on one line, with "…" where it was cut. */
  public readonly snippet: string;
  /** When the message was written, as an ISO 8601 timestamp. */
  public readonly createdAt: string;

  /**
   * Initializes the hit.
   * @throws ArgumentException when the chat id, a non-null project id, the message id, a non-null sender name, teammate
   * name, provider id or provider kind, or the timestamp is blank.
   * @throws ArgumentOutOfRangeException when the sequence isn't a non-negative integer.
   */
  public constructor(chatId: string, projectId: string | null, chatTitle: string, messageId: string, sequence: number, author: MessageAuthor,
    senderName: string | null, teammateName: string | null, providerId: string | null, providerKind: string | null, snippet: string, createdAt: string);

  /**
   * Reads the hit from untrusted JSON.
   * @param value The untrusted value, expected to carry each field.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The hit.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): MessageSearchHit;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with each field.
   */
  public toJson(): JsonObject;
}

/**
 * Result of `MessageSearch`: the messages found, the newest first, and how many there are in all.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessageSearchResult {
  /** The messages found, as many as the limit. */
  public readonly hits: readonly MessageSearchHit[];
  /** How many messages match in all, which may be more than `hits` holds; the cap when `capped`. */
  public readonly total: number;
  /** Whether more messages match than Core counts, so `total` is a floor. */
  public readonly capped: boolean;

  /**
   * Initializes the result.
   * @throws ArgumentOutOfRangeException when the total isn't an integer or is fewer than the hits.
   */
  public constructor(hits: readonly MessageSearchHit[], total: number, capped: boolean);

  /**
   * Reads the result from untrusted JSON.
   * @param value The untrusted value, expected to carry the `hits` array, the integer `total` and the boolean `capped`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The result.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): MessageSearchResult;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `hits` and `total`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ConversationRewind`: the message to remove together with everything after it, and whether to restore
 * the project's files to the snapshot taken before the removed reply started.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatRewindParams {
  /**
   * The `Chat` id.
   */
  public readonly chatId: string;
  /**
   * The id of the first message to remove; it and every later message go.
   */
  public readonly messageId: string;
  /**
   * Whether to restore the project's files to the snapshot taken before the removed reply started.
   */
  public readonly restoreFiles: boolean;

  /**
   * Initializes the parameters.
   * @param chatId The `Chat` id.
   * @param messageId The id of the first message to remove.
   * @param restoreFiles Whether to restore the project's files.
   * @throws ArgumentException when `chatId`, `messageId` are blank.
   */
  public constructor(chatId: string, messageId: string, restoreFiles: boolean);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, `messageId`, `restoreFiles`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ChatRewindParams;

  /**
   * Renders the parameters.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatRewindParams`; the earlier name goes in a later release.
 */
export declare const ConversationRewindParams: typeof ChatRewindParams;
/**
 * @deprecated Use `ChatRewindParams`; the earlier name goes in a later release.
 */
export type ConversationRewindParams = ChatRewindParams;

/**
 * Result of `ConversationRewind`: the chat as it stands, the ids of the messages removed, how many files
 * the restore changed (`null` when no files were restored), and, when a restore was asked for and changed nothing, why.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatRewindResult {
  /**
   * The chat after the cut, with `sessionReset` set.
   */
  public readonly chat: Chat;
  /**
   * The ids of the messages removed, in sequence order.
   */
  public readonly removedMessageIds: readonly string[];
  /**
   * How many files the restore changed, or `null` when no files were restored.
   */
  public readonly restoredFiles: number | null;
  /**
   * `true` when the provider's own session continues from the cut (forked through the last kept
   * reply); `false` when the next reply starts a fresh session told the transcript.
   */
  public readonly sessionKept: boolean;
  /**
   * Why the asked-for restore changed no files, in plain words, as for a reply without a checkpoint or a folder another program
   * changed since; `null` when it finished or none was asked for.
   */
  public readonly restoreRefusal: string | null;

  /**
   * Initializes the result.
   * @param chat The chat after the cut.
   * @param removedMessageIds The ids of the messages removed.
   * @param restoredFiles How many files the restore changed, or `null`.
   * @param sessionKept Whether the provider's session continues; `false` by default.
   * @param restoreRefusal Why the asked-for restore changed no files, or `null`; `null` by default.
   */
  public constructor(chat: Chat, removedMessageIds: readonly string[], restoredFiles: number | null, sessionKept?: boolean,
    restoreRefusal?: string | null);

  /**
   * The chat, by its earlier name.
   * @deprecated Use `chat`; the earlier name goes in a later release.
   */
  public get conversation(): Chat;

  /**
   * Reads the result from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversation`, `removedMessageIds`, `restoredFiles`, and optionally
   * `sessionKept` (`false` when absent) and `restoreRefusal` (`null` when absent).
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The result.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ChatRewindResult;

  /**
   * Renders the result.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatRewindResult`; the earlier name goes in a later release.
 */
export declare const ConversationRewindResult: typeof ChatRewindResult;
/**
 * @deprecated Use `ChatRewindResult`; the earlier name goes in a later release.
 */
export type ConversationRewindResult = ChatRewindResult;

/**
 * Payload of `ConversationRewound`: which chat was cut and from which sequence on.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ChatRewoundPayload {
  /**
   * The `Chat` id.
   */
  public readonly chatId: string;
  /**
   * The sequence of the first message removed; every message from it on is gone.
   */
  public readonly fromSequence: number;

  /**
   * Initializes the payload.
   * @param chatId The `Chat` id.
   * @param fromSequence The sequence of the first message removed; must not be negative.
   * @throws ArgumentException when `chatId` is blank.
   * @throws ArgumentOutOfRangeException when `fromSequence` is negative.
   */
  public constructor(chatId: string, fromSequence: number);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Reads the payload from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, `fromSequence`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The payload.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ChatRewoundPayload;

  /**
   * Renders the payload.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatRewoundPayload`; the earlier name goes in a later release.
 */
export declare const ConversationRewoundPayload: typeof ChatRewoundPayload;
/**
 * @deprecated Use `ChatRewoundPayload`; the earlier name goes in a later release.
 */
export type ConversationRewoundPayload = ChatRewoundPayload;

/**
 * Payload of `SignInLink`: the provider signing in and the page its sign-in asks to open.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class SignInLinkPayload {
  /**
   * The `Provider` id.
   */
  public readonly providerId: string;
  /**
   * The page to open, as the provider gave it.
   */
  public readonly url: string;

  /**
   * Initializes the payload.
   * @param providerId The `Provider` id.
   * @param url The page to open.
   * @throws ArgumentException when `providerId` or `url` is blank.
   */
  public constructor(providerId: string, url: string);

  /**
   * Reads the payload from untrusted JSON.
   * @param value The untrusted value, expected to carry `providerId`, `url`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The payload.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): SignInLinkPayload;

  /**
   * Renders the payload.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * Payload of `PanelRequested`: a teammate's tool asks one window to open or close a panel.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class PanelRequestedPayload {
  /**
   * The request's id, which the window answers with `PanelAnswered`.
   */
  public readonly requestId: string;
  /**
   * The window that acts; every other window ignores the request.
   */
  public readonly windowId: string;
  /**
   * The panel to open or close.
   */
  public readonly panel: PanelName;
  /**
   * The `Chat` id of the chat to open or close, for `PanelName.Chat` only; null for every other panel.
   */
  public readonly chatId: string | null;
  /**
   * Whether the window opens the panel; false closes it.
   */
  public readonly open: boolean;

  /**
   * Initializes the payload.
   * @param requestId The request's id.
   * @param windowId The window that acts.
   * @param panel The panel.
   * @param chatId The chat's `Chat` id for `PanelName.Chat`, else null.
   * @param open Whether to open the panel.
   * @throws ArgumentException when `requestId` or `windowId` is blank, `chatId` is given and blank,
   * or `chatId` is null for `PanelName.Chat` or given for another panel.
   */
  public constructor(requestId: string, windowId: string, panel: PanelName, chatId: string | null, open: boolean);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string | null;

  /**
   * Reads the payload from untrusted JSON.
   * @param value The untrusted value, expected to carry `requestId`, `windowId`, `panel`, `conversationId`, `open`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The payload.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): PanelRequestedPayload;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `requestId`, `windowId`, `panel`, `conversationId`, `open`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `WindowFocused`: the window and the chat its middle area shows.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class WindowFocusedParams {
  /**
   * The id the window's TeamRun part made for itself.
   */
  public readonly windowId: string;
  /**
   * The `Chat` id of the chat the window's middle area shows, or null when it shows none.
   */
  public readonly shownChatId: string | null;
  /**
   * Whether the person focused the window, so it becomes the one focused last; false for a report of the shown chat while the window is in the
   * background.
   */
  public readonly focused: boolean;

  /**
   * Initializes the parameters.
   * @param windowId The window's id.
   * @param shownChatId The shown chat's `Chat` id, or null.
   * @param focused Whether the person focused the window.
   * @throws ArgumentException when `windowId` is blank, or `shownChatId` is given and blank.
   */
  public constructor(windowId: string, shownChatId: string | null, focused: boolean);

  /**
   * The shown chat's id, by its earlier name.
   * @deprecated Use `shownChatId`; the earlier name goes in a later release.
   */
  public get shownConversationId(): string | null;

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `windowId`, `shownConversationId`, `focused`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): WindowFocusedParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `windowId`, `shownConversationId`, `focused`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of the methods that address one window, such as `WindowClosed`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class WindowIdParams {
  /**
   * The id the window's TeamRun part made for itself.
   */
  public readonly windowId: string;

  /**
   * Initializes the parameters.
   * @param windowId The window's id.
   * @throws ArgumentException when `windowId` is blank.
   */
  public constructor(windowId: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `windowId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): WindowIdParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `windowId`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `PanelAnswered`: the `PanelRequested` request the window acted on.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class PanelAnsweredParams {
  /**
   * The request's id, from `PanelRequestedPayload.requestId`.
   */
  public readonly requestId: string;
  /**
   * The window that answers; an answer after the wait stops the focus order skipping it.
   */
  public readonly windowId: string;
  /**
   * What the window did.
   */
  public readonly outcome: PanelOutcome;

  /**
   * Initializes the parameters.
   * @param requestId The request's id.
   * @param windowId The answering window's id.
   * @param outcome What the window did.
   * @throws ArgumentException when `requestId` or `windowId` is blank, or `outcome` isn't a `PanelOutcome`.
   */
  public constructor(requestId: string, windowId: string, outcome: PanelOutcome);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `requestId`, `windowId`, `outcome`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): PanelAnsweredParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `requestId`, `windowId`, `outcome`.
   */
  public toJson(): JsonObject;
}

export declare class DetailEventPayload {
  /**
   * The `Message` id.
   */
  public readonly messageId: string;
  /**
   * The appended or updated detail.
   */
  public readonly detail: MessageDetail;

  /**
   * Initializes the payload.
   * @param messageId The `Message` id.
   * @param detail The appended or updated detail.
   * @throws ArgumentException when `messageId` is blank.
   */
  public constructor(messageId: string, detail: MessageDetail);

  /**
   * Reads the payload from untrusted JSON.
   * @param value The untrusted value, expected to carry `messageId`, the `detail` object.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The payload.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): DetailEventPayload;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `messageId`, the `detail` object.
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `BackgroundTaskOutput`: output a running background task wrote, in the order it
 * came.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class BackgroundTaskOutputPayload {
  /**
   * The `Chat` id.
   */
  public readonly chatId: string;
  /**
   * The `BackgroundTask` id.
   */
  public readonly taskId: string;
  /**
   * The new output.
   */
  public readonly text: string;

  /**
   * Initializes the payload.
   * @param chatId The `Chat` id.
   * @param taskId The `BackgroundTask` id.
   * @param text The new output.
   * @throws ArgumentException when `chatId` or `taskId` is blank, or `text` is empty.
   */
  public constructor(chatId: string, taskId: string, text: string);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Reads the payload from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, `taskId`, `text`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The payload.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): BackgroundTaskOutputPayload;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `conversationId`, `taskId`, `text`.
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `BackgroundTasksCleared` and the result of `BackgroundTaskClearFinished`: the
 * finished background tasks a chat forgot, named by the chat and the time of the clear rather than
 * by their ids, so the payload stays small however many tasks a clear removes.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class BackgroundTasksClearedPayload {
  /**
   * The `Chat` id.
   */
  public readonly chatId: string;
  /**
   * When the clear ran, as an ISO 8601 time from the same clock as a task's `endedAt`: every
   * `BackgroundTask` of the chat that had ended by then is forgotten, and one that ends later is kept.
   */
  public readonly clearedAt: string;
  /**
   * How many `BackgroundTask`s were forgotten, possibly none.
   */
  public readonly count: number;

  /**
   * Initializes the payload.
   * @param chatId The `Chat` id.
   * @param clearedAt When the clear ran.
   * @param count How many `BackgroundTask`s were forgotten.
   * @throws ArgumentException when `chatId` or `clearedAt` is blank.
   * @throws ArgumentOutOfRangeException when `count` isn't a non-negative safe integer.
   */
  public constructor(chatId: string, clearedAt: string, count: number);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Reads the payload from untrusted JSON.
   * @param value The untrusted value, expected to carry `chatId`, `clearedAt`, `count`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The payload.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): BackgroundTasksClearedPayload;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `chatId`, `clearedAt`, `count`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `MessageDetailsAfter`: the details a reader doesn't hold yet, and the ones it holds that changed.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessageDetailsAfterParams {
  /**
   * The `Message` id.
   */
  public readonly messageId: string;

  /**
   * The last detail sequence the reader holds; details after it are read.
   */
  public readonly afterSequence: number;

  /**
   * The sequences at or before `afterSequence` that changed since the reader read them, at most 1,000.
   */
  public readonly sequences: readonly number[];

  /**
   * Initializes the parameters.
   * @param messageId The `Message` id.
   * @param afterSequence The last detail sequence the reader holds.
   * @param sequences The held sequences that changed, at most 1,000.
   * @throws ArgumentException when `messageId` is blank.
   * @throws ArgumentOutOfRangeException when `afterSequence` or a sequence is not a non-negative
   * integer, or when there are more than 1,000 sequences.
   */
  public constructor(messageId: string, afterSequence: number, sequences: readonly number[]);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `messageId`, `afterSequence` and `sequences`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or of the wrong type; the exception names the
   * field's path.
   * @throws ArgumentOutOfRangeException when a value is out of range, as the constructor says.
   */
  public static fromJson(value: unknown, path?: string): MessageDetailsAfterParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `messageId`, `afterSequence` and `sequences`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of the methods that address one message: `MessageCancel`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessageIdParams {
  /**
   * The `Message` id.
   */
  public readonly messageId: string;

  /**
   * Initializes the parameters.
   * @param messageId The `Message` id.
   * @throws ArgumentException when `messageId` is blank.
   */
  public constructor(messageId: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `messageId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): MessageIdParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `messageId`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `MessageList`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessageListParams {
  /**
   * The `Chat` id.
   */
  public readonly chatId: string;
  /**
   * Return only messages with a greater sequence, or `null` for all; a non-negative integer.
   */
  public readonly afterSequence: number | null;
  /**
   * The kinds of detail to return, or empty for every kind; a message keeps only the details of
   * these kinds.
   */
  public readonly kinds: readonly DetailKind[];

  /**
   * Initializes the parameters.
   * @param chatId The `Chat` id.
   * @param afterSequence Return only messages with a greater sequence, or `null` for all; a
   * non-negative integer.
   * @param kinds The kinds of detail to return; empty, the default, for every kind.
   * @throws ArgumentException when `chatId` is blank; `ArgumentOutOfRangeException` when
   * `afterSequence` is present but negative or not an integer, or a kind is unknown.
   */
  public constructor(chatId: string, afterSequence: number | null, kinds?: readonly DetailKind[]);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, the nullable
   * `afterSequence`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): MessageListParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `conversationId`, the nullable `afterSequence`.
   */
  public toJson(): JsonObject;
}

/**
 * A page of a chat's messages in sequence order, whether messages lie before its first
 * one and after its last one, and how many messages the whole chat holds.
 * @remarks
 * A chat's sequences run from 0 to `count - 1` without gaps, so a message's sequence is
 * its place in the chat.
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessagePage {
  /**
   * The messages, in sequence order.
   */
  public readonly messages: readonly Message[];
  /**
   * Whether messages lie before the first one; `false` for an empty page.
   */
  public readonly hasEarlier: boolean;
  /**
   * Whether messages lie after the last one; `false` for an empty page.
   */
  public readonly hasLater: boolean;
  /**
   * How many messages the whole chat holds.
   */
  public readonly count: number;

  /**
   * Initializes the page.
   * @param messages The messages, in sequence order.
   * @param hasEarlier Whether messages lie before the first one.
   * @param hasLater Whether messages lie after the last one.
   * @param count How many messages the whole chat holds.
   * @throws ArgumentOutOfRangeException when `count` is not an integer or is less than the page's
   * messages.
   */
  public constructor(messages: readonly Message[], hasEarlier: boolean, hasLater: boolean, count: number);

  /**
   * Reads the page from untrusted JSON.
   * @param value The untrusted value, expected to carry `messages`, `hasEarlier`, `hasLater`,
   * `count`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The page.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): MessagePage;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `messages`, `hasEarlier`, `hasLater`, `count`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `MessagePage`: a page of a chat's messages, the newest ones when neither
 * cursor is given, the ones before a sequence, or the ones after one; at most `limit` of them.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessagePageParams {
  /**
   * The `Chat` id.
   */
  public readonly chatId: string;
  /**
   * Return the messages before this sequence, or `null`; a non-negative integer.
   */
  public readonly beforeSequence: number | null;
  /**
   * Return the messages after this sequence, or `null`; a non-negative integer.
   */
  public readonly afterSequence: number | null;
  /**
   * How many messages at most; 1 through 500.
   */
  public readonly limit: number;

  /**
   * Initializes the parameters.
   * @param chatId The `Chat` id.
   * @param beforeSequence Return the messages before this sequence, or `null`.
   * @param afterSequence Return the messages after this sequence, or `null`.
   * @param limit How many messages at most; 1 through 500.
   * @throws ArgumentException when `chatId` is blank or both cursors are given;
   * `ArgumentOutOfRangeException` when a cursor is negative or not an integer, or the limit is
   * out of range.
   */
  public constructor(chatId: string, beforeSequence: number | null, afterSequence: number | null, limit: number);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, the nullable
   * `beforeSequence` and `afterSequence`, `limit`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): MessagePageParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `conversationId`, `beforeSequence`, `afterSequence`, `limit`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `MessageSend`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessageSendParams {
  /**
   * Files to save with the message; copied on construction. Defaults to an empty list.
   */
  public readonly attachments: readonly AttachmentInput[];
  /**
   * The `Chat` id.
   */
  public readonly chatId: string;
  /**
   * The user's text; may be blank when attachments are present.
   */
  public readonly text: string;
  /**
   * Settings for the unnamed responder; may be null when mentions or a named responder select saved settings.
   */
  public readonly requested: RequestedSettings | null;
  /**
   * The teammates `text` names, in the order they first appear there: exactly what `MentionResolver.resolve` finds in `text`
   * among the current teammates, or `MentionResolver.resolveTeammateText` for a send with a sender token; a repeated identity runs once.
   * Core refuses any other list with `Conflict`.
   */
  public readonly mentionedTeammateIds: readonly string[];
  /**
   * Named default responder, or null for the unnamed one.
   */
  public readonly responderTeammateId: string | null;
  /**
   * The token of the teammate's turn sending from inside a chat, as `teamrun send` reads it from its environment, or `null` for
   * the person. Core issues it for the turn and revokes it when the reply ends; it marks the message with that turn's teammate and
   * chat, queues it behind the target chat's running send instead of refusing it, and stops the chain at the Teammate hand-offs
   * limit. Omitted from JSON when `null`.
   */
  public readonly senderToken: string | null;
  /**
   * Whether the sending turn is woken, with a new turn and a note quoting the replies' last text, once the replies this send
   * starts, and the hand-offs they start in that chat, have ended. Only a send with `senderToken` may ask; omitted from JSON
   * when `false`.
   */
  public readonly wakeWhenDone: boolean;
  /**
   * The `Provider` to run under, or `null` for the provider's default profile.
   */
  public readonly providerId: string | null;

  /**
   * Initializes the parameters.
   * @param chatId The `Chat` id.
   * @param text The user's text; may be blank when attachments are present.
   * @param requested The provider, model, and effort to ask for.
   * @param providerId The `Provider` to run under, or `null` for the provider's
   * default profile.
   * @param attachments Files to save; defaults to empty. The runtime enforces count, encoding, size and saved-path limits.
   * @param mentionedTeammateIds The teammates `text` names, as `mentionedTeammateIds` says; defaults to empty.
   * @param responderTeammateId The named default responder, or `null` for the unnamed one; defaults to `null`.
   * @param senderToken The token of the sending teammate's turn, or `null` for the person; defaults to `null`.
   * @param wakeWhenDone Whether the sending turn is woken when the replies end, as `wakeWhenDone` says; defaults to `false`.
   * @throws ArgumentException when `chatId` is blank, when `text` is blank without attachments, when `providerId`
   * or `senderToken` is present but blank, or when the person's send names no teammate, no responder and no `requested`
   * settings, or when `wakeWhenDone` is `true` without `senderToken`; a send with `senderToken` may name none, and its chat's
   * chosen responder answers it.
   */
  public constructor(chatId: string, text: string, requested: RequestedSettings | null, providerId: string | null,
    attachments?: readonly AttachmentInput[],
    mentionedTeammateIds?: readonly string[],
    responderTeammateId?: string | null,
    senderToken?: string | null,
    wakeWhenDone?: boolean);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, `text`, the `requested`
   * object, the nullable `providerId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   * @throws ArgumentException when the value names a `sender`, which only a turn's `senderToken` gives.
   */
  public static fromJson(value: unknown, path?: string): MessageSendParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `conversationId`, `text`, the `requested` object, the nullable
   * `providerId`.
   */
  public toJson(): JsonObject;
}

/**
 * Result of `MessageSend`: the stored user message and its ordered replies, which are updated
 * through events. The replies list may be empty.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessageSendResult {
  /**
   * The user's message as stored.
   */
  public readonly sent: Message;
  /**
   * Zero or more pending replies in responder order.
   */
  public readonly replies: readonly Message[];
  /**
   * The wake a `wakeWhenDone` send recorded, or `null` when it asked for none or started no reply. Omitted from JSON when
   * `null`.
   */
  public readonly wakeId: string | null;

  /**
   * Initializes the result.
   * @param sent The user's message as stored.
   * @param replies The pending replies in responder order, empty when all responders are unavailable.
   * @param wakeId The recorded wake's id, or `null`; defaults to `null`.
   * @throws ArgumentException when `wakeId` is present but blank.
   */
  public constructor(sent: Message, replies: readonly Message[], wakeId?: string | null);

  /**
   * Reads the result from untrusted JSON.
   * @param value The untrusted value, expected to carry the `sent` object, the `reply` object.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The result.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): MessageSendResult;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with the `sent` object, the `reply` object.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ProjectForget`, which addresses one project.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProjectIdParams {
  /**
   * The `Project` id.
   */
  public readonly projectId: string;

  /**
   * Initializes the parameters.
   * @param projectId The `Project` id.
   * @throws ArgumentException when `projectId` is blank.
   */
  public constructor(projectId: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `projectId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProjectIdParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `projectId`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ProjectOpen`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProjectOpenParams {
  /**
   * Absolute path of the folder.
   */
  public readonly rootPath: string;

  /**
   * Initializes the parameters.
   * @param rootPath Absolute path of the folder.
   * @throws ArgumentException when `rootPath` is blank.
   */
  public constructor(rootPath: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `rootPath`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProjectOpenParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `rootPath`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ProviderCreate`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderCreateParams {
  /**
   * The id of the registered kind.
   */
  public readonly kind: string;
  /**
   * The user's label, such as `Work`.
   */
  public readonly label: string;
  /**
   * Absolute path of an existing directory the provider tooling will use for this profile, or `null`
   * for a new, empty folder the runtime makes under its data folder, named after the label.
   */
  public readonly profileDir: string | null;

  /**
   * Initializes the parameters.
   * @param kind The id of the registered kind.
   * @param label The user's label, such as `Work`.
   * @param profileDir Absolute path of the directory the provider tooling will use for this
   * profile, or `null` for a new folder named after the label.
   * @throws ArgumentException when `kind` or `label` is blank, or `profileDir` is blank but not
   * `null`.
   */
  public constructor(kind: string, label: string, profileDir: string | null);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `kind`, `label` and the nullable
   * `profileDir`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProviderCreateParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `kind`, `label`, `profileDir`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of the methods that address one provider: `ProviderCheck` and
 * `ProviderDelete`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderIdParams {
  /**
   * The `Provider` id.
   */
  public readonly providerId: string;

  /**
   * Initializes the parameters.
   * @param providerId The `Provider` id.
   * @throws ArgumentException when `providerId` is blank.
   */
  public constructor(providerId: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `providerId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProviderIdParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `providerId`.
   */
  public toJson(): JsonObject;
}

/**
 * The providers whose sign-in runs: the result of `ProviderSignInList` and the
 * payload of `ProviderSignInsChanged`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderSignIns {
  /**
   * The `Provider` ids, in the order their sign-ins started.
   */
  public readonly providerIds: readonly string[];

  /**
   * Initializes the list with its own copy of the ids.
   * @param providerIds The `Provider` ids.
   * @throws ArgumentException when an id is blank.
   */
  public constructor(providerIds: readonly string[]);

  /**
   * Reads the list from untrusted JSON.
   * @param value The untrusted value, expected to carry `providerIds`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The list.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProviderSignIns;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `providerIds`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ProviderSetEnabled`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderEnabledParams {
  /**
   * The `Provider` id.
   */
  public readonly providerId: string;
  /**
   * `true` to enable the provider, `false` to disable it.
   */
  public readonly enabled: boolean;

  /**
   * Initializes the parameters.
   * @param providerId The `Provider` id.
   * @param enabled `true` to enable the provider, `false` to disable it.
   * @throws ArgumentException when `providerId` is blank.
   */
  public constructor(providerId: string, enabled: boolean);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `providerId` and `enabled`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProviderEnabledParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `providerId` and `enabled`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ProviderUpdate`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderUpdateParams {
  /**
   * The `Provider` id.
   */
  public readonly providerId: string;
  /**
   * The user's new label, such as `Work`.
   */
  public readonly label: string;
  /**
   * Absolute path of the directory the provider tooling uses for this profile.
   */
  public readonly profileDir: string;
  /**
   * Whether the provider's own MCP servers reach its sessions, or `null` to leave the switch as it is.
   */
  public readonly ownMcpServers: boolean | null;
  /**
   * Absolute path of the server the person chose, an empty string to choose none, or `null` to leave the choice as it is; the runtime takes
   * a path or an empty string only from the app's main process, TeamRun's window.
   */
  public readonly binaryPath: string | null;

  /**
   * Initializes the parameters.
   * @param providerId The `Provider` id.
   * @param label The user's new label, such as `Work`.
   * @param profileDir Absolute path of the directory the provider tooling uses for this profile.
   * @param ownMcpServers Whether the provider's own MCP servers reach its sessions; `null`, the default, leaves the switch.
   * @param binaryPath Absolute path of the chosen server, an empty string for none; `null`, the default, leaves the choice.
   * @throws ArgumentException when `providerId`, `label`, `profileDir` are blank.
   */
  public constructor(providerId: string, label: string, profileDir: string, ownMcpServers?: boolean | null, binaryPath?: string | null);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `providerId`, `label`, `profileDir`, and optionally the boolean
   * `ownMcpServers` and string `binaryPath`, each `null` when absent.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProviderUpdateParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `providerId`, `label`, `profileDir`, and `ownMcpServers` and `binaryPath` when they aren't `null`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ProviderKindInstall` and `ProviderKindInstallCancel`: the provider to install.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderKindParams {
  /**
   * The id of the registered kind.
   */
  public readonly kind: string;

  /**
   * Initializes the parameters.
   * @throws ArgumentException when `kind` is blank.
   */
  public constructor(kind: string);

  /**
   * Reads the parameters from untrusted JSON carrying `kind`.
   * @throws JsonException when the field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ProviderKindParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   */
  public toJson(): JsonObject;
}

/**
 * Where a provider TeamRun installs stands: its state, the reason it can't be installed or its last install failed, and while it installs, the
 * bytes received of the download's size.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderKindInstallation {
  /**
   * The id of the registered kind.
   */
  public readonly kind: string;
  /**
   * Where its installation stands.
   */
  public readonly state: ProviderKindInstallState;
  /**
   * Why it's `Unavailable`, why its last install failed while `NotInstalled`, or why its last update failed while `Installed`; otherwise `null`.
   */
  public readonly reason: string | null;
  /**
   * The bytes of the download received so far; 0 unless `Installing`.
   */
  public readonly received: number;
  /**
   * The download's size in bytes; 0 until it's known.
   */
  public readonly total: number;
  /**
   * The installed version, while `Installed` or while `Installing` an update; `null` when it isn't installed or its version can't be read.
   */
  public readonly version: string | null;
  /**
   * The newer version an install would bring while `Installed`, which the row offers as an update; `null` when it's up to date, when no newer
   * version is known, or when the installed one is newer than the one TeamRun installs.
   */
  public readonly update: string | null;
  /**
   * Whether a cancel can still stop the install while `Installing`; `false` once a setup that must run to its end has started. `true` otherwise.
   */
  public readonly cancellable: boolean;
  /**
   * The program this computer lacks that installing it needs, such as `unzip` or `tar`, while `Unavailable` for that reason; `null` otherwise,
   * as when no build exists for this computer.
   */
  public readonly missingTool: string | null;
  /**
   * The path of the program a provider of the kind runs while `Installed` by a compatible copy found outside TeamRun's own install, such as one on
   * `PATH` or a path the person chose; `null` otherwise. Such a copy updates on its own, not through TeamRun.
   */
  public readonly foundPath: string | null;

  /**
   * Initializes the installation.
   * @throws ArgumentException when `kind` is blank.
   */
  public constructor(kind: string, state: ProviderKindInstallState, reason?: string | null, received?: number, total?: number, version?: string | null,
    update?: string | null, cancellable?: boolean, missingTool?: string | null, foundPath?: string | null);

  /**
   * Reads the installation from untrusted JSON carrying `kind`, `state`, the nullable `reason`, `received`, `total`, the nullable `version` and
   * `update`, `cancellable`, and the nullable `missingTool` and `foundPath`; a missing one, as from a sender before it, reads as `null`.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ProviderKindInstallation;

  /**
   * Renders the JSON object `fromJson` accepts.
   */
  public toJson(): JsonObject;
}

/**
 * Whether the person has finished or skipped TeamRun's first launch, and when.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class FirstLaunch {
  /**
   * When the person first finished or skipped the first launch, as an ISO 8601 time; `null` until then.
   */
  public readonly finishedAt: string | null;

  /**
   * Initializes the first launch.
   * @throws ArgumentException when `finishedAt` is given blank.
   */
  public constructor(finishedAt: string | null);

  /**
   * Whether the first launch was finished or skipped.
   */
  public get isFinished(): boolean;

  /**
   * Reads the first launch from untrusted JSON carrying the nullable `finishedAt`.
   * @throws JsonException when the field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): FirstLaunch;

  /**
   * Renders the JSON object `fromJson` accepts.
   */
  public toJson(): JsonObject;
}

/**
 * A provider's command-line tool as TeamRun finds it: whether it's found and its version, with the provider's official command that installs it
 * on this platform and the provider's own page for a subscription.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderTool {
  /**
   * The id of the registered kind.
   */
  public readonly kind: string;
  /**
   * Whether TeamRun finds the tool.
   */
  public readonly found: boolean;
  /**
   * The version the tool reports, or `null` when it isn't found or reports none.
   */
  public readonly version: string | null;
  /**
   * The provider's official command that installs the tool on this platform, for a terminal; `null` when the provider names none.
   */
  public readonly installCommand: string | null;
  /**
   * The provider's own page for a subscription, opened in the external browser; `null` when there is none.
   */
  public readonly subscribeUrl: string | null;

  /**
   * Initializes the tool.
   * @throws ArgumentException when `kind` is blank, or `version`, `installCommand` or `subscribeUrl` is given blank.
   */
  public constructor(kind: string, found: boolean, version?: string | null, installCommand?: string | null, subscribeUrl?: string | null);

  /**
   * Reads the tool from untrusted JSON carrying `kind`, `found`, and the nullable `version`, `installCommand` and `subscribeUrl`.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ProviderTool;

  /**
   * Renders the JSON object `fromJson` accepts.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ProviderListModels`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderListModelsParams {
  /**
   * The id of the registered kind.
   */
  public readonly kind: string;
  /**
   * The `Provider` to ask through, or `null` for the provider's default profile.
   */
  public readonly providerId: string | null;
  /**
   * Whether the person asked to refresh the models, so a provider that keeps its list drops it first.
   */
  public readonly refresh: boolean;
  /**
   * The folder a chat runs in, whose project configuration the list follows, or `null` for no folder.
   */
  public readonly workingDirectory: string | null;

  /**
   * Initializes the parameters.
   * @param kind The id of the registered kind.
   * @param providerId The `Provider` to ask through, or `null` for the provider's
   * default profile.
   * @param refresh Whether the person asked to refresh the models; `false` by default.
   * @param workingDirectory The folder a chat runs in; `null` by default.
   * @throws ArgumentException when `kind` is blank, or when `providerId` is present but
   * blank.
   */
  public constructor(kind: string, providerId: string | null, refresh?: boolean, workingDirectory?: string | null);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `kind`, the nullable
   * `providerId` and the optional `refresh` (`false` when absent).
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProviderListModelsParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `kind`, the nullable `providerId` and `refresh`.
   */
  public toJson(): JsonObject;
}

/**
 * The classification of a displayed diff line.
 */
export declare enum DiffLineKind {
  /**
   * Added diff line.
   */
  Added = "Added",
  /**
   * Removed diff line.
   */
  Removed = "Removed",
  /**
   * Context diff line.
   */
  Context = "Context",
  /**
   * Meta diff line.
   */
  Meta = "Meta",
}

/**
 * The reply-history projections, each ordered newest first.
 */
export declare enum ReplyPanel {
  /**
   * Provider actions and reasoning.
   */
  Activity = "Activity",
  /**
   * Files edited by provider replies.
   */
  Changes = "Changes",
  /**
   * Plans in provider replies: a plan-mode plan, a checklist, or both.
   */
  Plan = "Plan",
  /**
   * The sub-agents provider replies started themselves, one level deep: a sub-agent's own sub-agents stay in its steps.
   */
  SubAgents = "SubAgents"
}

/**
 * The panels a teammate's `teamrun_open_panel` and `teamrun_close_panel` tools name; values match the member names. A page or a
 * chat opens and closes as a document; a view shows where it is, or opens in its dock, and closes by hiding the dock that holds it.
 */
export declare enum PanelName {
  /**
   * The Teammates page.
   */
  Teammates = "Teammates",
  /**
   * The Providers page.
   */
  Providers = "Providers",
  /**
   * A chat, which the request names by its `Chat` id.
   */
  Chat = "Chat",
  /**
   * The Projects view, whose tab is Explorer.
   */
  Projects = "Projects",
  /**
   * The Activity view of the chat the window shows.
   */
  Activity = "Activity",
  /**
   * The Changes view of the chat the window shows.
   */
  Changes = "Changes",
  /**
   * The Plan view, whose tab is Plans, of the chat the window shows.
   */
  Plan = "Plan",
  /**
   * The Sub-agents view of the chat the window shows.
   */
  SubAgents = "SubAgents",
  /**
   * The Background tasks view of the chat the window shows.
   */
  BackgroundTasks = "BackgroundTasks",
  /**
   * The chat's own Browser page, a document the Browser module shows, which the chat's agents drive.
   */
  Page = "Page"
}

/**
 * What a window did with a `PanelRequested` request; values match the member names.
 */
export declare enum PanelOutcome {
  /**
   * The page, chat or view opened or closed.
   */
  Done = "Done",
  /**
   * The window kept things as they were for the person, such as a chat they are typing in that a request would close.
   */
  Refused = "Refused",
  /**
   * The window failed to act.
   */
  Failed = "Failed"
}

/**
 * One immutable diff line; text omits its added or removed prefix.
 */
export declare class DiffLine {
  /**
   * The line classification.
   */
  public readonly kind: DiffLineKind;
  /**
   * The line content.
   */
  public readonly text: string;
  /**
   * Creates a diff line.
   * @param kind The classification.
   * @param text The content without the line prefix.
   */
  public constructor(kind: DiffLineKind, text: string);
}

/**
 * One file change with its parsed diff. The caller owns the supplied immutable line array.
 */
export declare class FileEdit {
  /**
   * The recorded file path.
   */
  public readonly path: string;
  /**
   * The recorded change kind.
   */
  public readonly kind: string;
  /**
   * The parsed diff lines.
   */
  public readonly lines: readonly DiffLine[];
  /**
   * The path a move took the file to, or null for any other change.
   */
  public readonly movePath: string | null;
  /**
   * Creates a file change.
   * @param path The recorded path.
   * @param kind The recorded change kind.
   * @param lines Immutable parsed lines retained by this instance.
   * @param movePath The path a move took the file to, or null for any other change.
   */
  public constructor(path: string, kind: string, lines: readonly DiffLine[], movePath?: string | null);
  /**
   * The count of added lines.
   */
  public get additions(): number;
  /**
   * The count of removed lines.
   */
  public get deletions(): number;
  /**
   * Whether any line is content rather than metadata.
   */
  public get hasDiff(): boolean;
}

/**
 * A file row without diff content, suitable for paged history.
 */
export declare class FileChangeSummary {
  /**
   * The nonblank recorded file path.
   */
  public readonly path: string;
  /**
   * The recorded change kind.
   */
  public readonly kind: string;
  /**
   * The number of added lines.
   */
  public readonly additions: number;
  /**
   * The number of removed lines.
   */
  public readonly deletions: number;
  /**
   * Whether full diff content can be expanded.
   */
  public readonly hasDiff: boolean;
  /**
   * Creates a file summary.
   * @param path Nonblank path.
   * @param kind Change kind.
   * @param additions Nonnegative integer count.
   * @param deletions Nonnegative integer count.
   * @param hasDiff Whether diff content exists.
   * @throws ArgumentException When path is blank.
   * @throws ArgumentOutOfRangeException When a count is invalid.
   */
  public constructor(path: string, kind: string, additions: number, deletions: number, hasDiff: boolean);
  /**
   * Summarizes a parsed change without retaining its lines.
   * @param edit The parsed change.
   * @returns The summary.
   */
  public static fromEdit(edit: FileEdit): FileChangeSummary;
  /**
   * Reads a wire value and validates its fields.
   * @param value The untrusted JSON value.
   * @param path Optional diagnostic JSON path.
   * @returns The parsed FileChangeSummary.
   * @throws JsonException When a field has the wrong type or is missing.
   */
  public static fromJson(value: unknown, path?: string): FileChangeSummary;
  /**
   * Serializes this value.
   * @returns A new plain JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * A lightweight reply projection. Preview details contain only first-line titles (at most 512 characters) and tool identity metadata, never output, diffs, or image data. This is not a complete message snapshot.
 */
export declare class ReplySummary {
  /**
   * Message metadata and title-only non-text details.
   */
  public readonly preview: Message;
  /**
   * File rows and counts without diff bodies.
   */
  public readonly files: readonly FileChangeSummary[];
  /**
   * Creates a summary from already projected fields.
   * @param preview The title-only message projection.
   * @param files File summaries, copied on construction.
   */
  public constructor(preview: Message, files: readonly FileChangeSummary[]);
  /**
   * Tests whether this reply has content for a panel. A plan isn't activity, and neither is a cancelled reply's note with one of `Resources.cancelledReplyNotes`;
   * a reply belongs in the Plan panel when `ReplyPlan.ofDetails` finds a plan in it, and in the SubAgents panel when one of its own details is a sub-agent.
   * @param panel The requested panel.
   * @returns Whether the reply belongs in that panel.
   */
  public matches(panel: ReplyPanel): boolean;
  /**
   * Projects one message without retaining its output or diff bodies; a plan or sub-agent detail is kept whole, so the Plan and SubAgents panels show it without another request.
   * A sub-agent's own details are left out of the preview, so they count in no panel but Changes, which counts every file change of the reply.
   * @param message The complete source message.
   * @returns A lightweight summary.
   */
  public static fromMessage(message: Message): ReplySummary;
  /**
   * Reads a wire value and validates its fields.
   * @param value The untrusted JSON value.
   * @param path Optional diagnostic JSON path.
   * @returns The parsed ReplySummary.
   * @throws JsonException When a field has the wrong type or is missing.
   */
  public static fromJson(value: unknown, path?: string): ReplySummary;
  /**
   * Serializes this value.
   * @returns A new plain JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * A page of matching provider reply summaries, newest first; cursors are message sequences.
 */
export declare class ReplyPage {
  /**
   * The summaries in descending sequence order.
   */
  public readonly replies: readonly ReplySummary[];
  /**
   * Whether older matching replies exist.
   */
  public readonly hasEarlier: boolean;
  /**
   * Whether newer matching replies exist.
   */
  public readonly hasLater: boolean;
  /**
   * Whether any reply of the chat ran a command, for a page of the Changes panel; false for the other panels and when the value lacks it.
   */
  public readonly ranCommands: boolean;
  /**
   * Creates a page.
   * @param replies Summaries in descending sequence order, copied on construction.
   * @param hasEarlier Whether older matching replies exist.
   * @param hasLater Whether newer matching replies exist.
   * @param ranCommands Whether any reply of the chat ran a command.
   */
  public constructor(replies: readonly ReplySummary[], hasEarlier: boolean, hasLater: boolean, ranCommands?: boolean);
  /**
   * Reads a wire value and validates its fields.
   * @param value The untrusted JSON value.
   * @param path Optional diagnostic JSON path.
   * @returns The parsed ReplyPage.
   * @throws JsonException When a field has the wrong type or is missing.
   */
  public static fromJson(value: unknown, path?: string): ReplyPage;
  /**
   * Serializes this value.
   * @returns A new plain JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * Finds the image files a reply wrote in its project: the PNG, JPEG, GIF and WebP files its file changes add or update, and the
 * absolute image paths its texts and payloads name, leaving out generated images and their stored copies, and every path a read,
 * search or listing step names: one whose payload is marked read-only or names a reading tool, and a tool result for such a step,
 * linked by its tool use id. Commands that no provider classifies still count, as they may write images. A path counts as in the
 * project folder when it starts with the folder's path, compared without regard to slashes, and to case only when the folder is a
 * Windows path, one with a drive letter or backslashes, and has no `..` segment; Core checks the real path when it reads the file.
 */
export declare class WrittenImageReader {
  /**
   * Lists a reply's written image files.
   * @param message The recorded reply.
   * @param rootPath The chat's project folder.
   * @returns The paths, as the reply records them, in their first-seen order, each file once whatever its slashes, and its case in a
   * Windows folder.
   */
  public pathsOf(message: Message, rootPath: string): readonly string[];
  /**
   * Lists the image files a reply's Markdown draws, which `pathsOf` leaves out: each `![alt](src)` and each reference definition
   * in its details' texts outside code spans, fenced code blocks and indented code blocks, with its backslash escapes removed, whose address
   * `markdownImagePathOf` takes.
   * @param message The recorded reply.
   * @param rootPath The chat's project folder.
   * @returns The paths `markdownImagePathOf` gives, in their first-seen order, each once, so a reader asks for any path a Markdown view's
   * address gives exactly as it is listed.
   */
  public markdownImagePathsOf(message: Message, rootPath: string): readonly string[];
  /**
   * Lists the addresses a reply's Markdown draws images from: each `![alt](src)` and each reference definition in its details' texts
   * outside code spans, fenced code blocks and indented code blocks, with its backslash escapes removed and its ends trimmed, not decoded.
   * @param message The recorded reply.
   * @returns The addresses in their first-seen order, each once, whatever they name: a file, a `data:` URL or a web address.
   */
  public markdownImageSourcesOf(message: Message): readonly string[];
  /**
   * Finds the image file a Markdown image's address names in the project, without reading it.
   * @param source The address as the Markdown wrote it, or percent-encoded, which is decoded once.
   * @param rootPath The chat's project folder.
   * @returns The absolute path, the address itself when it is absolute, or else joined to the project folder with its separator,
   * when it ends in a PNG, JPEG, GIF, WebP or SVG extension and stays inside the project folder; `null` for any address with a
   * scheme, such as `http:`, `data:` or `javascript:`, a network path, a control character, or a `..` that leaves the folder.
   */
  public markdownImagePathOf(source: string, rootPath: string): string | null;
  /**
   * Lists the image files a reply's Markdown links to, such as `[chart](out/chart.png)`: each link and each reference definition in its
   * details' texts outside code spans, fenced code blocks and indented code blocks, with its backslash escapes removed and decoded once, whose target
   * `linkedPathOf` takes and that ends in a PNG, JPEG, GIF, WebP or SVG extension.
   * @param message The recorded reply.
   * @param rootPath The chat's project folder.
   * @returns The paths `linkedPathOf` gives, in their first-seen order, each once, so a reader asks for a linked image exactly as it is listed.
   */
  public markdownLinkImagePathsOf(message: Message, rootPath: string): readonly string[];
  /**
   * Finds the file a Markdown link's target names in the project, without reading it.
   * @param target The target as a Markdown view gives it, already decoded; a line suffix such as `:42`, `:42:7` or `#L42-L50` is left out,
   * and a slash before a drive, as in `/C:/a.txt`, is dropped.
   * @param rootPath The chat's project folder.
   * @returns The absolute path, the target itself when it is absolute, or else joined to the project folder with its separator, when it
   * stays inside the project folder; `null` for an empty target, any target with a scheme, a network path, a control character, or a `..`
   * that leaves the folder.
   */
  public linkedPathOf(target: string, rootPath: string): string | null;
  /**
   * Finds the local file a Markdown link's target names by its absolute path, inside a project or not, without reading it.
   * @param target The target as a Markdown view gives it, already decoded; a line suffix is left out and a slash before a drive is dropped,
   * as `linkedPathOf` does.
   * @returns The absolute path, such as `C:/Users/a/x.png` for `/C:/Users/a/x.png`; `null` for a relative path, any target with a scheme,
   * a network path or a control character.
   */
  public localPathOf(target: string): string | null;
  /**
   * Finds where a generated image was saved in the project.
   * @param detail A detail of the reply.
   * @param rootPath The chat's project folder.
   * @returns The PNG, JPEG, GIF or WebP path the generated image's detail records it was saved to, as recorded, when it is in the
   * project folder as `pathsOf` counts it; otherwise `null`, as for any other detail.
   */
  public generatedPathOf(detail: MessageDetail, rootPath: string): string | null;
  /**
   * Finds TeamRun's own stored copy of a generated image.
   * @param detail A detail of the reply.
   * @returns The PNG, JPEG, GIF or WebP path of the copy Core stored for the generated image's detail, as recorded; otherwise `null`,
   * as for any other detail.
   */
  public storedPathOf(detail: MessageDetail): string | null;
}

/**
 * Interprets recorded file-change lists, as Codex and Grok replies record them, and Claude Edit, MultiEdit, Write, and NotebookEdit
 * payloads consistently for full diffs and summaries. A NotebookEdit changes the notebook its `notebook_path` names, and its cell's
 * new source counts as the added lines, except when it deletes the cell. A change's kind is a plain kind, or Codex's `{ type, move_path }` object or its JSON
 * text, read as `add`, `delete`, `update`, or `move` for an update with a `move_path`; an unreadable kind is `update`. Codex sends a
 * new or deleted file's content where a unified diff would be, so in a list with neither ACP's `tool` nor TeamRun's working-tree
 * `source` beside it, that content counts as the file's added or removed lines, whatever its lines look like; every other list's
 * changes are read as diffs.
 */
export declare class FileChangeReader {
  /**
   * Parses and merges changes by file path within one reply.
   * @param message The recorded message.
   * @returns Parsed file changes in their first-seen order; unsupported payloads are ignored.
   */
  public editsOf(message: Message): readonly FileEdit[];
  /**
   * Parses and merges changes by file path within some of a reply's details.
   * @param details The recorded details, in order.
   * @returns Parsed file changes in their first-seen order; unsupported payloads are ignored.
   */
  public editsIn(details: readonly MessageDetail[]): readonly FileEdit[];
}

/**
 * A new file's base64 bytes, or a reference to a previously saved attachment after rewind.
 * Exactly one of data and path is non-null. The runtime validates saved paths against its attachment store.
 */
export declare class AttachmentInput {
  /**
   * Original display filename; never used as a storage path.
   */
  public readonly name: string;
  /**
   * MIME type supplied by the client.
   */
  public readonly mediaType: string;
  /**
   * Canonical base64 bytes, or null when reusing a saved path. An empty string represents an empty file.
   */
  public readonly data: string | null;
  /**
   * Existing attachment-store path, or null for a new upload.
   */
  public readonly path: string | null;
  /**
   * The grant Noldova Desktop issued for a file the person chose, which the runtime part redeems to copy the file; null for bytes or a saved path.
   */
  public readonly grant: string | null;
  /**
   * Initializes an attachment source.
   * @param name Nonblank display filename.
   * @param mediaType Nonblank MIME type.
   * @param data Base64 bytes, or null for a saved file or a granted one.
   * @param path Nonblank saved path, or null for new bytes or a granted file.
   * @param grant Nonblank file grant, or null (the default) for new bytes or a saved file.
   * @throws ArgumentException when names are blank or not exactly one source is supplied.
   */
  public constructor(name: string, mediaType: string, data: string | null, path: string | null, grant?: string | null);
  /**
   * Decodes untrusted attachment input.
   * @param value Object containing name, mediaType, nullable data, nullable path and an optional nullable grant.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns Validated input; byte encoding, limits and filesystem access are checked by the runtime.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid source invariants.
   */
  public static fromJson(value: unknown, path?: string): AttachmentInput;
  /**
   * Encodes this input for a send request.
   * @returns The name, mediaType, data and path wire fields, and the grant when there is one.
   */
  public toJson(): JsonObject;
}

/**
 * Metadata for a durable file copied into TeamRun storage. History pages contain no file bytes.
 */
export declare class MessageAttachment {
  /**
   * Original display filename.
   */
  public readonly name: string;
  /**
   * MIME type of the file.
   */
  public readonly mediaType: string;
  /**
   * File size in bytes, a non-negative safe integer.
   */
  public readonly size: number;
  /**
   * Absolute local path to the saved copy.
   */
  public readonly path: string;
  /**
   * An image's width in pixels as it displays, read from its header when it was saved, or `null` when unknown,
   * as for any file that isn't an image, an image whose header couldn't be read, and records saved before sizes were stored.
   */
  public readonly width: number | null;
  /**
   * An image's height in pixels as it displays, or `null` exactly when `width` is.
   */
  public readonly height: number | null;
  /**
   * Initializes durable file metadata.
   * @param name Nonblank original filename.
   * @param mediaType Nonblank MIME type.
   * @param size Non-negative safe integer byte size.
   * @param path Nonblank saved file path.
   * @param width Positive safe integer width in pixels, or `null`, the default.
   * @param height Positive safe integer height in pixels, or `null`, the default; `null` exactly when `width` is.
   * @throws ArgumentException when a string is blank, or when only one of width and height is given or either isn't a positive safe integer.
   * @throws ArgumentOutOfRangeException when size is invalid.
   */
  public constructor(name: string, mediaType: string, size: number, path: string, width?: number | null, height?: number | null);
  /**
   * Whether this is a PNG, JPEG, GIF or WebP image accepted as native provider input.
   */
  public get isImage(): boolean;
  /**
   * Decodes stored metadata.
   * @param value Object containing name, mediaType, size and path, and optionally width and height, which older records lack.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns Validated metadata; does not access the filesystem.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException or ArgumentOutOfRangeException for invalid metadata.
   */
  public static fromJson(value: unknown, path?: string): MessageAttachment;
  /**
   * Encodes metadata without file bytes.
   * @returns The name, mediaType, size, path, width and height wire fields.
   */
  public toJson(): JsonObject;
}

/**
 * The bytes of one of a chat's saved attachments, as AttachmentRead returns them.
 */
export declare class AttachmentContent {
  /**
   * The file's name as attached.
   */
  public readonly name: string;
  /**
   * The file's media type.
   */
  public readonly mediaType: string;
  /**
   * The file's size in bytes.
   */
  public readonly size: number;
  /**
   * The file's bytes, base64 encoded.
   */
  public readonly data: string;
  /**
   * Initializes the content.
   * @param name Nonblank file name.
   * @param mediaType Nonblank media type.
   * @param size Nonnegative safe integer byte size.
   * @param data Base64 bytes; empty for an empty file.
   * @throws ArgumentException when the name or media type is blank.
   * @throws ArgumentOutOfRangeException when the size is not a nonnegative safe integer.
   */
  public constructor(name: string, mediaType: string, size: number, data: string);
  /**
   * Decodes the content.
   * @param value Object with name, mediaType, size and data.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The content.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException or ArgumentOutOfRangeException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): AttachmentContent;
  /**
   * Encodes the content.
   * @returns The name, mediaType, size and data wire fields.
   */
  public toJson(): JsonObject;
}

/**
 * The grant of an attachment AttachmentShare shared with a window's page, which the window part turns into the file's address with
 * Noldova Desktop's `fileAddressOf`.
 */
export declare class AttachmentShare {
  /**
   * The share's grant, as Noldova Desktop drew it.
   */
  public readonly grant: string;
  /**
   * Initializes the share.
   * @param grant Nonblank grant.
   * @throws ArgumentException when the grant is blank.
   */
  public constructor(grant: string);
  /**
   * Decodes the share.
   * @param value Object with grant.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The share.
   * @throws JsonException for a missing or incorrectly typed grant.
   * @throws ArgumentException for a blank grant.
   */
  public static fromJson(value: unknown, path?: string): AttachmentShare;
  /**
   * Encodes the share.
   * @returns The grant wire field.
   */
  public toJson(): JsonObject;
}

/**
 * Where TeamRun keeps its data on this computer: its folder in the data directory, which the window and the command-line
 * client share, and its database there.
 */
export declare class DataFolder {
  /**
   * The absolute path of TeamRun's folder.
   */
  public readonly path: string;
  /**
   * The absolute path of TeamRun's database file in that folder.
   */
  public readonly databaseFile: string;
  /**
   * Initializes the data folder.
   * @param path Nonblank folder path.
   * @param databaseFile Nonblank database file path.
   * @throws ArgumentException when a path is blank.
   */
  public constructor(path: string, databaseFile: string);
  /**
   * Decodes a data folder.
   * @param value Object with path and databaseFile.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The data folder; does not access the filesystem.
   * @throws JsonException for missing, blank or incorrectly typed fields.
   */
  public static fromJson(value: unknown, path?: string): DataFolder;
  /**
   * Encodes the data folder.
   * @returns The path and databaseFile wire fields.
   */
  public toJson(): JsonObject;
}

/**
 * A chat's unsent draft as TeamRun's runtime part keeps it: its text and its files, each a copy the draft holds or a
 * message's saved attachment, by path, without bytes.
 */
export declare class Draft {
  /**
   * The chat's id.
   */
  public readonly chatId: string;
  /**
   * The text, which may be empty.
   */
  public readonly text: string;
  /**
   * The files that are still on disk, in their order; each path can be sent again as an `AttachmentInput`'s path.
   */
  public readonly attachments: readonly MessageAttachment[];
  /**
   * The names of the draft's files that are no longer on disk, which the draft left out.
   */
  public readonly missing: readonly string[];
  /**
   * The draft's revision, which each save raises by one from 1 and which never repeats for a chat, even after a discard.
   */
  public readonly revision: number;
  /**
   * When it was last saved, as an ISO 8601 timestamp.
   */
  public readonly updatedAt: string;
  /**
   * Initializes a draft.
   * @param chatId Nonblank chat id.
   * @param text The text.
   * @param attachments The files on disk.
   * @param missing The nonblank names of the files that are gone.
   * @param revision Positive safe integer revision.
   * @param updatedAt Nonblank timestamp.
   * @throws ArgumentException when a string is blank or the revision is not a positive safe integer.
   */
  public constructor(
    chatId: string, text: string, attachments: readonly MessageAttachment[], missing: readonly string[], revision: number, updatedAt: string);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;
  /**
   * Decodes a draft.
   * @param value Object with conversationId, text, attachments, missing, revision and updatedAt.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The draft; does not access the filesystem.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid values.
   */
  public static fromJson(value: unknown, path?: string): Draft;
  /**
   * Encodes the draft.
   * @returns The wire fields, without file bytes.
   */
  public toJson(): JsonObject;
}

/**
 * One provider-discovered model; null capabilities are unknown, empty effort levels mean no choices.
 * Every effort level, default and name comes from the provider's own answer; TeamRun keeps no list
 * of its own.
 */
export declare class ProviderModel {
  /** The selectable provider model id. */
  public readonly id: string;
  /** Provider display label. */
  public readonly displayName: string;
  /** Provider description. */
  public readonly description: string;
  /** Reported effort choices; null when not advertised. */
  public readonly effortLevels: readonly string[] | null;
  /** Whether this row represents the provider default. */
  public readonly isDefault: boolean;
  /** Canonical model id when the provider resolves an alias. */
  public readonly resolvedModel: string | null;
  /** Image-input capability, or null when not reported. */
  public readonly supportsImages: boolean | null;
  /**
   * The effort level the provider's own list marks as the model's default, one of `effortLevels`, which the picker tags Recommended;
   * null when it names none. A turn with no effort chosen runs it unless `configuredEffort` names another.
   */
  public readonly defaultEffort: string | null;
  /** The provider's own names for some of `effortLevels` and for `configuredEffort`, by level, such as `Extra` for `xhigh`; empty when it names none. */
  public readonly effortNames: Readonly<Record<string, string>>;
  /** The speeds the provider offers for the model besides its standard one, such as fast mode; empty when it reports none. */
  public readonly speeds: readonly ProviderSpeed[];
  /** The id of the speed the provider uses when none is sent, one of `speeds`; null when that is its standard speed. */
  public readonly defaultSpeed: string | null;
  /** The context windows a teammate can choose for the model, from its presets to any size within its bounds; null when it offers no choice. */
  public readonly contextWindows: ProviderContextWindows | null;
  /**
   * Why the model can't be chosen, in the provider's words, such as the version it needs, or null when it can; the picker shows such a model,
   * not chosen, with its reason. Only a provider that reports one sets it, and the wire leaves it out when null.
   */
  public readonly unavailableReason: string | null;
  /**
   * The effort the provider's own configuration sets, which a turn with no effort chosen runs instead of `defaultEffort`, and which the
   * picker shows as selected then; it can be a level the model doesn't list, which the provider runs as it is. Null when the configuration
   * sets none, and the wire leaves it out then.
   */
  public readonly configuredEffort: string | null;
  /**
   * Creates metadata and retains a copy of effort choices, names and speeds.
   * @throws ArgumentException when the id, the display name, a level, a name, the unavailable reason or the configured effort is blank, when the
   * default isn't one of the effort levels, when a named level is neither one of them nor the configured effort, when two speeds share an id, or when the
   * default speed isn't one of the speeds.
   */
  public constructor(id: string, displayName: string, description: string, effortLevels: readonly string[] | null,
    isDefault: boolean, resolvedModel: string | null, supportsImages: boolean | null, defaultEffort?: string | null,
    effortNames?: Readonly<Record<string, string>>, speeds?: readonly ProviderSpeed[], defaultSpeed?: string | null,
    contextWindows?: ProviderContextWindows | null, unavailableReason?: string | null, configuredEffort?: string | null);
  /** Reads validated wire metadata. */
  public static fromJson(value: unknown, path?: string): ProviderModel;
  /** Matches a selected id, resolved alias, or null for the provider default. */
  public matches(id: string | null): boolean;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/**
 * What a provider reports of one of its own MCP servers without connecting to it, so reading it starts nothing of the person's.
 */
export declare enum OwnMcpServerState {
  /**
   * The provider's configuration names it and says nothing more without connecting.
   */
  Configured = "Configured",
  /**
   * The provider's configuration names it and has it on.
   */
  Enabled = "Enabled",
  /**
   * The provider's configuration names it and has it off.
   */
  Disabled = "Disabled",
  /**
   * The provider has it, and it waits for the person to sign in to it.
   */
  NeedsSignIn = "NeedsSignIn"
}

/**
 * One of a provider's own MCP servers, by name and state only: never a command, an address, a variable or a header.
 */
export declare class OwnMcpServer {
  /** The server's name in the provider's configuration. */
  public readonly name: string;
  /** What the provider reports of it without connecting. */
  public readonly state: OwnMcpServerState;

  /**
   * Initializes the server.
   * @param name The server's name.
   * @param state What the provider reports of it.
   * @throws ArgumentException when the name is blank.
   */
  public constructor(name: string, state: OwnMcpServerState);

  /**
   * Reads the server from untrusted JSON.
   * @param value The untrusted value, expected to carry `name` and `state`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The server.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): OwnMcpServer;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `name` and `state`.
   */
  public toJson(): JsonObject;
}

/**
 * A provider's own MCP servers, by name and state only.
 */
export declare class ProviderMcpServerList {
  /** The `Provider` id. */
  public readonly providerId: string;
  /** The servers, in the provider's configuration's order; `null` when the provider offers no list of them. */
  public readonly servers: readonly OwnMcpServer[] | null;

  /**
   * Initializes the list.
   * @param providerId The `Provider` id.
   * @param servers The servers, or `null` when the provider offers no list of them.
   * @throws ArgumentException when the id is blank.
   */
  public constructor(providerId: string, servers: readonly OwnMcpServer[] | null);

  /**
   * Reads the list from untrusted JSON.
   * @param value The untrusted value, expected to carry `providerId` and `servers`, an array of servers or `null`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The list.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): ProviderMcpServerList;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `providerId` and `servers`.
   */
  public toJson(): JsonObject;
}

/**
 * The context windows a provider lets a teammate choose for a model: its preset sizes, and the bounds any chosen size keeps to, in tokens.
 * Claude takes 100K up to the window the SDK reports for the model, or up to 1M until a reply reports one.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderContextWindows {
  /** The preset sizes offered by name, such as 200K, each within the bounds. */
  public readonly presets: readonly number[];
  /** The smallest size a teammate can choose. */
  public readonly minimum: number;
  /** The largest size a teammate can choose. */
  public readonly maximum: number;
  /** Whether the model reported its own window, so `maximum` names it; until it has, `maximum` is the provider's ceiling. */
  public readonly reported: boolean;

  /**
   * Initializes a model's context windows.
   * @param presets The preset sizes, in tokens.
   * @param minimum The smallest size, in tokens.
   * @param maximum The largest size, in tokens.
   * @param reported Whether the model reported its own window.
   * @throws ArgumentException when a size isn't a positive whole number, the maximum is below the minimum, or a preset repeats or lies outside them.
   */
  public constructor(presets: readonly number[], minimum: number, maximum: number, reported: boolean);

  /**
   * Reads a model's context windows from untrusted JSON.
   * @param value Object with `presets`, `minimum`, `maximum` and `reported`.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The context windows.
   * @throws JsonException for missing or incorrectly typed fields; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ProviderContextWindows;

  /**
   * Whether a value is a size a context window can have: a positive whole number of tokens.
   * @param tokens The value.
   * @returns Whether it is a size.
   */
  public static isSize(tokens: number): boolean;

  /**
   * Names a size the way the presets are named: whole millions as `1M`, anything else in thousands to a tenth, as `200K` or `150.5K`.
   * @param tokens The size in tokens.
   * @returns The name.
   */
  public static nameOf(tokens: number): string;

  /**
   * Reads a size a person typed, in tokens or with `K` or `M` after it, such as `150000`, `300K` or `1.5M`, rounded to whole tokens.
   * @param text The typed size; spaces around it are ignored.
   * @returns The size in tokens, or `null` when the text isn't a size or comes to no whole token.
   */
  public static parse(text: string): number | null;

  /**
   * Whether a teammate can choose a size: a size within the bounds.
   * @param tokens The size in tokens.
   * @returns Whether it is allowed.
   */
  public allows(tokens: number): boolean;

  /**
   * Encodes the context windows.
   * @returns The object with `presets`, `minimum`, `maximum` and `reported`.
   */
  public toJson(): JsonObject;
}

/**
 * A speed a provider offers for a model besides its standard one, such as Claude's fast mode or a
 * Codex service tier: the provider's id, sent with a turn to ask for it, and the name and
 * description the provider gives it, when it gives them. TeamRun keeps no list of speeds of its own.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderSpeed {
  /** The provider's id for the speed, such as `priority`. */
  public readonly id: string;
  /** The provider's name for it, such as `Fast`; null when it names none. */
  public readonly name: string | null;
  /** The provider's description of it; null when it gives none. */
  public readonly description: string | null;

  /**
   * Initializes a provider speed.
   * @param id The provider's id for the speed.
   * @param name The provider's name for it; `null` by default.
   * @param description The provider's description of it; `null` by default.
   * @throws ArgumentException when the id is blank, or the name or description is blank rather than null.
   */
  public constructor(id: string, name?: string | null, description?: string | null);

  /**
   * Reads a provider speed from untrusted JSON.
   * @param value Object with `id` and the nullable `name` and `description`.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The speed.
   * @throws JsonException for missing or incorrectly typed fields; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ProviderSpeed;

  /**
   * Encodes the speed.
   * @returns The object with `id` and the nullable `name` and `description`.
   */
  public toJson(): JsonObject;
}

/**
 * A permission mode a provider offers, such as Claude's `acceptEdits` or a Codex sandbox and
 * approval pair: the id TeamRun sends with a turn to run the provider in it, the provider's name
 * for it, whether it lifts the provider's restrictions, and whether it only reads.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderMode {
  /** The id TeamRun sends for the mode, such as `acceptEdits`. */
  public readonly id: string;
  /** The provider's name for it, such as `Accept edits`. */
  public readonly name: string;
  /** The provider's description of it; null when it gives none. */
  public readonly description: string | null;
  /** Whether the mode runs without the provider's restrictions or approvals, such as Claude's `bypassPermissions`. */
  public readonly unrestricted: boolean;
  /** Whether the mode only reads and plans, changing nothing, such as Claude's `plan` or Codex's `read-only`; TeamRun's own tools that change anything are refused in it. */
  public readonly readOnly: boolean;

  /**
   * Initializes a provider mode.
   * @param id The id TeamRun sends for the mode.
   * @param name The provider's name for it.
   * @param description The provider's description of it; `null` by default.
   * @param unrestricted Whether the mode lifts the provider's restrictions; `false` by default.
   * @param readOnly Whether the mode only reads and plans; `false` by default.
   * @throws ArgumentException when the id or name is blank, or the description is blank rather than null.
   */
  public constructor(id: string, name: string, description?: string | null, unrestricted?: boolean, readOnly?: boolean);

  /**
   * Reads a provider mode from untrusted JSON.
   * @param value Object with `id`, `name`, the nullable `description`, `unrestricted` and `readOnly`.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The mode.
   * @throws JsonException for missing or incorrectly typed fields; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ProviderMode;

  /**
   * Encodes the mode.
   * @returns The object with `id`, `name`, the nullable `description`, `unrestricted` and `readOnly`.
   */
  public toJson(): JsonObject;
}

/** A provider's discovered models, with the sign-in state its same answer carries. */
export declare class ProviderModelList {
  /** The selectable models, in the provider's order. */
  public readonly models: readonly ProviderModel[];
  /** Whether the provider's answer says it is signed in; null when the answer doesn't tell. */
  public readonly signedIn: boolean | null;
  /** Whether a provider that lists its models answered signed in with none, so the listing reads as failed rather than as a provider that doesn't list. */
  public readonly empty: boolean;
  /** The name of the plan that limits the models to the provider's default, such as `Copilot Free`; null when no plan limits them. */
  public readonly planName: string | null;
  /** Whether the provider names its models only in a turn's session and the provider has had no such turn yet, so none are listed yet. */
  public readonly awaitsTurn: boolean;
  /** The permission modes the provider offers, in the provider's order; empty when it names none. */
  public readonly modes: readonly ProviderMode[];
  /** The id of the mode TeamRun runs the provider with when a teammate chooses none; null when the provider names no modes. */
  public readonly defaultMode: string | null;
  /**
   * Whether the provider's default model, run with no model chosen, takes any effort level a listed model offers, as Copilot's Auto does:
   * it keeps the chosen level and applies it to the model it picks when that model offers it. False for a provider that marks a default model or doesn't say.
   */
  public readonly defaultTakesListedEfforts: boolean;
  /** The id of the mode a plan-first turn starts in, one of `modes`; null when the provider has no plan mode. */
  public readonly planMode: string | null;
  /** Whether a read behind the list failed, so it isn't a reason to clear what was chosen from a full one. */
  public readonly partial: boolean;

  /**
   * @param models The selectable models.
   * @param signedIn Whether the provider is signed in, or null when its answer doesn't tell.
   * @param empty Whether the provider's list came back empty although it lists its models; defaults to false.
   * @param planName The plan that limits the models to the provider's default, or null; defaults to null.
   * @param awaitsTurn Whether the models are listed only after the provider's first turn, which hasn't run yet; defaults to false.
   * @param modes The permission modes the provider offers; empty by default.
   * @param defaultMode The id of the mode TeamRun runs the provider with by default, or null; defaults to null.
   * @param defaultTakesListedEfforts Whether the provider's default model takes any level a listed model offers; defaults to false.
   * @param planMode The id of the mode a plan-first turn starts in, or null; defaults to null.
   * @param partial Whether a read behind the list failed; defaults to false.
   * @throws ArgumentException when two modes share an id, or the default or plan mode isn't one of the modes.
   */
  public constructor(models: readonly ProviderModel[], signedIn: boolean | null, empty?: boolean, planName?: string | null, awaitsTurn?: boolean,
    modes?: readonly ProviderMode[], defaultMode?: string | null, defaultTakesListedEfforts?: boolean, planMode?: string | null, partial?: boolean);

  /**
   * Decodes the list.
   * @param value Object with `models`, the nullable `signedIn`, and the optional `empty`, `planName`, `awaitsTurn`, `modes`, `defaultMode`,
   * `defaultTakesListedEfforts` and `planMode`, which default to false, null, false, none, null, false and null.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns The list.
   * @throws JsonException for missing or incorrectly typed fields; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ProviderModelList;

  /**
   * Encodes the list.
   * @returns The object with `models`, the nullable `signedIn`, `empty`, the nullable `planName`, `awaitsTurn`, `modes`, the nullable `defaultMode` and
   * `defaultTakesListedEfforts`, and `planMode` only when named.
   */
  public toJson(): JsonObject;

  /**
   * Returns the list naming another plan mode.
   * @param planMode The id of the mode a plan-first turn starts in, or null.
   * @returns The list.
   * @throws ArgumentException when the plan mode isn't one of the modes.
   */
  public withPlanMode(planMode: string | null): ProviderModelList;
}

/** A durable named participant bound to a provider. */
export declare class Teammate {
  /** id. */
  public readonly id: string;
  /** The name at this record's creation or update. */
  public readonly name: string;
  /** Optional Markdown role instructions. */
  public readonly role: string | null;
  /** The bound provider id; a deleted provider makes the teammate unavailable. */
  public readonly providerId: string;
  /** The provider-owned harness for this stage. */
  public readonly harness: Harness;
  /** model. */
  public readonly model: string | null;
  /** effort. */
  public readonly effort: string | null;
  /** The id of the chosen speed, one of the model's `ProviderModel.speeds`, or `null` for the provider's default. */
  public readonly speed: string | null;
  /** The id of the chosen permission mode, one of the provider's `ProviderModelList.modes`, or `null` for TeamRun's default. */
  public readonly mode: string | null;
  /** The chosen context window in tokens, within the model's `ProviderModel.contextWindows`, or `null` for the provider's own window. */
  public readonly contextWindow: number | null;
  /** The teammates this one hands off to, in order, when its usage runs out as a turn starts; empty for Off. Each is named once, never itself. */
  public readonly usageHandOffs: readonly string[];
  /** Whether Sustain moves the teammate's turns to its next fallback entry with usage left when its account reaches a usage limit; false by default. */
  public readonly sustain: boolean;
  /** The ordered entries after the teammate's own account, model and effort, which is always Sustain's first entry; empty by default. */
  public readonly fallbacks: readonly TeammateFallback[];
  /** Whether, after the teammate's own entry, the entry whose usage resets soonest goes first rather than the list's order; true by default. */
  public readonly resetsSoonestFirst: boolean;
  /** created At. */
  public readonly createdAt: string;
  /** updated At. */
  public readonly updatedAt: string;
  /** Creates a validated immutable value. */
  public constructor(
    id: string,
    name: string,
    role: string | null,
    providerId: string,
    harness: Harness,
    model: string | null,
    effort: string | null,
    createdAt: string,
    updatedAt: string,
    speed?: string | null,
    mode?: string | null,
    contextWindow?: number | null,
    usageHandOffs?: readonly string[],
    sustain?: boolean,
    fallbacks?: readonly TeammateFallback[],
    resetsSoonestFirst?: boolean);
  /** Reads a wire value and reports malformed fields at their JSON path; a value without `sustain`, `fallbacks` or `resetsSoonestFirst` takes its default. */
  public static fromJson(value: unknown, path?: string): Teammate;
  /**
   * The wire fields of Sustain's settings, each only when it differs from its default: `sustain` when true, `fallbacks` when not empty and
   * `resetsSoonestFirst` when false.
   */
  public static sustainJson(sustain: boolean, fallbacks: readonly TeammateFallback[], resetsSoonestFirst: boolean): JsonObject;
  /** Returns the wire representation, with Sustain's fields as `sustainJson` gives them. */
  public toJson(): JsonObject;
}

/** One of a teammate's Sustain fallback entries: an account, by its provider id, with a model and an effort. */
export declare class TeammateFallback {
  /** The provider id of the account the entry runs on. */
  public readonly providerId: string;
  /** The model, or `null` for the provider's default. */
  public readonly model: string | null;
  /** The effort, or `null` for the provider's default. */
  public readonly effort: string | null;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when the provider id is blank, or the model or effort is blank rather than null.
   */
  public constructor(providerId: string, model?: string | null, effort?: string | null);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): TeammateFallback;
  /** Reads the `fallbacks` array of `reader`'s object, each entry reported at its own path. */
  public static readList(reader: JsonReader): readonly TeammateFallback[];
  /** Whether `other` names the same account, model and effort. */
  public equals(other: TeammateFallback): boolean;
  /** Returns the wire representation, with `providerId`, the nullable `model` and the nullable `effort`. */
  public toJson(): JsonObject;
}

/** Parameters for teammate create. */
export declare class TeammateCreateParams {
  /** The name at this record's creation or update. */
  public readonly name: string;
  /** Optional Markdown role instructions. */
  public readonly role: string | null;
  /** The bound provider id; a deleted provider makes the teammate unavailable. */
  public readonly providerId: string;
  /** The provider-owned harness for this stage. */
  public readonly harness: Harness;
  /** model. */
  public readonly model: string | null;
  /** effort. */
  public readonly effort: string | null;
  /** The id of the chosen speed, one of the model's `ProviderModel.speeds`, or `null` for the provider's default. */
  public readonly speed: string | null;
  /** The id of the chosen permission mode, one of the provider's `ProviderModelList.modes`, or `null` for TeamRun's default. */
  public readonly mode: string | null;
  /** The chosen context window in tokens, within the model's `ProviderModel.contextWindows`, or `null` for the provider's own window. */
  public readonly contextWindow: number | null;
  /** The teammates this one hands off to, in order, when its usage runs out as a turn starts; empty for Off. Each is named once, never itself. */
  public readonly usageHandOffs: readonly string[];
  /** Whether Sustain moves the teammate's turns to its next fallback entry with usage left when its account reaches a usage limit; false by default. */
  public readonly sustain: boolean;
  /** The ordered entries after the teammate's own account, model and effort, which is always Sustain's first entry; empty by default. */
  public readonly fallbacks: readonly TeammateFallback[];
  /** Whether, after the teammate's own entry, the entry whose usage resets soonest goes first rather than the list's order; true by default. */
  public readonly resetsSoonestFirst: boolean;
  /** Creates a validated immutable value. */
  public constructor(
    name: string,
    role: string | null,
    providerId: string,
    harness: Harness,
    model: string | null,
    effort: string | null,
    speed?: string | null,
    mode?: string | null,
    contextWindow?: number | null,
    usageHandOffs?: readonly string[],
    sustain?: boolean,
    fallbacks?: readonly TeammateFallback[],
    resetsSoonestFirst?: boolean);
  /** Reads a wire value and reports malformed fields at their JSON path; a value without `sustain`, `fallbacks` or `resetsSoonestFirst` takes its default. */
  public static fromJson(value: unknown, path?: string): TeammateCreateParams;
  /** Returns the wire representation, with Sustain's fields as `Teammate.sustainJson` gives them. */
  public toJson(): JsonObject;
}

/**
 * Parameters for teammate update: a patch. Each field is `undefined` when the update leaves it as it is, and only the fields it names change,
 * so two writers that change different fields of one teammate keep both changes; two that change the same field keep the later one.
 * An older client's full update names every field, and still replaces them all.
 * An update must change at least one field, and its wire value may hold no field but these; one that sets the model, effort, speed, mode or
 * context window names either a new provider or `expectedProviderId`, so a change chosen under one provider never lands on another.
 */
export declare class TeammateUpdateParams {
  /** teammate Id. */
  public readonly teammateId: string;
  /** The new name, or `undefined` to keep it. */
  public readonly name: string | undefined;
  /** The new Markdown role instructions, `null` to clear them, or `undefined` to keep them. */
  public readonly role: string | null | undefined;
  /** The new bound provider id, or `undefined` to keep it. */
  public readonly providerId: string | undefined;
  /** The new provider-owned harness, or `undefined` to keep it. */
  public readonly harness: Harness | undefined;
  /** The new model, `null` for the provider's default, or `undefined` to keep it. */
  public readonly model: string | null | undefined;
  /** The new effort, `null` for the provider's default, or `undefined` to keep it. */
  public readonly effort: string | null | undefined;
  /** The id of the chosen speed, one of the model's `ProviderModel.speeds`, `null` for the provider's default, or `undefined` to keep it. */
  public readonly speed: string | null | undefined;
  /** The id of the chosen permission mode, one of the provider's `ProviderModelList.modes`, `null` for TeamRun's default, or `undefined` to keep it. */
  public readonly mode: string | null | undefined;
  /** The provider the sender read the teammate on, which Core requires to still be the teammate's, or `undefined` for no such check. */
  public readonly expectedProviderId: string | undefined;
  /** The chosen context window in tokens, within the model's `ProviderModel.contextWindows`, `null` for the provider's own, or `undefined` to keep it. */
  public readonly contextWindow: number | null | undefined;
  /** The new ordered usage hand-offs, empty for Off, or `undefined` to keep them. */
  public readonly usageHandOffs: readonly string[] | undefined;
  /** Whether Sustain is on, or `undefined` to keep it. */
  public readonly sustain: boolean | undefined;
  /** The new ordered fallback entries after the teammate's own, which replace the old list whole, or `undefined` to keep them. */
  public readonly fallbacks: readonly TeammateFallback[] | undefined;
  /** Whether the entry whose usage resets soonest goes first after the teammate's own, or `undefined` to keep it. */
  public readonly resetsSoonestFirst: boolean | undefined;
  /**
   * Creates a validated immutable value; `undefined` leaves a field out.
   * @throws ArgumentException When it changes no field, sets the model, effort, speed, mode or context window with neither `providerId` nor
   * `expectedProviderId`, or chooses a context window that isn't a positive whole number.
   */
  public constructor(
    teammateId: string,
    name: string | undefined,
    role: string | null | undefined,
    providerId: string | undefined,
    harness: Harness | undefined,
    model: string | null | undefined,
    effort: string | null | undefined,
    speed?: string | null,
    mode?: string | null,
    expectedProviderId?: string,
    contextWindow?: number | null,
    usageHandOffs?: readonly string[],
    sustain?: boolean,
    fallbacks?: readonly TeammateFallback[],
    resetsSoonestFirst?: boolean);
  /** An update that changes only the fields `changes` names, read on `expectedProviderId` when given. */
  public static of(teammateId: string, changes: ITeammateChanges, expectedProviderId?: string): TeammateUpdateParams;
  /**
   * An update that changes only the fields of `wanted` whose value differs from `teammate`'s own, `fallbacks` compared entry by entry, read on `readProviderId` when it sets the
   * model, effort, speed, mode or context window, or `null` when nothing differs, so a sender skips it; `readProviderId` is the provider whose values the
   * sender showed, `teammate`'s own by default.
   */
  public static changing(teammate: Teammate, wanted: ITeammateChanges, readProviderId?: string): TeammateUpdateParams | null;
  /** Reads a wire value, a field it lacks left out, refuses a field it doesn't have, and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): TeammateUpdateParams;
  /** Returns `teammate` with each field the update names changed, every other field kept, and `updatedAt` as its update time. */
  public applyTo(teammate: Teammate, updatedAt: string): Teammate;
  /** Returns the wire representation, with only the fields the update names. */
  public toJson(): JsonObject;
}

/** Parameters for teammate id. */
export declare class TeammateIdParams {
  /** teammate Id. */
  public readonly teammateId: string;
  /** Creates a validated immutable value. */
  public constructor(
    teammateId: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): TeammateIdParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** A department of the organization: it has a name, an optional leader, and sits under the person, a teammate or another department. */
export declare class Department {
  /** id. */
  public readonly id: string;
  /** The name, 1 to 100 characters on one line. */
  public readonly name: string;
  /** What it sits under. */
  public readonly parent: OrganizationParent;
  /** The teammate who leads it, always one of its members, or null. */
  public readonly leaderId: string | null;
  /** Its place among its siblings, from 0. */
  public readonly order: number;
  /** When it was created, as ISO 8601 text. */
  public readonly createdAt: string;
  /** When it last changed, as ISO 8601 text. */
  public readonly updatedAt: string;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when a field is blank, the name is invalid, the department is its own parent, or the order isn't a whole number from 0.
   */
  public constructor(
    id: string,
    name: string,
    parent: OrganizationParent,
    leaderId: string | null,
    order: number,
    createdAt: string,
    updatedAt: string);
  /**
   * Checks a department name.
   * @param name The name.
   * @throws ArgumentException when it is blank, longer than 100 characters, or holds a line break or other control character.
   */
  public static validateName(name: string): void;
  /**
   * Reads a department name from its `name` field.
   * @param reader The reader of the object holding it.
   * @returns The name.
   * @throws JsonException at the field's path when it isn't a valid name.
   */
  public static readName(reader: JsonReader): string;
  /**
   * Checks a department's order among its siblings.
   * @param order The order.
   * @throws ArgumentException when it isn't a whole number from 0.
   */
  public static validateOrder(order: number): void;
  /** The department it sits under, or null when it sits under the person or a teammate. */
  public get parentId(): string | null;
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): Department;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** A teammate's place directly in a department, as `Organization.members` lists it. */
export declare class DepartmentMember {
  /** teammate Id. */
  public readonly teammateId: string;
  /** department Id. */
  public readonly departmentId: string;
  /** Creates a validated immutable value. */
  public constructor(
    teammateId: string,
    departmentId: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): DepartmentMember;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/**
 * The organization under the person, as a tree: departments and teammates sit under the person, a teammate or a department,
 * each with one parent and none under itself. A teammate with no place isn't in the organization.
 */
export declare class Organization {
  /** The organization's id. */
  public readonly id: string;
  /** Its name. */
  public readonly name: string;
  /** The default folder of its teammates' Organization chats that have no folder of their own, or null for each chat's own folder. */
  public readonly folder: string | null;
  /** Its place in the list of organizations, from 0. */
  public readonly order: number;
  /** When it was created, as ISO 8601 text. */
  public readonly createdAt: string;
  /** When it last changed, as ISO 8601 text. */
  public readonly updatedAt: string;
  /** The departments, by their order among their siblings, then by when they were created. */
  public readonly departments: readonly Department[];
  /** The placed teammates, by their order among their siblings, then by id. */
  public readonly placements: readonly TeammatePlacement[];
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when the id, a time or the folder is blank, the name is invalid, the order isn't a whole number from 0,
   * two departments share an id, a teammate is placed twice, a parent is neither the person, a placed teammate nor one of the departments,
   * or a teammate or department sits under itself.
   */
  public constructor(
    id: string,
    name: string,
    folder: string | null,
    order: number,
    createdAt: string,
    updatedAt: string,
    departments: readonly Department[],
    placements: readonly TeammatePlacement[]);
  /**
   * Returns this organization with another tree.
   * @param departments The departments.
   * @param placements The placed teammates.
   * @returns The organization, with the same id, name, folder, order and times.
   */
  public withTree(departments: readonly Department[], placements: readonly TeammatePlacement[]): Organization;
  /**
   * Checks an organization name.
   * @throws ArgumentException when it isn't 1 to 100 characters on one line, or is only spaces.
   */
  public static validateName(name: string): void;
  /**
   * Reads and checks the `name` field.
   * @throws JsonException when it is missing or invalid.
   */
  public static readName(reader: JsonReader): string;
  /**
   * Checks a default folder.
   * @throws ArgumentException when it is blank.
   */
  public static validateFolder(folder: string | null): void;
  /**
   * Reads and checks the `folder` field.
   * @throws JsonException when it is missing, not text or null, or blank.
   */
  public static readFolder(reader: JsonReader): string | null;
  /** The teammates placed directly in a department, as department memberships. */
  public get members(): readonly DepartmentMember[];
  /** The leaders: each department's leader, in the departments' order, then each placed teammate with a teammate or department under it. */
  public get leaders(): readonly string[];
  /**
   * Returns the departments directly under a parent, in their order.
   * @param parent The parent.
   * @returns The departments.
   */
  public departmentsUnder(parent: OrganizationParent): readonly Department[];
  /**
   * Returns the teammates placed directly under a parent, in their order.
   * @param parent The parent.
   * @returns The placements.
   */
  public placementsUnder(parent: OrganizationParent): readonly TeammatePlacement[];
  /**
   * Returns what sits directly under a parent: its departments in their order, then its teammates in theirs.
   * @param parent The parent.
   * @returns Each child as a parent value.
   */
  public childrenOf(parent: OrganizationParent): readonly OrganizationParent[];
  /**
   * Returns what a teammate or department sits under.
   * @param node The teammate or department.
   * @returns Its parent, or null for the person, an unplaced teammate or an unknown department.
   */
  public parentOf(node: OrganizationParent): OrganizationParent | null;
  /**
   * Returns the way from the top of the organization down to a teammate or department, the person left out.
   * @param node The teammate or department.
   * @returns Its ancestors from the top, then the node itself.
   */
  public pathOf(node: OrganizationParent): readonly OrganizationParent[];
  /**
   * Returns the teammates that have no place in the organization.
   * @param teammateIds Every teammate's id, in the order to list them.
   * @returns The unplaced ids, in that order.
   */
  public unplaced(teammateIds: readonly string[]): readonly string[];
  /**
   * Returns the department a teammate sits in: the nearest department above it, through teammates it sits under.
   * @param teammateId The teammate's id.
   * @returns The department's id, or null when no department is above it.
   */
  public departmentOf(teammateId: string): string | null;
  /**
   * Returns the teammate a teammate reports to: the teammate it sits under, or its department's leader, or for a leader,
   * or in a department with none, the nearest teammate or leader above.
   * @param teammateId The teammate's id.
   * @returns The manager's id, or null when the teammate reports to the person.
   */
  public managerOf(teammateId: string): string | null;
  /**
   * Says why a teammate or department can't move under a parent, as views check a drop before they send it.
   * @param node The teammate or department to move.
   * @param parent Where it would go.
   * @returns `Resources.personCannotMove`, `Resources.unknownOrganizationParent` or `Resources.organizationNodeUnderItself`,
   * or null when the move is allowed.
   */
  public moveError(node: OrganizationParent, parent: OrganizationParent): string | null;
  /**
   * Returns the teammates a message to a target goes to, each once.
   * @param target The target.
   * @param teammateIds Every teammate's id, in the order to list everyone.
   * @returns The ids of the teammates in the organization, never an unplaced one: the teammate; a department's leader,
   * then every other teammate whose `departmentOf` is that department; the leaders, as `leaders` lists them, then each
   * teammate placed directly under the person; or every placed teammate.
   */
  public recipientsOf(target: OrganizationTarget, teammateIds: readonly string[]): readonly string[];
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): Organization;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** What a node of the organization's tree is. */
export declare enum OrganizationNodeKind {
  /** The person, at the top. */
  Person = "Person",
  /** A teammate. */
  Teammate = "Teammate",
  /** A department. */
  Department = "Department"
}

/** A node of the organization's tree, as a parent or a child: the person, a teammate or a department. */
export declare class OrganizationParent {
  /** The person, at the top of the organization. */
  public static readonly person: OrganizationParent;
  /** What the node is. */
  public readonly kind: OrganizationNodeKind;
  /** The teammate's or department's id, or null for the person. */
  public readonly id: string | null;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when a teammate or department names no id, the person names one, or the id is blank.
   */
  public constructor(kind: OrganizationNodeKind, id: string | null);
  /** Returns a teammate node. */
  public static teammate(teammateId: string): OrganizationParent;
  /** Returns a department node. */
  public static department(departmentId: string): OrganizationParent;
  /** Returns a department node, or the person for null. */
  public static departmentOrPerson(departmentId: string | null): OrganizationParent;
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): OrganizationParent;
  /** Returns whether both name the same node. */
  public equals(other: OrganizationParent): boolean;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** A teammate's place in the organization: what it sits under, and its order among the teammates there. */
export declare class TeammatePlacement {
  /** The teammate's id. */
  public readonly teammateId: string;
  /** What it sits under. */
  public readonly parent: OrganizationParent;
  /** Its order among the teammates under the same parent, from 0. */
  public readonly order: number;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when the id is blank, the teammate is its own parent, or the order isn't a whole number from 0.
   */
  public constructor(teammateId: string, parent: OrganizationParent, order: number);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): TeammatePlacement;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Whom the person writes to in the Organization view. */
export declare enum OrganizationTargetKind {
  /** One teammate. */
  Teammate = "Teammate",
  /** A department's leader and its direct members. */
  Department = "Department",
  /** Everyone who reports to the person: every department's leader and each teammate in no department. */
  Leaders = "Leaders",
  /** Every teammate, in a department or not. */
  Everyone = "Everyone"
}

/** Whom the person writes to in the Organization view. */
export declare class OrganizationTarget {
  /** Everyone who reports to the person: every department's leader and each teammate in no department. */
  public static readonly leaders: OrganizationTarget;
  /** Every teammate. */
  public static readonly everyone: OrganizationTarget;
  /** The kind. */
  public readonly kind: OrganizationTargetKind;
  /** The teammate's or department's id, or null for leaders and everyone. */
  public readonly id: string | null;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when a teammate or department target has no id, or leaders or everyone has one.
   */
  public constructor(kind: OrganizationTargetKind, id: string | null);
  /** The target of one teammate. */
  public static teammate(teammateId: string): OrganizationTarget;
  /** The target of a department. */
  public static department(departmentId: string): OrganizationTarget;
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): OrganizationTarget;
  /** Whether both name the same kind and id. */
  public equals(other: OrganizationTarget): boolean;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/**
 * The key of a teammate's Organization chat: the organization and the teammate it talks with.
 */
export declare class OrganizationChat {
  /**
   * The organization's id.
   */
  public readonly organizationId: string;
  /**
   * The teammate's id.
   */
  public readonly teammateId: string;

  /**
   * Initializes the key.
   * @param organizationId The organization's id.
   * @param teammateId The teammate's id.
   * @throws ArgumentException when an id is blank.
   */
  public constructor(organizationId: string, teammateId: string);

  /**
   * Reads a key from untrusted JSON.
   * @param value The untrusted value, expected to carry `organizationId` and `teammateId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The key.
   * @throws JsonException when a field is missing or blank.
   */
  public static fromJson(value: unknown, path?: string): OrganizationChat;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `organizationId` and `teammateId`.
   */
  public toJson(): JsonObject;
}

/** Parameters for creating a department, last among the departments under its parent, with an optional first member who leads it. */
export declare class DepartmentCreateParams {
  /** The organization's id. */
  public readonly organizationId: string;
  /** The name. */
  public readonly name: string;
  /** What it goes under. */
  public readonly parent: OrganizationParent;
  /** The teammate placed in it first, from wherever it was, as its leader, or null. */
  public readonly leaderId: string | null;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when the name is invalid or the leader id is blank.
   */
  public constructor(
    organizationId: string,
    name: string,
    parent: OrganizationParent,
    leaderId?: string | null);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): DepartmentCreateParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters for renaming a department or setting or clearing its leader; an omitted field stays. */
export declare class DepartmentUpdateParams {
  /** The organization's id. */
  public readonly organizationId: string;
  /** department Id. */
  public readonly departmentId: string;
  /** The new name, or undefined to keep it. */
  public readonly name: string | undefined;
  /** The new leader, null to clear it, or undefined to keep it. */
  public readonly leaderId: string | null | undefined;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when it changes nothing or a field is invalid.
   */
  public constructor(
    organizationId: string,
    departmentId: string,
    name: string | undefined,
    leaderId: string | null | undefined);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): DepartmentUpdateParams;
  /**
   * Returns the department with this update's changes.
   * @param department The department as it is.
   * @param updatedAt The change's time, as ISO 8601 text.
   * @returns The changed department.
   */
  public applyTo(department: Department, updatedAt: string): Department;
  /** Returns the wire representation, without the omitted fields. */
  public toJson(): JsonObject;
}

/** Parameters for placing a teammate in the organization, or taking it out. */
export declare class TeammatePlaceParams {
  /** The organization's id. */
  public readonly organizationId: string;
  /** The teammate's id. */
  public readonly teammateId: string;
  /** What it goes under, or null to take it out of the organization. */
  public readonly parent: OrganizationParent | null;
  /** Its place among the teammates under the parent, from 0; a place past the last puts it last. */
  public readonly order: number;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when the id is blank, the teammate is its own parent, or the order isn't a whole number from 0.
   */
  public constructor(
    organizationId: string,
    teammateId: string,
    parent: OrganizationParent | null,
    order: number);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): TeammatePlaceParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters for moving a department under another parent or to another place among its siblings. */
export declare class DepartmentMoveParams {
  /** The organization's id. */
  public readonly organizationId: string;
  /** department Id. */
  public readonly departmentId: string;
  /** What it goes under. */
  public readonly parent: OrganizationParent;
  /** Its place among the departments under its new parent, from 0; a place past the last puts it last. */
  public readonly order: number;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when a field is blank, the department is its own parent, or the order isn't a whole number from 0.
   */
  public constructor(
    organizationId: string,
    departmentId: string,
    parent: OrganizationParent,
    order: number);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): DepartmentMoveParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters naming one organization. */
export declare class OrganizationIdParams {
  /** The organization's id. */
  public readonly organizationId: string;
  /** Creates a validated immutable value. */
  public constructor(organizationId: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): OrganizationIdParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters for creating an organization, placed last in the list. */
export declare class OrganizationCreateParams {
  /** The name. */
  public readonly name: string;
  /** The default folder of its teammates' Organization chats, or null for each chat's own folder. */
  public readonly folder: string | null;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when the name is invalid or the folder is blank.
   */
  public constructor(name: string, folder: string | null);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): OrganizationCreateParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters for renaming an organization and setting its default folder. */
export declare class OrganizationUpdateParams {
  /** The organization's id. */
  public readonly organizationId: string;
  /** The new name. */
  public readonly name: string;
  /** The new default folder, or null for each chat's own folder. */
  public readonly folder: string | null;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when the id or the folder is blank, or the name is invalid.
   */
  public constructor(organizationId: string, name: string, folder: string | null);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): OrganizationUpdateParams;
  /**
   * Returns the organization with this update's name and folder.
   * @param organization The organization as it is.
   * @param updatedAt The change's time, as ISO 8601 text.
   * @returns The changed organization.
   */
  public applyTo(organization: Organization, updatedAt: string): Organization;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters naming one department. */
export declare class DepartmentIdParams {
  /** The organization's id. */
  public readonly organizationId: string;
  /** department Id. */
  public readonly departmentId: string;
  /** Creates a validated immutable value. */
  public constructor(
    organizationId: string,
    departmentId: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): DepartmentIdParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters for putting a teammate in a department, or in none. */
export declare class DepartmentMemberSetParams {
  /** The organization's id. */
  public readonly organizationId: string;
  /** teammate Id. */
  public readonly teammateId: string;
  /** The department, or null for none. */
  public readonly departmentId: string | null;
  /** Creates a validated immutable value. */
  public constructor(
    organizationId: string,
    teammateId: string,
    departmentId: string | null);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): DepartmentMemberSetParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/**
 * The parameters of `OrganizationLayoutSave`: the Organization view's layout, a JSON object the window defines and
 * TeamRun keeps as it is.
 */
export declare class OrganizationLayoutSaveParams {
  /** The organization's id. */
  public readonly organizationId: string;
  /**
   * The layout.
   */
  public readonly layout: JsonObject;

  /**
   * Initializes the parameters.
   */
  public constructor(organizationId: string, layout: JsonObject);

  /**
   * Reads the parameters from untrusted JSON.
   * @throws JsonException when `organizationId` is missing or blank, or `layout` is missing or not an object.
   */
  public static fromJson(value: unknown, path?: string): OrganizationLayoutSaveParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   */
  public toJson(): JsonObject;
}

/** Parameters for chat member. */
export declare class ChatMemberParams {
  /** chat Id. */
  public readonly chatId: string;
  /** teammate Id. */
  public readonly teammateId: string;
  /** Creates a validated immutable value. */
  public constructor(
    chatId: string,
    teammateId: string);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): ChatMemberParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/**
 * @deprecated Use `ChatMemberParams`; the earlier name goes in a later release.
 */
export declare const ConversationMemberParams: typeof ChatMemberParams;
/**
 * @deprecated Use `ChatMemberParams`; the earlier name goes in a later release.
 */
export type ConversationMemberParams = ChatMemberParams;

/** A teammate and the permission mode to set for it in one chat. */
export declare class ChatMemberModeParams {
  /** The chat's id. */
  public readonly chatId: string;
  /** The teammate's id. */
  public readonly teammateId: string;
  /** The id of one of the teammate's provider's modes, or `null` to follow the teammate's own. */
  public readonly mode: string | null;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when an id is blank, or the mode is blank rather than null.
   */
  public constructor(chatId: string, teammateId: string, mode: string | null);

  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): ChatMemberModeParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** A teammate's own model, effort and speed in one chat. */
export declare class ChatMemberSettings {
  /** The model id, or `null` for the provider's default model. */
  public readonly model: string | null;
  /** The effort level, or `null` for the model's default. */
  public readonly effort: string | null;
  /** The speed id, or `null` for the model's default speed; `null` by default. */
  public readonly speed: string | null;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when the model, effort or speed is blank rather than null.
   */
  public constructor(model: string | null, effort: string | null, speed?: string | null);

  /** Reads a wire value, one without `speed` as `null`, and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): ChatMemberSettings;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** A teammate and the model, effort and speed to set for it in one chat. */
export declare class ChatMemberSettingsParams {
  /** The chat's id. */
  public readonly chatId: string;
  /** The teammate's id. */
  public readonly teammateId: string;
  /** The chat's own model, effort and speed for the teammate, or `null` to follow the teammate's own. */
  public readonly settings: ChatMemberSettings | null;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when an id is blank.
   */
  public constructor(chatId: string, teammateId: string, settings: ChatMemberSettings | null);

  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): ChatMemberSettingsParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** A chat and whether it plans first. */
export declare class ChatPlanFirstParams {
  /** The chat's id. */
  public readonly chatId: string;
  /** Whether each reply in the chat starts in its provider's plan mode. */
  public readonly planFirst: boolean;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when the id is blank.
   */
  public constructor(chatId: string, planFirst: boolean);

  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): ChatPlanFirstParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** A teammate membership, its native session, and its own permission mode, model, effort and speed in one chat. */
export declare class ChatMember {
  /** chat Id. */
  public readonly chatId: string;
  /** teammate Id. */
  public readonly teammateId: string;
  /** joined At. */
  public readonly joinedAt: string;
  /** Native session, or null for a fresh join/reset. */
  public readonly nativeSessionId: string | null;
  /** resumed Native Session. */
  public readonly resumedNativeSession: boolean;
  /**
   * The id of the permission mode the teammate runs in this chat, or `null` for the teammate's own; one its provider no longer lists counts as `null`.
   */
  public readonly mode: string | null;
  /**
   * The model, effort and speed the teammate runs with in this chat, or `null` for the teammate's own. A model of `null` in it is the provider's default, not the
   * teammate's model.
   */
  public readonly settings: ChatMemberSettings | null;
  /**
   * The account the native session belongs to, when Sustain ran it on another of the teammate's entries, or `null` for the teammate's own account.
   */
  public readonly sessionProviderId: string | null;
  /**
   * Creates a validated immutable value; the mode, the settings and the session's account are `null` by default.
   * @throws ArgumentException when an id or the join time is blank, the native session, mode or session's account is blank rather than null, a
   * resumed session has none, or a session's account is given without a session.
   */
  public constructor(
    chatId: string,
    teammateId: string,
    joinedAt: string,
    nativeSessionId: string | null,
    resumedNativeSession: boolean,
    mode?: string | null,
    settings?: ChatMemberSettings | null,
    sessionProviderId?: string | null);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;
  /** Reads a wire value, a stored one without `mode`, `settings` or `sessionProviderId` as `null`, and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): ChatMember;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
  /** Keeps the membership identity, join time, mode and settings while replacing native session state and the account it belongs to, `null` by default. */
  public withSession(nativeSessionId: string | null, resumedNativeSession: boolean, sessionProviderId?: string | null): ChatMember;
  /** Keeps everything else while replacing the chat's mode for the teammate. */
  public withMode(mode: string | null): ChatMember;
  /** Keeps everything else while replacing the chat's model, effort and speed for the teammate. */
  public withSettings(settings: ChatMemberSettings | null): ChatMember;
}

/**
 * @deprecated Use `ChatMember`; the earlier name goes in a later release.
 */
export declare const ConversationMember: typeof ChatMember;
/**
 * @deprecated Use `ChatMember`; the earlier name goes in a later release.
 */
export type ConversationMember = ChatMember;

/** The teammate and chat that sent a message into another chat, with the teammate's name at sending. */
export declare class MessageSender {
  /** The sending chat's `Chat` id. */
  public readonly chatId: string;
  /** The sending teammate's id, or `null` for the sending chat's default teammate. */
  public readonly teammateId: string | null;
  /**
   * The sending teammate's name when it sent, as `TeammateName` allows; for a default teammate, its kind and provider as the window names its
   * replies, such as `Codex · Work`, stored when it sent, as `Resources.defaultSenderNamePattern` allows.
   */
  public readonly name: string;
  /**
   * Whether a session outside TeamRun sent the message through the outside endpoint: then `teammateId` is `null`, `chatId` is the chat it
   * landed in, and `name` is the label the session gave, which no one checked.
   */
  public readonly outside: boolean;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when the name doesn't fit its sender: a teammate's as `TeammateName` allows, a default teammate's as
   * `Resources.defaultSenderNamePattern` allows and not only spaces, an outside sender's as `allowsOutsideLabel` allows; or when an outside
   * sender has a teammate id.
   */
  public constructor(
    chatId: string,
    teammateId: string | null,
    name: string,
    outside?: boolean);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): MessageSender;
  /**
   * Whether a name fits a default teammate's sender: not only spaces, and as `Resources.defaultSenderNamePattern` allows after NFC
   * normalization.
   */
  public static allowsDefaultName(name: string): boolean;
  /** Whether a label fits an outside sender: not only spaces, and as `Resources.outsideLabelPattern` allows. */
  public static allowsOutsideLabel(label: string): boolean;
  /** Returns the wire representation, with `outside` only when it is `true`. */
  public toJson(): JsonObject;
}

/** Resolved mention identity and name preserved at message creation. */
export declare class TeammateMention {
  /** teammate Id. */
  public readonly teammateId: string;
  /** The name at this record's creation or update. */
  public readonly name: string;
  /** Creates a validated immutable value. */
  public constructor(
    teammateId: string,
    name: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): TeammateMention;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** The harness running a teammate. */
export declare enum Harness {
  /** The provider CLI or SDK owns the agent loop. */
  Provider = "Provider"
}

/** How a provider reaches a shared MCP server. */
export declare enum SharedMcpTransport {
  /** The provider starts the server's command and speaks to it over standard input and output. */
  Stdio = "Stdio",
  /** The provider connects to the server's address over MCP's streamable HTTP. */
  Http = "Http"
}

/** The account of another module that a shared HTTP MCP server signs in with. */
export declare enum SharedMcpAccount {
  /** The GitHub module's account. */
  GitHub = "GitHub"
}

/** A teammate's setting for one shared MCP server. */
export declare enum SharedMcpSetting {
  /** The teammate gets the server when it is on for the teammate's provider; the default, kept as no setting. */
  AsProvider = "AsProvider",
  /** The teammate gets the server whatever its provider's switch. */
  On = "On",
  /** The teammate never gets the server. */
  Off = "Off"
}

/** Where a shared MCP server's variable takes its value on this machine. */
export declare enum SharedMcpVariableSource {
  /** The variable of the environment Noldova Desktop reads for TeamRun; the default. */
  Environment = "Environment",
  /** A value saved in Noldova Desktop's secret store, which the server's settings name by reference. */
  Saved = "Saved"
}

/** A header an HTTP shared MCP server receives, named with the variable of the runtime's environment that holds its value; no value is kept. */
export declare class SharedMcpHeader {
  /** The header's name, an HTTP token. */
  public readonly name: string;
  /** The environment variable whose value the header carries. */
  public readonly variable: string;
  /** Creates a validated immutable value; throws `ArgumentException` for a name that isn't a token or a variable that isn't a name. */
  public constructor(name: string, variable: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpHeader;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/**
 * What a shared MCP server is: its name and either a command, its arguments and the variables it receives, or an HTTP address, its headers and an
 * optional bearer variable. A value is never kept: each variable names one in the runtime's environment, which the server receives under that name.
 */
export declare class SharedMcpServerDefinition {
  /**
   * GitHub's own MCP server, `github` at `https://api.githubcopilot.com/mcp/`, which signs in with the GitHub module's account; offered on the MCP
   * servers page and added off for every provider.
   */
  public static readonly gitHub: SharedMcpServerDefinition;
  /** The server's name, which providers list its tools under; never `teamrun`. */
  public readonly name: string;
  /** How a provider reaches the server. */
  public readonly transport: SharedMcpTransport;
  /** A stdio server's command, or null for an HTTP server. */
  public readonly command: string | null;
  /** A stdio server's arguments, kept as written; empty for an HTTP server. */
  public readonly arguments: readonly string[];
  /** The environment variables a stdio server receives; empty for an HTTP server. */
  public readonly variables: readonly string[];
  /** An HTTP server's `http` or `https` address, or null for a stdio server. */
  public readonly url: string | null;
  /** The headers an HTTP server receives; empty for a stdio server. */
  public readonly headers: readonly SharedMcpHeader[];
  /** The variable whose value an HTTP server receives as `Authorization: Bearer <value>`, or null. */
  public readonly bearerVariable: string | null;
  /** Whether an HTTP server signs in with OAuth, TeamRun passing it the signed-in access token as a bearer token; false for a server read without it. */
  public readonly signsIn: boolean;
  /**
   * The account an HTTP server signs in with, TeamRun passing it the account's token as a bearer token; null for a server that signs in with none or
   * was read without it.
   */
  public readonly account: SharedMcpAccount | null;
  /**
   * Creates a validated immutable value; throws `ArgumentException` for a name that isn't a server's name, a variable that isn't a name or is named
   * twice, a header named twice, an Authorization header beside a bearer token's variable, a field of the other transport, an address holding a
   * user name, a password, or a query parameter named like a key, token, secret, password or credential, or a server that signs in but isn't an
   * HTTP server or has a bearer token's variable or an Authorization header, or a server with an account that isn't an HTTP server or has a
   * bearer token's variable, an Authorization header or an OAuth sign-in.
   */
  public constructor(
    name: string,
    transport: SharedMcpTransport,
    command: string | null,
    args: readonly string[],
    variables: readonly string[],
    url: string | null,
    headers: readonly SharedMcpHeader[],
    bearerVariable: string | null,
    signsIn?: boolean,
    account?: SharedMcpAccount | null);
  /** Every variable the server names: its variables, its headers' and its bearer variable, in that order. */
  public get referencedVariables(): readonly string[];
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpServerDefinition;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** A teammate's kept setting for a shared MCP server: `On` or `Off`; a teammate with none follows its provider. */
export declare class SharedMcpTeammateSetting {
  /** The teammate's id. */
  public readonly teammateId: string;
  /** `On` or `Off`. */
  public readonly setting: SharedMcpSetting;
  /** Creates a validated immutable value; throws `ArgumentException` for a blank teammate or `AsProvider`. */
  public constructor(teammateId: string, setting: SharedMcpSetting);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpTeammateSetting;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** A shared MCP server with its switches: the providers it is on for and the teammates' kept settings. */
export declare class SharedMcpServer {
  /** The server's id. */
  public readonly id: string;
  /** What the server is. */
  public readonly definition: SharedMcpServerDefinition;
  /** The providers the server is on for; empty when it is added. */
  public readonly providerIds: readonly string[];
  /** The teammates with a setting of their own. */
  public readonly teammates: readonly SharedMcpTeammateSetting[];
  /** When the server was added. */
  public readonly createdAt: string;
  /** When the server or a switch last changed. */
  public readonly updatedAt: string;
  /** The variables that take a saved secret, each with its secret's reference; never a value. */
  public readonly secrets: readonly SharedMcpSecret[];
  /** The OAuth sign-in of a server that signs in, or `null` when it isn't signed in or doesn't sign in; never a token. */
  public readonly signIn: SharedMcpSignIn | null;
  /**
   * Creates a validated immutable value; throws `ArgumentException` for a blank or repeated provider, a repeated teammate, a variable or
   * reference saved twice, a saved secret for a variable the definition doesn't name, or a sign-in for a server that doesn't sign in.
   */
  public constructor(
    id: string,
    definition: SharedMcpServerDefinition,
    providerIds: readonly string[],
    teammates: readonly SharedMcpTeammateSetting[],
    createdAt: string,
    updatedAt: string,
    secrets?: readonly SharedMcpSecret[],
    signIn?: SharedMcpSignIn | null);
  /** The reference of a variable's saved secret, or `null` when the variable takes its value from the environment. */
  public referenceOf(variable: string): string | null;
  /** A teammate's setting, `AsProvider` when it has none or for the default teammate, `null`. */
  public settingOf(teammateId: string | null): SharedMcpSetting;
  /** Whether a teammate on a provider gets the server: its setting is `On`, or `AsProvider` with the server on for the provider. */
  public reaches(providerId: string, teammateId: string | null): boolean;
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpServer;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** An agent in the ACP registry's list for this computer, or a local ACP command. */
export declare class AcpAgentEntry {
  /** The kind's id once added. */
  public readonly id: string;
  public readonly name: string;
  /** The listed version, empty for a local command or an agent the registry no longer lists. */
  public readonly version: string;
  public readonly description: string;
  /** The agent's HTTPS page, or `null` for none. */
  public readonly about: string | null;
  /** Why it can't be added on this computer, or `null` when it can. */
  public readonly unavailable: string | null;
  /** Whether its binary archive has no listed SHA-256, so its download can't be checked. */
  public readonly notChecked: boolean;
  /** Whether it is already a kind. */
  public readonly added: boolean;
  /** Creates a validated immutable value; throws `ArgumentException` for a blank id or name. */
  public constructor(id: string, name: string, version: string, description: string, about: string | null, unavailable: string | null, notChecked: boolean, added: boolean);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): AcpAgentEntry;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** The ACP registry's agents for this computer and the local ACP commands; `failure` says why the list is older than due, or missing. */
export declare class AcpAgentListing {
  public readonly agents: readonly AcpAgentEntry[];
  public readonly localCommands: readonly AcpAgentEntry[];
  public readonly failure: string | null;
  public readonly fetchedAt: string | null;
  /** Creates an immutable value. */
  public constructor(agents: readonly AcpAgentEntry[], localCommands: readonly AcpAgentEntry[], failure: string | null, fetchedAt: string | null);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): AcpAgentListing;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Names an ACP agent by its kind's id. */
export declare class AcpAgentIdParams {
  public readonly id: string;
  /** Creates a validated immutable value; throws `ArgumentException` for a blank id. */
  public constructor(id: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): AcpAgentIdParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** A local ACP command to add: its name, command and arguments, and each variable by its saved secret's reference, never its value. */
export declare class AcpLocalCommandAddParams {
  public readonly name: string;
  public readonly command: string;
  public readonly arguments: readonly string[];
  public readonly secrets: readonly SharedMcpSecret[];
  /** Creates a validated immutable value; throws `ArgumentException` for a blank name or command. */
  public constructor(name: string, command: string, args: readonly string[], secrets: readonly SharedMcpSecret[]);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): AcpLocalCommandAddParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** The command a provider's agent signs in with in a terminal, as typed into any shell, with the variables laid over the terminal's. */
export declare class ProviderSignInCommand {
  public readonly command: string;
  public readonly environment: Readonly<Record<string, string>>;
  /** Creates a validated immutable value; throws `ArgumentException` for a blank command. */
  public constructor(command: string, environment: Readonly<Record<string, string>>);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): ProviderSignInCommand;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** A variable whose value a shared MCP server takes from a secret saved in Noldova Desktop's secret store, by its reference. */
export declare class SharedMcpSecret {
  /** The variable's name. */
  public readonly variable: string;
  /** The saved secret's name in Noldova Desktop's secret store, `teamrun.mcpSecret` and 32 lowercase hexadecimal digits. */
  public readonly reference: string;
  /** When the secret was last saved, or `null` for one saved before TeamRun kept that. */
  public readonly updatedAt: string | null;
  /** Creates a validated immutable value; throws `ArgumentException` for a name that isn't a variable's or a reference of another form. */
  public constructor(variable: string, reference: string, updatedAt?: string | null);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpSecret;
  /** Returns the wire representation, with `variable`, `reference` and `updatedAt`. */
  public toJson(): JsonObject;
}

/** A shared MCP server's OAuth sign-in: where its tokens are kept and when they need renewing; never a token. */
export declare class SharedMcpSignIn {
  /** The tokens' name in Noldova Desktop's secret store, `teamrun.mcpSignIn` and 32 lowercase hexadecimal digits. */
  public readonly reference: string;
  /** When the access token expires, or `null` when the server didn't say. */
  public readonly expiresAt: string | null;
  /** Why the person has to sign in again, as after a refused refresh, or `null` while the sign-in holds. */
  public readonly needsSignIn: string | null;
  /** When the sign-in last changed. */
  public readonly updatedAt: string;
  /** Creates a validated immutable value; throws `ArgumentException` for a reference of another form, a blank reason or a blank time. */
  public constructor(reference: string, expiresAt: string | null, needsSignIn: string | null, updatedAt: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpSignIn;
  /** Returns the wire representation, with `reference`, `expiresAt`, `needsSignIn` and `updatedAt`. */
  public toJson(): JsonObject;
}

/** Where the person goes to sign a shared MCP server in: the authorization server's address, with TeamRun's client, PKCE challenge and redirect. */
export declare class SharedMcpSignInStarted {
  /** The http or https address to open in the browser, or `null` when a Sign out or a later start ended the sign-in before it had one. */
  public readonly url: string | null;
  /** Creates a validated immutable value; throws `ArgumentException` for an address that isn't http or https. */
  public constructor(url: string | null);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpSignInStarted;
  /** Returns the wire representation, with `url`. */
  public toJson(): JsonObject;
}

/** One of a shared MCP server's variables as the list shows it on this machine. */
export declare class SharedMcpVariable {
  /** The variable's name. */
  public readonly variable: string;
  /** Where it takes its value. */
  public readonly source: SharedMcpVariableSource;
  /** Whether a value is there: set in the environment Noldova Desktop reads, or saved in the secret store on this machine. */
  public readonly set: boolean;
  /** When its saved secret was last saved, or `null` when it has none or TeamRun didn't keep that. */
  public readonly updatedAt: string | null;
  /** Creates a validated immutable value; throws `ArgumentException` for a name that isn't a variable's or an unknown source. */
  public constructor(variable: string, source: SharedMcpVariableSource, set: boolean, updatedAt?: string | null);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpVariable;
  /** Returns the wire representation, with `variable`, `source`, `set` and `updatedAt`. */
  public toJson(): JsonObject;
}

/** A provider that can't take a shared MCP server, and why. */
export declare class SharedMcpUnavailability {
  /** The provider's id. */
  public readonly providerId: string;
  /** Why the provider can't take the server, in a full sentence, as the panel shows it behind Show. */
  public readonly reason: string;
  /**
   * The same reason in a few words, such as `sign-in not passed yet`, as the panel's folded line shows it; `null` when the reason has no
   * short form, and the panel shows `reason` there instead. A wire value without the field reads as `null`.
   */
  public readonly short: string | null;
  /**
   * Creates a validated immutable value.
   * @param short The reason in a few words; `null` by default.
   * @throws ArgumentException when `providerId`, `reason` or a given `short` are blank.
   */
  public constructor(providerId: string, reason: string, short?: string | null);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpUnavailability;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** A shared MCP server as `SharedMcpServerList` lists it, with each provider that can't take it. */
export declare class SharedMcpServerListing {
  /** The server. */
  public readonly server: SharedMcpServer;
  /** The providers that can't take it, each once; a teammate's `On` on one of them is unavailable too. */
  public readonly unavailable: readonly SharedMcpUnavailability[];
  /** Each variable the server names, once, with where it takes its value and whether a value is there on this machine. */
  public readonly variables: readonly SharedMcpVariable[];
  /** Whether a sign-in TeamRun started for the server is waiting for the browser or its exchange. */
  public readonly signingIn: boolean;
  /** Creates a validated immutable value; throws `ArgumentException` for a repeated provider or variable. */
  public constructor(server: SharedMcpServer, unavailable: readonly SharedMcpUnavailability[], variables?: readonly SharedMcpVariable[], signingIn?: boolean);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpServerListing;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters naming a shared MCP server. */
export declare class SharedMcpServerIdParams {
  /** The server's id. */
  public readonly serverId: string;
  /** Creates a validated immutable value. */
  public constructor(serverId: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpServerIdParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters of `SharedMcpServerUpdate`: the server and its new definition. */
export declare class SharedMcpServerUpdateParams {
  /** The server's id. */
  public readonly serverId: string;
  /** The server's new definition. */
  public readonly definition: SharedMcpServerDefinition;
  /** Creates a validated immutable value. */
  public constructor(serverId: string, definition: SharedMcpServerDefinition);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpServerUpdateParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters of `SharedMcpProviderSet`: the server, the provider, and whether the server is on for it. */
export declare class SharedMcpProviderSetParams {
  /** The server's id. */
  public readonly serverId: string;
  /** The provider's id. */
  public readonly providerId: string;
  /** Whether the server is on for the provider. */
  public readonly on: boolean;
  /** Creates a validated immutable value. */
  public constructor(serverId: string, providerId: string, on: boolean);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpProviderSetParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters of `SharedMcpSecretSet`: the server, one of its variables, and its saved secret's reference, or `null` for the environment. */
export declare class SharedMcpSecretSetParams {
  /** The server's id. */
  public readonly serverId: string;
  /** The variable's name. */
  public readonly variable: string;
  /** The saved secret's reference, or `null` for the environment. */
  public readonly reference: string | null;
  /** Creates a validated immutable value; throws `ArgumentException` for a blank server, a name that isn't a variable's, or a reference of another form. */
  public constructor(serverId: string, variable: string, reference: string | null);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpSecretSetParams;
  /** Returns the wire representation, with `serverId`, `variable` and `reference`. */
  public toJson(): JsonObject;
}

/** Parameters of `SharedMcpTeammateSet`: the server, the teammate, and its setting; `AsProvider` removes the teammate's own. */
export declare class SharedMcpTeammateSetParams {
  /** The server's id. */
  public readonly serverId: string;
  /** The teammate's id. */
  public readonly teammateId: string;
  /** The teammate's setting. */
  public readonly setting: SharedMcpSetting;
  /** Creates a validated immutable value; throws `ArgumentException` for a setting that isn't one of the three. */
  public constructor(serverId: string, teammateId: string, setting: SharedMcpSetting);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): SharedMcpTeammateSetParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}
/**
 * A computer-use grant the permission center remembers for a chat: one app the chat may control, or the screen.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's path; `toJson` renders the canonical
 * wire shape.
 */
export declare class ComputerUseGrant {
  /** The remembered grant's id in the permission center. */
  public readonly id: string;
  /** The chat the grant was given in. */
  public readonly chatId: string;
  /** The chat's title, or `null` when it has none or is gone. */
  public readonly chatTitle: string | null;
  /** The teammate the grant was given to, or `null` for the chat's default teammate or one that is gone. */
  public readonly teammateName: string | null;
  /** The app's identity, a lowercase program path on Windows or bundle identifier on macOS; `null` for the screen. */
  public readonly app: string | null;
  /** The app's name as computer use reads it, or `null` for the screen and for an app whose name couldn't be read. */
  public readonly appName: string | null;
  /** The app's icon as a base64 PNG 64 pixels a side, or `null` for the screen and for an app whose icon couldn't be read. */
  public readonly appIcon: string | null;
  /** When the grant was given, as an ISO 8601 string. */
  public readonly grantedAt: string;
  /**
   * Initializes the grant.
   * @throws ArgumentException when `id`, `chatId` or `grantedAt` is blank, `app`, `appName` or `appIcon` is blank but not `null`, or the
   * screen's grant, whose `app` is `null`, has an app name or icon.
   */
  public constructor(id: string, chatId: string, chatTitle: string | null, teammateName: string | null, app: string | null, appName: string | null,
    appIcon: string | null, grantedAt: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): ComputerUseGrant;
  /** Returns the wire representation, with `id`, `chatId`, `chatTitle`, `teammateName`, `app`, `appName`, `appIcon`, `grantedAt`. */
  public toJson(): JsonObject;
}

/**
 * A person's message that waits for a chat's running replies to end, kept in the database so it survives a restart.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's path; `toJson` renders the
 * canonical wire shape.
 */
export declare class WaitingMessage {
  /** The waiting message's id; the sent message gets its own. */
  public readonly id: string;
  /** How it goes. */
  public readonly delivery: MessageDelivery;
  /** The send it makes, as `MessageSend` takes it. */
  public readonly message: MessageSendParams;
  /** When it was added, as an ISO 8601 time. */
  public readonly createdAt: string;
  /** Why its send failed, when it did; a failed message stays, and the ones after it go. */
  public readonly failure: string | null;
  /**
   * Whether a client other than TeamRun's window added it or has edited it, so its requested mode is checked again when it is sent; a
   * message kept before this field existed reads as `false`.
   */
  public readonly fromOutside: boolean;
  /**
   * Initializes the waiting message.
   * @throws ArgumentException when `id`, `createdAt` or a given `failure` is blank, or `message` has a sender token.
   */
  public constructor(id: string, delivery: MessageDelivery, message: MessageSendParams, createdAt: string, failure?: string | null, fromOutside?: boolean);
  /** The `Chat` id, the message's. */
  public get chatId(): string;
  /** The waiting message with another delivery, keeping its failure and whether it is from outside. */
  public withDelivery(delivery: MessageDelivery): WaitingMessage;
  /** The waiting message with another send and no failure, from outside when `fromOutside` says so, by default as it was. */
  public withMessage(message: MessageSendParams, fromOutside?: boolean): WaitingMessage;
  /** The waiting message with the failure of its send, keeping whether it is from outside. */
  public withFailure(failure: string): WaitingMessage;
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): WaitingMessage;
  /** Returns the wire representation, with `id`, `chatId`, `delivery`, `message`, `createdAt`, `failure` when it failed and `fromOutside` when it is. */
  public toJson(): JsonObject;
}

/** The payload of `WaitingMessagesChanged` and the result of `WaitingMessageList`: a chat's waiting messages in the order they go. */
export declare class WaitingMessagesPayload {
  /** The `Chat` id. */
  public readonly chatId: string;
  /** The waiting messages, possibly none. */
  public readonly messages: readonly WaitingMessage[];
  /**
   * Initializes the payload.
   * @throws ArgumentException when `chatId` is blank or a message is another chat's.
   */
  public constructor(chatId: string, messages: readonly WaitingMessage[]);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): WaitingMessagesPayload;
  /** Returns the wire representation, with `chatId` and `messages`. */
  public toJson(): JsonObject;
}

/** Parameters of `WaitingMessageAdd`: the send and how it goes. */
export declare class WaitingMessageAddParams {
  /** The send, as `MessageSend` takes it, without a sender token. */
  public readonly message: MessageSendParams;
  /** How it goes. */
  public readonly delivery: MessageDelivery;
  /** Initializes the parameters. */
  public constructor(message: MessageSendParams, delivery: MessageDelivery);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): WaitingMessageAddParams;
  /** Returns the wire representation, with `message` and `delivery`. */
  public toJson(): JsonObject;
}

/** Parameters of `WaitingMessageEdit`: the waiting message and its new send. */
export declare class WaitingMessageEditParams {
  /** The `WaitingMessage` id. */
  public readonly id: string;
  /** The new send, for the same chat. */
  public readonly message: MessageSendParams;
  /**
   * Initializes the parameters.
   * @throws ArgumentException when `id` is blank.
   */
  public constructor(id: string, message: MessageSendParams);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): WaitingMessageEditParams;
  /** Returns the wire representation, with `id` and `message`. */
  public toJson(): JsonObject;
}

/** How a session outside TeamRun reaches teammates, as the Outside sessions view shows it. */
export declare class OutsideConnection {
  /** Whether the Outside sessions setting is on. */
  public readonly enabled: boolean;
  /** The endpoint's URL, on the port the setting names, whether or not it listens. */
  public readonly url: string;
  /** The outside token, or `null` while the setting is off and none was made yet. */
  public readonly token: string | null;
  /** Why the endpoint isn't listening while the setting is on, such as a port in use, or `null`. */
  public readonly failure: string | null;
  /** What the person should know while the endpoint listens, such as a token made again because the kept one couldn't be read, or `null`. */
  public readonly note: string | null;
  /**
   * Creates a validated immutable value.
   * @throws ArgumentException when the URL is blank, or the token, failure or note is given but blank.
   */
  public constructor(enabled: boolean, url: string, token: string | null, failure: string | null, note: string | null);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): OutsideConnection;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters of `WaitingMessageRemove` and `WaitingMessageSendNow`: the waiting message. */
export declare class WaitingMessageIdParams {
  /** The `WaitingMessage` id. */
  public readonly id: string;
  /**
   * Initializes the parameters.
   * @throws ArgumentException when `id` is blank.
   */
  public constructor(id: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): WaitingMessageIdParams;
  /** Returns the wire representation, with `id`. */
  public toJson(): JsonObject;
}

/** Parameters of `ComputerUseGrantRevoke`: the grant to revoke. */
export declare class ComputerUseGrantIdParams {
  /** The `ComputerUseGrant` id. */
  public readonly grantId: string;
  /**
   * Initializes the parameters.
   * @throws ArgumentException when `grantId` is blank.
   */
  public constructor(grantId: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): ComputerUseGrantIdParams;
  /** Returns the wire representation, with `grantId`. */
  public toJson(): JsonObject;
}

/** The name TeamRun gives a new profile folder it makes for a provider. */
export declare class ProfileFolderName {
  /**
   * Makes a folder name from a provider's label: each character a folder name can't hold becomes `-`, leading and trailing dots and
   * spaces go, the name keeps at most 60 characters, and a name Windows reserves for a device gets `_` before it.
   * @param label The provider's label.
   * @returns The folder's name, or `null` when the label leaves no character a folder name can use.
   */
  public static of(label: string): string | null;
}

/** Whether two profile folder paths name the same folder, as a provider's folder and a kind's usual folder are compared. */
export declare class ProfileFolderPath {
  /**
   * Compares two paths without their ends' separators and surrounding spaces; a Windows path, one that starts with a drive letter or
   * holds a backslash, compares in any case and with `/` read as `\`.
   * @param first One path.
   * @param second The other path.
   * @returns `true` when both name the same folder.
   */
  public static isSame(first: string, second: string): boolean;
}

/** Validation and canonical comparison for participant names. */
export declare class TeammateName {
  /**
   * Requires 1 to 100 Unicode code points after NFC normalization, each mark one of them: words that start with a letter, decimal digit, dash or
   * underscore and go on with those or marks, such as accents and vowel signs, one space apart.
   */
  public static validate(name: string): void;
  /** Reads a name with the same character/length limits and reports failures at the name field path. */
  public static read(reader: JsonReader): string;
  /**
   * Produces the NFC-normalized lowercase lookup key, with each run of whitespace made one space and the ends trimmed, without changing the
   * displayed name; two names with the same key are one teammate's.
   */
  public static key(name: string): string;
  /**
   * The first letter of each of the name's first two words, in upper case: "CR" for "Code Reviewer", "A" for "Alice".
   */
  public static initials(name: string): string;
}

/** The order every list of providers or teammates shows them in. */
export declare class NameOrder {
  /**
   * Returns the items sorted by the first name, then by each next one where the earlier names tie, in the runtime's language with case
   * ignored and accents kept, so "Émile" sorts beside "emile" after "edgar"; items whose names all tie keep their order.
   */
  public static sort<T>(items: readonly T[], ...names: readonly ((item: T) => string)[]): readonly T[];
}

/**
 * TeamRun's MCP server: MCP's JSON-RPC with only `initialize`, `ping`, `tools/list`, `tools/call` and
 * `notifications/cancelled`, over any {@link IMcpTransport}.
 * @remarks
 * It answers a request it can't read with the JSON-RPC errors `-32600`, `-32601` and `-32602`, and a host's listing
 * failure with `-32603`. A host's call failure becomes an `isError` result with its message. A cancelled request, or one
 * still running when the transport closes, is aborted and gets no answer.
 * @example
 * ```ts
 * import { McpServer, type IMcpToolHost, type IMcpTransport } from "@noldova/teamrun.protocol";
 *
 * export function serve(host: IMcpToolHost, transport: IMcpTransport): Promise<void> {
 *   return new McpServer(host, "1.0.0", "TeamRun's tools.").connect(transport);
 * }
 * ```
 */
export declare class McpServer {
  /**
   * Creates the server.
   * @param host Lists and calls the tools.
   * @param version The version `initialize` reports for the server.
   * @param instructions The instructions `initialize` gives the client, or null for none.
   */
  public constructor(host: IMcpToolHost, version: string, instructions?: string | null);
  /**
   * The `tools/call` result of a failed call.
   * @param text What failed, for the agent.
   * @returns A result with the text and `isError`.
   */
  public static toolError(text: string): JsonObject;
  /**
   * Serves one client over the transport, and starts it.
   * @param transport The client's transport; the server sets its `onmessage` and `onclose`.
   */
  public connect(transport: IMcpTransport): Promise<void>;
  /**
   * Aborts the calls in flight and closes the transport.
   */
  public close(): Promise<void>;
}

/**
 * What TeamRun's MCP endpoint asks for a session token's tools: the session token.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class McpToolListParams {
  /** The session token, from the request's bearer authorization. */
  public readonly token: string;
  /**
   * Initializes the parameters.
   * @param token The session token.
   * @throws ArgumentException when `token` is blank.
   */
  public constructor(token: string);
  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `token`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): McpToolListParams;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `token`.
   */
  public toJson(): JsonObject;
}

/**
 * What TeamRun's MCP endpoint asks to call a tool with: the session token, the tool's name and its arguments.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class McpToolCallParams {
  /** The session token, from the request's bearer authorization. */
  public readonly token: string;
  /** The tool's name. */
  public readonly name: string;
  /** The call's arguments. */
  public readonly arguments: JsonObject;
  /**
   * Initializes the parameters.
   * @param token The session token.
   * @param name The tool's name.
   * @param input The call's arguments.
   * @throws ArgumentException when `token` or `name` is blank.
   */
  public constructor(token: string, name: string, input: JsonObject);
  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `token`, `name` and the object `arguments`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): McpToolCallParams;
  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `token`, `name` and `arguments`.
   */
  public toJson(): JsonObject;
}

/**
 * The environment variable that gives a teammate's process the token of its turn, so `teamrun send` run from it is sent as that
 * teammate from that chat.
 */
export declare class SenderEnvironment {
  /** The variables for a teammate's turn with this token. */
  public static of(token: string): Readonly<Record<string, string>>;
  /** The turn's token an environment carries, or null when it carries none. */
  public static read(environment: Readonly<Record<string, string | undefined>>): string | null;
}

/**
 * Resolves mentions, excluding code, escapes and email addresses.
 * A mention token, `[@<label>](mention:<teammate id>)`, mentions its teammate whatever its label says. At each other `@` it matches the
 * longest available name that the following words spell, one space or more apart; a name ends where its last word does, so "@Code Reviewers"
 * mentions "Code", not "Code Reviewer". When no name matches, a first word that begins exactly one available name mentions that teammate,
 * so "@Chat" mentions "Chat GPT" unless another teammate's name also begins with "Chat".
 */
export declare class MentionResolver {
  /**
   * Returns unique matches in text order with their identity and name snapshots.
   */
  public static resolve(text: string, available: readonly TeammateMention[]): readonly TeammateMention[];
  /**
   * Returns the unique teammates that text a teammate wrote names, such as its reply or its send, in text order, as `resolve` does, except
   * that a name inside quotation marks is text. A quote opens at a quotation mark that no letter, digit or `_` comes right before, and closes
   * at its closing mark on the same line that none of them comes right after, so the marks in `'90s` and `didn't` close nothing.
   * An opening mark with no closing mark on its line quotes nothing.
   * @param text The text the teammate wrote.
   * @param available The identities and displayed names available for resolution.
   * @returns Matches in text order with their identity and name snapshots.
   */
  public static resolveTeammateText(text: string, available: readonly TeammateMention[]): readonly TeammateMention[];
  /**
   * Returns the unique teammates that text a teammate wrote addresses, in text order: the mentions `resolveTeammateText` finds that start
   * the text or a line, after at most three spaces, a list marker such as `-` or `1.` and emphasis such as `**`, and the mentions that follow
   * an addressed mention on its line with only emphasis, spaces, tabs, a comma or "and" between them.
   * So "@Reviewer, @Tester: please check" and "- **@Reviewer** and @Tester" address both, while "ask @Reviewer", "> @Reviewer" and a line
   * indented four spaces or a tab, as code is, address no one.
   * @param text The text the teammate wrote.
   * @param available The identities and displayed names available for resolution.
   * @returns Matches in text order with their identity and name snapshots.
   */
  public static resolveAddressed(text: string, available: readonly TeammateMention[]): readonly TeammateMention[];
  /**
   * Finds every mention that addresses its teammate, as `resolveAddressed` reads them, without deduplicating names.
   * @param text The text the teammate wrote.
   * @param available The identities and displayed names available for resolution.
   * @returns Occurrences in text order, with an exclusive end offset.
   */
  public static findAddressed(text: string, available: readonly TeammateMention[]): readonly MentionSpan[];
  /**
   * Finds every resolved occurrence outside code and escapes, without deduplicating names.
   * @param text The original text whose UTF-16 offsets are returned.
   * @param available The identities and displayed names available for resolution.
   * @returns Occurrences in text order, with an exclusive end offset.
   */
  public static find(text: string, available: readonly TeammateMention[]): readonly MentionSpan[];
  /**
   * Writes each mention token outside code and escapes as `@` and the name the caller gives for it, and leaves the rest of the text as it is.
   * @param text The text with mention tokens.
   * @param nameOf The name to write for a token, without the `@`.
   * @returns The text with the tokens written as names.
   */
  public static rewrite(text: string, nameOf: (token: MentionToken) => string): string;
}

/**
 * A mention token, `[@<label>](mention:<teammate id>)`, a markdown link that ties the label, the full name or its first words, to a teammate.
 */
export declare class MentionToken {
  /**
   * The id of the teammate it mentions.
   */
  public readonly teammateId: string;
  /**
   * The label it shows after the `@`.
   */
  public readonly label: string;
  /**
   * Where it starts in the text, as a UTF-16 offset.
   */
  public readonly start: number;
  /**
   * Where it ends in the text, an exclusive UTF-16 offset.
   */
  public readonly end: number;

  /**
   * Initializes a token found in a text.
   */
  public constructor(teammateId: string, label: string, start: number, end: number);

  /**
   * Writes the token for a teammate.
   * @param teammateId The teammate's id, without spaces or parentheses.
   * @param label The label after the `@`, without `]` or a line break.
   * @returns The token's text.
   * @throws ArgumentException when the id or the label can't be written in a token.
   */
  public static format(teammateId: string, label: string): string;

  /**
   * Reads the token that starts at an offset of a text.
   * @param text The text.
   * @param start The offset of the token's `[`.
   * @returns The token, or null when none starts there.
   */
  public static at(text: string, start: number): MentionToken | null;
}

/**
 * A resolved mention and its half-open UTF-16 range in the input text.
 */
export declare class MentionSpan {
  /**
   * The resolved identity and name snapshot.
   */
  public readonly mention: TeammateMention;
  /**
   * The inclusive start offset, at the at-sign.
   */
  public readonly start: number;
  /**
   * The exclusive end offset.
   */
  public readonly end: number;
  /**
   * Records an occurrence found by the resolver.
   * @param mention The resolved identity and name.
   * @param start The inclusive UTF-16 start offset.
   * @param end The exclusive UTF-16 end offset.
   */
  public constructor(mention: TeammateMention, start: number, end: number);
}

/**
 * An action a failed reply offers, named in its error detail's payload under `Resources.actionField`.
 */
export declare enum ReplyAction {
  /**
   * The provider doesn't offer the model the reply asked for: open the teammate, or the composer's model menu, refresh the models, and choose one.
   */
  ChooseModel = "ChooseModel"
}

/**
 * Placement of role instructions in the provider request.
 */
export declare enum RoleApplication {
  /**
   * Native harness instruction field.
   */
  Instructions = "Instructions",
  /**
   * Explicit prompt fallback.
   */
  Prompt = "Prompt"
}

/**
 * How full a provider's session context is, as the provider reports it; TeamRun computes no figure.
 */
export declare class ContextUsage {
  /**
   * The tokens in the session's context.
   */
  public readonly usedTokens: number;
  /**
   * The context window's size in tokens.
   */
  public readonly windowTokens: number;
  /**
   * The context use at which the provider compacts the session, in tokens, or `null` when it doesn't say.
   */
  public readonly compactAtTokens: number | null;

  /**
   * Initializes the context use.
   * @param usedTokens The tokens in the context, a non-negative integer.
   * @param windowTokens The window's size, a positive integer.
   * @param compactAtTokens The compaction point, a positive integer, or `null`.
   * @throws ArgumentException when a figure is out of range.
   */
  public constructor(usedTokens: number, windowTokens: number, compactAtTokens: number | null);

  /**
   * Reads the context use from untrusted JSON.
   * @param value The untrusted value, with the integers `usedTokens` and `windowTokens` and the nullable integer `compactAtTokens`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The context use.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): ContextUsage;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object.
   */
  public toJson(): JsonObject;

  /**
   * Checks a token count.
   * @param value The count.
   * @param name The parameter's name, for the exception.
   * @throws ArgumentException when the count isn't a non-negative safe integer.
   */
  public static throwIfNotCount(value: number, name: string): void;
}

/**
 * What a teammate last said: its latest completed reply that has text, in any chat, as `TeammateLastReplyList` returns it.
 */
export declare class TeammateLastReply {
  /**
   * The `Teammate` id.
   */
  public readonly teammateId: string;
  /**
   * The reply's chat id.
   */
  public readonly chatId: string;
  /**
   * The reply's message id.
   */
  public readonly messageId: string;
  /**
   * The reply's Text details, joined by spaces.
   */
  public readonly text: string;
  /**
   * ISO 8601 timestamp of the reply's end.
   */
  public readonly endedAt: string;

  /**
   * Initializes the teammate's last reply.
   * @throws ArgumentException when a field is blank.
   */
  public constructor(teammateId: string, chatId: string, messageId: string, text: string, endedAt: string);

  /**
   * Reads the teammate's last reply from untrusted JSON.
   * @param value The untrusted value, with `teammateId`, `chatId`, `messageId`, `text` and `endedAt`.
   * @param path Path to report for the value; the root path `$` by default.
   * @throws JsonException when a field is missing or blank.
   */
  public static fromJson(value: unknown, path?: string): TeammateLastReply;

  /**
   * The last reply a message makes for its teammate, or `null` unless it is a teammate's completed reply whose Text details hold more than whitespace.
   * @param message The message.
   */
  public static of(message: Message): TeammateLastReply | null;

  /**
   * Whether the other last reply has the same fields.
   * @param other The other last reply.
   */
  public equals(other: TeammateLastReply): boolean;

  /**
   * Writes the last reply as JSON.
   */
  public toJson(): JsonObject;
}

/**
 * A teammate's latest reply in a chat that reports usage, with its time, as `TeammateUsageList` returns it.
 */
export declare class TeammateUsage {
  /**
   * The `Teammate` id.
   */
  public readonly teammateId: string;
  /**
   * The chat's id.
   */
  public readonly chatId: string;
  /**
   * The reply's message id.
   */
  public readonly messageId: string;
  /**
   * ISO 8601 timestamp of the reply's start, as TeamRun measured it, or `null` when it hasn't started.
   */
  public readonly startedAt: string | null;
  /**
   * ISO 8601 timestamp of the reply's end, as TeamRun measured it, or `null` while it runs.
   */
  public readonly endedAt: string | null;
  /**
   * What the reply used, as its provider reported it; its context is the chat's context for the teammate.
   */
  public readonly usage: ReplyUsage;

  /**
   * Initializes the teammate's usage.
   * @param teammateId The teammate's id.
   * @param chatId The chat's id.
   * @param messageId The reply's id.
   * @param startedAt The reply's start, or `null`.
   * @param endedAt The reply's end, or `null`.
   * @param usage What the reply used.
   * @throws ArgumentException when an id or a time is blank.
   */
  public constructor(teammateId: string, chatId: string, messageId: string, startedAt: string | null, endedAt: string | null, usage: ReplyUsage);

  /**
   * The chat's id, by its earlier name.
   * @deprecated Use `chatId`; the earlier name goes in a later release.
   */
  public get conversationId(): string;

  /**
   * Reads the teammate's usage from untrusted JSON.
   * @param value The untrusted value, with `teammateId`, `conversationId`, `messageId`, the nullable `startedAt` and `endedAt`, and `usage`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The teammate's usage.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): TeammateUsage;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object.
   */
  public toJson(): JsonObject;
}

/**
 * What a teammate worked on, as `TeammateWorkRead` returns it, for its Organization card.
 */
export declare class TeammateWork {
  /**
   * The `Teammate` id.
   */
  public readonly teammateId: string;
  /**
   * The working folder of the chat the teammate last answered in, or `null` when it hasn't answered.
   */
  public readonly folder: string | null;
  /**
   * The working folder of each chat the teammate answered in, each once, the latest answered first.
   */
  public readonly folders: readonly string[];
  /**
   * The Markdown and text files the teammate's replies created or changed, each once, the latest changed first.
   */
  public readonly documents: readonly TeammateDocument[];

  /**
   * Initializes the teammate's work.
   * @param teammateId The teammate's id.
   * @param folder The latest chat's folder, or `null`.
   * @param folders The chats' folders.
   * @param documents The documents.
   * @throws ArgumentException when the id is blank, or `folder` isn't one of `folders`.
   */
  public constructor(teammateId: string, folder: string | null, folders: readonly string[], documents: readonly TeammateDocument[]);

  /**
   * Reads the teammate's work from untrusted JSON.
   * @param value The untrusted value, with `teammateId`, the nullable `folder`, `folders` and `documents`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The teammate's work.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): TeammateWork;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object.
   */
  public toJson(): JsonObject;
}

/**
 * A Markdown or text file a teammate's reply created or changed.
 */
export declare class TeammateDocument {
  /**
   * The file's absolute path.
   */
  public readonly path: string;
  /**
   * The id of the chat whose reply last changed it.
   */
  public readonly chatId: string;
  /**
   * ISO 8601 timestamp of the end of the reply that last changed it.
   */
  public readonly changedAt: string;

  /**
   * Initializes the document.
   * @param path The file's absolute path.
   * @param chatId The chat's id.
   * @param changedAt The reply's end.
   * @throws ArgumentException when a value is blank.
   */
  public constructor(path: string, chatId: string, changedAt: string);

  /**
   * Reads the document from untrusted JSON.
   * @param value The untrusted value, with `path`, `chatId` and `changedAt`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The document.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): TeammateDocument;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object.
   */
  public toJson(): JsonObject;
}

/**
 * What a reply used, as its provider reports it: each figure is `null` when the provider doesn't send it, and TeamRun never estimates one.
 */
export declare class ReplyUsage {
  /**
   * The tokens the reply sent to the model, cached ones included, or `null`.
   */
  public readonly inputTokens: number | null;
  /**
   * The tokens the model wrote, reasoning included, or `null`.
   */
  public readonly outputTokens: number | null;
  /**
   * The reply's cost in US dollars as the provider estimates it, or `null`.
   */
  public readonly costUsd: number | null;
  /**
   * The session's context use at the reply's latest report, or `null`.
   */
  public readonly context: ContextUsage | null;
  /**
   * The input tokens read from the provider's cache, part of `inputTokens`, or `null`.
   */
  public readonly cacheReadTokens: number | null;
  /**
   * The input tokens written to the provider's cache, part of `inputTokens`, or `null`.
   */
  public readonly cacheWriteTokens: number | null;
  /**
   * The reasoning tokens, part of `outputTokens`, or `null`.
   */
  public readonly reasoningTokens: number | null;

  /**
   * Initializes the usage.
   * @param inputTokens The input tokens, a non-negative integer, or `null`.
   * @param outputTokens The output tokens, a non-negative integer, or `null`.
   * @param costUsd The cost, a non-negative number, or `null`.
   * @param context The context use, or `null`.
   * @param cacheReadTokens The cache read tokens, a non-negative integer, or `null`; `null` by default.
   * @param cacheWriteTokens The cache write tokens, a non-negative integer, or `null`; `null` by default.
   * @param reasoningTokens The reasoning tokens, a non-negative integer, or `null`; `null` by default.
   * @throws ArgumentException when a figure is out of range.
   */
  public constructor(inputTokens: number | null, outputTokens: number | null, costUsd: number | null, context: ContextUsage | null,
    cacheReadTokens?: number | null, cacheWriteTokens?: number | null, reasoningTokens?: number | null);

  /**
   * Reads the usage from untrusted JSON.
   * @param value The untrusted value, with the nullable integers `inputTokens` and `outputTokens`, the nullable number `costUsd`, the nullable
   * `context` object, and the optional nullable integers `cacheReadTokens`, `cacheWriteTokens` and `reasoningTokens`, missing from usage stored
   * before they existed.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The usage.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): ReplyUsage;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object.
   */
  public toJson(): JsonObject;

  /**
   * Merges newer usage into this one.
   * @param newer The newer usage.
   * @returns A usage with each of the newer usage's figures, and this one's where the newer has none.
   */
  public merge(newer: ReplyUsage): ReplyUsage;
}

/**
 * One plan window's use, as the provider reports it.
 */
export declare class PlanWindow {
  /**
   * The window, under the provider's own name.
   */
  public readonly name: PlanWindowName;
  /**
   * How much of the window is used, in percent; above 100 when the provider reports overage, `null` when it reports none.
   */
  public readonly usedPercent: number | null;
  /**
   * ISO 8601 timestamp of the window's reset, or `null` when the provider doesn't say.
   */
  public readonly resetsAt: string | null;
  /**
   * How many of the window's units are used, such as requests, fractional where a provider weighs them; above `allowance` on overage, `null` when the provider reports no count.
   */
  public readonly used: number | null;
  /**
   * How many units the window allows, `null` exactly when `used` is.
   */
  public readonly allowance: number | null;
  /**
   * Whether the window has no limit; an unlimited window reports no percentage, count or balance.
   */
  public readonly unlimited: boolean;
  /**
   * How many units are left to spend, such as credits, or `null` when the provider reports no balance.
   */
  public readonly balance: number | null;

  /**
   * Initializes the window.
   * @param name The window.
   * @param usedPercent The used percentage, a non-negative number, or `null`.
   * @param resetsAt The reset time, or `null`.
   * @param used The used count, a non-negative number, or `null`; `null` by default.
   * @param allowance The allowed count, a non-negative number, or `null` with `used`; `null` by default.
   * @param unlimited Whether the window has no limit; `false` by default.
   * @param balance The balance, a non-negative number, or `null`; `null` by default.
   * @throws ArgumentException when a value is negative or not finite, a count lacks its other half, `resetsAt` is blank, or the window is
   * unlimited and reports a value, or neither unlimited nor reports one.
   */
  public constructor(name: PlanWindowName, usedPercent: number | null, resetsAt: string | null, used?: number | null, allowance?: number | null,
    unlimited?: boolean, balance?: number | null);

  /**
   * Whether the window is used up: its used percentage rounds to 100 or more, or else its used count reaches a non-zero allowance, so a window
   * with one request left isn't.
   * An unlimited window and a balance are never used up.
   */
  public get isUsedUp(): boolean;

  /**
   * Reads the window from untrusted JSON.
   * @param value The untrusted value, with `name`, the nullable numbers `usedPercent`, `used`, `allowance` and `balance`, the nullable
   * `resetsAt`, and the boolean `unlimited`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The window.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): PlanWindow;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object.
   */
  public toJson(): JsonObject;
}

/**
 * A provider's plan use, as its provider last reported it.
 */
export declare class PlanUsage {
  /**
   * The kind's id.
   */
  public readonly kind: string;
  /**
   * The `Provider` id, or `null` for the provider's default sign-in.
   */
  public readonly providerId: string | null;
  /**
   * The windows the provider reported, each once; empty when it reported none for the provider, such as for an API key.
   */
  public readonly windows: readonly PlanWindow[];
  /**
   * ISO 8601 timestamp of the report.
   */
  public readonly readAt: string;
  /**
   * The plan's code as the provider names it with its windows, such as Copilot's `planTier`, or `null` when the read named none.
   */
  public readonly plan: string | null;
  /**
   * Whether the provider is used up: a window of the report is used up and its reset hasn't passed.
   * Core keeps it, so the picker, the teammates and the composer show it, and a provider stays usable: a turn on it runs as usual.
   */
  public readonly usedUp: boolean;
  /**
   * ISO 8601 time the provider stops being used up, the latest reset of its used-up windows, or `null` when it isn't used up or a used-up
   * window reports no reset.
   */
  public readonly usedUpUntil: string | null;

  /**
   * Initializes the plan use.
   * @param kind The kind's id.
   * @param providerId The provider's id, or `null`.
   * @param windows The windows, copied.
   * @param readAt The report's time.
   * @param plan The plan's code, or `null`; defaults to `null`.
   * @param usedUp Whether the provider is used up; `false` by default.
   * @param usedUpUntil When it stops being used up, or `null`; `null` by default.
   * @throws ArgumentException when a name, the plan or `usedUpUntil` is blank, a window repeats, or `usedUpUntil` is named while `usedUp`
   * is `false`.
   */
  public constructor(kind: string, providerId: string | null, windows: readonly PlanWindow[], readAt: string, plan?: string | null, usedUp?: boolean,
    usedUpUntil?: string | null);

  /**
   * Reads the plan use from untrusted JSON.
   * @param value The untrusted value, with `kind`, the nullable `providerId`, the `windows` array, `readAt`, the optional nullable `plan`, the
   * optional boolean `usedUp` and the optional nullable `usedUpUntil`; an older report without them is not used up.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The plan use.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): PlanUsage;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object.
   */
  public toJson(): JsonObject;
}

/**
 * Names the provider whose plan use `PlanUsageRead` reads.
 */
export declare class PlanUsageParams {
  /**
   * The kind's id.
   */
  public readonly kind: string;
  /**
   * The `Provider` id, or `null` for the provider's default sign-in.
   */
  public readonly providerId: string | null;

  /**
   * Initializes the parameters.
   * @param kind The kind's id.
   * @param providerId The provider's id, or `null`.
   * @throws ArgumentException when a name is blank.
   */
  public constructor(kind: string, providerId: string | null);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, with `kind` and the nullable `providerId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): PlanUsageParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object.
   */
  public toJson(): JsonObject;
}
