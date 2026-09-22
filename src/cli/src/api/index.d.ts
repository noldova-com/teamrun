/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventEmitter } from "node:events";

import type { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject, JsonReader, JsonValue } from "@noldova/teamrun-foundation-json";
import type { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import type { Teammate, ConversationMember } from "@noldova/teamrun-protocol";
import type { Approval, Conversation, Event, Message, MessageSendParams, Project, ProviderAccount, ProviderDescriptor } from "@noldova/teamrun-protocol";
import type { IRuntimeClientListener, RuntimeClient, RuntimeLock } from "@noldova/teamrun-runtime";

/**
 * How `send`, `chat`, and `live-check` answer the approvals a reply asks for.
 */
export declare enum DecisionPolicy {
  /**
   * Show the options and ask the user; an unknown answer chooses denial, or fails if no denying option exists.
   */
  Ask = "Ask",
  /**
   * Choose the first approving option, or fail if none exists.
   */
  Approve = "Approve",
  /**
   * Choose the first denying option, or fail if none exists.
   */
  Deny = "Deny",
}

/**
 * How results are printed.
 */
export declare enum OutputFormat {
  /**
   * One line per item.
   */
  Text = "Text",
  /**
   * The response payload as indented JSON.
   */
  Json = "Json",
}

/**
 * The runtime answered a request with a failure.
 */
export declare class CommandFailedException extends Exception {
  /**
   * The failure the runtime reported.
   */
  public readonly info: ServiceResponseInfo;

  /**
   * Initializes the exception with the message `Error (<name>): <message>`.
   * @param info The failure.
   */
  public constructor(info: ServiceResponseInfo);
}

/**
 * The command line misses an argument or an option.
 */
export declare class UsageException extends Exception {
  /**
   * Initializes the exception.
   * @param message What is missing.
   */
  public constructor(message: string);
}

/**
 * One command of the client.
 */
export interface ICommand {
  /**
   * The word that selects the command.
   */
  readonly name: string;
  /**
   * One line for the help.
   */
  readonly description: string;

  /**
   * Runs the command.
   * @param context The command line, settings, console, connections, and signals.
   * @returns The exit code.
   */
  run(context: CommandContext): Promise<number>;
}

/**
 * Reaches the runtime of the configured data directory.
 */
export interface IConnectionFactory {
  /**
   * Reads the lock of a live runtime without connecting.
   * @returns The lock, or `null`.
   */
  readLiveLock(): RuntimeLock | null;

  /**
   * Connects, starting a runtime when none is live.
   * @param listener Receives events and the disconnection.
   * @returns The connected client.
   */
  connect(listener: IRuntimeClientListener): Promise<RuntimeClient>;
}

/**
 * Builds the connection factory once the settings are known.
 */
export interface IConnectionFactoryBuilder {
  /**
   * Builds the factory.
   * @param settings The settings.
   * @returns The factory.
   */
  build(settings: CliSettings): IConnectionFactory;
}

/**
 * The terminal, or a scripted stand-in.
 */
export interface IConsole {
  /**
   * Writes a line to the output.
   * @param line The line.
   */
  write(line: string): void;

  /**
   * Writes a line to the error output.
   * @param line The line.
   */
  writeError(line: string): void;

  /**
   * Prints a prompt and reads a line.
   * @param prompt The prompt.
   * @param signal Cancels this question without consuming a later input line.
   * @returns The line, or `null` when input ended or the question was cancelled.
   */
  ask(prompt: string, signal?: AbortSignal): Promise<string | null>;
}

/**
 * Receives runtime events through a session.
 */
export interface IEventHandler {
  /**
   * Handles one event.
   * @param event The event.
   */
  handleEvent(event: Event): void;
}

/**
 * The global settings of one invocation.
 */
export declare class CliSettings {
  /**
   * The absolute data directory the runtime serves.
   */
  public readonly dataDirectory: string;
  /**
   * How results are printed.
   */
  public readonly format: OutputFormat;
  /**
   * The idle grace passed to a runtime the client starts.
   */
  public readonly idleGraceMilliseconds: number;
  /**
   * The `--providers` value passed to a runtime the client starts, or `null` for the default.
   */
  public readonly runtimeProviders: string | null;
  /**
   * The product version, stamped by the build.
   */
  public readonly productVersion: string;

  /**
   * Initializes the settings.
   * @param dataDirectory The data directory.
   * @param format The output format.
   * @param idleGraceMilliseconds The idle grace.
   * @param runtimeProviders The runtime providers value, or `null`.
   * @param productVersion The product version.
   * @throws ArgumentException when the directory or the version is blank.
   */
  public constructor(dataDirectory: string, format: OutputFormat, idleGraceMilliseconds: number, runtimeProviders: string | null, productVersion: string);

  /**
   * Reads the settings from the global options `--data-dir`, `--json`, `--idle-grace`, and
   * `--runtime-providers`; the data directory defaults to `.noldova/teamrun` in the home directory.
   * @param commandLine The command line.
   * @param homeDirectory The home directory.
   * @returns The settings.
   */
  public static fromCommandLine(commandLine: CommandLine, homeDirectory?: string): CliSettings;

  /**
   * Whether results are printed as JSON.
   */
  public get isJson(): boolean;

  /**
   * The extra arguments for a runtime the client starts.
   */
  public get runtimeArguments(): readonly string[];
}

/**
 * Everything a command needs.
 */
export declare class CommandContext {
  /**
   * The parsed command line.
   */
  public readonly commandLine: CommandLine;
  /**
   * The global settings.
   */
  public readonly settings: CliSettings;
  /**
   * The console.
   */
  public readonly console: IConsole;
  /**
   * Reaches the runtime.
   */
  public readonly connections: IConnectionFactory;
  /**
   * The emitter of process signals.
   */
  public readonly signals: EventEmitter;

  /**
   * Initializes the context.
   * @param commandLine The parsed command line.
   * @param settings The global settings.
   * @param console The console.
   * @param connections Reaches the runtime.
   * @param signals The emitter of process signals.
   */
  public constructor(commandLine: CommandLine, settings: CliSettings, console: IConsole, connections: IConnectionFactory, signals: EventEmitter);
}

/**
 * A parsed command line: the command word, its positional arguments, and `--name value` or
 * `--flag` options.
 */
export declare class CommandLine {
  /**
   * The command word, or `null` when none was given.
   */
  public readonly command: string | null;
  /**
   * The positional arguments after the command.
   */
  public readonly positionals: readonly string[];

  /**
   * Initializes the command line.
   * @param command The command word, or `null`.
   * @param positionals The positional arguments.
   * @param options The options; `true` marks a flag without a value.
   */
  public constructor(command: string | null, positionals: readonly string[], options: ReadonlyMap<string, string | true>);

  /**
   * Parses arguments: words are positionals, `--name` followed by a word is an option, `--name`
   * followed by another option or nothing is a flag.
   * @param args The arguments.
   * @returns The command line.
   */
  public static parse(args: readonly string[]): CommandLine;

  /**
   * Whether an option or flag was given.
   * @param name The option name without dashes.
   * @returns `true` when given.
   */
  public hasFlag(name: string): boolean;

  /**
   * Reads an option's value.
   * @param name The option name without dashes.
   * @returns The value, or `null` when absent or given as a flag.
   */
  public option(name: string): string | null;

  /**
   * Reads a required option's value.
   * @param name The option name without dashes.
   * @returns The value.
   * @throws UsageException when absent.
   */
  public requireOption(name: string): string;

  /**
   * Reads a positional argument.
   * @param index The position after the command.
   * @returns The argument, or `null`.
   */
  public positional(index: number): string | null;

  /**
   * Reads a required positional argument.
   * @param index The position after the command.
   * @param name The argument's name for the error.
   * @returns The argument.
   * @throws UsageException when absent.
   */
  public requirePositional(index: number, name: string): string;
}

/**
 * A handler registered with a session; disposing removes it.
 */
export declare class EventSubscription implements Disposable {
  /**
   * Initializes the subscription.
   * @param handlers The set holding the handler.
   * @param handler The handler.
   */
  public constructor(handlers: Set<IEventHandler>, handler: IEventHandler);

  /**
   * Whether the handler is still registered.
   */
  public get isActive(): boolean;

  /**
   * Removes the handler.
   */
  public [Symbol.dispose](): void;
}

/**
 * What a `live-check` run records.
 */
export declare class LiveCheckReport {
  /**
   * The provider.
   */
  public readonly provider: string;
  /**
   * The prompt sent.
   */
  public readonly prompt: string;
  /**
   * The disposable project directory.
   */
  public readonly projectPath: string;
  /**
   * How the reply ended.
   */
  public readonly outcomes: readonly ReplyOutcome[];
  /**
   * How long the run took.
   */
  public readonly durationMilliseconds: number;

  /**
   * Initializes the report.
   * @param provider The provider.
   * @param prompt The prompt.
   * @param projectPath The project directory.
   * @param outcomes How the replies ended.
   * @param durationMilliseconds How long the run took.
   */
  public constructor(provider: string, prompt: string, projectPath: string, outcomes: readonly ReplyOutcome[], durationMilliseconds: number);

  /**
   * Serializes the report.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * How a followed reply ended.
 */
export declare class ReplyOutcome {
  /**
   * The reply in its final state.
   */
  public readonly reply: Message;
  /**
   * How many details were printed while following.
   */
  public readonly detailCount: number;
  /**
   * The option ids chosen for the approvals, in order.
   */
  public readonly decisions: readonly string[];

  /**
   * Initializes the outcome.
   * @param reply The reply.
   * @param detailCount How many details were printed.
   * @param decisions The option ids chosen.
   */
  public constructor(reply: Message, detailCount: number, decisions: readonly string[]);
}

/**
 * The package's literals: names, options, descriptions, and messages.
 */
export declare class Resources {
  public static readonly mentionMarker: string;
  public static readonly repliesField: string;
  public static readonly abortEvent: string;
  public static readonly asOption: string;
  public static readonly namedSettingsUseTeammateUpdate: string;
  /**
   * Teammate CLI argument.
   */
  public static readonly teammateNameArgument: string;
  /**
   * Teammate CLI argument.
   */
  public static readonly teammateIdArgument: string;
  /**
   * Teammate CLI argument.
   */
  public static readonly roleOption: string;
  /**
   * Command name.
   */
  public static readonly teammatesCommand: string;
  /**
   * Command usage.
   */
  public static readonly teammatesDescription: string;
  /**
   * Command name.
   */
  public static readonly teammateNewCommand: string;
  /**
   * Command usage.
   */
  public static readonly teammateNewDescription: string;
  /**
   * Command name.
   */
  public static readonly teammateUpdateCommand: string;
  /**
   * Command usage.
   */
  public static readonly teammateUpdateDescription: string;
  /**
   * Command name.
   */
  public static readonly teammateDeleteCommand: string;
  /**
   * Command usage.
   */
  public static readonly teammateDeleteDescription: string;
  /**
   * Command name.
   */
  public static readonly membersCommand: string;
  /**
   * Command usage.
   */
  public static readonly membersDescription: string;
  /**
   * Command name.
   */
  public static readonly memberAddCommand: string;
  /**
   * Command usage.
   */
  public static readonly memberAddDescription: string;
  /**
   * Command name.
   */
  public static readonly memberRemoveCommand: string;
  /**
   * Command usage.
   */
  public static readonly memberRemoveDescription: string;
  public static readonly productVersion: string;
  public static readonly clientName: string;
  public static readonly dataDirectorySegments: readonly string[];
  public static readonly liveCheckDirectoryPrefix: string;
  public static readonly liveCheckProjectDirectoryName: string;
  public static readonly liveCheckReadme: string;
  public static readonly liveCheckReadmeText: string;
  public static readonly liveCheckPrompt: string;
  public static readonly liveCheckConversationTitle: string;
  public static readonly defaultIdleGrace: number;
  public static readonly chatPrompt: string;
  public static readonly approvalPrompt: string;
  public static readonly lineSeparator: string;
  public static readonly fieldSeparator: string;
  public static readonly listSeparator: string;
  public static readonly optionPrefix: string;
  public static readonly jsonIndent: number;
  public static readonly utf8Encoding: BufferEncoding;
  public static readonly interruptSignal: NodeJS.Signals;
  public static readonly lineEvent: string;
  public static readonly closeEvent: string;
  public static readonly exitSuccess: number;
  public static readonly exitFailure: number;
  public static readonly exitUsage: number;
  public static readonly dataDirectoryOption: string;
  public static readonly jsonOption: string;
  public static readonly idleGraceOption: string;
  public static readonly runtimeProvidersOption: string;
  public static readonly providerOption: string;
  public static readonly modelOption: string;
  public static readonly effortOption: string;
  public static readonly accountOption: string;
  public static readonly approveOption: string;
  public static readonly denyOption: string;
  public static readonly restoreFilesOption: string;
  public static readonly messageIdArgument: string;
  public static readonly limitOption: string;
  /**
   * How many hits `search` asks for without `--limit`: 20.
   */
  public static readonly defaultSearchLimit: number;
  public static readonly promptOption: string;
  public static readonly evidenceOption: string;
  public static readonly afterOption: string;
  public static readonly titleOption: string;
  public static readonly idArgument: string;
  public static readonly labelArgument: string;
  public static readonly profileDirArgument: string;
  public static readonly pathArgument: string;
  public static readonly projectIdArgument: string;
  public static readonly conversationIdArgument: string;
  public static readonly approvalIdArgument: string;
  public static readonly optionIdArgument: string;
  public static readonly textArgument: string;
  public static readonly itemsField: string;
  public static readonly projectPathField: string;
  public static readonly replyField: string;
  public static readonly detailCountField: string;
  public static readonly decisionsField: string;
  public static readonly durationField: string;
  public static readonly commandParameterName: string;
  public static readonly helpCommand: string;
  public static readonly statusCommand: string;
  public static readonly providersCommand: string;
  public static readonly modelsCommand: string;
  public static readonly accountsCommand: string;
  public static readonly accountAddCommand: string;
  public static readonly accountCheckCommand: string;
  public static readonly accountRemoveCommand: string;
  public static readonly projectsCommand: string;
  public static readonly projectOpenCommand: string;
  public static readonly projectForgetCommand: string;
  public static readonly conversationsCommand: string;
  public static readonly conversationNewCommand: string;
  public static readonly conversationRenameCommand: string;
  public static readonly conversationDeleteCommand: string;
  public static readonly rewindCommand: string;
  public static readonly searchCommand: string;
  public static readonly messagesCommand: string;
  public static readonly sendCommand: string;
  public static readonly chatCommand: string;
  public static readonly cancelCommand: string;
  public static readonly approvalsCommand: string;
  public static readonly approveCommand: string;
  public static readonly liveCheckCommand: string;
  public static readonly runtimeProvidersArgument: string;
  public static readonly usageHeading: string;
  public static readonly commandsHeading: string;
  public static readonly noRuntime: string;
  public static readonly noOpenReply: string;
  public static readonly emptyList: string;
  public static readonly chatWelcome: string;
  public static readonly cancelRequested: string;
  public static readonly approvalHeading: string;
  public static readonly helpDescription: string;
  public static readonly statusDescription: string;
  public static readonly providersDescription: string;
  public static readonly modelsDescription: string;
  public static readonly accountsDescription: string;
  public static readonly accountAddDescription: string;
  public static readonly accountCheckDescription: string;
  public static readonly accountRemoveDescription: string;
  public static readonly projectsDescription: string;
  public static readonly projectOpenDescription: string;
  public static readonly projectForgetDescription: string;
  public static readonly conversationsDescription: string;
  public static readonly conversationNewDescription: string;
  public static readonly conversationRenameDescription: string;
  public static readonly conversationDeleteDescription: string;
  public static readonly rewindDescription: string;
  public static readonly searchDescription: string;
  public static readonly messagesDescription: string;
  public static readonly sendDescription: string;
  public static readonly chatDescription: string;
  public static readonly cancelDescription: string;
  public static readonly approvalsDescription: string;
  public static readonly approveDescription: string;
  public static readonly liveCheckDescription: string;

  public static formatUnknownTeammate(name: string): string;

  /**
   * Formats the message for a command registered twice.
   * @param command The command name.
   * @returns The text.
   */
  public static formatDuplicateCommand(command: string): string;

  /**
   * Formats the message for an unknown command.
   * @param command The command word.
   * @returns The text.
   */
  public static formatUnknownCommand(command: string): string;

  /**
   * Formats the message for a missing positional argument.
   * @param name The argument's name.
   * @returns The text.
   */
  public static formatMissingArgument(name: string): string;

  /**
   * Formats the message for a missing option.
   * @param name The option's name.
   * @returns The text.
   */
  public static formatMissingOption(name: string): string;

  /**
   * Formats a runtime failure as `Error (<name>): <message>`.
   * @param name The failure's name.
   * @param message The failure's message.
   * @returns The text.
   */
  public static formatFailure(name: string, message: string): string;

  /**
   * Explains why the selected approval policy cannot be applied.
   * @param outcome The requested approval outcome, Approved or Denied.
   * @returns The refusal message; no different outcome is selected as a fallback.
   */
  public static formatUnsupportedApprovalOutcome(outcome: string): string;

  /**
   * Formats the message for a runtime that could not be reached.
   * @param message Why.
   * @returns The text.
   */
  public static formatConnectionFailure(message: string): string;

  /**
   * Formats the status line of a running runtime.
   * @param processId The process id.
   * @param endpoint The endpoint description.
   * @param productVersion The product version.
   * @param protocolVersion The protocol version.
   * @param startedAt When it started.
   * @returns The text.
   */
  public static formatRuntimeStatus(processId: number, endpoint: string, productVersion: string, protocolVersion: string, startedAt: string): string;

  /**
   * Formats one help line.
   * @param name The command name.
   * @param description The description.
   * @returns The text.
   */
  public static formatCommandHelp(name: string, description: string): string;

  /**
   * Formats a detail as `[<kind>] <text>`.
   * @param kind The detail kind.
   * @param text The detail text.
   * @returns The text.
   */
  public static formatDetail(kind: string, text: string): string;

  /**
   * Formats a reply status line.
   * @param status The status.
   * @returns The text.
   */
  public static formatStatus(status: string): string;

  /**
   * Formats one approval option line.
   * @param id The option id.
   * @param label The option label.
   * @returns The text.
   */
  public static formatApprovalOption(id: string, label: string): string;

  /**
   * Formats the line printed after a decision.
   * @param optionId The chosen option.
   * @returns The text.
   */
  public static formatDecided(optionId: string): string;

  /**
   * Formats the line printed after evidence was written.
   * @param path The file.
   * @returns The text.
   */
  public static formatEvidenceWritten(path: string): string;

  /**
   * Composes a search hit's line: the conversation id, its title, and the snippet.
   */
  public static formatSearchHit(conversationId: string, title: string, snippet: string): string;

  /**
   * Composes the line printed after a rewind: the count removed, the files restored, and whether the provider's session continues.
   */
  public static formatRewound(removed: number, restoredFiles: number | null, sessionKept: boolean): string;
}

/**
 * Parses the command line, selects the command, runs it, and turns failures into exit codes:
 * 2 for usage errors and unknown commands, 1 for runtime failures and unreachable runtimes.
 */
export declare class CliApplication {
  /**
   * Initializes the application.
   * @param registry The commands.
   * @param connections Builds the connection factory from the settings.
   */
  public constructor(registry: CommandRegistry, connections: IConnectionFactoryBuilder);

  /**
   * Runs one invocation; without a command word, `help` runs.
   * @param args The arguments after the script.
   * @param console The console.
   * @param signals The emitter of process signals.
   * @returns The exit code.
   */
  public run(args: readonly string[], console: IConsole, signals: EventEmitter): Promise<number>;
}

/**
 * The process entry of the client: the terminal console, the launcher-backed connections, and
 * the default commands.
 */
export declare class CliEntry {
  /**
   * The path of this module.
   */
  public static get entryPath(): string;

  /**
   * Runs the client on the process streams.
   * @param args The arguments after the script.
   * @returns The exit code.
   */
  public static run(args: readonly string[]): Promise<number>;
}

/**
 * The commands by name.
 */
export declare class CommandRegistry {
  /**
   * Creates the registry with every command of the client.
   * @returns The registry.
   */
  public static createDefault(): CommandRegistry;

  /**
   * Registers a command.
   * @param command The command.
   * @throws ArgumentException when its name is already registered.
   */
  public register(command: ICommand): void;

  /**
   * Finds a command.
   * @param name The command word.
   * @returns The command, or `null`.
   */
  public find(name: string): ICommand | null;

  /**
   * Returns the commands in registration order.
   * @returns The commands.
   */
  public all(): readonly ICommand[];
}

/**
 * A command that runs against a connected runtime session, closed afterwards.
 */
export declare abstract class RuntimeCommand implements ICommand {
  /**
   * Formats entities for the text output.
   */
  protected readonly formatter: EntityFormatter;

  public abstract readonly name: string;
  public abstract readonly description: string;

  /**
   * Opens a session, executes, and closes the session.
   * @param context The context.
   * @returns The exit code.
   */
  public run(context: CommandContext): Promise<number>;

  /**
   * Executes against the session.
   * @param session The session.
   * @param context The context.
   * @param output Prints results in the configured format.
   * @returns The exit code.
   */
  protected abstract execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `account-add <provider> <label> <profileDir>`.
 */
export declare class AccountAddCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `account-check <id>`.
 */
export declare class AccountCheckCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `account-remove <id>`.
 */
export declare class AccountRemoveCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `accounts`.
 */
export declare class AccountsCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `approvals <conversationId>`.
 */
export declare class ApprovalsCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `approve <approvalId> <optionId>`.
 */
export declare class ApproveCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `cancel <conversationId>`: cancels the conversation's open reply; exit 1 when there is none.
 */
export declare class CancelCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `chat <conversationId> --provider <id> ...`: reads messages from the console until an empty
 * line or the end of input, follows each reply, asks for approvals, and cancels the open reply on
 * `SIGINT`.
 */
export declare class ChatCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `conversation-delete <id>`.
 */
export declare class ConversationDeleteCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `rewind <conversationId> <messageId> [--restore-files]`: removes a message and everything after it, marks the
 * conversation for a fresh provider session, and optionally restores the project's files.
 */
export declare class RewindCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `search <text> [--limit <n>]`: finds the conversations whose title or messages contain the text; prints one line per
 * hit (the conversation id, its title, the title or the matching snippet), 20 hits at most unless told otherwise.
 */
export declare class SearchCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `conversation-new <projectId> [--title <title>]`.
 */
export declare class ConversationNewCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `conversation-move <id> <projectId>`.
 */
export declare class ConversationMoveCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `conversation-rename <id> <title>`.
 */
export declare class ConversationRenameCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `conversations <projectId>`.
 */
export declare class ConversationsCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `help`: prints the usage and every command.
 */
export declare class HelpCommand implements ICommand {
  public readonly name: string;
  public readonly description: string;

  /**
   * Initializes the command.
   * @param registry The commands to list.
   */
  public constructor(registry: CommandRegistry);

  public run(context: CommandContext): Promise<number>;
}

/**
 * `live-check --provider <id> [--prompt <text>] [--evidence <file>]`: opens a disposable project,
 * starts a conversation, sends the prompt denying every approval, follows the reply, deletes the
 * conversation, forgets the project, and optionally writes a `LiveCheckReport`; exit 0 only when
 * the reply completed.
 */
export declare class LiveCheckCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `messages <conversationId> [--after <sequence>]`.
 */
export declare class MessagesCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `models <provider> [--account <id>]`.
 */
export declare class ModelsCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `project-forget <id>`.
 */
export declare class ProjectForgetCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `project-open <path>`: the path is resolved to an absolute one.
 */
export declare class ProjectOpenCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `projects`.
 */
export declare class ProjectsCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `providers`.
 */
export declare class ProvidersCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * Sends a message and follows all replies. Mentions override `--as`; named responders use their
 * saved settings. Exit 0 means all replies completed, including an accepted send with no available responders.
 */
export declare class SendCommand extends RuntimeCommand {
  public readonly name: string;
  public readonly description: string;

  /**
   * Sends a message and follows every reply with the policy; SIGINT cancels the group.
   * @param session The session.
   * @param context The console, signal source and output settings.
   * @param params The resolved message request.
   * @param policy How approvals are answered.
   * @returns How the replies ended, in responder order.
   */
  public static sendAndFollow(session: RuntimeSession, context: CommandContext, params: MessageSendParams, policy: DecisionPolicy): Promise<readonly ReplyOutcome[]>;

  /**
   * Whether the follower prints as it goes: only for text output.
   * @param context The context.
   * @returns `true` for text output.
   */
  public static echoes(context: CommandContext): boolean;

  /**
   * Resolves mentions and `--as`, or reads the unnamed responder's provider settings.
   * @param session The runtime used to resolve teammate names.
   * @param context The context.
   * @param conversationId The conversation.
   * @param text The message.
   * @returns The resolved parameters.
   * @throws UsageException for an unknown selected name, named per-send setting overrides, or a missing default provider.
   */
  public static createParams(session: RuntimeSession, context: CommandContext, conversationId: string, text: string): Promise<MessageSendParams>;

  /**
   * Reads the decision policy from `--approve` and `--deny`; neither means `Ask`.
   * @param context The context.
   * @returns The policy.
   */
  public static readPolicy(context: CommandContext): DecisionPolicy;

  protected execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * `status`: prints live runtime metadata without its capability token, or a notice with exit 1 when none runs.
 */
export declare class StatusCommand implements ICommand {
  public readonly name: string;
  public readonly description: string;

  public run(context: CommandContext): Promise<number>;
}

/**
 * The console over the process streams: buffered line input for `ask`, `null` after the input
 * ends.
 */
export declare class TerminalConsole implements IConsole, Disposable {
  /**
   * Initializes the console.
   * @param input The input stream.
   * @param output The output stream.
   * @param errors The error stream.
   */
  public constructor(input: NodeJS.ReadableStream, output: NodeJS.WritableStream, errors: NodeJS.WritableStream);

  public write(line: string): void;

  public writeError(line: string): void;

  public ask(prompt: string, signal?: AbortSignal): Promise<string | null>;

  /**
   * Closes the input reader.
   */
  public [Symbol.dispose](): void;
}

/**
 * One-line text renderings of the protocol's entities.
 */
export declare class EntityFormatter {
  /**
   * Formats a participant's identity, account, harness, model and effort.
   */
  public formatTeammate(teammate: Teammate): string;

  /**
   * Formats a membership without resolving mutable participant names.
   */
  public formatMember(member: ConversationMember): string;

  /**
   * Formats a provider: id, display name, effort levels.
   * @param provider The provider.
   * @returns The line.
   */
  public formatProvider(provider: ProviderDescriptor): string;

  /**
   * Formats an account: id, provider, label, auth status, email, profile directory.
   * @param account The account.
   * @returns The line.
   */
  public formatAccount(account: ProviderAccount): string;

  /**
   * Formats a project: id, name, root path.
   * @param project The project.
   * @returns The line.
   */
  public formatProject(project: Project): string;

  /**
   * Formats a conversation: id, title, update time.
   * @param conversation The conversation.
   * @returns The line.
   */
  public formatConversation(conversation: Conversation): string;

  /**
   * Formats a message: sequence, author, status, id, then one line per detail.
   * @param message The message.
   * @returns The lines.
   */
  public formatMessage(message: Message): string;

  /**
   * Formats an approval: id, status, kind, summary, decision.
   * @param approval The approval.
   * @returns The line.
   */
  public formatApproval(approval: Approval): string;
}

/**
 * `IConnectionFactory` over the runtime launcher of the settings' data directory.
 */
export declare class LauncherConnectionFactory implements IConnectionFactory {
  /**
   * Initializes the factory.
   * @param settings The settings.
   * @param platform The platform, as `process.platform`.
   * @param executablePath The Node executable that runs the runtime entry.
   */
  public constructor(settings: CliSettings, platform: string, executablePath: string);

  public readLiveLock(): RuntimeLock | null;

  public connect(listener: IRuntimeClientListener): Promise<RuntimeClient>;
}

/**
 * Builds `LauncherConnectionFactory` instances.
 */
export declare class LauncherConnectionFactoryBuilder implements IConnectionFactoryBuilder {
  /**
   * Initializes the builder.
   * @param platform The platform, as `process.platform`.
   * @param executablePath The Node executable that runs the runtime entry.
   */
  public constructor(platform: string, executablePath: string);

  public build(settings: CliSettings): IConnectionFactory;
}

/**
 * Prints results as text lines or as JSON.
 */
export declare class OutputWriter {
  /**
   * Initializes the writer.
   * @param console The console.
   * @param json Whether to print JSON.
   */
  public constructor(console: IConsole, json: boolean);

  /**
   * Prints an array payload of objects, one formatted line each, or `(none)`.
   * @param payload The array.
   * @param format Formats one item.
   */
  public writeObjects(payload: JsonValue, format: (item: JsonReader) => string): void;

  /**
   * Prints an array payload of strings, one per line, or `(none)`.
   * @param payload The array.
   */
  public writeStrings(payload: JsonValue): void;

  /**
   * Prints an object payload as one formatted line.
   * @param payload The object.
   * @param format Formats the object.
   */
  public writeObject(payload: JsonValue, format: (item: JsonReader) => string): void;

  /**
   * Prints a text, or the payload when printing JSON.
   * @param text The text.
   * @param payload The payload.
   */
  public writeText(text: string, payload: JsonValue): void;

  /**
   * Prints the payload when printing JSON, nothing otherwise.
   * @param payload The payload.
   */
  public writeJsonOnly(payload: JsonValue): void;
}

/**
 * Follows a send's replies and buffers events received before the send result.
 */
export declare class RepliesFollower implements IEventHandler {
  /**
   * Creates the group follower with the existing per-reply approval policy.
   */
  public constructor(session: RuntimeSession, console: IConsole, policy: DecisionPolicy, echo: boolean);

  /**
   * Resolves in responder order, immediately for an empty reply list.
   */
  public follow(replies: readonly Message[]): Promise<readonly ReplyOutcome[]>;

  /**
   * Routes events to the matching reply.
   */
  public handleEvent(event: Event): void;
}

/**
 * Follows one reply, answers approvals, and closes pending approval input when the reply ends.
 */
export declare class ReplyFollower implements IEventHandler {
  /**
   * Initializes the follower; subscribe it before sending so no event is lost.
   * @param session The session.
   * @param console The console.
   * @param policy How approvals are answered.
   * @param echo Whether details, statuses, and decisions are printed; approval prompts always are.
   */
  public constructor(session: RuntimeSession, console: IConsole, policy: DecisionPolicy, echo: boolean);

  /**
   * Names the reply and replays the events buffered before the name was known.
   * @param replyId The reply's message id.
   * @returns How the reply ended.
   */
  public follow(replyId: string): Promise<ReplyOutcome>;

  public handleEvent(event: Event): void;
}

/**
 * A connected runtime client whose failed responses become `CommandFailedException`.
 */
export declare class RuntimeSession implements Disposable {
  /**
   * Connects through the factory.
   * @param connections The factory.
   * @returns The session.
   */
  public static open(connections: IConnectionFactory): Promise<RuntimeSession>;

  /**
   * Whether the connection is still open.
   */
  public get isConnected(): boolean;

  /**
   * Sends a request and returns the successful payload.
   * @param method The method.
   * @param payload The parameters.
   * @returns The payload.
   * @throws CommandFailedException when the runtime answered with a failure.
   */
  public call(method: string, payload: JsonValue): Promise<JsonValue>;

  /**
   * Subscribes a handler to the runtime's events.
   * @param handler The handler.
   * @returns The subscription.
   */
  public subscribe(handler: IEventHandler): EventSubscription;

  /**
   * Closes the connection.
   */
  public [Symbol.dispose](): void;
}

/**
 * The runtime client listener of a session: fans events out to handlers and records the
 * disconnection.
 */
export declare class SessionListener implements IRuntimeClientListener {
  /**
   * Whether the runtime disconnected.
   */
  public get isDisconnected(): boolean;

  /**
   * Subscribes a handler.
   * @param handler The handler.
   * @returns The subscription.
   */
  public subscribe(handler: IEventHandler): EventSubscription;

  public onEvent(event: Event): void;

  public onDisconnected(): void;
}

/**
 * teammates: lists named teammates.
 */
export declare class TeammatesCommand extends RuntimeCommand {
  /**
   * Command name.
   */
  public readonly name: string;
  /**
   * CLI usage and behavior.
   */
  public readonly description: string;

  /**
   * Executes the operation through the runtime session.
   */
  protected override execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * teammate-new <name> <accountId> [--model <model>] [--effort <effort>] [--role <text>]: creates a teammate.
 */
export declare class TeammateNewCommand extends RuntimeCommand {
  /**
   * Command name.
   */
  public readonly name: string;
  /**
   * CLI usage and behavior.
   */
  public readonly description: string;

  /**
   * Executes the operation through the runtime session.
   */
  protected override execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * teammate-update <id> <name> <accountId> [--model <model>] [--effort <effort>] [--role <text>]: replaces settings; omitted options reset.
 */
export declare class TeammateUpdateCommand extends RuntimeCommand {
  /**
   * Command name.
   */
  public readonly name: string;
  /**
   * CLI usage and behavior.
   */
  public readonly description: string;

  /**
   * Executes the operation through the runtime session.
   */
  protected override execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * teammate-delete <id>: deletes a teammate and its memberships, preserving messages.
 */
export declare class TeammateDeleteCommand extends RuntimeCommand {
  /**
   * Command name.
   */
  public readonly name: string;
  /**
   * CLI usage and behavior.
   */
  public readonly description: string;

  /**
   * Executes the operation through the runtime session.
   */
  protected override execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * members <conversationId>: lists named members in join order.
 */
export declare class MembersCommand extends RuntimeCommand {
  /**
   * Command name.
   */
  public readonly name: string;
  /**
   * CLI usage and behavior.
   */
  public readonly description: string;

  /**
   * Executes the operation through the runtime session.
   */
  protected override execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * member-add <conversationId> <teammateId>: adds a member if not already present.
 */
export declare class MemberAddCommand extends RuntimeCommand {
  /**
   * Command name.
   */
  public readonly name: string;
  /**
   * CLI usage and behavior.
   */
  public readonly description: string;

  /**
   * Executes the operation through the runtime session.
   */
  protected override execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}

/**
 * member-remove <conversationId> <teammateId>: removes a membership; rejoining starts a new session.
 */
export declare class MemberRemoveCommand extends RuntimeCommand {
  /**
   * Command name.
   */
  public readonly name: string;
  /**
   * CLI usage and behavior.
   */
  public readonly description: string;

  /**
   * Executes the operation through the runtime session.
   */
  protected override execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}
