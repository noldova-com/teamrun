/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly mentionMarker: string = "@";
  public static readonly repliesField: string = "replies";
  public static readonly abortEvent: string = "abort";
  public static readonly asOption: string = "as";
  public static readonly namedSettingsUseTeammateUpdate: string = "Use teammate-update to change a named teammate's account, model or effort.";
  public static readonly teammateNameArgument: string = "name";
  public static readonly teammateIdArgument: string = "teammateId";
  public static readonly roleOption: string = "role";
  public static readonly teammatesCommand: string = "teammates";
  public static readonly teammatesDescription: string = "teammates: lists named teammates.";
  public static readonly teammateNewCommand: string = "teammate-new";
  public static readonly teammateNewDescription: string = "teammate-new <name> <accountId> [--model <model>] [--effort <effort>] [--role <text>]: creates a teammate.";
  public static readonly teammateUpdateCommand: string = "teammate-update";
  public static readonly teammateUpdateDescription: string = "teammate-update <id> <name> <accountId> [--model <model>] [--effort <effort>] [--role <text>]: replaces settings; omitted options reset.";
  public static readonly teammateDeleteCommand: string = "teammate-delete";
  public static readonly teammateDeleteDescription: string = "teammate-delete <id>: deletes a teammate and its memberships, preserving messages.";
  public static readonly membersCommand: string = "members";
  public static readonly membersDescription: string = "members <conversationId>: lists named members in join order.";
  public static readonly memberAddCommand: string = "member-add";
  public static readonly memberAddDescription: string = "member-add <conversationId> <teammateId>: adds a member if not already present.";
  public static readonly memberRemoveCommand: string = "member-remove";
  public static readonly memberRemoveDescription: string = "member-remove <conversationId> <teammateId>: removes a membership; rejoining starts a new session.";
  public static readonly productVersion: string = "__VERSION__";
  public static readonly clientName: string = "teamrun-cli";
  public static readonly dataDirectorySegments: readonly string[] = [".noldova", "teamrun"];
  public static readonly liveCheckDirectoryPrefix: string = "teamrun-live-";
  public static readonly liveCheckProjectDirectoryName: string = "project";
  public static readonly liveCheckReadme: string = "README.md";
  public static readonly liveCheckReadmeText: string = "# Live check fixture\n\nA disposable project created by the TeamRun command-line client.\n";
  public static readonly liveCheckPrompt: string = "Reply with the single word PONG and do nothing else.";
  public static readonly liveCheckConversationTitle: string = "Live check";
  public static readonly defaultIdleGrace: number = 30_000;
  public static readonly chatPrompt: string = "> ";
  public static readonly approvalPrompt: string = "Decision (option id): ";
  public static readonly lineSeparator: string = "\n";
  public static readonly fieldSeparator: string = "  ";
  public static readonly listSeparator: string = ", ";
  public static readonly optionPrefix: string = "--";
  public static readonly jsonIndent: number = 2;
  public static readonly utf8Encoding: BufferEncoding = "utf8";
  public static readonly interruptSignal: NodeJS.Signals = "SIGINT";
  public static readonly lineEvent: string = "line";
  public static readonly closeEvent: string = "close";
  public static readonly exitSuccess: number = 0;
  public static readonly exitFailure: number = 1;
  public static readonly exitUsage: number = 2;

  public static readonly dataDirectoryOption: string = "data-dir";
  public static readonly jsonOption: string = "json";
  public static readonly idleGraceOption: string = "idle-grace";
  public static readonly runtimeProvidersOption: string = "runtime-providers";
  public static readonly providerOption: string = "provider";
  public static readonly modelOption: string = "model";
  public static readonly effortOption: string = "effort";
  public static readonly accountOption: string = "account";
  public static readonly approveOption: string = "approve";
  public static readonly denyOption: string = "deny";
  public static readonly restoreFilesOption: string = "restore-files";
  public static readonly messageIdArgument: string = "messageId";
  public static readonly limitOption: string = "limit";
  public static readonly defaultSearchLimit: number = 20;
  public static readonly promptOption: string = "prompt";
  public static readonly evidenceOption: string = "evidence";
  public static readonly afterOption: string = "after";
  public static readonly beforeOption: string = "before";
  public static readonly defaultPageSize: number = 50;
  public static readonly titleOption: string = "title";
  public static readonly idArgument: string = "id";
  public static readonly labelArgument: string = "label";
  public static readonly profileDirArgument: string = "profileDir";
  public static readonly pathArgument: string = "path";
  public static readonly projectIdArgument: string = "projectId";
  public static readonly conversationIdArgument: string = "conversationId";
  public static readonly approvalIdArgument: string = "approvalId";
  public static readonly optionIdArgument: string = "optionId";
  public static readonly textArgument: string = "text";
  public static readonly itemsField: string = "items";
  public static readonly projectPathField: string = "projectPath";
  public static readonly replyField: string = "reply";
  public static readonly detailCountField: string = "detailCount";
  public static readonly decisionsField: string = "decisions";
  public static readonly durationField: string = "durationMs";
  public static readonly commandParameterName: string = "command";

  public static readonly helpCommand: string = "help";
  public static readonly statusCommand: string = "status";
  public static readonly providersCommand: string = "providers";
  public static readonly modelsCommand: string = "models";
  public static readonly accountsCommand: string = "accounts";
  public static readonly accountAddCommand: string = "account-add";
  public static readonly accountCheckCommand: string = "account-check";
  public static readonly accountRemoveCommand: string = "account-remove";
  public static readonly projectsCommand: string = "projects";
  public static readonly projectOpenCommand: string = "project-open";
  public static readonly projectForgetCommand: string = "project-forget";
  public static readonly conversationsCommand: string = "conversations";
  public static readonly conversationNewCommand: string = "conversation-new";
  public static readonly conversationRenameCommand: string = "conversation-rename";
  public static readonly conversationMoveCommand: string = "conversation-move";
  public static readonly conversationDeleteCommand: string = "conversation-delete";
  public static readonly rewindCommand: string = "rewind";
  public static readonly searchCommand: string = "search";
  public static readonly messagesCommand: string = "messages";
  public static readonly sendCommand: string = "send";
  public static readonly chatCommand: string = "chat";
  public static readonly cancelCommand: string = "cancel";
  public static readonly approvalsCommand: string = "approvals";
  public static readonly approveCommand: string = "approve";
  public static readonly liveCheckCommand: string = "live-check";

  public static readonly runtimeProvidersArgument: string = "--providers";

  public static readonly usageHeading: string = "Usage: teamrun <command> [arguments] [--data-dir <path>] [--json]";
  public static readonly commandsHeading: string = "Commands:";
  public static readonly noRuntime: string = "No runtime is running for this data directory.";
  public static readonly noOpenReply: string = "The conversation has no open reply.";
  public static readonly emptyList: string = "(none)";
  public static readonly chatWelcome: string = "Type a message and press Enter; an empty line or Ctrl+C ends the chat.";
  public static readonly cancelRequested: string = "Cancelling the reply...";
  public static readonly approvalHeading: string = "Approval requested:";

  public static readonly helpDescription: string = "Shows this help.";
  public static readonly statusDescription: string = "Shows the running runtime of the data directory.";
  public static readonly providersDescription: string = "Lists the providers.";
  public static readonly modelsDescription: string = "models <provider> [--account <id>]: lists a provider's models.";
  public static readonly accountsDescription: string = "Lists the provider accounts.";
  public static readonly accountAddDescription: string = "account-add <provider> <label> <profileDir>: adds a provider account.";
  public static readonly accountCheckDescription: string = "account-check <id>: checks an account's sign-in.";
  public static readonly accountRemoveDescription: string = "account-remove <id>: removes an account.";
  public static readonly projectsDescription: string = "Lists the projects.";
  public static readonly projectOpenDescription: string = "project-open <path>: opens or registers a project.";
  public static readonly projectForgetDescription: string = "project-forget <id>: forgets a project.";
  public static readonly conversationsDescription: string = "conversations <projectId>: lists a project's conversations.";
  public static readonly conversationNewDescription: string = "conversation-new <projectId> [--title <title>]: starts a conversation.";
  public static readonly conversationRenameDescription: string = "conversation-rename <id> <title>: renames a conversation.";
  public static readonly conversationDeleteDescription: string = "conversation-delete <id>: deletes a conversation.";
  public static readonly conversationMoveDescription: string = "conversation-move <id> <projectId>: moves a conversation to another project.";
  public static readonly searchDescription: string = "search <text> [--limit <n>]: finds conversations whose title or messages contain the text.";
  public static readonly rewindDescription: string = "rewind <conversationId> <messageId> [--restore-files]: removes a message and what follows; the provider's session forks there when it can, else restarts.";
  public static readonly messagesDescription: string = "messages <conversationId> [--after <sequence>] [--before <sequence>] [--limit <count>]: lists messages, or a page of them.";
  public static readonly sendDescription: string = "send <conversationId> <text> [--as <name>|--provider <id>] [--model <m>] [--effort <e>] [--account <id>] [--approve|--deny]: "
    + "follows all replies; @mentions override --as; named teammates use their saved settings.";
  public static readonly chatDescription: string = "chat <conversationId> [--as <name>|--provider <id>] [--model <m>] [--effort <e>] [--account <id>]: "
    + "chats interactively; @mentions select named responders.";
  public static readonly cancelDescription: string = "cancel <conversationId>: cancels the open reply.";
  public static readonly approvalsDescription: string = "approvals <conversationId>: lists approvals.";
  public static readonly approveDescription: string = "approve <approvalId> <optionId>: decides an approval.";
  public static readonly liveCheckDescription: string = "live-check --provider <id> [--prompt <text>] [--evidence <file>]: runs one turn end to end in a disposable project.";

  public static formatDuplicateCommand(command: string): string {
    return `The command "${command}" is registered twice.`;
  }

  public static formatUnknownCommand(command: string): string {
    return `Unknown command "${command}". Run "teamrun help" for the list.`;
  }

  public static formatMissingArgument(name: string): string {
    return `The argument <${name}> is required.`;
  }

  public static formatMissingOption(name: string): string {
    return `The option --${name} is required.`;
  }

  public static formatFailure(name: string, message: string): string {
    return `Error (${name}): ${message}`;
  }

  public static formatUnsupportedApprovalOutcome(outcome: string): string {
    return `This approval cannot be ${outcome.toLowerCase()}.`;
  }

  public static formatFixtureKept(path: string, message: string): string {
    return `The fixture ${path} could not be removed and was left in place: ${message}`;
  }

  public static formatConnectionFailure(message: string): string {
    return `Could not reach the runtime: ${message}`;
  }

  public static formatRuntimeStatus(processId: number, endpoint: string, productVersion: string, protocolVersion: string, startedAt: string): string {
    return `Runtime process ${processId} at ${endpoint}, product ${productVersion}, protocol ${protocolVersion}, since ${startedAt}`;
  }

  public static formatCommandHelp(name: string, description: string): string {
    return `  ${name.padEnd(20)} ${description}`;
  }

  public static formatDetail(kind: string, text: string): string {
    return `[${kind}] ${text}`;
  }

  public static formatStatus(status: string): string {
    return `-- reply ${status}`;
  }

  public static formatApprovalOption(id: string, label: string): string {
    return `  ${id}: ${label}`;
  }

  public static formatDecided(optionId: string): string {
    return `-- decided ${optionId}`;
  }

  public static formatEvidenceWritten(path: string): string {
    return `Evidence written to ${path}`;
  }

  public static formatUnknownTeammate(name: string): string {
    return `No teammate named ${name}. Use teammates to list the available names.`;
  }

  public static formatSearchHit(conversationId: string, title: string, snippet: string): string {
    return [conversationId, title, snippet].join(Resources.fieldSeparator);
  }

  public static formatRewound(removed: number, restoredFiles: number | null, sessionKept: boolean): string {
    const messages = removed === 1 ? "1 message" : `${removed} messages`;
    const files = restoredFiles === null ? "no files restored" : restoredFiles === 1 ? "1 file restored" : `${restoredFiles} files restored`;
    const session = sessionKept ? "The provider's session continues from there." : "The next reply starts a fresh provider session.";
    return `Removed ${messages}; ${files}. ${session}`;
  }

}
