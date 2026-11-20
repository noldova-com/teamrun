/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  type Approval, type Conversation, type ConversationRewindResult, type ConversationSearchHit, DetailKind, type Message, type MessageSender, type MessageSendResult,
  MessageStatus, type PlanWindow, type Project, type Provider, ProviderIdentity, type ProviderModel, type Teammate, type TeammateUsage
} from "@noldova/teamrun.protocol";

export class Resources {
  public static readonly moduleId: string = "teamrun";
  public static readonly nameSeparator: string = ".";
  public static readonly lineSeparator: string = "\n";
  public static readonly columnSeparator: string = "  ";
  public static readonly providerDisabled: string = "Disabled";
  public static readonly wordSeparator: string = " ";
  public static readonly listSeparator: string = ", ";
  public static readonly emptyList: string = "(none)";

  public static readonly projectsCommand: string = "teamrun.listProjects";
  public static readonly chatsCommand: string = "teamrun.listChats";
  public static readonly newChatCommand: string = "teamrun.newChat";
  public static readonly renameChatCommand: string = "teamrun.renameChat";
  public static readonly deleteChatCommand: string = "teamrun.deleteChat";
  public static readonly messagesCommand: string = "teamrun.listMessages";
  public static readonly sendCommand: string = "teamrun.send";
  public static readonly cancelCommand: string = "teamrun.cancel";
  public static readonly approvalsCommand: string = "teamrun.listApprovals";
  public static readonly providersCommand: string = "teamrun.listProviders";
  public static readonly checkProviderCommand: string = "teamrun.checkProvider";
  public static readonly addProviderCommand: string = "teamrun.addProvider";
  public static readonly removeProviderCommand: string = "teamrun.removeProvider";
  public static readonly modelsCommand: string = "teamrun.listModels";
  public static readonly openFolderCommand: string = "teamrun.openFolder";
  public static readonly forgetProjectCommand: string = "teamrun.forgetProject";
  public static readonly moveChatCommand: string = "teamrun.moveChat";
  public static readonly searchCommand: string = "teamrun.search";
  public static readonly rewindCommand: string = "teamrun.rewind";
  public static readonly liveCheckCommand: string = "teamrun.liveCheck";
  public static readonly teammatesCommand: string = "teamrun.listTeammates";

  public static readonly projectValue: string = "project";
  public static readonly projectIdValue: string = "projectId";
  public static readonly chatIdValue: string = "chatId";
  public static readonly titleValue: string = "title";
  public static readonly beforeValue: string = "before";
  public static readonly limitValue: string = "limit";
  public static readonly textValue: string = "text";
  public static readonly teammateValue: string = "teammate";
  public static readonly kindValue: string = "kind";
  public static readonly modelValue: string = "model";
  public static readonly effortValue: string = "effort";
  public static readonly providerValue: string = "provider";
  public static readonly pendingValue: string = "pending";
  public static readonly providerIdValue: string = "providerId";
  public static readonly labelValue: string = "label";
  public static readonly folderValue: string = "folder";
  public static readonly messageIdValue: string = "messageId";
  public static readonly restoreFilesValue: string = "restoreFiles";
  public static readonly promptValue: string = "prompt";

  public static readonly notFoundCode: string = "NotFound";
  public static readonly noWorkingReply: string = "The chat has no working reply.";
  public static readonly inputArgument: string = "-";
  public static readonly homePattern: RegExp = /^~(?=$|[\\/])/u;
  public static readonly byteOrderMarkPattern: RegExp = /^\uFEFF/;
  public static readonly windowsLineSeparator: string = "\r\n";
  public static readonly finalLineSeparatorPattern: RegExp = /\n$/;
  public static readonly emptyInput: string = "The message read from standard input is empty.";
  public static readonly terminalInput: string = "- reads the message from standard input, which is a terminal here: "
    + "pipe the message in, such as from a quoted here-document (<<'EOF', the message, then EOF).";
  public static readonly changeEffortAction: string = "change effort";
  public static readonly kindNeedsProvider: string = "--kind needs --provider: name one of that kind's providers, which list-providers lists.";
  public static readonly defaultNeedsProvider: string = "The default teammate has no provider: choose its provider in Settings › TeamRun, or pass --provider.";
  public static readonly noResponder: string = "Name a teammate with @name or --teammate, a kind with --kind and one of its providers with --provider, or set a default teammate in Settings › TeamRun.";
  public static readonly methodFailureName: string = "MethodFailureException";
  public static readonly failureField: string = "failure";
  public static readonly conflictCode: string = "Conflict";
  public static readonly teammatesField: string = "teammates";
  public static readonly replyingField: string = "replying";
  public static readonly idField: string = "id";
  public static readonly nameField: string = "name";
  public static readonly roleField: string = "role";
  public static readonly harnessField: string = "harness";
  public static readonly providerField: string = "provider";
  public static readonly kindField: string = "kind";
  public static readonly labelField: string = "label";
  public static readonly emailField: string = "email";
  public static readonly userNameField: string = "userName";
  public static readonly planField: string = "plan";
  public static readonly organizationField: string = "organization";
  public static readonly modelField: string = "model";
  public static readonly effortField: string = "effort";
  public static readonly chatsField: string = "chats";
  public static readonly titleField: string = "title";
  public static readonly answeringField: string = "answering";
  public static readonly usageField: string = "usage";
  public static readonly chatIdField: string = "chatId";
  public static readonly inputTokensField: string = "inputTokens";
  public static readonly outputTokensField: string = "outputTokens";
  public static readonly costUsdField: string = "costUsd";
  public static readonly contextTokensField: string = "contextTokens";
  public static readonly contextWindowField: string = "contextWindowTokens";
  public static readonly planWindowsField: string = "planWindows";
  public static readonly deletedProvider: string = "(deleted provider)";
  public static readonly noChats: string = "no chats";
  public static readonly chatsLabel: string = "chats: ";
  public static readonly answeringState: string = "answering";
  public static readonly detailIndent: string = "  ";
  public static readonly teammatesLabel: string = "teammates: ";
  public static readonly nameListSeparator: string = ", ";
  public static readonly noTeammates: string = "no teammates";
  public static readonly replyingState: string = "replying";
  public static readonly idleState: string = "idle";
  public static readonly effortsLabel: string = "efforts: ";
  public static readonly noEfforts: string = "no efforts";
  public static readonly defaultModel: string = "default";
  public static readonly maximumSearchLimit: number = 100;
  public static readonly searchLimitOutOfRange: string = "--limit takes a whole number from 1 to 100.";
  public static readonly titleHit: string = "in the title";
  public static readonly sessionKept: string = "The provider's session continues from there.";
  public static readonly sessionRestarted: string = "The next reply starts a fresh provider session.";
  public static readonly liveCheckTitle: string = "Live check";
  public static readonly liveCheckPollMilliseconds: number = 500;
  public static readonly liveCheckFailedCode: string = "LiveCheckFailed";
  public static readonly liveCheckNoReply: string = "The runtime started no reply for the live check's message.";
  public static readonly liveCheckReplyGone: string = "The live check's reply is gone: its chat was deleted while the reply ran.";
  public static readonly liveCheckEndStatuses: readonly MessageStatus[] = [MessageStatus.AwaitingApproval, MessageStatus.Completed, MessageStatus.Failed,
    MessageStatus.Cancelled, MessageStatus.Interrupted];
  public static readonly promptField: string = "prompt";
  public static readonly statusField: string = "status";
  public static readonly textField: string = "text";
  public static readonly errorField: string = "error";
  public static readonly durationField: string = "durationMilliseconds";

  public static formatQualifiedName(name: string): string {
    return `${Resources.moduleId}${Resources.nameSeparator}${name.charAt(0).toLowerCase()}${name.slice(1)}`;
  }

  public static formatNotAList(method: string): string {
    return `The runtime part answered ${method} with something other than a list.`;
  }

  public static formatNotAWholeNumber(name: string): string {
    return `--${name} takes a whole number.`;
  }

  public static formatFolderNotFound(folder: string): string {
    return `No folder is at ${folder}.`;
  }

  public static formatTeammateNotFound(name: string): string {
    return `No teammate is named ${name}.`;
  }

  public static formatProviderNotFound(id: string): string {
    return `No provider has the id ${id}.`;
  }

  public static formatList(lines: readonly string[]): string {
    return lines.length === 0 ? Resources.emptyList : lines.join(Resources.lineSeparator);
  }

  public static formatProject(project: Project): string {
    return [project.id, project.name, project.rootPath].join(Resources.columnSeparator);
  }

  public static formatChat(chat: Conversation, teammates: readonly string[], replying: boolean): string {
    const names = teammates.length === 0 ? Resources.noTeammates : `${Resources.teammatesLabel}${teammates.join(Resources.nameListSeparator)}`;
    return [chat.id, chat.title, names, replying ? Resources.replyingState : Resources.idleState].join(Resources.columnSeparator);
  }

  public static formatChatStarted(chat: Conversation): string {
    return `Started chat ${chat.id}: ${chat.title}`;
  }

  public static formatChatRenamed(chat: Conversation): string {
    return `Renamed chat ${chat.id}: ${chat.title}`;
  }

  public static formatChatDeleted(chatId: string): string {
    return `Deleted chat ${chatId}.`;
  }

  public static formatProjectOpened(project: Project): string {
    return `Opened project ${project.id}: ${project.name} (${project.rootPath})`;
  }

  public static formatProjectForgotten(projectId: string): string {
    return `Forgot project ${projectId} and deleted its chats.`;
  }

  public static formatChatMoved(chat: Conversation, projectId: string): string {
    return `Moved chat ${chat.id} to project ${projectId}: ${chat.title}`;
  }

  public static formatSearchHit(hit: ConversationSearchHit): string {
    const found = Object.isNull(hit.sequence) ? Resources.titleHit : `#${hit.sequence}: ${hit.snippet}`;
    return [hit.chatId, hit.title, found].join(Resources.columnSeparator);
  }

  public static formatRewound(result: ConversationRewindResult): string {
    const removed = result.removedMessageIds.length;
    const messages = removed === 1 ? "1 message" : `${removed} messages`;
    const files = Object.isNull(result.restoredFiles) ? "no files restored" : result.restoredFiles === 1 ? "1 file restored" : `${result.restoredFiles} files restored`;
    const rewound = `Removed ${messages}; ${files}. ${result.sessionKept ? Resources.sessionKept : Resources.sessionRestarted}`;
    return Object.isNull(result.restoreRefusal) ? rewound : `${rewound}${Resources.lineSeparator}${result.restoreRefusal}`;
  }

  public static formatLiveCheckPassed(provider: Provider, text: string): string {
    return `${provider.label} (${provider.kind}) answered: ${text}`;
  }

  public static formatLiveCheckFailed(provider: Provider, status: MessageStatus, error: string): string {
    const named = `${provider.label} (${provider.kind})`;
    if (status === MessageStatus.AwaitingApproval)
      return `${named} asked for an approval, which only the window answers, so the live check stopped its reply.`;
    return error.length === 0 ? `The reply of ${named} ended ${status}.` : `The reply of ${named} ended ${status}: ${error}`;
  }

  public static formatReason(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  public static formatLiveCheckChatLeft(text: string, chatId: string): string {
    return `${text}${Resources.lineSeparator}The live check's chat ${chatId} stays; delete-chat ${chatId} removes it.`;
  }

  public static formatMessage(message: Message, author: string, text: string): string {
    return `#${message.sequence} ${author} (${message.status}): ${text}`;
  }

  public static formatSender(sender: MessageSender, title: string | null): string {
    const name = Object.isNull(sender.teammateId) ? `the default teammate (${sender.name})` : `@${sender.name}`;
    return Object.isNull(title) ? `${name} in a deleted chat (${sender.conversationId})` : `${name} in chat ${JSON.stringify(title)} (${sender.conversationId})`;
  }

  public static formatSent(result: MessageSendResult): string {
    const sent = `Sent message ${result.sent.id}; replies: ${Resources.formatIds(result.replies.map(t => t.id))}`;
    const notes = result.sent.details.filter(t => t.kind === DetailKind.Note).map(t => t.text);
    return [sent, ...notes].join(Resources.lineSeparator);
  }

  public static formatStopped(replies: readonly Message[]): string {
    return `Stopped ${Resources.formatIds(replies.map(t => t.id))}.`;
  }

  public static formatApproval(approval: Approval): string {
    const options = approval.options.map(t => `${t.id} (${t.label})`).join(Resources.listSeparator);
    return [approval.id, approval.status, approval.summary, options].join(Resources.columnSeparator);
  }

  public static formatProvider(provider: Provider): string {
    return [provider.id, provider.kind, provider.label, provider.enabled ? provider.authStatus : Resources.providerDisabled].join(Resources.columnSeparator);
  }

  public static formatProviderAdded(provider: Provider): string {
    return `Added provider ${provider.id}: ${provider.label} (${provider.kind})`;
  }

  public static formatProviderRemoved(providerId: string): string {
    return `Removed provider ${providerId}.`;
  }

  public static formatModel(model: ProviderModel): string {
    const levels = model.effortLevels ?? [];
    const efforts = levels.length === 0 ? Resources.noEfforts : `${Resources.effortsLabel}${levels.join(Resources.listSeparator)}`;
    return [model.id, model.displayName, efforts, ...model.isDefault ? [Resources.defaultModel] : []].join(Resources.columnSeparator);
  }

  public static formatTeammate(teammate: Teammate, provider: Provider | null, chats: readonly Conversation[], answering: boolean): string {
    const account = Object.isNull(provider) ? null : ProviderIdentity.describeAccount(provider.authStatus, provider.identity);
    const named = Object.isNull(provider) ? Resources.deletedProvider : Object.isNull(account) ? provider.label : `${provider.label} (${account})`;
    const joined = chats.length === 0 ? Resources.noChats : `${Resources.chatsLabel}${chats.map(t => `${t.title} (${t.id})`).join(Resources.listSeparator)}`;
    const columns = [teammate.id, teammate.name, teammate.harness, named, teammate.model ?? Resources.emptyList, teammate.effort ?? Resources.emptyList, joined,
      answering ? Resources.answeringState : Resources.idleState].join(Resources.columnSeparator);
    return Object.isNull(teammate.role) ? columns : `${columns}${Resources.lineSeparator}${Resources.detailIndent}role: ${teammate.role.split(Resources.lineSeparator)[0]}`;
  }

  public static formatTeammateUsage(chatTitle: string | null, reply: TeammateUsage): string | null {
    const usage = reply.usage;
    const parts = [
      Object.isNull(usage.inputTokens) ? null : `${usage.inputTokens} input tokens`,
      Object.isNull(usage.outputTokens) ? null : `${usage.outputTokens} output tokens`,
      Object.isNull(usage.costUsd) ? null : `$${usage.costUsd.toFixed(4)}`,
      Object.isNull(usage.context) ? null : `context ${usage.context.usedTokens} of ${usage.context.windowTokens} tokens`
    ].filter((t): t is string => !Object.isNull(t));
    if (parts.length === 0)
      return null;
    const chat = Object.isNull(chatTitle) ? `chat ${reply.conversationId}` : `${chatTitle} (${reply.conversationId})`;
    return `${Resources.detailIndent}last reply in ${chat}: ${parts.join(Resources.listSeparator)}`;
  }

  public static formatPlanWindows(windows: readonly PlanWindow[]): string {
    const described = windows.map(t => Object.isNull(t.usedPercent) ? t.name : `${t.name} ${t.usedPercent}% used`);
    return `${Resources.detailIndent}plan: ${described.join(Resources.listSeparator)}`;
  }

  private static formatIds(ids: readonly string[]): string {
    return ids.length === 0 ? Resources.emptyList : ids.join(Resources.listSeparator);
  }
}
