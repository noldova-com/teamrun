/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources as CoreResources } from "@noldova/teamrun.core";
import type { ProcessOrigin } from "@noldova/teamrun.providers";

export class Resources {
  public static readonly acpAgentsFolderName: string = "acp-agents";
  public static readonly acpRegistryFileName: string = "registry.json";
  public static readonly acpIconsFolderName: string = "icons";
  public static readonly acpInstallsFolderName: string = "agents";
  public static readonly acpRegistryTimeout: number = 15_000;
  public static readonly clientName: string = "teamrun";
  public static readonly clientTitle: string = "TeamRun";
  public static readonly checkpointsServiceName: string = "checkpoints.service";
  public static readonly terminalOwnersServiceName: string = "terminal.owners";
  public static readonly grokProfileSegments: readonly string[] = ["profiles", "grok", "default"];
  public static readonly opencodeProfileSegments: readonly string[] = ["profiles", "opencode", "default"];
  public static readonly cursorProfileSegments: readonly string[] = ["profiles", "cursor", "default"];
  public static readonly copilotWorkSegments: readonly string[] = ["providers", "copilot", "work"];
  public static readonly antigravityProfileSegments: readonly string[] = ["profiles", "antigravity", "default"];
  public static readonly antigravityInstallSegments: readonly string[] = ["providers", "antigravity"];
  public static readonly antigravityUnpackTimeout: number = 600_000;
  public static readonly antigravitySignTimeout: number = 60_000;
  public static readonly codesignPath: string = "/usr/bin/codesign";
  public static readonly claudeInstallSegments: readonly string[] = ["providers", "claude"];
  public static readonly copilotInstallSegments: readonly string[] = ["providers", "copilot"];
  public static readonly releaseChannelTimeout: number = 10_000;
  public static readonly codexUnpackTimeout: number = 600_000;
  public static readonly copilotUnpackTimeout: number = 600_000;
  public static readonly cursorInstallSegments: readonly string[] = ["providers", "cursor"];
  public static readonly cursorUnpackTimeout: number = 600_000;
  public static readonly antigravityTempSegments: readonly string[] = ["antigravity-tmp"];
  public static readonly piExtensionSegments: readonly string[] = ["providers", "pi"];
  public static readonly chainHopLimitSetting: string = "teamrun.chainHopLimit";
  public static readonly titleModelSetting: string = "teamrun.titleModel";
  public static readonly idleCompactionSetting: string = "teamrun.idleCompaction";
  public static readonly outsideSessionsSetting: string = "teamrun.outsideSessions";
  public static readonly outsidePortSetting: string = "teamrun.outsidePort";
  public static readonly outsideDefaultPort: number = 47391;
  public static readonly outsideTokenSecret: string = "teamrun.outsideToken";
  public static readonly outsideTokenBytes: number = 32;
  public static readonly sha256Algorithm: string = "sha256";
  public static readonly mcpTextType: string = "text";
  public static readonly outsideListTool: string = "teamrun_list_teammates";
  public static readonly outsideChatsTool: string = "teamrun_list_chats";
  public static readonly outsideSendTool: string = "teamrun_send_message";
  public static readonly outsideReadTool: string = "teamrun_read_replies";
  public static readonly fromArgument: string = "from";
  public static readonly messageIdsArgument: string = "message_ids";
  public static readonly waitSecondsArgument: string = "wait_seconds";
  public static readonly outsideTextLimit: number = 20_000;
  public static readonly outsideReadLimit: number = 50;
  public static readonly outsideWaitLimit: number = 30;
  public static readonly outsideLabelLimit: number = 40;
  public static readonly outsideLabelUnsafePattern: RegExp = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}@]+/gu;
  public static readonly outsideLabelSpacesPattern: RegExp = /\s+/gu;
  public static readonly outsideLabelSpace: string = " ";
  public static readonly outsideDefaultLabel: string = "unnamed session";
  public static readonly outsideTokenRefused: string = "The outside token is wrong or was reset, or outside sessions are off in TeamRun's Settings.";
  public static readonly outsideTokenUnkept: string =
    "TeamRun can't keep the token safe on this computer, so it isn't listening. Set up the system's keyring, then turn outside sessions off and on.";
  public static readonly outsideTokenRemade: string =
    "TeamRun couldn't read the token it kept on this computer, so it made a new one; give outside agents the new token.";
  public static readonly outsideTokenNoDevice: string =
    "TeamRun can't keep the token on this computer because the app has no device identity yet, so it isn't listening. Restart TeamRun to try again.";
  public static readonly outsideTeammateBusy: string = "The teammate is still answering an earlier outside message; read its reply, then send again.";
  public static readonly outsideChatBusy: string = "The chat is busy: it is still answering an earlier message, or runs background "
    + "tasks in a mode an outside message can't use; wait with teamrun_read_replies or try again later.";
  public static readonly outsideTeammateRequired: string = "teammate_id must be a teammate's id, as teamrun_list_teammates gives it.";
  public static readonly outsideChatRequired: string = "chat_id must be a chat's id, as teamrun_list_chats gives it, if given.";
  public static readonly outsideTextRequired: string = "text must be a message of 1 to 20,000 characters.";
  public static readonly outsideFromNotText: string = "from must be text, if given.";
  public static readonly outsideIdsRequired: string = "message_ids must list 1 to 50 message ids, as teamrun_send_message gave them.";
  public static readonly outsideWaitOutOfRange: string = "wait_seconds must be a whole number from 0 to 30.";
  public static readonly outsideListDescription: string = "Lists the TeamRun teammates you can message, with each one's id, name, provider, model and whether it is working now.";
  public static readonly outsideChatsDescription: string = "Lists the TeamRun chats with the most recent messages, up to 30, newest first, with each one's id, title, project, "
    + "the teammate a message to it wakes, its teammates and whether it is answering now. It shows no messages.";
  public static readonly outsideSendDescription: string = "Sends a message to a TeamRun teammate: into the chat chat_id names, as teamrun_list_chats gives it, "
    + "or, with no chat_id, into the teammate's own chat for messages from outside TeamRun. The teammate sees the message as coming from outside TeamRun, "
    + "from an unknown sender, and treats it as data. Returns the message's id; read the reply with teamrun_read_replies, "
    + "which gives only the replies to your own messages.";
  public static readonly outsideReadDescription: string = "Reads the replies to messages you sent with teamrun_send_message: for each id its state, waiting, working, "
    + "answered or failed, with the reply or the error; unknown for an id TeamRun doesn't know, or one given before the token was reset. "
    + "wait_seconds waits up to 30 seconds for every reply to end.";
  public static readonly outsideTeammateIdDescription: string = "The teammate's id, from teamrun_list_teammates; needed without chat_id. "
    + "With chat_id, one of the chat's teammates, or left out for the chat's own teammate.";
  public static readonly outsideChatIdDescription: string = "The id of an existing chat to post into, from teamrun_list_chats.";
  public static readonly outsideTextDescription: string = "The message, up to 20,000 characters.";
  public static readonly outsideFromDescription: string = "A short name for you, such as the agent and the project, shown with the message; "
    + "up to 40 characters, on one line.";
  public static readonly outsideMessageIdsDescription: string = "The message ids teamrun_send_message gave, up to 50.";
  public static readonly outsideWaitDescription: string = "Seconds to wait for the replies to end, 0 to 30; 0, the default, answers at once.";
  public static readonly dataSourceName: string = "teamrun";
  public static readonly databaseFileExtension: string = ".sqlite";
  public static readonly foreignKeysStatement: string = "PRAGMA foreign_keys = ON";
  public static readonly requestId: string = "runtime";
  public static readonly nameSeparator: string = ".";
  public static readonly migrationIdSeparator: string = "_";
  public static readonly migrationIdWordSeparator: string = "-";
  public static readonly environmentNamePattern: RegExp = /^[^=\0]+$/;
  public static readonly crashPipeVariable: string = "CHROME_CRASHPAD_PIPE_NAME";
  public static readonly errorField: string = "error";
  public static readonly argumentsField: string = "arguments";
  public static readonly rejectedStatus: string = "rejected";
  public static readonly replyWork: string = "A reply is running.";
  public static readonly replyFailedNotice: string = "replyFailed";
  public static readonly openChatCommand: string = "openChat";
  public static readonly openChatIdArgument: string = "chatId";
  public static readonly rewindWork: string = "A chat is rewinding.";
  public static readonly moveWork: string = "A chat is moving to a project.";
  public static readonly installWork: string = "A provider is installing.";
  public static readonly signInWork: string = "A sign-in is running.";
  public static readonly discoverWork: string = "A search for providers is running.";
  public static readonly unsupportedValue: string = "The module database returned a value that is not text, a number or null.";
  public static readonly partAlreadyActive: string = "TeamRun's runtime part is already active.";
  public static readonly providersDidNotStop: string = "A provider did not stop.";
  public static readonly answererNotRegistered: string = "TeamRun answers no permission requests, since it isn't this app's permissions module.";
  public static readonly computerUseModule: string = "computer-use";
  public static readonly browserModule: string = "browser";
  public static readonly browserNavigateAction: string = "browser.navigate";
  public static readonly computerUseScreenAction: string = "computer-use.controlScreen";
  public static readonly computerUseAppAction: string = "computer-use.controlApp";
  public static readonly computerUseChatActions: readonly string[] = [Resources.computerUseScreenAction, Resources.computerUseAppAction];
  public static readonly computerUseAppsService: string = "computer-use.apps";
  public static readonly gitHubAccessService: string = "git-github.access";
  public static readonly appIconEncoding: BufferEncoding = "base64";
  public static readonly mainProcessOnly: string = "Only the person answers this, from TeamRun's window.";
  public static readonly partStopping: string = "TeamRun is stopping, so it starts no rewind or move now.";
  public static readonly commandFolderName: string = "command";
  public static readonly commandOutsideTurn: string = "This command runs only in a teammate's turn, whose environment names the app's program.";
  public static readonly loopbackAddress: string = "127.0.0.1";
  public static readonly mcpEndpointPath: string = "/mcp";
  public static readonly bearerPattern: RegExp = /^Bearer +(\S+)$/i;
  public static readonly bearerScheme: string = "Bearer";
  public static readonly wwwAuthenticateHeader: string = "WWW-Authenticate";
  public static readonly allowHeader: string = "Allow";
  public static readonly postMethod: string = "POST";
  public static readonly forbiddenStatus: number = 403;
  public static readonly notFoundStatus: number = 404;
  public static readonly unauthorizedStatus: number = 401;
  public static readonly methodNotAllowedStatus: number = 405;
  public static readonly errorEvent: string = "error";
  public static readonly requestEvent: string = "request";
  public static readonly abortEvent: string = "abort";
  public static readonly mcpEndpointWithoutPort: string = "TeamRun's MCP endpoint listened on an address without a port.";
  public static readonly closeEvent: string = "close";
  public static readonly okStatus: number = 200;
  public static readonly contentTypeHeader: string = "Content-Type";
  public static readonly acceptHeader: string = "Accept";
  public static readonly authorizationHeader: string = "Authorization";
  public static readonly htmlContentType: string = "text/html; charset=utf-8";
  public static readonly jsonContentType: string = "application/json";
  public static readonly mcpAcceptTypes: string = "application/json, text/event-stream";
  public static readonly manualRedirect: "manual" = "manual";
  public static readonly hexEncoding: BufferEncoding = "hex";
  public static readonly millisecondsPerSecond: number = 1_000;
  public static readonly sharedMcpSignInTimeout: number = 300_000;
  public static readonly sharedMcpRefreshMargin: number = 60_000;
  public static readonly sharedMcpRequestTimeout: number = 5_000;
  public static readonly sharedMcpStateBytes: number = 16;
  public static readonly sharedMcpCallbackPath: string = "/callback";
  public static readonly codeParameter: string = "code";
  public static readonly stateParameter: string = "state";
  public static readonly errorParameter: string = "error";
  public static readonly sharedMcpAuthorizedResult: string = "AUTHORIZED";
  public static readonly sharedMcpClientName: string = "TeamRun";
  public static readonly sharedMcpGrantTypes: readonly string[] = ["authorization_code", "refresh_token"];
  public static readonly sharedMcpResponseType: string = "code";
  public static readonly sharedMcpTokenAuthMethod: string = "none";
  public static readonly sharedMcpInvalidateAll: string = "all";
  public static readonly sharedMcpInvalidateClient: string = "client";
  public static readonly sharedMcpInvalidateTokens: string = "tokens";
  public static readonly sharedMcpProbeBody: string = JSON.stringify({ jsonrpc: "2.0", id: 0, method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "TeamRun", version: "1" } } });
  public static readonly sharedMcpTokenProbeBody: string = JSON.stringify({ jsonrpc: "2.0", id: 0, method: "ping" });
  public static readonly redirectUrlField: string = "redirectUrl";
  public static readonly resourceMetadataUrlField: string = "resourceMetadataUrl";
  public static readonly scopeField: string = "scope";
  public static readonly clientField: string = "client";
  public static readonly tokensField: string = "tokens";
  public static readonly expiresAtField: string = "expiresAt";
  public static readonly sharedMcpSignInTimedOut: string = "The sign-in wasn't finished within five minutes.";
  public static readonly sharedMcpSignInStateMismatch: string = "The sign-in's answer didn't match the sign-in TeamRun started.";
  public static readonly sharedMcpSignInMissing: string = "TeamRun has no sign-in for it on this machine.";
  public static readonly sharedMcpSignInExpiredForGood: string = "Its sign-in expired, and the server gave no way to renew it.";
  public static readonly sharedMcpRefreshRefused: string = "The server didn't renew its sign-in.";
  public static readonly sharedMcpSignInRevoked: string = "The server no longer takes its sign-in, and gave no way to renew it.";
  public static readonly sharedMcpSignInWithoutCode: string = "The sign-in's answer carried no code.";
  public static readonly sharedMcpSignedInPage: string =
    "<!doctype html><meta charset=\"utf-8\"><title>TeamRun</title><p>Signed in. You can close this tab and go back to TeamRun.</p>";
  public static readonly sharedMcpSignInFailedPage: string =
    "<!doctype html><meta charset=\"utf-8\"><title>TeamRun</title><p>The sign-in didn't finish. TeamRun shows why on its MCP servers page.</p>";
  public static readonly toolsClient: string = "teamrun.tools";
  public static readonly toolsConnection: number = 0;
  public static readonly toolPrefix: string = "teamrun_";
  public static readonly terminalTools: readonly string[] = ["terminal_list", "terminal_read", "terminal_open", "terminal_run", "terminal_write",
    "terminal_interrupt", "terminal_close"];
  public static readonly computerUseTools: readonly string[] = ["computer_list_displays", "computer_list_apps", "computer_request_apps", "computer_screenshot",
    "computer_zoom", "computer_read_window", "computer_click", "computer_scroll", "computer_move", "computer_drag", "computer_type", "computer_key", "computer_batch"];
  public static readonly terminalFolderBinding: string = "terminal.folder";
  public static readonly terminalSharedBinding: string = "terminal.shared";
  public static readonly terminalOwnerBinding: string = "terminal.owner";
  public static readonly browserTools: readonly string[] = ["browser_navigate", "browser_snapshot", "browser_click", "browser_type", "browser_press_key",
    "browser_wait_for", "browser_screenshot", "browser_console"];
  public static readonly gitTools: readonly string[] = ["git_status", "git_diff", "git_log", "git_branches", "git_stage", "git_unstage", "git_create_branch",
    "git_switch_branch", "git_commit", "git_push", "git_pull", "git_github_read", "git_github_pr_checks", "git_github_pr_create"];
  public static readonly gitFolderBinding: string = "git.folder";
  public static readonly browserPageBinding: string = "page";
  public static readonly browserProfileBinding: string = "profileKey";
  public static readonly browserAgentBinding: string = "agentName";
  public static readonly browserViewClosedCode: string = "browser.viewClosed";
  public static readonly pageShowStep: number = 250;
  public static readonly pagePanel: string = "Page";
  public static readonly toolOriginPrefix: string = "teamrun:";
  public static readonly refusedFailure: string = "Refused";
  public static readonly mcpImageType: string = "image";
  public static readonly listProjectsTool: string = "teamrun_list_projects";
  public static readonly listChatsTool: string = "teamrun_list_chats";
  public static readonly listMessagesTool: string = "teamrun_list_messages";
  public static readonly listApprovalsTool: string = "teamrun_list_approvals";
  public static readonly listProvidersTool: string = "teamrun_list_providers";
  public static readonly checkProviderTool: string = "teamrun_check_provider";
  public static readonly listTeammatesTool: string = "teamrun_list_teammates";
  public static readonly openPanelTool: string = "teamrun_open_panel";
  public static readonly closePanelTool: string = "teamrun_close_panel";
  public static readonly listProjectsCommand: string = "teamrun.listProjects";
  public static readonly listChatsCommand: string = "teamrun.listChats";
  public static readonly listMessagesCommand: string = "teamrun.listMessages";
  public static readonly listApprovalsCommand: string = "teamrun.listApprovals";
  public static readonly listProvidersCommand: string = "teamrun.listProviders";
  public static readonly checkProviderCommand: string = "teamrun.checkProvider";
  public static readonly listTeammatesCommand: string = "teamrun.listTeammates";
  public static readonly projectIdArgument: string = "project_id";
  public static readonly chatIdArgument: string = "chat_id";
  public static readonly beforeArgument: string = "before";
  public static readonly limitArgument: string = "limit";
  public static readonly pendingArgument: string = "pending";
  public static readonly providerIdArgument: string = "provider_id";
  public static readonly panelArgument: string = "panel";
  public static readonly projectValue: string = "project";
  public static readonly chatIdValue: string = "chatId";
  public static readonly beforeValue: string = "before";
  public static readonly limitValue: string = "limit";
  public static readonly pendingValue: string = "pending";
  public static readonly providerIdValue: string = "providerId";
  public static readonly listProjectsTitle: string = "List projects";
  public static readonly listChatsTitle: string = "List chats";
  public static readonly listMessagesTitle: string = "List messages";
  public static readonly listApprovalsTitle: string = "List approvals";
  public static readonly listProvidersTitle: string = "List providers";
  public static readonly checkProviderTitle: string = "Check a provider";
  public static readonly listTeammatesTitle: string = "List teammates";
  public static readonly openPanelTitle: string = "Open a panel";
  public static readonly closePanelTitle: string = "Close a panel";
  public static readonly listProjectsDescription: string = "Lists each TeamRun project's id, name and folder.";
  public static readonly listChatsDescription: string = "Lists each chat's id, title, project and teammates, and whether a reply is running, of every project and the chats without one, or of the project given.";
  public static readonly listMessagesDescription: string = "Lists a chat's latest messages, or those before a sequence number, each with its number, author, status and text. "
    + "The person's own messages are by User, and a message a teammate sent from another chat names that teammate and chat.";
  public static readonly listApprovalsDescription: string = "Lists the id, status, summary and options of each of a chat's approvals and questions.";
  public static readonly listProvidersDescription: string = "Lists each provider's id, kind, name and sign-in status, and how much of its plan is used where the provider reports it.";
  public static readonly checkProviderDescription: string = "Checks a provider's sign-in and gives its status.";
  public static readonly listTeammatesDescription: string = "Lists every teammate with its id, name, role, provider, model, effort, chats and usage.";
  public static readonly projectIdDescription: string = "The id of the project whose chats to list; every project's and the chats without one when left out.";
  public static readonly chatIdDescription: string = "The id of the chat.";
  public static readonly beforeDescription: string = "Lists only the messages before this sequence number.";
  public static readonly limitDescription: string = "How many messages to list at most.";
  public static readonly pendingDescription: string = "Lists only the approvals and questions that wait for an answer.";
  public static readonly providerIdDescription: string = "The id of the provider to check.";
  public static readonly openPanelDescription: string = "Opens the Teammates or Providers page, a chat, or a view, for the person, in the window that "
    + "shows your chat, or else the window they focused last, and the person's focus moves into it. A view shows where the person keeps it, and its dock shows too; Activity, Changes, Plan, "
    + "Sub-agents and Background tasks show the chat that window shows.";
  public static readonly closePanelDescription: string = "Closes the Teammates or Providers page, or a chat, in the window that shows your chat, or else the window "
    + "the person focused last; for a view, it hides the dock that holds it, with the dock's other tabs, and changes nothing when the view isn't open or "
    + "isn't in a dock.";
  public static readonly panelDescription: string = "The panel: Teammates, Providers, Chat or Page with chat_id, or a view: Projects, Activity, Changes, Plan, "
    + "SubAgents or BackgroundTasks. Page is the chat's own Browser page.";
  public static readonly panelChatIdDescription: string = "The id of the chat, with the panels Chat and Page only.";
  public static readonly openProjectTool: string = "teamrun_open_project";
  public static readonly forgetProjectTool: string = "teamrun_forget_project";
  public static readonly createChatTool: string = "teamrun_create_chat";
  public static readonly renameChatTool: string = "teamrun_rename_chat";
  public static readonly moveChatTool: string = "teamrun_move_chat";
  public static readonly deleteChatTool: string = "teamrun_delete_chat";
  public static readonly addTeammateToChatTool: string = "teamrun_add_teammate_to_chat";
  public static readonly removeTeammateFromChatTool: string = "teamrun_remove_teammate_from_chat";
  public static readonly sendMessageTool: string = "teamrun_send_message";
  public static readonly cancelRepliesTool: string = "teamrun_cancel_replies";
  public static readonly createTeammateTool: string = "teamrun_create_teammate";
  public static readonly updateTeammateTool: string = "teamrun_update_teammate";
  public static readonly deleteTeammateTool: string = "teamrun_delete_teammate";
  public static readonly openProjectTitle: string = "Open a project";
  public static readonly forgetProjectTitle: string = "Forget a project";
  public static readonly createChatTitle: string = "Create a chat";
  public static readonly renameChatTitle: string = "Rename a chat";
  public static readonly moveChatTitle: string = "Move a chat";
  public static readonly deleteChatTitle: string = "Delete a chat";
  public static readonly addTeammateToChatTitle: string = "Add a teammate to a chat";
  public static readonly removeTeammateFromChatTitle: string = "Remove a teammate from a chat";
  public static readonly sendMessageTitle: string = "Send a message";
  public static readonly cancelRepliesTitle: string = "Stop a chat's replies";
  public static readonly createTeammateTitle: string = "Create a teammate";
  public static readonly updateTeammateTitle: string = "Change a teammate";
  public static readonly deleteTeammateTitle: string = "Delete a teammate";
  public static readonly openProjectDescription: string = "Opens a folder as a TeamRun project and gives the project.";
  public static readonly forgetProjectDescription: string = "Forgets a project and deletes its chats, after the person allows it; the folder's files stay.";
  public static readonly createChatDescription: string = "Starts an empty chat in a project, or without one in a folder of its own, and gives the chat.";
  public static readonly renameChatDescription: string = "Renames a chat.";
  public static readonly moveChatDescription: string = "Moves a chat to another project.";
  public static readonly deleteChatDescription: string = "Deletes a chat and its messages, after the person allows it.";
  public static readonly addTeammateToChatDescription: string = "Adds a teammate to a chat.";
  public static readonly removeTeammateFromChatDescription: string = "Removes a teammate from a chat, after the person allows it.";
  public static readonly sendMessageDescription: string = "Sends a message to a chat as from you, after the person allows it, without waiting for its replies; "
    + "with wake_when_done, end your turn instead of polling, and a new turn brings the replies' last text once they end.";
  public static readonly cancelRepliesDescription: string = "Stops a chat's working replies; another chat's only after the person allows it.";
  public static readonly createTeammateDescription: string = "Adds a teammate, after the person allows it.";
  public static readonly updateTeammateDescription: string = "Changes a teammate's name, role, provider, model or effort, after the person allows it; what is left out stays.";
  public static readonly deleteTeammateDescription: string = "Deletes a teammate, after the person allows it.";
  public static readonly folderArgument: string = "folder";
  public static readonly titleArgument: string = "title";
  public static readonly teammateIdArgument: string = "teammate_id";
  public static readonly textArgument: string = "text";
  public static readonly nameArgument: string = "name";
  public static readonly roleArgument: string = "role";
  public static readonly modelArgument: string = "model";
  public static readonly effortArgument: string = "effort";
  public static readonly wakeWhenDoneArgument: string = "wake_when_done";
  public static readonly contextWindowArgument: string = "context_window";
  public static readonly folderDescription: string = "The project's folder, as a full path.";
  public static readonly changedProjectIdDescription: string = "The id of the project.";
  public static readonly targetProjectIdDescription: string = "The id of the project to move the chat to.";
  public static readonly newChatProjectIdDescription: string = "The id of the project to start the chat in; a chat without a project when left out.";
  public static readonly newChatTitleDescription: string = "The chat's title; TeamRun names it from its first message when left out.";
  public static readonly chatTitleDescription: string = "The chat's new title.";
  public static readonly teammateIdDescription: string = "The id of the teammate.";
  public static readonly messageTextDescription: string = "The message, which may mention teammates as @<name>.";
  public static readonly wakeWhenDoneDescription: string = "Whether to wake you with a new turn, quoting the replies' last text, once the replies "
    + "this message starts, and the hand-offs they start in that chat, have ended.";
  public static readonly teammateNameDescription: string = "The teammate's name.";
  public static readonly roleDescription: string = "The teammate's role, which its instructions start with.";
  public static readonly teammateProviderDescription: string = "The id of the provider the teammate answers with.";
  public static readonly modelDescription: string = "The model; the provider's default when left out.";
  public static readonly effortDescription: string = "The effort; the model's default when left out.";
  public static readonly contextWindowDescription: string =
    "The context window in tokens, within the bounds the model offers, or null for the provider's own; it applies from the teammate's next message.";
  public static readonly rootPathField: string = "rootPath";
  public static readonly projectIdField: string = "projectId";
  public static readonly conversationIdField: string = "chatId";
  public static readonly teammateIdField: string = "teammateId";
  public static readonly titleField: string = "title";
  public static readonly nameField: string = "name";
  public static readonly roleField: string = "role";
  public static readonly providerIdField: string = "providerId";
  public static readonly harnessField: string = "harness";
  public static readonly modelField: string = "model";
  public static readonly effortField: string = "effort";
  public static readonly speedField: string = "speed";
  public static readonly modeField: string = "mode";
  public static readonly contextWindowField: string = "contextWindow";
  public static readonly binaryPathField: string = "binaryPath";
  public static readonly expectedProviderIdField: string = "expectedProviderId";
  public static readonly projectLabel: string = "Project";
  public static readonly folderLabel: string = "Folder";
  public static readonly chatsLabel: string = "Chats";
  public static readonly filesLabel: string = "Files";
  public static readonly chatLabel: string = "Chat";
  public static readonly teammateLabel: string = "Teammate";
  public static readonly nameLabel: string = "Name";
  public static readonly roleLabel: string = "Role";
  public static readonly providerLabel: string = "Provider";
  public static readonly modelLabel: string = "Model";
  public static readonly effortLabel: string = "Effort";
  public static readonly contextWindowLabel: string = "Context window";
  public static readonly noProviderValue: string = "No provider";
  public static readonly changedBeforeAllowed: string = "What the person allowed changed before TeamRun acted, so nothing changed.";
  public static readonly ownChatRefused: string = "A teammate can't delete the chat it is answering in, since its reply couldn't record the result.";
  public static readonly ownProjectChatRefused: string =
    "A teammate can't delete a chat in the project it is answering in, since TeamRun changes no chat of a project while a turn runs there.";
  public static readonly ownProjectRefused: string = "A teammate can't forget the project of the chat it is answering in, since its reply couldn't record the result.";
  public static readonly ownMembershipRefused: string = "A teammate can't remove itself from the chat it is answering in, since its reply couldn't record the result.";
  public static readonly callerRefused: string = "A teammate can't delete itself while it answers, since its reply couldn't record the result.";
  public static readonly chatFilesNotCounted: string = "Couldn't count the chat's files, so nothing changed.";
  public static readonly chatFilesMoveRefused: string = "A teammate can't move a chat without a project whose folder holds files; the person moves it with Move to project… in TeamRun's window, which asks first.";
  public static readonly noRunningTurn: string = "This call's turn has ended, so it can't send as its teammate.";
  public static readonly subAgentNoRunningTurn: string = "This call's turn has ended, so it has no sub-agents to start, wait for or stop.";
  public static readonly startSubAgentTool: string = "teamrun_start_sub_agent";
  public static readonly waitSubAgentsTool: string = "teamrun_wait_sub_agents";
  public static readonly stopSubAgentTool: string = "teamrun_stop_sub_agent";
  public static readonly startSubAgentTitle: string = "Start a sub-agent";
  public static readonly waitSubAgentsTitle: string = "Wait for sub-agents";
  public static readonly stopSubAgentTitle: string = "Stop a sub-agent";
  public static readonly startSubAgentDescription: string = "Starts a sub-agent on your provider and model that works on a brief in this chat's folder "
    + "and sees nothing else of the chat: an explorer only reads, a helper works in your mode, one at a time per folder; answers at once "
    + "with its id, and teamrun_wait_sub_agents gives its last message once it ends; one still running when your turn ends wakes you with "
    + "a new turn and its summary when it ends.";
  public static readonly waitSubAgentsDescription: string = "Waits until one of your sub-agents ends, or for at most the given seconds, "
    + "then gives each ended one's status and last message and the ids still running; call it again to keep waiting.";
  public static readonly stopSubAgentDescription: string = "Stops one of your sub-agents and gives how it ended.";
  public static readonly explorerAgent: string = "explorer";
  public static readonly helperAgent: string = "helper";
  public static readonly agentArgument: string = "agent";
  public static readonly descriptionArgument: string = "description";
  public static readonly briefArgument: string = "brief";
  public static readonly subAgentIdArgument: string = "sub_agent_id";
  public static readonly subAgentIdsArgument: string = "sub_agent_ids";
  public static readonly secondsArgument: string = "seconds";
  public static readonly agentDescription: string = "Who runs it: explorer, which reads and changes nothing, or helper, which works as you do.";
  public static readonly subAgentDescriptionDescription: string = "Three to six words on what it does, its row's title.";
  public static readonly briefDescription: string = "The whole task, with everything it needs to know.";
  public static readonly subAgentIdDescription: string = "The sub-agent's id, as teamrun_start_sub_agent gave it.";
  public static readonly subAgentIdsDescription: string = "The sub-agents to wait for; all of yours when left out.";
  public static readonly secondsDescription: string = "How long to wait at most, in seconds.";
  public static readonly commandNoRunningTurn: string = "This call's turn has ended, so it can't start a background command.";
  public static readonly runInBackgroundTool: string = "teamrun_run_in_background";
  public static readonly runInBackgroundTitle: string = "Run a command in the background";
  public static readonly runInBackgroundDescription: string = "Runs a shell command in the background in this chat's folder, such as a build, "
    + "a test run or a server, and answers at once with its id; it shows in the chat's Background tasks with its output, and when it ends "
    + "you're woken with a new turn quoting its exit code and last lines, so end your turn instead of waiting for it.";
  public static readonly commandArgument: string = "command";
  public static readonly commandDescription: string = "The command line, run by the person's shell: cmd.exe on Windows, which takes one line "
    + "of at most 8,191 characters with its own path and flags, so join commands with &&; else $SHELL or sh.";
  public static readonly commandDescriptionDescription: string = "Three to six words on what it does, its row's title.";
  public static readonly dataEvent: string = "data";
  public static readonly utf8Encoding: BufferEncoding = "utf8";
  public static readonly windowsPlatform: string = "win32";
  public static readonly windowsShell: string = "cmd.exe";
  public static readonly windowsShellVariable: string = "ComSpec";
  public static readonly windowsShellFlags: readonly string[] = ["/d", "/s", "/c"];
  public static readonly windowsLineBreaks: RegExp = /[\r\n]/;
  public static readonly windowsCommandLineBreak: string = "On Windows, cmd.exe runs only a command's first line; join its commands with && on one line.";
  public static readonly posixShell: string = "/bin/sh";
  public static readonly posixShellVariable: string = "SHELL";
  public static readonly posixShellFlag: string = "-c";
  public static readonly permissionDenied: string = "The person didn't allow it, so nothing changed.";
  public static readonly permissionExpired: string = "Nobody answered in time, so nothing changed.";
  public static readonly permissionWithdrawn: string = "The call ended before the person answered, so nothing changed.";
  public static readonly changeDone: string = "Done.";

  public static formatSharedMcpAccountInactive(account: string): string {
    return `The ${account} module isn't on, so TeamRun can't use its sign-in.`;
  }

  public static formatWindowsShellCommand(command: string): string {
    return `"${command}"`;
  }

  public static formatDatabaseFileName(moduleId: string): string {
    return `${moduleId}${Resources.databaseFileExtension}`;
  }

  public static formatQualifiedName(moduleId: string, name: string): string {
    return `${moduleId}${Resources.nameSeparator}${name.charAt(0).toLowerCase()}${name.slice(1)}`;
  }

  public static formatLoopbackHost(port: number): string {
    return `${Resources.loopbackAddress}:${port}`;
  }

  public static formatMcpEndpointUrl(port: number): string {
    return `http://${Resources.formatLoopbackHost(port)}${Resources.mcpEndpointPath}`;
  }

  public static formatPanelAnswer(panel: string, conversationId: string | null, open: boolean): string {
    const chat = `the chat ${String(conversationId)}`;
    const named = Object.isNull(conversationId) ? `the panel ${panel}` : panel === Resources.pagePanel ? `the Browser page of ${chat}` : chat;
    return `${open ? "Opened" : "Closed"} ${named} in a TeamRun window.`;
  }

  public static formatPageNotOpened(failure: string, reason: string): string {
    return `${failure} TeamRun couldn't open it: ${reason}`;
  }

  public static formatToolOrigin(tool: string): string {
    return `${Resources.toolOriginPrefix}${tool}`;
  }

  public static formatNoMethodForTools(method: string): string {
    return `TeamRun's tools reached for the method ${method}, which the runtime part doesn't register.`;
  }

  public static formatNotTeamRunTool(tool: string): string {
    return `TeamRun's MCP server serves only TeamRun's, Terminal's, computer use's, the Browser's and the Git modules' tools, not ${tool}.`;
  }

  public static formatPermissionAction(moduleId: string, tool: string): string {
    const words = tool.split("_").slice(1);
    return `${moduleId}${Resources.nameSeparator}${words[0]}${words.slice(1).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join("")}`;
  }

  public static formatForgetProjectRequest(name: string, chats: number): string {
    return `Forget the project "${name}" and delete its ${chats === 1 ? "chat" : `${chats} chats`}`;
  }

  public static formatDeleteChatRequest(title: string, files: number): string {
    return files === 0 ? `Delete the chat "${title}"` : `Delete the chat "${title}" and the ${files === 1 ? "file" : `${files} files`} it holds`;
  }

  public static formatRemoveTeammateRequest(teammate: string, title: string): string {
    return `Remove ${teammate} from the chat "${title}"`;
  }

  public static formatCancelRepliesRequest(title: string): string {
    return `Stop the replies in the chat "${title}"`;
  }

  public static formatCreateTeammateRequest(name: string): string {
    return `Add the teammate ${name}`;
  }

  public static formatUpdateTeammateRequest(name: string): string {
    return `Change the teammate ${name}`;
  }

  public static formatContextWindowTokens(tokens: number): string {
    return `${tokens.toLocaleString("en-US")} tokens`;
  }

  public static formatDeleteTeammateRequest(name: string): string {
    return `Delete the teammate ${name}`;
  }

  public static formatCommand(productSlug: string, moduleId: string): string {
    return `${productSlug} ${moduleId}`;
  }

  public static formatChatTerminalsNotClosed(conversationId: string, kind: string): string {
    return `The terminals of deleted chat ${conversationId} could not be closed (${kind}).`;
  }

  public static formatChatPagesNotRemoved(conversationId: string, kind: string): string {
    return `The pages of deleted chat ${conversationId} could not be removed (${kind}).`;
  }

  public static formatReplyFailed(name: string | null): string {
    return Object.isNull(name) ? "A reply failed" : `${name}'s reply failed`;
  }

  public static formatNoticeNotPosted(kind: string, failure: string): string {
    return `TeamRun could not post a ${kind} notification: ${failure}.`;
  }

  public static formatSessionStopFailed(kind: string): string {
    return `TeamRun couldn't end the turn of a tool session a module stopped (${kind}).`;
  }

  public static formatEndpointFailed(kind: string): string {
    return `TeamRun's MCP endpoint failed while listening (${kind}).`;
  }

  public static formatOutsideToolUnknown(name: string): string {
    return `TeamRun's outside endpoint has no tool ${JSON.stringify(name)}.`;
  }

  public static formatOutsidePortFailure(port: number, code: string | null): string {
    return code === "EADDRINUSE" ? `Port ${port} is in use; choose another in Settings.` : `The endpoint couldn't listen on port ${port}.`;
  }

  public static formatOutsideNotApplied(kind: string): string {
    return `TeamRun couldn't apply the outside sessions settings (${kind}).`;
  }

  public static formatOutsideNotListening(port: number, kind: string): string {
    return `TeamRun's outside endpoint could not listen on port ${port} (${kind}).`;
  }

  public static formatEndpointNotListening(kind: string): string {
    return `TeamRun's MCP endpoint could not listen, so every teammate's turn fails, saying so, until TeamRun restarts (${kind}).`;
  }

  public static formatCommandNotWritten(kind: string): string {
    return `Teammates can't reach other chats: TeamRun's command for them could not be written (${kind}).`;
  }

  public static formatMigrationId(id: string): string {
    return id.toLowerCase().replaceAll(Resources.migrationIdSeparator, Resources.migrationIdWordSeparator);
  }

  public static formatProgramRefused(program: string): string {
    return `Noldova Desktop refused to start the program ${program} with a value that isn't an error.`;
  }

  public static formatProgramNotStarted(program: string, origin: ProcessOrigin | null, kind: string): string {
    return Object.isNull(origin)
      ? `The program ${program} could not start: ${kind}.`
      : `The provider program ${program} of ${origin.kind} for ${CoreResources.formatLoggedProvider(origin.providerId)} could not start: ${kind}.`;
  }

  public static formatSharedMcpRedirectUrl(port: number): string {
    return `http://${Resources.loopbackAddress}:${port}${Resources.sharedMcpCallbackPath}`;
  }

  public static formatSharedMcpSignInDenied(reason: string): string {
    return `The sign-in was refused: ${reason}.`;
  }

  public static formatSharedMcpSignInFailed(reason: string): string {
    return `TeamRun couldn't finish the sign-in. ${reason}`;
  }

  public static formatSharedMcpRefreshFailed(reason: string): string {
    return `TeamRun couldn't renew its sign-in. ${reason}`;
  }
}
