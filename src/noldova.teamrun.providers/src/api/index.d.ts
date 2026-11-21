/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ChildProcess, SpawnOptions } from "node:child_process";
import type { EventEmitter } from "node:events";
import type { PassThrough, Readable, Writable } from "node:stream";

import type { AccountInfo, McpServerConfig, McpServerStatus, McpSetServersResult, Options, PermissionMode, PermissionResult, SDKMessage, SDKUserMessage }
  from "@anthropic-ai/claude-agent-sdk";
import type {
  ApprovalAsk,
  ForkRequest,
  ILog,
  IProviderAdapter,
  IProviderKindInstallation,
  IProviderTool,
  ISignInListener,
  ITimer,
  ITurnListener,
  PlanReading,
  ProfileSearch,
  ProviderKindVersions,
  SessionCarry,
  SharedMcpRefusal,
  SignInCheck,
  TurnDetail,
  TurnOutcome,
  TurnRequest,
  TurnResult,
  TurnSteer,
  TurnTools,
  TurnWake,
  WakeTurn
} from "@noldova/teamrun.core";
import type { Exception } from "@noldova/context.exceptions";
import type { JsonObject, JsonReader, JsonValue } from "@noldova/context.json";
import type { ContextUsage, DetailKind, ForkedSession, ObservedSettings, PlanStep, PlanStepStatus, PlanWindow, PlanWindowName, Provider, ProviderIdentity, ProviderKind, ProviderMode, ProviderModel, ProviderModelList, ProviderSpeed, ProviderTool, ReplyUsage, RequestedSettings, SharedMcpServerDefinition, SharedMcpTransport } from "@noldova/teamrun.protocol";
import type { AcpAgentListing, AcpLocalCommandAddParams, ApprovalQuestion, ProviderSignInCommand, QuestionAnswer, SharedMcpSecret } from "@noldova/teamrun.protocol";
import type { MessageAttachment, OwnMcpServer, ProviderAbilities } from "@noldova/teamrun.protocol";

/**
 * How a shell quotes its words and joins its commands.
 */
export declare enum ShellDialect {
  /**
   * Bash, zsh and sh: single quotes are literal, double quotes expand `$` and backticks, and a backslash escapes the next character.
   */
  Posix = "Posix",
  /**
   * PowerShell: single quotes are literal, with `''` for one quote, and double quotes expand `$` and backticks.
   */
  PowerShell = "PowerShell",
  /**
   * cmd: only double quotes group words, and `%` expands anywhere.
   */
  Cmd = "Cmd"
}

/**
 * What a piece of a shell script is, as {@link ShellTokenReader} splits it.
 */
export declare enum ShellTokenKind {
  /**
   * A word, with its quotes and escapes taken out.
   */
  Word = "Word",
  /**
   * What ends a command: `;`, `&&`, `||`, `|`, `&` or a line break, as the dialect has them.
   */
  Separator = "Separator",
  /**
   * A redirection, such as `>`, `>>`, `2>`'s `>`, `<` or `<<`; the word after it is its target.
   */
  Redirect = "Redirect",
  /**
   * The `(` that opens a group of commands, in POSIX shells and cmd.
   */
  Open = "Open",
  /**
   * The `)` that closes a group of commands.
   */
  Close = "Close"
}

/**
 * What a command does to files, as {@link WriteTargetReader} reads it.
 */
export declare enum WriteKind {
  /**
   * Writes no file, such as `cat`, `ls` or `Get-Content`.
   */
  Quiet = "Quiet",
  /**
   * Changes the folder the next commands run in: `cd` or `Set-Location`.
   */
  ChangeFolder = "ChangeFolder",
  /**
   * Changes the folder and keeps the one it left: `pushd` or `Push-Location`.
   */
  PushFolder = "PushFolder",
  /**
   * Goes back to the folder the last {@link PushFolder} kept.
   */
  PopFolder = "PopFolder",
  /**
   * Git: a reading command writes nothing, and any other may write in its repository.
   */
  Git = "Git",
  /**
   * Writes the files it names: `touch`, `tee`, `truncate`, `Out-File`, `Set-Content`, `Add-Content`, `Clear-Content` or `Tee-Object`.
   */
  Files = "Files",
  /**
   * Copies files to a destination: `cp`, `install`, `ln`, `Copy-Item` or cmd's `copy`.
   */
  Copy = "Copy",
  /**
   * Moves files to a destination, removing the sources: `mv`, `Move-Item` or cmd's `move`.
   */
  Move = "Move",
  /**
   * Removes the files it names: `rm`, `unlink`, `Remove-Item`, or cmd's `del` and `erase`.
   */
  Remove = "Remove",
  /**
   * Renames a file in its folder: `Rename-Item`, or cmd's `ren` and `rename`.
   */
  Rename = "Rename",
  /**
   * Creates a file or folder: `New-Item`.
   */
  NewItem = "NewItem",
  /**
   * `sed`: writes its files only with `-i`.
   */
  StreamEdit = "StreamEdit",
  /**
   * `dd`: writes its `of=` file.
   */
  DiskDump = "DiskDump",
  /**
   * `sort`: writes its `-o` file.
   */
  Sort = "Sort",
  /**
   * `curl`: writes its `-o` file, and a file it names itself with `-O`.
   */
  Download = "Download",
  /**
   * `wget`: writes its `-O` file, or a file it names itself.
   */
  Fetch = "Fetch",
  /**
   * `find`: writes or runs what it finds only with an action such as `-delete` or `-exec`.
   */
  Find = "Find"
}

/**
 * What a command a step ran does, as its title names it.
 */
export declare enum CommandKind {
  /**
   * Searches files for a pattern.
   */
  Search = "Search",
  /**
   * Reads whole files.
   */
  Read = "Read",
  /**
   * Reads the start of a file.
   */
  ReadStart = "ReadStart",
  /**
   * Reads the end of a file.
   */
  ReadEnd = "ReadEnd",
  /**
   * Lists a folder.
   */
  List = "List",
  /**
   * Changes the working folder.
   */
  ChangeFolder = "ChangeFolder",
  /**
   * Runs git.
   */
  Git = "Git"
}

/**
 * The flags a GNU-style search command takes, for reading its pattern and paths.
 */
export declare class CommandFlags {
  /**
   * The short flags that take no value.
   */
  public readonly letters: string;
  /**
   * The short flags that take a value, attached or as the next word.
   */
  public readonly valueLetters: string;
  /**
   * The short flag whose value is the pattern; null when there is none.
   */
  public readonly patternLetter: string | null;
  /**
   * The long flags that take no value.
   */
  public readonly names: readonly string[];
  /**
   * The long flags that take a value, after `=` or as the next word.
   */
  public readonly valueNames: readonly string[];
  /**
   * The long flag whose value is the pattern; null when there is none.
   */
  public readonly patternName: string | null;

  /**
   * Creates the flags.
   * @param letters The short flags that take no value.
   * @param valueLetters The short flags that take a value.
   * @param patternLetter The short flag whose value is the pattern, or null.
   * @param names The long flags that take no value.
   * @param valueNames The long flags that take a value.
   * @param patternName The long flag whose value is the pattern, or null.
   */
  public constructor(letters: string, valueLetters: string, patternLetter: string | null, names: readonly string[], valueNames: readonly string[],
    patternName: string | null);
}

/**
 * The parameters of a PowerShell cmdlet that a command title understands, in lower case.
 */
export declare class CmdletParameters {
  /**
   * The parameters that take no value.
   */
  public readonly switches: readonly string[];
  /**
   * The parameters that take the next word as their value.
   */
  public readonly values: readonly string[];

  /**
   * Creates the parameters.
   * @param switches The parameters that take no value.
   * @param values The parameters that take a value.
   */
  public constructor(switches: readonly string[], values: readonly string[]);
}

/**
 * A piece of a shell script.
 */
export declare class ShellToken {
  /**
   * What the piece is.
   */
  public readonly kind: ShellTokenKind;
  /**
   * The piece's text; for a word, without its quotes and escapes.
   */
  public readonly text: string;
  /**
   * Whether the word is the same whatever the shell expands: false when it holds a variable, a substitution, a glob or brace expansion.
   */
  public readonly isLiteral: boolean;
  /**
   * Whether any part of the word was quoted or escaped.
   */
  public readonly isQuoted: boolean;
  /**
   * Whether the shell runs code when it expands the word: a command, process or arithmetic substitution, or a PowerShell group, subexpression,
   * array, hashtable or script block; for a POSIX here-document's delimiter, a substitution in its body when the delimiter isn't quoted.
   */
  public readonly runsCommands: boolean;
  /**
   * A PowerShell comma list's items, each a word of its own; empty for any other word.
   */
  public readonly items: readonly ShellToken[];

  /**
   * Creates the piece.
   * @param kind What the piece is.
   * @param text The piece's text.
   * @param isLiteral Whether the word is the same whatever the shell expands; true by default.
   * @param isQuoted Whether any part of the word was quoted or escaped; false by default.
   * @param runsCommands Whether the word holds a substitution that runs commands; false by default.
   * @param items A PowerShell comma list's items; none by default.
   */
  public constructor(kind: ShellTokenKind, text: string, isLiteral?: boolean, isQuoted?: boolean, runsCommands?: boolean,
    items?: readonly ShellToken[]);

  /**
   * Creates a word.
   * @param text The word.
   * @param isLiteral Whether the word is the same whatever the shell expands; true by default.
   * @param isQuoted Whether any part of the word was quoted or escaped; false by default.
   * @param runsCommands Whether the word holds a substitution that runs commands; false by default.
   * @param items A PowerShell comma list's items; none by default.
   * @returns The word.
   */
  public static word(text: string, isLiteral?: boolean, isQuoted?: boolean, runsCommands?: boolean, items?: readonly ShellToken[]): ShellToken;
}

/**
 * The files a command names as written, and the folders where it may write files it doesn't name.
 */
export declare class WriteTargets {
  /**
   * The files the command names as written, created or removed, as it gives them: absolute, from the home folder (`~`), or relative to the folder
   * the command ran in.
   */
  public readonly files: readonly string[];
  /**
   * The folders, given like {@link files}, where the command ran a program or wrote a target this reader can't name; `.` is the folder it ran in.
   */
  public readonly unnamedIn: readonly string[];

  /**
   * Creates the targets.
   * @param files The files the command names as written.
   * @param unnamedIn The folders where it may write files it doesn't name.
   */
  public constructor(files: readonly string[], unnamedIn: readonly string[]);

  /**
   * Returns the payload fields of a command step that carry the targets.
   * @returns The `writes` and `unnamedWrites` fields.
   */
  public toJson(): JsonObject;
}

/**
 * How a JSON-RPC client's messages are delimited on the process's standard streams.
 */
export declare enum MessageFraming {
  /**
   * One JSON message per line, as ACP sends them.
   */
  Lines = "Lines",
  /**
   * Each message after a `Content-Length` header block, as the Copilot CLI's headless server sends them.
   */
  ContentLength = "ContentLength"
}

/**
 * Where an executable was found.
 */
export declare enum ExecutableSource {
  /**
   * An explicit path the user configured.
   */
  Override = "Override",
  /**
   * The native binary inside a global npm installation.
   */
  GlobalNpm = "GlobalNpm",
  /**
   * The user's `~/.local/bin` directory.
   */
  LocalBin = "LocalBin",
  /**
   * A directory on `PATH`.
   */
  Path = "Path",
  /**
   * A folder TeamRun installed the program into.
   */
  Managed = "Managed",
}

/**
 * The base of every exception the providers package throws, which its callers catch as one.
 */
export declare abstract class ProvidersException extends Exception {
  /**
   * Initializes the exception.
   * @param message What went wrong.
   * @param cause The error that caused it, if any.
   */
  protected constructor(message: string, cause?: unknown);
}

/**
 * An ACP agent can't start with its command, arguments or secrets.
 */
export declare class AgentLaunchException extends ProvidersException {
  /**
   * The exception's name, `"AgentLaunchException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * The connection to an ACP agent's process failed, or the agent sent what the client can't take.
 */
export declare class AcpConnectionException extends ProvidersException {
  /**
   * The exception's name, `"AcpConnectionException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * The ACP agent registry couldn't be reached or read, or one of its entries is invalid.
 */
export declare class AcpRegistryException extends ProvidersException {
  /**
   * The exception's name, `"AcpRegistryException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * A provider's file that TeamRun reads couldn't be read, is too large, or holds what TeamRun refuses.
 */
export declare class ConfigurationUnreadableException extends ProvidersException {
  /**
   * The exception's name, `"ConfigurationUnreadableException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * A chat can't be forked at the turn asked for.
 */
export declare class ForkUnavailableException extends ProvidersException {
  /**
   * The exception's name, `"ForkUnavailableException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * A provider's install was cancelled before it finished.
 */
export declare class InstallCancelledException extends ProvidersException {
  /**
   * The exception's name, `"InstallCancelledException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * A step of a provider's install failed, so the provider isn't installed or updated.
 */
export declare class InstallFailedException extends ProvidersException {
  /**
   * The exception's name, `"InstallFailedException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * A provider's profile folder holds what TeamRun didn't make, so TeamRun leaves it alone.
 */
export declare class ProfileFolderException extends ProvidersException {
  /**
   * The exception's name, `"ProfileFolderException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * A provider's process stopped, shut down or was replaced while TeamRun used it.
 */
export declare class ProviderStoppedException extends ProvidersException {
  /**
   * The exception's name, `"ProviderStoppedException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * A provider's release channel or download couldn't be reached or read, or what it sent failed its checks.
 */
export declare class ReleaseSourceException extends ProvidersException {
  /**
   * The exception's name, `"ReleaseSourceException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * Signing in to a provider is needed, unavailable, cancelled or failed.
 */
export declare class SignInException extends ProvidersException {
  /**
   * The exception's name, `"SignInException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * Signing out of a provider is unsupported, under way, or failed.
 */
export declare class SignOutException extends ProvidersException {
  /**
   * The exception's name, `"SignOutException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * A provider's background task isn't listed, or its process is unknown or gone.
 */
export declare class TaskException extends ProvidersException {
  /**
   * The exception's name, `"TaskException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * A provider can't give its chat TeamRun's tools or the person's own MCP servers.
 */
export declare class ToolsUnavailableException extends ProvidersException {
  /**
   * The exception's name, `"ToolsUnavailableException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * The installed provider's version doesn't support what TeamRun needs.
 */
export declare class UnsupportedVersionException extends ProvidersException {
  /**
   * The exception's name, `"UnsupportedVersionException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * A provider's model list couldn't be loaded or read, or doesn't hold a valid name for the model asked for.
 */
export declare class ModelListException extends ProvidersException {
  /**
   * The exception's name, `"ModelListException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * A provider refused the prompt and said why.
 */
export declare class ProviderRefusedException extends ProvidersException {
  /**
   * The exception's name, `"ProviderRefusedException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * The effort or permission mode asked for isn't one the provider offers, or isn't allowed.
 */
export declare class SettingUnavailableException extends ProvidersException {
  /**
   * The exception's name, `"SettingUnavailableException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What went wrong, for the person.
   * @param cause The error that caused it, if any.
   */
  public constructor(message: string, cause?: unknown);
}

/**
 * A JSON-RPC error answered by the Codex app-server.
 */
export declare class AppServerException extends ProvidersException {
  /**
   * The exception's name, `"AppServerException"`, which the class sets itself so
   * that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * The method whose request failed.
   */
  public readonly method: string;
  /**
   * The error the server returned.
   */
  public readonly error: JsonRpcError;

  /**
   * Initializes the exception with the message `<method>: <message> (code <code>)`.
   * @param method The method whose request failed.
   * @param error The error the server returned.
   */
  public constructor(method: string, error: JsonRpcError);
}

/**
 * An ACP agent answered a request with a JSON-RPC error.
 */
export declare class AcpRequestException extends ProvidersException {
  /**
   * The exception's name, `"AcpRequestException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * The error's code, such as `-32000` for authentication required, or `null` when the answer had none.
   */
  public readonly code: number | null;

  /**
   * The error's `data`, or `null` when the answer had none.
   */
  public readonly data: JsonValue | null;

  /**
   * Initializes the exception.
   * @param message The error's message.
   * @param code The error's code, or `null`.
   * @param data The error's `data`, such as the details of Copilot's "Internal error", or `null` when it had none.
   */
  public constructor(message: string, code: number | null, data?: JsonValue | null);
}

/**
 * Pi is not running, did not answer in time, refused a command, or exited.
 */
export declare class PiRpcException extends ProvidersException {
  /**
   * The exception's name, `"PiRpcException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What happened.
   */
  public constructor(message: string);
}

/**
 * The Codex app-server is not running, did not answer in time, or exited.
 */
export declare class AppServerUnavailableException extends ProvidersException {
  /**
   * The exception's name, `"AppServerUnavailableException"`, which the class sets itself so
   * that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message What happened.
   */
  public constructor(message: string);
}

/**
 * A provider executable was not found on this machine.
 */
export declare class ExecutableNotFoundException extends ProvidersException {
  /**
   * The exception's name, `"ExecutableNotFoundException"`, which the class sets itself so
   * that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message Which executable is missing and how to install it.
   */
  public constructor(message: string);
}

/**
 * A rename an install retried on Windows was still refused when `InstallRename` ran out of tries, as while something such as a virus scanner holds a file
 * just run.
 */
export declare class InstallHeldException extends ProvidersException {
  /**
   * The exception's name, `"InstallHeldException"`, which the class sets itself so that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * The refused rename's file-system code, such as `EPERM`.
   */
  public readonly code: string;

  /**
   * Initializes the exception.
   * @param message The refused rename's message.
   * @param code The refused rename's code.
   * @param cause The refused rename's error.
   */
  public constructor(message: string, code: string, cause: unknown);
}

/**
 * An operation was requested in a state that does not allow it.
 */
export declare class ModelUnavailableException extends ProvidersException {
  /**
   * The exception's name, `"ModelUnavailableException"`, which the class sets itself so
   * that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception, which an adapter raises when the provider doesn't offer the turn's model; the turn then fails
   * offering `ReplyAction.ChooseModel`.
   * @param message The failure, from `Resources.formatModelUnavailable`.
   */
  public constructor(message: string);
}

export declare class InvalidOperationException extends ProvidersException {
  /**
   * The exception's name, `"InvalidOperationException"`, which the class sets itself so
   * that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * Initializes the exception.
   * @param message Why the operation is not allowed.
   */
  public constructor(message: string);
}

/**
 * A server-initiated request TeamRun does not answer; the provider treats the error as a decline.
 */
export declare class UnsupportedServerRequestException extends ProvidersException {
  /**
   * The exception's name, `"UnsupportedServerRequestException"`, which the class sets itself so
   * that it stays the same in a minified build.
   */
  public override readonly name: string;

  /**
   * The unsupported method.
   */
  public readonly method: string;

  /**
   * Initializes the exception.
   * @param method The unsupported method.
   */
  public constructor(method: string);
}

/**
 * One Claude Code session started through the Agent SDK: the message stream plus its controls.
 */
export interface IClaudeQuery extends AsyncIterable<SDKMessage> {
  /**
   * Asks Claude Code to stop the current turn.
   * @returns Resolves when the interrupt was delivered.
   */
  interrupt(): Promise<unknown>;

  /**
   * Reads the signed-in account's details as Claude Code reports them.
   * @returns The account details.
   */
  accountInfo(): Promise<AccountInfo>;

  /**
   * Asks Claude Code to stop one of its tasks, such as a backgrounded shell command.
   * @param taskId The task's id from its `task_started` message.
   * @returns Resolves when Claude Code accepted the stop; rejects with Claude Code's error when it refused.
   */
  stopTask(taskId: string): Promise<void>;

  /**
   * Merges settings into the open query's flag layer, as each later turn's sender token is set in the environment of the processes Claude Code
   * starts from then on.
   * @param settings The settings, such as `env`.
   */
  applyFlagSettings(settings: { env?: Record<string, string> }): Promise<void>;

  /**
   * Replaces the open query's dynamic MCP servers, which Claude Code receives over its standard input, never on its command line: the turn's
   * shared servers and TeamRun's endpoint with the chat's token as its `Authorization` header.
   * @param servers The servers by name.
   * @returns The servers added and removed, and any that failed to connect.
   */
  setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult>;

  /**
   * Reads the state of each MCP server the open query has, such as whether one connected, failed or needs a sign-in.
   * @returns Each server's name and state.
   */
  mcpServerStatus(): Promise<McpServerStatus[]>;

  /**
   * Changes the open session's permission mode, as a plan-first turn does once the person approves its plan.
   * @param mode The permission mode.
   */
  setPermissionMode(mode: PermissionMode): Promise<void>;

  /**
   * Reads model metadata without a user prompt.
   */
  supportedModels(): Promise<import("@anthropic-ai/claude-agent-sdk").ModelInfo[]>;

  /**
   * Reads the session's `/` commands from the Agent SDK's initialize response, without a user prompt, so a new chat's command is checked before
   * anything runs.
   */
  supportedCommands(): Promise<import("@anthropic-ai/claude-agent-sdk").SlashCommand[]>;

  /**
   * Reads the session's context use: its tokens, its window and where it compacts.
   * @param options `detail` "summary" leaves out the per-category breakdown.
   */
  getContextUsage(options?: { detail?: "summary" | "full" }): Promise<import("@anthropic-ai/claude-agent-sdk").SDKControlGetContextUsageResponse>;

  /**
   * Reads the session's settings; TeamRun reads only `applied.effort`, the level the session sends on its next request, which Claude Code's init
   * message names only on some hosts.
   */
  getSettings(): Promise<{ applied?: { effort?: unknown } }>;

  /**
   * Reads the provider's plan use; Claude Code marks it experimental, so TeamRun reads it through `ClaudeUsageReader` and leaves the figure blank
   * when its shape changes.
   * @param options `skipBehaviors` true reads the figures only.
   */
  usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET(options?: { skipBehaviors?: boolean }): Promise<import("@anthropic-ai/claude-agent-sdk").SDKControlGetUsageResponse>;

  /**
   * Ends the session and its process.
   */
  close(): void;
}

/**
 * Starts Claude Code sessions; the real factory wraps the Agent SDK, tests use a scripted one.
 */
export interface IClaudeQueryFactory {
  /**
   * Starts a session.
   * @param prompt The user's message.
   * @param options The Agent SDK options.
   * @param origin The kind and provider the session's process runs for.
   * @returns The session.
   */
  start(prompt: string | AsyncIterable<SDKUserMessage>, options: Options, origin: ProcessOrigin): IClaudeQuery;
}

/**
 * Receives the exit of a Codex app-server process.
 */
/**
 * Runs PowerShell scripts, one at a time, in a shell that stays open between them.
 */
export interface IPowershellSession {
  /**
   * Runs a script once the scripts before it have run.
   * @param script The script, on one line.
   * @param timeout How long the script may take, in milliseconds, from this call, its wait behind the scripts before it included; a script whose
   * time runs out while it waits fails without running.
   * @returns What the script wrote to standard output; it rejects with `TimeoutException` when the script runs out of time, and with an error when
   * the shell can't start or ends before the script has run.
   */
  run(script: string, timeout: number): Promise<string>;
}

/**
 * Starts a provider's program, so that its host decides how programs run and end.
 */
export interface IProcessStarter {
  /**
   * Starts the program; it reports its start, failure and exit through the returned process.
   * @param command How to run the program.
   * @param environment The program's environment.
   * @param directory The program's working directory, or `null` for the host's choice.
   * @returns The process, whose streams take and give data before the program has started.
   */
  start(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string | null): StartedProcess;

  /**
   * Reads the environment a provider's program builds its own from when it starts now, read again for each start so that a variable set
   * since TeamRun started reaches the next one, while a program already running keeps what it started with.
   * @param own The environment TeamRun itself started with, which a host without a current environment gives back.
   * @returns A promise of the environment, which never rejects.
   */
  readEnvironmentAsync(own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv>;
}

/**
 * What TeamRun's shared MCP launcher uses of its own process: its id and its parent's, its input, its errors, its exit, signals to other
 * processes, and the signals it hears. `process` is one.
 */
export interface ISharedMcpLauncherHost {
  /**
   * The process's id, by which a watch on Windows leaves itself out of what it ends.
   */
  readonly pid: number;

  /**
   * The id of the process that started it, by which a watch on Windows finds the server of a launcher killed before it could name it.
   */
  readonly ppid: number;

  /**
   * The launcher's input, read only by its watch.
   */
  readonly stdin: Readable;

  /**
   * Where the launcher writes why it refused its arguments or could not start the server.
   */
  readonly stderr: Writable;

  /**
   * Ends the launcher.
   * @param code The exit code.
   */
  exit(code: number): void;

  /**
   * Sends a signal to a process, or to a process group by its negative id, throwing when it can't.
   * @param processId The process or negative group id.
   * @param signal The signal.
   */
  kill(processId: number, signal: NodeJS.Signals): void;

  /**
   * Listens for a signal the launcher gets.
   * @param signal The signal.
   * @param listener Called with the signal.
   */
  on(signal: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): unknown;

  /**
   * Stops listening for a signal.
   * @param signal The signal.
   * @param listener The listener given to `on`.
   */
  off(signal: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): unknown;
}

/**
 * Reads and ends the operating system's process tree, for a background task a provider runs under its own process.
 */
export interface IProcessTree {
  /**
   * Ends a process and every process under it, once it has confirmed that the process is still the one TeamRun learned of: it started no later than
   * `startedBy`, and it runs under the ancestor, each parent along the way having started no later than its child, so a parent id the system has
   * since given to a later process doesn't count. Each process under it counts only through a parent that started no later than it.
   * @param processId The process.
   * @param startedBy The time, in milliseconds since the epoch, by which the process had started: when TeamRun learned its id.
   * @param ancestorId The process the tree must run under.
   * @returns `true` once it has ended the tree; `false`, ending nothing, when the process isn't that one any more or the processes can't be listed.
   */
  endTree(processId: number, startedBy: number, ancestorId: number): Promise<boolean>;

  /**
   * Ends a process TeamRun started and has not seen exit, and every process under it, as {@link endTree} ends a tree, confirming only that the
   * process started no later than `startedBy`, since a process TeamRun still holds keeps its id.
   * @param processId The process.
   * @param startedBy The time, in milliseconds since the epoch, by which the process had started.
   * @returns `true` once it has ended the tree; `false`, ending nothing, when the process isn't listed or the processes can't be listed.
   */
  endOwnTree(processId: number, startedBy: number): Promise<boolean>;

  /**
   * Ends every process under a running process, as {@link endTree} ends a tree, but leaves that process itself running. On Windows it does
   * nothing, since {@link endLeftovers} finds those processes through their parent ids once the process has exited, so a stop lists once there.
   * @param processId The running process whose descendants end; nothing ends when it isn't listed or the listing fails.
   */
  endDescendants(processId: number): Promise<void>;

  /**
   * Ends what a process that has exited left running. On Windows, every process listed under its id that started between `launched` and
   * `exited`, so not the child of a later process the system gave that id, and what those started, in rounds as {@link endTree} ends a tree.
   * Elsewhere, `SIGKILL` to every process of its process group, which it led since its command {@link ProcessCommand.ownsGroup}, whose start, as
   * `ps` tells it up to two seconds early, may be no earlier than `launched`, unless a process with its id is listed again; a group's id isn't
   * given to another process while the group has a process, so that includes what its processes started after it exited. It then waits, at most
   * the grace, until those have ended.
   * @param processId The process that exited.
   * @param launched A time no later than the process's start, in milliseconds since the epoch.
   * @param exited A time no earlier than the process's exit, in milliseconds since the epoch.
   */
  endLeftovers(processId: number, launched: number, exited: number): Promise<void>;
}

/**
 * Ends what a stop leaves running outside the process it stopped them through.
 */
export interface IOrphanSweep {
  /**
   * Runs a stop that may leave processes under a running process orphaned, and ends what it orphaned: it lists the process's tree and takes as its roots
   * the process's children whose environment names one of `threadIds` in `CODEX_THREAD_ID`, reading only that variable and keeping nothing else of it.
   * It runs the stop, then lists again every `processTreeGracePoll` until those roots are gone or the grace has passed.
   * It then ends, as `IProcessTree.endTree` ends a tree, the processes of the first listing that ran under a gone root, still have the same start
   * and no longer run under the process, so what another thread's child started is spared even when that child ends in the wait.
   * It only runs the stop when the first listing fails or doesn't list the process, when `isRunning` says the process is no longer the one asked about, or when no
   * child names one of the threads, it skips a later listing that fails, and it ends nothing when the process has gone or no later listing answers.
   * @param processId The running process, such as Codex's app-server.
   * @param isRunning Whether that process id is still the running process, so that a recycled id ends nothing.
   * @param threadIds The threads whose terminals the stop ends.
   * @param stop The stop; its rejection rejects the sweep, which then ends nothing.
   * @returns The ids of the processes it ended, those the stop left, without those they started since.
   */
  endOrphaned(processId: number, isRunning: () => boolean, threadIds: readonly string[], stop: () => Promise<void>): Promise<readonly number[]>;
}

/**
 * Reads the image a provider's own image tool saved, from a completed tool call or the provider's notification that names it.
 */
export interface ISavedImageReader {
  /**
   * Reads the image a completed tool call saved, or the one a provider's image notification names, only from where that provider saves images
   * for the session.
   * @param tool The tool call, merged from its updates, or the notification's parameters.
   * @param sessionId The native session the tool call ran in.
   * @param provider The provider the turn runs as; null for the default profile.
   * @param workingDirectory The chat's folder the turn runs in.
   * @returns The image, or null when the tool saved none or its file is not one the reader accepts.
   */
  read(tool: JsonReader, sessionId: string, provider: Provider | null, workingDirectory: string): SavedImage | null;

  /**
   * Reads why the provider's own image tool failed, from a failed tool call.
   * @param tool The tool call, merged from its updates.
   * @returns The provider's failure, empty when it gave none, or null when the tool call is not a failed image tool.
   */
  failureOf(tool: JsonReader): JsonObject | null;
}

export interface IExitHandler {
  /**
   * Handles the exit. The client runs exit handlers in order after the notifications that arrived before the exit.
   * @param exit How the process ended.
   * @returns A promise that resolves once the exit is handled.
   */
  handleExitAsync(exit: ProcessExit): Promise<void>;
}

/**
 * Receives notifications from a Codex app-server.
 */
export interface INotificationHandler {
  /**
   * Handles one notification. The client hands the next notification on only after this one's promise settles.
   * @param method The notification's method.
   * @param params The notification's parameters, an empty object when absent.
   * @returns A promise that resolves once the notification is handled.
   */
  handleNotificationAsync(method: string, params: JsonReader): Promise<void>;
}

/**
 * Answers requests the Codex app-server sends to its client, such as approvals.
 */
export interface IServerRequestHandler {
  /**
   * Answers one request.
   * @param method The request's method.
   * @param params The request's parameters, an empty object when absent.
   * @param signal Aborts when the server withdraws the request with `serverRequest/resolved`; the
   * client then sends no answer to it.
   * @returns The result to send back.
   * @throws UnsupportedServerRequestException when TeamRun does not answer the method; the
   * server receives an error response.
   */
  handleServerRequest(method: string, params: JsonReader, signal: AbortSignal): Promise<JsonValue>;
}

/**
 * How the client introduces itself to the Codex app-server.
 */
export declare class AppServerClientInfo {
  /**
   * The client's name, recorded by Codex.
   */
  public readonly name: string;
  /**
   * The client's display title.
   */
  public readonly title: string;
  /**
   * The client's version.
   */
  public readonly version: string;

  /**
   * Initializes the info.
   * @param name The client's name.
   * @param title The client's display title.
   * @param version The client's version.
   * @throws ArgumentException when a value is blank.
   */
  public constructor(name: string, title: string, version: string);

  /**
   * Serializes the info as the `clientInfo` parameter of `initialize`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * What the Codex app-server answered to `initialize`.
 */
export declare class AppServerInitialization {
  /**
   * The server's user agent, such as `codex-cli/0.153.4 (Windows)`.
   */
  public readonly userAgent: string;
  /**
   * The version parsed from the user agent, or `null` when it carries none.
   */
  public readonly version: string | null;

  /**
   * Initializes the result.
   * @param userAgent The server's user agent.
   * @throws ArgumentException when the user agent is blank.
   */
  public constructor(userAgent: string);

  /**
   * Reads the result from JSON.
   * @param value The JSON value.
   * @param path The value's path for error messages.
   * @returns The result.
   * @throws JsonException when the user agent is missing or blank.
   */
  public static fromJson(value: unknown, path?: string): AppServerInitialization;
}

/**
 * Text accumulated up to a maximum length; later chunks are dropped.
 */
export declare class BoundedOutput {
  /**
   * Initializes the output.
   * @param maximumLength The maximum number of characters kept.
   * @throws ArgumentOutOfRangeException when the maximum is not a positive integer.
   */
  public constructor(maximumLength: number);

  /**
   * Whether the maximum was reached.
   */
  public get isFull(): boolean;

  /**
   * Appends a chunk, keeping only what fits.
   * @param chunk The chunk.
   */
  public append(chunk: string): void;

  /**
   * Returns the accumulated text.
   * @returns The text.
   */
  public toString(): string;
}

/**
 * A running Claude Code session with the controls needed to stop it.
 */
export declare class ClaudeRun {
  /**
   * Initializes the run.
   * @param query The session.
   * @param abort The controller that ends the session's process.
   */
  public constructor(query: IClaudeQuery, abort: AbortController);

  /**
   * Interrupts the session, tolerating a session that no longer answers, then aborts it.
   */
  public stop(): Promise<void>;

  /**
   * Closes the session, tolerating one that already ended.
   */
  public close(): void;
}

/**
 * The account the Codex app-server reports through `account/read`.
 */
export declare class CodexAccount {
  /**
   * The provider type, such as `chatgpt` or `apiKey`.
   */
  public readonly type: string;
  /**
   * The email of a ChatGPT account, when reported.
   */
  public readonly email: string | null;
  /**
   * The plan of a ChatGPT account, when reported.
   */
  public readonly planType: string | null;

  /**
   * Initializes the provider.
   * @param type The provider type.
   * @param email The email, when reported.
   * @param planType The plan, when reported.
   */
  public constructor(type: string, email: string | null, planType: string | null);

  /**
   * Reads the `account/read` result; a plan of `unknown` reads as none.
   * @param value The JSON value.
   * @param path The value's path for error messages.
   * @returns The provider, or `null` when nobody is signed in.
   * @throws JsonException when the result has no `account` field.
   */
  public static fromJson(value: unknown, path?: string): CodexAccount | null;

  /**
   * Converts the provider to the protocol's identity, with the type as the auth method.
   * @returns The identity.
   */
  public toIdentity(): ProviderIdentity;
}

/**
 * How a command run to completion ended.
 */
export declare class CommandResult {
  /**
   * The exit code, or `null` when a signal ended the process.
   */
  public readonly exitCode: number | null;
  /**
   * The signal that ended the process, or `null`.
   */
  public readonly signal: string | null;
  /**
   * The captured standard output, bounded.
   */
  public readonly stdout: string;
  /**
   * The captured standard error, bounded.
   */
  public readonly stderr: string;
  /**
   * Whether the command was terminated because it exceeded its timeout.
   */
  public readonly timedOut: boolean;

  /**
   * Initializes the result.
   * @param exitCode The exit code, or `null`.
   * @param signal The signal, or `null`.
   * @param stdout The standard output.
   * @param stderr The standard error.
   * @param timedOut Whether the command timed out.
   */
  public constructor(exitCode: number | null, signal: string | null, stdout: string, stderr: string, timedOut: boolean);

  /**
   * Whether the command exited with code zero without timing out.
   */
  public get succeeded(): boolean;

  /**
   * The trimmed standard output, or the trimmed standard error when the output is blank.
   */
  public get output(): string;
}

/**
 * A handler registered in a set, or as a map's key; disposing removes it.
 * @template T The handler type.
 */
export declare class HandlerSubscription<T> implements Disposable {
  /**
   * Initializes the subscription.
   * @param handlers The set holding the handler, or the map holding it as a key.
   * @param handler The handler.
   */
  public constructor(handlers: Set<T> | Map<T, unknown>, handler: T);

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
 * A JSON-RPC error object.
 */
export declare class JsonRpcError {
  /**
   * The error code.
   */
  public readonly code: number;
  /**
   * The error message.
   */
  public readonly message: string;
  /**
   * Additional data, or `null`.
   */
  public readonly data: JsonValue;

  /**
   * Initializes the error.
   * @param code The error code.
   * @param message The error message.
   * @param data Additional data, or `null`.
   */
  public constructor(code: number, message: string, data: JsonValue);

  /**
   * Reads an error from JSON; a missing `data` field reads as `null`.
   * @param value The JSON value.
   * @param path The value's path for error messages.
   * @returns The error.
   * @throws JsonException when `code` or `message` is missing or of the wrong type.
   */
  public static fromJson(value: unknown, path?: string): JsonRpcError;

  /**
   * Serializes the error.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * A provider executable and where it was found.
 */
export declare class LocatedExecutable {
  /**
   * The executable's path.
   */
  public readonly path: string;
  /**
   * Where it was found.
   */
  public readonly source: ExecutableSource;
  /**
   * The arguments every run starts with, such as the script a Node executable runs.
   */
  public readonly arguments: readonly string[];

  /**
   * Initializes the executable.
   * @param path The executable's path.
   * @param source Where it was found.
   * @param args The arguments every run starts with; none by default.
   * @throws ArgumentException when the path is blank.
   */
  public constructor(path: string, source: ExecutableSource, args?: readonly string[]);

  /**
   * Returns the command that runs the executable with its starting arguments.
   * @returns The command.
   */
  public toCommand(): ProcessCommand;
}

/**
 * A request awaiting the Codex app-server's response.
 */
export declare class PendingRequest {
  /**
   * The request's method.
   */
  public readonly method: string;

  /**
   * Initializes the request.
   * @param method The request's method.
   * @param resolvers The promise resolvers the caller awaits.
   * @param timer The timeout timer, cleared when the request settles.
   */
  public constructor(method: string, resolvers: PromiseWithResolvers<JsonValue>, timer: NodeJS.Timeout | null);

  /**
   * Clears the timeout timer without settling the request, for a response that has arrived and settles later.
   */
  public stopTimer(): void;

  /**
   * Resolves the request.
   * @param value The result.
   */
  public complete(value: JsonValue): void;

  /**
   * Rejects the request.
   * @param error The failure.
   */
  public fail(error: Error): void;
}

/**
 * An executable and the arguments that precede any operation-specific ones.
 */
export declare class ProcessCommand {
  /**
   * The executable's path.
   */
  public readonly executable: string;
  /**
   * The leading arguments, copied.
   */
  public readonly arguments: readonly string[];
  /**
   * The kind and provider the process runs for, which a refused start names; `null` for a tool that runs for no provider.
   */
  public readonly origin: ProcessOrigin | null;
  /**
   * Whether, on Windows, the arguments reach the executable as they are, joined by spaces with no quoting, as Noldova Desktop's `ProcessRequest.isVerbatim` passes them; `false` by default.
   */
  public readonly isVerbatim: boolean;
  /**
   * Whether the process starts in a process group of its own outside Windows, so what it starts can be found by that group after it exits.
   */
  public readonly ownsGroup: boolean;

  /**
   * Initializes the command.
   * @param executable The executable's path.
   * @param args The leading arguments.
   * @param origin The kind and provider the process runs for.
   * @param isVerbatim Whether, on Windows, the arguments reach the executable as they are.
   * @param ownsGroup Whether the process starts in a process group of its own outside Windows; false by default.
   * @throws ArgumentException when the executable is blank.
   */
  public constructor(executable: string, args: readonly string[], origin?: ProcessOrigin | null, isVerbatim?: boolean, ownsGroup?: boolean);

  /**
   * Returns a command with more arguments appended, for the same origin, verbatim form and group.
   * @param args The arguments to append.
   * @returns The new command.
   */
  public withArguments(...args: readonly string[]): ProcessCommand;

  /**
   * Returns the same command for another origin, in the same verbatim form and group.
   * @param origin The kind and provider the process runs for.
   * @returns The new command.
   */
  public withOrigin(origin: ProcessOrigin): ProcessCommand;

  /**
   * Returns the same command, in the same verbatim form, started in a process group of its own outside Windows.
   * @returns The new command.
   */
  public inOwnGroup(): ProcessCommand;
}

/**
 * The kind and provider a process runs for, so a refused start can be logged by them.
 */
export declare class ProcessOrigin {
  /**
   * The kind's id, such as `codex`.
   */
  public readonly kind: string;
  /**
   * The provider's id, or `null` when the process runs for no provider.
   */
  public readonly providerId: string | null;

  /**
   * Initializes the origin.
   * @param kind The kind's id.
   * @param providerId The provider's id, or `null`.
   * @throws ArgumentException when the provider is blank.
   */
  public constructor(kind: string, providerId: string | null);
}

/**
 * How a process ended.
 */
export declare class ProcessExit {
  /**
   * The exit code, or `null` when a signal ended the process or it never started.
   */
  public readonly code: number | null;
  /**
   * The signal, or `null`.
   */
  public readonly signal: string | null;

  /**
   * Initializes the exit.
   * @param code The exit code, or `null`.
   * @param signal The signal, or `null`.
   */
  public constructor(code: number | null, signal: string | null);
}

/**
 * The timeouts and grace periods the adapters use, in milliseconds.
 */
/**
 * Calls back once a given time passes since it last started, unless it is stopped first: a kept session's limit for sitting idle or silent.
 */
export declare class Deadline {
  /**
   * Creates a deadline that hasn't started.
   * @param timer Tells the time the limit passes.
   * @param limit How long after its last start the deadline calls back, in milliseconds.
   * @param elapsed Called once the limit passes since the last start.
   */
  public constructor(timer: ITimer, limit: number, elapsed: () => void);

  /**
   * Whether the deadline waits for its limit to pass.
   */
  public get isRunning(): boolean;

  /**
   * Starts the wait again from now, ending any wait already running.
   */
  public start(): void;

  /**
   * Starts the wait again from now when it is running, as activity does; a deadline that isn't running stays stopped.
   */
  public extend(): void;

  /**
   * Ends the wait without calling back, even when its limit passed just before.
   */
  public stop(): void;
}

/**
 * Turns a provider's text deltas into growing details: the text of each item accumulates and is
 * reported at most once per interval under the item's id, so the engine updates one detail instead
 * of appending fragments.
 */
export declare class DeltaStream {
  /**
   * Initializes the stream.
   * @param listener Receives the accumulated details.
   * @param interval The longest wait between reports, in milliseconds.
   * @throws ArgumentOutOfRangeException when the interval is not a positive integer.
   */
  public constructor(listener: ITurnListener, interval: number);

  /**
   * Whether accumulated text is waiting to be reported.
   */
  public get isPending(): boolean;

  /**
   * Adds a delta to an item's text and schedules a report.
   * @param id The provider's item id.
   * @param kind The detail kind of the item.
   * @param delta The text to add.
   */
  public append(id: string, kind: DetailKind, delta: string): void;

  /**
   * Reports every pending item now, after the reports already started, one at a time in order; a report the interval started runs the same way.
   * @returns When every report started so far has returned.
   * @throws The first failure of the listener since the last call, a report the interval started included; the reports after it still run.
   */
  public flushAsync(): Promise<void>;

  /**
   * Drops an item's accumulated text.
   * @param id The provider's item id.
   */
  public forget(id: string): void;
}

/**
 * Every provider's answer for every ability: it works, and from where; the provider can't; TeamRun hasn't built it; or no one has checked it yet;
 * and why.
 * Each row names every ability, so an ability without an answer fails the build, and a Runtime spec fails for a registered provider
 * without a row. Each provider's descriptor carries its row, and `documents/ARCHITECTURE.md` shows the table.
 */
export declare class ProviderAbilityTable {
  /** The answers of Claude Code. */
  public static readonly claude: ProviderAbilities;
  /** The answers of Codex. */
  public static readonly codex: ProviderAbilities;
  /** The answers of GitHub Copilot. */
  public static readonly copilot: ProviderAbilities;
  /** The answers of Grok. */
  public static readonly grok: ProviderAbilities;
  /** The answers of OpenCode. */
  public static readonly opencode: ProviderAbilities;
  /** The answers of Cursor. */
  public static readonly cursor: ProviderAbilities;
  /** The answers of Antigravity. */
  public static readonly antigravity: ProviderAbilities;
  /** The answers of Pi. */
  public static readonly pi: ProviderAbilities;
  /** The answers of fx. */
  public static readonly fx: ProviderAbilities;
  /** The answers of Muse Code. */
  public static readonly muse: ProviderAbilities;
  /** The answers of an ACP agent a person adds, from the registry or a local command. */
  public static readonly acpAgent: ProviderAbilities;
}

export declare class ProviderTimings {
  /**
   * How long `--version` may take.
   */
  public readonly versionTimeout: number;
  /**
   * How long a sign-in check command may take.
   */
  public readonly signInCheckTimeout: number;
  /**
   * How long the Codex app-server may take to answer `initialize`.
   */
  public readonly initializeTimeout: number;
  /**
   * How long any other Codex request may take.
   */
  public readonly requestTimeout: number;
  /**
   * How long `turn/interrupt` may take.
   */
  public readonly interruptTimeout: number;
  /**
   * How long an aborted Codex turn may keep running before it is reported as interrupted anyway.
   * A turn given up this way then also waits for its thread's reload, which archives the thread and
   * shuts down the threads it spawned, so that the next resume can't race the archive.
   */
  public readonly interruptGrace: number;
  /**
   * How long a Codex app-server may take to exit after its input closes before it is terminated.
   */
  public readonly stopGrace: number;
  /**
   * How long a terminated ACP agent may take to exit before stopping fails.
   */
  public readonly killWait: number;
  /**
   * How long an aborted Claude Code turn may take to stop before its process is aborted, and how
   * long a Codex sign-in that ends waits for Codex to answer its `account/login/cancel`.
   */
  public readonly abortGrace: number;
  /**
   * How often, at most, a streamed text is reported while it grows.
   */
  public readonly streamInterval: number;
  /**
   * Milliseconds between the tries of a busy thread's resume.
   */
  public readonly resumeRetryDelay: number;
  /**
   * Milliseconds an idle Claude query, or a Grok process that said it starts a turn, stays open after a task ended, for the turn the end may start.
   */
  public readonly wakeGrace: number;
  /**
   * How often a running Claude task's output file is read for new output, in milliseconds.
   */
  public readonly taskOutputInterval: number;
  /**
   * How long a sign-in check waits for the signed-in account, in milliseconds: each Grok account method, and Copilot's second process together.
   */
  public readonly accountTimeout: number;
  /**
   * How long a model listing waits for an agent's `modelList` method, in milliseconds: a little over the 10 seconds Grok's `x.ai/models/list`
   * waits for its first catalog.
   */
  public readonly modelListTimeout: number;
  /**
   * How long a kept session held open only by its background work stays open while that work reports nothing, in milliseconds; the work is then
   * stopped as Stop does and the session closed.
   */
  public readonly silenceLimit: number;
  /**
   * How long a kept process with no session left stays open, in milliseconds: a Codex app-server with no thread.
   */
  public readonly idleLimit: number;

  /**
   * Initializes the timings.
   * @param versionTimeout How long `--version` may take.
   * @param signInCheckTimeout How long a sign-in check may take.
   * @param initializeTimeout How long `initialize` may take.
   * @param requestTimeout How long other requests may take.
   * @param interruptTimeout How long `turn/interrupt` may take.
   * @param interruptGrace The grace after an abort before a Codex turn is given up.
   * @param stopGrace The grace before a stopping app-server is terminated.
   * @param killWait How long a terminated ACP agent may take to exit before stopping fails.
   * @param abortGrace The grace after an abort before a Claude Code process is aborted, and the wait
   * for Codex's answer to a sign-in's cancel.
   * @param streamInterval How often, at most, a streamed text is reported while it grows.
   * @param resumeRetryDelay Milliseconds between the tries of a busy thread's resume.
   * @param wakeGrace Milliseconds an idle Claude query, or a Grok process that said it starts a turn, stays open after a task ended.
   * @param taskOutputInterval How often a running Claude task's output file is read, in milliseconds.
   * @param accountTimeout How long a sign-in check waits for the signed-in account, in milliseconds.
   * @param modelListTimeout How long a model listing waits for an agent's `modelList` method, in milliseconds.
   * @param silenceLimit How long a session held open only by its background work stays open while that work is silent, in milliseconds.
   * @param idleLimit How long a kept session with no turn, or a kept process with no session left, stays open, in milliseconds.
   * @throws ArgumentOutOfRangeException when a value is not a positive integer.
   */
  public constructor(versionTimeout: number, signInCheckTimeout: number, initializeTimeout: number, requestTimeout: number, interruptTimeout: number, interruptGrace: number, stopGrace: number, killWait: number, abortGrace: number, streamInterval: number, resumeRetryDelay: number, wakeGrace?: number, taskOutputInterval?: number, accountTimeout?: number, modelListTimeout?: number, silenceLimit?: number, idleLimit?: number);

  /**
   * Returns the production timings.
   * @returns The timings.
   */
  public static createDefault(): ProviderTimings;
}

/**
 * An instruction file TeamRun read for a provider, with its imports expanded.
 */
export declare class InstructionFile {
  /**
   * Where it was read from.
   */
  public readonly path: string;
  /**
   * Its text, capped in length.
   */
  public readonly content: string;

  public constructor(path: string, content: string);
}

/**
 * An image a provider's tool saved or sent, as base64.
 */
export declare class SavedImage {
  /**
   * Where the provider saved it; null for an image it only sent.
   */
  public readonly path: string | null;
  /**
   * Its media type, read from its bytes.
   */
  public readonly mediaType: string;
  /**
   * Its bytes, as base64.
   */
  public readonly data: string;

  public constructor(path: string | null, mediaType: string, data: string);
}

/**
 * The last chunks of a stream, up to a maximum count.
 */
export declare class TailBuffer {
  /**
   * Initializes the buffer.
   * @param maximumCount The maximum number of chunks kept.
   * @throws ArgumentOutOfRangeException when the maximum is not a positive integer.
   */
  public constructor(maximumCount: number);

  /**
   * Whether nothing was pushed yet.
   */
  public get isEmpty(): boolean;

  /**
   * Pushes a chunk, dropping the oldest when the maximum is exceeded.
   * @param chunk The chunk.
   */
  public push(chunk: string): void;

  /**
   * Returns the kept chunks joined.
   * @returns The text.
   */
  public toString(): string;
}

/**
 * The ACP session a turn runs in, as `session/load` or `session/new` answered.
 */
export declare class AcpSession {
  /**
   * The session id, TeamRun's native session id for an ACP provider.
   */
  public readonly id: string;
  /**
   * Whether it is the session the turn asked to resume; `false` for a new session, including one started after a failed resume.
   */
  public readonly resumed: boolean;
  /**
   * The answer to `session/load` or `session/new`, such as its models.
   */
  public readonly result: JsonReader;

  /**
   * @throws ArgumentException when the id is blank.
   */
  public constructor(id: string, resumed: boolean, result: JsonReader);
}

/**
 * The public ACP registry's list of agents, without the entries it couldn't read.
 */
export declare class AcpRegistry {
  /**
   * The agents read, in the registry's order, each id once.
   */
  public readonly agents: readonly AcpRegistryAgent[];
  /**
   * The id, or the position when it has none, of each entry left out because it couldn't be read.
   */
  public readonly skipped: readonly string[];

  public constructor(agents: readonly AcpRegistryAgent[], skipped?: readonly string[]);

  /**
   * Reads the registry's `registry.json`, leaving out each entry that isn't a valid agent and keeping the first entry of an id listed twice.
   * @throws Error when the text isn't JSON with an `agents` list.
   */
  public static read(text: string): AcpRegistry;

  /**
   * The agent with the id, or `null` when the registry lists none.
   */
  public find(id: string): AcpRegistryAgent | null;
}

/**
 * An agent the ACP registry lists: its id, its version, and how it is installed on each platform.
 */
export declare class AcpRegistryAgent {
  /**
   * The registry's id, which TeamRun keeps across the agent's versions.
   */
  public readonly id: string;
  public readonly name: string;
  public readonly version: string;
  /**
   * The registry's description, or empty when it has none.
   */
  public readonly description: string;
  /**
   * The icon's https address, or `null` when it has none or it isn't https.
   */
  public readonly icon: string | null;
  /**
   * The binary archive for each of the registry's platform keys the agent lists, such as `windows-x86_64`.
   */
  public readonly binaries: ReadonlyMap<string, AcpRegistryBinary>;
  /**
   * The npm package `npx` runs, or `null` when the agent has none.
   */
  public readonly npx: AcpRegistryPackage | null;
  /**
   * The Python package `uvx` runs, or `null` when the agent has none.
   */
  public readonly uvx: AcpRegistryPackage | null;

  public constructor(id: string, name: string, version: string, description: string, icon: string | null, binaries: ReadonlyMap<string, AcpRegistryBinary>,
    npx: AcpRegistryPackage | null, uvx: AcpRegistryPackage | null);

  /**
   * Reads one entry of the registry's `agents`, ignoring platform keys the registry doesn't define.
   * @throws Error when the id isn't usable, starts with `local-`, which local commands' kinds use, or is a Windows device name such as `con`; when it
   * is in `Resources.acpRegistryOwnProviderIds`, a provider TeamRun runs itself; or when the version or a distribution isn't valid.
   */
  public static fromJson(reader: JsonReader): AcpRegistryAgent;

  /**
   * Whether an id can name a kind: a lowercase letter, then lowercase letters, digits and hyphens, at most `Resources.acpRegistryIdMaxLength` in all.
   */
  public static isUsableId(id: string): boolean;

  /**
   * The registry's platform key for a Node.js platform and architecture, such as `windows-x86_64` for `win32` and `x64`, or `null` when the registry
   * builds for neither.
   */
  public static targetOf(platform: NodeJS.Platform, arch: string): string | null;

  /**
   * The binary archive for a platform key, or `null` when the agent lists none for it.
   */
  public binaryFor(target: string | null): AcpRegistryBinary | null;

  /**
   * The agent's `website`, else its `repository`, when it is HTTPS, or `null`.
   */
  public readonly about: string | null;

  /**
   * Whether the list for a computer of the target shows the agent: it has a binary for it, an npx package, or a uvx package to show as not available.
   */
  public isListedFor(target: string | null): boolean;

  /**
   * Writes the entry as `fromJson` reads it, so an added agent starts with no network.
   */
  public toJson(): JsonObject;
}

/**
 * A registry agent's binary archive for one platform, and the command in it that starts the agent.
 */
export declare class AcpRegistryBinary {
  /**
   * The archive's https address.
   */
  public readonly archive: string;
  /**
   * The command's path inside the unpacked archive, as segments, without `.`; never `..` and never rooted.
   */
  public readonly command: readonly string[];
  public readonly arguments: readonly string[];
  public readonly environment: Readonly<Record<string, string>>;
  /**
   * The archive's SHA-256 in lowercase hexadecimal, or `null` when the registry lists none.
   */
  public readonly sha256: string | null;

  public constructor(archive: string, command: readonly string[], args: readonly string[], environment: Readonly<Record<string, string>>, sha256: string | null);

  /**
   * Reads one platform's entry of an agent's `distribution.binary`, splitting `cmd` on `/` and `\`.
   * @throws Error when the archive isn't https, the command leaves the archive, the SHA-256 isn't one, or a variable isn't a name with a text value.
   */
  public static fromJson(reader: JsonReader): AcpRegistryBinary;

  /**
   * The command that starts the agent from the folder its archive was unpacked into, with its arguments.
   */
  public commandIn(folder: string): ProcessCommand;

  /**
   * Whether the archive's address ends in `.zip`.
   */
  public get isZip(): boolean;

  /**
   * Whether the address names neither a zip nor a tar archive, so it is the program itself.
   */
  public get isRaw(): boolean;

  /**
   * Writes the entry as `fromJson` reads it.
   */
  public toJson(): JsonObject;
}

/**
 * An ACP agent the person starts with a command of their own, which TeamRun runs as its own kind through `GeneralAcpAgent`.
 */
export declare class LocalAcpCommand {
  /**
   * The person's id for it, kept with the kind's providers, chats and messages, as `AcpRegistryAgent.isUsableId` allows.
   */
  public readonly id: string;
  public readonly name: string;
  /**
   * The program, a path or a name the person's `PATH` finds.
   */
  public readonly command: string;
  public readonly arguments: readonly string[];
  /**
   * The variables the agent starts with beside the person's own, each by its saved secret's reference, never its value.
   */
  public readonly secrets: readonly SharedMcpSecret[];

  /**
   * @throws ArgumentException when the id isn't one, the name or the command is blank, or a variable isn't a name.
   */
  public constructor(id: string, name: string, command: string, args?: readonly string[], secrets?: readonly SharedMcpSecret[]);

  /**
   * The kind's id, `local-` and the id; no built-in kind's id starts so, and `AcpRegistryAgent` leaves out a registry agent whose id does.
   */
  public get kindId(): string;

  /**
   * Reads the command as `toJson` writes it, with `id`, `name`, `cmd`, and optional `args` and `secrets`.
   * @throws Error when a field is missing or isn't valid.
   */
  public static fromJson(reader: JsonReader): LocalAcpCommand;

  /**
   * Writes the command with its variables' references, never their values.
   */
  public toJson(): JsonObject;

  /**
   * The agent that runs the command as the kind `kindId`, named by `name`, with `commandFor`'s program. A terminal sign-in runs the command alone, so a command with
   * arguments has none.
   * @param values The variables' values read from their saved secrets, or a function that throws why they can't be read.
   * @param environment The person's environment the agent's own is built from.
   * @param homeDirectory The folder the agent starts in outside a turn.
   * @param platform The system the command runs on, the current one by default.
   */
  public toAgent(values: Readonly<Record<string, string>> | (() => Readonly<Record<string, string>>), environment: NodeJS.ProcessEnv, homeDirectory: string, platform?: string): GeneralAcpAgent;

  /**
   * The program that runs the command, as `SharedMcpLauncher.commandOf` finds it for a shared MCP server: on Windows a `.cmd` or `.bat` file, found
   * through `PATH` and `PATHEXT`, runs through `COMSPEC` with its arguments quoted and escaped twice, with verbatim arguments; anything else, and
   * everything outside Windows, runs as it is.
   * @param environment The environment the command is found in; the command's own variables come on top.
   * @param values The variables' values.
   * @throws Error when a batch file's argument has a line break, which `cmd.exe` can't carry.
   */
  public commandFor(platform: string, environment: NodeJS.ProcessEnv, values?: Readonly<Record<string, string>>): ProcessCommand;
}

/**
 * A registry agent's package for `npx` or `uvx`, pinned by the registry, and the arguments and variables it starts with.
 */
export declare class AcpRegistryPackage {
  /**
   * The package with its version, such as `droid@1.1.0`.
   */
  public readonly name: string;
  public readonly arguments: readonly string[];
  public readonly environment: Readonly<Record<string, string>>;

  public constructor(name: string, args: readonly string[], environment: Readonly<Record<string, string>>);

  /**
   * Reads an agent's `distribution.npx` or `distribution.uvx`.
   * @throws Error when the package is blank, or a variable isn't a name with a text value.
   */
  public static fromJson(reader: JsonReader): AcpRegistryPackage;

  /**
   * An entry's `args`, or none when it has none.
   */
  public static argumentsOf(reader: JsonReader): readonly string[];

  /**
   * An entry's `env`, or none when it has none.
   * @throws Error when a variable isn't a name with a text value.
   */
  public static environmentOf(reader: JsonReader): Readonly<Record<string, string>>;

  /**
   * Whether the name is one exact npm package and version, so npm can't read it as a tag, a flag, a path or a git address.
   */
  public get isExactNpmPackage(): boolean;

  /**
   * The name before its version.
   */
  public get npmPackageName(): string;

  /**
   * The version after its name.
   */
  public get npmVersion(): string;

  /**
   * Writes the entry as `fromJson` reads it.
   */
  public toJson(): JsonObject;
}

/**
 * The programs an install needs, each `null` when this computer has none: `tar` and an unzip for archives, and the person's own npm.
 */
export declare class AcpInstallTools {
  public readonly tar: LocatedExecutable | null;
  public readonly unzip: LocatedExecutable | null;
  public readonly npm: LocatedExecutable | null;
  public constructor(tar: LocatedExecutable | null, unzip: LocatedExecutable | null, npm: LocatedExecutable | null);
}

/**
 * Whether an address is HTTPS, or HTTP on this computer's loopback.
 */
export declare class DownloadAddress {
  public static isSafe(url: string): boolean;
}

/**
 * The process command for an ACP agent's program, by `SharedMcpLauncher.commandOf`'s batch rule.
 */
export declare class AcpCommandLine {
  /**
   * @throws Error with `Resources.formatAcpArgumentLineBreak` when the program is a Windows batch file and an argument has a line break, which `cmd.exe` can't carry.
   */
  public static of(platform: string, environment: NodeJS.ProcessEnv, variables: Readonly<Record<string, string>>, command: string, args: readonly string[]): ProcessCommand;
}

/**
 * Keeps registry agents' icons as data addresses, since the window's content policy loads no remote image: fetched once per version, without redirects, of an image type, up to
 * `Resources.acpIconMaxBytes`, and kept in a file. Any failure is `null`, and the list shows no icon.
 */
export declare class AcpRegistryIcons {
  public constructor(directory: string, timeout: number);
  public readAsync(agent: AcpRegistryAgent): Promise<string | null>;
}

/**
 * Installs a registry agent into `<directory>/<version>`. A binary archive is downloaded over HTTPS up to `Resources.releaseDownloadLimit`, checked against its SHA-256 when one is listed,
 * and unpacked, or kept as the program when the address names a program; an npx package runs the person's own npm with `--ignore-scripts` at its exact version, in the person's
 * environment without the entry's variables. The program has to be a file inside the folder. Everything happens in a staging folder that is moved into place, so a failure
 * leaves nothing behind, and other versions are removed after, as far as they aren't held.
 */
export declare class AcpAgentInstaller implements IProviderKindInstallation {
  public constructor(agent: AcpRegistryAgent, directory: string, target: string | null, platform: string, environment: NodeJS.ProcessEnv, tools: AcpInstallTools,
    runner: CommandRunner, rename: (from: string, to: string) => void, settle: (from: string, to: string) => Promise<void>,
    latest: () => Promise<AcpRegistryAgent | null>, saved: (agent: AcpRegistryAgent) => Promise<void>);
  public get unavailable(): string | null;
  /**
   * The program this computer lacks that installing the agent needs, `unzip`, `tar` or `npm`, or `null` when it lacks none or once it's installed.
   */
  public get missingTool(): string | null;
  public get isInstalled(): boolean;
  /**
   * The installed entry's variables for this computer.
   */
  public get variables(): Readonly<Record<string, string>>;
  /**
   * The installed entry's program, or `null` when it isn't installed.
   */
  public get program(): string | null;
  /**
   * Why the agent can't be installed on this computer, or `null` when it can.
   */
  public static refusalOf(agent: AcpRegistryAgent, target: string | null, tools: AcpInstallTools): string | null;
  /**
   * The command that starts the installed entry, or `null` when it isn't installed.
   */
  public commandOf(): ProcessCommand | null;
  public readVersions(): Promise<ProviderKindVersions>;
  public install(progress: (received: number, total: number) => void, signal: AbortSignal, commit: () => void): Promise<string>;
}

/**
 * The providers' side of `AcpAgentsService`: the registry's list for this computer, an icon, a stored entry's `GeneralAcpAgent` with its installer, and a local command's
 * saved values, read once when it opens; one that can't be read fails its launch with the reason.
 */
export declare class AcpAgentCatalog implements IAcpAgentCatalog {
  public constructor(source: AcpRegistrySource, icons: AcpRegistryIcons, directory: string, target: string | null, platform: string, environment: NodeJS.ProcessEnv,
    homeDirectory: string, tools: AcpInstallTools, runner: CommandRunner, rename: (from: string, to: string) => void, settle: (from: string, to: string) => Promise<void>,
    secrets: ISharedMcpSecrets, adapterOf: (agent: GeneralAcpAgent, installation: IProviderKindInstallation | null) => IProviderAdapter);
  public listAsync(stored: readonly AcpStoredAgent[]): Promise<AcpAgentListing>;
  public readIconAsync(id: string): Promise<string | null>;
  public readOfferAsync(id: string): Promise<AcpAgentOffer | null>;
  public localOf(params: AcpLocalCommandAddParams, isTaken: (kind: string) => boolean): AcpStoredAgent;
  public openAsync(stored: AcpStoredAgent, save: (json: JsonObject) => Promise<void>): Promise<IProviderAdapter>;
  public referencesOf(stored: AcpStoredAgent): readonly string[];
  public removeFilesAsync(stored: AcpStoredAgent): Promise<void>;
}

/**
 * The shared ACP adapter for a `GeneralAcpAgent`, with the installation of a registry agent, or none for a local command.
 */
export declare class GeneralAcpAdapter extends AcpAdapter {
  public readonly installation?: IProviderKindInstallation;
  public constructor(agent: GeneralAcpAgent, installation: IProviderKindInstallation | null, clientInfo: AppServerClientInfo, starter: IProcessStarter,
    timings: ProviderTimings, log?: ILog | null);
}

/**
 * The registry's list of agents as TeamRun last read it, and when.
 */
export declare class AcpRegistryListing {
  public readonly registry: AcpRegistry;
  /**
   * When the list was fetched: now for a fresh fetch, or when the kept copy was written.
   */
  public readonly fetchedAt: Date;
  /**
   * Why a due fetch failed, when the kept copy is shown instead; `null` otherwise.
   */
  public readonly failure: string | null;

  public constructor(registry: AcpRegistry, fetchedAt: Date, failure?: string | null);
}

/**
 * Reads the ACP registry's list of agents, fetching it at most once in its maximum age and keeping the last list read in a file, which is shown when a fetch
 * fails.
 */
export declare class AcpRegistrySource {
  /**
   * @param url The registry's `registry.json`, over https, or over http only on this computer's loopback, `localhost`, `127.0.0.1` or `[::1]`.
   * @param cacheFile The file the last list read is kept in.
   * @param maxAge How long, in milliseconds, a kept list is used before the registry is fetched again.
   * @param timeout How long, in milliseconds, a fetch may take.
   * @param now The clock, in milliseconds.
   * @throws ArgumentException with `Resources.acpRegistryUrlRefused` when the address is neither.
   */
  public constructor(url: string, cacheFile: string, maxAge: number, timeout: number, now?: () => number);

  /**
   * Reads the list: the kept one while it is younger than the maximum age, and not dated after now, otherwise a fresh fetch, which replaces the kept
   * one; when the fetch fails or can't be read, the kept list with the failure. A redirect fails as its status does, and an answer larger than
   * `Resources.acpRegistryMaxBytes`, by its `Content-Length` or as it is read, is cut off and can't be read; an answer that breaks off counts as unreachable. Reads at the same time share one fetch.
   * @throws Error when the fetch fails and no list is kept.
   */
  public readAsync(): Promise<AcpRegistryListing>;
}

/**
 * A Codex thread's running token totals, from which a turn's own tokens are the difference.
 */
export declare class TokenTotals {
  /**
   * No tokens, the totals of a thread TeamRun started.
   */
  public static readonly zero: TokenTotals;
  /**
   * The input tokens so far.
   */
  public readonly inputTokens: number;
  /**
   * The output tokens so far.
   */
  public readonly outputTokens: number;
  /**
   * The input tokens read from the cache so far, part of the input tokens; `null` when Codex doesn't report them.
   */
  public readonly cacheReadTokens: number | null;
  /**
   * The input tokens written to the cache so far, part of the input tokens; `null` when Codex doesn't report them.
   */
  public readonly cacheWriteTokens: number | null;
  /**
   * The reasoning tokens so far, part of the output tokens; `null` when Codex doesn't report them.
   */
  public readonly reasoningTokens: number | null;

  /**
   * Initializes the totals.
   */
  public constructor(inputTokens: number, outputTokens: number, cacheReadTokens?: number | null, cacheWriteTokens?: number | null,
    reasoningTokens?: number | null);

  /**
   * The tokens used since the earlier totals; a cache or reasoning count is `null` when either side lacks it or it fell.
   * @param before The earlier totals.
   */
  public since(before: TokenTotals): TokenTotals;

  /**
   * Whether these totals grew from the earlier ones: neither figure fell and at least one rose.
   * @param before The earlier totals.
   */
  public isAhead(before: TokenTotals): boolean;
}

/**
 * What the Codex app-server answered to `thread/start` or `thread/resume`.
 */
export declare class ThreadStartResult {
  /**
   * The thread id, TeamRun's native session id for Codex.
   */
  public readonly threadId: string;
  /**
   * The model the thread uses.
   */
  public readonly model: string;
  /**
   * The thread's reasoning effort, or `null` when Codex reports none.
   */
  public readonly reasoningEffort: string | null;
  /**
   * The thread's service tier, such as `priority`; `null` when Codex reports none, and `undefined` when its answer leaves the field out.
   */
  public readonly serviceTier: string | null | undefined;
  /**
   * The collaboration mode a resumed thread reports, such as `plan` or `default`; `null` when the answer has none, as `thread/start`'s never does.
   */
  public readonly collaborationMode: string | null;

  /**
   * Initializes the result.
   * @param threadId The thread id.
   * @param model The model.
   * @param reasoningEffort The reasoning effort, or `null`.
   * @param serviceTier The service tier, `null` when none, or `undefined` when the answer leaves it out; `undefined` by default.
   * @param collaborationMode The thread's collaboration mode, or `null`; `null` by default.
   * @throws ArgumentException when the thread id or model is blank.
   */
  public constructor(threadId: string, model: string, reasoningEffort: string | null, serviceTier?: string | null, collaborationMode?: string | null);

  /**
   * Reads the result from JSON.
   * @param value The JSON value.
   * @param path The value's path for error messages.
   * @returns The result.
   * @throws JsonException when `thread.id` or `model` is missing or blank, `serviceTier` isn't a string or null, or `collaborationMode` isn't an
   * object or null.
   */
  public static fromJson(value: unknown, path?: string): ThreadStartResult;
}

/**
 * The package's literals: names, arguments, fields, methods, limits, timings, and messages.
 */
export declare class Resources {
  public static readonly acpBase64Encoding: BufferEncoding;
  public static readonly grokExecutableName: string;
  public static readonly grokWindowsExecutableName: string;
  public static readonly grokDirectoryName: string;
  public static readonly sessionIdField: string;
  public static readonly nameField: string;
  public static readonly titleField: string;
  public static readonly optionsField: string;
  public static readonly contentField: string;
  public static readonly grokNotFound: string;
  /**
   * The message of the error a Grok sign-in raises when the CLI offers only methods TeamRun can't start.
   */
  public static readonly grokSignInUnavailable: string;
  /**
   * Grok's sign-out method, under the extension prefix ACP gives it and without it.
   */
  public static readonly xaiLogoutMethods: readonly string[];
  /**
   * The field of Grok's sign-out answer that says it signed out: `ok`.
   */
  public static readonly xaiOkField: string;
  /**
   * The field of Grok's sign-out answer that says an API key still signs it in: `api_key_still_set`.
   */
  public static readonly xaiApiKeyStillSetField: string;
  /**
   * Explains that Grok's sign-out answer didn't read `ok: true`.
   */
  public static readonly grokSignOutRefused: string;
  /**
   * Explains that Grok signed out of its account but still has an API key, and where the key comes from.
   */
  public static readonly grokApiKeyStillSet: string;
  public static readonly copilotKindId: string;
  public static readonly copilotDisplayName: string;
  public static readonly copilotNotFound: string;
  /**
   * The message of the error a Copilot sign-in raises: Copilot signs in only through its own `copilot login`.
   */
  public static readonly copilotSignInUnavailable: string;
  public static readonly copilotDefaultModelName: string;
  /**
   * The folder in the home folder Copilot CLI uses for a turn with no provider, since TeamRun leaves out `COPILOT_HOME` then: `.copilot`.
   */
  public static readonly copilotHomeFolderName: string;
  /**
   * The folder in a Copilot profile folder that holds a folder for each session, named by its ACP session id: `session-state`.
   */
  public static readonly copilotSessionStateFolderName: string;
  /**
   * The SQLite database in a Copilot session's folder that holds its to-do list in the `todos` table: `session.db`.
   */
  public static readonly copilotSessionDatabaseName: string;
  /**
   * Matches a SQL statement that changes Copilot's `todos` table, named alone or in the `main` schema, quoted or not: an insert, replace, update
   * or delete.
   */
  public static readonly copilotToDoWritePattern: RegExp;
  /**
   * Reads each to-do's title, cut to its first characters, and status, in the order Copilot added them: by `created_at`, which Copilot keeps to
   * the second, and then as inserted, so a list added in one statement keeps its order. It takes the title's length and the number of rows.
   */
  public static readonly copilotToDoQuery: string;
  /**
   * How long a read of Copilot's session database waits while Copilot holds it, in milliseconds; a read holds the database only while it
   * runs, well inside the 5 seconds Copilot's own write waits for it.
   */
  public static readonly copilotToDoBusyTimeout: number;
  /**
   * The field of a Copilot tool's raw output that holds its full result: `detailedContent`.
   */
  public static readonly copilotDetailedContentField: string;
  /**
   * How the full result of Copilot's `sql` tool starts, since its ACP tool call names no tool: `SQL: `.
   */
  public static readonly copilotSqlOutputPrefix: string;
  /**
   * The most to-dos a Copilot plan shows, the first ones Copilot added.
   */
  public static readonly maximumCopilotToDos: number;
  /**
   * The plan step status of each Copilot to-do status; `blocked`, and any other, is pending.
   */
  public static readonly copilotToDoStatuses: Readonly<Record<string, PlanStepStatus>>;
  /**
   * The entry names that make a folder a Copilot profile folder.
   */
  public static readonly copilotProfileEntries: readonly string[];
  /**
   * The login command a person runs in a terminal with `COPILOT_HOME` set to a provider's profile folder: `copilot login`.
   */
  public static readonly copilotSignInCommand: string;
  /**
   * The command that opens Copilot CLI's own session in a terminal, where a person signs out with `/logout`: `copilot`.
   */
  public static readonly copilotToolCommand: string;
  public static readonly copilotHeadlessArguments: readonly string[];
  public static readonly copilotListingTimedOut: string;
  public static readonly copilotListingEmpty: string;
  public static readonly copilotFreePlanName: string;
  public static readonly grokAgentArguments: readonly string[];
  /** What sets Grok's permission mode at launch: `--permission-mode`. */
  public static readonly grokPermissionModeArgument: string;
  /** The permission mode Grok launches in unless Always-approve is chosen, so its own settings' default doesn't apply: `default`. */
  public static readonly grokDefaultPermissionMode: string;
  /** The tool through which Grok calls every MCP tool: `use_tool`. */
  public static readonly grokRoutedMcpTool: string;
  public static readonly grokStdioArguments: readonly string[];
  public static readonly grokModelArgument: string;
  /** The launch argument that turns Grok's own sub-agents off, for a turn in a mode other than Default: `--no-subagents`. */
  public static readonly grokNoSubAgentsArgument: string;
  public static readonly grokEffortArgument: string;
  public static readonly acpInitialize: string;
  public static readonly acpAuthenticate: string;
  public static readonly acpSessionNew: string;
  public static readonly acpLogout: string;
  public static readonly acpAuthField: string;
  public static readonly acpLogoutField: string;
  public static readonly acpSessionLoad: string;
  public static readonly acpSessionPrompt: string;
  public static readonly acpSessionCancel: string;
  public static readonly acpSessionSetModel: string;
  public static readonly acpSessionResume: string;
  /**
   * The requests that open a session, and their field naming the MCP servers the agent starts for it; `AcpClient` sweeps what an agent started
   * once it opened a session with any.
   */
  public static readonly acpSessionOpenMethods: readonly string[];
  public static readonly acpMcpServersField: string;
  public static readonly acpSessionSetConfigOption: string;
  public static readonly acpSessionClose: string;
  public static readonly acpConfigOptionsField: string;
  public static readonly acpSelectType: string;
  public static readonly acpCategoryField: string;
  public static readonly acpCurrentValueField: string;
  public static readonly acpValueField: string;
  public static readonly acpGroupField: string;
  /** The field TeamRun logs a choice's group name under: `groupName`. */
  public static readonly acpGroupNameField: string;
  public static readonly familyIdParameterName: string;
  public static readonly familyNameParameterName: string;
  public static readonly levelNameParameterName: string;
  public static readonly optionIdParameterName: string;
  public static readonly modeParameterName: string;
  public static readonly onValueParameterName: string;
  public static readonly offValueParameterName: string;
  /** An Antigravity choice id that names a level: the base, then `-high`, `-medium` or `-low`. */
  public static readonly antigravityLevelIdPattern: RegExp;
  /** An Antigravity choice name that names a level: the base name, then ` (High)`, ` (Medium)` or ` (Low)`. */
  public static readonly antigravityLevelNamePattern: RegExp;
  /** The level name of a plain choice that joins the model its levels share an id and name with. */
  public static readonly acpDefaultLevelName: string;
  public static readonly acpLevelNamePattern: RegExp;
  public static readonly acpAgentInfoField: string;
  public static readonly acpVersionField: string;
  public static readonly acpModelCategory: string;
  public static readonly acpThoughtLevelCategory: string;
  public static readonly acpResourceLinkType: string;
  public static readonly acpSessionCapabilitiesField: string;
  public static readonly acpResumeCapabilityField: string;
  public static readonly acpCloseCapabilityField: string;
  public static readonly profileMarker: string;
  public static readonly profileDirectoryParameter: string;
  public static readonly acpModelsField: string;
  public static readonly acpStopReasonField: string;
  public static readonly acpEndTurn: string;
  public static readonly acpRefusal: string;
  public static readonly grokKindId: string;
  public static readonly grokDisplayName: string;
  public static readonly acpMetaField: string;
  /** The `_meta` member fx keeps its own fields in. */
  public static readonly fxMetaField: string;
  /** fx's `_meta.fx` flag that joins a `session/prompt` to the running turn. */
  public static readonly fxSteerField: string;
  /** fx's `_meta.fx` field of a steering prompt's answer saying whether the turn absorbed or dropped it. */
  public static readonly fxSteeringField: string;
  public static readonly fxAbsorbedSteering: string;
  public static readonly grokModelStateField: string;
  public static readonly acpCurrentModelField: string;
  public static readonly acpModelIdField: string;
  public static readonly acpAvailableModelsField: string;
  public static readonly acpCapabilitiesField: string;
  public static readonly acpPromptCapabilitiesField: string;
  public static readonly acpImageCapabilityField: string;
  /** The field of an ACP agent's capabilities that holds its MCP transports, `mcpCapabilities`, and the one in it, and the `type` of an HTTP server, `http`. */
  public static readonly acpMcpCapabilitiesField: string;
  public static readonly acpHttpCapabilityField: string;
  public static readonly acpHttpServerType: string;
  public static readonly grokReasoningEffortsField: string;
  public static readonly grokValueField: string;
  /** The field of an effort in a Grok model's `reasoningEfforts` that names it: `label`. */
  public static readonly grokLabelField: string;
  /** The field of an effort in a Grok model's `reasoningEfforts` that marks it as the model's default: `default`. */
  public static readonly grokDefaultField: string;
  /** The field of a Grok model's `_meta` that names its default effort: `reasoningEffort`. */
  public static readonly grokReasoningEffortField: string;
  /**
   * The field of a Grok model's `_meta` that says whether it takes an effort: `supportsReasoningEffort`.
   */
  public static readonly grokSupportsReasoningEffortField: string;
  /**
   * The models Grok advertises before it loads the provider's catalog, its built-in list: `grok-4.6` and `grok-4.5`.
   */
  public static readonly grokFallbackModels: readonly string[];
  /**
   * The field of a Codex model that names its default effort: `defaultReasoningEffort`.
   */
  public static readonly codexDefaultReasoningEffortField: string;
  /**
   * Codex's own names for the effort levels whose name isn't their id with a capital first letter, as its model picker shows
   * them: `Extra high` for `xhigh`.
   */
  public static readonly codexEffortNames: Readonly<Record<string, string>>;
  /**
   * The field of a Codex model that lists its service tiers, each with an id, a name and a description: `serviceTiers`.
   */
  public static readonly codexServiceTiersField: string;
  /**
   * The older field of a Codex model that lists its extra speed tiers by id only: `additionalSpeedTiers`.
   */
  public static readonly codexSpeedTiersField: string;
  /**
   * The field of a Codex model that names its default service tier: `defaultServiceTier`.
   */
  public static readonly codexDefaultServiceTierField: string;
  /**
   * The field of a Codex thread's start parameters and answer that holds its service tier: `serviceTier`.
   */
  public static readonly codexServiceTierField: string;
  /**
   * The speed TeamRun lists for a Codex model with service tiers for Codex's standard tier, which a thread asks for as no tier: `standard`.
   */
  public static readonly codexStandardTier: string;
  /**
   * The name of `codexStandardTier`: Standard.
   */
  public static readonly codexStandardTierName: string;
  /** Why a Codex turn's chosen service tier isn't the one its thread serves. */
  public static readonly codexTierNotServedReason: string;
  /**
   * The setting of a Codex thread's config that holds its chosen context window, in tokens: `model_context_window`.
   */
  public static readonly codexModelContextWindowSetting: string;
  /**
   * The smallest context window TeamRun offers a Codex model, in tokens, since `model/list` names none: 64K.
   */
  public static readonly codexContextWindowMinimum: number;
  /**
   * The only context window offered, and the maximum, until a thread started without a window reports the model's own: 128K.
   * Codex lowers a larger size to the model's maximum only when its model catalog names one, so a larger size waits for the model's window.
   */
  public static readonly codexUnreportedContextWindow: number;
  /**
   * The context windows offered by name, in tokens: 128K, 256K and 500K, each below the model's own window, which is offered last once reported.
   */
  public static readonly codexContextWindowPresets: readonly number[];
  /**
   * The share of a thread's context window that Codex reports as its `modelContextWindow`: 0.95, so 64,000 reports 60,800 and the default 500,000 reports 475,000.
   */
  public static readonly codexUsableWindowShare: number;
  /**
   * The step a model's own window is rounded to when read back from the window Codex reports: 1,000 tokens.
   */
  public static readonly codexWindowRounding: number;
  /** The note on a Codex turn whose thread its background tasks hold with a token TeamRun no longer accepts. */
  public static readonly codexToolsAwaitTasks: string;
  /** The note on a Codex turn or wake whose thread's sender token another reply still takes, so the shell's `teamrun` command doesn't act as it. */
  public static readonly codexSenderRefused: string;
  /** The note on a Codex wake whose sub-agent's result a turn that started on the thread after the sub-agent ended took. */
  public static readonly codexWakeTaken: string;
  public static readonly grokAgentVersionField: string;
  public static readonly acpAuthMethodsField: string;
  /**
   * The `authMethods` type of a sign-in the agent runs itself through `authenticate`, `agent`, which a method without a type also is.
   */
  public static readonly acpAgentAuthType: string;
  public static readonly grokCachedAuthMethod: string;
  public static readonly acpSessionUpdate: string;
  public static readonly acpUpdateField: string;
  public static readonly acpSessionUpdateField: string;

  /**
   * The ACP session update that reports a compaction, sent once TeamRun declares `session.compaction`: `compaction_update`.
   */
  public static readonly acpCompactionUpdate: string;
  /**
   * The ACP session update that lists the session's commands: `available_commands_update`.
   */
  public static readonly acpAvailableCommandsUpdate: string;
  /**
   * The field of `available_commands_update` that holds the commands: `availableCommands`.
   */
  public static readonly acpAvailableCommandsField: string;
  /**
   * What a command starts with: `/`.
   */
  public static readonly acpCommandPrefix: string;
  /**
   * Matches the `/` an agent may put before a listed command's name.
   */
  public static readonly acpCommandPrefixPattern: RegExp;
  /**
   * Matches the space that ends a command's name.
   */
  public static readonly acpCommandNameEndPattern: RegExp;

  /**
   * The status of a finished compaction in a `compaction_update`: `completed`.
   */
  public static readonly acpCompactionCompleted: string;

  /**
   * The `compactionId` field of a `compaction_update`, by which a compaction shows once.
   */
  public static readonly acpCompactionIdField: string;

  /**
   * Grok's extension notification for its own session updates, with and without ACP's extension prefix.
   */
  public static readonly xaiSessionNotificationMethods: readonly string[];

  /**
   * Grok's session update for a finished automatic compaction: `auto_compact_completed`.
   */
  public static readonly xaiAutoCompactCompleted: string;

  /**
   * Grok's session update for a retry or a failure: `retry_state`.
   */
  public static readonly xaiRetryState: string;

  /**
   * The type of a `retry_state` for a failure no retry fixes: `failed`.
   */
  public static readonly xaiRetryFailed: string;

  /**
   * The field of a failed `retry_state` that names the error's kind: `errorType`.
   */
  public static readonly xaiErrorTypeField: string;

  /**
   * The error kind of a failed `retry_state` for a full context: `context_length`.
   */
  public static readonly xaiContextLengthError: string;

  /**
   * Grok's extension request that asks the person questions, with and without ACP's extension prefix: `x.ai/ask_user_question`.
   */
  public static readonly xaiAskUserQuestionMethods: readonly string[];

  /**
   * The tool a Grok question comes from, as its question's native kind: `ask_user_question`.
   */
  public static readonly xaiAskUserQuestionTool: string;

  /**
   * The field of the answer to a Grok question that says how it ended: `outcome`.
   */
  public static readonly xaiOutcomeField: string;
  /** The requests Grok hands its plan-mode plan over with, under both names it uses: `_x.ai/exit_plan_mode` and `x.ai/exit_plan_mode`. */
  public static readonly xaiExitPlanModeMethods: readonly string[];
  /** The native kind of a Grok plan's approval: `exit_plan_mode`. */
  public static readonly xaiExitPlanModeTool: string;
  /** The `x.ai/exit_plan_mode` field that holds the plan: `planContent`. */
  public static readonly xaiPlanContentField: string;
  /** The `x.ai/exit_plan_mode` outcome of an approved plan: `approved`. */
  public static readonly xaiApprovedOutcome: string;

  /**
   * The outcome of a Grok question the person answered: `accepted`.
   */
  public static readonly xaiAcceptedOutcome: string;

  /**
   * The answer to a Grok question the person answered only in their own words, whose words go in its notes: "Other".
   */
  public static readonly xaiOtherAnswer: string;

  /**
   * The field of the answer to a Grok question that holds each question's notes: `annotations`.
   */
  public static readonly xaiAnnotationsField: string;

  /**
   * The field of a question's annotation that holds the person's own words: `notes`.
   */
  public static readonly xaiNotesField: string;

  /**
   * Grok's extension update for a sub-agent that started, naming its child session, type and model: `subagent_spawned`.
   */
  public static readonly xaiSubAgentSpawned: string;

  /**
   * Grok's extension update for a running sub-agent's tool calls, tokens and time so far: `subagent_progress`.
   */
  public static readonly xaiSubAgentProgress: string;

  /**
   * Grok's extension update for a sub-agent that ended, with its status, counts and output or error: `subagent_finished`.
   */
  public static readonly xaiSubAgentFinished: string;

  /**
   * Grok's three sub-agent extension updates: spawned, progress and finished.
   */
  public static readonly xaiSubAgentUpdates: readonly string[];

  /**
   * The field of a sub-agent update naming the sub-agent's own session: `child_session_id`.
   */
  public static readonly xaiChildSessionField: string;

  /**
   * The field of a Grok sub-agent update naming the sub-agent itself: `subagent_id`.
   */
  public static readonly xaiSubAgentIdField: string;

  /**
   * The parameter of Grok's sub-agent cancel naming the sub-agent: `subagentId`.
   */
  public static readonly xaiSubAgentIdParam: string;

  /**
   * Grok's request that cancels a running sub-agent, with and without the extension prefix.
   */
  public static readonly xaiSubAgentCancelMethods: readonly string[];

  /**
   * The field of the cancel's `result` that says Grok cancelled a running sub-agent and will report its end: `cancelled`.
   */
  public static readonly xaiCancelledField: string;

  /**
   * The field of `subagent_spawned` naming the sub-agent's type: `subagent_type`.
   */
  public static readonly xaiSubAgentTypeField: string;

  /**
   * The field of `subagent_progress` counting the sub-agent's tool calls: `tool_call_count`.
   */
  public static readonly xaiToolCallCountField: string;

  /**
   * The field of `subagent_finished`, and of the spawn's output, counting the sub-agent's tool calls: `tool_calls`.
   */
  public static readonly xaiToolCallsField: string;

  /**
   * The field of a sub-agent update counting its tokens: `tokens_used`.
   */
  public static readonly xaiTokensUsedField: string;

  /**
   * The field of a sub-agent update, and of the spawn's output, giving its milliseconds: `duration_ms`.
   */
  public static readonly xaiDurationField: string;

  /**
   * The field of a spawn's input that runs the sub-agent in the background: `background`.
   */
  public static readonly xaiBackgroundField: string;

  /**
   * The field of a spawn's input, in its later updates, that runs the sub-agent in the background: `run_in_background`.
   */
  public static readonly xaiRunInBackgroundField: string;

  /**
   * The `_meta` field of a Grok tool call naming Grok's own tool: `x.ai/tool`.
   */
  public static readonly xaiToolMetaField: string;

  /**
   * The `_meta` field of an approval's tool call naming the session that asked, a sub-agent's when it asked: `x.ai/requestingSessionId`.
   */
  public static readonly xaiRequestingSessionField: string;

  /**
   * Grok's tool that starts a sub-agent: `spawn_subagent`.
   */
  public static readonly xaiSpawnSubAgentTool: string;

  /**
   * A finished sub-agent's status by Grok's: completed, failed, and cancelled as Stopped.
   */
  public static readonly xaiSubAgentStatuses: ReadonlyMap<string, import("@noldova/teamrun.protocol").SubAgentStatus>;

  /**
   * The `_meta` field of a Copilot tool call holding Copilot's own values: `github.com/copilot`.
   */
  public static readonly copilotMetaField: string;

  /**
   * The field of Copilot's `_meta` values naming the sub-agent that made a tool call: `agentId`.
   */
  public static readonly copilotAgentIdField: string;

  /**
   * The field of a Copilot sub-agent's input giving its type: `agent_type`.
   */
  public static readonly copilotAgentTypeField: string;

  /**
   * The field of a Copilot sub-agent's input saying how it runs: `mode`.
   */
  public static readonly copilotModeField: string;

  /**
   * The `mode` of a Copilot sub-agent that runs on after its spawn's call ends: `background`.
   */
  public static readonly copilotBackgroundMode: string;

  /**
   * The notification Copilot sends a session event on when the client asked for it, with and without ACP's extension prefix:
   * `_github.com/copilot/sessionEvent` and `github.com/copilot/sessionEvent`.
   */
  public static readonly copilotSessionEventMethods: readonly string[];

  /**
   * The field of Copilot's `_meta` values in `initialize`'s client capabilities listing the session events it should send: `events`.
   */
  public static readonly copilotEventsField: string;

  /**
   * The session event saying which spawn's tool call started a sub-agent with which `agentId`: `subagent.started`.
   */
  public static readonly copilotSubAgentStarted: string;

  /**
   * The session event saying a sub-agent ended, with its model, `totalToolCalls`, `totalTokens`, `durationMs` and whether it was `cancelled`: `subagent.completed`.
   */
  public static readonly copilotSubAgentCompleted: string;

  /**
   * The field of `subagent.completed` that counts the sub-agent's tool calls: `totalToolCalls`.
   */
  public static readonly copilotTotalToolCallsField: string;

  /**
   * The field of `subagent.completed` that is `true` when the sub-agent was cancelled: `cancelled`.
   */
  public static readonly copilotCancelledField: string;

  /**
   * The field of Antigravity's `invoke_subagent` input that lists the sub-agents it starts: `Subagents`.
   */
  public static readonly antigravitySubagentsField: string;

  /**
   * The field of an Antigravity sub-agent that names its type: `TypeName`.
   */
  public static readonly antigravityTypeNameField: string;

  /**
   * The field of an Antigravity sub-agent that names its role, the row's description: `Role`.
   */
  public static readonly antigravityRoleField: string;

  /**
   * The title of the tool call that Antigravity sends after `invoke_subagent` to start the sub-agent; it ends `failed` when the sub-agent couldn't start:
   * `Running start_subagent`.
   */
  public static readonly antigravityStartSubAgentTitle: string;

  /**
   * The kind of Copilot's `read_agent` tool call, which reads a background sub-agent's replies: `read`.
   */
  public static readonly copilotReadKind: string;

  /**
   * The field of a `read_agent` call's input that names the sub-agent it reads: `agent_id`.
   */
  public static readonly copilotReadAgentIdField: string;

  /**
   * What starts each of a sub-agent's turns in a `read_agent` call's output: a blank line, then `[Turn n]` on its own line.
   */
  public static readonly copilotTurnPattern: RegExp;

  /**
   * Finds the sub-agent's status in the first part of a `read_agent` call's output, such as `status: idle`.
   */
  public static readonly copilotAgentStatusPattern: RegExp;

  /**
   * The statuses a `read_agent` call's output gives a background sub-agent that has replied and ended its work: `idle` and `completed`.
   */
  public static readonly copilotFinishedStatuses: readonly string[];

  /**
   * What goes between a background sub-agent's replies in its row's summary: a blank line.
   */
  public static readonly copilotRepliesSeparator: string;

  /**
   * The field of OpenCode's `task` permission request naming the sub-agent it starts: `subagent_type`.
   */
  public static readonly opencodeSubAgentTypeField: string;

  /**
   * The name an approval gives a Copilot sub-agent while two or more could have asked: `A sub-agent`.
   */
  public static readonly acpUnnamedSubAgent: string;

  /**
   * What an ACP sub-agent whose spawn gave no description is called: "Sub-agent".
   */
  public static readonly acpSubAgentDescription: string;

  /**
   * The status of an ACP tool call that failed: `failed`.
   */
  public static readonly acpFailedStatus: string;

  /**
   * Grok's extension notification for a command it moved to the background, with and without ACP's extension prefix.
   */
  public static readonly xaiTaskBackgroundedMethods: readonly string[];
  /**
   * Grok's extension notification for a background command that ended, with and without ACP's extension prefix.
   */
  public static readonly xaiTaskCompletedMethods: readonly string[];
  /**
   * The fields of Grok's task notifications: `task_id`, `tool_call_id`, `task_snapshot`, `exit_code`, `explicitly_killed` and `will_wake`.
   */
  public static readonly xaiTaskIdField: string;
  public static readonly xaiToolCallIdField: string;
  public static readonly xaiTaskSnapshotField: string;
  /**
   * Grok's list of a session's background tasks, `background_tasks`, its `tasks` field and a listed task's `running` status.
   */
  public static readonly xaiBackgroundTasks: string;
  public static readonly xaiTasksField: string;
  public static readonly xaiRunningStatus: string;
  /**
   * The raw output type of the tool call update that says a command moved to the background, `BackgroundTaskStarted`, and its process id field, `pid`.
   */
  public static readonly xaiBackgroundTaskStarted: string;
  public static readonly xaiProcessIdField: string;
  public static readonly xaiExitCodeField: string;
  public static readonly xaiExplicitlyKilledField: string;
  public static readonly xaiWillWakeField: string;
  /**
   * Grok's session update that ends a prompt, `turn_completed`, and its `stop_reason` field.
   */
  public static readonly xaiTurnCompleted: string;
  public static readonly xaiStopReasonField: string;
  /**
   * The prompt id Grok puts in an update's `_meta.promptId`, or a session update's `prompt_id`.
   */
  public static readonly xaiPromptIdField: string;
  public static readonly xaiPromptIdSnakeField: string;
  /**
   * How the id of the prompt Grok starts on its own when a background task ends begins: `task-completed-`, followed by the task's id.
   */
  public static readonly xaiWakePromptPrefix: string;

  /**
   * How the id of the prompt Grok starts on its own when a background sub-agent ends begins: `subagent-completed-`, followed by the sub-agent's id.
   */
  public static readonly xaiSubAgentWakePromptPrefix: string;
  /**
   * The output field of a Grok task's snapshot: `output`.
   */
  public static readonly outputField: string;
  public static readonly acpMessageChunk: string;
  public static readonly acpThoughtChunk: string;
  /**
   * The ACP update that echoes the person's prompt: `user_message_chunk`.
   */
  public static readonly acpUserChunk: string;
  /**
   * The `_meta` field of Grok's prompt echo that numbers the prompt in its session from 0: `promptIndex`.
   */
  public static readonly xaiPromptIndexField: string;
  /**
   * What a prompt index, as a turn id, looks like: digits only.
   */
  public static readonly promptIndexPattern: RegExp;
  public static readonly acpToolCall: string;
  public static readonly acpToolUpdate: string;
  /**
   * The ACP session update that sends the agent's plan: `plan`.
   */
  public static readonly acpPlanUpdate: string;
  public static readonly acpEntriesField: string;
  public static readonly acpPlanStatuses: Readonly<Record<string, PlanStepStatus>>;
  public static readonly planDetailId: string;
  public static readonly planTextDetailId: string;
  /**
   * The ACP session update that sends the session's context use and cost: `usage_update`.
   */
  public static readonly acpUsageUpdate: string;
  /**
   * The `session/update` kind that carries the agent's own title for the session.
   */
  public static readonly acpSessionInfoUpdate: string;
  /** Each run of white space in a title or prompt, which comparing them treats as one space. */
  public static readonly acpTitleSpaces: RegExp;
  /** The ellipsis an agent may end a title with when it cuts the prompt to make one. */
  public static readonly acpTitleCutEnd: RegExp;
  /**
   * The Codex features every thread turns off, Codex's own computer use and browser use, so the computer and browser-use tools a teammate has are TeamRun's.
   */
  public static readonly codexOwnComputerToolsOff: JsonObject;
  /**
   * The Codex settings of a thread with no tools.
   */
  public static readonly codexNoToolsConfig: JsonObject;
  /**
   * Why a title session failed when a provider asked for something with no way to refuse it.
   */
  /**
   * Codex's token use and rate limits: the notifications, the read and their fields.
   */
  public static readonly tokenUsageUpdatedNotification: string;
  /**
   * The notifications of a Codex sub-agent's child thread that its row reads, and the only ones held for a child no call named yet.
   */
  public static readonly codexChildNotifications: readonly string[];
  public static readonly rateLimitsUpdatedNotification: string;
  public static readonly rateLimitsReadMethod: string;
  public static readonly tokenUsageField: string;
  public static readonly totalField: string;
  public static readonly lastField: string;
  public static readonly inputTokensField: string;
  public static readonly outputTokensField: string;
  public static readonly totalTokensField: string;
  public static readonly cachedInputTokensField: string;
  public static readonly cacheWriteInputTokensField: string;
  public static readonly reasoningOutputTokensField: string;
  public static readonly modelContextWindowField: string;
  public static readonly rateLimitsField: string;
  public static readonly limitIdField: string;
  public static readonly codexLimitId: string;
  public static readonly primaryField: string;
  public static readonly secondaryField: string;
  /**
   * Codex's credits snapshot fields.
   */
  public static readonly creditsField: string;
  public static readonly hasCreditsField: string;
  public static readonly unlimitedField: string;
  public static readonly balanceField: string;
  public static readonly windowDurationMinsField: string;
  public static readonly usedPercentField: string;
  public static readonly resetsAtField: string;
  /**
   * The length in minutes of Codex's five-hour window.
   */
  public static readonly codexFiveHourMinutes: number;
  /**
   * The length in minutes of Codex's weekly window.
   */
  public static readonly codexWeeklyMinutes: number;
  public static readonly millisecondsPerSecond: number;
  public static readonly percentScale: number;
  /**
   * Claude Code's reply usage, context use and plan use: their fields and window names.
   */
  public static readonly claudeModelUsageField: string;
  public static readonly claudeCacheReadInputTokensField: string;
  public static readonly claudeCacheCreationInputTokensField: string;
  public static readonly claudeTotalCostField: string;
  public static readonly claudeTotalTokensField: string;
  public static readonly claudeMaxTokensField: string;
  public static readonly claudeContextWindowField: string;
  public static readonly claudeAutoCompactEnabledField: string;
  public static readonly claudeAutoCompactThresholdField: string;
  public static readonly claudeRateLimitsAvailableField: string;
  public static readonly rateLimitsSnakeField: string;
  public static readonly claudeFiveHourWindow: string;
  public static readonly claudeSevenDayWindow: string;
  public static readonly claudeSevenDayOpusWindow: string;
  public static readonly claudeSevenDaySonnetWindow: string;
  public static readonly claudeUtilizationField: string;
  public static readonly claudeResetsAtField: string;
  /**
   * The sizes Claude Code's `autoCompactWindow` setting takes, in tokens: from 100K to 1M, which it caps at the model's window.
   */
  public static readonly claudeAutoCompactWindowMinimum: number;
  public static readonly claudeAutoCompactWindowMaximum: number;
  /**
   * The context windows offered by name, in tokens: 200K, 400K and 1M, each up to the model's window.
   */
  public static readonly claudeContextWindowPresets: readonly number[];
  /**
   * The detail TeamRun asks Claude Code's context use in: "summary".
   */
  public static readonly claudeContextDetail: "summary";
  /**
   * How long in milliseconds a turn waits for Claude Code's context use before it leaves it blank.
   */
  public static readonly claudeUsageTimeout: number;
  public static readonly planUsageTimedOut: string;
  /**
   * An ACP prompt's usage and context use, and Grok's session info and billing: their fields, periods and methods.
   */
  public static readonly usageField: string;
  /**
   * Claude's cache writes in a result's usage, and those written for the one-hour prompt cache.
   */
  public static readonly claudeCacheCreationField: string;
  public static readonly claudeHourCacheWritesField: string;
  public static readonly contextField: string;
  public static readonly acpUsedField: string;
  public static readonly acpSizeField: string;
  /**
   * A usage update's cost, the session's so far: its amount and currency; only US dollars are read.
   */
  public static readonly acpCostField: string;
  public static readonly acpAmountField: string;
  public static readonly acpCurrencyField: string;
  public static readonly acpUsdCurrency: string;
  public static readonly acpCachedReadTokensField: string;
  public static readonly acpCachedWriteTokensField: string;
  public static readonly acpThoughtTokensField: string;
  public static readonly xaiCostTicksField: string;
  public static readonly xaiCachedReadTokensField: string;
  public static readonly xaiCacheCreationTokensField: string;
  public static readonly xaiReasoningTokensField: string;
  /**
   * How many of Grok's cost ticks make a US dollar.
   */
  public static readonly xaiTicksPerUsd: number;
  public static readonly xaiContextUsedField: string;
  public static readonly xaiContextTotalField: string;
  public static readonly xaiAutoCompactPercentField: string;
  public static readonly xaiCurrentPeriodField: string;
  public static readonly xaiPeriodEndField: string;
  public static readonly xaiCreditUsagePercentField: string;
  public static readonly xaiWeeklyPeriod: string;
  public static readonly xaiMonthlyPeriod: string;
  /**
   * Grok's session-info method, under the extension prefix ACP gives it and without it.
   */
  public static readonly xaiSessionInfoMethods: readonly string[];
  /**
   * Grok's model-list method, which answers its catalog once loaded, waiting a bounded time for the first one, under the extension prefix ACP
   * gives it and without it.
   */
  public static readonly xaiModelListMethods: readonly string[];
  /**
   * Grok's session-fork method, under the extension prefix ACP gives it and without it.
   */
  public static readonly xaiSessionForkMethods: readonly string[];
  /**
   * The session-fork request's session to fork: `sourceSessionId`.
   */
  public static readonly xaiSourceSessionIdField: string;
  /**
   * The session-fork request's folder of the session to fork: `sourceCwd`.
   */
  public static readonly xaiSourceCwdField: string;
  /**
   * The session-fork request's folder of the new session: `newCwd`.
   */
  public static readonly xaiNewCwdField: string;
  /**
   * The session-fork request's last prompt to keep, with its reply: `targetPromptIndex`.
   */
  public static readonly xaiTargetPromptIndexField: string;
  /**
   * The session-fork answer's new session: `newSessionId`.
   */
  public static readonly xaiNewSessionIdField: string;
  /**
   * Grok's billing method, under the extension prefix ACP gives it and without it.
   */
  public static readonly xaiBillingMethods: readonly string[];
  public static readonly xaiInterjectMethods: readonly string[];
  /**
   * Grok's account method, under the extension prefix ACP gives it and without it.
   */
  public static readonly xaiAuthInfoMethods: readonly string[];
  /**
   * Grok's list of its own MCP servers, under the extension prefix ACP gives it and without it.
   */
  public static readonly xaiMcpListMethods: readonly string[];
  /**
   * The field of Grok's MCP server list that holds its servers: `servers`.
   */
  public static readonly serversField: string;
  /**
   * The field of Grok's account answer that names its sign-in method: `methodId`.
   */
  public static readonly xaiMethodIdField: string;
  /**
   * The field of Grok's account answer that names its organization: `organizationName`.
   */
  public static readonly xaiOrganizationNameField: string;
  /**
   * The field of Grok's account answer that names its team, read when it names no organization: `teamName`.
   */
  public static readonly xaiTeamNameField: string;
  /**
   * The field of Grok's billing answer that names its plan: `subscription_tier`, which Grok sends unrenamed.
   */
  public static readonly xaiSubscriptionTierField: string;
  /**
   * Copilot's quota snapshot fields.
   */
  public static readonly copilotSnapshotsField: string;
  public static readonly copilotPremiumInteractionsField: string;
  public static readonly copilotChatField: string;
  public static readonly copilotCompletionsField: string;
  public static readonly copilotEntitlementField: string;
  public static readonly copilotUsedRequestsField: string;
  public static readonly copilotUnlimitedField: string;
  public static readonly copilotRemainingPercentageField: string;
  public static readonly copilotResetDateField: string;
  public static readonly copilotProviderQuotasField: string;
  public static readonly copilotTokenBillingField: string;
  public static readonly copilotAcquisitionStatusField: string;
  public static readonly copilotSucceededStatus: string;
  public static readonly copilotAccessStateField: string;
  public static readonly copilotDeniedState: string;
  public static readonly copilotCapacityStateField: string;
  public static readonly copilotExhaustedState: string;
  public static readonly copilotUnlimitedState: string;
  public static readonly copilotHasQuotaField: string;
  public static readonly copilotQuotaRefusal: RegExp;
  public static readonly copilotRefusalDataFields: readonly string[];
  /**
   * The whole of a Copilot reply that is its refusal, trimmed: one line of "Error: " and a message of at most 200 characters, then an
   * optional "(Request ID: …)"; the message, group 1, is a refusal for quota when it matches `copilotQuotaRefusal`.
   */
  public static readonly copilotRefusalReply: RegExp;
  public static readonly copilotNoQuotaStates: readonly string[];
  public static readonly copilotQuantityKindField: string;
  public static readonly copilotAuthoritativeBudget: string;
  public static readonly copilotEntitledQuantityField: string;
  public static readonly copilotCompatibilityKeyField: string;
  public static readonly copilotUnitField: string;
  public static readonly copilotAiCreditsUnit: string;
  public static readonly copilotBudgetMetadataField: string;
  public static readonly copilotBudgetEntitlementField: string;
  public static readonly copilotConsumedField: string;
  public static readonly copilotResetAtField: string;
  public static readonly copilotUnlimitedQuantity: number;
  public static readonly acpRequestPermission: string;
  public static readonly acpElicitationCreate: string;
  public static readonly acpTerminalCreate: string;
  public static readonly acpTerminalOutput: string;
  public static readonly acpTerminalWaitForExit: string;
  public static readonly acpTerminalKill: string;
  public static readonly acpTerminalRelease: string;
  public static readonly acpTerminalMethods: readonly string[];
  public static readonly acpTerminalIdField: string;
  public static readonly acpTerminalType: string;
  public static readonly acpArgsField: string;
  public static readonly acpEnvField: string;
  public static readonly acpOutputByteLimitField: string;
  public static readonly acpTruncatedField: string;
  public static readonly acpExitStatusField: string;
  public static readonly acpSignalField: string;
  public static readonly acpTerminalIdPrefix: string;
  public static readonly acpTerminalCommandSeparator: string;
  public static readonly acpTerminalOutputLimit: number;
  public static readonly acpEndedToolStatuses: readonly string[];
  public static readonly acpTerminalOtherSession: string;
  public static readonly utf8ContinuationMask: number;
  public static readonly utf8ContinuationBits: number;
  public static readonly acpModeField: string;
  public static readonly acpFormMode: string;
  public static readonly acpRequestedSchemaField: string;
  public static readonly acpPropertiesField: string;
  public static readonly acpItemsField: string;
  public static readonly acpEnumField: string;
  public static readonly acpOneOfField: string;
  public static readonly acpAnyOfField: string;
  public static readonly acpConstField: string;
  public static readonly acpArrayType: string;
  public static readonly acpBooleanType: string;
  public static readonly acpNumberType: string;
  public static readonly acpIntegerType: string;
  public static readonly acpActionField: string;
  public static readonly acpAcceptAction: string;
  public static readonly acpDeclineAction: string;
  public static readonly acpCancelAction: string;
  public static readonly acpCancelRequest: string;
  public static readonly acpRequestIdField: string;
  public static readonly yesLabel: string;
  public static readonly noLabel: string;
  public static readonly acpToolCallField: string;
  public static readonly acpToolCallIdField: string;
  public static readonly acpOptionIdField: string;
  public static readonly acpLocationsField: string;
  public static readonly grokToolTitle: string;
  public static readonly acpOtherKind: string;
  public static readonly acpExecuteKind: string;
  public static readonly acpEditKind: string;
  public static readonly acpCompletedStatus: string;
  public static readonly acpDiffType: string;
  public static readonly acpOldTextField: string;
  public static readonly acpNewTextField: string;
  public static readonly addChangeKind: string;
  public static readonly updateChangeKind: string;
  public static readonly deleteChangeKind: string;
  public static readonly moveChangeKind: string;
  public static readonly movePathField: string;
  public static readonly changeVerbs: ReadonlyMap<string, string>;
  public static readonly otherChangeVerb: string;
  public static readonly noFileChangesTitle: string;
  public static readonly changeGroupSeparator: string;
  public static readonly diffRemovedPrefix: string;
  public static readonly diffAddedPrefix: string;
  public static readonly acpAllowOnce: string;
  public static readonly antigravityQuestionIdPrefix: string;
  public static readonly acpRejectOnce: string;
  public static readonly acpSelected: string;
  public static readonly acpCancelled: string;
  /** The option id of a plan approval that approves the plan: `approve-plan`. */
  public static readonly acpApprovePlanOption: string;
  /** The option id of a plan approval that refuses the plan and keeps planning: `keep-planning`. */
  public static readonly acpKeepPlanningOption: string;
  /** The label of `acpApprovePlanOption`: Approve plan. */
  public static readonly approvePlanLabel: string;
  /** The label of `acpKeepPlanningOption`: Keep planning. */
  public static readonly keepPlanningLabel: string;
  public static readonly acpJsonRpcVersion: string;
  public static readonly acpMaximumPending: number;
  public static readonly acpMaximumBufferedCharacters: number;
  public static readonly acpKillWait: number;
  public static readonly acpAlreadyStarted: string;
  public static readonly acpDisconnected: string;
  public static readonly acpTooManyRequests: string;
  public static readonly acpDidNotStop: string;
  public static readonly acpFrameTooLarge: string;
  public static readonly acpInvalidFrame: string;
  public static readonly acpUnsupportedRequest: string;
  public static readonly acpUnsupportedCode: number;
  public static readonly acpInvalidParamsCode: number;
  public static readonly spawnEvent: string;
  public static readonly grokLogsDirectory: string;
  public static readonly grokUnifiedLogFile: string;
  public static readonly grokLogTailBytes: number;
  public static readonly grokLogTimeField: string;
  public static readonly grokLogMessageField: string;
  public static readonly grokLogContextField: string;
  public static readonly grokLogServerField: string;
  public static readonly grokLogReasonField: string;
  public static readonly grokMcpBlockedMessage: string;
  public static readonly grokExcludedEnvironment: RegExp;
  public static readonly grokProfileExcludedEnvironment: RegExp;
  public static readonly grokHomeVariable: string;
  /**
   * Grok's variables a launch outside a chat turn sets to `0`: its memory, and the managed and Claude's, Cursor's and Codex's MCP servers and
   * hooks it would load; Grok 1.0.70 has no variable for the person's own `config.toml` servers and hooks.
   */
  public static readonly grokBackgroundOffVariables: readonly string[];
  /**
   * Grok's variables a title session sets to `0`: those of `grokBackgroundOffVariables`, and the rules, skills and agents Grok would load from
   * Claude's, Cursor's and Codex's folders.
   */
  public static readonly grokTitleOffVariables: readonly string[];
  /**
   * The person's variables a title session leaves out, since they name a Grok configuration of theirs.
   */
  public static readonly grokTitleDroppedVariables: readonly string[];
  public static readonly grokAuthPathVariable: string;
  public static readonly grokAuthFile: string;
  public static readonly grokProfileEntries: readonly string[];
  /**
   * The folder beside the one TeamRun once made for Grok, in TeamRun's data folder, that a title session runs in as its Grok home.
   */
  public static readonly grokTitleHomeFolder: string;
  public static readonly homeVariable: string;
  public static readonly userProfileVariable: string;
  public static readonly appDataVariable: string;
  public static readonly localAppDataVariable: string;
  public static readonly systemRootVariable: string;
  public static readonly xdgConfigVariable: string;
  public static readonly xdgDataVariable: string;
  public static readonly xauthorityVariable: string;
  public static readonly browserVariable: string;
  public static readonly signInVariables: readonly string[];
  public static readonly localAppDataDirectory: string;
  public static readonly grokDisabledValue: string;
  public static readonly grokFolderTrustVariable: string;
  public static readonly opencodeKindId: string;
  public static readonly opencodeDisplayName: string;
  public static readonly opencodeExecutableName: string;
  public static readonly opencodeWindowsExecutableName: string;
  public static readonly opencodeWindowsShimName: string;
  public static readonly opencodeDirectoryName: string;
  public static readonly opencodePackageName: string;
  public static readonly opencodeWindowsPackagePrefix: string;
  public static readonly opencodeBaselineSuffix: string;
  public static readonly opencodeArguments: readonly string[];
  public static readonly opencodeAuthMethod: string;
  public static readonly opencodeSignInCommand: string;
  /**
   * The command OpenCode's Sign out runs in a terminal with the profile's variables, which ends the sign-out when it ends.
   */
  public static readonly opencodeSignOutCommand: string;
  public static readonly opencodeToolTitle: string;
  /** What a sign-in failure says: how to sign OpenCode in. */
  public static readonly opencodeSignInHint: string;
  /** OpenCode's data home under the person's home folder when `XDG_DATA_HOME` names none, on every system. */
  public static readonly opencodeUsualDataFolder: string;
  /** What marks a folder as an OpenCode data folder: its sign-in. */
  public static readonly opencodeProfileEntries: readonly string[];
  /** The agents a chat of OpenCode runs in, whose own rules TeamRun's approval rules go over. */
  public static readonly opencodeChatAgents: readonly string[];
  /** The sub-agents OpenCode brings itself, whose own rules TeamRun's refusals go over. */
  public static readonly opencodeSubAgents: readonly string[];
  /** What keeps a chat's agent there for TeamRun to select, whatever a configuration says: on, and a primary agent that isn't hidden. */
  public static readonly opencodeChatAgentState: Readonly<Record<string, boolean | string>>;
  /** OpenCode's tool that starts a sub-agent, whose rule names the sub-agent. */
  public static readonly opencodeTaskTool: string;
  /** The deprecated field of OpenCode's configuration that names agents too, which OpenCode merges into its agents after every other configuration but the rules variable. */
  public static readonly opencodeModeField: string;
  /** What the own-MCP-servers switch leaves for OpenCode while off: the servers still start, since OpenCode has no setting that turns them all off, and only their tools are refused. */
  public static readonly opencodeOwnMcpServersNote: string;
  /** `opencodeOwnMcpServersNote` in a few words for the MCP servers page's row, `uses its own while on`. */
  public static readonly opencodeOwnMcpServersShortNote: string;
  /** OpenCode's tool that reads a file, whose rule names the file. */
  public static readonly opencodeReadTool: string;
  /** OpenCode's read-only tools besides `read`, which every agent may run, the built-in sub-agents and the person's own agents too. */
  public static readonly opencodeReadOnlyTools: readonly string[];
  /** OpenCode's to-do tool, which every agent may run but the built-in sub-agents, as in OpenCode. */
  public static readonly opencodeTodoTool: string;
  /** The files OpenCode asks before reading by default: `.env` files. */
  public static readonly opencodeEnvFilePatterns: readonly string[];
  /** The `.env` file OpenCode reads without asking by default: an example's. */
  public static readonly opencodeEnvExamplePattern: string;
  /** The field of OpenCode's configuration that names its agents. */
  public static readonly opencodeAgentField: string;
  /** The field of an agent in OpenCode's configuration that holds its rules. */
  public static readonly opencodePermissionField: string;
  /** What leaves an added provider's launch: keys, tokens and what names another account, so it uses its own sign-in. */
  public static readonly opencodeAddedExcludedEnvironment: RegExp;
  /**
   * A chat's agents' rules, over the rules under every agent's own: OpenCode's read-only tools and its to-do tool run, with a `.env` file's read asking; every
   * tool TeamRun asks about, and TeamRun's own, ask, Plan's edits are denied, and the approved tools of TeamRun are allowed. They name no tool TeamRun doesn't
   * know, which follows the rules under them: a rule an agent's own settings give it comes before its rules from TeamRun, so a rule for every tool there would
   * win over that rule's tool.
   */
  public static opencodeAskRules(server: string, approvedTools: readonly string[], plans: boolean): Readonly<Record<string, string | Readonly<Record<string, string>>>>;
  /**
   * The built-in sub-agents' rules, since a sub-agent's approval request gets no answer over ACP: every tool is refused but OpenCode's read-only tools, without
   * a `.env` file's read, and the approved tools of TeamRun.
   */
  public static opencodeSubAgentRules(server: string, approvedTools: readonly string[]): Readonly<Record<string, string | Readonly<Record<string, string>>>>;
  /**
   * The rules under every agent's own: a tool TeamRun doesn't know, such as one of the person's own MCP servers or custom tools, asks while their own tools
   * are on and is refused while off; OpenCode's read-only tools and its to-do tool run, without a `.env` file's read; every tool TeamRun asks about, and TeamRun's
   * own, are refused, and the approved tools of TeamRun are allowed.
   */
  public static opencodeRefuseRules(server: string, approvedTools: readonly string[], ownTools: boolean): Readonly<Record<string, string | Readonly<Record<string, string>>>>;
  /**
   * Allow All's rules: every tool by name, then everything while the person's own tools are on; while off, the rules under every agent's own refuse a tool
   * TeamRun doesn't know first, and an agent's own rules name only the tools they allow.
   * @param under Whether these are the rules under every agent's own.
   */
  public static opencodeAllowAllRules(server: string, ownTools: boolean, under: boolean): Readonly<Record<string, string>>;
  public static readonly opencodeNotFound: string;
  public static readonly opencodeSignInUnavailable: string;
  public static readonly opencodeExcludedEnvironment: RegExp;
  public static readonly opencodeConfigContentVariable: string;
  public static readonly opencodePermissionVariable: string;
  public static readonly opencodePureVariable: string;
  public static readonly opencodePureValue: string;
  public static readonly gitDirectoryName: string;
  public static readonly opencodeAskedTools: readonly string[];
  public static readonly opencodeVersionPattern: RegExp;
  public static readonly opencodeMinimumVersion: readonly number[];
  public static readonly opencodeUnsupportedMajor: number;
  public static readonly antigravityKindId: string;
  public static readonly antigravityDisplayName: string;
  public static readonly antigravityToolTitle: string;
  public static readonly antigravityVersion: string;
  /**
   * The Antigravity server versions TeamRun accepts: any patch of the pinned major and minor, `1.3.x`.
   */
  public static readonly antigravityAcceptedVersionPattern: RegExp;
  public static readonly antigravityAuthMethod: string;
  public static readonly antigravityExecutableName: string;
  public static readonly antigravityWindowsExecutableName: string;
  public static readonly antigravityHarnessName: string;
  public static readonly antigravityWindowsHarnessName: string;
  public static readonly antigravityLinuxArguments: readonly string[];
  public static readonly antigravityNotFound: string;
  public static readonly antigravitySignInUnavailable: string;
  public static readonly antigravityProfileAbsolute: string;
  public static readonly antigravityProfileNotManaged: string;
  public static readonly antigravityProfileMarkerValue: string;
  public static readonly antigravityTokenSegments: readonly string[];
  public static readonly antigravityModelsFile: string;
  public static readonly antigravityModelsField: string;
  public static readonly antigravityTempKeyLength: number;
  public static readonly antigravityHomeVariable: string;
  public static readonly antigravityDirectoryName: string;
  public static readonly antigravityInstructionFiles: readonly string[];
  public static readonly antigravityConfigFolder: string;
  public static readonly antigravityRulesFolder: string;
  public static readonly antigravityProjectRulesFolders: readonly (readonly string[])[];
  /**
   * Matches an Antigravity rule whose front matter's `trigger` is `manual`, which Antigravity applies only when the person mentions it with @.
   */
  public static readonly antigravityManualRule: RegExp;
  public static readonly antigravityPersonFolders: readonly (readonly string[])[];
  public static readonly antigravityHiddenHomeFolder: string;
  public static readonly antigravitySignInFolder: string;
  public static readonly antigravityNotALink: string;
  public static readonly antigravityFileStorageVariable: string;
  public static readonly antigravityHarnessVariable: string;
  /** Why Antigravity takes no shared MCP server: Antigravity 1.3.0 writes a session's servers, with their values, into its conversation database. */
  public static readonly antigravitySharedServersKept: string;
  /** `antigravitySharedServersKept` in a few words, `would keep it in its files`. */
  public static readonly antigravitySharedServersKeptShort: string;
  /** `formatSavedSecretsStdioOnly` in a few words, `saved secrets reach its stdio servers only`. */
  public static readonly savedSecretsStdioOnlyShort: string;
  /** `formatSavedSecretsFromEnvironmentOnly` in a few words, `reads values only from its environment`. */
  public static readonly savedSecretsFromEnvironmentOnlyShort: string;
  /** `formatSharedMcpUnconfirmed` in a few words, `not confirmed yet`. */
  public static readonly sharedMcpUnconfirmedShort: string;
  public static readonly antigravityExcludedEnvironment: RegExp;
  public static readonly antigravityReleases: readonly { readonly target: string; readonly file: string; readonly sha256: string; readonly archiveBytes: number; readonly executableBytes: number; readonly harnessBytes: number }[];
  public static readonly antigravityDownloadBase: string;
  public static readonly antigravityNoRelease: string;
  public static readonly antigravityNoUnzip: string;
  /**
   * The start of a staging folder's name, TeamRun's own, which an install removes when an earlier one left it behind; another tool's `.staging-` folders are kept.
   */
  public static readonly stagingPrefix: string;
  public static readonly antigravityArchiveName: string;
  public static readonly antigravityMemberMismatch: string;
  public static readonly macPlatform: string;
  public static readonly x64Architecture: string;
  public static readonly codesignArguments: readonly string[];
  public static readonly antigravityEntitlementsName: string;
  public static readonly antigravityEntitlements: string;
  public static readonly acceptEncodingHeader: string;
  public static readonly identityEncoding: string;
  public static readonly executableMode: number;
  public static readonly removeRetries: number;
  /** The most bytes a release download of no published size may have: 1 GiB. */
  public static readonly releaseDownloadLimit: number;
  /** The file-system error codes that mean a folder can't be written: EACCES, EPERM and EROFS. */
  public static readonly unwritableErrorCodes: readonly string[];
  /** The file-system error codes a rename on Windows is tried again on, while something such as a virus scanner still holds a file just run: EPERM, EACCES and EBUSY. */
  public static readonly renameRetryCodes: readonly string[];
  /** The wait before a refused rename's first new try, doubled after each until `renameRetryLongestDelay`: 50 ms. */
  public static readonly renameRetryFirstDelay: number;
  /** The longest wait between a refused rename's tries: 1 s. */
  public static readonly renameRetryLongestDelay: number;
  /** The most a refused rename waits in all before it fails with its error: 10 s. */
  public static readonly renameRetryLimit: number;
  /** The name, in an install's staging folder, the build it just ran is moved to before anything installed is moved: `ready`. */
  public static readonly installReadyName: string;
  /** What a Grok command's name in the staging folder takes on when it's moved before anything installed is moved: `.ready`. */
  public static readonly installReadySuffix: string;
  public static readonly readFlag: string;
  public static readonly parentSegment: string;
  public static readonly zipRootedName: RegExp;
  public static readonly zipNameSeparators: RegExp;
  public static readonly zipEndSignature: number;
  public static readonly zipCentralSignature: number;
  public static readonly zip64LocatorSignature: number;
  public static readonly zip64EndSignature: number;
  public static readonly zipEndRecordBytes: number;
  public static readonly zipMaxCommentBytes: number;
  public static readonly zipCentralHeaderBytes: number;
  public static readonly zip64LocatorBytes: number;
  public static readonly zip64EndRecordBytes: number;
  public static readonly zipUint16Max: number;
  public static readonly zipUint32Max: number;
  public static readonly zipUnixHost: number;
  public static readonly fileTypeMask: number;
  public static readonly symbolicLinkType: number;
  public static readonly antigravityArchiveUnsafe: string;
  public static readonly unzipExecutableName: string;
  public static readonly unzipWindowsExecutableName: string;
  public static readonly tarWindowsExecutableName: string;
  public static readonly tarCommandName: string;
  public static readonly tarMacPath: string;
  public static readonly tarExtractArguments: readonly string[];
  public static readonly tarDirectoryArgument: string;
  public static readonly unzipArguments: readonly string[];
  public static readonly unzipDirectoryArgument: string;
  public static readonly modelDisplayNameField: string;
  public static readonly modelDescriptionField: string;
  public static readonly modelIsDefaultField: string;
  public static readonly supportedReasoningEffortsField: string;
  public static readonly inputModalitiesField: string;
  public static readonly nextCursorField: string;
  public static readonly cursorField: string;
  public static readonly maximumModelPages: number;
  public static readonly modelCatalogTooLarge: string;
  public static readonly modelDiscoveryTimedOut: string;
  public static readonly claudeDefaultModel: string;
  public static readonly claudeModelVersion: RegExp;
  public static readonly claudeModelNoteStart: string;
  public static readonly claudeModelVersionStart: RegExp;
  public static readonly claudeModelId: RegExp;
  public static readonly streamInterval: number;
  public static readonly diffField: string;
  public static readonly maximumItemJsonLength: number;
  public static readonly agentMessageDeltaNotification: string;
  public static readonly deltaField: string;
  public static readonly userMessageItemType: string;
  public static readonly streamEventType: "stream_event";
  public static readonly messageStartEventType: "message_start";
  public static readonly contentBlockDeltaEventType: "content_block_delta";
  public static readonly textDeltaType: "text_delta";
  public static readonly thinkingDeltaType: "thinking_delta";
  public static readonly streamIdPrefix: string;
  public static readonly streamIntervalParameterName: string;
  public static readonly resumeRetryDelayParameterName: string;
  public static readonly wakeGraceParameterName: string;
  public static readonly taskOutputIntervalParameterName: string;
  public static readonly accountTimeoutParameterName: string;
  public static readonly modelListTimeoutParameterName: string;
  public static readonly silenceLimitParameterName: string;
  public static readonly idleLimitParameterName: string;
  /**
   * Codex local-image input discriminator.
   */
  public static readonly localImageInputType: string;
  /**
   * Claude image block discriminator.
   */
  public static readonly imageInputType: "image";
  /**
   * Claude base64 image source discriminator.
   */
  public static readonly base64SourceType: "base64";
  /**
   * PNG image media type.
   */
  public static readonly pngMediaType: "image/png";
  /**
   * JPEG image media type.
   */
  public static readonly jpegMediaType: "image/jpeg";
  /**
   * GIF image media type.
   */
  public static readonly gifMediaType: "image/gif";
  /**
   * WebP image media type.
   */
  public static readonly webpMediaType: "image/webp";
  public static readonly codexKindId: string;
  public static readonly codexDisplayName: string;
  public static readonly claudeKindId: string;
  /** The speed id TeamRun gives Claude's fast mode, which a model offers when Claude reports `supportsFastMode`: `fast`. */
  public static readonly claudeFastSpeed: string;
  /** The name of `claudeFastSpeed`: Fast. */
  public static readonly claudeFastSpeedName: string;
  /** The speed id TeamRun gives Claude's standard speed, which a model with fast mode offers beside it and runs at by default: `standard`. */
  public static readonly claudeStandardSpeed: string;
  /** The name of `claudeStandardSpeed`: Standard. */
  public static readonly claudeStandardSpeedName: string;
  /** Claude's fast mode state while fast mode serves: `on`. */
  public static readonly claudeFastModeOn: string;
  /** Claude's fast mode state while fast mode is paused after a rate limit: `cooldown`. */
  public static readonly claudeFastModeCooldown: string;
  public static readonly claudeDisplayName: string;
  public static readonly windowsPlatform: string;
  public static readonly linuxPlatform: string;
  public static readonly windowsTempVariables: readonly string[];
  public static readonly posixTempVariables: readonly string[];
  public static readonly sha256Algorithm: string;
  public static readonly hexEncoding: "hex";
  public static readonly pythonUnbufferedVariable: string;
  public static readonly codexExecutableName: string;
  public static readonly codexWindowsExecutableName: string;
  public static readonly codexWindowsShimName: string;
  public static readonly claudeExecutableName: string;
  public static readonly claudeWindowsExecutableName: string;
  public static readonly claudeWindowsShimName: string;
  public static readonly localDirectoryName: string;
  public static readonly binDirectoryName: string;
  public static readonly localAppDataSegments: readonly string[];
  public static readonly windowsSystemRoot: string;
  public static readonly windowsSystemFolderName: string;
  public static readonly codexWindowsInstallSegments: readonly string[];
  public static readonly wingetLinksSegments: readonly string[];
  public static readonly libDirectoryName: string;
  public static readonly nodeModulesDirectoryName: string;
  public static readonly openAiScopeName: string;
  public static readonly codexPackageName: string;
  public static readonly codexPlatformPackagePrefix: string;
  public static readonly vendorDirectoryName: string;
  public static readonly platformArchitectureSeparator: string;
  public static readonly codexTargetTriples: ReadonlyMap<string, string>;
  public static readonly versionArgument: string;
  public static readonly claudePosixInstallCommand: string;
  public static readonly claudeWindowsInstallCommand: string;
  /**
   * Where Claude Code's own installers read its releases: the latest version at `latest`, then each version's `manifest.json` and builds.
   */
  public static readonly claudeReleaseChannel: string;
  public static readonly claudeLatestName: string;
  public static readonly claudeManifestName: string;
  public static readonly claudeProgramName: string;
  public static readonly claudeWindowsProgramName: string;
  /**
   * The subcommand a downloaded Claude Code build sets itself up with, as its installers run it: `install`.
   */
  public static readonly claudeSetupArgument: string;
  /**
   * What makes that setup replace a version's file already on disk, such as one a stopped setup left half-written: `--force`.
   */
  public static readonly claudeForceArgument: string;
  /**
   * The platforms and architectures Claude Code publishes builds for, as Node names them.
   */
  public static readonly claudeTargets: readonly string[];
  /**
   * What a musl Linux build's name ends with: `-musl`.
   */
  public static readonly claudeMuslSuffix: string;
  /**
   * The musl loaders whose presence marks a musl Linux, as Claude Code's installer checks them.
   */
  public static readonly muslLoaderPaths: readonly string[];
  public static readonly claudeNoBuild: string;
  public static readonly claudeNotFoundAfterSetup: string;
  /**
   * A release channel's version: three dot-separated numbers and an optional prerelease suffix.
   */
  public static readonly releaseVersionPattern: RegExp;
  /**
   * A SHA-256 digest in lowercase hexadecimal.
   */
  public static readonly sha256Pattern: RegExp;
  public static readonly claudeSubscribeUrl: string;
  /**
   * Where Codex's installers read the latest release, in order: its release site's channel, then its GitHub releases.
   */
  public static readonly codexReleaseChannels: readonly string[];
  public static readonly codexNoBuild: string;
  public static readonly codexNoTar: string;
  /**
   * What a Codex release's tag starts with before its version: `rust-v`.
   */
  public static readonly codexTagPrefix: string;
  /**
   * A Codex package's asset name around its target: `codex-package-<target>.tar.gz`.
   */
  public static readonly codexPackagePrefix: string;
  public static readonly codexPackageSuffix: string;
  /**
   * What a release asset's digest starts with before its SHA-256: `sha256:`.
   */
  public static readonly sha256DigestPrefix: string;
  public static readonly acceptHeader: string;
  public static readonly jsonContentType: string;
  /**
   * The public ACP registry's list of agents, `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json`.
   */
  public static readonly acpRegistryUrl: string;
  /**
   * How long a fetched registry list is used before it is fetched again: an hour, in milliseconds.
   */
  public static readonly acpRegistryMaxAge: number;
  /**
   * The largest registry list TeamRun reads: 1 MiB, over ten times the list's size today.
   */
  public static readonly acpRegistryMaxBytes: number;
  public static readonly acpRegistryUnreadable: string;
  public static readonly acpRegistryUnreachable: string;
  public static readonly acpRegistryAgentsField: string;
  public static readonly acpRegistryVersionField: string;
  public static readonly acpRegistryIconField: string;
  public static readonly acpRegistryDistributionField: string;
  public static readonly acpRegistryBinaryField: string;
  public static readonly acpRegistryNpxField: string;
  public static readonly acpRegistryUvxField: string;
  public static readonly acpRegistryArchiveField: string;
  public static readonly acpRegistryCommandField: string;
  public static readonly acpRegistryArgumentsField: string;
  public static readonly acpRegistryEnvironmentField: string;
  public static readonly acpRegistrySha256Field: string;
  public static readonly acpRegistryPackageField: string;
  /**
   * A registry agent's id: a lowercase letter, then lowercase letters, digits and hyphens.
   */
  public static readonly acpRegistryIdPattern: RegExp;
  /**
   * An archive's or icon's address: `https://` and no spaces.
   */
  public static readonly acpRegistryArchivePattern: RegExp;
  public static readonly acpRegistryPathSeparators: RegExp;
  /**
   * A command that starts at a root or a drive, which a registry agent's command, relative to its archive, never does.
   */
  public static readonly acpRegistryRootedPattern: RegExp;
  public static readonly acpRegistryIdMaxLength: number;
  public static readonly acpRegistryDeviceNames: RegExp;
  /**
   * The ids of the registry's entries for providers TeamRun runs itself, with its own kinds' ids, which `AcpRegistryAgent` leaves out.
   */
  public static readonly acpRegistryOwnProviderIds: readonly string[];
  public static readonly acpRegistryLoopbackHosts: readonly string[];
  public static readonly acpRegistryHttpsProtocol: string;
  public static readonly acpRegistryHttpProtocol: string;
  public static readonly acpRegistryUrlParameter: string;
  public static readonly acpRegistryUrlRefused: string;
  public static readonly acpRegistryRedirect: NonNullable<RequestInit["redirect"]>;
  public static readonly acpRegistryLengthHeader: string;
  /**
   * What a general ACP agent's processes leave out of the person's environment: credentials by name, which can't catch one under another name or inside
   * a value such as a database address, and every other provider's and cloud's settings; the agent's own variables come on top.
   */
  public static readonly generalAcpExcludedEnvironment: RegExp;
  public static readonly acpRegistryVariablePattern: RegExp;
  public static readonly localAcpKindPrefix: string;
  public static readonly acpPendingStatus: string;
  public static readonly acpAuthRequiredCode: number;
  public static readonly acpRegistryWebsiteField: string;
  public static readonly acpRegistryRepositoryField: string;
  public static readonly acpLocalSecretsField: string;
  public static readonly acpLocalSlugPattern: RegExp;
  public static readonly acpLocalSlugEdges: RegExp;
  public static readonly acpLocalSlugSeparator: string;
  public static readonly acpLocalSlugMaxLength: number;
  public static readonly acpLocalDefaultId: string;
  public static readonly acpLineBreakPattern: RegExp;
  public static readonly acpNpmPackagePattern: RegExp;
  public static readonly acpNpmPackageMaxLength: number;
  public static readonly acpNpmVersionSeparator: string;
  public static readonly acpNpmScopeSeparator: string;
  public static readonly acpNpmInstallArguments: readonly string[];
  public static readonly acpNpmPrefixArgument: string;
  public static readonly acpNpmModulesFolder: string;
  public static readonly acpNpmManifestName: string;
  public static readonly acpNpmBinField: string;
  public static readonly acpNpmBinSegments: readonly string[];
  public static readonly acpNpmWindowsShimExtension: string;
  public static readonly acpNpmBinPattern: RegExp;
  public static readonly npmExecutableName: string;
  public static readonly npmWindowsExecutableName: string;
  public static readonly acpAgentUnpackedName: string;
  public static readonly acpAgentDownloadName: string;
  public static readonly acpAgentUnpackTimeout: number;
  public static readonly acpAgentNpmTimeout: number;
  public static readonly acpArchiveZipExtension: string;
  public static readonly acpArchiveTarExtensions: readonly string[];
  public static readonly acpIconFileExtension: string;
  public static readonly acpIconTypeHeader: string;
  public static readonly acpIconTypeSeparator: string;
  public static readonly acpIconTypes: readonly string[];
  public static readonly acpIconMaxBytes: number;
  public static readonly acpIconDataPrefix: string;
  public static readonly acpIconDataBase64: string;
  public static readonly acpIconEncoding: BufferEncoding;
  public static readonly acpTerminalAuthType: string;
  public static readonly acpTerminalWordPattern: RegExp;
  public static readonly acpTerminalWordSeparator: string;
  public static readonly acpPathVariable: string;
  /**
   * The endings a sign-in command's launcher may have beside the program a kind's turns start, none first.
   */
  public static readonly terminalLauncherExtensions: readonly string[];
  public static readonly acpRegistryCurrentFolder: string;
  public static readonly acpRegistryParentFolder: string;
  /**
   * The registry's six platform keys, `darwin`, `linux` and `windows`, each with `aarch64` and `x86_64`.
   */
  public static readonly acpRegistryTargets: readonly string[];
  /**
   * The registry's system name for each Node.js platform it builds for.
   */
  public static readonly acpRegistrySystems: Readonly<Partial<Record<NodeJS.Platform, string>>>;
  /**
   * The registry's machine name for each Node.js architecture it builds for.
   */
  public static readonly acpRegistryMachines: Readonly<Partial<Record<string, string>>>;
  /**
   * Codex's standalone install under its home: `packages/standalone`, with `releases`, `current` and `auto-update-version` in it.
   */
  public static readonly codexStandaloneSegments: readonly string[];
  public static readonly codexReleasesDirectoryName: string;
  public static readonly codexArchiveName: string;
  /**
   * The program in a Codex package, `bin/codex`, or `bin/codex.exe` on Windows.
   */
  public static readonly codexPackageProgram: string;
  public static readonly codexWindowsPackageProgram: string;
  public static readonly codexCodeModeHostName: string;
  public static readonly codexCodeModeHostProgram: string;
  /**
   * The package's programs made executable outside Windows, those it has.
   */
  public static readonly codexExecutableMembers: readonly string[];
  /**
   * The files a complete package release has, as Codex's installers check them: outside Windows, and on Linux also its `bwrap`.
   */
  public static readonly codexPosixMembers: readonly string[];
  public static readonly codexLinuxMembers: readonly string[];
  /**
   * The files a complete package release has on Windows.
   */
  public static readonly codexWindowsMembers: readonly string[];
  public static readonly codexCurrentName: string;
  public static readonly codexCurrentTemporaryPrefix: string;
  public static readonly codexVisibleTemporaryPrefix: string;
  public static readonly codexAutoUpdateName: string;
  public static readonly codexTemporaryInfix: string;
  public static readonly junctionLinkType: "junction";
  public static readonly codexPosixInstallCommand: string;
  public static readonly codexWindowsInstallCommand: string;
  public static readonly codexSubscribeUrl: string;
  public static readonly copilotPosixInstallCommand: string;
  public static readonly copilotWindowsInstallCommand: string;
  public static readonly copilotSubscribeUrl: string;
  /**
   * Where Copilot's installer reads the latest release: its GitHub releases' latest.
   */
  public static readonly copilotReleaseChannel: string;
  /**
   * What a Copilot release's tag starts with before its version: `v`.
   */
  public static readonly copilotTagPrefix: string;
  /**
   * A Copilot release's archive name around its build: `copilot-<build>.tar.gz`, or `copilot-<build>.zip` on Windows.
   */
  public static readonly copilotArchivePrefix: string;
  public static readonly copilotPosixArchiveSuffix: string;
  public static readonly copilotWindowsArchiveSuffix: string;
  /**
   * The builds Copilot publishes, as `<platform>-<architecture>`; a musl Linux's build is named with `copilotMuslPlatform` instead.
   */
  public static readonly copilotTargets: readonly string[];
  public static readonly copilotMuslPlatform: string;
  /**
   * The folder in the staging folder a Copilot archive is unpacked into.
   */
  public static readonly copilotUnpackedName: string;
  /**
   * The folder in the staging folder an installed Copilot version is moved aside into while the new one moves in, on Windows.
   */
  public static readonly copilotPreviousName: string;
  public static readonly copilotNoBuild: string;
  public static readonly copilotNoExtractor: string;
  public static readonly grokPosixInstallCommand: string;
  public static readonly grokWindowsInstallCommand: string;
  public static readonly grokSubscribeUrl: string;
  public static readonly opencodePosixInstallCommand: string;
  public static readonly opencodeWindowsInstallCommand: string;
  public static readonly opencodeSubscribeUrl: string;
  /**
   * The pinned builds, by Node's platform and architecture, or `linuxmusl` and the architecture: each archive's file, GitHub's SHA-256 of it
   * and its size, and its one program's name and size once unpacked.
   */
  public static readonly opencodeReleases: readonly { readonly target: string; readonly file: string; readonly sha256: string; readonly archiveBytes: number;
    readonly program: string; readonly programBytes: number }[];
  /**
   * The Grok version TeamRun installs and updates to: Grok publishes no checksums, so TeamRun installs only a build whose SHA-256 and sizes it pins.
   */
  public static readonly grokVersion: string;
  /**
   * Where Grok's builds download from: `https://x.ai/cli/`, as Grok's installers use.
   */
  public static readonly grokDownloadBase: string;
  /**
   * The pinned builds, by Node's platform and architecture: each gzip-compressed build's file, SHA-256 and size, and its program's name, as
   * Grok's installers name it in `~/.grok/downloads`, and size.
   */
  public static readonly grokReleases: readonly { readonly target: string; readonly file: string; readonly sha256: string; readonly archiveBytes: number;
    readonly program: string; readonly programBytes: number }[];
  public static readonly grokDownloadsDirectoryName: string;
  public static readonly grokArchiveName: string;
  /**
   * The commands Grok's installers put in `~/.grok/bin`, `grok` and `agent`, with `.exe` on Windows.
   */
  public static readonly grokProgramNames: readonly string[];
  public static readonly grokWindowsProgramNames: readonly string[];
  /**
   * What a command in the way is renamed with, `.old`, as Grok's installers rename a running one.
   */
  public static readonly grokAsideSuffix: string;
  /**
   * What joins a unique id to `grokAsideSuffix` when an earlier one is still there, such as a running `grok.exe`: `-`.
   */
  public static readonly grokAsideSeparator: string;
  public static readonly grokNoBuild: string;
  public static readonly appServerArgument: string;
  public static readonly codexConfigArgument: string;
  public static readonly codexAppsOffArgument: string;
  public static readonly authArgument: string;
  public static readonly statusArgument: string;
  public static readonly logoutArgument: string;
  public static readonly jsonArgument: string;
  public static readonly taskkillExecutable: string;
  public static readonly taskkillProcessIdArgument: string;
  public static readonly taskkillTreeArgument: string;
  public static readonly taskkillForceArgument: string;
  public static readonly terminateSignal: NodeJS.Signals;
  /**
   * The signals `ProcessTree` sends outside Windows: `SIGSTOP` to hold a tree still, `SIGCONT` to let it take its `SIGTERM`, and `SIGKILL` for
   * what outlives the grace.
   */
  public static readonly stopSignal: NodeJS.Signals;
  public static readonly continueSignal: NodeJS.Signals;
  public static readonly killSignal: NodeJS.Signals;
  /**
   * How many listings `ProcessTree` takes at most for one tree, until no new process shows under it: while it holds the tree still outside
   * Windows, or ends it round by round on Windows: 10.
   */
  public static readonly processTreeFreezeRounds: number;
  /**
   * How often `ProcessTree` looks whether a tree it sent `SIGTERM` has ended, so the grace ends early once it has, in milliseconds: 100.
   */
  public static readonly processTreeGracePoll: number;
  public static readonly processEnvironmentSeparator: string;
  public static readonly codexThreadEntryPrefix: string;
  /**
   * How long one of `ProcessTree`'s listings may take by default, in milliseconds: 30 seconds, since one `Get-CimInstance` takes seconds on Windows.
   */
  public static readonly processListTimeout: number;
  /**
   * How long `ProcessTree` waits for its kept PowerShell to answer one script, in milliseconds: 5 seconds, at most half of the listing time,
   * before it runs the script in a new PowerShell with the rest of that time and the rest of the stop's scripts there too.
   */
  public static readonly powershellSessionAnswerLimit: number;
  /**
   * The process listings `ProcessTree` runs: `ps -A -o pid=,ppid=,lstart=` with `LC_ALL=C`, or one `Get-CimInstance Win32_Process` on Windows; and
   * the pattern of their lines, a process id, its parent's, and its start: `ps`'s start time, to the second, or the milliseconds since the epoch.
   */
  public static readonly psExecutable: string;
  public static readonly psProcessListArguments: readonly string[];
  /**
   * The listing of process groups `ProcessTree.endLeftovers` runs outside Windows, `ps -A -o pid=,pgid=,lstart=`, read with the same pattern, and
   * how much earlier than a process's real start `ps` may tell it, in milliseconds: two seconds, since `ps` adds the process's age to the boot
   * time cut to the second and cuts the sum to the second again.
   */
  public static readonly psProcessGroupArguments: readonly string[];
  public static readonly psStartTolerance: number;
  public static readonly powershellExecutable: string;
  public static readonly powershellCommandArguments: readonly string[];
  /**
   * The processes on Windows with their parents and starts, a line each, through one Windows Management listing, with `unknown` as the start
   * of a process Windows Management gives none for.
   */
  public static readonly powershellProcessListScript: string;
  public static readonly powershellProcessListArguments: readonly string[];
  /**
   * The arguments of `PowershellSession`'s shell, which reads its scripts from standard input.
   */
  public static readonly powershellSessionArguments: readonly string[];
  /**
   * How long `PowershellSession.shared` keeps its shell after its last script, in milliseconds: 30 seconds.
   */
  public static readonly powershellSessionIdle: number;
  /**
   * The start of each marker `PowershellSession` writes after a script, followed by a random UUID.
   */
  public static readonly powershellSessionMarker: string;
  /**
   * The failure of a `PowershellSession` script whose shell ended before the script's marker came back.
   */
  public static readonly powershellSessionEnded: string;
  public static readonly processListEnvironment: Readonly<Record<string, string>>;
  public static readonly processParentPattern: RegExp;
  public static readonly versionPattern: RegExp;
  /**
   * Separates the parts of an executable's stamp: `|`.
   */
  public static readonly stampSeparator: string;
  public static readonly userAgentVersionPattern: RegExp;
  public static readonly openAiApiKeyVariable: string;
  public static readonly codexApiKeyVariable: string;
  public static readonly codexHomeVariable: string;
  public static readonly claudeConfigDirVariable: string;
  /**
   * The folder in the home folder Codex uses when `CODEX_HOME` isn't set: `.codex`.
   */
  public static readonly codexHomeFolderName: string;
  /**
   * The folder in the home folder Claude Code uses when `CLAUDE_CONFIG_DIR` isn't set: `.claude`.
   */
  public static readonly claudeHomeFolderName: string;
  /**
   * Claude Code's own configuration file, in `CLAUDE_CONFIG_DIR` or the home folder, and its field that names the user's MCP
   * servers: `.claude.json` and `mcpServers`.
   */
  public static readonly claudeConfigFile: string;
  public static readonly claudeMcpServersField: string;
  /**
   * The field of a provider's own MCP file that names the person's servers, and the file's name in Cursor's, Pi's and fx's
   * folders: `mcpServers` and `mcp.json`.
   */
  public static readonly ownMcpServersField: string;
  public static readonly ownMcpFile: string;
  /**
   * The field of `.claude.json` that holds its local-scope servers, per project, and the separator of a project's key.
   */
  public static readonly claudeProjectsField: string;
  public static readonly claudeProjectsFolder: string;
  public static readonly claudeSessionFileExtension: string;
  public static readonly claudeCompactSummaryMarker: string;
  public static readonly jsonlTailChunkBytes: number;
  public static readonly sessionCopyExtension: string;
  public static readonly codexSessionsFolder: string;
  public static readonly codexRolloutExtension: string;
  public static readonly codexCompactedMarker: string;
  public static readonly codexPayloadField: string;
  public static readonly compactionPayload: JsonObject;

  /**
   * The failure of a compact summary whose content isn't a string.
   */
  public static formatClaudeCompactSummaryNotText(file: string): string;
  public static readonly claudeProjectMcpFile: string;
  public static readonly claudeDisabledMcpJsonField: string;
  public static readonly claudeProjectKeySeparator: string;
  public static readonly windowsFolderSeparator: string;
  /**
   * The fields of a person's server, and which of them have their `${VAR}` and `${VAR:-default}` references expanded.
   */
  public static readonly claudeCommandField: string;
  public static readonly claudeEnvironmentField: string;
  public static readonly claudeExpandedServerFields: readonly string[];
  public static readonly claudeVariableReference: RegExp;
  public static readonly claudeVariableFallback: string;
  /**
   * The line of a worktree's `.git` file that names its git folder, and that folder's file naming the main one.
   */
  public static readonly gitDirectoryLine: RegExp;
  public static readonly gitCommonDirectoryFile: string;
  /**
   * The largest provider configuration file TeamRun reads whole for its MCP servers, checked before it reads: 32 MB.
   */
  public static readonly maximumConfigurationMegabytes: number;
  public static readonly maximumConfigurationBytes: number;
  /**
   * The entry names that make a folder a Codex profile folder.
   */
  public static readonly codexProfileEntries: readonly string[];
  /**
   * The entry names that make a folder a Claude Code profile folder.
   */
  public static readonly claudeProfileEntries: readonly string[];
  /**
   * The login command a person runs in a terminal with `CLAUDE_CONFIG_DIR` set to a provider's profile folder: `claude auth login`.
   */
  public static readonly claudeSignInCommand: string;
  public static readonly claudeClientAppVariable: string;
  public static readonly disableAutoupdaterVariable: string;
  public static readonly claudeTodoToolsVariable: string;
  /**
   * What keeps Claude Code from reaching any service but the one a turn needs; a found folder's check sets it so `claude auth status` connects nowhere.
   */
  public static readonly claudeNonessentialTrafficVariable: string;
  public static readonly enabledValue: string;
  /**
   * The variable that makes Claude Code report when its session goes idle: `CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS`.
   */
  public static readonly claudeSessionStateEventsVariable: string;
  /**
   * The variable that turns Claude Code's auto memory off, set for a title session: `CLAUDE_CODE_DISABLE_AUTO_MEMORY`.
   */
  public static readonly claudeAutoMemoryOffVariable: string;
  public static readonly claudeCredentialVariablePattern: RegExp;
  /**
   * The person's own Claude Code settings a chat turn keeps: the `CLAUDE_*` variables Claude Code's environment variables reference listed on
   * Nov 4, 2026, ahead of the pinned Claude Code 2.1.263, less those Claude Code sets for its own processes, such as `CLAUDECODE`, `CLAUDE_PID` and
   * `CLAUDE_CODE_SESSION_ID`, those whose name holds a key, token, secret, password, credential, authentication or certificate, the routing switches
   * and the other switches that choose who serves Claude, such as `CLAUDE_CODE_USE_MANTLE`, the settings only the Agent SDK's mode reads, such as
   * `CLAUDE_CODE_EXIT_AFTER_STOP_DELAY`, `CLAUDE_CODE_EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS`, `CLAUDE_CONFIG_DIR` and `CLAUDE_CODE_EFFORT_LEVEL`,
   * which would beat the teammate's effort.
   */
  public static readonly claudeSettingVariables: ReadonlySet<string>;
  public static readonly claudeRoutingVariables: ReadonlySet<string>;
  public static readonly clientAppPrefix: string;
  public static readonly lineSeparator: string;
  public static readonly listSeparator: string;
  public static readonly requestIdSeparator: string;
  public static readonly ellipsis: string;
  public static readonly jsonObjectStart: string;
  public static readonly maximumOutputLength: number;
  public static readonly levelListOutputLength: number;
  public static readonly maximumStderrChunks: number;
  public static readonly maximumSummaryLength: number;
  public static readonly maximumReasoningLength: number;
  public static readonly maximumCommandOutputLength: number;
  public static readonly maximumToolResultLength: number;
  public static readonly maximumInputKeys: number;
  public static readonly claudeMaximumTurns: number;
  /**
   * The Claude Code argument that chooses how thinking is shown: `thinking-display`.
   */
  public static readonly claudeThinkingDisplayArgument: string;
  /**
   * The thinking display that streams summarized thinking text: `summarized`.
   */
  public static readonly claudeSummarizedThinkingDisplay: string;
  /**
   * Claude Code's instruction file, in the config folder and in each project folder.
   */
  public static readonly projectInstructionsFileName: string;
  /**
   * The instruction files Claude Code reads in each project folder, in its order.
   */
  public static readonly claudeProjectInstructionFiles: readonly string[];
  /**
   * The rules folder, in the config folder and in each project folder's .claude.
   */
  public static readonly claudeRulesFolder: string;
  /**
   * The instruction file shared by agents, read when a project has no provider-specific file.
   */
  public static readonly agentsInstructionsFile: string;
  public static readonly markdownExtension: string;
  /**
   * The line that opens and closes a rule's front matter.
   */
  public static readonly frontMatterFence: string;
  /**
   * The front matter key that makes a rule apply only to some files.
   */
  public static readonly rulePathsKey: string;
  /**
   * The project's own instruction file that Claude Code reads last in each folder.
   */
  public static readonly claudeLocalInstructionsFile: string;
  /**
   * The managed policy CLAUDE.md Claude Code reads first on macOS.
   */
  public static readonly claudeMacManagedInstructionsFile: string;
  /**
   * The managed policy CLAUDE.md Claude Code reads first on Linux and WSL.
   */
  public static readonly claudeLinuxManagedInstructionsFile: string;
  /**
   * The managed policy CLAUDE.md Claude Code reads first on Windows.
   */
  public static readonly claudeWindowsManagedInstructionsFile: string;
  /**
   * An "@path" import anywhere in a line, at its start or after a space, with "\ " standing for a space in the path.
   */
  public static readonly claudeImportPattern: RegExp;
  /**
   * The start of a line that opens or closes a fenced code block.
   */
  public static readonly codeFencePattern: RegExp;
  /**
   * A code span, whose text holds no imports.
   */
  public static readonly codeSpanPattern: RegExp;
  public static readonly commentOpening: string;
  public static readonly commentClosing: string;
  public static readonly escapedSpace: string;
  /**
   * The start of an import path under the home folder.
   */
  public static readonly homePrefix: string;
  /**
   * The characters that open a quoted path, which is not an import.
   */
  public static readonly quotes: string;
  /**
   * How many imports deep an instruction file is expanded.
   */
  public static readonly maximumImportDepth: number;
  /**
   * Characters kept of each instruction file.
   */
  public static readonly maximumInstructionsLength: number;
  /**
   * Characters kept of all instruction files together; the files past it are left out and named.
   */
  public static readonly maximumInstructionsTotalLength: number;
  public static readonly space: string;
  public static readonly versionTimeout: number;
  public static readonly signInCheckTimeout: number;
  public static readonly initializeTimeout: number;
  public static readonly requestTimeout: number;
  public static readonly interruptTimeout: number;
  public static readonly interruptGrace: number;
  public static readonly stopGrace: number;
  public static readonly claudeAbortGrace: number;
  /**
   * How long a completed ACP turn waits for the check of a model that may be unavailable before it drops the mark.
   */
  public static readonly modelCheckWait: number;
  /**
   * How long an ACP turn with a `/` command waits for the session's first list of commands before it answers that the agent listed none.
   */
  public static readonly acpCommandsWait: number;
  /**
   * How long an ACP turn for an agent that `awaitsTeamRunTools` waits, from its session's start, for the turn's endpoint to list TeamRun's tools before it
   * sends the prompt anyway.
   */
  public static readonly teamRunToolsWait: number;
  public static readonly utf8Encoding: BufferEncoding;
  public static readonly dataEvent: string;
  public static readonly errorEvent: string;
  public static readonly closeEvent: string;
  public static readonly exitEvent: string;
  public static readonly endEvent: string;
  public static readonly abortEvent: string;
  public static readonly pathVariable: string;
  public static readonly parentDirectory: string;
  public static readonly codexCredentialVariables: readonly string[];
  public static readonly defaultProfileKey: string;
  public static readonly modelReasoningEffortSetting: string;
  public static readonly pendingSessionId: string;
  public static readonly unknownCommand: string;
  public static readonly errorPath: string;
  public static readonly paramsPath: string;
  public static readonly resultPath: string;
  public static readonly signInStatusPath: string;
  public static readonly toolInputPath: string;
  public static readonly claudeStructuredContentPath: string;
  public static readonly systemMessageType: "system";
  public static readonly assistantMessageType: "assistant";
  public static readonly userMessageType: "user";
  public static readonly resultMessageType: "result";
  public static readonly initSubtype: "init";
  /**
   * The subtype of Claude Code's system messages that report thinking progress without text: `thinking_tokens`.
   */
  public static readonly thinkingTokensSubtype: "thinking_tokens";
  /**
   * The subtype of Claude Code's system message that marks where it compacted its context: `compact_boundary`.
   */
  public static readonly compactBoundarySubtype: "compact_boundary";
  /**
   * The subtype of Claude Code's system message that says a task started: `task_started`.
   */
  public static readonly taskStartedSubtype: "task_started";
  /**
   * The subtype of Claude Code's system message that changes a task, such as moving it to the background: `task_updated`.
   */
  public static readonly taskUpdatedSubtype: "task_updated";
  /**
   * The subtype of Claude Code's system message that says a task ended: `task_notification`.
   */
  public static readonly taskNotificationSubtype: "task_notification";
  /**
   * The subtype of Claude Code's system message that reports a running task's usage so far: `task_progress`.
   */
  public static readonly taskProgressSubtype: "task_progress";
  /**
   * The subtype of Claude Code's system message that lists the session's running tasks: `background_tasks_changed`.
   */
  public static readonly backgroundTasksChangedSubtype: "background_tasks_changed";
  /**
   * The subtype of Claude Code's system message that says its session started a turn, waits on the person, or went idle with nothing queued:
   * `session_state_changed`.
   */
  public static readonly sessionStateChangedSubtype: "session_state_changed";
  /**
   * The session state of Claude Code while it runs a turn: `running`.
   */
  public static readonly runningSessionState: string;
  /**
   * The session state of Claude Code once no turn runs and nothing is queued: `idle`.
   */
  public static readonly idleSessionState: string;
  /**
   * The type of a Claude Code task that runs a shell command: `local_bash`.
   */
  public static readonly claudeShellTaskType: string;
  public static readonly claudeOwnedBySubAgentField: "owned_by_subagent";
  /**
   * The background task status of each status Claude Code ends a task with.
   */
  public static readonly claudeTaskStatuses: Readonly<Record<"completed" | "failed" | "stopped", import("@noldova/teamrun.protocol").BackgroundTaskStatus>>;
  /**
   * The sub-agent status of each status Claude Code ends a sub-agent's task with.
   */
  public static readonly claudeSubAgentStatuses: Readonly<Record<"completed" | "failed" | "stopped", import("@noldova/teamrun.protocol").SubAgentStatus>>;
  /**
   * The names of Claude Code's tool that starts a sub-agent: `Agent`, and `Task` from its earlier versions.
   */
  public static readonly claudeAgentTools: readonly string[];
  /**
   * The field of the sub-agent tool's input naming the kind of sub-agent: `subagent_type`.
   */
  public static readonly claudeSubagentTypeField: string;
  /**
   * The field of the sub-agent tool's input asking for a background run: `run_in_background`.
   */
  public static readonly claudeRunInBackgroundField: string;
  /**
   * The status of the sub-agent tool's result for a sub-agent that finished: `completed`.
   */
  public static readonly claudeAgentCompletedStatus: string;
  /**
   * The status of the sub-agent tool's result for a sub-agent launched in the background: `async_launched`.
   */
  public static readonly claudeAgentLaunchedStatus: string;
  /**
   * The field of the sub-agent tool's result naming the sub-agent, as its permission requests do: `agentId`.
   */
  public static readonly claudeAgentIdField: string;
  /**
   * The field of the sub-agent tool's result counting its tool calls: `totalToolUseCount`.
   */
  public static readonly claudeTotalToolUseCountField: string;
  /**
   * The field of the sub-agent tool's result giving its run time in milliseconds: `totalDurationMs`.
   */
  public static readonly claudeTotalDurationField: string;
  /**
   * What a sub-agent whose tool input gave no description is called: "Sub-agent".
   */
  public static readonly claudeSubAgentDescription: string;
  /**
   * The field of an approval's payload naming the sub-agent that asked: `subAgent`.
   */
  public static readonly subAgentField: string;
  /**
   * The most bytes read from the end of a task's output file: 65536.
   */
  public static readonly maximumTaskOutputBytes: number;
  /**
   * The replacement characters a read that starts inside a character leaves at its start.
   */
  public static readonly leadingReplacementPattern: RegExp;
  /**
   * Finds the output file a backgrounded command's tool result names, after `Output is being written to: `.
   */
  public static readonly claudeTaskOutputPattern: RegExp;
  /**
   * How often a running task's output file is read for new output, in milliseconds: 250.
   */
  public static readonly taskOutputFollowInterval: number;
  /**
   * How many times {@link Resources.maximumTaskOutputBytes} a followed file's read sends once something was sent: 4.
   */
  public static readonly followedTaskOutputFactor: number;
  /**
   * The NUL character, which starts a big-endian UTF-16 unit.
   */
  public static readonly nulCharacter: string;
  /**
   * The end of a followed read that may still join the next read: a byte order mark, with the character after it, or a NUL.
   */
  public static readonly utf16HeldEndPattern: RegExp;
  /**
   * The byte order mark that starts a UTF-16 run, as UTF-8 decoding reads it.
   */
  public static readonly utf16LeadingMarkPattern: RegExp;
  /**
   * A byte order mark, or its first half, at the end of the text before a UTF-16 run held back whole, which the run may start with.
   */
  public static readonly utf16TrailingMarkPattern: RegExp;
  /**
   * A character already sent that a UTF-16 run may start with, when the next read starts with a NUL.
   */
  public static readonly utf16ContextPattern: RegExp;

  /**
   * The terminal reason of a Claude Code result whose prompt no longer fits its context: `prompt_too_long`.
   */
  public static readonly promptTooLongReason: "prompt_too_long";
  public static readonly successSubtype: "success";
  public static readonly textBlockType: "text";
  public static readonly thinkingBlockType: "thinking";
  public static readonly toolUseBlockType: "tool_use";
  public static readonly toolResultBlockType: "tool_result";
  public static readonly allowBehavior: "allow";
  public static readonly denyBehavior: "deny";
  public static readonly presetSystemPromptType: "preset";
  public static readonly claudeCodePreset: "claude_code";
  /**
   * The settings sources of a chat turn in a folder Claude Code trusts.
   */
  public static readonly claudeChatSettingSources: readonly ("user" | "project" | "local")[];
  /**
   * The settings sources of a chat turn in a folder Claude Code doesn't trust, as its own folder trust dialog leaves them until accepted.
   */
  public static readonly claudeUntrustedSettingSources: readonly ("user" | "project" | "local")[];
  public static readonly claudeTrustAcceptedField: string;
  public static readonly acceptEditsPermissionMode: PermissionMode;
  /** Claude's mode that asks before edits and commands. */
  public static readonly defaultPermissionMode: PermissionMode;
  /** Claude's mode that reads and plans, and changes nothing. */
  public static readonly planPermissionMode: PermissionMode;
  /** Claude's mode whose classifier approves or refuses each request. */
  public static readonly autoPermissionMode: PermissionMode;
  /** Claude's mode that runs every tool without asking; TeamRun lists it as unrestricted and runs it for a teammate or chat the person confirmed it for. */
  public static readonly bypassPermissionMode: PermissionMode;
  /** The name of `autoPermissionMode`: Auto. */
  public static readonly claudeAutoModeName: string;
  /** What `autoPermissionMode` does. */
  public static readonly claudeAutoModeDescription: string;
  /** The name of `defaultPermissionMode`: Manual. */
  public static readonly claudeManualModeName: string;
  /** What `defaultPermissionMode` does. */
  public static readonly claudeManualModeDescription: string;
  /** The name of `acceptEditsPermissionMode`: Accept edits. */
  public static readonly claudeAcceptEditsModeName: string;
  /** What `acceptEditsPermissionMode` does. */
  public static readonly claudeAcceptEditsModeDescription: string;
  /** The name of `planPermissionMode`: Plan. */
  public static readonly claudePlanModeName: string;
  /** What `planPermissionMode` does. */
  public static readonly claudePlanModeDescription: string;
  /** The name of `bypassPermissionMode`: Bypass permissions. */
  public static readonly claudeBypassModeName: string;
  /** What `bypassPermissionMode` does. */
  public static readonly claudeBypassModeDescription: string;
  public static readonly idField: string;
  public static readonly methodField: string;
  public static readonly paramsField: string;
  public static readonly resultField: string;
  public static readonly errorField: string;
  public static readonly codeField: string;
  public static readonly messageField: string;
  public static readonly dataField: string;
  public static readonly userAgentField: string;
  public static readonly accountField: string;
  public static readonly typeField: string;
  public static readonly emailField: string;
  public static readonly planTypeField: string;
  public static readonly modelField: string;
  public static readonly effortField: string;
  public static readonly hiddenField: string;
  public static readonly threadField: string;
  public static readonly turnField: string;
  public static readonly reasoningEffortField: string;
  public static readonly cwdField: string;
  public static readonly textField: string;
  public static readonly itemField: string;
  public static readonly itemIdField: string;
  public static readonly statusField: string;
  public static readonly summaryField: string;
  public static readonly commandField: string;
  public static readonly exitCodeField: string;
  public static readonly aggregatedOutputField: string;
  public static readonly commandActionsField: string;
  public static readonly readOnlyField: string;
  /**
   * The field set to `true` on a step the person denied, whatever the provider calls it: `denied`.
   */
  public static readonly deniedField: string;
  public static readonly readingCommandActions: readonly string[];
  public static readonly readCommandAction: string;
  public static readonly listFilesCommandAction: string;
  public static readonly searchCommandAction: string;
  public static readonly writingCommandWords: readonly string[];
  public static readonly findPrintOptionPrefix: string;
  public static readonly commandWordBreakPattern: RegExp;
  public static readonly commandPathPrefixPattern: RegExp;
  public static readonly utf16RunPattern: RegExp;
  public static readonly utf16PairPattern: RegExp;
  public static readonly minimumUtf16Run: number;
  public static readonly changesField: string;
  public static readonly pathField: string;
  public static readonly kindField: string;
  public static readonly serverField: string;
  public static readonly toolField: string;
  public static readonly questionsField: string;
  public static readonly questionField: string;
  public static readonly headerField: string;
  public static readonly labelField: string;
  public static readonly descriptionField: string;
  public static readonly multiSelectField: string;
  public static readonly isOtherField: string;
  public static readonly isSecretField: string;
  public static readonly answersField: string;
  public static readonly queryField: string;
  public static readonly fromModelField: string;
  public static readonly toModelField: string;
  public static readonly reasonField: string;
  public static readonly willRetryField: string;
  public static readonly grantRootField: string;
  public static readonly loggedInField: string;
  public static readonly subscriptionTypeField: string;
  public static readonly organizationNameField: string;
  public static readonly authMethodField: string;
  public static readonly initializeMethod: string;
  public static readonly initializedMethod: string;
  public static readonly accountReadMethod: string;
  public static readonly loginStartMethod: string;
  public static readonly loginCancelMethod: string;
  /**
   * The Codex app-server request that signs its profile out: `account/logout`.
   */
  public static readonly logoutMethod: string;
  public static readonly loginCompletedMethod: string;
  public static readonly chatGptLoginType: string;
  public static readonly loginIdField: string;
  public static readonly authUrlField: string;
  /**
   * The only host whose sign-in page a Codex sign-in opens: `auth.openai.com`.
   */
  public static readonly codexSignInHost: string;
  /**
   * The only scheme a Codex sign-in page may use: `https:`.
   */
  public static readonly httpsProtocol: string;
  public static readonly successField: string;
  public static readonly modelListMethod: string;
  public static readonly threadStartMethod: string;
  public static readonly threadResumeMethod: string;
  /**
   * The app-server method that archives a thread, unloading it: `thread/archive`.
   */
  public static readonly threadArchiveMethod: string;
  /**
   * The app-server method that unarchives a thread so that it can be resumed.
   */
  public static readonly threadUnarchiveMethod: string;
  /**
   * The app-server method that ends this connection's subscription to a thread: `thread/unsubscribe`.
   */
  public static readonly threadUnsubscribeMethod: string;
  /**
   * The app-server method that forks a thread through a turn: `thread/fork`.
   */
  public static readonly threadForkMethod: string;
  /**
   * Name of a fork request's last turn: `lastTurnId`.
   */
  public static readonly lastTurnIdField: string;
  /**
   * The app-server method that names a thread: `thread/name/set`, which Codex's `/rename` runs.
   */
  public static readonly threadNameSetMethod: string;
  /**
   * What the app-server's answer to `thread/name/set` holds for a thread it doesn't find, an archived one among them: `thread not found`.
   */
  public static readonly threadNotFoundMarker: string;
  /**
   * The app-server method that runs a review as a turn on a thread: `review/start`, which Codex's `/review` runs.
   */
  public static readonly reviewStartMethod: string;
  /**
   * Name of a review's target in `review/start`: `target`.
   */
  public static readonly reviewTargetField: string;
  /**
   * Name of a custom review target's instructions: `instructions`.
   */
  public static readonly reviewInstructionsField: string;
  /**
   * The review target for the working tree's staged, unstaged and untracked changes: `uncommittedChanges`.
   */
  public static readonly reviewUncommittedTarget: string;
  /**
   * The review target that carries the person's own instructions: `custom`.
   */
  public static readonly reviewCustomTarget: string;
  /**
   * Name of a thread request's thread id: `threadId`.
   */
  public static readonly threadIdField: string;
  /**
   * The message of the exception a sign-in request raises for a provider that can't start one.
   */
  public static readonly signInNotSupported: string;
  /**
   * The message of the error a sign-out raises for an agent TeamRun can't sign out.
   */
  public static readonly signOutNotSupported: string;
  /**
   * What a person types in Copilot's or Antigravity's own terminal to sign out: `/logout`.
   */
  public static readonly toolLogoutCommand: string;
  /**
   * The text an archived thread's resume failure carries.
   */
  public static readonly archivedMarker: string;
  /**
   * The text a resume failure carries while another app-server still holds the thread.
   */
  public static readonly activeWriterMarker: string;
  /**
   * How many times a busy thread's resume is tried again.
   */
  public static readonly resumeRetryCount: number;
  /**
   * Milliseconds between the tries of a busy thread's resume.
   */
  public static readonly resumeRetryDelay: number;
  /**
   * Milliseconds an idle Claude query stays open after a task ended.
   */
  public static readonly wakeGrace: number;
  /**
   * Milliseconds a sign-in check waits for the signed-in account.
   */
  public static readonly accountTimeout: number;
  /**
   * Milliseconds a model listing waits for an agent's `modelList` method.
   */
  public static readonly modelListTimeout: number;
  /**
   * Milliseconds a kept session held open only by its background work stays open while that work is silent: 4 hours.
   */
  public static readonly silenceLimit: number;
  /**
   * Milliseconds a kept process with no session left stays open: 30 minutes.
   */
  public static readonly idleLimit: number;
  /**
   * Milliseconds after its last turn that a Claude chat which may compact while idle does so: 54 minutes, inside Claude's one-hour prompt cache.
   */
  public static readonly idleCompactionDelay: number;
  /**
   * The context, in tokens, from which a Claude chat on the one-hour prompt cache compacts while idle: 150,000.
   */
  public static readonly idleCompactionTokens: number;
  public static readonly turnStartMethod: string;
  public static readonly turnInterruptMethod: string;
  /** Codex's method that gives a running turn a person's message, refused unless `expectedTurnId` names the thread's active turn. */
  public static readonly turnSteerMethod: string;
  /**
   * The app-server method that compacts a thread's context in a turn of its own: `thread/compact/start`.
   */
  public static readonly threadCompactStartMethod: string;
  public static readonly itemStartedNotification: string;
  public static readonly itemCompletedNotification: string;
  public static readonly turnCompletedNotification: string;
  /**
   * The app-server notification that names a turn as it starts, as a compaction's turn is named: `turn/started`.
   */
  public static readonly turnStartedNotification: string;
  public static readonly turnPlanUpdatedNotification: string;
  public static readonly planField: string;
  public static readonly stepField: string;
  public static readonly explanationField: string;
  public static readonly codexPlanStatuses: Readonly<Record<string, PlanStepStatus>>;
  public static readonly modelReroutedNotification: string;
  public static readonly errorNotification: string;
  public static readonly commandApprovalRequest: string;
  public static readonly fileChangeApprovalRequest: string;
  public static readonly codexCommandKind: string;
  public static readonly codexFileChangeKind: string;
  public static readonly codexElicitationKind: string;
  public static readonly userInputRequest: string;
  /**
   * Codex's async question: the tool `request_user_input_async` asks with, the `delivery` of the `agentMessage` item that
   * carries its `questions`, `async`, and the user message that answers one, `<send_user_message_question_reply>` around the
   * JSON `{ questionItemId, question, answer }`.
   */
  public static readonly codexAsyncInputTool: string;
  public static readonly deliveryField: string;
  public static readonly codexAsyncDelivery: string;
  public static readonly codexQuestionReplyOpen: string;
  public static readonly codexQuestionReplyClose: string;
  public static readonly questionItemIdField: string;
  public static readonly answerField: string;
  /**
   * The app-server request that asks the person on an MCP server's behalf, `mcpServer/elicitation/request`, and its fields: the server's
   * `serverName`, and in its `_meta` Codex's `codex_approval_kind`, `mcp_tool_call` for a tool call's approval, `persist`, which holds
   * `session` when the approval may be kept for the session, `tool_title` and `tool_params`.
   */
  public static readonly mcpElicitationRequest: string;
  public static readonly mcpServerStartupStatusNotification: string;
  public static readonly mcpServerStartupFailedState: string;
  public static readonly mcpServerReauthenticationRequired: string;
  public static readonly failureReasonField: string;
  public static readonly serverNameField: string;
  public static readonly codexApprovalKindField: string;
  public static readonly codexToolCallApprovalKind: string;
  public static readonly codexPersistField: string;
  public static readonly codexPersistSession: string;
  public static readonly codexToolTitleField: string;
  public static readonly codexToolParamsField: string;
  public static readonly codexNotePrefix: string;
  public static readonly codexOtherLabel: string;
  /**
   * The app-server notification that carries a chunk of a running command's output: `item/commandExecution/outputDelta`.
   */
  public static readonly commandOutputDeltaNotification: string;
  /**
   * The app-server notification sent when the model writes to or polls a running command, which happens only after the command has left its first wait:
   * `item/commandExecution/terminalInteraction`.
   */
  public static readonly terminalInteractionNotification: string;
  /**
   * The experimental app-server method that lists a thread's commands still running in the background: `thread/backgroundTerminals/list`.
   */
  public static readonly backgroundTerminalsListMethod: string;
  /**
   * The experimental app-server method that stops one of a thread's background commands: `thread/backgroundTerminals/terminate`.
   */
  public static readonly backgroundTerminalsTerminateMethod: string;
  /**
   * The experimental app-server method that stops all of a thread's background commands: `thread/backgroundTerminals/clean`.
   */
  public static readonly backgroundTerminalsCleanMethod: string;
  public static readonly processIdField: string;
  public static readonly terminatedField: string;
  public static readonly inProgressItemStatus: string;
  public static readonly completedItemStatus: string;
  public static readonly interruptedItemStatus: string;
  /**
   * The most pages of background commands read for one thread: 20.
   */
  public static readonly maximumTerminalPages: number;
  /**
   * Why a stop failed when Codex answered that it did not stop the command.
   */
  public static readonly codexTerminalNotTerminated: string;
  public static readonly chatGptAccountType: string;
  /**
   * The plan Codex reports when it doesn't know the account's plan: `unknown`.
   */
  public static readonly codexUnknownPlan: string;
  public static readonly workspaceWriteSandbox: string;
  /** Codex's sandbox that lets it read files and change none: `read-only`. */
  public static readonly readOnlySandbox: string;
  /** Codex's sandbox that lets it change any file and use the network: `danger-full-access`. */
  public static readonly dangerFullAccessSandbox: string;
  public static readonly onRequestApprovalPolicy: string;
  /** Codex's approval policy that never asks: `never`. */
  public static readonly neverApprovalPolicy: string;
  public static readonly dangerFullAccessPolicy: string;
  public static readonly readOnlyPolicy: string;
  public static readonly workspaceWritePolicy: string;
  public static readonly approvalPolicyField: string;
  public static readonly sandboxPolicyField: string;
  /** The id of Codex's Read Only preset: the read-only sandbox, asking on request. */
  public static readonly codexReadOnlyMode: string;
  /** The name of `codexReadOnlyMode`: Read Only. */
  public static readonly codexReadOnlyModeName: string;
  /** What `codexReadOnlyMode` allows. */
  public static readonly codexReadOnlyModeDescription: string;
  /** Why Codex runs no Explorer sub-agent, which the refusal of one gives the person. */
  public static readonly codexExplorerUnavailable: string;
  /**
   * The prompt of the turn TeamRun starts on a Codex thread when a background sub-agent of an ended turn ends, since Codex keeps the sub-agent's
   * result for the thread's next turn and starts none itself.
   */
  public static readonly codexWakePrompt: string;
  /** The line the instructions of an ACP agent whose tasks TeamRun doesn't follow add: its background sub-agents end with its turn, so it waits for them. */
  public static readonly acpBackgroundSubAgentsNote: string;
  /** Tells Copilot its background sub-agents keep its turn open until they end, since its ACP prompt answers only then, and that a stop ends them. */
  public static readonly copilotBackgroundSubAgentsNote: string;
  /** The id of Codex's Default preset, which TeamRun runs Codex in by default: the workspace-write sandbox, asking on request. */
  public static readonly codexDefaultMode: string;
  /** The name of `codexDefaultMode`: Default. */
  public static readonly codexDefaultModeName: string;
  /** What `codexDefaultMode` allows. */
  public static readonly codexDefaultModeDescription: string;
  /** The id of Codex's Full Access preset, listed as unrestricted and run once the person confirmed it: the danger-full-access sandbox, never asking. */
  public static readonly codexFullAccessMode: string;
  /** The name of `codexFullAccessMode`: Full Access. */
  public static readonly codexFullAccessModeName: string;
  /** What `codexFullAccessMode` allows. */
  public static readonly codexFullAccessModeDescription: string;
  /** The id of Codex's Plan mode, also its collaboration mode: the read-only sandbox, asking on request, with turns sent in collaboration mode `plan`. */
  public static readonly codexPlanMode: string;
  /** The name of `codexPlanMode`: Plan. */
  public static readonly codexPlanModeName: string;
  /** What `codexPlanMode` allows. */
  public static readonly codexPlanModeDescription: string;
  /** The `turn/start` and `thread/resume` field that holds a turn's or thread's collaboration mode: `collaborationMode`. */
  public static readonly codexCollaborationModeField: string;
  /** The collaboration mode field that names the mode: `mode`. */
  public static readonly codexModeField: string;
  /** The collaboration mode a turn after a plan turn goes back to: `default`. */
  public static readonly codexDefaultCollaboration: string;
  /** The collaboration mode field that holds its settings: `settings`. */
  public static readonly codexCollaborationSettingsField: string;
  /** The collaboration mode setting for the reasoning effort: `reasoning_effort`. */
  public static readonly codexReasoningEffortSetting: string;
  /** The collaboration mode setting for developer instructions, `null` for Codex's own: `developer_instructions`. */
  public static readonly codexDeveloperInstructionsSetting: string;
  /** The config option category an ACP session names its permission modes under: `mode`. */
  public static readonly acpModeCategory: string;
  /** The ACP request that switches a session's mode: `session/set_mode`. */
  public static readonly acpSessionSetMode: string;
  /** The field of a session's start that names its ACP session modes: `modes`. */
  public static readonly acpModesField: string;
  /** The field of `modes` that names the session's current mode: `currentModeId`. */
  public static readonly acpCurrentModeField: string;
  /** The field of `modes` that lists the modes the session offers: `availableModes`. */
  public static readonly acpAvailableModesField: string;
  /** The value of Copilot's `mode` option for its Agent mode, which TeamRun runs Copilot in by default. */
  public static readonly copilotAgentMode: string;
  /** The name of `copilotAgentMode`: Agent. */
  public static readonly copilotAgentModeName: string;
  /** What `copilotAgentMode` allows. */
  public static readonly copilotAgentModeDescription: string;
  /** The value of Copilot's `mode` option for its Plan mode. */
  public static readonly copilotPlanMode: string;
  /** The name of `copilotPlanMode`: Plan. */
  public static readonly copilotPlanModeName: string;
  /** What `copilotPlanMode` allows. */
  public static readonly copilotPlanModeDescription: string;
  /** The value of Copilot's `mode` option for its Autopilot mode, which turns Allow All on itself; listed as unrestricted and run once the person confirmed it. */
  public static readonly copilotAutopilotMode: string;
  /** The name of `copilotAutopilotMode`: Autopilot. */
  public static readonly copilotAutopilotModeName: string;
  /** What `copilotAutopilotMode` allows, with Copilot's own "(experimental)". */
  public static readonly copilotAutopilotModeDescription: string;
  /** The id of Copilot's Allow All, its `allow_all` option turned on, listed as unrestricted and run once the person confirmed it. */
  public static readonly copilotAllowAllMode: string;
  /** The name of `copilotAllowAllMode`: Allow All. */
  public static readonly copilotAllowAllModeName: string;
  /** What `copilotAllowAllMode` allows. */
  public static readonly copilotAllowAllModeDescription: string;
  /** The id of Copilot's `permissions` option that turns Allow All on and off: `allow_all`. */
  public static readonly copilotAllowAllOption: string;
  /** The value of `copilotAllowAllOption` that turns Allow All on: `on`. */
  public static readonly copilotAllowAllOn: string;
  /** The value of `copilotAllowAllOption` that turns Allow All off: `off`. */
  public static readonly copilotAllowAllOff: string;
  /** The value of Antigravity's `mode` option for its Default mode, which TeamRun runs Antigravity in by default. */
  public static readonly antigravityDefaultMode: string;
  /** The name of `antigravityDefaultMode`: Default. */
  public static readonly antigravityDefaultModeName: string;
  /** What `antigravityDefaultMode` allows. */
  public static readonly antigravityDefaultModeDescription: string;
  /** The value of Antigravity's `mode` option for its Auto Edit mode. */
  public static readonly antigravityAutoEditMode: string;
  /** The name of `antigravityAutoEditMode`: Auto Edit. */
  public static readonly antigravityAutoEditModeName: string;
  /** What `antigravityAutoEditMode` allows. */
  public static readonly antigravityAutoEditModeDescription: string;
  /** The value of Antigravity's `mode` option for its YOLO mode, listed as unrestricted and run once the person confirmed it. */
  public static readonly antigravityYoloMode: string;
  /** The name of `antigravityYoloMode`: YOLO. */
  public static readonly antigravityYoloModeName: string;
  /** What `antigravityYoloMode` allows. */
  public static readonly antigravityYoloModeDescription: string;
  /** The id of Grok's Default session mode, which TeamRun runs Grok in by default. */
  public static readonly grokDefaultMode: string;
  /** The name of `grokDefaultMode`: Default. */
  public static readonly grokDefaultModeName: string;
  /** What `grokDefaultMode` allows. */
  public static readonly grokDefaultModeDescription: string;
  /** The id of Grok's Plan session mode. */
  public static readonly grokPlanMode: string;
  /** The name of `grokPlanMode`: Plan. */
  public static readonly grokPlanModeName: string;
  /** What `grokPlanMode` allows. */
  public static readonly grokPlanModeDescription: string;
  /** The id of Grok's Ask session mode. */
  public static readonly grokAskMode: string;
  /** The name of `grokAskMode`: Ask. */
  public static readonly grokAskModeName: string;
  /** What `grokAskMode` allows. */
  public static readonly grokAskModeDescription: string;
  /** The id of Grok's Always-approve, its `--permission-mode` value `bypassPermissions`, listed as unrestricted and run once the person confirmed it. */
  public static readonly grokAlwaysApproveMode: string;
  /** The name of `grokAlwaysApproveMode`: Always-approve. */
  public static readonly grokAlwaysApproveModeName: string;
  /** What `grokAlwaysApproveMode` allows. */
  public static readonly grokAlwaysApproveModeDescription: string;
  public static readonly opencodeBuildMode: string;
  public static readonly opencodeBuildModeName: string;
  public static readonly opencodeBuildModeDescription: string;
  public static readonly opencodePlanMode: string;
  public static readonly opencodePlanModeName: string;
  public static readonly opencodePlanModeDescription: string;
  public static readonly opencodeAllowAllMode: string;
  public static readonly opencodeAllowAllModeName: string;
  public static readonly opencodeAllowAllModeDescription: string;
  public static readonly cursorKindId: string;
  public static readonly cursorDisplayName: string;
  public static readonly cursorExecutableName: string;
  public static readonly cursorWindowsLauncherName: string;
  public static readonly cursorWindowsScriptExtension: string;
  public static readonly cursorWindowsNodeName: string;
  public static readonly cursorScriptName: string;
  public static readonly cursorVersionsDirectoryName: string;
  public static readonly cursorVersionPattern: RegExp;
  public static readonly cursorVersion: string;
  public static readonly cursorDownloadBase: string;
  public static readonly cursorArchiveName: string;
  public static readonly cursorWindowsArchiveName: string;
  public static readonly cursorPackageDirectoryName: string;
  public static readonly cursorNodeName: string;
  /**
   * Each pinned build: Node's target, its folder under `cursorDownloadBase`, the archive's SHA-256 and size, and the bundled Node's and
   * `index.js`'s sizes once unpacked. Cursor publishes no hashes, so these are TeamRun's own first observation, confirmed by a second download.
   */
  public static readonly cursorReleases: readonly { readonly target: string; readonly path: string; readonly sha256: string; readonly archiveBytes: number;
    readonly nodeBytes: number; readonly scriptBytes: number }[];
  public static readonly cursorUnpackedName: string;
  public static readonly cursorPreviousName: string;
  public static readonly cursorNoBuild: string;
  public static readonly cursorNoExtractor: string;
  public static readonly cursorArchiveUnsafe: string;
  public static readonly cursorWindowsInstallDirectoryName: string;
  public static readonly cursorArguments: readonly string[];
  public static readonly cursorModelArgument: string;
  public static readonly cursorAuthMethod: string;
  public static readonly cursorSignInCommand: string;
  public static readonly cursorToolTitle: string;
  /**
   * What Cursor puts ahead of a refusal it sends as its answer, two line breaks.
   */
  public static readonly cursorRefusalLead: string;
  /**
   * Cursor's refusal for a sign-in, which a turn reads as signed out.
   */
  public static readonly cursorSignInRefusal: string;
  /**
   * The refusals Cursor 2026.10.22-27dcf5f sends as its answer, after `cursorRefusalLead`, when its run fails for an action the person has to take:
   * sign in, upgrade the plan, add a payment method or check the settings.
   */
  public static readonly cursorRefusals: readonly string[];
  public static readonly cursorNotFound: string;
  public static readonly cursorSignInUnavailable: string;
  public static readonly cursorProfileAbsolute: string;
  public static readonly cursorProfileNotManaged: string;
  public static readonly cursorProfileMarkerValue: string;
  public static readonly cursorConfigVariable: string;
  public static readonly cursorNoBrowserVariable: string;
  public static readonly cursorNoColorVariable: string;
  public static readonly cursorConfigFileName: string;
  public static readonly cursorDataVariables: Readonly<Record<string, string>>;
  public static readonly cursorXdgVariables: Readonly<Record<string, string>>;
  public static readonly cursorWindowsVariables: Readonly<Record<string, string>>;
  public static readonly cursorFolderSeparator: string;
  public static readonly cursorExcludedEnvironment: RegExp;
  public static readonly cursorStaticChannel: string;
  public static readonly cursorAllowlistApproval: string;
  public static readonly cursorPersonFolderName: string;
  public static readonly cursorTitleHomeFolder: string;
  public static readonly cursorPermissionsField: string;
  public static readonly cursorAllowField: string;
  public static readonly cursorDenyField: string;
  /** The server part of a Cursor `Mcp(<server>:<tool>)` rule. */
  public static readonly cursorMcpRuleServer: RegExp;
  public static readonly cursorRuleWildcard: string;
  public static readonly cursorPosixInstallCommand: string;
  public static readonly cursorWindowsInstallCommand: string;
  public static readonly cursorSubscribeUrl: string;
  public static readonly cursorAgentMode: string;
  public static readonly cursorAgentModeName: string;
  public static readonly cursorAgentModeDescription: string;
  public static readonly cursorAskMode: string;
  public static readonly cursorAskModeName: string;
  public static readonly cursorAskModeDescription: string;
  /** The id of Cursor's Plan mode, its read-only planning mode that ends in a `cursor/create_plan` request: `plan`. */
  public static readonly cursorPlanMode: string;
  /** The name of `cursorPlanMode`: Plan. */
  public static readonly cursorPlanModeName: string;
  /** What `cursorPlanMode` allows. */
  public static readonly cursorPlanModeDescription: string;
  /** The id of Cursor's Allow all mode, TeamRun's own since Cursor has no mode that asks for nothing: `allow-all`. */
  public static readonly cursorAllowAllMode: string;
  /** The name of `cursorAllowAllMode`: Allow all. */
  public static readonly cursorAllowAllModeName: string;
  /** What `cursorAllowAllMode` allows. */
  public static readonly cursorAllowAllModeDescription: string;
  /** The requests Cursor hands its plan over with: `cursor/create_plan`. */
  public static readonly cursorCreatePlanMethods: readonly string[];
  /** The native kind of a Cursor plan's approval: `create_plan`. */
  public static readonly cursorCreatePlanTool: string;
  /** The `cursor/create_plan` field, and the field of each of its phases, that holds to-dos: `todos`. */
  public static readonly cursorTodosField: string;
  /** The `cursor/create_plan` field that groups to-dos into named phases: `phases`. */
  public static readonly cursorPhasesField: string;
  /** The notification Cursor sends its to-do list with as it works: `cursor/update_todos`. */
  public static readonly cursorUpdateToDosMethods: readonly string[];
  /** The `cursor/update_todos` field that says whether its to-dos update the list by id rather than replace it: `merge`. */
  public static readonly cursorMergeField: string;
  /** The `cursor/create_plan` outcome of an approved plan: `accepted`. */
  public static readonly cursorAcceptedOutcome: string;
  /** The `cursor/create_plan` outcome of a refused plan: `rejected`. */
  public static readonly cursorRejectedOutcome: string;
  public static readonly cursorAskQuestionMethods: readonly string[];
  /** The notification Cursor sends with the path of an image it generated: `cursor/generate_image`. */
  public static readonly cursorGenerateImageMethods: readonly string[];
  /** The field of `cursor/generate_image` that names the image's file: `filePath`. */
  public static readonly cursorFilePathField: string;
  /** The shared temp folder of Linux and macOS, `/tmp`, which Cursor's documents use for a generated image. */
  public static readonly posixTemporaryDirectory: string;
  public static readonly cursorAskQuestionTool: string;
  public static readonly cursorOutcomeField: string;
  public static readonly cursorAllowMultipleField: string;
  public static readonly cursorQuestionIdField: string;
  public static readonly cursorSelectedOptionsField: string;
  public static readonly cursorAnsweredOutcome: string;
  public static readonly cursorAboutArgument: string;
  /** A line of `cursor-agent about`: its label, two or more spaces, then its value. */
  public static readonly cursorAboutLinePattern: RegExp;
  public static readonly cursorAboutVersionLabel: string;
  public static readonly cursorAboutPlanLabel: string;
  public static readonly cursorAboutEmailLabel: string;
  public static readonly cursorMacPlatform: string;
  /** Why a Mac takes one Cursor provider: Cursor keeps its sign-in in the keychain, which every profile shares. */
  public static readonly cursorOneAccountPerMac: string;
  public static readonly fxKindId: string;
  public static readonly fxDisplayName: string;
  public static readonly fxExecutableName: string;
  public static readonly fxWindowsExecutableName: string;
  public static readonly fxArguments: readonly string[];
  /**
   * What asks fx whether it is signed in; the answer's `Resources.fxAuthField` is `Resources.fxAuthMissing` when it isn't.
   */
  public static readonly fxStatusArguments: readonly string[];
  /** The accounts `fx logout` signs out of one at a time: `vercel`, `codex` and `grok`. */
  public static readonly fxAccounts: readonly string[];
  public static readonly fxAuthField: string;
  public static readonly fxAuthMissing: string;
  public static readonly fxSignInCommand: string;
  public static readonly fxToolTitle: string;
  public static readonly fxNotFound: string;
  public static readonly fxWindowsNotFound: string;
  public static readonly fxSignInUnavailable: string;
  /** Says fx isn't signed in and that Sign in runs `fx login` for the person's own fx. */
  public static readonly fxSignedOut: string;
  /** Named only as the kind's profile variable; fx 0.0.16 doesn't read it, and TeamRun doesn't set it for the person's own `.fx`. */
  public static readonly fxHomeVariable: string;
  /** `.fx`: the folder in the person's home where fx keeps its sign-in, settings, sessions and MCP servers. */
  public static readonly fxFolderName: string;
  /** The files whose presence makes a folder an fx folder for the Providers tab's search, checked unopened. */
  public static readonly fxProfileEntries: readonly string[];
  public static readonly fxInstallDirectoryVariable: string;
  public static readonly fxNoColorVariable: string;
  public static readonly fxExcludedEnvironment: RegExp;
  public static readonly fxInstallCommand: string;
  public static readonly fxSubscribeUrl: string;
  /** The code with which fx's `initialize` refuses a person who isn't signed in. */
  public static readonly fxSignedOutCode: number;
  public static readonly fxModelOption: string;
  public static readonly fxCacheReadTokensField: string;
  public static readonly fxCacheWriteTokensField: string;
  public static readonly fxReasoningTokensField: string;
  public static readonly fxAutoMode: string;
  public static readonly fxAutoModeName: string;
  public static readonly fxAutoModeDescription: string;
  public static readonly fxAskMode: string;
  public static readonly fxAskModeName: string;
  public static readonly fxAskModeDescription: string;
  public static readonly fxFullAccessMode: string;
  public static readonly fxFullAccessModeName: string;
  public static readonly fxFullAccessModeDescription: string;
  /** Why this computer takes one fx provider: every fx provider uses the person's own fx. */
  public static readonly fxOneAccountPerComputer: string;
  public static readonly textInputType: "text";
  public static readonly completedTurnStatus: string;
  public static readonly interruptedTurnStatus: string;
  public static readonly agentMessageItemType: string;
  public static readonly reasoningItemType: string;
  public static readonly planItemType: string;
  public static readonly commandExecutionItemType: string;
  public static readonly fileChangeItemType: string;
  public static readonly mcpToolCallItemType: string;
  public static readonly codexToolTimeoutSetting: string;
  /**
   * The keys of a Codex MCP server that name the variables Codex reads: a stdio server's `env_vars`, an HTTP server's `env_http_headers` and its
   * `bearer_token_env_var`.
   */
  public static readonly codexEnvironmentVariablesSetting: string;
  public static readonly codexHttpHeaderVariablesSetting: string;
  public static readonly codexBearerVariableSetting: string;
  /** The key of a Codex HTTP MCP server that holds its headers' values, `http_headers`, which carries TeamRun's server's `Authorization` header. */
  public static readonly codexHttpHeadersSetting: string;
  public static readonly codexToolTimeoutSeconds: number;
  /**
   * The settings of TeamRun's server in a Codex thread that let the turn's approved tools run without Codex asking, `tools.<name>.approval_mode`
   * set to `approve`: those tools ask the person themselves, through Noldova Desktop, where they must, and Codex still asks before TeamRun's other
   * tools as their markings say.
   */
  public static readonly codexToolsSetting: string;
  public static readonly codexToolApprovalSetting: string;
  public static readonly codexToolsApprovalMode: string;
  public static readonly dynamicToolCallItemType: string;
  public static readonly webSearchItemType: string;
  public static readonly contextCompactionItemType: string;
  /**
   * The item a review turn starts with, whose `review` names what it reviews: `enteredReviewMode`.
   */
  public static readonly enteredReviewModeItemType: string;
  /**
   * The item a review turn ends with; the review's text follows it as an agent message: `exitedReviewMode`.
   */
  public static readonly exitedReviewModeItemType: string;
  /**
   * Name of a review mode item's text: `review`.
   */
  public static readonly reviewField: string;
  public static readonly functionCallOutputItemType: string;

  /**
   * The field of a Codex turn error that names its kind: `codexErrorInfo`.
   */
  public static readonly codexErrorInfoField: string;

  /**
   * The `codexErrorInfo` of a Codex turn that failed because its context is full: `contextWindowExceeded`.
   */
  public static readonly codexContextWindowExceeded: string;

  /**
   * The `codexErrorInfo` of a Codex turn that failed because its account reached its usage limit: `usageLimitExceeded`.
   */
  public static readonly codexUsageLimitExceeded: string;

  /**
   * The type of the Claude Agent SDK message that reports the account's rate limit: `rate_limit_event`.
   */
  public static readonly rateLimitEventType: "rate_limit_event";

  /**
   * The rate limit status of an account that can't run more turns until its limit resets: `rejected`.
   */
  public static readonly rejectedRateLimitStatus: string;

  /**
   * The overage statuses that still let a rejected account run turns on extra usage: `allowed` and `allowed_warning`.
   */
  public static readonly allowedRateLimitStatuses: readonly string[];

  /**
   * The `error` of the assistant message Claude Code writes when the account's rate limit stops a turn: `rate_limit`.
   */
  public static readonly rateLimitAssistantError: string;
  public static readonly imageGenerationItemType: string;
  public static readonly collabAgentToolCallItemType: string;
  public static readonly subAgentActivityItemType: string;
  public static readonly imageViewItemType: string;
  public static readonly sleepItemType: string;
  public static readonly hookPromptItemType: string;

  /**
   * The Codex item types whose completion means Codex samples the model again in the turn: a local tool's call, or input it records for
   * the next sampling (a steer, a tool's output, a hook's prompt). Messages, reasoning, hosted tools such as web search, compactions and Codex's
   * own sub-agent activity don't.
   */
  public static readonly codexFollowUpItemTypes: readonly string[];
  /**
   * The Codex item types that count as a sub-agent's tool uses.
   */
  public static readonly codexToolItemTypes: readonly string[];
  public static readonly threadStartedNotification: string;
  public static readonly codexSpawnAgentTool: string;
  /**
   * The collab tools that send an earlier reply's sub-agent more work, followed as a row in the reply that sends it: `sendInput`, `followupTask` and `resumeAgent`.
   */
  public static readonly codexFollowedAgentTools: readonly string[];
  public static readonly agentThreadIdField: string;
  public static readonly agentPathField: string;
  public static readonly agentPathSeparator: string;
  /**
   * The `subAgentActivity` kind that starts a multi-agent v2 sub-agent, naming its child thread and path.
   */
  public static readonly codexStartedActivity: string;
  /**
   * The `subAgentActivity` kind for more work sent to a v2 sub-agent, followed as a row in a later reply that sends it.
   */
  public static readonly codexInteractedActivity: string;
  /**
   * The `subAgentActivity` kind that ends a running v2 sub-agent as stopped.
   */
  public static readonly codexInterruptedActivity: string;
  public static readonly promptField: string;
  public static readonly receiverThreadIdsField: string;
  public static readonly agentsStatesField: string;
  public static readonly parentThreadIdField: string;
  public static readonly agentRoleField: string;
  public static readonly agentNicknameField: string;
  public static readonly durationMsField: string;
  public static readonly codexSubAgentDescription: string;
  /**
   * The sub-agent status each ending Codex agent state stands for; a pending or running state has none.
   */
  public static readonly codexAgentStatuses: ReadonlyMap<string, import("@noldova/teamrun.protocol").SubAgentStatus>;
  /**
   * The background task status each sub-agent status stands for, so an ended sub-agent ends its task with it.
   */
  public static readonly subAgentTaskStatuses: Readonly<Record<import("@noldova/teamrun.protocol").SubAgentStatus,
    import("@noldova/teamrun.protocol").BackgroundTaskStatus>>;
  public static readonly savedPathField: string;
  public static readonly revisedPromptField: string;
  public static readonly failureField: string;
  public static readonly imageDataField: string;
  public static readonly mediaTypeField: string;
  public static readonly maximumImageDataLength: number;
  public static readonly base64Pattern: RegExp;
  public static readonly imageSignatures: Readonly<Record<string, string>>;
  public static readonly maximumImageBytes: number;
  public static readonly acpRawOutputField: string;
  public static readonly acpContentBlockType: string;
  public static readonly grokImageOutputTypes: readonly string[];
  public static readonly grokImageVariantField: string;
  public static readonly grokSessionsDirectory: string;
  public static readonly grokImagesDirectory: string;
  public static readonly grokSessionIdPlaceholder: string;
  public static readonly grokImagesFolderLimit: number;
  public static readonly grokShortHomeFolder: string;
  public static readonly grokShortHomeNameLength: number;
  public static readonly grokShortHomeHash: string;
  public static readonly grokShortHomeEncoding: "hex";
  public static readonly grokImageNamePattern: RegExp;
  public static readonly pathSeparatorPattern: RegExp;
  public static readonly executableSuffixPattern: RegExp;
  public static readonly absoluteCommandPattern: RegExp;
  public static readonly shellSpacePattern: RegExp;
  public static readonly singleQuote: string;
  public static readonly doubleQuote: string;
  public static readonly backslash: string;
  public static readonly doubleQuotedEscapes: string;
  public static readonly posixShellNames: readonly string[];
  public static readonly posixShellScriptFlags: readonly string[];
  public static readonly powerShellNames: readonly string[];
  public static readonly powerShellFlags: readonly string[];
  public static readonly powerShellScriptFlags: readonly string[];
  public static readonly powerShellEncodingLinePattern: RegExp;
  public static readonly cmdShellName: string;
  public static readonly cmdFlags: readonly string[];
  public static readonly cmdScriptFlags: readonly string[];
  public static readonly shellLineBreakPattern: RegExp;
  public static readonly shellOperators: Readonly<Record<ShellDialect, string>>;
  public static readonly shellQuotedRefused: Readonly<Record<ShellDialect, string>>;
  public static readonly commentMark: string;
  public static readonly flagPrefix: string;
  public static readonly longFlagPrefix: string;
  public static readonly flagValueSeparator: string;
  public static readonly switchPrefix: string;
  public static readonly commandKinds: Readonly<Record<ShellDialect, ReadonlyMap<string, CommandKind>>>;
  public static readonly searchFlags: ReadonlyMap<string, CommandFlags>;
  public static readonly findstrName: string;
  public static readonly findstrLiteralPrefix: string;
  public static readonly findstrSwitches: readonly string[];
  public static readonly patternParameter: string;
  public static readonly pathParameters: readonly string[];
  public static readonly selectStringParameters: CmdletParameters;
  public static readonly getContentParameters: CmdletParameters;
  public static readonly startParameters: readonly string[];
  public static readonly endParameters: readonly string[];
  public static readonly partValueFlags: readonly string[];
  public static readonly partFlagPattern: RegExp;
  public static readonly listLetters: string;
  public static readonly recurseLetter: string;
  public static readonly listNames: readonly string[];
  public static readonly dirRecurseSwitch: string;
  public static readonly dirSwitches: readonly string[];
  public static readonly dirValueSwitches: readonly string[];
  public static readonly getChildItemParameters: CmdletParameters;
  public static readonly recurseParameter: string;
  public static readonly depthParameter: string;
  public static readonly setLocationParameters: CmdletParameters;
  public static readonly driveSwitch: string;
  public static readonly gitNoPagerFlag: string;
  public static readonly gitOutputFlag: string;
  public static readonly gitTitles: ReadonlyMap<string, string>;
  public static readonly listedFolderTitle: string;
  public static readonly listedTreeTitle: string;
  public static readonly dotSegments: readonly string[];
  public static readonly shellBlankPattern: RegExp;
  public static readonly shellSeparators: Readonly<Record<ShellDialect, readonly string[]>>;
  public static readonly shellRedirects: Readonly<Record<ShellDialect, readonly string[]>>;
  public static readonly shellGroupCharacters: Readonly<Record<ShellDialect, string>>;
  public static readonly shellGlobCharacters: Readonly<Record<ShellDialect, string>>;
  public static readonly descriptorPatterns: Readonly<Record<ShellDialect, RegExp>>;
  public static readonly writingRedirects: readonly string[];
  public static readonly hereDocumentRedirects: readonly string[];
  public static readonly tabStrippingRedirect: string;
  public static readonly duplicateRedirect: string;
  public static readonly duplicateTargetPattern: RegExp;
  public static readonly leadingTabsPattern: RegExp;
  public static readonly trailingCarriageReturnPattern: RegExp;
  public static readonly inputRedirect: string;
  public static readonly dollarSign: string;
  public static readonly subexpressionStart: string;
  public static readonly backtick: string;
  public static readonly caret: string;
  public static readonly percentSign: string;
  public static readonly atSign: string;
  public static readonly comma: string;
  public static readonly openParenthesis: string;
  public static readonly closeParenthesis: string;
  public static readonly openBrace: string;
  public static readonly closeBrace: string;
  public static readonly powerShellBlockCommentStart: string;
  public static readonly powerShellBlockCommentEnd: string;
  public static readonly powerShellStopParsing: string;
  public static readonly processSubstitutionMarks: string;
  public static readonly nullDevices: readonly string[];
  public static readonly absoluteTargetPattern: RegExp;
  public static readonly assignmentPattern: RegExp;
  public static readonly trailingSeparatorsPattern: RegExp;
  public static readonly shellLeadingKeywords: readonly string[];
  public static readonly testBrackets: readonly string[];
  public static readonly homeFolder: string;
  public static readonly previousFolder: string;
  public static readonly standardStream: string;
  public static readonly currentFolder: string;
  public static readonly folderSeparator: string;
  public static readonly writeKinds: Readonly<Record<ShellDialect, ReadonlyMap<string, WriteKind>>>;
  public static readonly writeFlags: ReadonlyMap<string, CommandFlags>;
  public static readonly noFlags: CommandFlags;
  public static readonly gitValueFlags: readonly string[];
  public static readonly gitFolderFlag: string;
  public static readonly readingGitCommands: readonly string[];
  public static readonly recursiveFlags: readonly string[];
  public static readonly targetFolderFlags: readonly string[];
  public static readonly inPlaceFlags: readonly string[];
  public static readonly scriptFlags: readonly string[];
  public static readonly outputFlags: readonly string[];
  public static readonly outputFolderFlags: readonly string[];
  public static readonly remoteNameFlags: readonly string[];
  public static readonly substitutionPattern: RegExp;
  public static readonly outputDocumentFlags: readonly string[];
  public static readonly diskDumpOutputPrefix: string;
  public static readonly findWritingActions: readonly string[];
  public static readonly cmdletWriteParameters: ReadonlyMap<string, CmdletParameters>;
  public static readonly fileParameters: readonly string[];
  public static readonly destinationParameter: string;
  public static readonly nameParameter: string;
  public static readonly newNameParameter: string;
  public static readonly itemTypeParameters: readonly string[];
  public static readonly folderItemType: string;
  public static readonly variableParameter: string;
  public static readonly wildcardParameters: readonly string[];
  public static readonly parameterValueSeparator: string;
  public static readonly cmdSwitchPattern: RegExp;
  public static readonly acpRawInputField: string;
  /**
   * The fields of the raw input of Grok's `use_tool`, which calls an MCP tool by its `<server>__<tool>` name: `tool_name`, `tool_input`
   * with the tool's arguments, `variant`, which Grok's permission requests add, and the fields it may hold, which also take `tool_input_file`.
   */
  public static readonly useToolNameField: string;
  public static readonly useToolInputField: string;
  public static readonly useToolFileField: string;
  public static readonly useToolFields: readonly string[];
  /** The field of `use_tool`'s form whose arguments and tool name are all in a file: `file`. */
  public static readonly useToolFileFormField: string;
  /** The start of a TeamRun tool's name as an agent that routes MCP calls through one tool names it: `teamrun__`. */
  public static readonly routedTeamRunToolPrefix: string;
  /** An ACP title or routed tool name that names one of TeamRun's tools, in the recorded forms `teamrun__<tool>` (Grok) and `teamrun-<tool>` (Copilot), with the tool's name in its group. */
  public static readonly acpTeamRunToolPattern: RegExp;
  /** A TeamRun tool's name: letters and digits joined by single `_`. */
  public static readonly teamRunToolNamePattern: RegExp;
  /**
   * The names of TeamRun's tools an ACP agent may run without asking, as its allow rules name them: letters, digits, `_` and `-`, so that no
   * name can widen a rule into a pattern.
   */
  public static readonly approvedToolNamePattern: RegExp;
  /** The control characters an approval's summary replaces with spaces: C0, DEL, C1 and the bidirectional controls. */
  public static readonly controlCharacters: RegExp;
  /**
   * The folders of an absolute path in a text, up to its last separator, which a provider's reason drops so the person's user name stays out of a
   * chat: inside parentheses or quotes up to the closing one, spaces included, and elsewhere up to the next space.
   */
  public static readonly pathFolders: RegExp;
  public static readonly acpAudioType: string;
  public static readonly acpResourceType: string;
  public static readonly acpResourceField: string;
  public static readonly acpBlobField: string;
  public static readonly sizeField: string;
  public static readonly base64PaddingPattern: RegExp;
  public static readonly imageNotSaved: string;
  public static readonly acceptDecision: string;
  public static readonly acceptForSessionDecision: string;
  public static readonly declineDecision: string;
  public static readonly allowLabel: string;
  public static readonly allowForSessionLabel: string;
  public static readonly denyLabel: string;
  public static readonly cancelDecision: string;
  /**
   * What a Codex sub-agent's request is answered with when its reply can no longer ask it, by request method: once the reply was stopped, and otherwise,
   * with the note shown under its row.
   */
  public static readonly codexChildRequestAnswers: ReadonlyMap<string, { readonly cancel: JsonValue; readonly decline: JsonValue; readonly note: string }>;
  public static readonly unsupportedServerRequestCode: number;
  public static readonly serverRequestFailedCode: number;
  public static readonly claudeAllowDecision: string;
  public static readonly claudeDenyDecision: string;
  public static readonly claudeCommandTools: readonly string[];
  public static readonly claudePowerShellTool: string;
  public static readonly claudeEditToolPattern: RegExp;
  public static readonly claudeMcpToolPattern: string;
  public static readonly claudeMcpToolKind: string;
  public static readonly claudeMcpNameSeparator: string;
  /**
   * Terminal's agent tool that runs a command: `terminal_run`.
   */
  public static readonly terminalRunTool: string;
  /**
   * Terminal's agent tool that types keys into a terminal: `terminal_write`.
   */
  public static readonly terminalWriteTool: string;
  /**
   * The Terminal tools a reply shows as command steps: `terminal_run` and `terminal_write`.
   */
  public static readonly terminalStepTools: readonly string[];
  public static readonly terminalIdKey: string;
  public static readonly terminalCommandKey: string;
  public static readonly terminalKeysKey: string;
  public static readonly terminalTitleKey: string;
  public static readonly terminalStatusKey: string;
  public static readonly terminalExitCodeKey: string;
  public static readonly terminalOutputKey: string;
  /**
   * The status Terminal reports for a command it had to stop: `Killed`.
   */
  public static readonly killedTerminalStatus: string;
  /**
   * The statuses Terminal reports for a command still running when the call returns: `Running` and `AwaitingInput`.
   */
  public static readonly runningTerminalStatuses: readonly string[];
  public static readonly terminalStillRunning: string;
  public static readonly unnamedTerminal: string;
  public static readonly structuredContentField: string;
  public static readonly argumentsField: string;
  public static readonly claudeOwnServersNotSet: string;
  public static readonly claudeOtherMcpToolDenied: string;
  /** The note on a Claude wake whose tools refused the chat's kept token. */
  public static readonly claudeWakeToolsRefused: string;
  /** The note on a Claude turn that stopped the open chat, and its background tasks, because its tools refused the chat's kept token. */
  public static readonly claudeChatEndedForTools: string;
  /** The note on a Claude turn that stopped the open chat, and its background tasks, because the tools TeamRun serves changed. */
  public static readonly claudeChatEndedForToolsChange: string;
  /**
   * The `type` of a shared stdio server and a shared HTTP server in Claude's `mcpServers`, and the header that carries a bearer token.
   */
  public static readonly claudeStdioServerType: "stdio";
  public static readonly claudeHttpServerType: "http";
  public static readonly authorizationHeader: string;
  public static readonly claudeToolTimeout: number;
  /**
   * What the own-MCP-servers switch covers for Codex beyond the servers it lists: the apps connected to the account.
   */
  public static readonly codexOwnMcpServersNote: string;
  /**
   * `codexOwnMcpServersNote` in a few words for the MCP servers page's row, `the apps on your Codex account`.
   */
  public static readonly codexOwnMcpServersShortNote: string;
  /**
   * What the own-MCP-servers switch covers for Claude beyond the servers it lists: the connectors on the account.
   */
  public static readonly claudeOwnMcpServersNote: string;
  /**
   * `claudeOwnMcpServersNote` in a few words for the MCP servers page's row, `your Claude account's connectors`.
   */
  public static readonly claudeOwnMcpServersShortNote: string;
  public static readonly piKindId: string;
  public static readonly piDisplayName: string;
  public static readonly piSignInCommand: string;
  public static readonly piPosixInstallCommand: string;
  public static readonly piWindowsInstallCommand: string;
  public static readonly piLauncherSegments: readonly string[];
  public static readonly piExecutableName: string;
  public static readonly museKindId: string;
  public static readonly museDisplayName: string;
  public static readonly museSignInCommand: string;
  public static readonly museSignOutCommand: string;
  public static readonly musePosixInstallCommand: string;
  public static readonly museWindowsInstallCommand: string;
  public static readonly museSubscribeUrl: string;
  public static readonly museExecutableName: string;
  public static readonly museWindowsShimName: string;
  public static readonly museVersionFile: string;
  public static readonly museBinaryPrefix: string;
  public static readonly museWindowsBinarySuffix: string;
  public static readonly museInstallDirectoryVariable: string;
  public static readonly museWindowsInstallSegments: readonly string[];
  public static readonly museUnixInstallSegments: readonly string[];
  public static readonly museConfigFolderName: string;
  /**
   * Muse Code's settings, `muse/settings.json` in its `XDG_CONFIG_HOME`, which name the person's MCP servers, and the only
   * `schema_version` Muse Code reads.
   */
  public static readonly museSettingsFolder: string;
  public static readonly museSettingsFile: string;
  public static readonly museSchemaVersionField: string;
  public static readonly museSchemaVersion: number;
  public static readonly museAcpArgument: string;
  public static readonly museNoSessionLogArgument: string;
  public static readonly museAcpGateVariable: string;
  public static readonly museAcpGateOn: string;
  public static readonly museExcludedEnvironment: RegExp;
  public static readonly museMacPlatform: string;
  /** Why a Mac takes one Muse Code provider: Muse Code keeps its sign-in in the keychain, which every profile shares. */
  public static readonly museOneAccountPerMac: string;
  /** Muse Code's refusal of a session for a person who isn't signed in, in lowercase, as its ACP guide gives it. */
  public static readonly museSignedOutRefusal: string;
  public static readonly museSignIn: string;
  public static readonly piWindowsShimName: string;
  public static readonly piWindowsNodeName: string;
  public static readonly piScriptSegments: readonly string[];
  public static readonly piAgentDirectoryVariable: string;
  public static readonly piAgentDirectoryName: string;
  public static readonly piModeVariable: string;
  public static readonly piAuthFile: string;
  public static readonly piSettingsFile: string;
  public static readonly piExtensionFile: string;
  public static readonly piMinimumVersion: readonly number[];
  public static readonly piVersionPattern: RegExp;
  public static readonly piModeArgument: string;
  public static readonly piRpcMode: string;
  public static readonly piExtensionArgument: string;
  public static readonly piSessionArgument: string;
  public static readonly piNoSessionArgument: string;
  public static readonly piNoToolsArgument: string;
  public static readonly piNoExtensionsArgument: string;
  public static readonly piBuiltInProviderExtensions: readonly string[];
  public static readonly piSetupOffArguments: readonly string[];
  public static readonly piUnknownProvider: string;
  public static readonly piAuthCheckArguments: readonly string[];
  public static readonly piJsonArgument: string;
  public static readonly piAskMode: string;
  public static readonly piAskModeName: string;
  public static readonly piAskModeDescription: string;
  public static readonly piReadOnlyMode: string;
  public static readonly piReadOnlyModeName: string;
  public static readonly piReadOnlyModeDescription: string;
  public static readonly piAllowAllMode: string;
  public static readonly piAllowAllModeName: string;
  public static readonly piAllowAllModeDescription: string;
  public static readonly piApprovalTitle: string;
  public static readonly piReadOnlyTools: readonly string[];
  public static readonly piApprovalsExtension: string;
  public static readonly piCommandTools: readonly string[];
  public static readonly piFileTools: readonly string[];
  public static readonly piThinkingLevels: readonly string[];
  public static readonly piExtendedThinkingLevels: readonly string[];
  public static readonly piThinkingLevelMapField: string;
  public static readonly piCompactionReasonField: string;
  public static readonly piManualCompaction: string;
  public static readonly piModelSeparator: string;
  public static readonly piRequestIdPrefix: string;
  public static readonly piItemPrefix: string;
  public static readonly piResponseType: string;
  public static readonly piExtensionRequestType: string;
  public static readonly piExtensionResponseType: string;
  public static readonly piNotifyMethod: string;
  public static readonly piConfirmMethod: string;
  public static readonly piDialogMethods: readonly string[];
  public static readonly piSelectMethod: string;
  public static readonly piTimeoutField: string;
  /** How long before a Pi dialog's own `timeout` TeamRun closes its card, in milliseconds, so no answer goes after Pi used its default. */
  public static readonly piDialogTimeoutMargin: number;
  public static readonly piPromptCommand: string;
  public static readonly piAbortCommand: string;
  /** Pi's RPC command that gives the running turn a person's message, read after its running tool calls and before its next model call. */
  public static readonly piSteerCommand: string;
  public static readonly piGetStateCommand: string;
  public static readonly piGetModelsCommand: string;
  public static readonly piSetModelCommand: string;
  public static readonly piSetThinkingCommand: string;
  public static readonly piCompactCommand: string;
  public static readonly piGetStatsCommand: string;
  public static readonly piGetForkMessagesCommand: string;
  public static readonly piGetCommandsCommand: string;
  public static readonly piForkCommand: string;
  public static readonly piCloneCommand: string;
  public static readonly piMessageStartEvent: string;
  public static readonly piMessageUpdateEvent: string;
  public static readonly piMessageEndEvent: string;
  public static readonly piToolStartEvent: string;
  public static readonly piToolEndEvent: string;
  public static readonly piCompactionEndEvent: string;
  public static readonly piRetryStartEvent: string;
  public static readonly piExtensionErrorEvent: string;
  public static readonly piSettledEvent: string;
  public static readonly piTextDelta: string;
  public static readonly piThinkingDelta: string;
  public static readonly piAssistantRole: string;
  public static readonly piErrorStopReason: string;
  public static readonly piHandledDisposition: string;
  public static readonly piImageType: string;
  public static readonly piBase64Encoding: BufferEncoding;
  public static readonly piAllowDecision: string;
  public static readonly piDenyDecision: string;
  public static readonly piAssistantMessageEventField: string;
  public static readonly piContentIndexField: string;
  public static readonly piStopReasonField: string;
  public static readonly piErrorMessageField: string;
  public static readonly piCacheReadField: string;
  public static readonly piCacheWriteField: string;
  public static readonly piToolNameField: string;
  public static readonly piToolCallIdField: string;
  public static readonly piArgsField: string;
  public static readonly piIsErrorField: string;
  public static readonly piAbortedField: string;
  public static readonly piDispositionField: string;
  public static readonly piSessionFileField: string;
  public static readonly piSessionIdField: string;
  public static readonly piThinkingLevelField: string;
  public static readonly piModelsField: string;
  public static readonly piCommandsField: string;
  public static readonly piMessagesField: string;
  public static readonly piEntryIdField: string;
  public static readonly piCancelledField: string;
  public static readonly piContextUsageField: string;
  public static readonly piTokensField: string;
  public static readonly piContextWindowField: string;
  public static readonly piDefaultProviderField: string;
  public static readonly piReasoningField: string;
  public static readonly piImagesField: string;
  public static readonly piCommandField: string;
  public static readonly costField: string;
  public static readonly inputField: string;
  public static readonly roleField: string;
  public static readonly providerField: string;
  public static readonly lineFeedByte: number;
  public static readonly maximumToolOutputLength: number;
  public static readonly piCompactTimeout: number;
  public static readonly piNotFound: string;
  public static readonly piChooseModel: string;
  public static readonly piSignInUnavailable: string;
  public static readonly piNoResult: string;
  public static readonly piCompacted: string;
  public static readonly piForkCancelled: string;
  public static readonly piAlreadyStarted: string;
  public static readonly copilotMcpConfigFile: string;
  public static readonly copilotMcpServersField: string;
  public static readonly missingFileCode: string;
  public static readonly copilotProjectMcpFile: string;
  public static readonly copilotGitHubFolder: string;
  public static readonly copilotMcpFile: string;
  public static readonly copilotGitFolder: string;
  public static readonly copilotPluginsFolder: string;
  public static readonly copilotSettingsFile: string;
  public static readonly copilotHooksFolder: string;
  public static readonly copilotHooksField: string;
  public static readonly copilotHookFileExtension: string;
  /** Where an installed plugin declares its hooks, from its folder: `hooks.json` or `hooks/hooks.json`. */
  public static readonly copilotPluginHookFiles: readonly (readonly string[])[];
  public static readonly copilotPolicyFolder: string;
  public static readonly copilotWindowsPolicySegments: readonly string[];
  public static readonly programDataVariable: string;
  public static readonly windowsProgramData: string;
  public static readonly copilotEnabledPluginsField: string;
  public static readonly copilotCommentLine: RegExp;
  public static readonly copilotDisableBuiltinMcpsArgument: string;
  public static readonly copilotDisableMcpServerArgument: string;
  /** Why Copilot takes no shared stdio MCP server: Copilot 1.0.105 rejects a client's server that isn't HTTP or SSE. */
  public static readonly copilotSharedStdioRefused: string;
  /** `copilotSharedStdioRefused` in a few words, `takes HTTP servers only`. */
  public static readonly copilotSharedStdioRefusedShort: string;
  /** `copilotSharedServerNamedLikeOwn` in a few words, `has its own server by this name`. */
  public static readonly copilotSharedServerNamedLikeOwnShort: string;
  /** Copilot's flags for a title session: `none` is a name in no tool, so the model gets no tools at all. */
  public static readonly copilotTitleSessionArguments: readonly string[];
  /** A text chunk that is Copilot's notice rather than the model's: it starts with `Info: `. */
  public static readonly copilotNotice: RegExp;
  /** Why Copilot takes no shared MCP server named like one of its own: TeamRun turns Copilot's own servers off by name, and while they're on, which one Copilot uses is unknown. */
  public static readonly copilotSharedServerNamedLikeOwn: string;
  /** The launch argument that lists the tools Copilot runs without asking: `--allow-tool`. */
  public static readonly copilotAllowToolArgument: string;
  /**
   * The sources Copilot's MCP files come from, as `formatCopilotTeamRunServerNamed` names them: the home's `mcp-config.json`, a turn's folder,
   * and an installed plugin.
   */
  public static readonly copilotUserMcpSource: string;
  public static readonly copilotProjectMcpSource: string;
  public static readonly copilotPluginMcpSource: string;
  public static readonly claudeInputCommandKey: string;
  public static readonly claudeInputDescriptionKey: string;
  public static readonly claudeInputPathKeys: readonly string[];
  public static readonly claudeApiKeySourceNone: string;
  public static readonly claudeFailedStatus: string;
  public static readonly claudeNeedsAuthStatus: string;
  public static readonly claudePendingStatus: string;
  /**
   * How long to wait between reads of Claude's MCP server states while a shared server is still connecting, in milliseconds.
   */
  public static readonly claudeServerSettleInterval: number;
  /**
   * How long to keep reading Claude's MCP server states while a shared server is still connecting, in milliseconds.
   */
  public static readonly claudeServerSettleTimeout: number;
  public static readonly claudeTokenSourceNone: string;
  public static readonly claudeFirstPartyProvider: string;
  public static readonly executableParameterName: string;
  public static readonly pathParameterName: string;
  public static readonly nameParameterName: string;
  public static readonly titleParameterName: string;
  public static readonly versionParameterName: string;
  public static readonly userAgentParameterName: string;
  public static readonly threadIdParameterName: string;
  public static readonly sessionIdParameterName: string;
  public static readonly modelParameterName: string;
  public static readonly timeoutParameterName: string;
  public static readonly delayParameterName: string;
  public static readonly maximumLengthParameterName: string;
  public static readonly maximumCountParameterName: string;
  public static readonly turnIdParameterName: string;
  public static readonly versionTimeoutParameterName: string;
  public static readonly signInCheckTimeoutParameterName: string;
  public static readonly initializeTimeoutParameterName: string;
  public static readonly requestTimeoutParameterName: string;
  public static readonly interruptTimeoutParameterName: string;
  public static readonly interruptGraceParameterName: string;
  public static readonly stopGraceParameterName: string;
  public static readonly killWaitParameterName: string;
  public static readonly abortGraceParameterName: string;
  public static readonly codexNotFound: string;
  /**
   * What asks Codex, from its own files and without connecting out, whether a profile is signed in: exit code 0 when it is, 1 when it isn't.
   */
  public static readonly codexLoginStatusArguments: readonly string[];
  public static readonly claudeNotFound: string;
  public static readonly appServerAlreadyStarted: string;
  public static readonly appServerNoRequestHandler: string;
  public static readonly appServerExitedDuringTurn: string;
  /**
   * How the output of a Codex command that couldn't start begins: `Failed to create unified exec process:`.
   */
  public static readonly codexUnifiedExecFailure: string;
  /**
   * The text in a Codex command's output when its elevated Windows sandbox fails to refresh its file permissions: `setup refresh had errors`.
   */
  public static readonly codexSandboxSetupFailure: string;
  /**
   * The status of a Codex item that failed: `failed`.
   */
  public static readonly failedItemStatus: string;
  /**
   * The exit code of a Codex command that couldn't start: -1.
   */
  public static readonly codexSandboxExitCode: number;
  /**
   * The minor version of Codex CLI 0.163.0, the first whose sandbox repairs its runtime's permissions without the sharing violation.
   */
  public static readonly codexSandboxFixedMinor: number;
  /**
   * Reads the major and minor numbers of a Codex version.
   */
  public static readonly codexMinorVersionPattern: RegExp;
  /**
   * The failure of a Codex turn stopped at its first failed command, exit code -1, whose output begins with `codexUnifiedExecFailure`
   * and holds `codexSandboxSetupFailure`, when Codex is older than 0.163.0 or its version is unknown.
   */
  public static readonly codexSandboxSetupFailed: string;
  /**
   * The same failure when Codex is 0.163.0 or later, which no longer needs the update.
   */
  public static readonly codexSandboxSetupFailedOnFixedVersion: string;
  /**
   * What Codex CLI writes when it fails to start because its package and its executable are of
   * different versions, as an update made while the executable was in use leaves them.
   */
  public static readonly codexPackageMismatch: string;
  /**
   * The failure of Codex work whose app-server failed to start with `codexPackageMismatch`.
   */
  public static readonly codexUpdatedWhileInUse: string;
  public static readonly appServerExitedDuringSignIn: string;
  public static readonly codexSignInCancelled: string;
  public static readonly codexSignInNotCompleted: string;
  /**
   * Why a Codex sign-in page wasn't opened: it isn't an HTTPS page on `codexSignInHost`.
   */
  public static readonly codexSignInPageRefused: string;
  /**
   * Why a Codex sign-in failed when its `account/login/completed` can't be read.
   */
  public static readonly codexSignInUnreadable: string;
  public static readonly claudeNoResult: string;
  /**
   * The note on a reply whose message Claude Code answered inside a turn it started itself.
   */
  public static readonly claudeAnsweredInOwnTurn: string;
  public static readonly turnNotSettled: string;
  public static readonly claudeDenied: string;
  /**
   * The reason Claude Code gets for a sub-agent's tool use that TeamRun denies because the reply that started the sub-agent has ended and no reply in the
   * chat is running to ask in.
   */
  public static readonly claudeSubAgentUnasked: string;
  public static readonly claudeQuestionsSkipped: string;
  public static readonly claudeQuestionsUnanswered: string;
  public static readonly claudeQuestionsUnreadable: string;
  public static readonly claudeAskUserQuestionTool: string;
  public static readonly claudeTodoWriteTool: string;
  public static readonly claudeTaskCreateTool: string;
  public static readonly claudeTaskUpdateTool: string;
  public static readonly claudeTaskListTool: string;
  public static readonly claudeExitPlanModeTool: string;
  public static readonly claudePlanInputField: string;
  /**
   * How many Claude sessions' to-do lists the adapter keeps for the queries that resume them, the least recently used leaving first.
   */
  public static readonly maximumClaudePlans: number;
  public static readonly claudePlanTools: readonly string[];
  public static readonly claudeTodosField: string;
  public static readonly claudeSubjectField: string;
  public static readonly claudeTaskField: string;
  public static readonly claudeTasksField: string;
  public static readonly claudeSuccessField: string;
  public static readonly claudeActiveFormFields: readonly string[];
  public static readonly claudeTaskIdFields: readonly string[];
  public static readonly claudeDeletedTaskStatus: string;
  public static readonly claudePlanStatuses: Readonly<Record<string, PlanStepStatus>>;
  public static readonly claudeAnswerSeparator: string;
  public static readonly commandPrompt: string;
  public static readonly runCommandPrefix: string;
  public static readonly applyFileChanges: string;
  public static readonly retryableErrorPrefix: string;
  public static readonly errorPrefix: string;
  public static readonly stderrHeading: string;

  /** The name a TeamRun tool's step carries, `mcp__teamrun__<tool>`, as Claude's steps name it. */
  public static formatTeamRunToolName(tool: string): string;

  /** The name Pi gives an MCP server's tool, `mcp__<server>__<tool>` with each `-` as `_`. */
  public static formatPiMcpToolName(server: string, tool: string): string;

  public static formatPiUnsupported(version: string): string;

  public static formatPiNotReady(provider: string): string;

  public static formatPiAuthInvalid(provider: string, timedOut: boolean): string;

  public static formatPiNotRunning(command: string): string;

  public static formatPiTimedOut(command: string): string;

  public static formatPiRefused(command: string, error: string | null): string;

  public static formatPiExited(code: number | null, signal: string | null, stderr: string): string;

  public static formatPiEventFailed(type: string, error: string): string;
  public static formatPiCompactionFailed(error: string): string;

  public static formatPiRetrying(error: string): string;

  public static formatPiExtensionFailed(error: string): string;

  public static formatPiApprovalFailed(error: string): string;

  public static formatPiQuestionFailed(error: string): string;

  public static formatPiDialogTimedOut(header: string, question: string): string;

  public static formatPiTurnNotFound(entryId: string): string;

  public static formatRolePrompt(instructions: string | null, prompt: string): string;

  /**
   * Explains the native sign-in required for the dedicated profile.
   */
  public static formatGrokSignIn(directory: string): string;

  /**
   * Describes an incomplete native prompt outcome.
   */
  public static formatGrokStopped(reason: string): string;


  /**
   * Describes an OpenCode launch outside a chat turn refused because a file naming the person's MCP servers couldn't be read or isn't JSON with
   * comments, so TeamRun couldn't turn its servers off.
   */
  public static formatOpencodeMcpConfigUnreadable(file: string): string;
  /**
   * Describes an OpenCode launch outside a chat turn refused because a file naming the person's MCP servers is larger than `maximumConfigurationBytes`.
   */
  public static formatOpencodeMcpConfigTooLarge(file: string): string;
  /**
   * Describes an OpenCode turn that stopped for another reason than its end.
   */
  public static formatOpencodeStopped(reason: string): string;

  /**
   * Refuses an OpenCode version outside 1.18.31 and later 1.x: OpenCode 2 or later, which TeamRun hasn't checked keeps the approval rules it sets, or a 1.x
   * before 1.18.31; each says how to install a supported one.
   */
  public static formatOpencodeUnsupported(version: string): string;


  /**
   * Says that Cursor isn't signed in, and that the provider's menu signs the TeamRun profile at `directory` in with `cursor-agent login`, apart
   * from the person's own Cursor setup, or, when `sharedSignIn`, on macOS, that the sign-in is the keychain's, shared with the person's own Cursor
   * CLI, so signing in replaces that CLI's sign-in.
   */
  public static formatCursorSignIn(directory: string, sharedSignIn?: boolean): string;

  /**
   * Describes a Cursor turn that stopped for another reason than its end.
   */
  public static formatCursorStopped(reason: string): string;

  /**
   * Describes an fx turn that stopped for another reason than its end.
   */
  public static formatFxNotFx(reason: string): string;
  public static formatFxStopped(reason: string): string;

  /**
   * Says that `fx logout` failed for an account, with its output when it wrote any.
   */
  public static formatFxSignOutFailed(account: string, output: string | null): string;

  /**
   * Says that `fx logout` didn't end within `milliseconds` for an account.
   */
  public static formatFxSignOutTimedOut(account: string, milliseconds: number): string;

  /**
   * Says that `cursor-agent logout` failed, with its output when it wrote any.
   */
  public static formatCursorSignOutFailed(output: string | null): string;

  /**
   * Says that `cursor-agent logout` didn't end within `milliseconds`.
   */
  public static formatCursorSignOutTimedOut(milliseconds: number): string;

  /**
   * Says that unpacking the Cursor download failed with its exit code, or was stopped when `exitCode` is `null`, and nothing was installed.
   */
  public static formatCursorUnpackFailed(exitCode: number | null): string;

  /**
   * Says that the Cursor download doesn't unpack to a Cursor CLI of the expected size that reports `version`.
   */
  public static formatCursorIncomplete(version: string): string;

  /**
   * Says that TeamRun can't write to the folder Cursor goes in.
   */
  public static formatCursorFolderNotWritable(directory: string): string;

  /**
   * Says that the installed Cursor `version` couldn't be moved aside, for `reason`, so it was kept.
   */
  public static formatCursorReleaseKept(version: string, directory: string, reason: string): string;

  /**
   * Says that the new Cursor `version` couldn't take the installed one's place, for `reason`, so the installed one was kept.
   */
  public static formatCursorReleaseNotReplaced(version: string, directory: string, reason: string): string;

  /**
   * Says that the new Cursor `version` couldn't take the installed one's place, for `reason`, and the installed one couldn't move back, for
   * `backReason`, so it is kept at `aside`, in the install's staging folder, until an install succeeds.
   */
  public static formatCursorReleaseSetAside(version: string, directory: string, aside: string, reason: string, backReason: string): string;

  /**
   * Explains that the new Cursor download couldn't be moved within its staging folder, with the file system's reason as `formatInstallNotReadyReason`
   * gives it, so nothing installed was changed, and, when it was held, to install again in a moment.
   */
  public static formatCursorNotReady(version: string, directory: string, reason: string, isHeld: boolean): string;

  /**
   * Explains that the new Cursor `version` couldn't be moved into `directory`, where no copy was installed, with the file system's reason, so
   * nothing was installed.
   */
  public static formatCursorNotPlaced(version: string, directory: string, reason: string): string;

  /**
   * Says that Cursor was installed in `directory` but isn't found there.
   */
  public static formatCursorNotFoundAfterInstall(directory: string): string;

  /**
   * Says that Cursor `version` was installed in `directory`, but TeamRun runs the one at `path`, which reports `found`, and finds it first.
   */
  public static formatCursorShadowed(version: string, directory: string, path: string, found: string | null): string;

  /**
   * The variables that place Cursor's sign-in and data in a profile, by folder inside it: `CURSOR_DATA_DIR` everywhere, and where Cursor keeps its
   * sign-in file, `XDG_CONFIG_HOME` on Linux and `APPDATA` on Windows; on macOS the sign-in is in the keychain, so neither is set and commands Cursor
   * runs keep the person's own.
   */
  public static cursorSignInVariables(platform: string): Readonly<Record<string, string>>;
  /**
   * Writes the `cli-config.json` of a Cursor profile: the `static` channel, which turns off Cursor's update check and background update, the
   * `allowlist` approval mode, an allow list with `allow` and then each of `approvedTools` of the MCP server `server` by its Cursor name,
   * `Mcp(<server>:<tool>)`, each rule once, and `deny` as the deny list. `allow` and `deny` are empty by default.
   */
  public static formatCursorConfig(server: string, approvedTools: readonly string[], allow?: readonly string[], deny?: readonly string[]): string;
  /**
   * The variables a Cursor launch outside a chat turn points at the profile's empty `title-home` folder: `HOME` on Linux, `HOME` and
   * `USERPROFILE` on Windows, and none on macOS, where Cursor finds its sign-in in the keychain through the person's home.
   */
  public static cursorTitleHomeVariables(platform: string): readonly string[];
  public static formatCursorConfigUnreadable(file: string): string;
  public static formatCursorConfigTooLarge(file: string): string;

  /**
   * The message of a fork request to a provider that can't fork, the same for each such provider.
   * @param displayName The provider kind's display name.
   */
  public static formatForkUnavailable(displayName: string): string;

  /**
   * The message of a fork request through a turn id that isn't a prompt index.
   * @param turnId The turn id.
   */
  public static formatPromptIndexInvalid(turnId: string): string;
  /**
   * The Stop refusals of a provider's background task: the provider no longer lists it as running, it named no process for it, or its process can't be
   * confirmed to run under the provider's.
   */
  public static formatTaskNotListed(providerName: string): string;
  public static formatTaskProcessUnknown(providerName: string): string;
  public static formatAcpTerminalUnknown(terminalId: string): string;
  public static formatAcpTerminalOutside(providerName: string, directory: string): string;
  public static formatTaskProcessGone(providerName: string): string;

  /**
   * The PowerShell script that ends a round of a tree on Windows, then lists the processes again: it opens each process by its id and takes its handle
   * before it reads the start, and ends it through that same handle, which keeps its id from being reused, only when the process started when the
   * listing said, to the millisecond.
   * @param processIds The processes, parents first.
   * @param starts Their starts, in milliseconds since the epoch, as the listing gave them.
   */
  public static formatProcessEndScript(processIds: readonly number[], starts: readonly number[]): string;

  /**
   * What `PowershellSession` writes to its shell for a script: the script on its line, then the marker as a quoted string on its own line, which the
   * shell writes back once the script has run.
   * @param script The script, on one line.
   * @param marker The marker that ends the script's output.
   */
  public static formatPowershellSessionInput(script: string, marker: string): string;

  /**
   * The failure of a `PowershellSession` script that ran out of time.
   * @param milliseconds How long it could take.
   */
  public static formatPowershellSessionTimedOut(milliseconds: number): string;

  /**
   * Explains Copilot's own sign-in, for the profile's folder when the provider names one.
   */
  public static formatCopilotSignIn(directory: string | null): string;

  /**
   * Logs a Copilot model listing that failed, timed out or came back empty while signed in, naming the provider by the end of its id.
   */
  public static formatCopilotListingFailed(providerId: string | null, reason: string): string;

  /**
   * Logs a Copilot model listing that failed, timed out or came back empty on its headless server and then failed over its ACP server too, naming the provider by the end of its id.
   */
  public static formatCopilotListingsFailed(providerId: string | null, reason: string, acpKind: string): string;

  /**
   * Logs a Copilot model listing that came back empty, signed in, from its headless server and from its ACP server, naming the provider by the end of its id.
   */
  public static formatCopilotListingsEmpty(providerId: string | null): string;

  /**
   * Logs a Copilot model listing that failed or timed out on its headless server while its ACP server, signed in, lists no models, naming the provider by the end of its id.
   */
  public static formatCopilotListingFailedAndAcpListsNone(providerId: string | null, reason: string): string;

  /**
   * Describes a Copilot model listing that failed or timed out with no models over ACP either, so it fails rather than reads as a list Copilot doesn't give.
   */
  public static formatCopilotModelsNotListed(reason: string): string;

  /**
   * Logs a failure to delete the session a Copilot model listing opened.
   */
  public static formatCopilotListingSessionDeleteFailed(kind: string): string;

  /**
   * Logs a Copilot model listing server that did not stop.
   */
  public static formatCopilotListingStopFailed(kind: string): string;

  /**
   * Describes a typed model name Copilot can't be started with.
   */
  public static formatCopilotModelNameInvalid(model: string): string;

  /**
   * Describes an incomplete Copilot prompt outcome.
   */
  public static formatCopilotMcpConfigUnreadable(file: string): string;
  /**
   * Says that a provider's MCP configuration file couldn't be read or isn't JSON, for the MCP servers view.
   */
  public static formatOwnMcpConfigUnreadable(file: string): string;
  /**
   * Says that a provider's MCP configuration file is larger than `maximumConfigurationBytes`, so the MCP servers view didn't read it.
   */
  public static formatOwnMcpConfigTooLarge(file: string): string;
  /**
   * Says that Muse Code's settings have a `schema_version` it doesn't read, so the MCP servers view didn't list their servers.
   */
  public static formatMuseSettingsUnsupported(file: string): string;
  /**
   * Describes a Copilot start, or a listing of its servers, refused because a file naming its MCP servers is larger than
   * `maximumConfigurationBytes`.
   */
  public static formatCopilotMcpConfigTooLarge(file: string): string;
  /**
   * Describes a Copilot start refused because one of the MCP files Copilot reads names a server `teamrun`, or the profile's `settings.json` turns on
   * a plugin `teamrun`, which TeamRun can't turn off apart from its own server of that name.
   * @param source Where the file comes from: `copilotUserMcpSource`, `copilotProjectMcpSource` or `copilotPluginMcpSource`, which `settings.json`
   * gives too.
   * @param file The file's path.
   */
  public static formatCopilotTeamRunServerNamed(source: string, file: string): string;
  /**
   * The argument that lets Copilot run the given tools of one MCP server without asking, as `--allow-tool=teamrun(a),teamrun(b)`, which Copilot
   * matches on the server's and the tool's exact names.
   * @param server The MCP server's name.
   * @param tools The tools' names, each matching `approvedToolNamePattern`.
   */
  public static formatCopilotAllowedTools(server: string, tools: readonly string[]): string;
  public static formatCopilotStopped(reason: string): string;

  /**
   * Explains that a provider's chosen Antigravity server, or its harness, isn't at the path it names.
   */
  public static formatAntigravityChosenNotFound(path: string): string;

  /**
   * Explains that an Antigravity server isn't of the pinned major and minor version, 1.3.
   */
  public static formatAntigravityUnsupported(version: string | null): string;

  /**
   * Explains why the Antigravity server found on `PATH` doesn't count as installed: its version isn't 1.3.x, or it named none.
   */
  public static formatAntigravityPathUnsupported(path: string, version: string | null): string;

  /**
   * Explains that a version folder exists without a complete installation in it.
   */
  public static formatAntigravityIncomplete(directory: string): string;

  /**
   * Explains that unpacking the download failed, with the extractor's exit code, or that it was stopped (`null`).
   */
  public static formatAntigravityUnpackFailed(exitCode: number | null): string;

  /**
   * Explains that re-signing the server on an Intel Mac failed, with codesign's exit code, or that codesign could not run or finish (`null`).
   */
  public static formatAntigravitySignFailed(exitCode: number | null): string;

  /**
   * Explains that a tool's download answered with an HTTP status other than a body to read.
   */
  public static formatDownloadFailed(name: string, status: number): string;

  /**
   * Explains that a tool's download failed its size or SHA-256 check.
   */
  public static formatAcpAgentArchiveInsecure(name: string): string;
  public static formatDownloadInsecure(name: string): string;
  public static formatAcpArgumentLineBreak(command: string): string;
  public static formatAcpAgentNoExtractor(name: string): string;
  public static formatAcpAgentPackageRefused(name: string, packageName: string): string;
  public static formatAcpAgentNoNpm(name: string): string;
  public static formatAcpAgentNoBuild(name: string): string;
  public static formatAcpAgentUvx(name: string): string;
  public static formatAcpAgentFolderNotWritable(directory: string): string;
  public static formatAcpAgentArchiveUnsafe(name: string): string;
  public static formatAcpAgentUnpackFailed(name: string, exitCode: number | null): string;
  public static formatAcpAgentNpmFailed(name: string, exitCode: number | null, output: string): string;
  public static formatAcpAgentPackageIncomplete(name: string, packageName: string): string;
  public static formatAcpAgentNoProgram(packageName: string): string;
  public static formatAcpAgentProgramMissing(name: string, path: string): string;
  public static formatAcpAgentNotPlaced(name: string, folder: string, code: string, held: boolean): string;
  public static formatLocalAcpSecretUnreadable(name: string, variable: string, reason: string): string;
  public static formatLocalAcpSecretMissing(name: string, variable: string): string;
  public static formatDownloadMismatch(name: string): string;

  /**
   * Explains that a tool's download of no published size went past the most bytes TeamRun takes.
   */
  public static formatDownloadTooLarge(name: string, limit: number): string;

  /**
   * Explains that a tool's releases couldn't be reached, or that the connection dropped during a download.
   */
  public static formatReleasesUnreachable(name: string): string;

  /**
   * Why a tool's install the person cancelled installed nothing.
   */
  public static formatInstallCancelled(name: string): string;

  /**
   * The part of an install's not-ready message that gives the file system's code in brackets, or nothing when the error has none, and, only for an
   * `InstallHeldException`, that something such as a virus scanner still held the file.
   */
  public static formatInstallNotReadyReason(reason: string, isHeld: boolean): string;

  public static formatLocalAcpIdInvalid(id: string): string;
  public static formatGeneralAcpToolTitle(name: string): string;
  public static formatGeneralAcpNotFound(name: string): string;
  /**
   * Why a general ACP agent takes one provider: it runs in the person's home folder with the one sign-in it keeps there, which its profile folder doesn't change.
   */
  public static formatGeneralAcpSingleAccount(name: string): string;
  /**
   * Explains that a general ACP agent's `initialize` lists no sign-in of the `agent` type, so the person signs in with the agent's own command.
   */
  public static formatGeneralAcpSignInUnavailable(name: string): string;
  public static formatGeneralAcpSignIn(name: string): string;
  public static formatGeneralAcpStopped(name: string, reason: string): string;

  /**
   * Explains that the ACP registry answered its list of agents with an HTTP status other than success.
   */
  public static formatAcpRegistryFailed(status: number): string;
  public static formatAcpRegistryIdInvalid(id: string): string;
  public static formatAcpRegistryOwnProvider(id: string): string;
  public static formatAcpRegistryVersionInvalid(id: string, version: string): string;
  public static formatAcpRegistryArchiveInvalid(archive: string): string;
  public static formatAcpRegistryCommandInvalid(command: string): string;
  public static formatAcpRegistrySha256Invalid(sha256: string): string;
  public static formatAcpRegistryVariableInvalid(name: string): string;

  /**
   * Explains that a tool's release channel answered its latest version with an HTTP status other than success.
   */
  public static formatReleaseChannelFailed(name: string, status: number): string;

  /**
   * Explains that a tool's release channel answered its latest version with something that isn't one.
   */
  public static formatReleaseChannelUnreadable(name: string): string;

  /**
   * Explains that a Claude Code version's manifest has no build for this computer with a SHA-256 and a size.
   */
  public static formatClaudeBuildMissing(version: string): string;

  /**
   * Explains that a Claude Code build's own setup finished but left another version installed, or one TeamRun can't read (`null`).
   */
  public static formatClaudeSetupKept(version: string, installed: string | null): string;

  /**
   * Explains that a downloaded Claude Code build's own setup failed with its exit code, or was stopped from outside before it ended (`null`).
   */
  public static formatClaudeSetupFailed(version: string, exitCode: number | null): string;

  /**
   * Explains that a Codex release lists no package for this computer with a SHA-256.
   */
  public static formatCodexPackageMissing(version: string): string;

  /**
   * Explains that unpacking the Codex package failed with tar's exit code, or was stopped (`null`).
   */
  public static formatCodexUnpackFailed(exitCode: number | null): string;

  /**
   * Explains that a Codex release lacks some of its package's files, or that its program doesn't report the version.
   */
  public static formatCodexIncomplete(version: string): string;

  /**
   * Explains that a path Codex links isn't a link or an empty folder, so it was left as it is.
   */
  public static formatCodexNotReplaced(path: string): string;

  /**
   * Explains that an incomplete Codex release couldn't be moved aside, with the file system's reason, so it was kept whole.
   */
  public static formatCodexReleaseKept(version: string, directory: string, reason: string): string;

  /**
   * Explains that the new Codex release couldn't be renamed into place, with the file system's reason, so the incomplete one moved aside was moved back and kept whole.
   */
  public static formatCodexReleaseNotReplaced(version: string, directory: string, reason: string): string;

  /**
   * Says that the new Codex `version` couldn't take the incomplete installed one's place, for `reason`, and the installed one couldn't move back, for
   * `backReason`, so it is kept at `aside`, in the install's staging folder, until an install succeeds.
   */
  public static formatCodexReleaseSetAside(version: string, directory: string, aside: string, reason: string, backReason: string): string;

  /**
   * Explains that Codex's standalone folder can't be written, before anything changed.
   */
  public static formatCodexFolderNotWritable(directory: string): string;

  /**
   * Explains that Codex's release was switched to, but its command folder can't be written.
   */
  public static formatCodexCommandNotWritable(version: string, root: string, directory: string): string;

  /**
   * Explains that Codex was installed in its folder but isn't found there.
   */
  public static formatCodexNotFoundAfterInstall(directory: string): string;

  /**
   * Explains that the Codex TeamRun runs is another one, earlier on the PATH, with its version, or `null` when it can't be read.
   */
  public static formatCodexShadowed(version: string, directory: string, path: string, found: string | null): string;

  /**
   * Explains that a Copilot release lists no archive for this computer with a SHA-256.
   */
  public static formatCopilotArchiveMissing(version: string): string;

  /**
   * Explains that unpacking the Copilot archive failed with tar's exit code, or was stopped (`null`).
   */
  public static formatCopilotUnpackFailed(exitCode: number | null): string;

  /**
   * Explains that a Copilot archive has no program, or that its program doesn't report the version.
   */
  public static formatCopilotIncomplete(version: string): string;

  /**
   * Explains that the folder Copilot goes in can't be written, before anything changed.
   */
  public static formatCopilotFolderNotWritable(directory: string): string;

  /**
   * Explains that an installed Copilot version couldn't be moved aside, with the file system's reason, so it was kept whole.
   */
  public static formatCopilotReleaseKept(version: string, directory: string, reason: string): string;

  /**
   * Explains that the new Copilot version couldn't be moved within its staging folder, with the file system's reason as `formatInstallNotReadyReason`
   * gives it, so nothing installed was changed, and, when it was held, to install again in a moment.
   */
  public static formatCopilotNotReady(version: string, directory: string, reason: string, isHeld: boolean): string;

  /**
   * Explains that the new Copilot version couldn't be renamed into place, with the file system's reason, so the one moved aside was moved back and kept whole.
   */
  public static formatCopilotReleaseNotReplaced(version: string, directory: string, reason: string): string;

  /**
   * Says that the new GitHub Copilot `version` couldn't take the installed one's place, for `reason`, and the installed one couldn't move back, for
   * `backReason`, so it is kept at `aside`, in the install's staging folder, until an install succeeds.
   */
  public static formatCopilotReleaseSetAside(version: string, directory: string, aside: string, reason: string, backReason: string): string;

  /**
   * Explains that Copilot was installed in its folder but isn't found there.
   */
  public static formatCopilotNotFoundAfterInstall(directory: string): string;

  /**
   * Explains that the Copilot TeamRun runs is another one, found first, with its version, or `null` when it can't be read.
   */
  public static formatCopilotShadowed(version: string, directory: string, path: string, found: string | null): string;










  /**
   * Explains that a Grok download doesn't unpack to a program of its pinned size that reports the version.
   */
  public static formatGrokIncomplete(version: string): string;

  /**
   * Explains that the folder Grok goes in can't be written, before anything changed.
   */
  public static formatGrokFolderNotWritable(directory: string): string;

  /**
   * Explains that Grok's program or a command couldn't be moved aside, with the file system's reason, so Grok was kept as it was.
   */
  public static formatGrokKept(path: string, reason: string): string;

  /**
   * Explains that the new program or a command for a path couldn't be moved within the staging folder, with the file system's reason as
   * `formatInstallNotReadyReason` gives it, so Grok was kept as it was, and, when it was held, to install again in a moment.
   */
  public static formatGrokNotReady(path: string, reason: string, isHeld: boolean): string;

  /**
   * Explains that the new program or a command couldn't be renamed into place, with the file system's reason, so all that was replaced was moved back and Grok kept as it was.
   */
  public static formatGrokNotReplaced(path: string, reason: string): string;

  /**
   * Explains that an update failed and what it had replaced couldn't all be moved back, so Grok should be installed again.
   */
  public static formatGrokNotRestored(directory: string): string;

  /**
   * Explains that Grok was installed in its folder but isn't found there.
   */
  public static formatGrokNotFoundAfterInstall(directory: string): string;

  /**
   * Explains that the Grok TeamRun runs is another one, earlier on the PATH, with its version, or `null` when it can't be read.
   */
  public static formatGrokShadowed(version: string, directory: string, path: string, found: string | null): string;

  /**
   * Explains the Google sign-in the dedicated profile needs.
   */
  public static formatAntigravityNotLinked(path: string, target: string, error: string): string;
  public static formatAntigravitySignIn(directory: string): string;

  /**
   * Describes a turn whose model the provider doesn't offer, and how to choose another, in the app's own words.
   * @param kind The kind's display name.
   * @param model The model the turn asked for.
   * @returns Such as "Grok doesn't offer the model grok-4.7. Open the teammate or the composer's model menu, refresh the models, and choose one.".
   */
  public static formatModelUnavailable(kind: string, model: string): string;
  /**
   * Describes a turn whose teammate's mode the provider's session doesn't offer.
   * @param kind The provider's display name.
   * @param mode The mode's name.
   * @returns Such as "Grok doesn't offer the mode Plan in this session. Choose another mode for the teammate.".
   */
  public static formatModeUnavailable(kind: string, mode: string): string;
  /**
   * Formats the note of an approved plan whose agent couldn't be switched out of its plan mode.
   * @param provider The provider's display name.
   * @param error Why the switch failed.
   * @returns Such as "Cursor couldn't leave its plan mode once the plan was approved: Mode refused".
   */
  public static formatPlanModeKept(provider: string, error: string): string;

  /**
   * Formats the note of a to-do list notification that couldn't be read, which leaves the reply's plan as it was.
   * @param provider The provider's display name.
   * @param error Why it couldn't be read.
   * @returns Such as "Cursor's to-do list couldn't be read: $.todos isn't an array".
   */
  public static formatToDoListUnread(provider: string, error: string): string;

  /**
   * Formats the note of a plan request whose plan couldn't be read, which the turn answers as dismissed.
   * @param provider The provider's display name.
   * @param error Why it couldn't be read.
   * @returns Such as "Cursor's plan couldn't be read, so TeamRun cancelled it: $.plan is blank".
   */
  public static formatPlanUnread(provider: string, error: string): string;
  /**
   * Describes a turn whose session stays in an unrestricted mode after TeamRun tried to switch it to the default.
   * @param kind The provider's display name.
   * @param mode The unrestricted mode's name.
   * @returns Such as "Antigravity's session is in the mode YOLO, which lifts its restrictions, and it couldn't switch to its default mode, so TeamRun didn't
   * send the prompt.".
   */
  public static formatUnrestrictedMode(kind: string, mode: string): string;
  /**
   * Describes a turn whose model a provider lacks while it advertises only the models it lists before its catalog loads.
   * @param kind The kind's display name.
   * @param model The model the turn asked for.
   * @returns Such as "Grok hasn't loaded its models yet, so it can't use grok-4.7 now. Try again in a moment.".
   */
  public static formatModelsNotLoaded(kind: string, model: string): string;
  /**
   * Formats the note for a `/compact` an added agent answered without reporting a compaction in ACP's `compaction_update`, such as "Devin
   * answered /compact without reporting a compaction, so its context may not be compacted.".
   * @param kind The kind's display name.
   * @returns The note.
   */
  public static formatCompactionUnreported(kind: string): string;
  /**
   * Formats the note for a `/compact` sent to an agent that can't compact, such as "Antigravity can't compact its context.".
   * @param kind The kind's display name.
   * @returns The note.
   */
  public static formatCannotCompact(kind: string): string;
  /**
   * Formats the action a provider that can't run a `/` command refuses, as in "Codex can't run /diff: …".
   * @param command The command's `/` and name.
   * @returns The action, such as "run /review".
   */
  public static formatRunCommand(command: string): string;
  /**
   * Formats the note for a `/` command sent with files, such as "TeamRun passes /review on to Grok only as a message of its own, without files, so it didn't send it.".
   * @param kind The kind's display name.
   * @param command The command's `/` and name.
   * @returns The note.
   */
  public static formatCommandWithFiles(kind: string, command: string): string;
  /**
   * Formats the note for a `/` command the agent didn't list, such as "Grok didn't list /deploy, so TeamRun didn't send it. It lists /review, /init.",
   * or "Grok listed no commands, so TeamRun didn't send /deploy." without a list.
   * @param kind The kind's display name.
   * @param command The command's `/` and name.
   * @param listed The names the agent listed, without their `/`.
   * @returns The note.
   */
  public static formatCommandUnlisted(kind: string, command: string, listed: readonly string[]): string;

  /**
   * Describes an incomplete Antigravity prompt outcome.
   */
  public static formatAntigravityStopped(reason: string): string;

  public static formatAcpTimeout(method: string): string;

  /**
   * Explains that the agent, with its version when it reported one, answered none of its sign-out methods, and how to get past it.
   */
  public static formatAcpLogoutUnsupported(kind: string, version: string | null): string;
  public static formatSigningOut(kind: string): string;
  /**
   * Says the provider didn't start because TeamRun began closing while its environment was read.
   */
  public static formatStoppedForShutdown(kind: string): string;
  public static formatTurnStoppedForSignOut(kind: string): string;
  public static formatAcpSignOutTimedOut(kind: string, milliseconds: number): string;
  public static formatAcpSignOutUnanswered(kind: string, version: string | null, methods: readonly string[]): string;

  /**
   * Formats `<method>: <message> (code <code>)`.
   * @param method The method.
   * @param message The error message.
   * @param code The error code.
   * @returns The text.
   */
  public static formatAppServerError(method: string, message: string, code: number): string;

  /**
   * Formats the message for a request made while the app-server is not running.
   * @param method The method.
   * @returns The text.
   */
  public static formatAppServerNotRunning(method: string): string;

  /**
   * Formats the message for a request that timed out.
   * @param method The method.
   * @returns The text.
   */
  public static formatAppServerTimedOut(method: string): string;

  /**
   * Formats the Codex thread setting that sets one variable in the thread's shell commands, a dotted override that leaves the person's other
   * shell environment settings as they are.
   * @param name The variable's name.
   * @returns The setting's dotted path.
   */
  /**
   * Formats the note under a sub-agent whose tool use TeamRun denied because the reply that started it has ended and no reply in the chat is running to
   * ask in.
   * @param toolName The tool it asked to use.
   */
  public static formatClaudeSubAgentUnasked(toolName: string): string;

  /**
   * Formats the log line with a session's `model` and `thought_level` options.
   * @param kind The provider kind's id.
   * @param options The options as `AcpConfigOption.toLog` gives them, as JSON.
   */
  public static formatAcpModelOptions(kind: string, options: string): string;
  /**
   * Formats the log line written when an agent that `awaitsTeamRunTools` gets its prompt without TeamRun's tools.
   * @param kind The provider kind's id.
   * @param missing Why the tools weren't listed, as the chat's note gives it.
   * @param blocked The reason the agent's own log gives for blocking TeamRun's server since the turn started, or `null` when it gives none.
   */
  public static formatTeamRunToolsUnlisted(kind: string, missing: string, blocked?: string | null): string;
  /**
   * Formats why TeamRun's tools are missing when an agent didn't list them within the wait from its session's start.
   * @param name The agent's name.
   * @param milliseconds How long the turn waited.
   */
  public static formatTeamRunToolsTimedOut(name: string, milliseconds: number): string;
  /**
   * Formats why TeamRun's tools are missing when listing them to the agent failed.
   * @param name The agent's name.
   * @param reason The failure, described.
   */
  public static formatTeamRunToolsFailed(name: string, reason: string): string;
  /**
   * Formats why TeamRun's tools are missing when the agent's process ended before it listed them.
   * @param name The agent's name.
   */
  public static formatTeamRunToolsAgentEnded(name: string): string;
  /**
   * The reason in the chat's note when Gemini CLI connected none of the turn's MCP servers: it connects none in a folder it doesn't trust,
   * and how the person trusts the chat's folder. It names no path, since the chat shows a path inside the chat's folder relative to it.
   */
  public static readonly geminiCliUntrustedFolder: string;
  /**
   * The reason in the chat's note when Gemini CLI listed none of TeamRun's tools before the wait for them ended in a folder it trusts: what
   * can leave them out, without telling the person to trust a folder.
   */
  public static readonly geminiCliToolsUnlisted: string;
  public static formatShellEnvironmentSetting(name: string): string;

  /**
   * Formats the message for a Codex sign-in that ended without signing in, ending in one period.
   * @param error What Codex reported; its own closing periods are dropped.
   * @returns The text.
   */
  public static formatCodexSignInFailed(error: string): string;

  /**
   * Formats the message for an app-server exit, with the stderr tail when there is one.
   * @param code The exit code, or `null`.
   * @param signal The signal, or `null`.
   * @param stderr The stderr tail.
   * @returns The text.
   */
  public static formatAppServerExited(code: number | null, signal: string | null, stderr: string): string;

  /**
   * Formats the error for a turn that ended with a status other than completed, interrupted, or
   * a failure with a message.
   * @param status The status.
   * @returns The text.
   */
  public static formatTurnStatus(status: string): string;

  /**
   * Formats the message for a server request TeamRun does not answer.
   * @param method The method.
   * @returns The text.
   */
  public static formatUnsupportedServerRequest(method: string): string;

  /**
   * Formats the error for an effort the provider does not accept.
   * @param effort The effort.
   * @param kind The kind's display name.
   * @returns The text.
   */
  public static formatUnknownEffort(effort: string, kind: string): string;

  /**
   * Formats the log line for one of the person's own MCP servers Claude couldn't set, without Claude's reason, which could repeat the server's settings.
   * @param name The server.
   * @returns The text.
   */
  public static formatClaudeOwnServerNotSet(name: string): string;

  /**
   * Formats the log line for Claude's own MCP servers not read for a chat.
   * @param error The reason.
   * @returns The text.
   */
  public static formatClaudeOwnServersUnread(error: string): string;
  public static formatClaudeProjectServersUnread(error: string): string;

  /**
   * Formats the log line for Claude's folder trust not read for a chat.
   * @param error The reason.
   * @returns The text.
   */
  public static formatClaudeTrustUnread(error: string): string;

  /**
   * Formats the log line for an MCP server Claude couldn't set.
   * @param name The server.
   * @param error Claude's reason.
   * @returns The text.
   */
  public static formatClaudeServerNotSet(name: string, error: string): string;

  /**
   * Formats the log line for a shared MCP server Claude was still connecting when the turn ended.
   * @param name The server's name.
   * @returns The text.
   */
  public static formatClaudeServerPendingAtTurnEnd(name: string): string;

  /**
   * Formats the log line for a note on the shared MCP servers an agent's log names as blocked that couldn't reach the chat.
   * @param kind The provider kind's id.
   * @param reason Why it couldn't.
   * @returns The text.
   */
  public static formatBlockedServersUnnoted(kind: string, reason: string): string;
  /**
   * Formats the log line for a read of Claude's shared MCP server states that stopped on an error.
   * @param reason Why it stopped.
   * @returns The text.
   */
  public static formatClaudeServerSettleFailed(reason: string): string;

  /**
   * Formats the log line for a read of Claude's MCP server states that failed.
   * @param reason Why the read failed.
   * @returns The text.
   */
  public static formatClaudeServerStatusUnread(reason: string): string;

  /**
   * Formats the log line for a shared MCP server Claude was still connecting when TeamRun stopped reading its states.
   * @param name The server's name.
   * @param milliseconds How long TeamRun read them.
   * @returns The text.
   */
  public static formatClaudeServerStillPending(name: string, milliseconds: number): string;

  /**
   * The log line for a Claude wake whose tools refused the chat's kept token.
   * @param sessionId The chat's Claude session.
   * @returns The text.
   */
  public static formatClaudeWakeTokenRefused(sessionId: string | null): string;

  /**
   * The log line for a task whose end the listener failed to take while its Claude chat closed.
   * @param taskId The task's id.
   * @param reason Why the end wasn't taken.
   * @returns The text.
   */
  public static formatClaudeTaskEndUnrecorded(taskId: string, reason: string): string;

  /**
   * The log line for a step of a closing Claude chat that failed, such as ending its turn, its wake or its sub-agents.
   * @param sessionId The chat's Claude session.
   * @param reason Why the step failed.
   * @returns The text.
   */
  public static formatClaudeChatCloseFailed(sessionId: string | null, reason: string): string;

  /**
   * The log line for an idle Claude chat whose compaction wake failed to start.
   * @param sessionId The chat's Claude session.
   * @param reason Why the wake failed.
   * @returns The text.
   */
  public static formatClaudeCompactionWakeFailed(sessionId: string | null, reason: string): string;

  /**
   * Formats the log line for a Codex turn or wake whose thread's sender token another reply still takes.
   * @param threadId The thread.
   * @returns The text.
   */
  public static formatCodexHeldSenderRefused(threadId: string): string;

  /**
   * Formats the log line for a session that couldn't be carried into another account's profile for a Sustain move.
   * @param kind The provider's name.
   * @param sessionId The session.
   * @param error What failed.
   * @returns The text.
   */
  public static formatSessionNotCarried(kind: string, sessionId: string, error: string): string;

  /**
   * The log line naming the processes a sub-agent's stop ended after Codex's `thread/backgroundTerminals/clean` on its thread left them running
   * outside the app-server.
   * @param threadId The sub-agent's thread.
   * @param processIds The processes ended.
   * @returns The text.
   */
  public static formatCodexOrphansEnded(threadIds: string, processIds: readonly number[]): string;
  public static formatProcessEnvironmentPath(processId: number): string;

  /**
   * Formats the log line for a Codex turn that waits for the turn running on its thread to end, since Codex runs one turn on a thread at a time.
   * @param threadId The thread.
   * @returns The text.
   */
  public static formatCodexTurnAwaitsThread(threadId: string): string;

  /**
   * Formats the log line for a Codex turn whose thread its background tasks hold with a token TeamRun no longer accepts.
   * @param threadId The thread.
   * @returns The text.
   */
  public static formatCodexHeldTokenRefused(threadId: string): string;

  /**
   * The payload of the note for a native session that could not be resumed, which marks it as a note about the chat rather than a step.
   */
  public static readonly resumeNotePayload: JsonObject;

  /**
   * Formats a Cursor turn's error for a refusal Cursor sent as its answer.
   * @param refusal One of `cursorRefusals`.
   * @returns The text.
   */
  public static formatCursorRefused(refusal: string): string;

  /**
   * Formats the note for a native session that could not be resumed.
   * @param error Why.
   * @returns The text.
   */
  public static formatResumeFailed(error: string): string;

  /**
   * Heads the instruction files TeamRun read for a provider that reads none itself: the person's own from their home, then the project's.
   */
  public static formatHomeInstructions(kind: string, content: string): string;

  /**
   * Composes the system prompt addition that carries the instruction files.
   */
  public static formatPersonInstructions(content: string): string;

  /**
   * Heads one instruction file's text with its path.
   */
  public static formatInstructionFile(path: string, content: string): string;

  /**
   * Names the instruction files left out to keep all of them under the total length.
   */
  public static formatInstructionsLeftOut(paths: readonly string[]): string;

  /**
   * Formats the note for a Claude Code that stayed in its plan mode after the person approved the plan.
   * @param error Why.
   * @returns The text.
   */
  public static formatClaudePlanModeKept(error: string): string;

  /**
   * Formats the log line for an open Claude chat that didn't return to its plan mode when its chat started planning first again.
   * @param sessionId The chat's session.
   * @param error Why.
   * @returns The text.
   */
  public static formatClaudePlanModeNotReturned(sessionId: string | null, error: string): string;

  /**
   * Formats the note for a turn that doesn't plan first but may still run in plan mode, because Claude Code refused to leave it or didn't answer
   * in time.
   * @param error Why.
   * @returns The text.
   */
  public static formatClaudePlanModeStayed(error: string): string;

  /**
   * Formats the note for a wake reply stopped because Claude Code didn't return to its plan mode while the chat plans first.
   * @param error Why.
   * @returns The text.
   */
  public static formatClaudeWakePlanModeRefused(error: string): string;

  /**
   * Explains that Claude Code didn't answer the request to leave its plan mode within the request time, in seconds.
   * @param milliseconds The request time.
   * @returns The text.
   */
  public static formatClaudePlanModeTimedOut(milliseconds: number): string;

  /**
   * The note for a reply whose sender token was left out because Claude Code was still starting the person's own MCP servers, which would have got it.
   */
  public static readonly claudeSenderLeftOut: string;

  /**
   * Formats the note for a reply whose sender token Claude Code refused.
   * @param error Why.
   * @returns The text.
   */
  public static formatClaudeSenderRefused(error: string): string;

  /**
   * Formats a command's transcript: the prompt line, the shell's full call when the command was unwrapped from one, the output, and the exit code when known.
   * @param command The command shown on the prompt line.
   * @param call The shell's full call, or `null` when the command is shown as it was sent.
   * @param output The output shown.
   * @param exitCode The exit code, or `null`.
   * @returns The text.
   */
  public static formatCommandStatus(command: string, call: string | null, output: string, exitCode: number | null): string;

  /**
   * Formats a shell's script for the prompt line: its first line, followed by an ellipsis when it has more.
   * @param command The script.
   * @returns The text.
   */
  public static formatInnerCommand(command: string): string;

  /**
   * Formats one group of file changes as `<verb> <files>`, such as `Added a.ts, b.ts`.
   * @param verb The group's verb.
   * @param files The group's files.
   * @returns The text.
   */
  public static formatFileChanges(verb: string, files: string): string;

  /**
   * Formats a moved file as `<from> to <to>`.
   * @param from The file's old path.
   * @param to The file's new path.
   * @returns The text.
   */
  public static formatMovedFile(from: string, to: string): string;

  /**
   * Formats an MCP tool call's title, without its status, which the step's badge shows.
   * @param server The server.
   * @param tool The tool.
   * @returns The text.
   */
  public static formatMcpToolCall(server: string, tool: string): string;

  /**
   * A reference to an environment variable that Claude reads from its own environment, `${<variable>}`; it holds no value.
   */
  public static formatEnvironmentReference(variable: string): string;

  /**
   * A bearer token's header value as a reference to its variable, `Bearer ${<variable>}`.
   */
  public static formatBearerReference(variable: string): string;

  /**
   * The start of the names Claude gives a server's MCP tools, `mcp__<server>__`.
   */

  /**
   * Why a provider can't take a shared MCP server that names a variable TeamRun keeps out of the provider's environment.
   */
  public static formatSharedMcpVariableWithheld(provider: string, variable: string): string;

  /**
   * `formatSharedMcpVariableWithheld` and `formatSharedMcpSenderTokenWithheld` in a few words: `<variable> kept from it`.
   */
  public static formatSharedMcpVariableWithheldShort(variable: string): string;

  /**
   * Why Pi can't take a shared MCP server that names a `TEAMRUN_PI_` variable, in any case, such as the token of TeamRun's tools.
   */
  public static formatPiOwnVariableWithheld(variable: string): string;

  /**
   * Why a provider can't take a shared MCP server that names TeamRun's sender token, in any case, which `SharedMcpLauncher` withholds.
   */
  public static formatSharedMcpSenderTokenWithheld(provider: string, variable: string): string;

  /**
   * Why an ACP agent takes no shared MCP servers until a run shows it keeps their values out of its session files.
   */
  public static formatSharedMcpUnconfirmed(provider: string): string;

  /**
   * Why a provider that takes saved secrets only for its stdio servers can't take an HTTP server with one.
   */
  public static formatSavedSecretsStdioOnly(provider: string): string;

  /**
   * Why a provider that reads a shared server's values only from its own environment can't take a server with a saved secret.
   */
  public static formatSavedSecretsFromEnvironmentOnly(provider: string): string;

  /** Why a provider's turn with TeamRun's tools fails while TeamRun's endpoint isn't serving. */
  public static formatToolsNotServed(provider: string): string;

  /** Why an ACP agent's turn with TeamRun's tools fails when its `initialize` offers no HTTP MCP servers. */
  public static formatAcpToolsNeedHttp(provider: string): string;

  /**
   * Why a turn fails when it passes a shared HTTP server to an ACP agent whose `mcpCapabilities` don't have `http`.
   */
  public static formatAcpHttpServerUnsupported(provider: string, server: string): string;

  /**
   * A bearer token's header value, `Bearer <token>`.
   */
  public static formatBearerValue(token: string): string;

  /**
   * The note for an MCP server's request through Codex that TeamRun can't show, which TeamRun answers `cancel`.
   * @param server The server's name.
   * @returns The text.
   */
  public static formatCodexElicitationUnshown(server: string): string;

  /**
   * The note for a question in Codex's `item/tool/requestUserInput` that TeamRun can't read, which it answers with no answer.
   * @param error Why it couldn't be read.
   * @returns The text.
   */
  public static formatCodexQuestionUnread(error: string): string;

  /**
   * The note for a question Codex posts with an agent message that TeamRun can't read, which the reply doesn't show.
   * @param error Why it couldn't be read.
   * @returns The text.
   */
  public static formatCodexPostedQuestionUnread(error: string): string;

  /**
   * The note, or log line, for a notification from Codex that a handler failed on, so what it carried may not show.
   * @param method The notification's method.
   * @param error Why the handler failed.
   * @returns The text.
   */
  public static formatCodexNotificationFailed(method: string, error: string): string;

  /**
   * Formats a Terminal command step: the command's transcript, and a last line when the command still runs in the terminal.
   * @param command The command, or the keys typed with control characters escaped.
   * @param output The output shown.
   * @param exitCode The exit code, or `null`.
   * @param isRunning Whether the command still runs when the call returns.
   * @returns The text.
   */
  public static formatTerminalStep(command: string, output: string, exitCode: number | null, isRunning: boolean): string;

  /**
   * Titles a Terminal command step by the terminal it ran in: `Run in <terminal>` or `Sent keys to <terminal>`.
   * @param tool The tool, `terminal_run` or `terminal_write`.
   * @param terminal The terminal's title, or `null` before the result names it.
   * @returns The title.
   */
  public static formatTerminalStepTitle(tool: string, terminal: string | null): string;

  /**
   * Formats a dynamic tool call's title, without its status, which the step's badge shows.
   * @param tool The tool.
   * @returns The text.
   */
  public static formatToolCall(tool: string): string;

  /**
   * Formats a web search.
   * @param query The query.
   * @returns The text.
   */
  public static formatWebSearch(query: string): string;

  /**
   * Formats the title of a step that searched files.
   * @param pattern The pattern searched for.
   * @param paths The paths searched, empty when the command names none.
   * @returns The title.
   */
  public static formatSearchedTitle(pattern: string, paths: readonly string[]): string;

  /**
   * Formats the title of a step that read whole files.
   * @param files The files.
   * @returns The title.
   */
  public static formatReadTitle(files: readonly string[]): string;

  /**
   * Formats the title of a step that read the start of a file.
   * @param file The file.
   * @returns The title.
   */
  public static formatReadStartTitle(file: string): string;

  /**
   * Formats the title of a step that read the end of a file.
   * @param file The file.
   * @returns The title.
   */
  public static formatReadEndTitle(file: string): string;

  /**
   * Formats the title of a step that listed a folder.
   * @param path The folder.
   * @returns The title.
   */
  public static formatListedTitle(path: string): string;

  /**
   * Formats the title of a step that listed a folder and its subfolders.
   * @param path The folder.
   * @returns The title.
   */
  public static formatListedTreeTitle(path: string): string;

  /**
   * Formats the title of a step that changed the working folder.
   * @param path The folder.
   * @returns The title.
   */
  public static formatChangedFolderTitle(path: string): string;

  /**
   * Formats a generated image's title, without its status, which the payload keeps.
   * @param path Where the image was saved, or null when it wasn't.
   * @returns The text.
   */
  public static formatGeneratedImage(path: string | null): string;

  /**
   * Formats why a generated image the provider named by its file can't be shown, kept as its `failure`'s `message`.
   * @param provider The provider's display name.
   * @returns The text.
   */
  public static formatUnreadImage(provider: string): string;

  /**
   * Formats a model reroute note.
   * @param fromModel The requested model.
   * @param toModel The model served instead.
   * @param reason Why.
   * @returns The text.
   */
  public static formatModelRerouted(fromModel: string, toModel: string, reason: string): string;

  /**
   * Formats a file-change approval summary.
   * @param reason The reason, or `null`.
   * @param grantRoot The root to grant, or `null`.
   * @returns The text.
   */
  public static formatFileChangeApproval(reason: string | null, grantRoot: string | null): string;

  /**
   * Formats the error for sign-in check output that could not be read.
   * @param output The output or the parse failure.
   * @returns The text.
   */
  public static formatUnexpectedSignInOutput(output: string): string;

  /**
   * Describes a provider compacting its context, the step every provider's reply shows for it.
   * @param kind The kind's display name.
   * @returns The text.
   */
  public static formatPlanDetail(done: number, total: number): string;
  public static formatContextCompacted(kind: string): string;
  /**
   * Says that a Codex `/` command that acts on the chat's session can't run before the chat has one.
   * @param command The command as shown, such as `/fork`.
   * @returns The note.
   */
  public static formatCodexCommandNeedsSession(command: string): string;
  /**
   * Says that `/rename` renamed the chat's Codex session.
   * @param name The new name.
   * @returns The note.
   */
  public static formatCodexRenamed(name: string): string;
  /**
   * Says what a Codex review looks at, from its `enteredReviewMode` item.
   * @param hint What it reviews, such as `current changes`.
   * @returns The note.
   */
  public static formatCodexReviewStarted(hint: string): string;

  /**
   * Describes a turn that failed because the provider's context is full, with the way to go on: sending `/compact`.
   * @param kind The kind's display name.
   * @returns The text.
   */
  public static formatContextFull(kind: string): string;

  /**
   * Describes a turn that failed because the provider's account reached its usage limit.
   * @param kind The kind's display name.
   * @returns The text.
   */
  public static formatUsageLimitReached(kind: string): string;

  /**
   * Explains that `claude auth logout` failed, with what it printed, or without when it printed nothing (`null`).
   */
  public static formatClaudeSignOutFailed(output: string | null): string;

  /**
   * Explains that `claude auth logout` didn't finish within the sign-in check's time, in seconds.
   */
  public static formatClaudeSignOutTimedOut(milliseconds: number): string;

  /**
   * Formats the error for Claude Code not switching its permission mode in time.
   * @param mode The mode.
   * @param timeout The wait, in milliseconds.
   * @returns The text.
   */
  public static formatClaudeModeSwitchTimedOut(mode: string, timeout: number): string;

  /**
   * Formats a Claude Code failure from its result subtype and errors.
   * @param subtype The result subtype.
   * @param errors The errors, possibly empty.
   * @returns The text.
   */
  public static formatClaudeFailure(subtype: string, errors: readonly string[]): string;

  /**
   * Formats `<tool>: <command or path>`.
   * @param tool The tool.
   * @param command The command or path.
   * @returns The text.
   */
  public static formatToolWithCommand(tool: string, command: string): string;

  /**
   * Formats Grok's title for an `execute` tool call: Execute and the command in backticks, which already shows it.
   * @param command The command.
   * @returns The text.
   */
  public static formatGrokExecuteTitle(command: string): string;

  /**
   * The summary of the card that asks to start an OpenCode sub-agent: `Start the <agent> sub-agent`, then `: <description>` when it has one.
   */
  public static formatOpencodeSubAgentStart(agent: string, description: string | null): string;

  /**
   * The summary of a routed MCP call whose arguments are in a file: `<tool>: arguments in <path>`.
   */
  public static formatToolArgumentsFile(tool: string, path: string): string;

  /**
   * The note when TeamRun refuses, without asking, an agent's routed call to an MCP tool that isn't one of TeamRun's own.
   */
  public static formatRoutedMcpToolRefused(provider: string, tool: string): string;

  /**
   * Formats `<tool> (<keys>)`.
   * @param tool The tool.
   * @param keys The input keys.
   * @returns The text.
   */
  public static formatToolWithKeys(tool: string, keys: string): string;
  /** What each ability is called, and each provider's detail on an ability, read from the providers' ability table. */
  public static readonly copilotResumeAbility: string;
  public static readonly cursorResumeAbility: string;
  public static readonly antigravityResumeAbility: string;
  public static readonly piResumeAbility: string;
  public static readonly acpAgentResumeAbility: string;
  public static readonly claudeForkAbility: string;
  public static readonly codexForkAbility: string;
  public static readonly copilotForkAbility: string;
  public static readonly grokForkAbility: string;
  public static readonly opencodeForkAbility: string;
  public static readonly cursorForkAbility: string;
  public static readonly antigravityForkAbility: string;
  public static readonly piForkAbility: string;
  public static readonly fxForkAbility: string;
  public static readonly acpAgentForkAbility: string;
  public static readonly codexCompactAbility: string;
  public static readonly copilotCompactAbility: string;
  public static readonly grokCompactAbility: string;
  public static readonly opencodeCompactAbility: string;
  public static readonly cursorCompactAbility: string;
  public static readonly antigravityCompactAbility: string;
  public static readonly piCompactAbility: string;
  public static readonly fxCompactAbility: string;
  public static readonly fxCommandsAbility: string;
  public static readonly acpAgentCompactAbility: string;
  public static readonly copilotImagesAbility: string;
  public static readonly grokImagesAbility: string;
  public static readonly opencodeImagesAbility: string;
  public static readonly claudeFilesAbility: string;
  public static readonly opencodeFilesAbility: string;
  public static readonly opencodeChatTitleAbility: string;
  public static readonly piChatTitleAbility: string;
  public static readonly museChatTitleAbility: string;
  public static readonly acpAgentChatTitleAbility: string;
  public static readonly copilotChooseModelAbility: string;
  public static readonly grokChooseModelAbility: string;
  public static readonly opencodeChooseModelAbility: string;
  public static readonly cursorChooseModelAbility: string;
  public static readonly fxChooseModelAbility: string;
  public static readonly acpAgentChooseModelAbility: string;
  public static readonly copilotChooseEffortAbility: string;
  public static readonly grokChooseEffortAbility: string;
  public static readonly opencodeChooseEffortAbility: string;
  public static readonly cursorChooseEffortAbility: string;
  public static readonly acpChooseEffortAbility: string;
  public static readonly antigravityChooseEffortAbility: string;
  public static readonly copilotChooseSpeedAbility: string;
  public static readonly grokChooseSpeedAbility: string;
  public static readonly opencodeChooseSpeedAbility: string;
  public static readonly cursorChooseSpeedAbility: string;
  public static readonly antigravityChooseSpeedAbility: string;
  public static readonly piChooseSpeedAbility: string;
  public static readonly acpAgentChooseSpeedAbility: string;
  public static readonly copilotChooseContextAbility: string;
  public static readonly grokChooseContextAbility: string;
  public static readonly opencodeChooseContextAbility: string;
  public static readonly cursorChooseContextAbility: string;
  public static readonly antigravityChooseContextAbility: string;
  public static readonly piChooseContextAbility: string;
  public static readonly grokPlanModeAbility: string;
  public static readonly opencodePlanModeAbility: string;
  public static readonly cursorPlanModeAbility: string;
  public static readonly antigravityPlanModeAbility: string;
  public static readonly piPlanModeAbility: string;
  public static readonly fxPlanModeAbility: string;
  public static readonly acpAgentPlanModeAbility: string;
  public static readonly claudeReadOnlyModeAbility: string;
  public static readonly grokReadOnlyModeAbility: string;
  public static readonly opencodeReadOnlyModeAbility: string;
  public static readonly cursorReadOnlyModeAbility: string;
  public static readonly antigravityReadOnlyModeAbility: string;
  public static readonly piReadOnlyModeAbility: string;
  public static readonly fxReadOnlyModeAbility: string;
  public static readonly acpAgentReadOnlyModeAbility: string;
  public static readonly copilotUnrestrictedModeAbility: string;
  public static readonly grokUnrestrictedModeAbility: string;
  public static readonly cursorUnrestrictedModeAbility: string;
  public static readonly antigravityUnrestrictedModeAbility: string;
  public static readonly fxUnrestrictedModeAbility: string;
  public static readonly acpAgentUnrestrictedModeAbility: string;
  public static readonly piPermissionCardsAbility: string;
  public static readonly copilotApprovedToolsAbility: string;
  public static readonly grokApprovedToolsAbility: string;
  public static readonly cursorApprovedToolsAbility: string;
  public static readonly antigravityApprovedToolsAbility: string;
  public static readonly piApprovedToolsAbility: string;
  public static readonly copilotQuestionsAbility: string;
  public static readonly grokQuestionsAbility: string;
  public static readonly opencodeQuestionsAbility: string;
  public static readonly cursorQuestionsAbility: string;
  public static readonly antigravityQuestionsAbility: string;
  public static readonly piQuestionsAbility: string;
  public static readonly fxQuestionsAbility: string;
  public static readonly acpAgentQuestionsAbility: string;
  public static readonly copilotPlanChecklistAbility: string;
  public static readonly opencodePlanChecklistAbility: string;
  public static readonly cursorPlanChecklistAbility: string;
  public static readonly antigravityPlanChecklistAbility: string;
  public static readonly piPlanChecklistAbility: string;
  public static readonly fxPlanChecklistAbility: string;
  public static readonly acpAgentPlanChecklistAbility: string;
  public static readonly copilotReplyUsageAbility: string;
  public static readonly opencodeReplyUsageAbility: string;
  public static readonly cursorReplyUsageAbility: string;
  public static readonly antigravityReplyUsageAbility: string;
  public static readonly fxReplyUsageAbility: string;
  public static readonly acpAgentReplyUsageAbility: string;
  public static readonly museReplyUsageAbility: string;
  public static readonly copilotPlanLimitsAbility: string;
  public static readonly grokPlanLimitsAbility: string;
  public static readonly opencodePlanLimitsAbility: string;
  public static readonly cursorPlanLimitsAbility: string;
  public static readonly antigravityPlanLimitsAbility: string;
  public static readonly piPlanLimitsAbility: string;
  public static readonly opencodeSubAgentRowsAbility: string;
  public static readonly cursorSubAgentRowsAbility: string;
  public static readonly antigravitySubAgentRowsAbility: string;
  public static readonly piSubAgentRowsAbility: string;
  public static readonly copilotBackgroundSubAgentsAbility: string;
  public static readonly opencodeBackgroundSubAgentsAbility: string;
  public static readonly cursorBackgroundSubAgentsAbility: string;
  public static readonly antigravityBackgroundSubAgentsAbility: string;
  public static readonly piBackgroundSubAgentsAbility: string;
  public static readonly acpAgentBackgroundSubAgentsAbility: string;
  public static readonly codexStopSubAgentAbility: string;
  public static readonly copilotStopSubAgentAbility: string;
  public static readonly grokStopSubAgentAbility: string;
  public static readonly opencodeStopSubAgentAbility: string;
  public static readonly cursorStopSubAgentAbility: string;
  public static readonly copilotBackgroundCommandsAbility: string;
  public static readonly opencodeBackgroundCommandsAbility: string;
  public static readonly cursorBackgroundCommandsAbility: string;
  public static readonly antigravityBackgroundCommandsAbility: string;
  public static readonly piBackgroundCommandsAbility: string;
  public static readonly fxBackgroundCommandsAbility: string;
  public static readonly acpAgentBackgroundCommandsAbility: string;
  public static readonly claudeExplorerAbility: string;
  public static readonly codexExplorerAbility: string;
  public static readonly copilotExplorerAbility: string;
  public static readonly grokExplorerAbility: string;
  public static readonly opencodeExplorerAbility: string;
  public static readonly antigravityExplorerAbility: string;
  public static readonly piExplorerAbility: string;
  public static readonly fxExplorerAbility: string;
  public static readonly acpAgentExplorerAbility: string;
  public static readonly claudeGeneratedImagesAbility: string;
  public static readonly piGeneratedImagesAbility: string;
  public static readonly copilotGeneratedImagesAbility: string;
  public static readonly grokGeneratedImagesAbility: string;
  public static readonly opencodeGeneratedImagesAbility: string;
  public static readonly cursorGeneratedImagesAbility: string;
  public static readonly antigravityGeneratedImagesAbility: string;
  public static readonly fxGeneratedImagesAbility: string;
  public static readonly acpAgentGeneratedImagesAbility: string;
  public static readonly grokTeamRunToolsAbility: string;
  public static readonly antigravityTeamRunToolsAbility: string;
  public static readonly piTeamRunToolsAbility: string;
  /** Why a Pi turn went without TeamRun's tools: its Pi never listed them, as when its MCP is off or replaced, or its own `teamrun` server wins. */
  public static readonly piTeamRunToolsUnlisted: string;
  public static readonly fxTeamRunToolsAbility: string;
  public static readonly copilotSharedStdioServersAbility: string;
  public static readonly antigravitySharedStdioServersAbility: string;
  public static readonly piSharedServersAbility: string;
  public static readonly fxSharedStdioServersAbility: string;
  public static readonly acpAgentSharedStdioServersAbility: string;
  public static readonly codexOwnServersSwitchAbility: string;
  public static readonly copilotOwnServersSwitchAbility: string;
  public static readonly grokOwnServersSwitchAbility: string;
  public static readonly opencodeOwnServersSwitchAbility: string;
  public static readonly opencodeNoOwnServersListAbility: string;
  public static readonly cursorOwnServersSwitchAbility: string;
  public static readonly antigravityOwnServersSwitchAbility: string;
  public static readonly piOwnServersSwitchAbility: string;
  public static readonly fxOwnServersSwitchAbility: string;
  public static readonly copilotOwnServersListAbility: string;
  public static readonly grokOwnServersListAbility: string;
  public static readonly cursorOwnServersListAbility: string;
  public static readonly piOwnServersListAbility: string;
  public static readonly museOwnServersListAbility: string;
  public static readonly acpAgentOwnServersListAbility: string;
  public static readonly antigravityOwnServersListAbility: string;
  public static readonly claudeSignInAbility: string;
  public static readonly codexSignInAbility: string;
  public static readonly grokSignInAbility: string;
  public static readonly piSignInAbility: string;
  public static readonly acpAgentSignInAbility: string;
  public static readonly copilotSignOutAbility: string;
  public static readonly grokSignOutAbility: string;
  public static readonly opencodeSignOutAbility: string;
  public static readonly piSignOutAbility: string;
  public static readonly fxSignOutAbility: string;
  public static readonly acpAgentSignOutAbility: string;
  public static readonly copilotSeveralAccountsAbility: string;
  public static readonly cursorSeveralAccountsAbility: string;
  public static readonly acpListedCommandsAbility: string;
  public static readonly acpCommandsItListsAbility: string;
  public static readonly acpCommandsUncheckedAbility: string;
  public static readonly antigravityBuiltInCommandsAbility: string;
  public static readonly antigravityCustomCommandsAbility: string;
  public static readonly museCommandsAbility: string;
  public static readonly codexListedCommandsAbility: string;
  public static readonly codexBuiltInCommandsAbility: string;
  public static readonly codexCustomCommandsAbility: string;
  public static readonly piBuiltInCommandsAbility: string;
  /**
   * The names of Codex's own `/` commands, from its terminal app's list, which TeamRun answers with why it can't run them;
   * the ones its app-server runs are in {@link codexAppServerCommandNames} instead.
   */
  public static readonly codexCommandNames: readonly string[];
  /**
   * The start of a Codex custom prompt's `/` command name.
   */
  public static readonly codexPromptCommandPrefix: string;
  /**
   * Codex's `/review`, run with `review/start`: alone it reviews the uncommitted changes, and text after it is the review's instructions.
   */
  public static readonly codexReviewCommand: string;
  /**
   * Codex's `/fork`, run with `thread/fork`: the chat goes on in the fork.
   */
  public static readonly codexForkCommand: string;
  /**
   * Codex's `/rename`, run with `thread/name/set` and the text after it.
   */
  public static readonly codexRenameCommand: string;
  /**
   * Codex's `/archive`, run with `thread/archive`; the chat's next message takes the thread out of the archive.
   */
  public static readonly codexArchiveCommand: string;
  /**
   * The `/` commands TeamRun runs through Codex's app-server.
   */
  public static readonly codexAppServerCommandNames: readonly string[];
  /**
   * The note for `/rename` without a name, which sends nothing to Codex.
   */
  public static readonly codexRenameNeedsName: string;
  /**
   * The note after `/fork`.
   */
  public static readonly codexForked: string;
  /**
   * The note after `/archive`.
   */
  public static readonly codexArchived: string;
  /**
   * The names of Pi's built-in `/` commands, from its slash commands reference, which run only in its terminal app.
   */
  public static readonly piBuiltInCommandNames: readonly string[];
  /**
   * The names of Claude Code's built-in commands and bundled skills, from its commands reference; TeamRun answers one the session doesn't list with
   * the commands it lists, and sends any other `/` word it doesn't list as a prompt.
   */
  public static readonly claudeCommandNames: readonly string[];
  public static readonly fxSeveralAccountsAbility: string;
  public static readonly fxChooseSpeedAbility: string;
  public static readonly fxChooseContextAbility: string;
  public static readonly fxOwnServersListAbility: string;
  public static readonly fxAccountAbility: string;
  public static readonly acpAgentSeveralAccountsAbility: string;
  public static readonly grokAccountAbility: string;
  public static readonly opencodeAccountAbility: string;
  public static readonly cursorAccountAbility: string;
  public static readonly piAccountAbility: string;
  public static readonly museAccountAbility: string;
  public static readonly antigravityAccountAbility: string;
  public static readonly opencodeInstallAbility: string;
  public static readonly piInstallAbility: string;
  public static readonly fxInstallAbility: string;
  public static readonly acpAgentInstallAbility: string;
  public static readonly museRunTurnAbility: string;
  public static readonly museResumeAbility: string;
  public static readonly museForkAbility: string;
  public static readonly museCompactAbility: string;
  public static readonly musePlanModeAbility: string;
  public static readonly museReadOnlyModeAbility: string;
  public static readonly museImagesAbility: string;
  public static readonly museFilesAbility: string;
  public static readonly museChooseSpeedAbility: string;
  public static readonly museChooseContextAbility: string;
  public static readonly musePermissionCardsAbility: string;
  public static readonly museQuestionsAbility: string;
  public static readonly musePlanChecklistAbility: string;
  public static readonly musePlanLimitsAbility: string;
  public static readonly museSubAgentRowsAbility: string;
  public static readonly museBackgroundCommandsAbility: string;
  public static readonly museGeneratedImagesAbility: string;
  public static readonly museTeamRunToolsAbility: string;
  public static readonly museSharedServersAbility: string;
  public static readonly museSignInAbility: string;
  public static readonly museSignOutAbility: string;
  public static readonly museInstallAbility: string;
  public static readonly museSeveralAccountsAbility: string;
  public static readonly acpSteerTurnAbility: string;
  public static readonly fxSteerTurnAbility: string;
  public static readonly claudeSteerTurnAbility: string;
}

/**
 * The production `IClaudeQueryFactory`: starts sessions through the Agent SDK.
 */
export declare class AgentSdkQueryFactory implements IClaudeQueryFactory {
  /**
   * Initializes the factory.
   * @param starter Starts Claude Code for the Agent SDK, whose error output goes to the session's `stderr` option.
   */
  public constructor(starter: IProcessStarter);

  /**
   * Starts a session through the Agent SDK's `query`.
   * @param prompt The user's message.
   * @param options The Agent SDK options.
   * @param origin The kind and provider the session's process runs for, given to the starter with its command.
   * @returns The session.
   */
  public start(prompt: string | AsyncIterable<SDKUserMessage>, options: Options, origin: ProcessOrigin): IClaudeQuery;
}

/**
 * The instruction files Claude Code reads, for a caller that runs it without settings sources: the managed
 * policy CLAUDE.md, the person's CLAUDE.md and rules in the config folder, then, from the repository root down to the working
 * directory, each folder's CLAUDE.md, .claude/CLAUDE.md, .claude/rules and CLAUDE.local.md, and each folder's AGENTS.md and
 * .claude/AGENTS.md when no CLAUDE.md, .claude/CLAUDE.md or CLAUDE.local.md exists in those folders. A rule whose front matter
 * names `paths` is left out. Each file is followed by its "@path" imports, four deep, outside code spans and fenced blocks, and
 * loses its block-level HTML comments; a file already read is not read again. The memory is not read here: the Agent SDK loads it.
 */
export declare class ClaudeInstructions {
  /**
   * Reads the files in Claude Code's order, the project's and their imports only inside the repository.
   * @param workingDirectory The project's working directory.
   * @param configFolder The config folder Claude Code runs with.
   * @param managedFile The managed policy CLAUDE.md, or `null` for none.
   * @param homeDirectory The folder an "@~/" import resolves under.
   * @returns The system prompt addition naming each file, or `null` when there is none.
   */
  public static read(workingDirectory: string, configFolder: string, managedFile: string | null, homeDirectory: string): string | null;

  /**
   * Finds the managed policy CLAUDE.md Claude Code reads on a platform.
   * @param platform The platform.
   * @returns Its path; Linux's for a platform Claude Code names no file for.
   */
  public static managedFile(platform: NodeJS.Platform): string;
}

/**
 * Drives the user's unmodified Claude Code executable through the Agent SDK. Each provider profile
 * has its own `CLAUDE_CONFIG_DIR`; Claude Code owns sign-in and credential storage, and TeamRun
 * does not inspect its credential files. A chat turn loads the person's user settings, and the project and local ones too when Claude Code's
 * `.claude.json` marks the folder or a folder above it trusted, as Claude Code itself does after its trust dialog, so Claude Code reads their
 * instruction files, hooks and plugins itself; a title session loads none of them. MCP servers follow the provider's switch. A chat that serves
 * TeamRun's tools keeps `TEAMRUN_SENDER_TOKEN` out of Claude's environment, so no server or hook Claude Code starts itself gets it.
 */
export declare class ClaudeAdapter implements IProviderAdapter {
  /**
   * `true`: its turns take TeamRun's tools.
   */
  public readonly takesTeamRunTools: boolean;
  /**
   * The `claude` provider, its profile's usual folder, which is also its one person folder, decided from TeamRun's own environment
   * until `refreshDescriptorAsync` decides it from the environment Claude Code is given.
   */
  public get descriptor(): ProviderKind;
  /**
   * The usual folder, and `CLAUDE_CONFIG_DIR` when it names another; a profile folder holds `.claude.json`, `settings.json`,
   * `projects`, `history.jsonl`, `statsig` or `todos`.
   */
  public readonly profileSearch: ProfileSearch;
  /** The provider's permission modes. */
  public readonly modes: readonly ProviderMode[];
  /** The mode a turn runs in when none is chosen: `acceptEdits`. */
  public readonly defaultMode: string;
  /** The mode an Explorer sub-agent runs in: `plan`, where Claude Code runs no edit or command and asks for anything else, which TeamRun denies. */
  public readonly explorerMode: string;
  /**
   * The mode a plan-first turn starts in: `plan`. Approving its `ExitPlanMode` plan switches the query to the turn's requested mode for the
   * rest of the turn.
   */
  public readonly planMode: string;

  /**
   * Initializes the adapter.
   * @param command How to run Claude Code, or `null` when it was not found.
   * @param baseEnvironment The environment to clean for provider processes.
   * @param appVersion TeamRun's version, reported to Claude Code as the client app.
   * @param queryFactory Starts sessions.
   * @param runner Runs the version and sign-in check commands.
   * @param versionReader Reads the executable's version.
   * @param timings The timeouts and grace periods.
   * @param timer Tells the time a running task's output file is read again; a `NodeTimer` by default.
   * @param locate Looks for Claude Code again while it isn't found, so one installed since is used; finds nothing by default.
   * @param installation How TeamRun installs and updates Claude Code, kept as `installation`; none by default.
   * @param homeDirectory The person's home folder, where the default profile's `.claude` and `.claude.json` are; this process's by default.
   * @param log Where the adapter notes an MCP server Claude couldn't set; nowhere by default.
   * @param idleTimer Tells the time a chat held open only by its background work has been silent, for `timings.silenceLimit`; a `NodeTimer` by default.
   */
  public constructor(command: ProcessCommand | null, baseEnvironment: NodeJS.ProcessEnv, appVersion: string, queryFactory: IClaudeQueryFactory, runner: CommandRunner, versionReader: ExecutableVersionReader, timings: ProviderTimings, timer?: ITimer, locate?: () => ProcessCommand | null,
    installation?: IProviderKindInstallation | null, homeDirectory?: string, log?: ILog | null, idleTimer?: ITimer);

  /**
   * How TeamRun installs and updates Claude Code, when it was given one.
   */
  public readonly installation?: IProviderKindInstallation;

  /**
   * How many turns are running.
   */
  public get activeRunCount(): number;

  /**
   * Rebuilds the descriptor with the usual folder that `CLAUDE_CONFIG_DIR` names in the environment Claude Code is given, or `~/.claude`,
   * as its profile's usual folder and its one person folder.
   */
  public refreshDescriptorAsync(): Promise<void>;

  /**
   * Claude Code's sign-in command through the copy its turns run, with nothing started (`TerminalSignIn.of`).
   */
  public readSignInCommand(provider: Provider): Promise<ProviderSignInCommand | null>;

  /**
   * Runs `claude auth status --json` with the profile's environment and reads the outcome.
   * @param provider The provider whose profile is checked; its directory is created when missing.
   * @returns The check: `Error` when the executable is missing, the command fails, or its output
   * cannot be read.
   */
  public checkSignIn(provider: Provider): Promise<SignInCheck>;

  /**
   * Checks a folder discovery found as `checkSignIn` does, with `Resources.claudeNonessentialTrafficVariable` set so the check connects nowhere.
   * @param provider The found folder's provider.
   * @returns The check, with the same outcomes as `checkSignIn` but no identity, which is read once the person adds the folder.
   */
  public checkFoundSignIn(provider: Provider): Promise<SignInCheck>;

  /**
   * Refuses: Claude Code's sign-in runs in a terminal.
   * @returns A promise rejected with `InvalidOperationException`.
   */
  public signIn(provider: Provider, signal: AbortSignal): Promise<void>;

  /**
   * Runs `claude auth logout` with the provider's `CLAUDE_CONFIG_DIR`, in the environment its sign-in check runs with, and within the check's
   * time.
   * @param provider The provider whose profile signs out.
   * @returns A promise that resolves when the command exits 0.
   * @throws Error when the executable is missing, can't start, exits otherwise, with what it printed, or runs out of time.
   */
  public signOut(provider: Provider): Promise<void>;

  /**
   * Takes every shared MCP server but one that names TeamRun's sender token, as `SharedMcpLaunch.refusalOf` says, or a credential variable
   * `ClaudeEnvironment` withholds. A turn's servers go into `mcpServers` beside TeamRun's own: a stdio server through `SharedMcpLaunch`, with its
   * variables' values, and an HTTP server's variables as `${<variable>}` references Claude reads from its own environment; their tools ask the
   * person, and a change of servers starts the chat's query again on its session.
   * @param server The server's definition.
   * @returns Why Claude can't take it, or `null`.
   */
  public sharedServerUnavailable(server: SharedMcpServerDefinition): SharedMcpRefusal | null;

  /**
   * Says why Claude can't take a shared server with a saved secret: a stdio server takes the saved values through `setMcpServers`, over Claude's
   * input, as it takes the environment's; an HTTP server is unavailable with `Resources.formatSavedSecretsStdioOnly`, since its headers reach
   * Claude only as `${<variable>}` references Claude reads from its own environment, and putting a value there would hand it to every tool
   * Claude runs.
   * @param server The server's definition.
   * @returns Why Claude can't take its saved secrets, or `null`.
   */
  public savedSecretsUnavailable(server: SharedMcpServerDefinition): SharedMcpRefusal | null;

  /**
   * Lists the models Claude Code offers, with whether its account answer says it is signed in.
   * @param provider The provider, or `null` for the default profile.
   * @returns The models from `supportedModels()`, and the sign-in state from `accountInfo()`, read on its own: `null` when it fails or misses the timeout.
   * Each model offers context windows from `Resources.claudeAutoCompactWindowMinimum` up to the window its last result reported, or up to
   * `Resources.claudeAutoCompactWindowMaximum` before one did, with the presets that fit; none when that window is below the minimum.
   */
  public listModels(provider: Provider | null): Promise<ProviderModelList>;

  /**
   * Lists the user's MCP servers that Claude Code's `.claude.json` names, in the profile folder, or for the default profile in
   * `CLAUDE_CONFIG_DIR` or the home folder, without `teamrun`, each `Configured`. Claude Code's own lists, `mcpServerStatus()`
   * and `claude mcp list`, connect each server, so TeamRun reads the file instead; its plugins' servers, claude.ai's
   * connectors and a project's servers aren't listed.
   * @param provider The provider, or `null` for the default profile.
   * @returns The servers; none when the file is missing.
   * @throws Error when the file can't be read, isn't JSON, or is larger than `Resources.maximumConfigurationBytes`, which is checked
   * before it's read.
   */
  public listOwnMcpServers(provider: Provider | null): Promise<readonly OwnMcpServer[]>;

  /**
   * Reads the provider's plan use now.
   * @param provider The provider, or `null` for the default profile.
   * @returns The windows Claude Code's experimental usage read reports, through a control query it closes again, none when it says it has none, each under its own name, or `null` when Claude Code was not found, or the read fails, misses the timeout or answers in another shape; a figure is never estimated.
   */
  public readPlanUsage(provider: Provider | null): Promise<PlanReading | null>;

  /**
   * Reads the summary Claude Code wrote when it last compacted a session's context.
   * @param provider The provider, or `null` for the default profile.
   * @param nativeSessionId The session's id.
   * @returns What `ClaudeCompactionReader` reads from the session's file.
   */
  public readCompaction(provider: Provider | null, nativeSessionId: string): Promise<string | null>;

  /**
   * Copies a session's file into another account's `CLAUDE_CONFIG_DIR`, at the same `projects/<folder>/<session>.jsonl`, through `SessionFileCarry`,
   * so a turn on that account resumes the session; Claude Code's own check showed another account resuming a copied session, and until its check
   * of a compacted session passes, a session with a compaction summary isn't copied. Any chat still open on the session, in either account, is
   * retired first, and the copy waits for it to close, so a later turn opens the session from its file rather than an older chat; a chat that
   * stays open, as one awaiting or running a wake turn does, holds the session.
   * @param from The account whose profile holds the session, or `null` for the default profile.
   * @param to The account the session moves to.
   * @param nativeSessionId The session's id.
   * @returns `SessionCarry.Held` while a chat on the session stays open, running a background task or sub-agent or awaiting or running a wake turn,
   * `SessionCarry.Refused` for a compacted
   * session, `SessionCarry.Carried` once the copy reads back whole, and otherwise `SessionCarry.Unread`, logging a failure.
   */
  public carrySession(from: Provider | null, to: Provider, nativeSessionId: string): Promise<SessionCarry>;

  /**
   * Returns each open chat of these sessions that isn't in plan mode to it now, so a turn one starts on its own, when a background task ends, runs in
   * plan mode from its start; a chat that doesn't switch is logged and returned there by that turn instead.
   * @param nativeSessionIds The sessions whose member plans first again.
   * @returns When every such chat has switched or failed to.
   */
  public plansFirst(nativeSessionIds: readonly string[]): Promise<void>;

  /**
   * Closes each open chat of these sessions once it runs no turn, background task or wake: an idle one now, a busy one when that work ends
   * rather than after the idle limit.
   * @param nativeSessionIds The deleted chat's sessions.
   * @returns At once; the chats close on their own.
   */
  public closeSessions(nativeSessionIds: readonly string[]): Promise<void>;

  /** @inheritdoc */
  public askIsolated(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult | null>;

  /**
   * Runs one turn. Fails without starting when the executable is missing or the effort is not
   * one Claude Code accepts. An abort interrupts the session and, after the abort grace, aborts
   * its process. When a resume fails before Claude starts the session, and the turn wasn't
   * interrupted or stopped, it adds a note naming the cause and runs once more in a fresh
   * session, on the request's fresh prompt. A chosen context window goes to Claude Code as its `autoCompactWindow` setting, and a change
   * of it starts the chat's query again on its session, so it applies from the next message.
   * @param request What to run and where.
   * @param listener Where progress is reported.
   * @param signal Aborted to interrupt the turn.
   * @returns How the turn ended; the native session id is Claude Code's session id.
   */
  public runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult>;

  /**
   * Forks at the next turn: the forked session is the request's session with `resumeAt` set to the request's turn, the last transcript
   * entry to keep, and the next turn resumes it there with the Agent SDK's `resumeSessionAt` and `forkSession`, so Claude Code makes the fork
   * in the provider's own profile.
   * @param request What to fork.
   * @returns The forked session to resume.
   */
  public forkSession(request: ForkRequest): Promise<ForkedSession>;

  /**
   * Interrupts and aborts every running turn.
   */
  public shutdown(): Promise<void>;
}

/**
 * Builds the environment for a Claude Code process: inherited `CLAUDE_*`, `CLAUDEPID`, and
 * `ANTHROPIC_*` variables are dropped except the provider-routing switches, so credentials in the
 * launching shell cannot change which profile signs in, and a chat turn also keeps the person's own
 * `CLAUDE_*` settings, such as `CLAUDE_CODE_DISABLE_AUTO_MEMORY`, but none that names a key, token,
 * secret, password, credential, authentication or certificate, nor an outer Claude Code session's
 * markers; the profile directory, the client app, and the auto-updater switch are then set.
 */
export declare class ClaudeEnvironment {
  /**
   * Builds the environment.
   * @param base The environment to clean.
   * @param profileDir The profile directory, or `null` to keep the base `CLAUDE_CONFIG_DIR`.
   * @param appVersion TeamRun's version.
   * @param chatTurn Whether the process runs a chat turn, which keeps the person's own `CLAUDE_*` settings; `false` by default.
   * @returns The environment.
   */
  public static build(base: NodeJS.ProcessEnv, profileDir: string | null, appVersion: string, chatTurn?: boolean): NodeJS.ProcessEnv;

  /**
   * Whether `build` leaves the variable out of a chat turn: one of Claude's credential variables that isn't a routing one
   * or one of the person's own `CLAUDE_*` settings.
   * @param name The variable's name.
   */
  public static withholds(name: string): boolean;
}

/**
 * Reads the summary Claude Code keeps in a session's file when it compacts the session's context.
 */
export declare class ClaudeCompactionReader {
  /**
   * Reads the session's last compaction summary from `projects/<folder>/<session>.jsonl` in the profile folder, found through `ClaudeSessionFile`,
   * from the file's end back in chunks
   * of `Resources.jsonlTailChunkBytes`, through `JsonlTail`, until the last line marked as a compact summary, so a file of any size is read only as far as it.
   * @param configDir The profile folder.
   * @param sessionId The session's id.
   * @returns The text of the last entry marked as a compact summary, or `null` when no project folder holds the session's file or it has no such
   * entry; it rejects when the projects folder or the file can't be read, the entry isn't JSON with a message and content, or its content isn't text.
   */
  public static read(configDir: string, sessionId: string): Promise<string | null>;
}

/**
 * Finds the file Claude Code keeps a session in.
 */
export declare class ClaudeSessionFile {
  /**
   * Looks for `<session>.jsonl` in each folder of `projects` in the profile folder.
   * @param configDir The profile folder, Claude Code's `CLAUDE_CONFIG_DIR`.
   * @param sessionId The session's id.
   * @returns The file's path, or `null` when no project folder holds it; it rejects when the projects folder can't be read.
   */
  public static find(configDir: string, sessionId: string): Promise<string | null>;
}

/**
 * Finds the rollout file Codex keeps a thread in.
 */
export declare class CodexSessionFile {
  /**
   * Looks for `rollout-<time>-<thread id>.jsonl` under `sessions` in the profile folder, newest folders first.
   * @param codexHome The profile folder, Codex's `CODEX_HOME`.
   * @param threadId The thread's id.
   * @returns The file's path, or `null` when no rollout file is the thread's; it rejects when the sessions folder can't be read.
   */
  public static find(codexHome: string, threadId: string): Promise<string | null>;
}

/**
 * Copies a session's file from one profile folder into another's at the same relative path, for a Sustain move between two accounts of one provider.
 */
export declare class SessionFileCarry {
  /**
   * Copies the file beside the target under `Resources.sessionCopyExtension`, reads the copy back, and only then renames it over the target, so a
   * copy that fails leaves the target as it was; the temporary file is removed either way.
   * @param from The profile folder that holds the file.
   * @param to The other account's profile folder.
   * @param file The session's file, inside `from`.
   * @returns Whether the copy read back as long as the file and replaced the target; it rejects, with the target unchanged, when a folder can't be
   * made or the file can't be copied, read or renamed.
   */
  public static copy(from: string, to: string, file: string): Promise<boolean>;
}

/**
 * Reads the summary Codex keeps in a thread's rollout file when it compacts the thread's context.
 */
export declare class CodexCompactionReader {
  /**
   * Reads the thread's last compaction summary from `sessions/<year>/<month>/<day>/rollout-<time>-<thread id>.jsonl` in the profile folder, found
   * through `CodexSessionFile`, through `JsonlTail`.
   * @param codexHome The profile folder, Codex's `CODEX_HOME`.
   * @param threadId The thread's id.
   * @returns The `message` of the last `compacted` entry, or `null` when no rollout file is the thread's, it has no such entry, or its message is
   * blank, as Codex leaves it when OpenAI's servers compact the thread and keep the summary encrypted; it rejects when the sessions folder or the
   * file can't be read, or the entry isn't JSON with a payload.
   */
  public static read(codexHome: string, threadId: string): Promise<string | null>;
}

/**
 * Reads the last line of a JSON Lines file that holds a text, from the file's end back, so a file of any size is read only as far as that line.
 */
export declare class JsonlTail {
  /**
   * Reads the file back in chunks of `Resources.jsonlTailChunkBytes` until the last line holding the text.
   * @param file The file.
   * @param text The text the line holds, matched as UTF-8 bytes, even across chunks.
   * @returns The line without its newline, or `null` when no line holds the text; it rejects when the file can't be read.
   */
  public static lastLineWith(file: string, text: string): Promise<string | null>;
}

/**
 * Reads Claude Code's sign-in state from `claude auth status --json` and from a model listing's account answer.
 */
export declare class ClaudeSignInReader {
  /**
   * Reads the output.
   * @param output The command's output, possibly with text before the JSON object.
   * @param harnessVersion The executable's version, or `null`.
   * @returns `LoggedIn` with the identity, `LoggedOut`, or `Error` when the output has no
   * readable JSON object.
   */
  public read(output: string, harnessVersion: string | null): SignInCheck;

  /**
   * Reads whether the account answer of a model listing says Claude Code is signed in.
   * @param account The answer of `accountInfo()`.
   * @returns `false` when each token or API key source it names is `none`, `true` when one names a
   * source, and `null` when it names neither or another API provider signs in.
   */
  public signedIn(account: AccountInfo): boolean | null;
}

/**
 * Reads Claude Code's reply usage, context use and plan use; each figure it can't read stays blank.
 */
export declare class ClaudeUsageReader {
  /**
   * Reads a result's usage: the input tokens with their cache reads and writes, and the output tokens, summed over every model, and the cost.
   * @param result The SDK result message.
   * @param billed Whether the session bills each reply through an API key; a claude.ai sign-in isn't billed per reply, so its cost is left blank.
   * @returns The usage, without context; a token figure is blank when any model lacks it, and `null` when nothing could be read.
   */
  public static readReply(result: unknown, billed: boolean): ReplyUsage | null;

  /**
   * Reads whether a result's turn wrote to Claude's one-hour prompt cache, as Claude Code does on a subscription within its plan's usage.
   * @returns `true` when the result's usage names one-hour cache writes, and `false` otherwise, five-minute ones included.
   */
  public static readsHourCache(result: unknown): boolean;

  /**
   * Reads `getContextUsage`'s answer: the tokens used, the window, and where it compacts while auto-compact is on.
   * @param chosenWindow The context window the person chose, or `null` for Claude Code's own; one smaller than the answer's window stands for it,
   * and the compaction point is held within it.
   * @returns The context use, or `null` when the answer lacks the tokens or the window.
   */
  public static readContext(response: unknown, chosenWindow?: number | null): ContextUsage | null;

  /**
   * Reads the context window a result reports for the model, `modelUsage[model].contextWindow`.
   * @param result The SDK result message.
   * @param model The model the turn ran, or `null` when none was observed.
   * @returns The window in tokens, or `null` when the model is unknown or the result lacks it or reports 0.
   */
  public static readWindow(result: unknown, model: string | null): number | null;

  /**
   * Reads the experimental usage answer's five-hour, weekly, weekly Opus and weekly Sonnet windows.
   * @returns The windows it reports, none when it says rate limits aren't available, or `null` when it answers in another shape.
   */
  public static readPlan(response: unknown): readonly PlanWindow[] | null;
}

/**
 * Maps Claude Code's shell tasks in one chat's query to background tasks: a backgrounded command shows from its start, a foreground one once it moves
 * to the background, and each ends with its notification or with the query. Each task reports to the listener of the reply that started it.
 */
export declare class ClaudeTasks {
  /**
   * @param timer Tells the time a followed output file is read again; a `NodeTimer` by default.
   * @param interval How often a followed output file is read, in milliseconds; by default {@link Resources.taskOutputFollowInterval}.
   */
  public constructor(timer?: ITimer, interval?: number);

  /**
   * Whether a shown task is still running.
   */
  public get hasRunning(): boolean;

  /**
   * Sets what is called each time a followed task writes output, as its chat's activity.
   * @param activity Called with each piece of output, before the task's listener gets it.
   */
  public watch(activity: () => void): void;

  /**
   * Records the command of a command tool's call, so a task it starts shows the command.
   * @param toolUseId The tool call's id.
   * @param command The command.
   */
  public noteCommand(toolUseId: string, command: string): void;

  /**
   * Reads the output file a tool result names and, for a shown task that the tool call started, follows the file, sending its output as it's written.
   * @param toolUseId The tool call's id.
   * @param text The tool result's text.
   */
  public noteResult(toolUseId: string, text: string): void;

  /**
   * Handles a `task_started` message: a backgrounded shell task starts, a foreground one waits until it moves to the background.
   * @param message The message.
   * @param query The session that stops the task.
   * @param listener Receives the task's start, output and end.
   * @returns A promise that settles once the listener took the task's start.
   */
  public handleStartedAsync(message: import("@anthropic-ai/claude-agent-sdk").SDKTaskStartedMessage, query: IClaudeQuery, listener: ITurnListener): Promise<void>;

  /**
   * Handles a `task_updated` message: a foreground shell task that moved to the background starts.
   * @param message The message.
   * @param query The session that stops the task.
   * @returns A promise that settles once the listener took the task's start.
   */
  public handleUpdatedAsync(message: import("@anthropic-ai/claude-agent-sdk").SDKTaskUpdatedMessage, query: IClaudeQuery): Promise<void>;

  /**
   * Handles a `task_notification` message: a started task sends the rest of the output file it follows when that is the file the message names, or
   * else the end of the named file, and ends with Claude Code's status.
   * @param message The message.
   * @returns The ended task's shown command, or `null` for a task that wasn't shown, once the listener took the task's end.
   */
  public handleNotificationAsync(message: import("@anthropic-ai/claude-agent-sdk").SDKTaskNotificationMessage): Promise<string | null>;

  /**
   * Stops every task still running through Claude Code's `stopTask`, as Stop does, waiting at most the given time, then stops following each one's
   * output file and ends each one still running as ended, for a query that closes. A listener's failure to take one task's end is logged, and the
   * other tasks still end.
   * @param wait How long to wait for the stops, in milliseconds.
   * @param log Where a task end the listener failed to take is logged; nowhere by default.
   * @returns A promise that settles once every task ended; it never rejects for a task's end.
   */
  public endAllAsync(wait: number, log?: ILog | null): Promise<void>;
}

/**
 * One sub-agent Claude Code started in a chat, as its reader keeps it.
 */
export interface IClaudeSubAgent {
  /**
   * The provider item id of its `SubAgent` detail, which its own details name as their parent.
   */
  readonly itemId: string;
  /**
   * The item id of the sub-agent that started it, or `null` when the turn did.
   */
  readonly parentItemId: string | null;
  /**
   * The turn that started it, whose listener its details go to and whose decisions it asks through.
   */
  readonly owner: ClaudeTurn;
  /**
   * Its own to-do list, kept apart from the session's.
   */
  readonly plan: ClaudePlan;
  /**
   * The sub-agent as last reported.
   */
  readonly agent: import("@noldova/teamrun.protocol").SubAgent;
}

/**
 * Maps Claude Code's sub-agents in one chat's query to `SubAgent` details: each starts with its tool call, takes its model from its own frames, its
 * usage from its task's progress, and its end from its tool's result or its task's notification, and reports each change to the listener of the turn
 * that started it, under the same item id. A sub-agent that has ended is forgotten, with its turn, except its description for its task's notification.
 */
export declare class ClaudeSubAgents {
  /**
   * Tests whether a tool starts a sub-agent.
   * @param name The tool's name.
   * @returns Whether it is one of {@link Resources.claudeAgentTools}.
   */
  public static isAgentTool(name: string): boolean;

  /**
   * Whether a sub-agent is still running.
   */
  public get hasRunning(): boolean;

  /**
   * Finds a sub-agent by the tool call that started it.
   * @param toolUseId The tool call's id.
   * @returns The sub-agent, or `undefined`.
   */
  public of(toolUseId: string): IClaudeSubAgent | undefined;

  /**
   * Finds a sub-agent by its task's id, or by the agent id its tool's result gave.
   * @param taskId The id, or `undefined`.
   * @returns The sub-agent, or `undefined`.
   */
  public ofTask(taskId: string | undefined): IClaudeSubAgent | undefined;

  /**
   * Starts a sub-agent from its tool call and reports it running.
   * @param toolUseId The tool call's id.
   * @param itemId The tool call's item id, which its detail keeps.
   * @param input The tool call's input: `description`, `subagent_type`, `model` and `run_in_background` are read when they're there.
   * @param owner The turn that reports it.
   * @param parentItemId The item id of the sub-agent that started it, or `null`.
   * @returns A promise that settles once the owner's listener took the sub-agent's detail.
   */
  public startAsync(toolUseId: string, itemId: string, input: unknown, owner: ClaudeTurn, parentItemId: string | null): Promise<void>;

  /**
   * Reports the model a sub-agent's own frame names, when it changed.
   * @param toolUseId The id of the tool call that started it.
   * @param model The model.
   * @returns A promise that settles once the owner's listener took the change.
   */
  public noteModelAsync(toolUseId: string, model: string): Promise<void>;

  /**
   * Reads a tool result: a sub-agent's tool result ends it as completed with its totals, failed with the result's text as its summary, or stopped when
   * the turn was interrupted, or moves it to the background when it was launched there. Other tool results are ignored.
   * @param toolUseId The tool call's id.
   * @param isError Whether the result is an error.
   * @param structured The result's structured form.
   * @param interrupted Whether the turn was interrupted.
   * @param text The result's text, such as Claude Code's reason a sub-agent couldn't start.
   * @returns A promise that settles once the owner's listener took the change.
   */
  public noteResultAsync(toolUseId: string, isError: boolean, structured: unknown, interrupted: boolean, text: string): Promise<void>;

  /**
   * Handles a `task_started` message: a sub-agent's task is matched to it by its tool call, and moves it to the background when it says so.
   * The task starts once on its reply's listener, naming the sub-agent, with the query's `stopTask` as its stop, and ends there once
   * with the sub-agent.
   * A task Claude Code marks `owned_by_subagent`, such as a sub-agent's own shell command, is kept as the sub-agent's and starts nowhere.
   * @param message The message.
   * @param query The query that runs the task.
   * @returns Whether the task is a sub-agent's or one a sub-agent owns, once the owner's listener took the task's start.
   */
  public handleStartedAsync(message: import("@anthropic-ai/claude-agent-sdk").SDKTaskStartedMessage, query: IClaudeQuery): Promise<boolean>;

  /**
   * Handles a `task_updated` message: a sub-agent's task moved to the background moves it there.
   * @param message The message.
   * @returns Whether the task is a sub-agent's or one a sub-agent owns, once the owner's listener took the change.
   */
  public handleUpdatedAsync(message: import("@anthropic-ai/claude-agent-sdk").SDKTaskUpdatedMessage): Promise<boolean>;

  /**
   * Handles a `task_progress` message: a running sub-agent reports its tool calls, tokens, run time and summary so far.
   * @param message The message.
   * @returns A promise that settles once the owner's listener took the change.
   */
  public handleProgressAsync(message: import("@anthropic-ai/claude-agent-sdk").SDKTaskProgressMessage): Promise<void>;

  /**
   * Handles a `task_notification` message: a running sub-agent ends with Claude Code's status, usage and summary, keeping the counts it had when the
   * message carries no usage, as a stopped one's doesn't.
   * @param message The message.
   * @returns The sub-agent's description, also for a sub-agent that had already ended and whose task wasn't notified yet, or `null` for a task that isn't a
   * sub-agent's or was already notified, once the owner's listener took the end.
   */
  public handleNotificationAsync(message: import("@anthropic-ai/claude-agent-sdk").SDKTaskNotificationMessage): Promise<string | null>;

  /**
   * Ends a task a sub-agent owns, whose `task_notification` names neither the chat's tasks nor its wake.
   * @param taskId The task's id.
   * @returns Whether the task was one a sub-agent owns and hadn't ended.
   */
  public endOwnedTask(taskId: string): boolean;

  /**
   * Reports every sub-agent still running as stopped, for a query that closes; each is checked again just before its stop, so one that ended
   * meanwhile, such as through its task's notification, gets no second final report.
   * @returns A promise that settles once each owner's listener took the stops.
   */
  public stopAllAsync(): Promise<void>;

  /**
   * Reports a note under a sub-agent that a tool use it asked for was denied, because the reply that started it has ended and no reply in the chat is
   * running to ask in.
   * @param entry The sub-agent.
   * @param toolName The tool it asked to use.
   * @param toolUseId The SDK's id of the tool use, which keeps the note's item id apart.
   * @returns A promise that settles once the owner's listener took the note.
   */
  public noteUnaskedAsync(entry: IClaudeSubAgent, toolName: string, toolUseId: string): Promise<void>;
}

/**
 * The open input of one chat's Claude Code query: each turn's message, until it ends.
 */
export declare class ClaudeInput implements AsyncIterable<SDKUserMessage> {
  /**
   * Whether the input ended.
   */
  public get isEnded(): boolean;

  /**
   * Queues a message, unless the input ended.
   * @param message The message.
   */
  public push(message: SDKUserMessage): void;

  /**
   * Ends the input after the queued messages, which closes Claude Code's standard input.
   */
  public end(): void;

  /**
   * Yields each queued message, waiting for the next until the input ends.
   */
  public [Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage>;
}

/**
 * One chat's Claude Code query, kept open so its background tasks run past the reply that started them. Each turn's message goes on its open
 * input, and each reply frame goes to the turn whose message's uuid it carries (`user_message_uuid`, or `user_message_uuids` for a batch). An
 * unstamped frame follows the frame before it; the first one of a reply goes to the turn waiting for its reply only while Claude Code has stamped none,
 * as an older Claude Code does, and otherwise belongs to a turn Claude Code started itself, such as one a task's end wakes. Such a turn asks the last
 * turn's listener for a wake reply (`onWake`), marked with the task that ended, and reports to it, with the tasks it starts; a wake reply that plans first
 * finds the query back in its plan mode, since the adapter returns it there as soon as the chat plans first again (`plansFirst`), and otherwise returns
 * it there before the turn goes on, or stops the turn if Claude Code refuses or doesn't answer in time; either way, the person's approval of the wake's
 * plan leaves it for the mode it had before. The chat tracks its query's mode, as unknown after a switch Claude Code didn't answer in time, since that
 * switch may still land, and the mode a turn that doesn't plan first should find: a wake, or a person's turn on the kept query, that doesn't plan first
 * switches the query to it first, noting it when Claude Code doesn't; without one, the
 * query is interrupted, its frames go nowhere, its tool uses are denied and the tasks it starts are not followed. The query closes when it has no turn and no running task, when its process ends, or when it is stopped; after a task ended, it
 * waits up to the wake grace first, for the turn that task's end may start. Held open only by its tasks, sub-agents or Claude Code's live tasks, it stays
 * open while any message or task output comes within the silence limit of the last, and is stopped as {@link ClaudeChat.stop} stops it once none does.
 */
export declare class ClaudeChat {
  /**
   * @param key The settings the query was started with; a turn with other settings starts another query.
   * @param wait How long a closing query waits for its tasks' stops, in milliseconds.
   * @param streamInterval How often a wake reply's streamed text is reported, in milliseconds.
   * @param wakeGrace How long an idle query stays open after a task ended, for the turn its end may start, in milliseconds.
   * @param onClosed Called once, when the query closes.
   * @param tasks The query's shell tasks; by default they follow output files every {@link Resources.taskOutputFollowInterval} milliseconds.
   * @param plan The session's to-do list, which a query that resumes the session takes over; a new one by default.
   * @param subAgents The query's sub-agents; a new set by default.
   * @param token The chat's kept token for TeamRun's endpoint, which each of its turns and wakes adopts; none by default.
   * @param log Where a wake whose tools refuse the token, a compaction wake that fails to start, and a step of the chat's closing that fails are
   * logged; nowhere by default.
   * @param requestTimeout How long the chat waits for Claude Code to take its plan mode again, in milliseconds;
   * {@link Resources.claudeUsageTimeout} by default.
   * @param ownServersStarted Whether the MCP servers Claude Code starts itself have all started, read before each sender token is set, since a server it
   * starts afterwards would get the token; it takes the servers the query's last init message named, none before the first one. When it answers no, the
   * token is set empty and the turn is noted. None by default, for a query whose servers never see the token.
   * @param timer Tells the time the query's background work has been silent; a `NodeTimer` by default.
   * @param silenceLimit How long the query stays open, held only by its background work, while that work is silent, in milliseconds;
   * {@link Resources.silenceLimit} by default.
   * @param idleLimit How long the query stays open with no turn and no background work, for the chat's next turn, in milliseconds;
   * {@link Resources.idleLimit} by default. A chat that may compact while idle waits {@link Resources.idleCompactionDelay} instead, then sends
   * Claude Code's `/compact` in its live session as a wake the turn's listener may refuse, and closes when it does. A turn that comes while the
   * listener decides goes first: the chat stays open for it, and a wake given meanwhile ends interrupted without sending `/compact`. A wake the
   * listener fails to give is logged, and the chat closes at the idle limit.
   */
  public constructor(key: string, wait: number, streamInterval: number, wakeGrace: number, onClosed: (chat: ClaudeChat) => void, tasks?: ClaudeTasks,
    plan?: ClaudePlan, subAgents?: ClaudeSubAgents, token?: string | null, log?: ILog | null, requestTimeout?: number,
    ownServersStarted?: ((query: IClaudeQuery, named: readonly string[]) => Promise<boolean>) | null, timer?: ITimer, silenceLimit?: number, idleLimit?: number);

  /**
   * The settings the query was started with.
   */
  public readonly key: string;
  /**
   * The query's input.
   */
  public readonly input: ClaudeInput;
  /**
   * Ends the query's process.
   */
  public readonly abort: AbortController;
  /**
   * The end of the process's standard error, for a failure's description.
   */
  public readonly stderr: TailBuffer;
  /**
   * The query's shown tasks.
   */
  public readonly tasks: ClaudeTasks;
  /**
   * The session's to-do list, kept across the query's turns and handed to the next query that resumes the session.
   */
  public readonly plan: ClaudePlan;
  /**
   * The query's sub-agents: their frames go to the turn that started each, a background one keeps the query open while it runs, and each still running
   * when the query closes is stopped.
   */
  public readonly subAgents: ClaudeSubAgents;

  /**
   * The session id Claude Code last reported, or `null` before it reported one.
   */
  public get sessionId(): string | null;

  /**
   * Whether the query closed or is stopping.
   */
  public get isClosed(): boolean;

  /**
   * Settles once a stop that started has closed the query; at once when none started.
   */
  public get closing(): Promise<void>;

  /**
   * Whether the chat has a kept token for TeamRun's endpoint.
   */
  public get isServed(): boolean;

  /**
   * Hands the chat's token to a turn's tools, so the turn reaches TeamRun's tools over the chat's connection.
   * @param tools The turn's tools, or `null`.
   * @returns Whether the turn can reuse the chat: no wake's tools refused the chat's token, and the turn's tools adopted it, or the chat has none and the turn has
   * no endpoint.
   */
  public adopts(tools: TurnTools | null): boolean;

  /**
   * Whether the chat's query is known to be in its plan mode; a plan-first turn reuses only such a query. A query whose mode switch timed out may
   * still take it later, so its mode is unknown, and a plan-first turn or a push to plan sends `plan` again.
   */
  public get isPlanning(): boolean;

  /**
   * Sets whether the person lets the chat compact while idle, from the turn about to run: it does once that turn ends with no work left, when
   * the turn's context is large and on the one-hour prompt cache.
   * @param allowed Whether idle compaction is allowed.
   */
  public allowIdleCompaction(allowed: boolean): void;

  /**
   * Whether a background task or sub-agent, or a task Claude still lists as running in the background, runs in the chat after its turns, which holds its session.
   */
  public get isRunningTasks(): boolean;

  /**
   * Whether a turn waits for its reply.
   */
  public get isBusy(): boolean;

  /**
   * Sets the query the chat reads; its first turn starts reading it.
   * @param query The query, started with this chat's input.
   * @param mode The permission mode the query was started in.
   */
  public attach(query: IClaudeQuery, mode: PermissionMode): void;

  /**
   * Gives the session's `/` command names, aliases among them: the Agent SDK's initialize list until the session's `system/init` names its
   * `slash_commands`, then that list, with the aliases the last full list gave each name, replaced by each `commands_changed`; an initialize list
   * that comes after the session gave one is dropped.
   * @param signal Stops the wait for the Agent SDK's list.
   * @returns The names without their `/`; none when no query is attached, or when the Agent SDK's list fails or doesn't come within the request
   * timeout.
   */
  public listedCommands(signal: AbortSignal): Promise<readonly string[]>;

  /**
   * Lets the chat go after a turn that sent nothing: a chat with no session yet closes, and an open one closes when idle, as after a reply.
   */
  public endUnused(): void;

  /**
   * Switches the attached query's permission mode for the rest of its session, as an approved plan leaves plan mode; until Claude Code takes it, a
   * turn that doesn't plan first switches the query to it first.
   * @param mode The mode.
   * @returns When Claude Code took the mode.
   * @throws Error when Claude Code refuses it, and the chat keeps its mode, or doesn't take it within the request timeout, and the chat counts its
   * mode as unknown.
   */
  public setPermissionMode(mode: PermissionMode): Promise<void>;

  /**
   * Switches the attached query back to its plan mode, for a chat that plans first again, keeping the mode it left for a turn of its own whose plan
   * the person approves.
   * @returns When Claude Code took the plan mode.
   * @throws Error when Claude Code refuses it, and the chat keeps its mode, or doesn't take it within the request timeout, and the chat counts its
   * mode as unknown; either way, a turn that doesn't plan first switches the query to the mode it left.
   */
  public returnToPlan(): Promise<void>;

  /**
   * Switches the query to the mode a turn that doesn't plan first runs in, unless the chat knows it's in it already.
   * @param mode The mode, or `null` for nothing.
   * @param listener Where the turn notes that Claude Code refused, or didn't answer within the request timeout, so the turn may still run in plan
   * mode.
   * @returns When the query is in the mode, or the note was made.
   */
  public ensureMode(mode: PermissionMode | null, listener: ITurnListener): Promise<void>;

  /**
   * Keeps the open query for the next turn and sets the environment of the processes Claude Code starts from then on, such as the turn's sender token;
   * while Claude Code runs a turn it started, the environment is set once the next turn's reply begins.
   * @param environment The variables to set.
   * @param listener The next turn, which is told when its sender token is left out while Claude Code still starts its own servers.
   * @returns Whether Claude Code took them; a query that did not is not reused.
   */
  public prepare(environment: Readonly<Record<string, string>>, listener: ITurnListener): Promise<boolean>;

  /**
   * Sets the environment of the processes Claude Code starts from then on, such as the first turn's sender token of a query started without it, so that
   * the person's own MCP servers Claude Code starts with the query never get it; a refusal, or a token left out while those servers still start, is noted
   * on the turn.
   * @param query The chat's query.
   * @param environment The variables to set.
   * @param listener The turn that is told of a refusal.
   */
  public setSender(query: IClaudeQuery, environment: Readonly<Record<string, string>>, listener: ITurnListener): Promise<void>;

  /**
   * Sends a turn's message and waits for its reply's result, or for the query to end. A later turn first receives the query's init message. While Claude
   * Code runs a turn of its own, the message waits until that turn's result, since Claude Code would fold it into that turn; when Claude Code starts its
   * own turn after the message went, the turn's environment and listener take over again once its reply begins.
   * @param turn The turn that receives the reply.
   * @param message The turn's message, with its uuid.
   * @param environment The environment of the processes the turn's reply starts, such as its sender token.
   * @param interrupted Called when the turn's interrupt reaches Claude Code.
   */
  public run(turn: ClaudeTurn, message: SDKUserMessage, environment: Readonly<Record<string, string>>, interrupted: () => void): Promise<void>;

  /**
   * Asks the turn the frames go to whether a tool may run: the turn that started the sub-agent asking, also after that turn ended, since Core keeps its
   * reply's approvals open while the sub-agent runs, else a wake reply's turn while Claude Code runs a turn it started, else the turn waiting for its reply,
   * never another turn that has ended; with none, the tool use is denied, and a
   * sub-agent's denial is also noted under it, with {@link Resources.claudeSubAgentUnasked} as the reason. A sub-agent's request names it, and a denial the
   * person makes marks the tool result its own turn reports. When the reply a sub-agent's request waits in closes before it is answered, rejecting the request
   * with a `Conflict` error, the request is asked again through the next of those turns still running, or denied and noted as above; any other rejection,
   * and any rejection once the SDK has withdrawn the request, passes on to the SDK.
   * @param toolName The tool.
   * @param input The tool's input.
   * @param signal The SDK's signal for the request.
   * @param toolUseId The SDK's id of the tool use.
   * @param agentId The SDK's id of the sub-agent asking, or `undefined` for the session's own request.
   * @returns The decision.
   */
  public decide(toolName: string, input: Record<string, unknown>, signal: AbortSignal, toolUseId: string, agentId?: string): Promise<PermissionResult>;

  /**
   * Stops a turn: ends it at once while its message still waits, interrupts Claude Code's current turn when it is this turn's reply, or, when Claude
   * Code runs a turn of its own first, once this turn's reply begins; with `perTaskStopAffordance` declared, the tasks keep running.
   * @param turn The turn to stop.
   */
  public interrupt(turn: ClaudeTurn): void;

  /**
   * Stops and ends the tasks, interrupts the query, ends its process and closes it; a second call waits for the first stop. A listener's failure to
   * take a task's end or a sub-agent's stop is logged and still lets the query close.
   * @returns Settles once the query closed; it never rejects.
   */
  public stop(): Promise<void>;

  /**
   * Closes the query as soon as it runs no turn, background task or wake, in place of starting the idle limit; an idle query closes now.
   */
  public retire(): void;

  /**
   * Ends the input and closes the query, tolerating one that already ended.
   */
  public close(): void;
}

/**
 * One Claude Code turn: consumes the session's messages, reports them to the turn listener, and
 * decides tool use through it.
 */
export declare class ClaudeTurn {
  /**
   * Initializes the turn.
   * @param listener Where progress is reported.
   * @param resumeNativeSessionId The session the turn asked to resume, or `null`.
   * @param stream Accumulates the streamed text and thinking deltas.
   * @param tasks The chat's tasks, which the turn tells each command tool call's command.
   * @param requestTimeout How long in milliseconds the turn waits for the context use before it leaves it blank, and for leaving plan mode before it
   * notes that it stayed; `Resources.claudeUsageTimeout` by default.
   * @param plan The chat's to-do list, which the turn tells each to-do tool call and result, and reports as the reply's plan; a new one by default.
   * @param subAgents The chat's sub-agents: the turn starts one for each sub-agent tool call and reports each one's own steps, plan and text under it,
   * its text as notes so it never reads as the reply's, and never its thinking; a new set by default.
   * @param leavePlan Leaves Claude Code's plan mode once the person allowed the reply's own `ExitPlanMode` call and it succeeded, a failure
   * or a wait past `requestTimeout` becoming a note, and the turn's result waits for it; `null`, the default, for a turn that doesn't plan first.
   * @param chosenWindow The context window the person chose, which the context use reports when it is smaller than Claude Code's; `null`, the
   * default, for Claude Code's own.
   */
  public constructor(listener: ITurnListener, resumeNativeSessionId: string | null, stream: DeltaStream, roleApplied?: import("@noldova/teamrun.protocol").RoleApplication | null,
    tasks?: ClaudeTasks, requestTimeout?: number, plan?: ClaudePlan, subAgents?: ClaudeSubAgents, leavePlan?: (() => Promise<void>) | null,
    chosenWindow?: number | null);

  /**
   * Where the turn reports.
   */
  public get turnListener(): ITurnListener;

  /**
   * The session id Claude Code reported, or `null` before the session started.
   */
  public get sessionId(): string | null;

  /**
   * What was observed so far.
   */
  public get observed(): ObservedSettings;

  /**
   * How the turn ended, or `null` while it runs.
   */
  public get outcome(): TurnOutcome | null;

  /**
   * Whether an interruption was requested.
   */
  public get isInterrupted(): boolean;

  /**
   * Whether the turn's result wrote to the one-hour prompt cache and left a context of {@link Resources.idleCompactionTokens} or more, so its
   * chat may compact while idle.
   */
  public get compactsWhenIdle(): boolean;

  /**
   * Whether Claude started the session, by sending its init message; a resume that fails before it starts a fresh session.
   */
  public get hasStarted(): boolean;

  /**
   * The context window the result reported for the turn's model, or `null` before the result or when it lacks one.
   */
  public get modelWindow(): number | null;

  /**
   * Why the turn failed, or `null` while it hasn't.
   */
  public get error(): string | null;

  /**
   * Handles one of the reply's messages; a second init message is ignored.
   * @param message The message.
   * @param query The session.
   */
  public handle(message: SDKMessage, query: IClaudeQuery): Promise<void>;

  /**
   * Ends a turn that has no result as failed, once the listener took the text still streaming, the plan use read so far and every note added. It
   * doesn't wait for a plan use read still running, which Claude Code marks experimental: a read that comes after the turn ended is dropped, and the
   * next turn reads it again.
   * @returns A promise that settles once the turn ended.
   */
  public finishAsync(): Promise<void>;

  /**
   * Gives the listener the plan use read so far and every note added, in order. A listener's failure to take the plan use is ignored.
   * @returns A promise that settles once the listener took them.
   */
  public deliverNotesAsync(): Promise<void>;

  /**
   * Records that an interruption was requested, so later failures count as interruptions and add no note.
   */
  public markInterrupted(): void;

  /**
   * Ends the turn as failed unless it already ended.
   * @param error Why.
   */
  public fail(error: string): void;

  /**
   * Ends the turn with a note, as completed or, once interrupted, as interrupted, unless it already ended, for a message answered elsewhere.
   * @param note The note.
   * @returns A promise that settles once the listener took the note and the turn ended.
   */
  public endWithAsync(note: string): Promise<void>;

  /**
   * Ends a turn that sent nothing, keeping the session it resumed: with a note, as completed; with none, as interrupted.
   * @param note The note, or `null`.
   * @returns A promise that settles once the listener took the note and the turn ended.
   */
  public endUnsentAsync(note: string | null): Promise<void>;

  /**
   * Asks the listener whether a tool may run. `AskUserQuestion` goes to the listener as its questions instead, each
   * offering its own answer as Claude Code's "Other" does; answered, the tool is allowed with the input's `answers`
   * keyed by question text, a question's choices and own text joined by ", ", and skipped or unreadable, it is denied.
   * @param toolName The tool.
   * @param input The tool's input.
   * @param signal The SDK's signal for the request; when it aborts, the listener withdraws the request.
   * @param toolUseId The SDK's id of the tool use; when the person denies it, its tool result's detail carries `denied: true`.
   * @param subAgent The description of the sub-agent asking, which the request's payload, or its questions' `QuestionAsk`, names; `null`, the default, for the
   * turn's own.
   * @param resultsIn The turn that reports the tool's result, whose detail a denial marks; `null`, the default, for this turn.
   * @returns Allow with the unchanged input, or with the answers, or deny.
   */
  public decide(toolName: string, input: Record<string, unknown>, signal: AbortSignal, toolUseId: string, subAgent?: string | null,
    resultsIn?: ClaudeTurn | null): Promise<PermissionResult>;

  /**
   * Builds the turn's result, with the turn's id: the uuid of its last top-level transcript entry, an assistant or user message, or `null`
   * when it had none; a turn that never ended counts as failed.
   * @returns The result.
   */
  public toResult(): TurnResult;
}

/**
 * JSON-RPC client for one `codex app-server` process over stdio, newline-delimited. Requests
 * carry an id; server-initiated requests are answered through the server request handler;
 * notifications go to every subscribed handler. Lines that are not JSON objects are dropped and
 * counted; a handler that throws is counted, and its failure is noted in the reply it was subscribed for, once per method and failure in each reply,
 * or written to the log.
 */
export declare class AppServerClient {
  /**
   * Initializes the client without starting the process.
   * @param command How to start the app-server.
   * @param environment The process environment.
   * @param clientInfo How the client introduces itself.
   * @param starter Starts the process, and stops one that ignores its closed input.
   * @param timings The timeouts and grace periods.
   * @param log Where a notification handler's failure is written when it has no reply to note it in, or noting it there fails too.
   */
  public constructor(command: ProcessCommand, environment: NodeJS.ProcessEnv, clientInfo: AppServerClientInfo, starter: IProcessStarter, timings: ProviderTimings,
    log?: ILog | null);

  /**
   * Whether the process was started and has not exited.
   */
  public get isAlive(): boolean;

  /**
   * The app-server's process id, or `null` before it started or when the system gave none.
   */
  public get processId(): number | null;

  /**
   * What `initialize` answered, or `null` before it did.
   */
  public get initialization(): AppServerInitialization | null;

  /**
   * The server's version, or `null` before initialization or when the user agent carries none.
   */
  public get version(): string | null;

  /**
   * How many lines were dropped because they were not JSON objects.
   */
  public get droppedLineCount(): number;

  /**
   * How many notification or exit handlers threw or returned a promise that rejected; the client goes on with the next one after each.
   */
  public get handlerFailureCount(): number;

  /**
   * The tail of the process's standard error.
   */
  public get stderr(): string;

  /**
   * Waits for the process to exit.
   * @returns How it exited; `null` code and signal when it never started.
   */
  public waitForExit(): Promise<ProcessExit>;

  /**
   * Waits for the notifications and exit already received to be handled, and for the server requests already received to be handed to their
   * handler. The client runs them one at a time, in arrival order, each notification after the previous one's handlers settled; a handler that
   * fails is counted in {@link handlerFailureCount} and the next one still runs. A server request's answer isn't awaited, so a request such as
   * an approval can still be open when this resolves.
   * @returns A promise that resolves once the work queued so far has run.
   */
  public settledAsync(): Promise<void>;

  /**
   * Runs work in the same order as the notifications: after those already received, and before any received later.
   * @param work The work, such as reporting to a turn's listener.
   * @returns The work's promise; its failure is the caller's and doesn't stop the notifications.
   */
  public runInOrderAsync(work: () => Promise<void>): Promise<void>;

  /**
   * Starts the process, sends `initialize`, and confirms with `initialized`. A write the process's closed input refuses, such as with EPIPE when it
   * exits before reading, is left to its exit, which fails the pending requests with its code and stderr.
   * @returns What `initialize` answered.
   * @throws AppServerUnavailableException when already started, the process cannot start, exits
   * first, or does not answer in time.
   * @throws AppServerException when the server answers `initialize` with an error.
   */
  public start(): Promise<AppServerInitialization>;

  /**
   * Subscribes to notifications. Subscribing a handler again changes its listener and keeps its place among the handlers.
   * @param handler The handler.
   * @param listener The reply the handler works for, which gets a note when the handler fails; `null` writes the failure to the log instead.
   * @returns The subscription; dispose it to unsubscribe.
   */
  public subscribe(handler: INotificationHandler, listener?: ITurnListener | null): HandlerSubscription<INotificationHandler>;

  /**
   * Subscribes to the process exit.
   * @param handler The handler.
   * @returns The subscription; dispose it to unsubscribe.
   */
  public subscribeExit(handler: IExitHandler): HandlerSubscription<IExitHandler>;

  /**
   * Sets who answers server-initiated requests; without one they are declined.
   * @param handler The handler, or `null`.
   */
  public setServerRequestHandler(handler: IServerRequestHandler | null): void;

  /**
   * Sends a request and waits for its response.
   * @param method The method.
   * @param params The parameters.
   * @param timeoutMilliseconds How long to wait.
   * @returns The result, `null` when the response carries none.
   * @throws ArgumentOutOfRangeException when the timeout is not a positive integer.
   * @throws AppServerUnavailableException when the process is not running, exits, or does not
   * answer in time.
   * @throws AppServerException when the server answers with an error.
   */
  public request(method: string, params: JsonValue, timeoutMilliseconds: number): Promise<JsonValue>;

  /**
   * Sends a notification when the process is running.
   * @param method The method.
   * @param params The parameters.
   */
  public notify(method: string, params: JsonValue): void;

  /**
   * Closes the process's input and terminates it after the stop grace when it has not exited.
   */
  public stop(): Promise<void>;
}

/**
 * Drives Codex through `codex app-server`: one process per provider profile (`CODEX_HOME`), shared
 * by that profile's threads; turns are routed by thread id. Threads start in the workspace-write
 * sandbox with approvals on request and without the profile's MCP servers and plugins.
 *
 * While the turn's `McpEndpoint` serves, TeamRun's server in the thread's configuration is an HTTP entry for it, with a kept token as
 * its `Authorization` header; while it doesn't, a turn with TeamRun's tools fails before Codex starts. A loaded thread keeps its first connection to the server, so the token
 * belongs to the thread: a later turn on the thread while the adapter still holds it adopts the token, which then reaches only that
 * turn's tools, and the token is revoked once the adapter releases the thread. The release unloads the thread, and the next turn's
 * resume connects with a token of its own.
 */
export declare class CodexAdapter implements IProviderAdapter {
  /**
   * `true`: its turns take TeamRun's tools.
   */
  public readonly takesTeamRunTools: boolean;
  /**
   * The `codex` provider.
   */
  public readonly descriptor: ProviderKind;
  /**
   * The usual folder, and `CODEX_HOME` when it names another; a profile folder holds `config.toml`, `sessions`, `history.jsonl`,
   * `version.json` or `log`.
   */
  public readonly profileSearch: ProfileSearch;
  /** The provider's permission modes. */
  public readonly modes: readonly ProviderMode[];
  /** The mode a turn runs in when none is chosen: `auto`. */
  public readonly defaultMode: string;
  /**
   * Why Codex runs no Explorer sub-agent: its `read-only` sandbox fails every write, but a command the person's own Codex rules allow runs
   * outside the sandbox without asking, and Codex can't turn those rules off for one thread.
   */
  public readonly explorerUnavailable: string;
  /**
   * The mode a plan-first turn runs in: `plan`, Codex's experimental plan collaboration mode in the read-only sandbox. A turn after a plan
   * turn on the same thread goes back to collaboration mode `default`; an app-server that refuses the mode fails the turn.
   */
  public readonly planMode: string;

  /**
   * Initializes the adapter.
   * @param command How to run Codex, or `null` when it was not found.
   * @param baseEnvironment The environment to clean for provider processes.
   * @param clientInfo How TeamRun introduces itself to the app-server.
   * @param starter Starts the app-server processes, and stops those that ignore their closed input.
   * @param timings The timeouts and grace periods.
   * @param versionReader Stamps the Codex executable when an app-server starts and before each turn,
   * listing, sign-in check, sign-in or fork on it, and reads the installed Codex CLI's version only
   * when the stamp changed, or the last read failed at least the version timeout ago.
   * @param timer Tells the time a failed version read is tried again; a `NodeTimer` by default.
   * @param locate Looks for Codex again while it isn't found, so one installed since is used; finds nothing by default.
   * @param installation How TeamRun installs and updates Codex, kept as `installation`; none by default.
   * @param log Where the adapter notes a later turn on a thread held by its background tasks that can't reach TeamRun's tools, and the processes a sub-agent's
   * stop ended outside the app-server; nowhere by default.
   * @param platform The platform, as `process.platform`, which decides whether a sub-agent's stop sweeps what Codex left: only on Linux.
   * @param sweep Ends what a sub-agent's stop left running outside the app-server on Linux; by default a `ProcessTree` on the platform, through a
   * `CommandRunner` on the starter, with `Resources.processListTimeout` for each listing and the timings' `stopGrace` as its grace.
   * @param idleTimer Tells the time a thread held by its background work has been silent, for `timings.silenceLimit`, and an app-server has had no
   * thread or request, for `timings.idleLimit`; a `NodeTimer` by default.
   */
  public constructor(command: ProcessCommand | null, baseEnvironment: NodeJS.ProcessEnv, clientInfo: AppServerClientInfo, starter: IProcessStarter, timings: ProviderTimings, versionReader: ExecutableVersionReader, timer?: ITimer, locate?: () => ProcessCommand | null,
    installation?: IProviderKindInstallation | null, log?: ILog | null, platform?: string, sweep?: IOrphanSweep, idleTimer?: ITimer);

  /**
   * How TeamRun installs and updates Codex, when it was given one.
   */
  public readonly installation?: IProviderKindInstallation;

  /**
   * How many app-server processes are running or starting, including those left to finish their
   * turns, listings, sign-in checks, sign-ins and forks after the Codex CLI's version changed.
   */
  public get clientCount(): number;

  /**
   * Reads the profile's account through `account/read`.
   * @param provider The provider whose profile is checked; its directory is created when missing.
   * @returns `LoggedIn` with the identity, `LoggedOut` when no account is reported, or `Error`
   * when the executable is missing or the app-server fails.
   */
  public checkSignIn(provider: Provider): Promise<SignInCheck>;

  /**
   * Checks a folder discovery found through `codex login status`, which reads the profile's own files and starts no app-server.
   * @param provider The found folder's provider.
   * @returns `LoggedIn` or `LoggedOut` with no identity, or `Error` when the executable is missing, the command times out or it answers otherwise.
   */
  public checkFoundSignIn(provider: Provider): Promise<SignInCheck>;

  /**
   * Signs the profile in with ChatGPT through the app-server's `account/login/start`, asking the
   * listener to open the sign-in page Codex returns; resolves without one when the profile already
   * has an account. Only an HTTPS page on `Resources.codexSignInHost`, with no user name or password
   * in it, is opened; any other page fails the sign-in. Any failure after the login starts cancels it
   * with `account/login/cancel`, and the sign-in fails once Codex answers the cancel, or after the
   * timings' `abortGrace` when it doesn't. Providers that
   * share a profile share one app-server, which keeps one login at a time, so two sign-ins on them at
   * once aren't supported.
   * @param provider The provider whose profile signs in.
   * @param signal Aborts the sign-in. Aborted before the login starts, the sign-in ends at once, even
   * while it waits for the version read, the app-server starts or answers `account/read`, and starts
   * no login, nor an app-server after the version read; aborted
   * after, it cancels the login with `account/login/cancel` and ends when Codex answers the cancel or
   * after `abortGrace`, or at once when Codex hasn't answered the start yet.
   * @param listener Where the sign-in page is sent to open.
   * @returns A promise that resolves when Codex reports the sign-in complete.
   * @throws Error when the CLI is missing, the login can't start, the page isn't Codex's, the
   * app-server exits, Codex reports the sign-in failed or cancelled, or its report can't be read.
   */
  public signIn(provider: Provider, signal: AbortSignal, listener: ISignInListener): Promise<void>;

  /**
   * Sends `account/logout` on the profile's app-server, which forgets the profile's stored sign-in.
   * @param provider The provider whose profile signs out.
   * @returns A promise that resolves when Codex answers.
   * @throws Error when the CLI is missing, the app-server can't start, or Codex answers with an error or not in time.
   */
  public signOut(provider: Provider): Promise<void>;

  /**
   * Lists the visible models through `model/list`, with the defaults Codex's configuration names for the folder, and partial when `config/read` fails.
   * @param provider The provider, or `null` for the default profile.
   * @param refresh Unused: Codex is asked every time.
   * @param workingDirectory The folder whose project configuration counts, or `null` for none.
   * @returns The visible models, signed in when `account/read` returns an account, signed out when it returns none and needs OpenAI auth, and `null`
   * when it needs none, fails or misses the timeout.
   * @throws ExecutableNotFoundException when Codex was not found.
   * @throws AppServerUnavailableException when the app-server cannot start or answer.
   * @throws AppServerException when the server answers with an error.
   */
  public listModels(provider: Provider | null, refresh?: boolean, workingDirectory?: string | null): Promise<ProviderModelList>;

  /**
   * Reads the provider's plan use now.
   * @param provider The provider, or `null` for the default profile.
   * @returns The five-hour and weekly windows and the credits from `account/rateLimits/read` on the profile's app-server, merged with those its turns reported, each under its own name, or `null` when Codex was not found, or the read fails or answers in another shape; a figure is never estimated.
   */
  public readPlanUsage(provider: Provider | null): Promise<PlanReading | null>;

  /**
   * Reads the summary Codex wrote when it last compacted a thread's context.
   * @param provider The provider, or `null` for the default profile.
   * @param nativeSessionId The thread's id.
   * @returns What `CodexCompactionReader` reads from the thread's rollout file.
   */
  public readCompaction(provider: Provider | null, nativeSessionId: string): Promise<string | null>;

  /**
   * Copies a thread's rollout file into another account's `CODEX_HOME`, at the same path under `sessions`, through `SessionFileCarry`, so a turn
   * on that account resumes the thread; Codex's own check showed another account resuming a copied thread, after compactions too. A thread kept
   * loaded after its turn, in either account, is released first with a reload, and the copy waits for it, so a later turn reads the thread from
   * its file rather than an older loaded copy.
   * @param from The account whose profile holds the thread, or `null` for the default profile.
   * @param to The account the thread moves to.
   * @param nativeSessionId The thread's id.
   * @returns `SessionCarry.Held` while a background task or sub-agent the thread started still runs, `SessionCarry.Carried` once the copy reads back
   * whole, and otherwise `SessionCarry.Unread`, logging a failure.
   */
  public carrySession(from: Provider | null, to: Provider, nativeSessionId: string): Promise<SessionCarry>;

  /**
   * Lists the servers Codex's configuration names, through `config/read` from the profile folder, or from the home folder for
   * the default profile, without `teamrun`: `Disabled` for one whose `enabled` is `false`, `Enabled` otherwise. Reading the
   * configuration starts no server.
   * @param provider The provider, or `null` for the default profile.
   * @returns The servers.
   */
  public listOwnMcpServers(provider: Provider | null): Promise<readonly OwnMcpServer[]>;

  /** @inheritdoc */
  public askIsolated(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult | null>;

  /**
   * Runs one turn: resumes the native thread when asked and possible, else starts one; reports
   * items, reroutes, and errors; routes approvals to the listener; interrupts on abort and gives
   * up after the interrupt grace. After every turn, however it ended, it unsubscribes from the
   * thread, so that the app-server, which keeps a loaded thread's config while a connection is
   * subscribed, reloads the thread with the next turn's variables when it resumes it. The app-server
   * also keeps it while the thread is failed or still running, so after a failed turn, or one the
   * grace gave up on, it archives and unarchives the thread, which unloads it. The result waits for
   * that reload, so that the next resume can't race the archive; a completed turn, or one stopped
   * within the grace, isn't archived.
   * Before a turn, listing, sign-in check, sign-in or fork on the profile's running app-server, it
   * stamps the Codex executable, which starts no process; when the stamp changed since the app-server
   * started or was last checked, it reads the installed Codex CLI's version once, and when that is not
   * the app-server's, it starts a new app-server, and the old one stops once the work running on it
   * ends. A read that fails is tried again by the first one after the version timeout. A turn
   * stopped while it waits for the read ends at once as interrupted, and so does a sign-in aborted
   * then. An app-server that fails to start with
   * `Resources.codexPackageMismatch` fails with `Resources.codexUpdatedWhileInUse`.
   * A message that is one of `Resources.codexAppServerCommandNames` runs it through the app-server instead of `turn/start`:
   * `/review` runs `review/start` as the turn, on the uncommitted changes or with the text after it as its instructions, and shows
   * the review's agent message as the reply; `/fork`, `/rename <name>` and `/archive` run `thread/fork`, `thread/name/set` and
   * `thread/archive` on the chat's thread, start no turn and end with a note, the fork's thread as the native session id. Those
   * three need the chat's thread, and `/rename` a name; without one they answer with a note and start nothing. `/archive` first
   * ends the thread's idle hold, so the chat's next message unarchives it as a resume does. `thread/name/set` skips an archived
   * thread and answers that it isn't found, so `/rename` then unarchives the thread and names it again; when the unarchive fails
   * too, the reply fails with the first answer.
   * @param request What to run and where.
   * @param listener Where progress is reported.
   * @param signal Aborted to interrupt the turn.
   * @returns How the turn ended; the native session id is the thread id.
   */
  public runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult>;

  /**
   * Takes every shared MCP server but one that names TeamRun's sender token, as `SharedMcpLaunch.refusalOf` says, or `OPENAI_API_KEY` or
   * `CODEX_API_KEY`, which `CodexEnvironment` withholds. A turn's servers go into the thread's `mcp_servers`, a stdio server through
   * `SharedMcpLaunch` with its variables as `env_vars`, and an HTTP server's as `env_http_headers` and `bearer_token_env_var`,
   * which Codex reads from its own environment; a server of the same name in the profile's configuration is replaced.
   * @param server The server's definition.
   * @returns Why Codex can't take it, or `null`.
   */
  public sharedServerUnavailable(server: SharedMcpServerDefinition): SharedMcpRefusal | null;

  /**
   * Says why Codex can't take a shared server with a saved secret, `Resources.formatSavedSecretsFromEnvironmentOnly`: Codex reads each value
   * from its own environment, by name, and TeamRun puts no saved secret there.
   * @returns Why Codex can't take saved secrets.
   */
  public savedSecretsUnavailable(): SharedMcpRefusal | null;

  /**
   * Writes an answer to an async question, Codex's `request_user_input_async`, as the user message Codex's own client
   * sends: `<send_user_message_question_reply>` around the JSON `{ questionItemId, question, answer }`.
   * @param replyTo The `agentMessage` item's id.
   * @param question The question's title.
   * @param answer The answer.
   * @returns The user message.
   */
  public formatQuestionReply(replyTo: string, question: string, answer: string): string;

  /**
   * Releases these threads where the adapter keeps them after their turns, without waiting for the idle limit: a kept thread is released now,
   * or once its tasks and sub-agents end, and a thread running a turn once that turn and its work end.
   * @param nativeSessionIds The deleted chat's threads.
   * @returns At once; the threads release on their own.
   */
  public closeSessions(nativeSessionIds: readonly string[]): Promise<void>;

  /**
   * Forks a thread through a turn into a new thread (`thread/fork` with `lastTurnId`, the source
   * unarchived first when needed, a busy source tried again): the fork holds the history through
   * that turn and the source is untouched.
   * @param request The thread, the turn, and where the fork works.
   * @returns The new thread, as the forked session.
   * @throws AppServerException when the app-server refuses (the thread is gone).
   * @throws ExecutableNotFoundException when Codex is missing.
   */
  public forkSession(request: ForkRequest): Promise<ForkedSession>;

  /**
   * Stops each background command still running through `thread/backgroundTerminals/terminate`, as Stop does, and then every app-server process,
   * first those still in `initialize`, which it stops at once rather than waiting for their start,
   * so the work waiting for them fails. Afterwards no app-server starts: a turn, listing, sign-in check,
   * sign-in or fork that would start one, even one still waiting for a version read, fails with
   * `Resources.codexShutDown`. It also stops any `--version` read still running, and waits for it.
   * @throws Error the first failure to stop an app-server, after it has tried to stop every one.
   */
  public shutdown(): Promise<void>;
}

/**
 * Builds the environment for a Codex app-server: API keys inherited from the launching shell are
 * dropped so the profile's own sign-in is the only credential source.
 */
export declare class CodexEnvironment {
  /**
   * Builds the environment.
   * @param base The environment to clean.
   * @param profileDir The profile directory set as `CODEX_HOME`, or `null` to keep the base one.
   * @returns The environment.
   */
  public static build(base: NodeJS.ProcessEnv, profileDir: string | null): NodeJS.ProcessEnv;

  /**
   * Whether `build` leaves the variable out: one of Codex's credential variables.
   * @param name The variable's name.
   */
  public static withholds(name: string): boolean;
}

/**
 * Reads instruction files the way providers' own tools do, for a provider TeamRun runs without them: the repository's folders,
 * one file, the Markdown files in a folder, and the files that fit in a total length. A file or folder that is missing or
 * unreadable is skipped, and none is read outside its boundary. Each provider's own rules, such as imports, stay with its reader.
 */
export declare class PersonInstructions {
  /**
   * Finds the repository a working directory is in.
   * @param workingDirectory The project's working directory.
   * @returns The nearest folder at or above it with a .git entry, or the working directory itself when there is none.
   */
  public static repositoryRoot(workingDirectory: string): string;

  /**
   * Lists the folders whose instruction files apply to a working directory.
   * @param workingDirectory The project's working directory.
   * @returns The folders from the repository root down to the working directory.
   */
  public static foldersOf(workingDirectory: string): readonly string[];

  /**
   * Reads one instruction file, cut to the length kept of each file.
   * @param path The file.
   * @param boundary The folder the file must resolve inside, links followed; `null` for the person's own files, read wherever they lead.
   * @returns The file, or `null` when it is missing, unreadable or outside the boundary.
   */
  public static read(path: string, boundary: string | null): InstructionFile | null;

  /**
   * Lists the Markdown files in a folder, sorted by name, following links to files and folders inside the boundary and reading
   * each folder once, so a linked cycle ends. An entry that can't be read is skipped and the rest are listed.
   * @param folder The folder.
   * @param boundary As for `read`.
   * @param recursive Whether subfolders are listed too.
   * @returns The files' paths; none when the folder is missing.
   */
  public static markdownFiles(folder: string, boundary: string | null, recursive: boolean): readonly string[];

  /**
   * Keeps the files, in order, while their total length fits.
   * @param files The files.
   * @param maximum The total length.
   * @returns The files before the first one that would pass it.
   */
  public static fit(files: readonly InstructionFile[], maximum: number): readonly InstructionFile[];
}

/**
 * The command a kind signs in with in a terminal, run through the same copy of its tooling as its turns.
 */
export declare class TerminalSignIn {
  /**
   * Puts the folder of the program the kind's turns start before `PATH`, so the sign-in command's first word finds that copy in any shell,
   * as `GeneralAcpAgent.readTerminalSignIn` does; the variable keeps the environment's own spelling, such as `Path` on Windows.
   * @param command The command the kind's turns start, or `null` when it isn't found.
   * @param signInCommand The kind's sign-in command, such as `cursor-agent login`, or `null` when it has none.
   * @param environment The environment the kind's turns start from, whose `PATH` follows the folder.
   * @returns The command with that `PATH`, or `null` when either is missing or the program's folder holds no launcher named as the command's
   * first word with one of `Resources.terminalLauncherExtensions`, such as a CLI run by a shared `node`; the terminal then runs the command as
   * the shell finds it.
   */
  public static of(command: ProcessCommand | null, signInCommand: string | null, environment: NodeJS.ProcessEnv): ProviderSignInCommand | null;
}

/**
 * The folder a provider kind's tooling uses on this computer when no provider names one, which a kind's profile reports.
 */
export declare class UsualFolder {
  /**
   * Finds the usual folder.
   * @param environment The environment the tooling starts from.
   * @param variable The variable the tooling reads its folder from, or `null` when TeamRun leaves it out of a turn with no provider.
   * @param name The folder's name in the home folder, such as `.codex`.
   * @param home The home folder; the person's own by default.
   * @returns The variable's value when it is set and not blank, else `name` in the home folder.
   */
  public static of(environment: NodeJS.ProcessEnv, variable: string | null, name: string, home?: string): string;

  /**
   * Lists the places a profile search looks in.
   * @param environment The environment the tooling starts from.
   * @param variable The variable the tooling reads its folder from.
   * @param name The folder's name in the home folder, such as `.codex`.
   * @param home The home folder; the person's own by default.
   * @returns `name` in the home folder, then the variable's value when it is an absolute path to another folder.
   */
  public static places(environment: NodeJS.ProcessEnv, variable: string, name: string, home?: string): readonly string[];

  /**
   * Finds the folder a tool that ignores a relative value reads.
   * @param environment The environment the tooling starts from.
   * @param variable The variable the tooling reads its folder from.
   * @param name The folder's name in the home folder, such as `.config`.
   * @param home The home folder; the person's own by default.
   * @returns The variable's value when it is an absolute path, else `name` in the home folder.
   */
  public static place(environment: NodeJS.ProcessEnv, variable: string, name: string, home?: string): string;

  /**
   * Finds the person's home in the environment a tool starts from, as the tool itself finds it.
   * @param environment The environment the tooling starts from.
   * @param platform The operating system; this one by default.
   * @returns `USERPROFILE` on Windows and `HOME` elsewhere when it is set and not blank, else this process's home.
   */
  public static home(environment: NodeJS.ProcessEnv, platform?: string): string;
}

/**
 * The person's own instruction files that TeamRun reads from their home for a provider that reads only the project's, passed in
 * the turn's prompt before the role.
 */
export declare class HomeInstructions {
  /**
   * Heads the files with the provider's name, each under its path, keeping them in order up to the total length kept of all the
   * instructions and naming those left out after it.
   * @param kind The provider's display name.
   * @param files The files, in the provider's order.
   * @returns The role text, or `null` when there are no files.
   */
  public static format(kind: string, files: readonly InstructionFile[]): string | null;

  /**
   * Reads the person's files as they are, without imports, skipping each one that is missing or can't be read.
   * @param paths The files, in order.
   * @returns The files read.
   */
  public static readAll(paths: readonly string[]): readonly InstructionFile[];
}

/**
 * The Antigravity instruction files TeamRun reads for it, since Antigravity 1.3.0 reads none over ACP: the person's `AGENTS.md` and
 * `GEMINI.md` in `GEMINI_HOME`, or `.gemini` in the home, then the same in its `config` folder, then the rules directly in `config/rules`,
 * by name; then, in each folder from the repository's root down to the turn's folder, the project's `AGENTS.md` and `GEMINI.md`, then the
 * rules directly in its `.agent/rules` and `.agents/rules`, by name, none outside the root. Imports are not read, and skills are left to
 * Antigravity, which loads them when a task needs them.
 */
export declare class AntigravityInstructions {
  /**
   * Reads the files in that order.
   * @param environment The environment Antigravity starts from, which names the person's home and `GEMINI_HOME`.
   * @param platform The operating system; this one by default.
   * @param workingDirectory The turn's folder, whose project files follow the person's, or `null` for none, which it is by default.
   * @returns The role text naming each file, or `null` when there is none.
   */
  public static read(environment: NodeJS.ProcessEnv, platform?: string, workingDirectory?: string | null): string | null;

  /**
   * The person's `GEMINI_HOME` as the environment names it, or `.gemini` in their home.
   * @param environment The person's environment.
   * @param platform The operating system; this one by default.
   */
  public static home(environment: NodeJS.ProcessEnv, platform?: string): string;
}

/**
 * Follows one ChatGPT sign-in on an app-server: matches `account/login/completed` to the login
 * `account/login/start` returned, keeping a completion that arrives before the login id, and
 * cancels the login when asked.
 */
export declare class CodexLogin implements INotificationHandler, IExitHandler {
  /**
   * Initializes the login.
   * @param client The app-server the login runs on.
   * @param requestTimeout How long a cancel request may take, in milliseconds.
   */
  public constructor(client: AppServerClient, requestTimeout: number);

  /**
   * Waits for the login to end.
   * @returns A promise that resolves when Codex reports the sign-in complete.
   * @throws Error when Codex reports it failed, the app-server exits, or the login is cancelled.
   */
  public wait(): Promise<void>;

  /**
   * Records the login id `account/login/start` returned, ending the login when its completion
   * already arrived and cancelling it when a cancel came first.
   * @param loginId The login id.
   */
  public begin(loginId: string): void;

  /**
   * Cancels the login: sends `account/login/cancel` once the login id is known, and ends the wait.
   * @returns A promise that resolves when Codex answers or refuses the cancel, or at once when the
   * login id isn't known yet.
   */
  public cancel(): Promise<void>;

  /**
   * @inheritdoc
   */
  public handleNotificationAsync(method: string, params: JsonReader): Promise<void>;

  /**
   * @inheritdoc
   */
  public handleExitAsync(): Promise<void>;
}

/**
 * Converts Codex thread items into turn details.
 */
export declare class CodexItemReader {
  /**
   * Reads a started item; only command executions are reported, as the command under the item's own id, so the completed item
   * replaces it in place.
   * @param item The item.
   * @returns The detail, or `null` when nothing is reported.
   * @throws JsonException when the item lacks its id or type, or a command its command or status.
   */
  public readStarted(item: JsonReader): TurnDetail | null;

  /**
   * Reads a completed item: agent messages, reasoning, a plan as the reply's plan text (`PlanDetails.text`), commands, file changes, tool calls,
   * web searches, and context compactions; others and blank texts are not reported. A web search, and a command whose every action
   * Codex parsed is a read, a listing or a search, carry `readOnly: true` in their payload, so their paths never count as written;
   * a command with a word that may write despite that parse, `tee`, `Tee-Object`, `xargs`, or a `find` option that runs, deletes or
   * prints to a file (`-exec`, `-execdir`, `-ok`, `-okdir`, `-delete`, `-fprint*`, `-fls`), is never marked.
   * @param item The item.
   * @param denied Whether TeamRun answered the item's approval request with `decline`, so a command or a file change carries
   * `denied: true` in its payload; a `declined` status alone marks nothing, since Codex also declines a request whose answer failed.
   * @returns The detail, or `null` when nothing is reported.
   * @throws JsonException when the item lacks a field its type requires.
   */
  public readCompleted(item: JsonReader, denied?: boolean): TurnDetail | null;

  /**
   * Reads one question of Codex's `item/tool/requestUserInput`: its id, header, text and options; a question with no options takes the
   * person's own text, as does one marked `isOther`.
   * @param question The question.
   * @returns The question.
   * @throws JsonException when the question lacks its id or text, or an option its label.
   * @throws ArgumentException when a read value is one the question can't hold.
   */
  public readQuestion(question: JsonReader): ApprovalQuestion;

  /**
   * Reads one question Codex posts with an agent message whose `delivery` is `async`: its title and options, which the person answers
   * later, with their own text if no option fits. Blank options are left out.
   * @param question The question.
   * @param index The question's place in the message, which becomes its id.
   * @returns The question.
   * @throws JsonException when the question isn't an object, lacks its title, or has options that aren't strings.
   * @throws ArgumentException when a read value is one the question can't hold.
   */
  public readPostedQuestion(question: JsonReader, index: number): ApprovalQuestion;
}

/**
 * Keeps a Codex app-server's latest five-hour and weekly windows and its credits, since each update may carry only some of them.
 */
export declare class CodexRateLimits {
  /**
   * Merges a rate-limits snapshot into the windows kept.
   * @param snapshot The `rateLimits` value of a read or an update.
   * The credits are a window of their own: unlimited, or the balance when the account has credits and one reads as a non-negative number;
   * credits without one drop the window, and a snapshot without credits keeps it.
   * @returns Every window kept, or `null` when the snapshot is out of shape or for another limit than Codex's own.
   */
  public merge(snapshot: JsonValue | undefined): readonly PlanWindow[] | null;
}

/**
 * Reports a Codex turn's usage from the app-server's notifications: its tokens as the growth of the thread's totals, its context use,
 * and the provider's rate limits.
 */
export declare class CodexUsage implements INotificationHandler {
  /**
   * Initializes the reporter.
   * @param threadId The turn's thread; token use for other threads is ignored.
   * @param listener Where the usage is reported.
   * @param before The thread's totals before the turn, or `null` when they're unknown, as for a thread resumed after a restart; its tokens are then blank.
   * The turn's tokens in and out, cached input, cache-written input and reasoning output are each the growth of the thread's total.
   * @param limits The app-server's windows.
   */
  public constructor(threadId: string, listener: ITurnListener, before: TokenTotals | null, limits: CodexRateLimits);

  /**
   * The thread's latest totals, or those before the turn when it reported none.
   */
  public get totals(): TokenTotals | null;

  /**
   * The context window the thread last reported as its `modelContextWindow`, or `null` before it reported one.
   */
  public get window(): number | null;

  /**
   * @inheritdoc
   */
  public handleNotificationAsync(method: string, params: JsonReader): Promise<void>;
}

/**
 * Counts the app-server's notifications for one thread held by its background work, or for a sub-agent's thread it follows, as that work's activity.
 */
export declare class CodexActivity implements INotificationHandler {
  /**
   * Initializes the handler.
   * @param threadId The held thread.
   * @param follows Tells whether a notification's thread id, or `null` when it names none, is one of the thread's sub-agents.
   * @param silence Extended by each notification for the thread or a sub-agent's thread.
   */
  public constructor(threadId: string, follows: (threadId: JsonValue | null) => boolean, silence: Deadline);

  /**
   * @inheritdoc
   */
  public handleNotificationAsync(method: string, params: JsonReader): Promise<void>;
}

/**
 * Reports each shared MCP server of a Codex turn that the app-server says failed to start, as a connection failure, or as a sign-in need
 * when Codex asks to authenticate again; never Codex's error text. Failures reported before the turn's thread is known wait for it.
 */
export declare class CodexSharedServerStatuses implements INotificationHandler {
  /**
   * Initializes the reporter.
   * @param providerId The provider's id.
   * @param providerLabel The provider's label.
   * @param names The turn's shared servers; failures of other servers are ignored.
   * @param listener Where each failure is reported.
   */
  public constructor(providerId: string, providerLabel: string, names: readonly string[], listener: ITurnListener);

  /**
   * @inheritdoc
   */
  public handleNotificationAsync(method: string, params: JsonReader): Promise<void>;

  /**
   * Sets the turn's thread, then reports the failures held for it or for no thread; failures of other threads are ignored from then on.
   * @param threadId The thread.
   * @returns A promise that resolves once the held failures are reported.
   */
  public followAsync(threadId: string): Promise<void>;
}

/**
 * Routes server-initiated requests of a shared app-server to the turn of their thread, or to the sub-agents of the turn that follows their thread.
 */
export declare class CodexRequestRouter implements IServerRequestHandler {
  /**
   * How many turns are registered.
   */
  public get activeCount(): number;

  /**
   * Registers a turn under its thread id.
   * @param turn The turn.
   */
  public register(turn: CodexTurn): void;

  /**
   * Removes a turn when it is the one registered under its thread id.
   * @param turn The turn.
   */
  public unregister(turn: CodexTurn): void;

  /**
   * Routes the requests of the threads a turn's sub-agents follow to them, until {@link unfollow}.
   * @param subAgents The turn's sub-agents.
   */
  public follow(subAgents: CodexSubAgents): void;

  /**
   * Stops routing requests to a turn's sub-agents.
   * @param subAgents The turn's sub-agents.
   */
  public unfollow(subAgents: CodexSubAgents): void;

  /**
   * Returns the registered turns.
   * @returns The turns.
   */
  public all(): readonly CodexTurn[];

  /**
   * Routes the request by its `threadId`: to the turn registered under it, else to the latest followed sub-agents that follow the thread, else, once
   * one names it, to the first of those whose child thread it may be and isn't named yet. When all of those drop it unnamed, the request goes to a
   * stopped one, which answers `cancel`, and else to the latest, which refuses it.
   * @param method The request's method.
   * @param params The request's parameters.
   * @param signal Aborts when the server withdraws the request.
   * @returns The turn's or the sub-agents' answer.
   * @throws UnsupportedServerRequestException when neither a turn nor a turn's sub-agents follow the thread.
   */
  public handleServerRequest(method: string, params: JsonReader, signal: AbortSignal): Promise<JsonValue>;
}

/**
 * Maps the sub-agents one Codex turn spawns to the shared sub-agent row: each `spawnAgent` call is a row, and the child thread the call names as its
 * receiver brings its type, model, items, tool uses, tokens, time and summary; a child's events from before the call names it wait until then, and are dropped
 * when the turn ends. A call that sends an earlier reply's child more work is a row too. In Codex's multi-agent v2 shape, a `subAgentActivity` item of kind
 * `started` is the row instead, its `agentThreadId` the child and the last part of its `agentPath` the description; a child's events from its
 * `turn/started` before then wait until then, to the end of the turn, a kind `interacted` for an earlier reply's child is a row of the reply that sends it,
 * and a kind `interrupted` ends the row as stopped, keeping the time of the child's turn that ends after it. A child's turn is a background task with no stop of its own,
 * which the reply's Stop interrupts with `turn/interrupt` on the child thread, ending the child's background commands with `thread/backgroundTerminals/clean`, and the row ends with the child's turn, with an ending agent state the turn reports, or with a spawn that ends without
 * a child, as stopped when it was interrupted and as failed otherwise. A child's approvals and questions are asked through the parent's turn, naming the
 * sub-agent.
 */
export declare class CodexSubAgents implements INotificationHandler, IExitHandler, IServerRequestHandler {
  /**
   * @param client The app-server client that runs the thread.
   * @param turn The parent thread's turn, which asks the children's requests.
   * @param threads The parent thread's child threads, by id, kept across its turns so a later turn knows an earlier turn's children.
   * @param listener Receives the rows, the children's items and their tasks.
   * @param itemReader Reads the children's items.
   * @param requestTimeout How long a stop request may take, in milliseconds.
   * @param woken Called when a child's turn ends, completed or failed, after the parent's turn has ended and unless TeamRun stopped it, with the
   * wake naming the row and its description.
   * @param platform The platform, as `process.platform`; `process.platform` by default.
   * @param sweep On Linux, ends what a child's `thread/backgroundTerminals/clean` leaves running outside the app-server, since bubblewrap runs a
   * sandboxed command in a session of its own that Codex's kill misses ([openai/codex#57863](https://github.com/openai/codex/issues/57863)): when the
   * app-server has a process id and the child's thread lists a terminal, or its terminals can't be listed, the clean runs through it; elsewhere, and
   * by default, it isn't used.
   * @param log Where the processes the sweep ended are named; nowhere by default.
   */
  public constructor(client: AppServerClient, turn: CodexTurn, threads: Map<string, JsonObject>, listener: ITurnListener, itemReader: CodexItemReader,
    requestTimeout: number, woken: (wake: TurnWake) => Promise<void>, platform?: string, sweep?: IOrphanSweep | null, log?: ILog | null);

  /**
   * Whether the turn ended and no sub-agent still runs, or the app-server exited.
   */
  public get isIdle(): boolean;

  /**
   * Waits until the sub-agents are idle.
   * @returns Resolves once {@link isIdle} is true.
   */
  public whenIdle(): Promise<void>;

  /**
   * Tracks the parent's spawn calls and agent states and its children's threads, turns, items and token counts.
   * @param method The notification method.
   * @param params The notification parameters.
   * @returns A promise that resolves once the listener has taken what the notification reports.
   */
  public handleNotificationAsync(method: string, params: JsonReader): Promise<void>;

  /**
   * Whether a row follows the thread as its child.
   * @param threadId The thread's id.
   * @returns Whether it follows the thread.
   */
  public follows(threadId: JsonValue | null): boolean;

  /**
   * Whether the thread may be a child that no call named yet: one whose `thread/started` names the parent, or whose turn started during the parent's turn.
   * @param threadId The thread's id.
   * @returns Whether it may follow the thread.
   */
  public mayFollow(threadId: JsonValue | null): boolean;

  /**
   * Waits for a call to name the thread as a child, when it may be one.
   * @param threadId The thread's id.
   * @returns `true` once a call names it, or `false` when it can't be, or the parent's turn ends or the server exits first.
   */
  public whenNamed(threadId: JsonValue | null): Promise<boolean>;

  /**
   * True once {@link stopAll} was called.
   */
  public get isStopped(): boolean;

  /**
   * Asks a child's command, file-change and MCP tool approvals and its questions through the parent's turn, naming the sub-agent, once a call names the child.
   * While the parent's reply takes approvals, also after its turn ended, since Core keeps them open while the sub-agent runs, the person's answer goes back
   * to the child. Once Core refuses the ask as closed, it answers `cancel` once the reply was stopped, and otherwise declines, or skips a question, with a
   * note under the row; any other failure is passed on.
   * @param method The request's method.
   * @param params The request's parameters.
   * @param signal Aborts when the server withdraws the request.
   * @returns The answer.
   * A thread no call names before the parent's turn ends is answered `cancel` once the reply was stopped.
   * @throws UnsupportedServerRequestException for any other method, and for a thread no call names before the parent's turn ends, unless the reply was stopped.
   */
  public handleServerRequest(method: string, params: JsonReader, signal: AbortSignal): Promise<JsonValue>;

  /**
   * Ends every running sub-agent as stopped with the app-server.
   * @returns A promise that resolves once the listener has taken each end.
   */
  public handleExitAsync(): Promise<void>;

  /**
   * Stops every sub-agent whose turn runs, through Codex, and one whose child hasn't started its turn yet once it does; a stop that fails leaves its sub-agent
   * to end with its turn. Each child's background commands end too, through `thread/backgroundTerminals/clean` on its thread, since `turn/interrupt` leaves
   * them running. Every child's are cleaned together, in one sweep of the app-server's orphans under the roots those threads name, once each running child's
   * interrupt has settled, whether or not it succeeded, and `settled` has, so the main thread's interrupt ends first. It returns once the stops already
   * running have settled too, so a client stopped after it leaves no sweep waiting.
   * @param settled Settles once the main thread's interrupt has.
   * @param timeout How long each interrupt and clean may take, in milliseconds; the usual request time limit by default.
   */
  public stopAll(settled: Promise<unknown>, timeout?: number): Promise<void>;

  /**
   * True while a stop of a sub-agent runs, its sweep included.
   */
  public get isStopping(): boolean;

  /**
   * Settles once the stops running now have.
   */
  public whenStopped(): Promise<void>;

  /**
   * Marks the parent's turn as ended, so the sub-agents are idle once none still runs, and drops the events of children no call named.
   */
  public finishTurn(): void;
}

/**
 * Maps one Codex turn's commands that run on in the background to background tasks: a command still running when the turn moves on, or when it ends, becomes
 * a task once Codex lists it among the thread's background terminals, and it ends when Codex completes its item, after the reply if it runs that long.
 */
export declare class CodexTasks implements INotificationHandler, IExitHandler {
  /**
   * @param client The app-server client that runs the thread.
   * @param threadId The thread.
   * @param listener Receives the tasks' starts, output and ends.
   * @param requestTimeout How long a list or stop request may take, in milliseconds.
   */
  public constructor(client: AppServerClient, threadId: string, listener: ITurnListener, requestTimeout: number);

  /**
   * Whether the turn ended and no task is running or waiting to be listed, or the app-server exited.
   */
  public get isIdle(): boolean;

  /**
   * Waits until the tasks are idle.
   * @returns Resolves once {@link isIdle} is true.
   */
  public whenIdle(): Promise<void>;

  /**
   * Tracks the thread's commands, their output and their ends.
   * @param method The notification method.
   * @param params The notification parameters.
   * @returns A promise that resolves once the listener has taken what the notification reports.
   */
  public handleNotificationAsync(method: string, params: JsonReader): Promise<void>;

  /**
   * Ends every running task as ended with the app-server.
   * @returns A promise that resolves once the listener has taken each end.
   */
  public handleExitAsync(): Promise<void>;

  /**
   * Stops every running task through Codex, as Stop does, once a listing of the background terminals still running has ended, so the commands it lists
   * are stopped too; a stop that fails leaves its task to end with the app-server.
   */
  public stopAll(): Promise<void>;

  /**
   * Marks the turn as interrupted: a token count Codex sends after that ends no model round, so a command still in its first wait is shown only if a
   * listing of the background terminals finds it.
   */
  public interrupt(): void;

  /**
   * Stops tracking new commands at the end of the turn, and lists the background terminals once more if a command is still running.
   */
  public finishTurn(): void;
}

/**
 * One Codex turn on one thread: handles the thread's notifications and server requests and
 * settles once with the turn's outcome.
 */
export declare class CodexTurn implements INotificationHandler, IServerRequestHandler {
  /**
   * The thread the turn runs on.
   */
  public readonly threadId: string;

  /**
   * Initializes the turn.
   * @param threadId The thread.
   * @param listener Where progress is reported.
   * @param observed What was observed when the thread started.
   * @param itemReader Converts items into details.
   * @param stream Accumulates the agent message deltas.
   * @throws ArgumentException when the thread id is blank.
   */
  public constructor(threadId: string, listener: ITurnListener, observed: ObservedSettings, itemReader: CodexItemReader, stream: DeltaStream);

  /**
   * The turn id once `turn/start` answered, or `null`.
   */
  public get turnId(): string | null;

  /**
   * What was observed so far.
   */
  public get observed(): ObservedSettings;

  /**
   * How the turn ended, or `null` while it runs.
   */
  public get outcome(): TurnOutcome | null;

  /**
   * The failure, or `null`.
   */
  public get error(): string | null;

  /**
   * Whether the turn ended.
   */
  public get isComplete(): boolean;

  /**
   * How many items of `Resources.codexFollowUpItemTypes` have completed in the turn. Codex reads a sub-agent's result when it builds a
   * sampling request, and samples again in a turn only after one of them, so a result that reached it after the last one waits for the
   * thread's next turn.
   */
  public get followUpItems(): number;

  /**
   * Records the turn id so that `turn/completed` of other turns is ignored.
   * @param turnId The turn id.
   * @throws ArgumentException when the turn id is blank.
   */
  public begin(turnId: string): void;

  /**
   * Asks to interrupt the turn once it has its id, from `turn/start` or
   * `turn/started`, so that a Stop sends one `turn/interrupt` however many
   * times it is asked for.
   * @returns The turn id once the turn has it, the first time; null after.
   */
  public requestInterrupt(): Promise<string> | null;

  /**
   * Waits until the turn ends.
   */
  public waitForCompletion(): Promise<void>;

  /**
   * Ends the turn as failed unless it already ended.
   * @param error Why.
   */
  public fail(error: string): void;

  /**
   * Ends the turn as interrupted unless it already ended.
   */
  public interrupt(): void;

  /**
   * Builds the turn's result, with the turn's id from `turn/start`; an aborted turn that did not complete counts as
   * interrupted.
   * @param aborted Whether the abort signal fired.
   * @returns The result.
   * @throws InvalidOperationException when the turn has not ended.
   */
  public toResult(aborted: boolean): TurnResult;

  /**
   * Handles a notification, ignoring those of other threads.
   * @param method The notification's method.
   * @param params The notification's parameters.
   * @returns A promise that resolves once the listener has taken what the notification reports.
   */
  public handleNotificationAsync(method: string, params: JsonReader): Promise<void>;

  /**
   * Answers command and file-change approvals with the listener's decision, and user-input requests with
   * the listener's answers by question id; a skipped request, or one without questions TeamRun can show,
   * gets no answers. An MCP tool call's approval through `mcpServer/elicitation/request` goes to the listener as a `Tool` approval, offering
   * "Allow for this session" only when its `_meta.persist` holds `session`, and its answer is `accept`, with `persist: session` for the session,
   * or `decline`, which marks denied the server's one tool call still running when the person answers; any other elicitation is answered
   * `cancel` with a note in the chat.
   * A request is withdrawn from the listener when `signal` aborts.
   * @param method The request's method.
   * @param params The request's parameters.
   * @param signal Aborts when the server withdraws the request.
   * @returns The answer.
   * @throws UnsupportedServerRequestException for any other method.
   */
  public handleServerRequest(method: string, params: JsonReader, signal: AbortSignal): Promise<JsonValue>;

  /**
   * Asks a request as {@link handleServerRequest} does, for the turn itself or for one of its sub-agents. A sub-agent's approval names it in the payload's
   * `subAgent` field, and its questions in their `QuestionAsk`; its MCP tool call's decline marks none of the turn's own calls denied, and its questions
   * reject when the listener does, rather than getting no answers.
   * @param method The request's method.
   * @param params The request's parameters.
   * @param signal Aborts when the server withdraws the request.
   * @param subAgent The sub-agent's description, as its row shows it, or `null` for the turn's own request.
   * @returns The answer.
   * @throws UnsupportedServerRequestException for any other method.
   */
  public ask(method: string, params: JsonReader, signal: AbortSignal, subAgent: string | null): Promise<JsonValue>;

  /**
   * Whether the person denied an approval for the item, the turn's own or a sub-agent's.
   * @param itemId The item's id.
   * @returns Whether it was denied.
   */
  public hasDeclined(itemId: string): boolean;
}

/**
 * Finds the Codex and Claude Code executables. Codex: an override, else the native binary behind
 * the global npm shim, else the shim on `PATH`. Claude Code: an override, else `~/.local/bin`,
 * else `PATH`.
 */
export declare class ExecutableLocator {
  /**
   * Initializes the locator.
   * @param platform The platform, as `process.platform`.
   * @param architecture The architecture, as `process.arch`.
   * @param pathEntries The directories of `PATH`.
   * @param homeDirectory The user's home directory.
   * @param localAppDataDirectory Windows' per-user application data folder, `%LOCALAPPDATA%`, where Codex's installer and
   * winget put their tools; `AppData\Local` in the home directory when omitted.
   * @param systemRootDirectory Windows' own folder, `%SystemRoot%`, whose `System32` holds Windows' `tar.exe`; `C:\Windows` when omitted.
   * @param macTarPath The macOS system's tar, `Resources.tarMacPath`, `/usr/bin/tar`, when omitted.
   */
  public constructor(platform: string, architecture: string, pathEntries: readonly string[], homeDirectory: string, localAppDataDirectory?: string,
    systemRootDirectory?: string, macTarPath?: string);

  /**
   * Creates a locator for the current process.
   * @returns The locator.
   */
  public static fromProcess(): ExecutableLocator;

  /**
   * Splits a `PATH` value into its non-blank directories.
   * @param value The variable's value, or `undefined` when it is not set.
   * @returns The directories.
   */
  public static splitPath(value: string | undefined): readonly string[];

  /**
   * Locates Codex.
   * @param override An explicit path, or `null`; an override that does not exist finds nothing.
   * @returns The executable, or `null`.
   */
  public locateCodex(override: string | null): LocatedExecutable | null;

  /**
   * Locates Claude Code.
   * @param override An explicit path, or `null`; an override that does not exist finds nothing.
   * @returns The executable, or `null`.
   */
  public locateClaude(override: string | null): LocatedExecutable | null;

  /**
   * The folder Codex's installers put its command in: `~/.local/bin`, or `Programs\OpenAI\Codex\bin` in the local app data folder on Windows.
   */
  public codexInstallDirectory(): string;

  /**
   * Finds Grok on PATH or in its native user installation, `~/.grok/bin`, which it marks `LocalBin` also when the PATH finds that same file,
   * by another case or through a link.
   */
  public locateGrok(override: string | null): LocatedExecutable | null;

  /**
   * The folder Grok's installers install it in: `.grok` in the home folder, with `downloads` and `bin` in it.
   */
  public grokInstallDirectory(): string;

  /**
   * Finds OpenCode as the person installed it: `opencode` (`opencode.exe` on Windows) on PATH; on Windows, the native binary of npm's global
   * `opencode-ai` package beside its `opencode.cmd` shim, its baseline build too, marked `GlobalNpm`; and then OpenCode's own installation,
   * `~/.opencode/bin`, marked `LocalBin`; and last the pinned version TeamRun installed, `<installDirectory>/<version>/opencode[.exe]`,
   * marked `Managed`, when an install folder is given.
   */
  public locateOpencode(override: string | null): LocatedExecutable | null;

  /**
   * Finds Cursor's CLI as the person installed it: `cursor-agent` on PATH, then Cursor's own installation in `~/.local/bin`, marked `LocalBin`.
   * On Windows it finds Cursor's `cursor-agent.cmd` launcher the same way, on PATH and then in `%LOCALAPPDATA%/cursor-agent`, and returns what the
   * launcher runs, since a `.cmd` can't start without a shell: the `node.exe` beside the launcher with `index.js` as its first argument, or else
   * the ones in the newest dated folder of the launcher's `versions` folder, as Cursor's `cursor-agent.ps1` picks it; an override that names a
   * `.cmd` is followed the same way. Last, when an install folder is given, it finds the pinned version TeamRun installed,
   * `<installDirectory>/<version>/dist-package/cursor-agent[.cmd]`, marked `Managed`, and on Windows what its launcher runs.
   */
  public locateCursor(override: string | null, installDirectory?: string | null): LocatedExecutable | null;

  /**
   * Finds fx as the person installed it: `fx` on PATH, then in the folder fx's install script used, then in `~/.local/bin`, its install
   * script's own folder, marked `LocalBin`. On Windows, where fx has no build, it finds nothing but an override.
   * @param installDirectory The folder fx's install script was told to use, its `FX_INSTALL_DIR`, or `null` or blank when none was.
   */
  public locateFx(override: string | null, installDirectory?: string | null): LocatedExecutable | null;

  /**
   * Finds GitHub Copilot CLI: on Linux and macOS, `copilot` on PATH or in `~/.local/bin`, marked `LocalBin` when it is the same file as the one
   * in `~/.local/bin`, by another case or through a link; on Windows, `copilot.exe` on PATH, the native binary of npm's global `@github/copilot`
   * package beside its `copilot.cmd` shim, or winget's link when there is no shim, and only then the newest version folder TeamRun installed,
   * marked `Managed`.
   * @param installDirectory The folder TeamRun installs Copilot versions into on Windows, `copilotInstallDirectory`, or `null` to leave it out.
   */
  public locateCopilot(override: string | null, installDirectory?: string | null): LocatedExecutable | null;

  /**
   * The folder TeamRun installs Copilot in: `~/.local/bin`, as Copilot's own installer does, or the given folder on Windows, where TeamRun
   * keeps each version in its own folder.
   */
  public copilotInstallDirectory(windowsDirectory: string): string;

  /**
   * Finds the Antigravity ACP server TeamRun installed, in the pinned version's folder under the install folder, with its harness beside it.
   * @param installDirectory The folder TeamRun installs Antigravity versions into.
   * @returns The server, or `null` when it or its harness is missing.
   */
  public locateAntigravity(installDirectory: string): LocatedExecutable | null;

  /**
   * Finds the Antigravity server a provider runs, with the command that starts it and its harness's path: the chosen path when one is given,
   * else TeamRun's installed copy as `locateAntigravity` finds it, else the first `PATH` folder holding the server with its harness beside it.
   * @param installDirectory Where TeamRun installs the server.
   * @param chosen The provider's chosen server path, or `null`, the default, for none; a chosen path is never replaced by another server.
   * @returns The server, or `null` when it or its harness is missing.
   */
  public locateAntigravityServer(installDirectory: string, chosen?: string | null): AntigravityServer | null;

  /**
   * Returns the path of the harness that sits beside the Antigravity server.
   */
  public antigravityHarness(server: string): string;

  /**
   * Finds the program that unpacks a zip archive: `unzip` on PATH, or on Windows `unzip.exe` on PATH and then Windows' own `tar.exe` in
   * `System32`, which reads zip; never another `tar.exe` on PATH, as Git's reads `C:\...` as a remote archive.
   * @returns The program, or `null` when the computer has none.
   */
  /**
   * The `pi` on the path, and then the launcher Pi's own installer writes, `~/.pi/agent/bin/pi`, marked `LocalBin`; on Windows, the `node.exe`
   * beside `pi.cmd`, or on the path, with Pi's `cli.js` from the shim's `node_modules`.
   */
  public locatePi(override: string | null): LocatedExecutable | null;

  /**
   * On macOS and Linux, Muse Code's launcher, `muse`, on the path or in the installer's folder, `~/.local/bin`, since the launcher updates Muse Code and removes
   * the binaries it replaced; without one, the binary that `.muse-version` names in the given install folder or the installer's folder. On Windows, which can't
   * start `muse.cmd` without a shell, the binary that `.muse-version` names in the given install folder, beside `muse.cmd` on the path, or in
   * `%LOCALAPPDATA%\Programs\muse`, read again at each call, and without one `muse.exe` on the path.
   */
  public locateMuse(override: string | null, installDirectory?: string | null): LocatedExecutable | null;
  public locateUnzip(): LocatedExecutable | null;

  /**
   * Finds tar on PATH; on Windows Windows' own `tar.exe` in `System32`, never another `tar.exe` on PATH, as Git's reads `C:\...` as a
   * remote archive; and on macOS the system's tar at `macTarPath`, never another on PATH, such as a GNU tar that can't read the zip archives.
   * @returns The program, or `null` when the computer has none, as on a Mac without `macTarPath`.
   */
  public locateTar(): LocatedExecutable | null;

  /**
   * The person's npm on `PATH`, `npm.cmd` on Windows, or `null`.
   */
  public locateNpm(): LocatedExecutable | null;
}

/**
 * How to run a provider's program: the command found when TeamRun started, looked for again while there is none, and kept once found.
 */
export declare class CommandSource {
  /**
   * Initializes the source.
   * @param command The command found when TeamRun started, or `null`.
   * @param locate Looks for the command again while there is none; finds nothing by default.
   */
  public constructor(command: ProcessCommand | null, locate?: () => ProcessCommand | null);

  /**
   * The command, looked for again while there is none; `null` while it isn't found.
   */
  public get current(): ProcessCommand | null;

  /**
   * Finds nothing: the default of `locate`.
   */
  public static none(): ProcessCommand | null;
}

/**
 * Finds a provider's command-line tool afresh at each check: where its provider installs it, and its version from `--version`.
 */
export declare class CommandLineTool implements IProviderTool {
  /**
   * Initializes the tool.
   * @param kind The kind's id.
   * @param locate Looks for the tool, as `ExecutableLocator` does; called at each check.
   * @param versionReader Reads the found tool's version.
   * @param environment The environment the version command runs with.
   * @param installCommand The provider's official command that installs the tool on this platform, or `null`.
   * @param subscribeUrl The provider's own page for a subscription, or `null`.
   * @throws ArgumentException when `kind` is blank.
   */
  public constructor(kind: string, locate: () => LocatedExecutable | null, versionReader: ExecutableVersionReader, environment: NodeJS.ProcessEnv,
    installCommand: string | null, subscribeUrl: string | null);
  /**
   * Chooses a provider's install command for a platform.
   * @param platform The platform, as `process.platform` names it.
   * @param posixCommand The command for macOS and Linux.
   * @param windowsCommand The command for Windows, or `null` when the tool has none there.
   * @returns `windowsCommand` on Windows, else `posixCommand`.
   */
  public static installCommandFor(platform: string, posixCommand: string, windowsCommand: string | null): string | null;

  /**
   * @inheritdoc
   */
  public check(): Promise<ProviderTool>;
}

/**
 * Reads an executable's version from `--version`.
 */
export declare class ExecutableVersionReader {
  /**
   * Initializes the reader.
   * @param runner Runs the command.
   * @param timeoutMilliseconds How long `--version` may take.
   * @throws ArgumentOutOfRangeException when the timeout is not a positive integer.
   */
  public constructor(runner: CommandRunner, timeoutMilliseconds: number);

  /**
   * Reads the executable's path, size and modification time, which change when it is replaced,
   * without starting it.
   * @param command How to run the executable.
   * @returns The stamp, or `null` when the executable can't be read.
   */
  public readStamp(command: ProcessCommand): string | null;

  /**
   * Reads the version.
   * @param command How to run the executable.
   * @param environment The process environment.
   * @param cancel Stops the command when aborted; `null` by default.
   * @returns The first `x.y.z` in the output of a command that exits 0 in time, or `null` when there is none, the command fails, exits otherwise,
   * such as a program that names its own versioned path in an error, or it is cancelled.
   */
  public read(command: ProcessCommand, environment: NodeJS.ProcessEnv, cancel?: AbortSignal | null): Promise<string | null>;
}

/**
 * Turns a provider's plan into the reply's plan detail.
 */
export declare class PlanDetails {
  /**
   * A step from the provider's fields.
   * @param text The step's text.
   * @param status Where it stands, already mapped from the provider's status.
   * @param activeText What the agent says while doing it.
   * @returns The step, or `null` when the text isn't a non-blank string; an active text that isn't one is dropped.
   */
  public static step(text: unknown, status: PlanStepStatus, activeText: unknown): PlanStep | null;

  /**
   * A provider's status as TeamRun's, by the provider's table.
   * @param statuses The provider's statuses, by its own names.
   * @param status The status the provider sent.
   * @param fallback The status for one the table doesn't name, or one that isn't a string.
   * @returns The status.
   */
  public static statusOf(statuses: Readonly<Record<string, PlanStepStatus>>, status: unknown, fallback: PlanStepStatus): PlanStepStatus;

  /**
   * The plan detail for the whole plan, with its progress as text.
   * @param steps The steps; `null` ones are left out.
   * @param explanation Why the agent wrote or changed the plan, when it's a string.
   * @param id The detail's item id, the same for every update in a reply so each replaces the last.
   */
  public static detail(steps: readonly (PlanStep | null)[], explanation: JsonValue | undefined, id: string): TurnDetail;

  /**
   * The plan detail for a plan-mode plan, titled by its first line, with the item id every provider's plan text shares so a revised plan
   * replaces the last one in the reply.
   * @param text The plan as Markdown.
   * @param rejected Whether the person refused to approve the plan; `false` by default.
   * @param approved Whether the person approved the plan; `false` by default.
   * @returns The detail, or `null` when the text isn't a non-blank string.
   */
  public static text(text: unknown, rejected?: boolean, approved?: boolean): TurnDetail | null;
}

/**
 * One step of Claude Code's to-do list as its tools last gave it: the text and the text shown while in progress unchecked until the plan is built.
 */
export interface IClaudePlanStep {
  /**
   * The step's text, as the tool gave it.
   */
  readonly text: unknown;

  /**
   * The step's status, read from the tool's own status.
   */
  readonly status: PlanStepStatus;

  /**
   * The text shown while the step is in progress, as the tool gave it.
   */
  readonly activeText: unknown;
}

/**
 * Claude Code's to-do list in one chat, from its to-do tools: `TodoWrite` sends the whole list, while `TaskCreate` adds a task whose id comes in
 * its result and `TaskUpdate` changes or deletes one. The list is kept for the session, across its turns and the queries that resume it, and
 * each change reports the whole list.
 */
export declare class ClaudePlan {
  /**
   * Whether the tool is one of Claude Code's to-do tools, which TeamRun shows as the plan, never as a step.
   */
  public static isPlanTool(name: string): boolean;

  /**
   * Whether the tool is a to-do tool or `ExitPlanMode`, whose plan TeamRun shows as the reply's plan text; `ExitPlanMode` still asks the
   * person to approve.
   */
  public static tracks(name: string): boolean;

  /**
   * Whether the tool call was a to-do tool's or `ExitPlanMode`'s, so its result belongs to the plan.
   */
  public owns(toolUseId: string): boolean;

  /**
   * Notes a to-do tool's call: `TodoWrite`'s list shows at once, while a task's creation, update or listing waits for its result.
   * `ExitPlanMode`'s `plan` shows at once as the plan text.
   * @returns The plan detail when the list or the plan text changed, or `null` until the result comes.
   */
  public noteToolUse(name: string, toolUseId: string, input: unknown): TurnDetail | null;

  /**
   * Notes a to-do tool's result: a created task joins the list under the id its structured result names, an update applies unless the tool
   * refused it, and `TaskList`'s tasks become the list, keeping each known task's text shown while in progress. An `ExitPlanMode` call's
   * plan text is sent again, marked as refused, when the person denied its approval, and marked as approved only when the person allowed it
   * and it succeeded: a success nobody was asked about, such as in Bypass, approves nothing.
   * @param structured The result message's `tool_use_result`.
   * @param denied Whether the person denied the call's approval; `false` by default.
   * @param allowed Whether the person allowed the call; `false` by default.
   * @returns The plan detail when the list or the plan text changed, or `null`.
   */
  public noteResult(toolUseId: string, isError: boolean, structured: unknown, denied?: boolean, allowed?: boolean): TurnDetail | null;
}

/**
 * Reads the figures of a provider's usage answer: a figure out of shape is blank, never guessed.
 */
export declare class UsageValues {
  /**
   * The value as an object, or `null` when it isn't one.
   */
  public static objectOf(value: JsonValue | undefined): JsonObject | null;

  /**
   * The value at the path of field names, or `undefined` where a step isn't an object.
   */
  public static fieldOf(value: JsonValue | undefined, ...path: readonly string[]): JsonValue | undefined;

  /**
   * The value as a count: a safe, non-negative integer, or `null`.
   */
  public static count(value: JsonValue | undefined): number | null;

  /**
   * The value as an amount: a finite, non-negative number, or `null`.
   */
  public static amount(value: JsonValue | undefined): number | null;

  /**
   * The value as an ISO time, from a date text, or `null` when it isn't one.
   */
  public static time(value: JsonValue | undefined): string | null;

  /**
   * The value as an ISO time, from milliseconds since 1970, or `null` when it isn't a count.
   */
  public static timeFromMilliseconds(value: JsonValue | undefined): string | null;

  /**
   * The context use, or `null` when the tokens used or a non-zero window can't be read; the compact point is blank when it can't be read or is 0.
   */
  public static context(used: JsonValue | undefined, window: JsonValue | undefined, compactAt?: JsonValue | undefined): ContextUsage | null;

  /**
   * The window, or `null` when it has no name or its use can't be read.
   */
  public static window(name: PlanWindowName | null, usedPercent: JsonValue | undefined, resetsAt: string | null): PlanWindow | null;
}

/**
 * Describes a thrown value.
 */
export declare class FailureDescriber {
  /**
   * Returns an error's message, or the value as text. An `AcpRequestException` whose data has a `message` the error's own message doesn't hold
   * gets it after its message, since ACP's SDK puts the reason for errors such as `Invalid params` there, as Cursor's `session/load` does for a
   * session it never saved.
   * @param error The thrown value.
   * @returns The description.
   */
  public static describe(error: unknown): string;

  /**
   * Whether a thrown value is Core's refusal of a run that is no longer open: an error whose `info.name` is `Conflict`.
   * @param error The thrown value.
   * @returns Whether it refuses a closed run.
   */
  public static isClosedRun(error: unknown): boolean;
}

/**
 * Decodes output a program wrote as UTF-16 but that reached TeamRun decoded as UTF-8, a zero after each letter in little-endian text or before it in big-endian text.
 */
export declare class CommandOutputDecoder {
  /**
   * Decodes each run of UTF-16 letters, one after a byte-order mark or of at least 4 letters, and leaves the rest of the text as it is.
   * @param text The output.
   * @returns The output with those runs decoded.
   */
  public static decode(text: string): string;
}

/**
 * Follows a running task's output file, sending the text written since the last read.
 */
export declare class TaskOutputFollower {
  /**
   * Creates a follower that hasn't started.
   * @param path The output file.
   * @param write Receives each new piece of output, decoded as command output, as `TaskOutputReader.readTail` decodes the file, with a UTF-16 run
   * the read ends inside held back until the next read.
   * @param timer Tells the time the file is read again; a `NodeTimer` by default.
   * @param interval How often the file is read, in milliseconds; by default {@link Resources.taskOutputFollowInterval}.
   * @param maximumBytes The most bytes the first read sends, from the end of what's new; a read after something was sent sends at most
   * {@link Resources.followedTaskOutputFactor} times as many. By default {@link Resources.maximumTaskOutputBytes}.
   */
  public constructor(path: string, write: (text: string) => void, timer?: ITimer, interval?: number, maximumBytes?: number);

  /**
   * Whether the file is still read on a timer.
   */
  public get isFollowing(): boolean;

  /**
   * Reads the file now and then on the timer. A file that is missing or can't be read is tried again at the next read; one that is shorter than what
   * was read, or replaced by another file, is read again from its start, after what was held back is sent. A read that finds nothing new sends what
   * was held back.
   */
  public start(): void;

  /**
   * Stops reading, sending nothing more.
   */
  public stop(): void;

  /**
   * Stops reading and sends what's left in the file and what was held back, with any character its end cut.
   */
  public finish(): void;

  /**
   * Tells whether a path names the file this follower last read.
   * @param path The path.
   * @returns `true` when the path is the same file, by device and inode; `false` when it is another file, can't be read, or nothing was read yet.
   */
  public reads(path: string): boolean;
}

/**
 * Reads the end of a task's output file.
 */
export declare class TaskOutputReader {
  /**
   * Reads the last bytes of a file as text, without a character the cut broke, decoded as command output.
   * @param path The output file.
   * @param maximumBytes The most bytes read; by default {@link Resources.maximumTaskOutputBytes}.
   * @returns The text, or an empty string when the file can't be read.
   */
  public static readTail(path: string, maximumBytes?: number): string;
}

/**
 * Reads the command a shell wrapper runs, from a command line joined with POSIX quoting.
 */
export declare class ShellCommandReader {
  /**
   * Returns the script of a `pwsh` or `powershell` `-Command`, a `cmd /c` with one word after it, or a `bash`, `zsh` or `sh` `-c` or `-lc` call, without the shell's path, its flags or a PowerShell first line that only sets `[Console]::OutputEncoding`.
   * @param command The command line.
   * @returns The script, or null when the command isn't such a call, its quotes don't close, or its script is blank.
   */
  public static innerCommand(command: string): string | null;

  /**
   * Returns the dialect of the shell a wrapper call runs its script in.
   * @param command The command line.
   * @returns The dialect, or null when {@link innerCommand} returns null.
   */
  public static dialectOf(command: string): ShellDialect | null;
}

/**
 * Splits a shell script into words, separators, redirections and groups, in the shell's quoting.
 */
export declare class ShellTokenReader {
  /**
   * Splits a script. A variable, a command substitution, a glob or brace expansion makes its word not literal; a POSIX here-document's body
   * is skipped, and one with a substitution, under a delimiter that isn't quoted, marks its delimiter as running commands; a PowerShell
   * comma list is one word holding its items; a POSIX word that starts with a quoted `~` reads from the current folder; and a comment is
   * left out.
   * @param script The script.
   * @param dialect The shell's dialect.
   * @returns The pieces, or null when a quote, a substitution or a here-document doesn't close, or the script uses what the dialect reserves,
   * such as PowerShell's `<` or `--%`.
   */
  public static tokensOf(script: string, dialect: ShellDialect): readonly ShellToken[] | null;
}

/**
 * Reads the files a shell command writes from what it names, for listing the changes it made outside the chat's folder.
 */
export declare class WriteTargetReader {
  /**
   * Reads the files the script a shell wrapper runs writes, in that shell's dialect.
   * @param command The command line, such as `bash -lc 'echo hi > a.txt'`.
   * @returns The targets, or null when the command isn't a shell wrapper's call or {@link targetsOf} can't read its script.
   */
  public static targetsOfCall(command: string): WriteTargets | null;

  /**
   * Reads the files a command line writes: a shell wrapper's script in its dialect, or else the line itself in the platform's shell,
   * PowerShell on Windows and POSIX elsewhere.
   * @param command The command line.
   * @param platform The platform the command runs on, as `process.platform` names it, which it is by default.
   * @returns The targets, or null when {@link targetsOf} can't read the script.
   */
  public static targetsOfCommand(command: string, platform?: string): WriteTargets | null;

  /**
   * Reads the files a script writes: redirections; the files `touch`, `tee`, `cp`, `mv`, `rm`, `sed -i` and the like name; PowerShell's
   * `Out-File`, `Set-Content`, `New-Item`, `Copy-Item`, `Move-Item`, `Remove-Item` and the like; and cmd's `copy`, `move`, `del` and `ren`. A
   * `cd` moves the folder the next relative paths are read in. A program it doesn't know, a target that isn't literal or a word whose expansion
   * runs commands leaves the folder it ran in as one where files may be written without being named, and so does a recursive copy, or a copy
   * of a source that isn't literal, for its destination, a recursive removal for its target, or a git command that may write for its
   * repository.
   * @param script The script.
   * @param dialect The shell's dialect.
   * @returns The targets, or null when the script can't be split or the folder it moves to can't be known.
   */
  public static targetsOf(script: string, dialect: ShellDialect): WriteTargets | null;
}

/**
 * A provider's call of a Terminal tool, kept until its result comes so the step can be read again with it.
 */
export declare class TerminalToolCall {
  /**
   * The tool, `terminal_run` or `terminal_write`.
   */
  public readonly tool: string;
  /**
   * The call's arguments.
   */
  public readonly input: JsonValue;
  /**
   * The item id the step was reported under.
   */
  public readonly itemId: string;
  /**
   * The item id of the sub-agent that made the call, or `null`.
   */
  public readonly parentItemId: string | null;

  /**
   * Creates a call.
   * @param tool The tool.
   * @param input The call's arguments.
   * @param itemId The item id the step was reported under.
   * @param parentItemId The sub-agent's item id, or `null`.
   */
  public constructor(tool: string, input: JsonValue, itemId: string, parentItemId: string | null);
}

/**
 * What a Terminal tool call returned, as a provider reports it.
 */
export declare class TerminalToolResult {
  /**
   * Terminal's structured report, or `null` when the call failed or the provider gave none.
   */
  public readonly report: JsonObject | null;
  /**
   * The result's text, such as a failure's message.
   */
  public readonly text: string;
  /**
   * Whether the call failed.
   */
  public readonly isError: boolean;

  /**
   * Creates a result.
   * @param report Terminal's structured report, or `null`.
   * @param text The result's text.
   * @param isError Whether the call failed.
   */
  public constructor(report: JsonObject | null, text: string, isError: boolean);
}

/**
 * Reads a call of Terminal's `terminal_run` or `terminal_write` into a command step that names the terminal, for every provider that names the tool it called.
 */
export declare class TerminalToolReader {
  /**
   * Tells a Terminal tool a reply shows as a command step.
   * @param tool The tool's name, without the server's.
   * @returns Whether the tool is `terminal_run` or `terminal_write`.
   */
  public static isStepTool(tool: string): boolean;

  /**
   * Reads a call into a command detail: the command or the keys typed, the terminal's id and title, the exit code and the output from Terminal's
   * report, a status of `inProgress` until the result comes, then `failed` for a failed call or a killed command and `completed` otherwise, and the title
   * {@link Resources.formatTerminalStepTitle} gives.
   * @param tool The tool, `terminal_run` or `terminal_write`.
   * @param input The call's arguments.
   * @param result What the call returned, or `null` while it runs.
   * @param payload Fields the provider adds to the detail's payload, such as its own call id.
   * @param id The provider's item id, the same for the call and for it again with its result.
   * @param parentItemId The item id of the sub-agent that made the call, or `null`.
   * @returns The detail.
   */
  public static read(tool: string, input: JsonValue, result: TerminalToolResult | null, payload: JsonObject, id: string, parentItemId?: string | null): TurnDetail;
}

/**
 * Titles a command a step ran in plain words, from the command alone, for a provider that gives no title of its own.
 */
export declare class CommandTitleReader {
  /**
   * Titles the script a shell wrapper runs, in that shell's dialect.
   * @param command The command line, such as `bash -lc 'rg -n foo src'`.
   * @returns The title, or null when the command isn't a shell wrapper's call or {@link titleOf} gives none for its script.
   */
  public static titleOfCall(command: string): string | null;

  /**
   * Titles a command: a search, a read of whole files or of a file's start or end, a folder's listing, a change of folder, or a git status, diff or log.
   * @param command The command.
   * @param dialect The shell's quoting.
   * @returns The title, or null when the command is another one, has a flag the title doesn't understand, joins commands, pipes, redirects, expands a variable or runs over lines.
   */
  public static titleOf(command: string, dialect: ShellDialect): string | null;
}

/**
 * Checks and reads an image file a provider saved, for the image readers.
 */
export declare class SavedImageFile {
  /** Whether a value is an absolute path with no `.` or `..` segment. */
  public static isPlain(path: unknown): path is string;

  /** The real path, links resolved, or null when it can't be read. */
  public static realPathOf(path: string): string | null;

  /** Whether a path is the folder or inside it, by their text alone. */
  public static isInside(directory: string, path: string): boolean;

  /**
   * Reads the image at a path whose real path is `target`, or null. It reads only a regular file, opened read-only and, on Linux and macOS,
   * without waiting or following a link; after opening, the file must be the one `target` named (its device and inode), the path must still
   * resolve to `target`, `allowed` must take `target` and the opened file's owner, and the file must be an image of at most the image limit.
   * @param path The path as the provider named it, kept as the image's path.
   * @param target The path's real path, checked before this call.
   * @param allowed Whether a real path, owned by the given user id (0 on Windows), may be read.
   */
  public static read(path: string, target: string, allowed: (realPath: string, owner: number) => boolean): SavedImage | null;
}

/**
 * Reads the media type of an image given as base64.
 */
export declare class ImageDataReader {
  /**
   * Returns the media type its leading bytes name, for a PNG, JPEG, GIF or WebP no longer than the image data limit.
   * @param data The base64 data, or null.
   * @returns The media type, or null when the data is missing, too long, not base64 or not one of those images.
   */
  public static mediaTypeOf(data: string | null): string | null;
}

/**
 * A timer that starts when a signal aborts and elapses after a delay; used as a grace period.
 */
export declare class AbortTimer implements Disposable {
  /**
   * Initializes the timer; it arms immediately for an aborted signal.
   * @param signal The signal.
   * @param delayMilliseconds The delay after the abort.
   * @throws ArgumentOutOfRangeException when the delay is not a positive integer.
   */
  public constructor(signal: AbortSignal, delayMilliseconds: number);

  /**
   * Whether the delay elapsed.
   */
  public get elapsed(): boolean;

  /**
   * Waits until the delay elapses; never resolves for a signal that does not abort.
   */
  public wait(): Promise<void>;

  /**
   * Stops listening and cancels the timer.
   */
  public [Symbol.dispose](): void;
}

/**
 * Runs a command to completion without a shell, with bounded output and a timeout.
 */
export declare class CommandRunner {
  /**
   * Initializes the runner.
   * @param starter Starts the commands, and stops those that exceed their timeout.
   * @param maximumOutputLength The characters it keeps of each of a command's stdout and stderr, which `BoundedOutput` cuts beyond;
   * `Resources.maximumOutputLength`, 512K, by default.
   */
  public constructor(starter: IProcessStarter, maximumOutputLength?: number);

  /**
   * Reads the environment a command started now builds its own from, as `IProcessStarter.readEnvironmentAsync` says.
   * @param own The environment TeamRun itself started with.
   * @returns A promise of the environment, which never rejects.
   */
  public readEnvironmentAsync(own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv>;

  /**
   * Runs the command.
   * @param command The command.
   * @param environment The process environment.
   * @param timeoutMilliseconds How long the command may take before it is stopped, or `null` to let it run to its end.
   * @param cancel Stops the command when it is aborted, even before it starts; the command then ends as a stopped one. `null` by default.
   * @returns How the command ended.
   * @throws ArgumentOutOfRangeException when the timeout is not `null` or a positive integer.
   * @throws Error when the process cannot be spawned.
   */
  public run(command: ProcessCommand, environment: NodeJS.ProcessEnv, timeoutMilliseconds: number | null, cancel?: AbortSignal | null): Promise<CommandResult>;
}

/**
 * Starts programs as child processes of this one, and stops them through a `ProcessTerminator`.
 */
export declare class NodeProcessStarter implements IProcessStarter {
  /**
   * Initializes the starter.
   * @param terminator Stops the programs.
   */
  public constructor(terminator: ProcessTerminator);

  /**
   * Starts the program without a shell, with its window hidden on Windows.
   * @param command How to run the program.
   * @param environment The program's environment.
   * @param directory The program's working directory, or `null` for this process's.
   * @returns The process.
   */
  public start(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string | null): StartedProcess;

  /**
   * Gives back the environment TeamRun started with, since this process has no other.
   * @param own The environment TeamRun itself started with.
   * @returns A promise of `own`.
   */
  public readEnvironmentAsync(own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv>;
}

/**
 * Runs PowerShell scripts in one shell that it starts with the first script and keeps until it has been idle, so a listing on Windows doesn't wait
 * for a new PowerShell to start, which takes seconds. A script that runs out of time ends the shell, and the next script starts a new one. The shell
 * doesn't keep Node running: once Node exits, its input closes and it exits too.
 */
export declare class PowershellSession implements IPowershellSession {
  /**
   * The session `ProcessTree` lists and ends processes through on Windows by default: `powershell.exe` on this process's environment, closed after
   * `Resources.powershellSessionIdle`.
   */
  public static readonly shared: PowershellSession;

  /**
   * @param executable The shell.
   * @param commandArguments Its arguments, so that it reads its scripts from standard input.
   * @param environment Its environment.
   * @param idle How long it stays open after a script, in milliseconds.
   */
  public constructor(executable: string, commandArguments: readonly string[], environment: NodeJS.ProcessEnv, idle: number);

  /** @inheritdoc */
  public run(script: string, timeout: number): Promise<string>;
}

/**
 * Terminates a process: on Windows the whole tree through `taskkill`, elsewhere with `SIGTERM`.
 */
export declare class ProcessTerminator {
  /**
   * Initializes the terminator.
   * @param platform The platform, as `process.platform`.
   */
  public constructor(platform: string);

  /**
   * Terminates the process; a process that never started or already exited is left alone.
   * @param child The process.
   */
  public terminate(child: ChildProcess): Promise<void>;
}

/**
 * Lists processes with their parents and starts, and ends a tree. A process counts as the tree's only through a parent that started no later than
 * it, and not through a parent id the listing shows another process holding now.
 * On Windows it ends the tree in rounds, each one PowerShell script that opens each listed process by id, ends it through that handle only when it
 * started when the listing said, parents first, and lists again, until no new process shows under the tree, at most `processTreeFreezeRounds`
 * rounds; its listings and rounds run in its `IPowershellSession` when it has one, and otherwise each in a new PowerShell, and a script the session
 * fails or runs out of time on runs once more in a new PowerShell, so a stalled session doesn't leave the tree running.
 * Elsewhere it sends `SIGSTOP` to each process of the tree and lists again until no new process shows under it, at most `processTreeFreezeRounds`
 * listings, so a parent can't start its next process meanwhile; then `SIGTERM` and `SIGCONT` to each it stopped. Once those have ended, or after
 * the grace, it holds what is left still the same way, new children included, and sends `SIGKILL` to each. A process whose signal fails, such as
 * one that has already ended, is skipped.
 */
export declare class ProcessTree implements IProcessTree, IOrphanSweep {
  /**
   * @param platform The platform, as `process.platform`.
   * @param runner Runs the listing.
   * @param environment The listing's environment.
   * @param timeout How long a listing may take, in milliseconds.
   * @param timer Waits out the grace.
   * @param grace How long the tree has to end after its `SIGTERM`, and what an exited process left after its `SIGKILL`, outside Windows, in milliseconds.
   * @param kill Sends a signal to a process outside Windows, or `0` to see whether it still runs, throwing when it can't; `process.kill` by default.
   * @param session Runs the listings and the ends on Windows instead of a new PowerShell for each through the runner; none by default.
   * @param read Reads a process's environment file for `endOrphaned`, throwing when it can't; the file system by default.
   */
  public constructor(platform: string, runner: CommandRunner, environment: NodeJS.ProcessEnv, timeout: number, timer: ITimer, grace: number,
    kill?: (processId: number, signal: NodeJS.Signals | 0) => void, session?: IPowershellSession | null, read?: (path: string) => string);

  /** @inheritdoc */
  public endTree(processId: number, startedBy: number, ancestorId: number): Promise<boolean>;

  /** @inheritdoc */
  public endOwnTree(processId: number, startedBy: number): Promise<boolean>;

  /** @inheritdoc */
  public endDescendants(processId: number): Promise<void>;

  /** @inheritdoc */
  public endLeftovers(processId: number, launched: number, exited: number): Promise<void>;

  /** @inheritdoc */
  public endOrphaned(processId: number, isRunning: () => boolean, threadIds: readonly string[], stop: () => Promise<void>): Promise<readonly number[]>;
}

/**
 * Reads which of TeamRun's tools only read, by the read-only hint each one's listing gives, so a provider runs them without asking the person.
 */
export declare class ReadOnlyMcpTools {
  /**
   * The names of the turn's TeamRun tools whose listing marks them `readOnlyHint`; a tool whose annotations are out of shape counts as one that
   * changes things.
   * @param tools The turn's TeamRun tools.
   * @param signal Ends the listing.
   * @returns The read-only tools' names.
   */
  public static listAsync(tools: TurnTools, signal: AbortSignal): Promise<readonly string[]>;
}

/**
 * Reads the names of the tools a turn serves, so an adapter keeps a provider's session only while it still lists the same tools.
 */
export declare class ServedToolNames {
  /**
   * The names of the turn's served tools, sorted.
   * @param tools The turn's TeamRun tools, or `null` for a turn without them.
   * @param signal Ends the listing.
   * @returns The names, or `null` when the turn has no tools or the listing failed.
   */
  public static listAsync(tools: TurnTools | null, signal: AbortSignal): Promise<readonly string[] | null>;
}

/**
 * Starts a shared stdio MCP server through TeamRun's launcher, the same way for every provider: the provider runs `program` with the arguments and
 * environment this gives, and the launcher starts the server with only the basics and the server's own variables.
 */
export declare class SharedMcpLaunch {
  /**
   * The variable that has TeamRun's runtime run the launcher as Node, `ELECTRON_RUN_AS_NODE`.
   */
  public static readonly runAsNodeVariable: string;

  /**
   * The value of `runAsNodeVariable`, `1`.
   */
  public static readonly runAsNodeValue: string;

  /**
   * The program the provider starts, TeamRun's runtime.
   */
  public readonly program: string;

  /**
   * The launcher's script, `launch-shared-mcp-server.js` beside this class.
   */
  public readonly script: string;

  /**
   * @param program The program the provider starts; `process.execPath` by default.
   * @param script The launcher's script; the one beside this class by default.
   */
  public constructor(program?: string, script?: string);

  /**
   * The arguments that start a server: the script, `--variables` with the names joined by commas, `--`, the server's command and its arguments.
   * No value goes into them.
   * @param command The server's command.
   * @param args The server's arguments.
   * @param variables The names of the server's own variables.
   * @returns The arguments.
   */
  public argumentsOf(command: string, args: readonly string[], variables: readonly string[]): string[];

  /**
   * The environment the provider gives the launcher on top of its own: the server's values and `runAsNodeVariable`.
   * @param values The server's own variables and their values.
   * @returns The environment.
   */
  public environmentOf(values: Readonly<Record<string, string>>): Record<string, string>;

  /**
   * Why no provider takes a server that names, in any case, a variable `SharedMcpLauncher` withholds, which is TeamRun's sender token, in its
   * variables, headers or bearer token.
   * @param server The server's definition.
   * @param provider The provider's name, for the reason.
   * @returns The reason, or `null`.
   */
  public refusalOf(server: SharedMcpServerDefinition, provider: string): SharedMcpRefusal | null;
}

/**
 * TeamRun's launcher for shared stdio MCP servers, run as `launch-shared-mcp-server.js --variables <names> -- <command> [arguments...]`.
 * It starts the command with an environment, from its own, of only the basics, `posixBasics` or on Windows `windowsBasics` matched in any case,
 * the named variables and the set `certificateVariables` made absolute, and never `withheldVariables`; passes its input, output and errors
 * through untouched; forwards `SIGTERM`, `SIGINT` and `SIGHUP`; and exits with the server's exit code, 128 and the signal's number when a signal
 * ended it, 1 when it could not start, or 2 for wrong arguments.
 * On Windows a `.cmd` or `.bat` command found through `PATH` and `PATHEXT` runs through `COMSPEC` with arguments it quotes itself and whose
 * metacharacters it escapes twice, as cross-spawn does for npm's shims, since a batch file that passes `%*` on has cmd read them again.
 * So the server ends with it, it first starts a watch, its own script run as `--watch` apart from it and fed by a pipe from it, then the server,
 * and writes the watch, as soon as the server has started, a line of the server's process id and the times around its start. When the pipe
 * ends, however the launcher ended, a watch with that line sends `SIGTERM` to the server's process group, and `SIGKILL` after
 * `graceMilliseconds` if it is still there. Outside Windows the server starts held: `/bin/sh` in a process group of its own waits for a line on
 * its fourth descriptor, which the launcher writes only after the watch's line, and then runs the command in its own place, without the
 * `PWD` and `SHLVL` it sets unless the server names them, or answers on it that the command isn't found, which the launcher reports as Node
 * does; a launcher killed before the watch's line closes that descriptor and the command never starts. On Windows, where ending the launcher
 * ends only the server and leaves what the server started, the watch ends, through one PowerShell run comparing times in UTC, the server if
 * it still runs and each process under it that started no earlier than its parent; when another process holds the server's id, one that started
 * outside those times, it ends nothing. A watch on Windows whose pipe ends without that line ends, the same way, each process its launcher
 * started after it, other than itself and before any later process took the launcher's id, with what those started, and none while the launcher
 * still runs.
 */
export declare class SharedMcpLauncher {
  /**
   * The option before the comma-separated names of the server's own variables, `--variables`.
   */
  public static readonly variablesOption: string;

  /**
   * The option that runs the watch, `--watch`.
   */
  public static readonly watchOption: string;

  /**
   * The argument before the server's command, `--`.
   */
  public static readonly endOfOptions: string;

  /**
   * What separates the names of the server's variables, `,`.
   */
  public static readonly nameSeparator: string;

  /**
   * The variables every server gets outside Windows, from Codex's `DEFAULT_ENV_VARS` in `codex-rs/rmcp-client/src/utils.rs` at `rust-v0.165.0`.
   */
  public static readonly posixBasics: readonly string[];

  /**
   * The variables every server gets on Windows, from Codex's `WINDOWS_CORE_ENV_VARS` in `codex-rs/protocol/src/shell_environment.rs` at
   * `rust-v0.165.0`.
   */
  public static readonly windowsBasics: readonly string[];

  /**
   * The certificate variables every server gets when set and not empty, each made absolute against the launcher's folder and, on Windows, under
   * this spelling in place of any other case, from Codex's `CUSTOM_CA_ENV_KEYS` in `codex-rs/network-proxy/src/certs.rs` at `rust-v0.165.0`,
   * as its `codex-rs/rmcp-client/src/utils.rs` passes them.
   */
  public static readonly certificateVariables: readonly string[];

  /**
   * The variables no server gets, even when named, matched in any case: TeamRun's sender token.
   */
  public static readonly withheldVariables: readonly string[];

  /**
   * The signals the launcher passes on to the server.
   */
  public static readonly forwardedSignals: readonly NodeJS.Signals[];

  /**
   * How long the watch waits after `SIGTERM` before `SIGKILL`, outside Windows, in milliseconds.
   */
  public static readonly graceMilliseconds: number;

  /**
   * @param platform The platform, as `process.platform`.
   * @param environment The launcher's own environment.
   * @param program The program that runs the watch, as `process.execPath`.
   * @param script The launcher's script.
   * @param host The launcher's own process; `process` by default.
   * @param start Starts a process; `spawn` by default.
   * @param isFile Whether a path is a file; by default, whether it exists and is one.
   * @param delayAsync Waits a number of milliseconds; `setTimeout` of `node:timers/promises` by default.
   */
  public constructor(platform: string, environment: NodeJS.ProcessEnv, program: string, script: string, host?: ISharedMcpLauncherHost,
    start?: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess, isFile?: (file: string) => boolean,
    delayAsync?: (milliseconds: number) => Promise<unknown>);

  /**
   * Runs the launcher or, after `watchOption`, the watch, and exits through the host; wrong arguments write their usage to the errors and exit
   * with 2. Does nothing when the script was loaded but not run, so that loading it starts nothing.
   * @param main Whether the script is the program's entry, as `import.meta.main`.
   * @param args The arguments after the script.
   * @returns A promise that settles once it has exited.
   */
  public runAsync(main: boolean, args: readonly string[]): Promise<void>;

  /**
   * Whether a variable is one of `withheldVariables`, in any case.
   * @param name The variable's name.
   * @returns Whether no server gets it.
   */
  public static withholds(name: string): boolean;

  /**
   * The server's environment: each variable of the launcher's own whose name is a basic or one of `names`, matched in any case on Windows, and
   * each set `certificateVariables` made absolute, but none of `withheldVariables`.
   * @param names The server's own variables.
   * @returns The environment.
   */
  public environmentOf(names: readonly string[]): Record<string, string>;

  /**
   * What starts a command: itself outside Windows; on Windows the file found through the environment's `PATH` and `PATHEXT`, or, for a `.cmd` or
   * `.bat` file, `COMSPEC` (`cmd.exe` when unset) with `/d /s /c` and the quoted, escaped line, started with verbatim arguments.
   * @param command The command.
   * @param args Its arguments.
   * @param environment The environment it is found in.
   * @returns The program, its arguments and whether they go to it verbatim.
   */
  public commandOf(command: string, args: readonly string[], environment: Readonly<Record<string, string>>): { command: string; args: string[]; verbatim: boolean };
}

/**
 * A program an `IProcessStarter` started, shaped like a child process and like the Agent SDK's `SpawnedProcess`.
 * Its streams take and give data before the program has started, and pass it on once it has.
 * It emits `spawn` when the program has started, `error` when it could not start, `exit` with the exit code and
 * signal when it ended, and `close` with them once its output has been read to the end.
 */
export declare class StartedProcess extends EventEmitter {
  /**
   * The program's input. An error of the program's own input, such as EPIPE on a write or an end after the program closed it, destroys it with
   * that error, and its `error` event always has a listener, so that the error never ends TeamRun's process; a consumer that acts on it listens
   * too.
   */
  public readonly stdin: PassThrough;

  /**
   * The program's output.
   */
  public readonly stdout: PassThrough;

  /**
   * The program's error output.
   */
  public readonly stderr: PassThrough;

  /**
   * The program's process id, once it has started.
   */
  public get pid(): number | undefined;

  /**
   * The program's exit code, once it has ended with one.
   */
  public get exitCode(): number | null;

  /**
   * The signal that ended the program, once one has.
   */
  public get signalCode(): NodeJS.Signals | null;

  /**
   * Whether `kill` was called.
   */
  public get killed(): boolean;

  /**
   * Whether the program has ended.
   */
  public get hasExited(): boolean;

  /**
   * Connects the started program, emitting `spawn`; a stop asked for before it started happens now.
   * @param processId The program's process id.
   * @param input The program's input.
   * @param output The program's output.
   * @param errors The program's error output.
   * @param stop Stops the program.
   */
  public attach(processId: number, input: Writable, output: Readable, errors: Readable, stop: () => Promise<void>): void;

  /**
   * Reports that the program could not start, or failed after it did, emitting `error`; a start that failed is ended
   * with {@link StartedProcess.end} next, as Node.js closes a child after a spawn error. Unlike Node.js's own spawn error,
   * that also emits `exit` with no exit code, which nothing in TeamRun listens for.
   * @param error Why.
   */
  public fail(error: Error): void;

  /**
   * Reports that the program ended, emitting `exit`, then `close` once its output has been read to the end.
   * @param code The exit code, or `null` when a signal ended it or it never started.
   * @param signal The signal that ended it, or `null`.
   */
  public end(code: number | null, signal: NodeJS.Signals | null): void;

  /**
   * Stops the program without waiting; the starter decides how it ends, whatever the signal.
   * @param signal The signal the caller asked for.
   * @returns `true`.
   */
  public kill(signal?: NodeJS.Signals): boolean;

  /**
   * Stops the program, once it has started; a program that has ended is left alone.
   * @returns When the program has been asked to stop.
   */
  public stopAsync(): Promise<void>;
}

/**
 * Builds a turn's Claude user message: its text alone as plain content, so a slash command such as `/compact` stays a command; with images, a text
 * block followed by native image blocks.
 */
export declare class ClaudePrompt {
  /**
   * Builds the message, reading image bytes before the query starts so a filesystem failure starts no process.
   * @param request Turn with durable attachment paths.
   * @param text The prompt's text: the request's prompt, or its fresh prompt when a failed resume starts a fresh session.
   * @param uuid The message's uuid, which Claude Code stamps on the reply's frames.
   * @returns The message.
   * @throws Error when an image cannot be read.
   */
  public static create(request: TurnRequest, text: string, uuid: import("node:crypto").UUID): SDKUserMessage;

  /**
   * Builds a message from its text and files, reading its images' bytes.
   * @param text The message's text.
   * @param attachments The message's files; only its images go in the message.
   * @param uuid The message's uuid.
   * @returns The message.
   * @throws Error when an image cannot be read.
   */
  public static of(text: string, attachments: readonly MessageAttachment[], uuid: import("node:crypto").UUID): SDKUserMessage;
}

/**
 * Reads the plan of Grok's `x.ai/exit_plan_mode` request, from its `ExitPlanMode` tool, and writes its answer, as Grok's request types define them.
 */
export declare class GrokPlanReader implements IAcpPlanReader {
  /** `_x.ai/exit_plan_mode` and `x.ai/exit_plan_mode`. */
  public readonly methods: readonly string[];
  /** `exit_plan_mode`. */
  public readonly nativeKind: string;
  /** `true`: Grok leaves its plan mode for Default on `approved` and goes on with the same turn. */
  public readonly leavesPlan: boolean;
  /**
   * The request's `planContent` as the plan text, with no steps, since Grok's checklist comes through ACP's `plan` updates; `null` when Grok
   * found no plan file, so the plan is dismissed and Grok keeps planning.
   */
  public read(params: JsonReader): { readonly text: string; readonly steps: readonly PlanStep[] } | null;

  /**
   * The answer to send: `approved` for an approved plan, and `cancelled`, which Grok takes as keep planning, for a refused or dismissed one.
   */
  public reply(params: JsonReader, approved: boolean | null): JsonObject;
}

/**
 * Reads the questions of Grok's `x.ai/ask_user_question` request and writes its answer. Each question is identified by its text, as Grok keys its answers.
 */
export declare class GrokQuestionReader implements IAcpQuestionReader {
  /** Grok's `_x.ai/ask_user_question` and `x.ai/ask_user_question`. */
  public readonly methods: readonly string[];
  /** `ask_user_question`. */
  public readonly nativeKind: string;
  /** Always `true`: every request of its methods is a question. */
  public claims(): boolean;
  /**
   * The request's questions, each with its options and the person's own words allowed, or `null` when there is none or one doesn't read,
   * such as an option without a label or two questions with the same text.
   */
  public read(params: JsonReader): readonly ApprovalQuestion[] | null;

  /**
   * The answer to send: `accepted` with each answered question's chosen labels, or "Other" when the person only wrote, and the person's own words
   * as that question's notes; `cancelled` for `null`, a question the person dismissed or that was stopped.
   */
  public reply(params: JsonReader, answers: readonly QuestionAnswer[] | null): JsonObject;
}

/**
 * The `GROK_HOME` a launch names, which keeps Grok's saved images within Windows' limit on a path.
 */
export declare class GrokShortHome {
  /**
   * @param platform The platform, as `process.platform` names it.
   * @param link Makes the junction; Node's by default.
   * @param makeFolder Makes the folder that holds the junctions; `GrokShortHome.makeFolder` by default.
   */
  public constructor(platform?: string, link?: (target: string, path: string) => void, makeFolder?: (path: string) => void);

  /**
   * Makes the folder that holds the junctions, and its parents, if missing; another process making it at the same time is no failure, and it is
   * never removed.
   */
  public static makeFolder(path: string): void;

  /**
   * The folder Grok saves a session's images in, by the layout it uses: the home, `sessions`, the percent-encoded chat folder, the session id and `images`.
   */
  public static imagesFolderOf(home: string, workingDirectory: string): string;

  /**
   * What to name as `GROK_HOME`: on Windows, when the images folder would pass `Resources.grokImagesFolderLimit`, a short junction to the home under `LOCALAPPDATA`;
   * otherwise, or when `LOCALAPPDATA` doesn't exist, the junction's path is no shorter than the home's or the junction can't be made, the home itself, leaving at most the folder that holds the junctions.
   */
  public of(home: string, workingDirectory: string | null, environment: NodeJS.ProcessEnv): string;
}

/**
 * The Grok home a provider runs in: the person's own, `GROK_HOME`, else `.grok` in their home, for a provider with no folder or whose folder
 * is the one TeamRun once made for Grok, which stays untouched; else the provider's own folder.
 */
export declare class GrokHome {
  /**
   * The person's own Grok home, as the environment TeamRun started from names it.
   */
  public readonly directory: string;

  /**
   * The Grok home every title session runs in: `Resources.grokTitleHomeFolder` beside the former profile folder, which holds none of the
   * person's instructions, memory, configuration or MCP servers.
   */
  public readonly titleDirectory: string;

  /**
   * @param environment The environment TeamRun started from, which names `GROK_HOME` and the person's home.
   * @param formerProfileDirectory The folder TeamRun once made for Grok as its default profile.
   * @param homeDirectory The person's home; `HOME`, or `USERPROFILE` on Windows, by default.
   */
  public constructor(environment: NodeJS.ProcessEnv, formerProfileDirectory: string, homeDirectory?: string);

  /**
   * @param environment The environment a launch is built from, which names the person's Grok home from then on; the latest such, else the one
   * TeamRun started from, by default.
   * @returns The provider's Grok home.
   */
  public of(provider: Provider | null, environment?: NodeJS.ProcessEnv | null): string;

  /**
   * @returns Whether the provider runs in a home of its own rather than the person's.
   */
  public isAdded(provider: Provider | null): boolean;
}

/**
 * Reads the image Grok Build's image tool saved: a completed call whose raw output is an ImageGen or ImageEdit with an absolute path.
 * The path's real place, with links followed, must be `<n>.<jpg|jpeg|png|webp>` in the `images` folder of the session's own folder under the
 * provider's Grok home's `sessions` folder, a file no larger than the image limit whose bytes are an image; a path with a `.` or `..` segment
 * is refused.
 */
export declare class GrokImageReader implements ISavedImageReader {
  /**
   * @param home Where each provider's Grok home is.
   */
  public constructor(home: GrokHome);

  public read(tool: JsonReader, sessionId: string, provider: Provider | null): SavedImage | null;

  /**
   * Takes a failed tool call whose raw input's `variant` is one of `Resources.grokImageOutputTypes`, as Grok's `image_gen` sends, and returns the
   * `error` and `message` strings of its raw output, each cut to `Resources.maximumSummaryLength` with `Resources.ellipsis`, and nothing else.
   */
  public failureOf(tool: JsonReader): JsonObject | null;
}

/**
 * Tells whether Gemini CLI, launched with an environment, in a folder and with its arguments, treats the folder as untrusted and so connects
 * no MCP server in it, by Gemini CLI's own rules (0.67), reading its files and never writing them:
 * - `GEMINI_RESTRICTED_MODE=true` or `GEMINI_CLI_TRUST_WORKSPACE=false` makes any folder untrusted, and `GEMINI_CLI_TRUST_WORKSPACE=true` or
 *   `--skip-trust` makes it trusted;
 * - otherwise folder trust is on unless `security.folderTrust.enabled` is `false` in the merged system defaults, user and system settings, the
 *   later winning;
 * - with it on, the entry of `trustedFolders.json` that holds the folder and is longest as written decides, a `TRUST_PARENT` entry holding
 *   the parent of its path as written, before links resolve:
 *   `DO_NOT_TRUST`, or no entry at all, makes the folder untrusted.
 * The files are where Gemini CLI reads them: under `GEMINI_CLI_HOME` or the home folder, or where `GEMINI_CLI_SYSTEM_SETTINGS_PATH`,
 * `GEMINI_CLI_SYSTEM_DEFAULTS_PATH` and `GEMINI_CLI_TRUSTED_FOLDERS_PATH` name them; paths compare after resolving links, ignoring case on
 * Windows and macOS. Whenever it can't be sure, it says trusted: a settings or trust file it can't parse (Gemini CLI also strips comments), a
 * trust level it doesn't know, or `ide.enabled` on, since a connected IDE then gives the trust.
 */
export declare class GeminiFolderTrust {
  /**
   * @param environment The environment Gemini CLI runs with.
   * @param folder The folder Gemini CLI runs in.
   * @param args Gemini CLI's arguments.
   * @param platform The platform whose paths and system settings apply.
   * @returns `true` only when the folder is surely untrusted.
   */
  public static isUntrusted(environment: NodeJS.ProcessEnv, folder: string, args?: readonly string[], platform?: string): boolean;
}

/**
 * Reads which MCP servers Grok blocked from the newest entries of the Grok home's `logs/unified.jsonl`: for each server, the latest
 * "MCP server blocked by managed settings policy" entry since a time, with its reason cleaned of control characters and shortened to the
 * summary limit. A missing or unreadable log, or none such entry, gives none.
 */
export declare class GrokMcpBlockReader {
  /**
   * @param profileDirectory The Grok home, `GROK_HOME`.
   * @param since An ISO 8601 time; entries before it don't count.
   * @returns Each blocked server's reason, by the server's name.
   */
  public static read(profileDirectory: string, since: string): ReadonlyMap<string, string>;
}

/**
 * Builds the environment of a Grok process, which runs with the person's own Grok settings.
 */
export declare class GrokEnvironment {
  /**
   * Copies the environment without other providers' variables, names the Grok home in `GROK_HOME`, and keeps folder trust on
   * (`GROK_FOLDER_TRUST=1`), so a project's own Grok settings apply only in a folder the person trusted.
   * @param base The environment TeamRun started from.
   * @param home The provider's Grok home.
   * @param added Whether the home is the provider's own rather than the person's, which leaves out Grok's and xAI's key and token
   * variables, so the provider uses its own sign-in.
   * @param background Whether the launch is outside a chat turn, such as a sign-in check or a model list, which turns Grok's memory
   * off through `GROK_MEMORY=0`.
   * @param titleSignIn For a title session, which runs in TeamRun's own title home, the sign-in file of the provider's Grok home, named
   * in `GROK_AUTH_PATH`; the person's `GROK_CONFIG` and `GROK_CONFIG_PATH` are left out and each of `Resources.grokTitleOffVariables`
   * is `0`, so the session reads none of the person's memory, rules, skills, agents, MCP servers or hooks. `null` for any other launch.
   */
  public static build(base: NodeJS.ProcessEnv, home: string, added: boolean, background: boolean, titleSignIn?: string | null): NodeJS.ProcessEnv;
}

/**
 * Receives ACP notifications, reverse requests, and unexpected process exit.
 */
export interface IAcpClientListener {
  /**
   * Ends prompt event delivery before the response promise resolves; the client runs it in arrival order after the notifications before it.
   * @param method The request whose response came.
   * @param result The response's result when it is an object, else `null`.
   */
  onResponseAsync(method: string, result: JsonReader | null): Promise<void>;

  /**
   * Handles one agent notification; the client runs each one after the one before it has settled, and a rejection abandons the connection.
   */
  onNotificationAsync(method: string, params: JsonReader): Promise<void>;

  /**
   * Handles a reverse request with its observed native id. Rejections produce a protocol error: an `AcpRequestException` with a code is answered
   * with its code and message, and any other rejection as an unsupported request.
   */
  onRequest(id: string, method: string, params: JsonReader): Promise<JsonValue>;

  /**
   * Handles an unexpected exit, once the client has ended what the agent left running, when it has a process tree.
   */
  onExitAsync(): Promise<void>;
}

/**
 * Bounded JSON-RPC over a native ACP agent stdin/stdout.
 */
export declare class AcpClient {
  /**
   * The folder the process starts in.
   */
  public readonly directory: string;

  /**
   * Creates a single-use client with explicit launch environment and process ownership; its stop waits on the timer, by default `NodeTimer`.
   * Messages are framed as `framing` says, one per line by default. With `tree`, its stop ends what the agent started too.
   */
  public constructor(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string, starter: IProcessStarter, timings: ProviderTimings, timer?: ITimer,
    framing?: MessageFraming, tree?: IProcessTree | null);

  /**
   * Starts the process; a second start throws.
   */
  public start(): void;

  /**
   * The agent process's id, or `null` before it started.
   */
  public get processId(): number | null;

  /**
   * Whether the process runs and takes requests: started, not stopping or exited, and its input still open.
   */
  public get isConnected(): boolean;

  /**
   * Whether TeamRun has begun to stop the process.
   */
  public get isStopping(): boolean;

  /**
   * Settles once the agent's process has closed.
   */
  public get processClosed(): Promise<void>;

  /**
   * Sets or removes the active session listener.
   */
  public setListener(listener: IAcpClientListener | null): void;

  /**
   * Settles once the listener has handled every notification, response and exit received so far, in arrival order; never rejects, since a
   * listener's failure abandons the connection instead.
   */
  public whenHandledAsync(): Promise<void>;

  /**
   * Sends a request; null timeout is reserved for a turn whose lifetime is explicitly cancelled/stopped. Once its response arrives, it settles after the
   * listener has handled what arrived before it, and a timeout, a stop or the agent's exit after that arrival no longer fails it.
   */
  public request(method: string, params: JsonObject, timeout?: number | null): Promise<JsonValue>;

  /**
   * Sends a notification when connected.
   */
  public notify(method: string, params: JsonObject): void;

  /**
   * Closes stdin, terminates after a grace period, and bounds the final exit wait. With a tree, once it has sent the agent a prompt or opened a
   * session with MCP servers, so not for a sign-in check, a model list or a probe, which start no tools, while the agent still runs it first ends every
   * process under it, through {@link IProcessTree.endDescendants}, and once the agent has exited, also when it exited before the stop, it ends what
   * it left, through {@link IProcessTree.endLeftovers}, bounded by the time the agent exited rather than the later close of its output, so nothing the agent started runs on; each of the two waits at most `killWait`, and a
   * failure to list counts as nothing to end. When the agent exits by itself, the client ends what it left before it tells its listener, and a
   * later stop waits for that instead of listing again. A stop after another waits for it, and stops again only when that one failed.
   */
  public stop(): Promise<void>;
}

/**
 * Grok CLI integration: the shared ACP adapter running `GrokAgent` in the person's own Grok home, or a provider's own.
 */
export declare class GrokAdapter extends AcpAdapter {
  /**
   * Creates the adapter; its ACP clients' stops wait on the timer, by default `NodeTimer`, and its session lines, such as a prompt sent
   * before TeamRun's tools were listed, go to the log, by default none.
   * @param formerProfileDirectory The folder TeamRun once made for Grok, which `GrokHome` reads as the person's own home.
   * @param installation How TeamRun installs and updates Grok, kept as `installation`; none by default.
   * @param idleTimer Tells the time a kept session has had no turn, as `AcpAdapter` takes it; a `NodeTimer` by default.
   */
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, formerProfileDirectory: string, clientInfo: AppServerClientInfo, starter: IProcessStarter, timings: ProviderTimings, timer?: ITimer,
    processTree?: IProcessTree, locate?: () => ProcessCommand | null, log?: ILog | null, installation?: IProviderKindInstallation | null, idleTimer?: ITimer);

  /**
   * How TeamRun installs and updates Grok, when it was given one.
   */
  public readonly installation?: IProviderKindInstallation;
}

/**
 * Where the person's own OpenCode keeps its data: the `XDG_DATA_HOME` their environment names, or `~/.local/share` on every system. A provider
 * with no folder, in the folder TeamRun once made for OpenCode, or in that one runs there; a provider in another folder keeps its own sign-in there.
 */
export declare class OpencodeDataFolder {
  /** The person's folder when the adapter was made. */
  public readonly directory: string;

  /**
   * @param formerProfileDirectory The folder TeamRun once made for OpenCode's first provider, which now means the person's own.
   */
  public constructor(environment: NodeJS.ProcessEnv, formerProfileDirectory: string, homeDirectory?: string);

  /**
   * The folder a provider's OpenCode runs with.
   * @param environment The launch's environment, which names the person's folder from then on; `null` keeps the last.
   */
  public of(provider: Provider | null, environment?: NodeJS.ProcessEnv | null): string;

  /** Whether the provider keeps a sign-in of its own, in a folder other than the person's. */
  public isAdded(provider: Provider | null): boolean;
}

/**
 * The environment of the person's own OpenCode. Everything is theirs, but for four things: `XDG_DATA_HOME` when the provider names another folder,
 * TeamRun's approval rules on the agents a chat runs in, in `OPENCODE_CONFIG_CONTENT`, and its refusals in `OPENCODE_PERMISSION`, which OpenCode merges over
 * every configuration it read, and on its built-in sub-agents in that content, since an agent's own rules come after `OPENCODE_PERMISSION`; and, outside a chat
 * turn, `OPENCODE_PURE`, so OpenCode loads none of the person's plugins.
 */
export declare class OpencodeEnvironment {
  /**
   * Builds it, for a launch.
   * @param base The person's environment; `GIT_CONFIG*`, `GIT_ASKPASS` and `SSH_ASKPASS` stay out.
   * @param dataFolder The folder for `XDG_DATA_HOME`.
   * @param added Whether the folder is one of the provider's own, whose launches also leave out keys and tokens, so that it uses its own sign-in.
   * @param mode The chat's mode: Plan denies edits, and Allow All allows every tool.
   * @param approvedTools The TeamRun tools the person isn't asked about; a name that isn't a tool's is left out.
   * @param ownTools Whether the provider's own MCP servers are on, its switch: off, the agents refuse every tool TeamRun doesn't know, such as those servers' and
   * the person's custom tools; on, a chat's agents ask for them and the built-in sub-agents refuse them. The person's own `OPENCODE_PERMISSION` stays under
   * TeamRun's rules, after its rule for every tool, so a rule of theirs for a tool TeamRun doesn't name still applies; its `read` rules, and those of their own
   * `OPENCODE_CONFIG_CONTENT`, also go into the built-in agents' rules after TeamRun's rule for every file, so they apply there too.
   * @param serversOff The MCP servers to turn off, by name, for a launch outside a chat turn, or `null` to leave them: each of them, and each server the person's own
   * `OPENCODE_CONFIG_CONTENT` names, gets `enabled: false` there, beside its other fields; given, the launch also gets `OPENCODE_PURE` set to `1`.
   */
  public static build(base: NodeJS.ProcessEnv, dataFolder: string, added: boolean, mode?: string | null, approvedTools?: readonly string[], ownTools?: boolean,
    serversOff?: readonly string[] | null): NodeJS.ProcessEnv;
}

/**
 * The MCP servers the person's OpenCode configuration files name, which a launch outside a chat turn turns off by name.
 */
export declare class OpencodeMcpServers {
  /**
   * Lists the files OpenCode 1.19.5 reads its configuration from, in its order: the global folder's, `OPENCODE_CONFIG`, the project's up to the
   * repository root unless `OPENCODE_DISABLE_PROJECT_CONFIG` is set, `~/.opencode`'s, `OPENCODE_CONFIG_DIR`'s and the managed folder's, with a relative path
   * resolved against the launch's folder as OpenCode resolves it.
   * @param environment The launch's environment.
   * @param directory The launch's folder.
   * @param platform The system, which names the managed folder: `/Library/Application Support/opencode` on macOS, `opencode` under `ProgramData` on Windows
   * and `/etc/opencode` elsewhere, unless `OPENCODE_TEST_MANAGED_CONFIG_DIR` names another.
   */
  public static files(environment: NodeJS.ProcessEnv, directory: string, platform?: string): readonly string[];
  /**
   * Reads the server names under `mcp` in each of those files that exists, as JSON with comments and trailing commas, unique and sorted.
   * @throws Error naming the file when one exists but can't be read or parsed, or is larger than `maximumConfigurationBytes`.
   */
  public static names(environment: NodeJS.ProcessEnv, directory: string, platform?: string): readonly string[];
}

/**
 * OpenCode integration: the shared ACP adapter running `OpencodeAgent`, in the person's own setup.
 */
/**
 * Muse Code as `muse acp`, which TeamRun opens with `MUSE_EXPERIMENTAL_ACP=on` for its own runs only. A sign-in check or a model listing adds `--no-session-log`,
 * so it leaves no session behind. The profile is the folder `XDG_CONFIG_HOME` names, and the person signs in and out with `muse login` and `muse logout` in a terminal.
 */
export declare class MuseAgent extends GeneralAcpAgent {
  public override readonly descriptor: ProviderKind;
  public override readonly logsOut: boolean;
  public override readonly compacts: boolean;
  public override readonly sharedServerTransports: readonly SharedMcpTransport[];

  /**
   * @param command The `muse` to run, without `acp`, or `null` when none was found.
   * @param environment The environment to copy for a run, without the person's credentials.
   * @param homeDirectory The folder a run with no chat folder starts in.
   * @param locate Finds `muse` again for a launch when `command` is `null`.
   * @param platform The platform, by default this computer's; on macOS the kind's `singleAccount` is `Resources.museOneAccountPerMac`, since Muse Code
   * keeps its sign-in in the keychain every profile shares.
   */
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, homeDirectory: string, locate?: () => ProcessCommand | null,
    platform?: string);

  public override launch(provider: Provider | null, requested: RequestedSettings | null, workingDirectory?: string | null, approvedTools?: readonly string[] | null,
    environment?: NodeJS.ProcessEnv): AcpLaunch;

  /** Lists the servers in `muse/settings.json` under the `XDG_CONFIG_HOME` Muse Code runs with; rejects a `schema_version` other than 1. */
  public listOwnMcpServers(provider: Provider | null): Promise<readonly OwnMcpServer[]>;
  public override formatSignIn(provider: Provider | null): string;

  /**
   * Whether a refusal is Muse Code's own for a person who isn't signed in, `Resources.museSignedOutRefusal` in any case, whatever its code, since Muse Code's
   * ACP guide gives only that text.
   */
  public isSignedOutRefusal(code: number | null, message: string): boolean;
}

/**
 * Runs Muse Code's chats through `MuseAgent` and the shared ACP client.
 */
export declare class MuseAdapter extends AcpAdapter {
  /**
   * @param command The `muse` to run, or `null` when none was found.
   * @param environment The environment to copy for a run.
   * @param homeDirectory The folder a run with no chat folder starts in.
   * @param clientInfo How TeamRun names itself to Muse Code.
   * @param starter Starts `muse`.
   * @param timings The time limits.
   * @param locate Finds `muse` again once it was installed.
   * @param timer Waits for a stop, by default `NodeTimer`.
   * @param log Takes the session lines, by default none.
   * @param platform The platform, by default this computer's.
   */
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, homeDirectory: string, clientInfo: AppServerClientInfo, starter: IProcessStarter,
    timings: ProviderTimings, locate?: () => ProcessCommand | null, timer?: ITimer, log?: ILog | null, platform?: string);
}

export declare class OpencodeAdapter extends AcpAdapter {
  /**
   * Creates the adapter; its ACP clients' stops wait on the timer, by default `NodeTimer`, and its session lines go to the log, by default none.
   * @param formerProfileDirectory The folder TeamRun once made for OpenCode's first provider, which now means the person's own.
   */
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, formerProfileDirectory: string, clientInfo: AppServerClientInfo, starter: IProcessStarter,
    timings: ProviderTimings, timer?: ITimer, processTree?: IProcessTree, locate?: () => ProcessCommand | null, log?: ILog | null);
}

/**
 * Pi integration through the person's own `pi --mode rpc`: one Pi for each turn, list or fork, in the chat's folder, with the profile folder as
 * `PI_CODING_AGENT_DIR` so the sessions stay in the person's own Pi sessions. TeamRun installs none of Pi's packages.
 */
export declare class PiAdapter implements IProviderAdapter {
  public readonly descriptor: ProviderKind;
  /** Folders holding Pi's `auth.json`. */
  public readonly profileSearch: ProfileSearch;
  /** Ask first, Read only and Allow all, which TeamRun's approvals extension keeps. */
  public readonly modes: readonly ProviderMode[];
  /** Ask first. */
  public readonly defaultMode: string;
  /** Read only. */
  public readonly explorerMode: string;
  /** `null`: Pi has no plan mode. */
  public readonly planMode: string | null;
  /** `true`: TeamRun's extension adds TeamRun's MCP server to a turn's Pi through `pi.registerMcpServer`, with the turn's tools token. */
  public readonly takesTeamRunTools: boolean;
  /** `null`: Pi has no sub-agents of its own. */
  public readonly backgroundSubAgentsNote: string | null;

  /**
   * Creates the adapter.
   * @param command The `pi` command, or `null` when none was found.
   * @param extensionDirectory Where TeamRun writes the approvals extension it passes to Pi with `--extension`.
   * @param runner Runs `pi auth check`.
   * @param versionReader Reads `pi --version` for the minimum version.
   * @param locate Finds `pi` again while it is missing; none by default.
   * @param promptTimeout How long Pi may take to answer a prompt, which it does only after any compaction that must run first; `Resources.piCompactTimeout` by default.
   * @param idleTimer Tells the time a kept session has had no turn, for `timings.idleLimit`; a `NodeTimer` by default.
   */
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, extensionDirectory: string, starter: IProcessStarter, runner: CommandRunner,
    timings: ProviderTimings, versionReader: ExecutableVersionReader, locate?: () => ProcessCommand | null, promptTimeout?: number, idleTimer?: ITimer);

  /**
   * Pi's sign-in command through the copy its turns run, with nothing started (`TerminalSignIn.of`).
   */
  public readSignInCommand(provider: Provider): Promise<ProviderSignInCommand | null>;

  /**
   * An error without `pi` or with a Pi older than the minimum, naming both versions; signed out with "choose a model in Pi" when the profile's
   * `settings.json` names no `defaultProvider`; otherwise what `pi auth check --provider <defaultProvider> --json` says by its exit code: 0 signed in,
   * 1 signed out, anything else an error.
   */
  public checkSignIn(provider: Provider): Promise<SignInCheck>;

  /** Lists the servers in `mcp.json` in the profile's `PI_CODING_AGENT_DIR`, or Pi's usual folder without a provider. */
  public listOwnMcpServers(provider: Provider | null): Promise<readonly OwnMcpServer[]>;
  /** Rejects: Pi signs in with `/login` in `pi`, which the window opens in a terminal. */
  public signIn(provider: Provider, signal: AbortSignal): Promise<void>;

  /**
   * Pi's `get_available_models` as `provider/id` models, kept for each profile folder until `refresh`; a reasoning model takes the thinking levels
   * off to high, and Pi's current model is the default.
   */
  public listModels(provider: Provider | null, refresh?: boolean): Promise<ProviderModelList>;

  /**
   * Runs an isolated turn, a chat's title or a handover summary: a Pi started with `--no-session`, `--no-tools` and `--no-extensions`, keeping only Pi's built-in
   * llama.cpp provider with `--extension builtin:llama.cpp`, with the person's MCP servers, skills, context files, prompt templates and themes off,
   * that saves no session and closes when the answer comes. A model whose provider only a person's extension adds can't be set, so the turn fails
   * and the chat takes the next model's title.
   * @param request The isolated turn.
   * @param listener Hears the turn.
   * @param signal Aborts the question.
   * @returns The turn's result.
   */
  public askIsolated(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult | null>;

  /**
   * Runs one turn: starts Pi with the approvals extension and, to resume, `--session` with the session file; sets the model and thinking level;
   * sends the prompt with its images, or `compact` for a compaction; follows the events to `agent_settled`; and reports the turn's usage with the
   * session's context. The native session id is the session file, and the native turn id the turn's user message entry. An isolated turn starts Pi
   * with `--no-session`, `--no-tools`, `--no-extensions` but Pi's built-in llama.cpp provider, and the person's setup off instead, its native session id is Pi's session id, and its Pi isn't kept.
   * A `/` command sent without files goes as its text alone, without the role or the chat so far, only when `get_commands` lists it; any other goes inside the prompt,
   * as any message does. After a command on a new session, the next turn on it sends the whole chat once.
   */
  public runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult>;

  /**
   * Stops the Pi kept for each of these session files now, and a Pi running a turn on one once that turn ends, in place of keeping it.
   * @param nativeSessionIds The deleted chat's session files.
   * @returns Once the kept Pis stopped; rejected when one fails to stop.
   */
  public closeSessions(nativeSessionIds: readonly string[]): Promise<void>;

  /**
   * Forks after the turn: `fork` at the next user message, or `clone` when the turn was the last, and answers the new session file.
   */
  public forkSession(request: ForkRequest): Promise<ForkedSession>;

  /**
   * Why a shared MCP server stays off in Pi chats, or `null`: TeamRun's extension adds each one with `pi.registerMcpServer`, so only one that
   * reads a variable TeamRun's launcher withholds, or a `TEAMRUN_PI_` variable of TeamRun's extension, stays off.
   */
  public sharedServerUnavailable(server: SharedMcpServerDefinition): SharedMcpRefusal | null;

  /** The name Pi knows a shared MCP server by: Pi names its tools with each `-` as `_`, so `my-api` and `my_api` are one server to it. */
  public sharedServerNamespaceOf(name: string): string;

  /** Why a shared MCP server with saved secrets stays off in Pi chats: Pi reads its values from its own environment, which its commands also see. */
  public savedSecretsUnavailable(): SharedMcpRefusal;

  /** Stops every Pi it started. */
  public shutdown(): Promise<void>;
}

/**
 * Pi's RPC mode over a child process: JSON records split on LF only, so a U+2028 inside a string stays in its record; commands carry an id their
 * response repeats, and every other record is an event.
 */
export declare class PiRpcClient {
  /**
   * Creates the client.
   * @param directory The folder Pi starts in, or `null` for the current one.
   * @param stopGrace How long `stop` waits after closing stdin before it ends the process.
   */
  public constructor(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string | null, starter: IProcessStarter, stopGrace: number);

  /** Whether Pi has started and not exited. */
  public get isAlive(): boolean;

  /** The end of what Pi wrote to stderr. */
  public get stderr(): string;

  /** How many records the event handler threw on, or returned a promise for that rejected; the client goes on reading after each. */
  public get handlerFailureCount(): number;

  /** Resolves when Pi exits. */
  public waitForExit(): Promise<ProcessExit>;

  /**
   * Starts Pi.
   * @param onEvent Takes each record that answers no command, or `null` to drop them; it may return a promise of the record's work.
   * @throws {PiRpcException} When it has started already.
   */
  public start(onEvent: ((event: JsonReader) => Promise<void> | void) | null): void;

  /**
   * Passes Pi's later events to another handler, such as the next turn of a kept session.
   * @param onEvent Receives each event, or `null` to cancel Pi's dialogs while no turn runs; it may return a promise of the event's work.
   */
  public listen(onEvent: ((event: JsonReader) => Promise<void> | void) | null): void;

  /**
   * Sends a command and resolves with its response's `data`, `{}` without one.
   * @throws {PiRpcException} When Pi isn't running, refuses the command, exits first or doesn't answer within the timeout.
   */
  public request(type: string, fields: JsonObject, timeoutMilliseconds: number): Promise<JsonReader>;

  /** Writes one record, such as an `extension_ui_response`, while Pi runs. */
  public send(message: JsonObject): void;

  /** Closes stdin, which shuts Pi down, and ends the process when it outlives the grace. */
  public stop(): Promise<void>;
}

/**
 * One Pi turn's events: text and thinking as streamed details, tools as details with their output, notes for compaction, retries and extension
 * failures, approvals for the approvals extension's confirms, and usage from each assistant message.
 */
export declare class PiTurn {
  /**
   * Creates the turn.
   * @param reply Writes an `extension_ui_response` to Pi.
   * @param approvedTools TeamRun's tools the person approved, whose confirms the turn answers without asking.
   */
  public constructor(listener: ITurnListener, stream: DeltaStream, reply: (message: JsonObject) => void, approvedTools?: readonly string[]);

  /** How the turn ended, or `null` while it runs. */
  public get outcome(): TurnOutcome | null;

  /** Why a failed turn failed, or `null`. */
  public get error(): string | null;

  /** Whether an assistant message reported usage. */
  public get hasUsage(): boolean;

  /** Resolves when the turn settles. */
  public waitForSettled(): Promise<void>;

  /**
   * Ends the turn once, after the events taken before, refusing the approvals still open; a failure without its own error gets "Pi ended the turn
   * without a result".
   */
  public settle(outcome: TurnOutcome, error?: string | null): void;

  /**
   * Waits until every event taken so far, and the work they queued, has been handled. A failed event fails only the promise `handle` returned for it.
   * @throws The first failure, since the last call, of a report of pending text that `settle` or `finishAsync` queued; the work after it was still done.
   */
  public drainAsync(): Promise<void>;

  /**
   * Reports the text still pending, after the events taken so far, then waits as `drainAsync` does.
   * @throws As `drainAsync` does.
   */
  public finishAsync(): Promise<void>;

  /** The turn's tokens and cost, with the session's context. */
  public usage(context: ContextUsage | null): ReplyUsage;

  /**
   * Takes one event and queues it after the events taken before; each event, its listener calls included, ends before the next starts.
   * @returns When the event has been handled; it rejects when the listener failed on the event and on the note of that failure, and the events
   * after it are still handled.
   */
  public handle(event: JsonReader): Promise<void>;
}

/**
 * Reads what `cursor-agent about` prints: its `CLI Version`, `Subscription Tier` and `User Email` lines.
 */
export declare class CursorAboutReader {
  /**
   * The check with the version from `CLI Version` and an identity of the email and plan, or the check's own version and identity where
   * `about` names none.
   */
  public static read(text: string, check: SignInCheck): SignInCheck;
}

/**
 * Reads the image file Cursor's `cursor/generate_image` notification names in its `filePath`: an absolute path with no `.` or `..` segment that,
 * as written, is inside the chat's folder or a temp folder, before anything touches it, so a network path is never opened; whose real path,
 * links resolved, is inside one of those folders too, and in a temp folder belongs to the user; and a regular file no larger than the image
 * limit whose bytes are an image, read through `SavedImageFile.read`.
 */
export declare class CursorImageReader implements ISavedImageReader {
  /**
   * @param temporaryDirectories The temp folders the reader also takes images from; `temporaryDirectoriesOf` the running platform by default.
   * @param userId The user a file in a temp folder must belong to, or null to take any owner; `userIdOf` the running process by default.
   * @param realPathOf Resolves a path's links, never called for a notification's path that isn't, as written, inside an allowed folder.
   */
  public constructor(temporaryDirectories?: readonly string[], userId?: number | null, realPathOf?: (path: string) => string | null);

  /**
   * The user id of a process, or null where it has none, as on Windows.
   * @param running The process, such as `process`.
   */
  public static userIdOf(running: { readonly getuid?: () => number }): number | null;

  /**
   * The temp folders Cursor's images may be in on a platform: the system's, and `/tmp` too on Linux and macOS.
   * @param platform The platform, as `process.platform` names it.
   */
  public static temporaryDirectoriesOf(platform: string): readonly string[];

  public read(tool: JsonReader, sessionId: string, provider: Provider | null, workingDirectory: string): SavedImage | null;

  /** Always null: Cursor's image notification carries no failure, and a file the reader can't take shows as one. */
  public failureOf(tool: JsonReader): JsonObject | null;
}

/**
 * Reads the plan of Cursor's `cursor/create_plan` request and writes its answer.
 */
export declare class CursorPlanReader implements IAcpPlanReader {
  /** `cursor/create_plan`. */
  public readonly methods: readonly string[];
  /** `create_plan`. */
  public readonly nativeKind: string;
  /** `false`: Cursor's ACP documents don't say it leaves its plan mode after `accepted`. */
  public readonly leavesPlan: boolean;
  /**
   * The request's `plan` as the plan text, and its `todos`, then each phase's, as steps, a status Cursor's ACP documents don't name read as
   * pending.
   * @throws JsonException when the plan is missing or blank, or a to-do list isn't an array of objects.
   */
  public read(params: JsonReader): { readonly text: string; readonly steps: readonly PlanStep[] };

  /**
   * The answer to send: `accepted` for an approved plan, `rejected` for a refused one, and `cancelled` for `null`.
   */
  public reply(params: JsonReader, approved: boolean | null): JsonObject;
}

/**
 * Reads the to-do list of Cursor's `cursor/update_todos` notification, keeping each session's list so a later one can update it.
 */
export declare class CursorToDoListReader implements IAcpToDoListReader {
  /** `cursor/update_todos`. */
  public readonly methods: readonly string[];
  /**
   * The session's list after this notification, as steps: its `todos` replace the list, or with `merge` true update the to-dos with the same
   * `id` and add the rest after them. A cancelled to-do is left out, and a status Cursor's ACP documents don't name reads as pending.
   * @throws JsonException when the session id is missing or blank, or `todos` isn't an array of objects.
   */
  public read(params: JsonReader): readonly PlanStep[];
}

/**
 * Reads the questions of Cursor's `cursor/ask_question` request and writes its answer. Each question and option is identified by its own id.
 */
export declare class CursorQuestionReader implements IAcpQuestionReader {
  /** `cursor/ask_question`. */
  public readonly methods: readonly string[];
  /** `ask_question`. */
  public readonly nativeKind: string;
  /** Always `true`: every request of its methods is a question. */
  public claims(): boolean;
  /**
   * The request's questions, with its title as their header and their options, without the person's own words, which Cursor has no place for;
   * `null` when there is none or one doesn't read, such as an option without a label or two questions with the same id.
   */
  public read(params: JsonReader): readonly ApprovalQuestion[] | null;

  /**
   * The answer to send: `answered` with each answered question's chosen option ids, leaving out a choice Cursor didn't offer; `cancelled` for
   * `null`, which a skip, a dismissal and a stopped question all send, so Cursor's `skipped` is never sent.
   */
  public reply(params: JsonReader, answers: readonly QuestionAnswer[] | null): JsonObject;
}

/**
 * Reads Antigravity's questions, which its ACP server 1.3.0 asks through `session/request_permission`: a tool call with no kind, an id starting
 * `interaction_` and its question as the title, and one `allow_once` option per answer, named by it.
 */
export declare class AntigravityQuestionReader implements IAcpQuestionReader {
  /** `session/request_permission`. */
  public readonly methods: readonly string[];
  /** `session/request_permission`. */
  public readonly nativeKind: string;
  /**
   * Whether the request is a question: its tool call has no kind and an id starting `Resources.antigravityQuestionIdPrefix`, and it has
   * options, every one `allow_once`, and it reads as a question; any other permission request, such as one for a command, one without a tool
   * call or options, or one that doesn't read, isn't, so it keeps its permission card.
   */
  public claims(params: JsonReader): boolean;
  /**
   * The request's one question: its title as the text, with no header, and each option's name as a choice, without the person's own words,
   * which Antigravity's answer has no place for; `null` when it doesn't read, such as a title or an option's id or name missing, or two
   * options with the same name.
   */
  public read(params: JsonReader): readonly ApprovalQuestion[] | null;
  /**
   * The answer to send: `selected` with the id of the option named by the chosen answer; `cancelled` for `null`, no choice or a choice
   * Antigravity didn't offer.
   */
  public reply(params: JsonReader, answers: readonly QuestionAnswer[] | null): JsonObject;
}

/**
 * A dedicated TeamRun profile for Cursor: `CURSOR_CONFIG_DIR` is the profile folder, and `Resources.cursorSignInVariables` places Cursor's data
 * folder inside it, and its XDG config folder on Linux or its app-data folder on Windows.
 */
export declare class CursorProfile {
  /**
   * The profile folder.
   */
  public readonly directory: string;
  /**
   * Each sign-in variable's folder in the profile.
   */
  public readonly folders: Readonly<Record<string, string>>;
  /**
   * Each variable of `Resources.cursorTitleHomeVariables` with the profile's empty `title-home` folder.
   */
  public readonly titleHomes: Readonly<Record<string, string>>;

  /**
   * Requires an absolute directory.
   * @param platform The system whose sign-in variables the profile places, the current one by default.
   */
  public constructor(directory: string, platform?: string);

  /**
   * Initializes an empty or TeamRun-managed profile, refusing any other folder, makes its folders and writes its `cli-config.json` as
   * `Resources.formatCursorConfig` writes it.
   * @param approvedTools The TeamRun tools Cursor runs without asking; a name that doesn't match `Resources.approvedToolNamePattern` is left out,
   * so Cursor still asks before it. None by default.
   * @param permissions The person's own allow and deny rules, written before TeamRun's; none by default.
   */
  public prepare(approvedTools?: readonly string[], permissions?: CursorPermissions): void;
}

/**
 * The allow and deny rules of a person's own Cursor `cli-config.json`, under `permissions`.
 */
export declare class CursorPermissions {
  /**
   * No rules.
   */
  public static readonly none: CursorPermissions;
  public readonly allow: readonly string[];
  public readonly deny: readonly string[];

  public constructor(allow: readonly string[], deny: readonly string[]);

  /**
   * Reads the rules of a `cli-config.json`, leaving out each allow rule whose MCP server is `teamrun` or holds a `*`, so TeamRun's own approvals alone decide
   * its tools; deny rules stay as written.
   * @returns `none` when the file or its `permissions` is missing.
   * @throws Error naming the file when it can't be read, isn't JSON, its rules aren't lists of strings, or it is larger than
   * `Resources.maximumConfigurationMegabytes`.
   */
  public static read(file: string): CursorPermissions;
}

/**
 * Builds the environment of a Cursor process.
 */
export declare class CursorEnvironment {
  /**
   * Removes the person's credentials and `CURSOR_` settings; sets `CURSOR_CONFIG_DIR` and each sign-in variable into the profile, the same as
   * the sign-in terminal, `NO_OPEN_BROWSER` and `NO_COLOR`. It leaves `HOME` alone, so the sign-in Cursor keeps in macOS's keychain stays readable,
   * except in a title session, which sets each of `CursorProfile.titleHomes`.
   * @param titleSession Whether it runs a launch outside a chat turn; `false` by default.
   */
  public static build(base: NodeJS.ProcessEnv, profile: CursorProfile, titleSession?: boolean): NodeJS.ProcessEnv;
}

/**
 * Builds the environment of an fx process.
 */
export declare class FxEnvironment {
  /**
   * Removes the person's credentials and `FX_`, `VERCEL_` and `AI_GATEWAY_` settings, so fx signs in from the person's own fx in `~/.fx`, and
   * sets `NO_COLOR`. It sets no `FX_HOME`, which fx 0.0.16 doesn't read, and leaves `HOME` alone.
   */
  public static build(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
}

/**
 * fx integration: the shared ACP adapter running `FxAgent`, in the person's own fx; TeamRun doesn't install fx, which has no build for Windows.
 */
export declare class FxAdapter extends AcpAdapter {
  /**
   * Creates the adapter; its ACP clients' stops wait on the timer, by default `NodeTimer`, and its session lines go to the log, by default none.
   * @param platform The system whose home folder variable names the person's own fx, the current one by default.
   */
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, clientInfo: AppServerClientInfo, starter: IProcessStarter, timings: ProviderTimings, timer?: ITimer,
    processTree?: IProcessTree, locate?: () => ProcessCommand | null, log?: ILog | null, platform?: string);

  /**
   * Asks `fx status --json` first: when its `auth` is `missing`, fx is signed out, with a hint to run `fx login`, and no `fx acp` starts. Otherwise, also
   * when the answer can't be read or fx can't start, the check goes on as `AcpAdapter.checkSignIn` does, through `fx acp`.
   */
  public checkSignIn(provider: Provider): Promise<SignInCheck>;

  /**
   * Checks a folder discovery found through `fx status --json` alone, which connects nowhere, and never starts `fx acp`: `LoggedOut` with the
   * `fx login` hint when its `auth` is `missing`, `LoggedIn` with no identity for any other `auth`, and `Unknown` when the answer has none.
   */
  public checkFoundSignIn(provider: Provider): Promise<SignInCheck>;

  /**
   * Runs `fx logout` for each of `Resources.fxAccounts` in turn, each within the sign-in check's timeout, going on past one that fails; fx answers an
   * account with no login as done.
   * @throws TimeoutException with `Resources.formatFxSignOutTimedOut` for each account when every failed one didn't end in time.
   * @throws Error with `Resources.formatFxSignOutFailed`, with its output or none when it printed nothing, for each account that exited with an error,
   * and `Resources.formatFxSignOutTimedOut` for each that didn't end, after every account ran.
   */
  public signOut(provider: Provider): Promise<void>;
}

/**
 * Cursor integration: the shared ACP adapter running `CursorAgent`, with dedicated managed profiles; TeamRun doesn't install Cursor.
 */
export declare class CursorAdapter extends AcpAdapter {
  /**
   * How TeamRun installs Cursor's CLI, when the adapter was given one.
   */
  public readonly installation?: IProviderKindInstallation;

  /**
   * Creates the adapter with the managed default profile location; its ACP clients' stops wait on the timer, by default `NodeTimer`, and its
   * session lines go to the log, by default none.
   * @param installation How TeamRun installs Cursor, kept as `installation`; none by default.
   */
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, defaultProfileDirectory: string, clientInfo: AppServerClientInfo, starter: IProcessStarter, timings: ProviderTimings, timer?: ITimer,
    processTree?: IProcessTree, locate?: () => ProcessCommand | null, log?: ILog | null, platform?: string, installation?: IProviderKindInstallation | null);

  /**
   * Checks the sign-in through a session, then, when it is signed in, reads Cursor's version, plan and email from `cursor-agent about` with
   * `CursorAboutReader`; an `about` that fails or doesn't end within the sign-in check's timeout leaves the check as it was.
   */
  public checkSignIn(provider: Provider): Promise<SignInCheck>;

  /**
   * Runs `cursor-agent logout` in the provider's profile, within the sign-in check's timeout.
   * @throws TimeoutException with `Resources.formatCursorSignOutTimedOut` when it doesn't end in time.
   * @throws Error with `Resources.formatCursorSignOutFailed` and its output, or none when it printed nothing, when it exits with an error.
   */
  public signOut(provider: Provider): Promise<void>;
}

/**
 * GitHub Copilot CLI integration: the shared ACP adapter running `CopilotAgent` over `copilot --acp`, with its models listed by `CopilotModelLister`.
 */
export declare class CopilotAdapter extends AcpAdapter {
  /**
   * Creates the adapter; its processes start in the work folder; its ACP clients' stops wait on the timer, by default `NodeTimer`;
   * a failed model listing writes one line to the log, when there is one.
   * @param installation How TeamRun installs and updates Copilot, kept as `installation`; none by default.
   * @param idleTimer Tells the time a kept session has had no turn, as `AcpAdapter` takes it; a `NodeTimer` by default.
   * @param processTree Ends what an agent started when it stops, as `AcpAdapter` takes it; `AcpAdapter`'s `ProcessTree` by default.
   */
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, workDirectory: string, clientInfo: AppServerClientInfo, starter: IProcessStarter, timings: ProviderTimings, timer?: ITimer, log?: ILog | null, locate?: () => ProcessCommand | null,
    installation?: IProviderKindInstallation | null, idleTimer?: ITimer, processTree?: IProcessTree);

  /**
   * How TeamRun installs and updates Copilot, when it was given one.
   */
  public readonly installation?: IProviderKindInstallation;

  /**
   * Lists the models Copilot's headless server offers, and keeps a signed-in list for the profile until the adapter ends or a refresh;
   * when that server fails or doesn't answer, logs one line, without what the server said, and lists them over ACP, which offers none.
   * @param refresh Whether to drop the kept list first; `false` by default.
   * @throws Error when the adapter shuts down during the listing, or when the ACP listing fails too.
   */
  public override listModels(provider: Provider | null, refresh?: boolean): Promise<ProviderModelList>;

  /**
   * Reads the provider's plan use now.
   * @param provider The provider, or `null` for the default profile.
   * @returns The monthly premium-request, chat and completion windows from `session.quota.get`, in a headless server's session, each under its own name, with
   * the plan its `planTier` names, none when it names a plan but no windows, or `null` when Copilot isn't signed in, or its server fails or answers in another
   * shape with no plan; a figure is never estimated.
   * Whether it reported windows decides whether the provider's replies read them again.
   */
  public override readPlanUsage(provider: Provider | null): Promise<PlanReading | null>;

  /**
   * Checks the sign-in over ACP and, when signed in, adds the account `CopilotModelLister.readAccount` reads: Copilot's ACP server
   * reports none. The check stays signed in without it when that read fails.
   */
  public override checkSignIn(provider: Provider): Promise<SignInCheck>;

  /**
   * Stops every ACP client and headless server the adapter started, once the plan reads its replies started have ended.
   */
  public override shutdown(): Promise<void>;

  /**
   * Adds the agent's modes and default mode to a list of its models, and marks that Copilot's Auto, which no listed model is, takes every effort level a
   * listed model offers.
   * @param list The list.
   * @returns The list with `modes`, `defaultMode` and `defaultTakesListedEfforts` set.
   */
  protected override withModes(list: ProviderModelList): ProviderModelList;

  /**
   * Starts reading the provider's plan use after a completed reply, without holding the reply, with `session.quota.refresh` before
   * `session.quota.get`, and reports it when the quota answers; a provider whose last read reported no plan, or that was never read, isn't read,
   * unless its last report held the Quota window a refusal for quota assumed. A reply whose last text is only Copilot's refusal line,
   * `copilotRefusalReply` with a message that matches `copilotQuotaRefusal`, as "Error: You have exceeded your monthly quota (Request ID: …)"
   * ending a completed turn is, is a refusal for quota, handled as `reportPlanAfterFailure` handles one.
   * @returns Once the Quota window a refusal for quota assumes has been reported, without waiting for the read; it rejects only when that report fails.
   */
  protected override reportPlanUsage(client: AcpClient, provider: Provider | null, listener: ITurnListener, reply: string): Promise<void>;

  /**
   * Starts the same read after a failed turn. After a refusal for quota it reports the Quota window used in full at once, without waiting for the
   * read, then reads for any provider and reports that window beside what it read, unless a window read is used in full already, since a fresh
   * session's quota can say nothing about the budget that stopped the turn. A refusal for quota is an error whose message, or the `message`, `code`,
   * `type` or `details` of an `AcpRequestException`'s data, matches `copilotQuotaRefusal`, as "You have exceeded your monthly quota" or
   * `quota_exceeded` do.
   * The provider is then read after each turn until a reading replaces that window, an empty one when the read fails.
   * @returns Once the Quota window a refusal for quota assumes has been reported, without waiting for the read; it rejects only when that report fails.
   */
  protected override reportPlanAfterFailure(client: AcpClient, provider: Provider | null, listener: ITurnListener, error: unknown): Promise<void>;
}

/**
 * Lists Copilot's models from a short-lived `copilot --headless --no-auto-update --stdio`, the server Copilot's SDK speaks to:
 * `connect` (skipped when the server doesn't know it), `auth.getStatus`, then `session.create`, `session.model.list` and, when that lists nothing,
 * `session.quota.get`, ending with `session.delete`; each a JSON-RPC request in `Content-Length` frames. The delete waits for its answer for
 * the stop grace, counted on the lister's timer, and logs a failure when the grace ends first.
 */
export declare class CopilotModelLister {
  /**
   * Creates the lister; its servers' stops wait on the timer, and a server that doesn't stop writes one line to the log, when there is one.
   */
  public constructor(agent: CopilotAgent, starter: IProcessStarter, timings: ProviderTimings, timer: ITimer, log: ILog | null);

  /**
   * How many times `shutdown` has run.
   */
  public get shutdowns(): number;

  /**
   * Starts a server for the provider, reads its models in a session it deletes again, and stops it; a server that doesn't stop keeps the models read,
   * and a session that isn't deleted writes one line to the log, when there is one.
   * @param refresh `true` to ask `session.model.list` to skip its cache, so the list follows the provider's Copilot settings; `false` by default.
   * @returns No models and `signedIn` false when Copilot isn't signed in; no models and `planName` "Copilot Free" when the list is empty on a Free plan.
   * @throws Error when the server can't start, fails, times out or answers out of shape.
   */
  public list(provider: Provider | null, refresh?: boolean): Promise<ProviderModelList>;

  /**
   * Starts a server for the provider and reads its quota with `session.quota.get` in a session it deletes again, and stops it.
   * @param refresh Whether `session.quota.refresh` asks the service for the quota first; its failure leaves the read as it would be.
   * @returns The answer, for `CopilotQuotaReader` to read, or `null` when Copilot isn't signed in.
   * @throws Error when the server can't start, fails or times out.
   */
  public readQuota(provider: Provider | null, refresh?: boolean): Promise<JsonValue | null>;

  /**
   * Starts a server for the provider and reads its account from `auth.getStatus`, with no session and no prompt, and stops it.
   * @returns What `CopilotAccountReader` reads, or `null` when Copilot isn't signed in or names no account.
   * @throws Error when the server can't start, fails or times out.
   */
  public readAccount(provider: Provider | null): Promise<ProviderIdentity | null>;

  /**
   * Stops every server a listing still runs.
   */
  public shutdown(): Promise<void>;
}

/**
 * Reads Copilot's `auth.getStatus` answer.
 */
export declare class CopilotAccountReader {
  /**
   * Reads the GitHub user name from `login` and the sign-in from `authType`.
   * @returns The identity, or `null` when `isAuthenticated` isn't `true` or the answer names neither.
   */
  public static read(status: JsonValue): ProviderIdentity | null;
}

/**
 * Reads Copilot's `session.quota.get` answer.
 */
export declare class CopilotQuotaReader {
  /**
   * Reads the monthly premium-request, chat and completion snapshots, each as its own window: unlimited when the snapshot says so, and
   * otherwise the share used, what remains taken from 100 and above 100 when the plan is overdrawn, with the requests used of the
   * entitlement when it gives both.
   * Then reads `providerQuotas`, the service's own readings, each named by its `compatibilityKey` as a snapshot is, or as the monthly credits
   * when its unit is `ai_credits`: a reading that succeeded and says the budget is used up is a window used in full, with its reset time
   * when given, and named the quota when it has no other name. A budget is used up when its capacity is exhausted, its access is denied,
   * or `hasQuota` is `false` and neither state says no quota is needed. An authoritative budget's reading is unlimited, by its capacity,
   * its metadata or the `-1` entitlement, or else measured as a snapshot is; any other reading that isn't used up gives no window. Such a window takes the place of the snapshot of its name, and of the same name an exhausted one wins.
   * An unlimited premium-request window, from a snapshot or a reading, is left out when `isTbbUser` says the account has token-based billing,
   * since it doesn't limit it.
   * @returns The windows, none for a snapshot or reading that is missing, failed, unavailable or has no figure that can be read,
   * or `null` when the answer has neither snapshots nor readings.
   */
  public static read(answer: JsonValue): readonly PlanWindow[] | null;

  /**
   * Reads the plan the answer's `planTier` names, such as `free` or `pro`.
   * @returns The plan's code, or `null` when the answer names none.
   */
  public static readPlan(answer: JsonValue): string | null;
}

/**
 * Reads the to-do list Copilot keeps as its plan. Copilot CLI's ACP session sends one empty plan, so after its `sql` tool changes the
 * `todos` table, the list is read from `<profile>/session-state/<session id>/session.db`, as Copilot CLI 1.0.103 keeps it.
 */
export declare class CopilotToDoReader implements IAcpToDoReader {
  /**
   * Creates a reader.
   * @param defaultProfileDirectory The profile folder of a turn with no provider, as `~/.copilot`.
   */
  public constructor(defaultProfileDirectory: string);

  /**
   * Reads the to-dos, in order, when the tool is Copilot's `sql` tool, whose raw output's `detailedContent` starts with
   * `Resources.copilotSqlOutputPrefix`, and its raw input holds a `query` that matches `Resources.copilotToDoWritePattern`, from the
   * provider's profile folder or the default one: the first `Resources.maximumCopilotToDos`, each title cut to `Resources.maximumSummaryLength`
   * characters, leaving out a to-do with a blank title, and waiting at most `Resources.copilotToDoBusyTimeout` while Copilot holds the database.
   * @returns The steps, or `null` when the query writes no to-do, the session id isn't a single folder name, or the database or its table
   * can't be read.
   */
  public read(tool: JsonReader, sessionId: string, provider: Provider | null): readonly PlanStep[] | null;
}

/**
 * Reads the answer to `session.model.list`.
 */
export declare class CopilotModelReader {
  /**
   * Returns each model whose policy isn't `disabled` and whose id is a valid model name, by its name (its id when blank), with the effort levels it lists
   * among Copilot's, all of them when it supports an effort but lists none, and whether it takes images when it says.
   * Copilot's own `auto` row lists no capabilities, and Copilot applies the chosen effort to the model Auto picks, so that row offers every level the
   * other rows list, in Copilot's order (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, then any other by first appearance).
   * @throws JsonException when the answer is out of shape.
   */
  public static read(answer: JsonReader): readonly ProviderModel[];
}

/**
 * The Copilot part of the shared ACP adapter: `copilot --acp --stdio --no-auto-update` in a work folder TeamRun owns, the CLI's own sign-in
 * (no `authenticate`; `COPILOT_HOME` set to a provider's profile folder when it has one), the effort as `--reasoning-effort` at launch,
 * `session/load` to resume, a model as `--model` at launch, and `refusal` as a completed turn. Its ACP server lists no models; `CopilotModelLister` does.
 * Its ACP server sends no plan; `CopilotToDoReader` reads the to-do list from the session's database in the profile folder.
 */
/**
 * Whether the person's Copilot has hooks, which a title session would run.
 */
export declare class CopilotHooks {
  /**
   * The machine policy folder Copilot loads hooks from: `/etc/github-copilot/policy.d` on Linux and macOS, and `GitHub\Copilot\policy.d` under
   * `ProgramData`, else `C:\ProgramData`, on Windows.
   * @param platform The operating system.
   * @param environment The environment that names `ProgramData`.
   */
  public static policyFolder(platform: string, environment: NodeJS.ProcessEnv): string;

  /**
   * `true` when the policy folder has `*.json` files, or the home has them in `hooks`, an installed plugin has `hooks.json` or `hooks/hooks.json`, or
   * `settings.json` has a non-empty `hooks`, and when one of those can't be read; a missing folder or file counts as none.
   * @param home The provider's Copilot home.
   * @param policyFolder The machine policy folder.
   */
  public static presentIn(home: string, policyFolder: string): boolean;
}

export declare class CopilotAgent implements IAcpAgent {
  public readonly descriptor: ProviderKind;
  public readonly baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch;
  public readonly toolTitle: string;
  public readonly authMethod: string;
  /** Reads each reply's tokens from its answer's `usage`. */
  public readonly usage: IAcpUsageReader;
  public readonly account: IAcpAccountReader | null;
  public readonly toDos: IAcpToDoReader;
  public readonly questions: IAcpQuestionReader | null;
  public readonly authMeta: JsonObject | null;
  /** Asks Copilot for its `subagent.started` session events, which link each sub-agent's `agentId` to its spawn. */
  public readonly initializeMeta: JsonObject;
  public readonly stopReasons: readonly string[];
  public readonly prefersResume: boolean;
  public readonly forkMethods: readonly string[];
  public readonly sendsResourceLinks: boolean;
  public readonly signInUnavailable: string;
  public readonly signOut: IAcpSignOutReader | null;
  public readonly logsOut: boolean;
  public readonly authenticates: boolean;
  public readonly effortAtLaunch: boolean;
  public readonly modelAtLaunch: boolean;
  public readonly fallbackModels: readonly string[];
  public readonly compacts: boolean;
  public readonly sharedServerTransports: readonly SharedMcpTransport[];
  public readonly sharedServerRefusal: SharedMcpRefusal | null;
  /** Copilot's flags that leave a title session no tools or instructions. */
  public readonly titleSessionArguments: readonly string[];
  /** Copilot's `Info:` lines, which its `--available-tools` adds to the session's text. */
  public readonly titleSessionNotice: RegExp;
  public readonly followsTasks: boolean;
  public readonly backgroundSubAgentsNote: string | null;
  public readonly routedMcpTool: string | null;
  public readonly awaitsTeamRunTools: boolean;
  public readonly interactiveSignIn: boolean;
  public readonly modes: readonly ProviderMode[];
  public readonly defaultMode: string | null;
  /** The mode an isolated session, a title's or a handover summary's, starts in: Copilot's Agent mode, since its title session's flags leave it no tools. */
  public readonly isolatedMode: string;
  public readonly planMode: string;
  public readonly permissionSwitch: AcpPermissionSwitch | null;
  public readonly launchMode: string | null;
  public readonly turnModels: IAcpModelStore | null;

  /**
   * Initializes the agent.
   * @param command Copilot's program, or `null` when it isn't found.
   * @param environment The environment it starts from.
   * @param workDirectory The folder it runs in.
   * @param locate Finds Copilot's program again when `command` is `null` or gone; none by default.
   * @param homeDirectory The person's home folder, where the default profile's `.copilot` is; this process's by default.
   * @param policyFolder The machine policy folder whose `*.json` files Copilot loads hooks from: `/etc/github-copilot/policy.d` on Linux and macOS,
   * and `GitHub\Copilot\policy.d` under `ProgramData` on Windows, by default.
   */
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, workDirectory: string, locate?: () => ProcessCommand | null,
    homeDirectory?: string, policyFolder?: string);

  /**
   * Creates the work folder and starts there, with the environment minus other providers' variables, `COPILOT_ALLOW_ALL` and `COPILOT_HOME`,
   * turning off Copilot's built-in MCP servers and each server its profile, the turn's folder up to its repository root and its plugins name,
   * unless it starts a chat turn for a provider that keeps its own MCP servers, and letting it run the approved tools of TeamRun's server without asking.
   * @param approvedTools The TeamRun tools the person isn't asked about, as the turn's tools name them, or `null` outside a turn; a name
   * that doesn't match `Resources.approvedToolNamePattern` is left out, so Copilot still asks before it.
   * @param environment The environment Copilot's own is built from; `baseEnvironment` by default.
   * @param chatTurn Whether it starts a chat turn, whose own MCP servers follow the provider's switch; `false` by default.
   * @throws Error when Copilot CLI isn't installed, or when a file naming MCP servers exists but can't be read.
   */
  public launch(provider: Provider | null, requested: RequestedSettings | null, workingDirectory: string | null, approvedTools?: readonly string[] | null,
    environment?: NodeJS.ProcessEnv, chatTurn?: boolean): AcpLaunch;

  /**
   * Like `launch`, for `copilot --headless --no-auto-update --stdio`, which lists the models.
   * @param environment The environment Copilot's own is built from; `baseEnvironment` by default.
   * @throws Error when Copilot CLI isn't installed.
   */
  public headlessLaunch(provider: Provider | null, environment?: NodeJS.ProcessEnv): AcpLaunch;

  /**
   * The command the agent's turns start, found again on each call, or `null` when it isn't found.
   */
  public currentCommand(): ProcessCommand | null;

  /**
   * @returns `null`: only a session can tell.
   */
  public isSignedIn(provider: Provider | null): boolean | null;
  public readModels(initialized: JsonReader): readonly ProviderModel[] | null;
  public readVersion(initialized: JsonReader): string | null;
  public readSignInMethod(initialized: JsonReader): string | null;
  public readEffort(session: JsonReader): string | null;
  /** Returns `null`: Copilot's ACP agent has no naming rule. */
  public memberOf(value: string, name: string): AcpModelMember | null;
  public sessionMeta(): JsonObject | null;
  public formatUnsupported(version: string | null): string | null;
  public formatSignIn(provider: Provider | null): string;
  public formatStopped(reason: string): string;

  /**
   * Whether a chat keeps its first message's title instead of a Copilot title session: when the person's Copilot has hooks, `*.json` files in
   * the machine policy folder or in `hooks` under the provider's home, a `hooks` block in its `settings.json`, or an installed plugin's `hooks.json` or `hooks/hooks.json`, since an
   * isolated session would run them; and when one of those can't be read.
   * @param provider The provider, or `null` for the default profile.
   */
  public hasNoIsolatedAsk(provider: Provider | null): boolean;

  /**
   * Refuses a shared server named like one of Copilot's own, in the files whose servers a launch turns off by name, since
   * `--disable-mcp-server=<name>` would turn the shared one off too, and while they're kept on, both would load under one name; `null` when no file names it, or when one can't be read, which the
   * launch then refuses with its own error.
   * @param name The shared server's name.
   * @param provider The provider, or `null` for the default profile.
   * @param workingDirectory The turn's folder, or `null` for the profile's and plugins' files alone.
   */
  public sharedServerNameRefusal(name: string, provider: Provider | null, workingDirectory: string | null): SharedMcpRefusal | null;

  /**
   * Lists the servers in `mcp-config.json` under the profile folder, or under `~/.copilot` for the default profile, by name
   * and without `teamrun`; none when the file is missing. Unless the provider switches its own servers on,
   * Copilot starts with `--disable-builtin-mcps` and `--disable-mcp-server <name>` for each of them, for a turn and for
   * the model listing alike.
   * @param provider The provider, or `null` for the default profile.
   * @returns The servers, each `Configured`, since the file says nothing more without connecting.
   * @throws Error when the file can't be read, isn't JSON, or is larger than `Resources.maximumConfigurationBytes`, which is checked
   * before it's read; a launch refuses such a file too.
   */
  public listOwnMcpServers(provider: Provider | null): Promise<readonly OwnMcpServer[]>;
}

/**
 * What one ACP agent adds to the shared adapter: how it starts, signs in, names its models and effort, and which limits it has.
 */
export interface IAcpAgent {
  /**
   * The provider's id, name and supported operations.
   */
  readonly descriptor: ProviderKind;
  /**
   * The environment the agent's processes start from, whose home and app-data folders its sign-in gets back, so a browser the sign-in
   * opens is the person's own, with their usual profile, whatever folders the agent's other processes get.
   */
  readonly baseEnvironment: NodeJS.ProcessEnv;
  /**
   * Where TeamRun looks for the agent's profile folders, or `null` for none.
   */
  readonly profileSearch: ProfileSearch | null;
  /**
   * The title of a tool call that has none.
   */
  readonly toolTitle: string;
  /**
   * The `authenticate` method id; the agent can sign in without a person only when `initialize` lists it.
   */
  readonly authMethod: string;
  /**
   * The `_meta` sent with `authenticate`, or `null` for none.
   */
  readonly authMeta: JsonObject | null;
  /**
   * The `_meta` sent in `initialize`'s client capabilities, or `null` for none.
   */
  readonly initializeMeta: JsonObject | null;
  /**
   * Stop reasons, besides `end_turn`, that complete a turn.
   */
  readonly stopReasons: readonly string[];
  /**
   * Whether a resume uses `session/resume`, without a replay, when the agent advertises it; otherwise it uses `session/load`.
   */
  readonly prefersResume: boolean;
  /**
   * The agent's session-fork method under each name to try, in order, or none when the agent can't fork.
   */
  readonly forkMethods: readonly string[];
  /**
   * Whether attachments other than images go in the prompt as `resource_link` entries; otherwise only their paths in the text name them.
   */
  readonly sendsResourceLinks: boolean;
  /**
   * The failure of a sign-in when the agent offers none TeamRun can start.
   */
  readonly signInUnavailable: string;
  /**
   * Signs the profile out through extension methods, such as Grok's `_x.ai/auth/logout`, sent after `initialize`, and reads their answer;
   * `null` when the agent signs out only in its own terminal.
   */
  readonly signOut: IAcpSignOutReader | null;
  readonly logsOut: boolean;
  /**
   * Whether TeamRun calls `authenticate` before a session. When not, the agent keeps its own sign-in: a `session/new` in the client's folder
   * tells whether it is signed in, by succeeding or by refusing with `-32000`, and its `model` config option, if any, lists the models.
   */
  readonly authenticates: boolean;
  /**
   * Whether the turn's effort goes on the command line, so a session that offers no `thought_level` option still takes it.
   */
  readonly effortAtLaunch: boolean;

  /**
   * Whether the turn's model goes on the command line, so a session that offers no `model` option still runs the model named.
   */
  readonly modelAtLaunch: boolean;
  /**
   * The models the agent advertises before its provider's catalog loads, such as Grok's built-in `grok-4.6` and `grok-4.5`; empty for none. A list
   * of only these is a catalog not yet loaded: a model listing comes back empty, and a turn whose model it lacks fails with
   * `Resources.formatModelsNotLoaded` and no action.
   */
  readonly fallbackModels: readonly string[];
  /**
   * Whether the agent's `authenticate` may open a browser sign-in, as Antigravity's does when its token has expired. A sign-in check then sends no
   * `authenticate`; only a turn or a sign-in does.
   */
  readonly interactiveSignIn: boolean;
  /**
   * Keeps the models each fresh turn's session names, for agents that name them only in a signed-in session; a model listing then reads the
   * kept ones and starts no agent, so it never signs in. `null` when a listing asks the agent itself.
   */
  readonly turnModels: IAcpModelStore | null;
  /**
   * The permission modes the agent lists, from its published shapes; a turn sets the listed mode the teammate or chat chose, an unrestricted
   * one included, and the default otherwise, and fails when the session runs an unrestricted mode it didn't choose. Empty when the agent lists none.
   */
  readonly modes: readonly ProviderMode[];
  /**
   * The mode a turn runs in when its teammate or chat chose none, or chose one the agent doesn't list; `null` when the agent lists no modes.
   */
  readonly defaultMode: string | null;
  /**
   * The listed mode a plan-first turn runs in, such as OpenCode's `plan`; `null` or absent when the agent has none, and its turns then run as
   * usual.
   */
  readonly planMode?: string | null;
  /**
   * Whether the agent's session takes its modes through `session/set_mode` without listing them, as Grok's does; a session that lists no
   * modes then offers the agent's own. `false` or absent when an unlisted mode is not offered.
   */
  readonly takesUnlistedModes?: boolean;
  /**
   * The id of the session's model option when other options share its `model` category, such as fx's `model` beside its `provider`; `null`
   * or absent when the first option of that category is the model's.
   */
  readonly modelOption?: string | null;
  /**
   * The session's speed option, such as fx's `fast`, and the speed each of its choices means; `null` or absent when the agent offers no speed.
   * A model listing offers those speeds when the session lists the option, and a turn sets the chosen speed's choice before it prompts.
   */
  readonly speedOption?: AcpSpeedOption | null;
  /**
   * Whether a refusal of `initialize`, `session/new` or a later request means the person isn't signed in, for an agent that refuses that way with
   * another code than `-32000`, such as fx's `-32600` naming `fx login`; the refusal then reads as signed out, as `-32000` does. Absent when only
   * `-32000` means that.
   */
  isSignedOutRefusal?(code: number | null, message: string): boolean;
  /**
   * The config option apart from the `mode` option that turns one of the listed modes on, such as Copilot's `allow_all`; a turn turns it on when
   * that mode is the one chosen, and off when another is and the session starts with it on. `null` when the agent has none.
   */
  readonly permissionSwitch: AcpPermissionSwitch | null;
  /**
   * The listed mode the agent runs in through its launch arguments rather than its mode or config options, such as Grok's `bypassPermissions`;
   * a turn in it runs in the default session mode. `null` when the agent has none.
   */
  readonly launchMode: string | null;
  /**
   * The listed unrestricted mode TeamRun carries out itself, for an agent with no mode that asks for nothing, such as Cursor's Allow all:
   * a turn in it runs in the default session mode, and TeamRun allows each permission request the agent sends. None when the agent has none.
   */
  readonly allowAllMode?: string;

  /**
   * Whether the agent compacts its session when sent `/compact`; one that doesn't gets no prompt, and the reply says it can't compact.
   */
  readonly compacts: boolean;

  /**
   * Whether an agent that isn't known to compact gets `/compact` when its session lists that command, its compaction counting only once it
   * reports one in ACP's `compaction_update`; a reply without one says the context may not be compacted, and an unlisted command gets no prompt.
   */
  readonly compactsIfListed?: boolean;

  /**
   * Whether TeamRun offers the agent ACP's client terminals: it runs each command the agent asks for in the chat's folder, and a terminal still
   * running when its tool call or turn ends becomes a background command the person can follow and stop.
   */
  readonly runsTerminals?: boolean;

  /**
   * The transports of the shared MCP servers TeamRun passes the agent, their values read from the person's current environment at session start
   * and sent in `session/new` over the agent's input, a stdio server's through TeamRun's launcher; a transport is listed only once a run
   * shows the agent keeps those values out of its session files.
   */
  readonly sharedServerTransports: readonly SharedMcpTransport[];

  /**
   * Why TeamRun passes the agent no shared MCP server over a transport `sharedServerTransports` leaves out, once a run has shown why;
   * null gives `Resources.formatSharedMcpUnconfirmed`.
   */
  readonly sharedServerRefusal: SharedMcpRefusal | null;

  /** What a title session adds to the agent's command line, for an agent whose tools it can turn off there. */
  readonly titleSessionArguments?: readonly string[];
  /** The text chunks a title session leaves out of its answer, for an agent that sends notices as text. */
  readonly titleSessionNotice?: RegExp;
  /**
   * The mode an isolated session, a title's or a handover summary's, starts in, the agent's most restricted, so nothing that needs no permission
   * request runs in it; an agent without one, or one that starts the person's own MCP servers, runs no isolated session.
   */
  readonly isolatedMode?: string | undefined;
  /**
   * Whether this provider runs no isolated session, since one would run the person's own setup: a chat then keeps its first message's title, and a
   * handover has no summary of TeamRun's own; `askIsolated` answers `null` without starting the agent.
   */
  hasNoIsolatedAsk?(provider: Provider | null): boolean;
  /**
   * Whether the agent reports background tasks as Grok does, so the adapter follows them, keeps the agent running until they end, and shows the
   * turn the agent starts on its own when one ends.
   */
  readonly followsTasks: boolean;
  readonly backgroundSubAgentsNote: string | null;

  /**
   * The tool through which the agent calls every MCP tool, as Grok's `use_tool`, so TeamRun refuses such a call to anything but its own tools;
   * null for an agent that calls MCP tools by their own names.
   */
  readonly routedMcpTool: string | null;

  /**
   * Whether the agent may take a turn's prompt before its MCP client has connected to TeamRun's server, as Grok, which waits only briefly for
   * its MCP servers, does; the adapter then sends the prompt once the turn's endpoint has listed TeamRun's tools, or once listing them failed, the
   * agent's process ended, or `Resources.teamRunToolsWait` passed from the session's start, and then notes in the chat why the tools are missing
   * and writes `Resources.formatTeamRunToolsUnlisted` to the adapter's log. `false` for an agent that lists them only once the prompt arrives, as
   * Cursor and fx do, since waiting before the prompt could never see them listed.
   */
  readonly awaitsTeamRunTools: boolean;


  /**
   * Prepares the provider's profile and returns the process to start.
   * @param requested The turn's settings, or `null` outside a turn.
   * @param workingDirectory The turn's folder, or `null` outside a turn.
   * @param approvedTools The TeamRun tools the agent may run without asking, as the turn's tools name them, even none; `null` outside a turn.
   * @param environment The environment the process's own is built from, as `IProcessStarter.readEnvironmentAsync` read it for this start.
   * @param chatTurn Whether it starts a chat turn, rather than a title session, a listing, a sign-in or a fork; only a chat turn may keep the person's
   * own MCP servers.
   * @param titleSession Whether it starts a title session, a hidden turn that keeps the person's own setup out; `false` by default.
   * @throws Error when the agent isn't installed or its profile can't be used.
   */
  launch(provider: Provider | null, requested: RequestedSettings | null, workingDirectory: string | null, approvedTools: readonly string[] | null,
    environment: NodeJS.ProcessEnv, chatTurn?: boolean, titleSession?: boolean): AcpLaunch;

  /**
   * Says whether the provider is signed in when the agent can tell from its own files, or `null` when only the server can tell. With
   * `false`, a check reports the provider signed out without starting the server, a turn or a model list fails with the sign-in hint, and a
   * sign-in authenticates with `readSignInMethod`'s method even when `initialize` lists `authMethod`.
   */
  isSignedIn(provider: Provider | null): boolean | null;

  /**
   * Returns the models `initialize` advertised, or `null` when the session's config options name them.
   */
  readModels(initialized: JsonReader): readonly ProviderModel[] | null;

  /**
   * Returns the agent's version from `initialize`.
   */
  readVersion(initialized: JsonReader): string | null;

  /**
   * Returns the `authenticate` method id a person signs in with, such as a browser sign-in, from `initialize`; `null` when there is none.
   */
  readSignInMethod(initialized: JsonReader): string | null;

  /**
   * Returns the effort a session without config options runs at.
   */
  readEffort(session: JsonReader): string | null;

  /**
   * Places a choice of a session's flat `model` option by the agent's own naming rule: the model it belongs to and its level there, or `null`
   * when the agent has no such rule or the choice doesn't match it, whether or not the choice sits in an ACP group.
   */
  memberOf(value: string, name: string): AcpModelMember | null;

  /**
   * Returns the `_meta` sent when the session opens, or `null` for none.
   */
  sessionMeta(requested: RequestedSettings): JsonObject | null;

  /**
   * Refuses an agent version the integration doesn't work with; the shared adapter fails every `initialize` it refuses with this message.
   * @param version The version `readVersion` read, or `null` when the agent named none.
   * @returns The reason, or `null` when the version is supported.
   */
  formatUnsupported(version: string | null): string | null;

  /**
   * Says how a person signs in to the provider's profile.
   */
  formatSignIn(provider: Provider | null): string;

  /**
   * The failure of a turn that stopped for another reason.
   */
  formatStopped(reason: string): string;

  /**
   * Why the agent can't take a shared MCP server by its name, for the turn's provider and folder, such as a name its own servers use where
   * TeamRun can't let the shared one replace them; `null` when it can. Absent for an agent that takes a shared server whatever its name.
   * @param name The shared server's name.
   * @param provider The turn's provider, or `null`.
   * @param workingDirectory The turn's folder, or `null` for the panel's listing.
   */
  sharedServerNameRefusal?(name: string, provider: Provider | null, workingDirectory: string | null): SharedMcpRefusal | null;

  /**
   * Reads which MCP server and tool a permission request's tool call is for, as the agent itself names them, or `null` when it names no MCP
   * tool. A call it reads as one of TeamRun's read-only tools is allowed without asking the person. Absent for an agent whose requests don't
   * name the server and tool apart, such as fx, or that gets the turn's list of approved tools through `launch` or its routed tool instead.
   * @param tool The request's `toolCall`.
   */
  mcpToolOf?(tool: JsonReader): AcpMcpTool | null;

  /**
   * Lists the agent's own MCP servers from its files, without `teamrun`; absent for an agent whose own servers TeamRun doesn't
   * read from files.
   * @param provider The provider, or `null` for the default profile.
   * @returns The servers.
   */
  listOwnMcpServers?(provider: Provider | null): Promise<readonly OwnMcpServer[]>;

  /**
   * Reads which MCP servers the agent blocked, from the agent's own log: TeamRun's for the line the adapter writes when its wait for
   * TeamRun's tools ends by time, and each shared server the turn passed for its note in the chat; absent for an agent whose log TeamRun
   * doesn't read.
   * @param provider The provider, or `null` for the default profile.
   * @param since The turn's start, as an ISO 8601 time; earlier entries don't count.
   * @returns The agent's newest reason for each server its log names as blocked since then.
   */
  readMcpBlocks?(provider: Provider | null, since: string): ReadonlyMap<string, string>;

  /**
   * Whether the agent answers `session/new` and `session/load` only once every MCP server it connects has listed its tools, so a session this
   * turn opened has TeamRun's tools listed by its answer or never will; the adapter then checks them at once rather than waiting for them.
   * Absent for an agent that doesn't.
   * @param initialized The agent's `initialize` answer.
   */
  listsToolsBeforeSession?(initialized: JsonReader): boolean;

  /**
   * Reads, once TeamRun's tools are missing from a turn, whether the agent left out every MCP server because it doesn't trust the turn's folder:
   * the reason for the chat's note, or `null` when nothing says so. Absent for an agent with no such rule.
   * @param initialized The agent's `initialize` answer.
   * @param environment The base environment the turn launched the agent with.
   * @param workingDirectory The turn's folder, or `null` for the agent's own.
   */
  readUntrustedFolder?(initialized: JsonReader, environment: NodeJS.ProcessEnv, workingDirectory: string | null): string | null;

  /**
   * Reads what can leave TeamRun's tools out, for the chat's note when they're missing from a turn in a folder the agent trusts, or `null` when
   * the agent gives no such reason; absent for an agent with no such rule.
   * @param initialized The agent's `initialize` answer.
   */
  readMissingTools?(initialized: JsonReader): string | null;

  /**
   * Reads the instruction files the agent's tool doesn't read itself in TeamRun: the person's own from their home, and the project's where the tool
   * reads none of those either. The adapter puts them ahead of the teammate role in a new session's first prompt, and again in the first prompt after
   * a compaction, since the session keeps its prompts in its history.
   * @param environment The environment the session's launch was built from, the person's current one, so the files are those their tool would read now.
   * @param workingDirectory The turn's folder.
   * @returns The files' text naming each file, or `null` when there is none.
   */
  readHomeInstructions?(environment: NodeJS.ProcessEnv, workingDirectory: string | null): string | null;
  /**
   * Reads a message chunk the agent sends as its answer in place of an error, as Cursor does when its run fails. The turn leaves such a chunk
   * out of its text and fails with the error once the prompt ends.
   * @param text The chunk's text.
   * @returns The error to fail the turn with, or `null` when the chunk is ordinary text.
   */
  readRefusal?(text: string): Error | null;

  /**
   * Clears what the agent's sign-in check reads, after the server answered ACP's `logout`.
   */
  forgetSignIn?(provider: Provider): void;

  /**
   * Readies a new provider's empty profile folder before its sign-in terminal can open, as the agent's first launch would.
   */
  prepareProfile?(provider: Provider): void;

  /**
   * Reads a new session's answer to `session/new`, from a turn or a sign-in check, for an agent that learns its modes from its sessions; absent for an
   * agent whose modes are known.
   */
  readSession?(session: JsonReader): void;

  /**
   * The command the agent signs in with in a terminal, or `null` when it has none.
   */
  readTerminalSignIn?(initialized: JsonReader): ProviderSignInCommand | null;

  /**
   * The command the agent's turns start, found again on each call, or `null` when it isn't found; a kind whose profile names a sign-in command
   * signs in in a terminal through this command's copy (`TerminalSignIn.of`).
   */
  currentCommand?(): ProcessCommand | null;

  /**
   * Reads the agent's reply usage, context use and plan use beyond ACP, or `null` when the agent reports only ACP's `usage_update`.
   */
  readonly usage: IAcpUsageReader | null;

  /**
   * Reads the signed-in account through an extension method, or `null` when the agent reports none over ACP.
   */
  readonly account: IAcpAccountReader | null;

  /**
   * Lists the agent's models through an extension method when its `initialize` answer lists only its `fallbackModels`; absent for an agent
   * that has none. The listing asks it on the same connection, and keeps the first list when it isn't offered, fails or names no models.
   */
  readonly modelList?: IAcpModelListReader;

  /**
   * Lists the agent's own MCP servers through an extension method; absent for an agent that offers none. It wins over
   * `listOwnMcpServers`.
   */
  readonly ownMcpServers?: IAcpOwnMcpServersReader;

  /**
   * How a running turn takes a person's message, through an extension method or a marked prompt; absent for an agent that can't take one,
   * so its turns offer no steer and the message waits for the turn to end.
   */
  readonly steering?: IAcpSteering;

  /**
   * Lists each model's effort levels with a command of the agent's own, run after the listing session; absent for an agent whose session
   * options name the levels.
   */
  readonly levels?: IAcpLevelReader;

  /**
   * Reads the agent's plan after a completed tool call, as Copilot's to-do list, or `null` when the agent reports its plan only over ACP.
   */
  readonly toDos: IAcpToDoReader | null;

  /**
   * Reads the agent's own question requests, such as Grok's `x.ai/ask_user_question` or Cursor's `cursor/ask_question`, and writes their answers;
   * `null` when the agent asks only through `elicitation/create`, so a turn refuses any other request as unsupported.
   */
  readonly questions: IAcpQuestionReader | null;
  /**
   * Reads the agent's own plan requests, such as Cursor's `cursor/create_plan`, and writes their answers; `null` or absent when the agent has none.
   */
  readonly plans?: IAcpPlanReader | null;
  /**
   * Reads the to-do list the agent sends in its own notification as it works, such as Cursor's `cursor/update_todos`; `null` or absent when
   * the agent sends none.
   */
  readonly toDoList?: IAcpToDoListReader | null;
}

/**
 * Reads an agent's own question request into the person's questions, and writes the answer the agent expects.
 */
export interface IAcpQuestionReader {
  /** The request methods the agent asks through, each under every name the agent uses. */
  readonly methods: readonly string[];
  /** The native kind the asks show, such as Grok's `ask_user_question`. */
  readonly nativeKind: string;
  /**
   * Whether the request is one of the agent's questions; one of `methods` that isn't, such as Antigravity's permission request for a tool,
   * takes the turn's usual path for that method.
   */
  claims(params: JsonReader): boolean;
  /**
   * The request's questions, or `null` when there is none or one doesn't read; a turn then answers as if the person dismissed them.
   */
  read(params: JsonReader): readonly ApprovalQuestion[] | null;
  /**
   * The answer to send for the request `params` holds: the person's answers, or `null` when they dismissed the questions, the turn stopped or
   * the request didn't read.
   */
  reply(params: JsonReader, answers: readonly QuestionAnswer[] | null): JsonObject;
}

/**
 * Reads an agent's own plan request into the plan the person approves, and writes the answer the agent expects.
 */
export interface IAcpPlanReader {
  /** The request methods the agent hands its plan over with. */
  readonly methods: readonly string[];
  /** The native kind the plan's approval shows, such as Cursor's `create_plan`. */
  readonly nativeKind: string;
  /** Whether the agent leaves its plan mode by itself once told the plan is approved, as Grok does; a turn otherwise switches it out first. */
  readonly leavesPlan: boolean;
  /**
   * The request's plan: its Markdown text and its to-dos as steps; `null` when the agent handed over no plan, and a turn then answers as if the
   * person dismissed it.
   * @throws JsonException when the request doesn't read, and a turn then notes it with `Resources.formatPlanUnread` and answers as dismissed.
   */
  read(params: JsonReader): { readonly text: string; readonly steps: readonly PlanStep[] } | null;
  /**
   * The answer to send for the request `params` holds: `true` when the person approved the plan, `false` when they refused it, or `null` when
   * they dismissed it, the turn stopped or the request didn't read.
   */
  reply(params: JsonReader, approved: boolean | null): JsonObject;
}

/**
 * How an ACP agent's running turn takes a person's message. `AcpAdapter` offers it once its turn's prompt is sent and withdraws it when the
 * turn ends; a request that fails counts as refused. A steer still unanswered when the turn ends, as fx answers at its turn's end, is waited for,
 * up to the request timeout, before the agent's process closes, so a steer the agent took isn't counted as refused and sent again.
 */
export interface IAcpSteering {
  /**
   * The method to call, then its other spelling when the agent doesn't know the first.
   */
  readonly methods: readonly string[];

  /**
   * Builds the request.
   * @param sessionId The running turn's session.
   * @param steer The person's message.
   * @param blocks The message as the prompt's content blocks: its text, its images and, where the agent takes them, links to its other files.
   * @returns The params, or `null` when the agent can't take this message during a turn, such as one with an image.
   */
  paramsOf(sessionId: string, steer: TurnSteer, blocks: readonly JsonValue[]): JsonObject | null;

  /**
   * Reads whether the agent took the message.
   * @param result The request's result.
   */
  took(result: JsonReader): boolean;
}

/**
 * Reads an ACP agent's plan from where it keeps it beyond ACP.
 */
export interface IAcpToDoReader {
  /**
   * Reads the plan after a completed tool call of the turn's session, with the provider whose profile folder the agent uses.
   * @returns The steps, or `null` when the tool call changed no plan or the plan can't be read.
   */
  read(tool: JsonReader, sessionId: string, provider: Provider | null): readonly PlanStep[] | null;
}

/**
 * Reads the to-do list an ACP agent sends in its own notification as it works into the reply's plan.
 */
export interface IAcpToDoListReader {
  /** The notification methods the agent sends its to-do list with. */
  readonly methods: readonly string[];
  /**
   * The list's steps after the notification `params` holds.
   * @throws JsonException when the notification doesn't read, and a turn then notes it with `Resources.formatToDoListUnread`.
   */
  read(params: JsonReader): readonly PlanStep[];
}

/**
 * Reads an ACP agent's own MCP servers through its extension method; asking it starts no session, sends no prompt and
 * connects no server.
 */
export interface IAcpOwnMcpServersReader {
  /**
   * The methods that answer the list, tried in order while the agent answers `-32601`.
   */
  readonly methods: readonly string[];

  /**
   * Reads the servers from a method's answer, without `teamrun`.
   * @throws JsonException when the answer isn't the list the method gives.
   */
  read(answer: JsonValue): readonly OwnMcpServer[];
}

/**
 * Lists an ACP agent's effort levels per model with a command of its own. The listing runs it once, with the timeout of a request, keeping up
 * to `Resources.levelListOutputLength` (16M) characters of its output, and on success gives each model it lists those levels, with the first
 * as its default effort, the one the agent runs a newly chosen model at, and an empty list naming none; a model it doesn't list, or a run
 * that can't start, fails or times out, keeps the levels the session's options name.
 */
export interface IAcpLevelReader {
  /**
   * The command that lists the levels, started like the agent with `environment`, the person's environment.
   * @throws Error when the agent's program isn't found.
   */
  launch(provider: Provider | null, environment: NodeJS.ProcessEnv): AcpLaunch;

  /**
   * Reads the levels by model id from the command's output, in the order it lists them.
   */
  read(output: string): ReadonlyMap<string, readonly string[]>;
}

/**
 * Reads an ACP agent's signed-in account through its extension method; asking it starts no session and sends no prompt.
 */
export interface IAcpAccountReader {
  /**
   * The methods that answer the account, tried in order while the agent answers `-32601`.
   */
  readonly methods: readonly string[];

  /**
   * The methods that answer the account's plan, tried in order while the agent answers `-32601`.
   */
  readonly planMethods: readonly string[];

  /**
   * Reads the account from a method's answer, or `null` when it names none.
   */
  read(answer: JsonValue): ProviderIdentity | null;

  /**
   * Reads the plan's name from a plan method's answer, or `null` when it names none.
   */
  readPlan(answer: JsonValue): string | null;
}

/**
 * Names an ACP agent's sign-out methods and reads their answer.
 */
export interface IAcpSignOutReader {
  /**
   * The methods that sign the profile out, tried in order while the agent answers `-32601`.
   */
  readonly methods: readonly string[];

  /**
   * Reads a method's answer: why the profile may still be signed in, or `null` when it signed out.
   */
  read(answer: JsonValue): string | null;
}

/**
 * Keeps a provider's models, as a turn's session named them, for its model listings.
 */
export interface IAcpModelStore {
  /**
   * Replaces the provider's kept models.
   * @throws Error when they can't be written; the turn that names them goes on.
   */
  keep(provider: Provider | null, models: readonly ProviderModel[]): void;

  /**
   * Returns the provider's kept models, or `null` when none are kept or they can't be read.
   */
  read(provider: Provider | null): readonly ProviderModel[] | null;
}

/**
 * Reads an ACP agent's usage beyond ACP: its prompt answer's usage, and the extension methods it answers with context and plan use.
 */
export interface IAcpUsageReader {
  /**
   * The methods that answer the session's context use, tried in order while the agent answers `-32601`.
   */
  readonly contextMethods: readonly string[];
  /**
   * The methods that answer the provider's plan use, tried in order while the agent answers `-32601`.
   */
  readonly planMethods: readonly string[];

  /**
   * Reads the reply usage from the `session/prompt` answer, or `null` when it carries none.
   */
  readReply(result: JsonValue): ReplyUsage | null;

  /**
   * Reads the context use from a context method's answer, or `null` when it's out of shape.
   */
  readContext(answer: JsonValue): ContextUsage | null;

  /**
   * Reads the plan windows from a plan method's answer, or `null` when it's out of shape.
   */
  readPlan(answer: JsonValue): readonly PlanWindow[] | null;
}

/**
 * The process an ACP agent runs in.
 */
export declare class AcpLaunch {
  public readonly command: ProcessCommand;
  public readonly environment: NodeJS.ProcessEnv;
  /**
   * The process's working directory.
   */
  public readonly directory: string;

  public constructor(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string);
}

/**
 * One `select` config option an ACP session answered with, such as its model or its thought level.
 */
export declare class AcpConfigOption {
  public readonly id: string;
  /**
   * The option's category, such as `model` or `thought_level`, or `null` when it has none.
   */
  public readonly category: string | null;
  public readonly currentValue: string;
  public readonly values: readonly string[];
  /**
   * The values' names, in the values' order; a value without one is its own name.
   */
  public readonly names: readonly string[];
  /**
   * The id of the group each value sits in, in the values' order, or `null` for a value outside any group.
   */
  public readonly groups: readonly (string | null)[];
  /**
   * The name of the group each value sits in, in the values' order, or `null` for a value outside any group or in a group without one.
   */
  public readonly groupNames: readonly (string | null)[];

  /**
   * @param groups Each value's group id; none by default.
   * @param groupNames Each value's group name; none by default.
   */
  public constructor(id: string, category: string | null, currentValue: string, values: readonly string[], names: readonly string[],
    groups?: readonly (string | null)[], groupNames?: readonly (string | null)[]);

  /**
   * Reads the `select` options of a `session/new`, `session/load`, `session/resume` or `session/set_config_option` answer; the values of
   * grouped options are read from every group, in order, each with its group's id and name.
   * @returns The options, or `null` when the answer has no `configOptions`.
   */
  public static readAll(answer: JsonReader): readonly AcpConfigOption[] | null;

  /**
   * Returns the option with another current value.
   */
  public withValue(value: string): AcpConfigOption;

  /**
   * Returns a value's name, or the value when the option doesn't list it.
   */
  public nameOf(value: string): string;

  /**
   * Returns what TeamRun logs of the option: its id, category and current value, and each value with its name, group and group name; nothing else.
   */
  public toLog(): JsonObject;
}

/**
 * A config option that turns one of an ACP agent's listed modes on and off, apart from its `mode` option, such as Copilot's `allow_all`.
 */
export declare class AcpPermissionSwitch {
  /** The config option's id. */
  public readonly optionId: string;
  /** The id of the listed mode the option carries while on. */
  public readonly mode: string;
  /** The option's value that turns the mode on. */
  public readonly onValue: string;
  /** The option's value that turns the mode off. */
  public readonly offValue: string;

  /**
   * @throws ArgumentException when a part is blank.
   */
  public constructor(optionId: string, mode: string, onValue: string, offValue: string);
}

/**
 * The MCP server and tool an ACP agent's permission request is for, as the agent names them.
 */
export declare class AcpMcpTool {
  /** The server's name, as the session's `mcpServers` gave it, such as `teamrun`. */
  public readonly server: string;
  /** The tool's name on that server. */
  public readonly tool: string;

  /**
   * @throws ArgumentException when a part is blank.
   */
  public constructor(server: string, tool: string);

  /**
   * Returns the server and tool, or `null` unless both are strings that aren't blank.
   */
  public static of(server: JsonValue | undefined, tool: JsonValue | undefined): AcpMcpTool | null;

  /**
   * Reads the server and tool from the object found by following `path`'s fields from a permission request's tool call, or `null`
   * when a field on the way is missing, `null` or not an object, or when either part isn't a string that isn't blank.
   */
  public static read(call: JsonReader, path: readonly string[], server: string, tool: string): AcpMcpTool | null;
}

/**
 * Where an ACP agent's own naming rule places one choice of a session's flat `model` option: the model it belongs to, and the level it is there.
 */
export declare class AcpModelMember {
  /** The id of the model the choice belongs to. */
  public readonly familyId: string;
  /** The name of the model the choice belongs to. */
  public readonly familyName: string;
  /** The choice's name as a level of that model, such as `High`. */
  public readonly levelName: string;

  /**
   * @throws ArgumentException when a part is blank.
   */
  public constructor(familyId: string, familyName: string, levelName: string);
}

/** An ACP session's speed option: the option's id, and the speed each of its choices means. */
export declare class AcpSpeedOption {
  /** The option's id, such as fx's `fast`. */
  public readonly id: string;
  /** The speeds a model listing offers, in order. */
  public readonly speeds: readonly ProviderSpeed[];
  /** The option's choice for each of `speeds`, in the same order. */
  public readonly values: readonly string[];

  /**
   * @param choices Each speed with the option's choice that sets it.
   * @throws ArgumentException when `id` is blank, or `choices` is empty or gives two speeds the same choice.
   */
  public constructor(id: string, choices: readonly (readonly [ProviderSpeed, string])[]);

  /** The session's option with this id that offers every one of `values`, or `undefined`. */
  public find(options: readonly AcpConfigOption[]): AcpConfigOption | undefined;
  /** The choice that sets `speed`, or `null` for a speed this option doesn't offer. */
  public valueOf(speed: string): string | null;
  /** The speed the session's option is set to, or `null` when the session lists no such option. */
  public servedIn(options: readonly AcpConfigOption[]): string | null;
  /** The speed a choice means, or `null` for a choice that's none of `values`. */
  public speedOf(value: string): string | null;
}

/**
 * The models an ACP session's `model` option offers: each value is a model, except that values that share a family are that model, whose
 * levels are those values. When the option groups its values, a group whose values' names are all level words, alone or as "<group> (<level>)", is a
 * family, named by the group and its levels by those words, and any other group's values stay models of their own;
 * when it is flat, the agent's own naming rule places values in families, and a plain value with a family's id and name is its "Standard" level.
 * A family joins only with two or more members that share its name and no other value with its id; otherwise its values stay models of their own.
 * A family's default level is its Standard level when it has one, else the session's current value when it is one of the family's.
 */
export declare class AcpModelChoices {
  /**
   * @param option The session's `model` option.
   * @param memberOf The agent's naming rule for a flat option, `IAcpAgent.memberOf`; a grouped option doesn't use it.
   */
  public constructor(option: AcpConfigOption, memberOf: (value: string, name: string) => AcpModelMember | null);

  /**
   * Returns the models, in the option's order: a model the naming rule joins has its members as levels, named by their level names, its
   * default level the option's current value when that is one of them; any other model takes `levels`' values, names and current value as its
   * levels.
   * @param supportsImages Whether the agent takes images, or `null` when unknown.
   * @param levels The session's `thought_level` option, if it has one.
   */
  public models(supportsImages: boolean | null, levels: AcpConfigOption | undefined): readonly ProviderModel[];

  /**
   * Returns the value a turn sets the option to for a model and level, and whether the level was one of a joined model's values: a joined
   * model's chosen level when it is one of them, else the option's current value when it is, else its first value; any other model as it is.
   * A `null` model is the model of the option's current value.
   */
  public resolve(model: string | null, effort: string | null): [value: string | null, takesEffort: boolean];

  /**
   * Returns the joined model a value belongs to, or `null` when it belongs to none.
   */
  public familyOf(value: string): string | null;
}

/**
 * One field of an ACP `elicitation/create` form, as the question TeamRun asks for it: a string with `enum`,
 * `oneOf` or `anyOf` choices asks for one of them, an array of such strings for any of them, a boolean
 * for Yes or No, and a plain string, number or integer for the person's own answer.
 */
export declare class AcpField {
  /**
   * The field's JSON Schema type, such as `string` or `array`.
   */
  public readonly type: string;
  /**
   * The values of the field's choices, in the order of the question's options.
   */
  public readonly values: readonly string[];
  public readonly question: ApprovalQuestion;

  public constructor(type: string, values: readonly string[], question: ApprovalQuestion);

  /**
   * Reads one property of a form's `requestedSchema`; the question is the property's name, headed by its
   * `title` and worded by its `description`, or else by the form's message.
   * @throws Exception when the property has no type, or when its choices don't make a question.
   */
  public static read(name: string, field: JsonReader, message: string): AcpField;

  /**
   * Returns an answer as the field's value: the chosen choice's value, every chosen value for an array, `true`
   * for Yes, the person's own text, or the number it holds.
   * @returns The value, or `undefined` when a number or integer field's answer is not one.
   */
  public toValue(answer: QuestionAnswer): JsonValue | undefined;
}

/**
 * The shared provider adapter for agents that speak ACP; each agent's own part is an `IAcpAgent`.
 *
 * When the agent's `initialize` offers HTTP MCP servers and the turn's `McpEndpoint` serves, the adapter issues each process a token,
 * sends the endpoint in `session/new` and `session/load` `mcpServers` with the token as its `Authorization` header, never in the agent's
 * arguments or environment, and revokes the token once the process closes. A turn with TeamRun's tools fails when the agent offers no
 * HTTP MCP servers or the endpoint isn't serving, saying which.
 */
export declare class AcpAdapter implements IProviderAdapter {
  /**
   * `true`: its turns take TeamRun's tools. A turn of an agent that `awaitsTeamRunTools` whose tools aren't listed within `Resources.teamRunToolsWait` gets the request's `instructionsWithoutTools`.
   */
  public readonly takesTeamRunTools: boolean;
  /**
   * The agent's descriptor.
   */
  public readonly descriptor: ProviderKind;
  /**
   * The agent's profile search; absent when the agent has none.
   */
  public readonly profileSearch?: ProfileSearch;
  /** The agent's `modes`. */
  public readonly modes: readonly ProviderMode[];
  /** The agent's `defaultMode`. */
  public readonly defaultMode: string | null;
  /**
   * The agent's `planMode`, or `null`; a plan-first turn runs in it, with everything else it asked for, and once the person approves a plan
   * through the agent's `plans`, the session switches with `session/set_mode` to the mode the turn asked for, or the default when that is the plan
   * mode, the launch mode, the permission switch's mode or isn't listed.
   */
  public readonly planMode: string | null;
  /**
   * The agent's own `backgroundSubAgentsNote`, what its teammates' instructions say of background sub-agents past the turn, or `null` when they
   * need no word: the adapter keeps a process past the turn only for an agent that `followsTasks`.
   */
  public readonly backgroundSubAgentsNote: string | null;

  /**
   * Creates the adapter; its ACP clients' stops wait on the timer, by default `NodeTimer`.
   * @param savedImages Reads the images the agent's own image tools save; none by default.
   * @param processTree Confirms and ends a background task's process tree, for its Stop, and ends what an agent started when it stops; by
   * default `ProcessTree` on this platform, on the timer, with the timings' `stopGrace` as its grace, `Resources.processListTimeout` for each
   * listing, and `PowershellSession.shared` on Windows.
   * @param idleTimer Tells the time a kept session has had no turn, for `timings.idleLimit`, and its background work has been silent, for
   * `timings.silenceLimit`; a `NodeTimer` by default.
   */
  public constructor(agent: IAcpAgent, clientInfo: AppServerClientInfo, starter: IProcessStarter, timings: ProviderTimings, timer?: ITimer,
    savedImages?: ISavedImageReader | null, log?: ILog | null, processTree?: IProcessTree, idleTimer?: ITimer);

  /**
   * Takes a shared MCP server whose transport is in the agent's `sharedServerTransports`, but none that names TeamRun's sender token, as
   * `SharedMcpLaunch.refusalOf` says; otherwise it is unavailable with the agent's `sharedServerRefusal`, or `Resources.formatSharedMcpUnconfirmed` without one, and a server
   * of a taken transport is unavailable with the agent's `sharedServerNameRefusal` for the provider and folder.
   * A turn's servers go into `mcpServers` on `session/new` and `session/load` before TeamRun's own:
   * a stdio server through `SharedMcpLaunch`, TeamRun's launcher, with its variables' values and `ELECTRON_RUN_AS_NODE` as `env`, and an HTTP server with its
   * headers' values and its bearer token as `Authorization`, read from the person's current environment as the session starts, never in the
   * agent's arguments, a log or TeamRun's database.
   * An HTTP server fails the turn when the agent's `mcpCapabilities` don't have `http`.
   * @param server The server's definition.
   * @param provider The provider the server would reach, or `null`.
   * @param workingDirectory The turn's folder, or `null` for the panel's listing.
   * @returns Why the agent can't take it, or `null`.
   */
  public sharedServerUnavailable(server: SharedMcpServerDefinition, provider?: Provider | null, workingDirectory?: string | null): SharedMcpRefusal | null;

  /**
   * Takes a shared server's saved secrets wherever `sharedServerUnavailable` takes the server: each saved value goes on `session/new` and
   * `session/load`, over the agent's input, as the environment's values do, which the agent's `sharedServerTransports` confirm it keeps out
   * of its session files.
   * @returns `null`.
   */
  public savedSecretsUnavailable(): SharedMcpRefusal | null;

  /**
   * Reads the models `initialize` advertises, without a prompt and without `authenticate`; none when the agent names them only in a session's config
   * options. Signed out, with no models and no agent started, when the agent's own check says so; otherwise signed in when `initialize`
   * offers its saved sign-in method. An agent with `turnModels` starts nothing and lists the models its provider's last fresh turn kept, or none,
   * awaiting a turn, before the first. An agent TeamRun doesn't authenticate opens a `session/new` instead: signed out, with no models, when it
   * refuses with `-32000`, and otherwise signed in, with the values of its `model` config option, if any, each with the descriptor's efforts.
   * Every list names the agent's modes and default mode.
   */
  public listModels(provider: Provider | null): Promise<ProviderModelList>;

  /**
   * Adds the agent's modes and default mode to a list of its models.
   * @param list The list.
   * @returns The list with `modes` and `defaultMode` from the agent.
   */
  protected withModes(list: ProviderModelList): ProviderModelList;

  /**
   * Reads the provider's plan use now.
   * @param provider The provider, or `null` for the default profile.
   * @returns The windows the agent's usage reader reads from its plan methods, tried in order while the agent answers `-32601`, each under its own name, none when the agent has no usage reader, or `null` when it can't sign in, or a method fails or answers in another shape; a figure is never estimated.
   */
  public readPlanUsage(provider: Provider | null): Promise<PlanReading | null>;

  /**
   * Lists the agent's own MCP servers: through the agent's extension method when it has one, from a client that starts no
   * session, or from the agent's files.
   * @param provider The provider, or `null` for the default profile.
   * @returns The servers, or `null` when the agent offers no list, or answers `-32601` to each of its methods.
   * @throws Error when the agent can't sign in without the person, or its list fails or can't be read.
   */
  public listOwnMcpServers(provider: Provider | null): Promise<readonly OwnMcpServer[] | null>;

  /**
   * Checks only the agent's own noninteractive sign-in, or for an agent TeamRun doesn't authenticate, whether a `session/new` is refused
   * with `-32000`; never opens a login flow. An agent whose sign-in is interactive is signed in when `initialize` offers its method, with no
   * `authenticate`.
   * A signed-in check carries the account its `IAcpAgent.account` reads, with the plan the reader's plan method names, and none when the
   * agent has no reader, the methods are unknown or the answer fails or names none; the check doesn't fail for it.
   * A provider the agent knows is signed out is reported so without starting the agent, unless it has a `binaryPath`: then the check starts
   * that server once, as a sign-in launch does since its profile holds no sign-in, so a version the agent doesn't accept fails the check with the
   * agent's reason, and an accepted one reads as signed out.
   */
  public checkSignIn(provider: Provider): Promise<SignInCheck>;

  /**
   * Starts the server a launch with no provider runs, as a sign-in launch does, so it starts without a sign-in, reads its version from
   * `initialize`, which it doesn't check, and stops it.
   * @returns The version, or `null` when `initialize` names none.
   * @throws Error when the server can't start or `initialize` fails.
   */
  public readServerVersion(): Promise<string | null>;

  /**
   * Checks a folder discovery found from the agent's own files alone, through `IAcpAgent.isSignedIn`, and starts no agent: `LoggedIn` or `LoggedOut`
   * with no identity, or `Unknown` for an agent that can't tell without starting.
   */
  public checkFoundSignIn(provider: Provider): Promise<SignInCheck>;

  /**
   * Has the agent's `prepareProfile` ready the new provider's folder; does nothing for an agent without one.
   */
  public prepareProfile(provider: Provider): void;

  /**
   * For a kind whose profile names a sign-in command, that command through the copy its turns run (`TerminalSignIn.of` with
   * `IAcpAgent.currentCommand`), with nothing started; else the command the agent's own `terminal` sign-in method runs, or `null` when it has none.
   */
  public readSignInCommand(provider: Provider): Promise<ProviderSignInCommand | null>;

  /**
   * Starts the agent in the profile's environment, but with the person's own home and app-data folders, X authority file and `BROWSER`
   * from its `IAcpAgent`'s base environment, so the browser it opens has the person's usual profile and can open the display, and authenticates with the sign-in its `IAcpAgent` names, such
   * as Grok's browser sign-in; resolves without one when the agent already offers the profile's noninteractive sign-in. An agent TeamRun doesn't
   * authenticate, such as Copilot, signs in only through its own sign-in method, if it names one.
   * @param provider The provider whose profile signs in.
   * @param signal Aborts the sign-in, which stops the agent.
   * @returns A promise that resolves when the agent reports the sign-in done.
   * @throws Error when the agent is missing or offers no sign-in TeamRun can start.
   */
  public signIn(provider: Provider, signal: AbortSignal): Promise<void>;

  /**
   * Starts the agent in the profile's environment and sends its `IAcpAgent`'s sign-out request after `initialize`, within the sign-in check's time.
   * @param provider The provider whose profile signs out.
   * @returns A promise that resolves when the agent answers.
   * @throws Error when the agent signs out only in its own terminal, is missing, or answers with an error or not in time.
   */
  public signOut(provider: Provider): Promise<void>;

  /**
   * Runs an isolated turn, a chat's title or a handover summary, in a session of the agent's `isolatedMode`; absent for an agent without one, such
   * as an added agent, which isn't asked. Answers `null` without starting the agent while its `hasNoIsolatedAsk` holds for the request's provider.
   */
  public readonly askIsolated?: (request: TurnRequest, listener: ITurnListener, signal: AbortSignal) => Promise<TurnResult | null>;

  /**
   * Runs a turn with streaming, approvals and bounded cancellation.
   * A resume uses `session/resume` when the agent prefers and advertises it, and `session/load` otherwise.
   * A resume that the agent refuses starts a fresh session on the request's fresh prompt, with a note naming the cause, as `AcpSessionOpener` does.
   * When the agent exits during the resume, the fresh session opens in a new process, unless the adapter shut down meanwhile.
   * A fresh session's `model` config option is kept as the provider's models when the agent has `turnModels`; a failure to keep them doesn't fail the turn.
   * A session with config options gets the requested model and effort through `session/set_config_option`, and fails before the prompt when it offers neither,
   * except an effort the agent takes at launch;
   * a session without them switches a resumed session's model with `session/set_model`.
   * The session then runs in the listed mode its teammate or chat chose, an unrestricted one included, or else the agent's default: through its `mode` config option when it has one,
   * and otherwise through `session/set_mode` when its start names the mode in `modes.availableModes`; only a mode that differs from the current one is set.
   * A chosen mode other than the default that the session doesn't offer fails the turn before the prompt; a default it doesn't offer leaves the session as it started.
   * A turn in the agent's `launchMode`, its `permissionSwitch`'s mode or its `allowAllMode` runs in the default session mode, and in its `allowAllMode`
   * the turn allows each permission request the agent sends.
   * The agent's `permissionSwitch` is then turned on when its mode is the one chosen, and off when another is and the session starts with it on,
   * except in another unrestricted mode, such as Copilot's Autopilot, which turns the switch on itself. A session still in an unrestricted mode
   * when the chosen one isn't unrestricted, by its mode option, its `modes.currentModeId` or its permission switch, fails the turn before the prompt.
   * For an agent TeamRun doesn't authenticate, a request refused with `-32000` fails the turn with the agent's sign-in text.
   * Images go inline, and other attachments as `resource_link` entries when the agent sends them.
   * A turn aborted before its prompt is sent ends interrupted without sending it.
   * A new session's reply costs the session's cost so far; a loaded session's reply has no cost, since whether the cost continues after
   * `session/load` is unknown.
   */
  public runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult>;

  /**
   * Retires the agents kept for these sessions, so each closes once its work ends, an idle one now, and no turn takes it; a session running
   * a turn is retired when that turn ends.
   * @param nativeSessionIds The deleted chat's sessions.
   * @returns At once; the agents close on their own.
   */
  public closeSessions(nativeSessionIds: readonly string[]): Promise<void>;

  /**
   * Forks a session through a prompt with the agent's `forkMethods`, trying each name while the agent answers that the method is unknown,
   * in a process that starts and ends for the fork; the turn id is the prompt index the agent's echo of the prompt carried, kept with its reply.
   * @param request What to fork.
   * @returns The new session, as the forked session.
   * @throws Error with `Resources.formatForkUnavailable` when the agent has no fork method, with `Resources.formatPromptIndexInvalid` when the
   * turn id isn't a prompt index, or the agent's refusal.
   */
  public forkSession(request: ForkRequest): Promise<ForkedSession>;

  /**
   * Checks whether the model the agent starts with is missing from the models listed for the provider's profile, so the agent runs its default instead.
   * When it may be, the turn starts with no model observed and the requested one marked unavailable, and a completed turn keeps that only when the check
   * confirms it; every other turn drops it. `null` here; Copilot returns `null` with no list kept or the model in it, and otherwise lists again.
   * @param provider The turn's provider, or `null`.
   * @param model The requested model.
   * @returns `null` when the model isn't missing as far as the adapter knows, or whether a fresh listing confirms it missing; it never rejects.
   */
  protected checkUnavailableModel(provider: Provider | null, model: string): Promise<boolean> | null;

  /**
   * Reports the plan use after a failed turn, before the failure is reported; never for a stopped turn or one that failed before its client
   * started.
   * @param client The turn's client, still open.
   * @param provider The turn's provider, or `null`.
   * @param listener Receives the plan use.
   * @param error What the turn failed with.
   * @returns At once, with nothing reported; Copilot reads its quota again, and reports a refusal for quota as the budget used up.
   */
  protected reportPlanAfterFailure(client: AcpClient, provider: Provider | null, listener: ITurnListener, error: unknown): Promise<void>;

  /**
   * Reads the provider's plan use after a completed reply, so the plan the reply used shows. The agent's plan methods are asked on the reply's own client,
   * and nothing is reported when the agent has none or can't say; Copilot reads its quota through its headless server instead, without holding the reply,
   * and only for a provider whose last quota read reported a plan.
   * @param client The reply's client, still open.
   * @param provider The reply's provider, or `null`.
   * @param listener Receives the plan use.
   * @param reply The reply's last text, as `AcpTurn.lastText` holds it.
   * @returns When the plan use is reported, or, for Copilot, once its read has started; it never rejects.
   */
  protected reportPlanUsage(client: AcpClient, provider: Provider | null, listener: ITurnListener, reply: string): Promise<void>;

  /**
   * Reports the plan use to the listener, when there is any.
   * @param listener Receives the plan use.
   * @param windows The windows, or `null` when the provider couldn't say.
   * @param readAt When the read began, as ISO 8601.
   * @returns Once the listener has taken the plan use; it rejects when the listener does.
   */
  protected static reportPlanAsync(listener: ITurnListener, windows: readonly PlanWindow[] | null, readAt: string): Promise<void>;

  /**
   * Stops each running task it follows, waiting for those stops at most the timings' `interruptTimeout`, then stops every owned ACP process.
   */
  public shutdown(): Promise<void>;
}

/**
 * The Grok part of the shared ACP adapter: its home, environment, `--model` and `--reasoning-effort` arguments, `cached_token` sign-in,
 * the models in `initialize`'s `_meta`, and `refusal` as a completed turn.
 */
export declare class GrokAgent implements IAcpAgent {
  public readonly descriptor: ProviderKind;
  public readonly baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch;
  public readonly toolTitle: string;
  public readonly authMethod: string;
  public readonly usage: IAcpUsageReader;
  public readonly account: IAcpAccountReader;
  /** Lists Grok's catalog through `x.ai/models/list` once its first answer lists only its built-in models. */
  public readonly modelList: IAcpModelListReader;
  public readonly toDos: IAcpToDoReader | null;
  public readonly questions: IAcpQuestionReader;
  public readonly plans: IAcpPlanReader;
  public readonly ownMcpServers: IAcpOwnMcpServersReader;
  /** Grok's `x.ai/interject`. */
  public readonly steering: IAcpSteering;
  public readonly authMeta: JsonObject;
  public readonly initializeMeta: JsonObject | null;
  public readonly stopReasons: readonly string[];
  public readonly prefersResume: boolean;
  public readonly forkMethods: readonly string[];
  public readonly sendsResourceLinks: boolean;
  public readonly signInUnavailable: string;
  public readonly signOut: IAcpSignOutReader;
  public readonly logsOut: boolean;
  public readonly authenticates: boolean;
  public readonly effortAtLaunch: boolean;
  public readonly modelAtLaunch: boolean;
  public readonly fallbackModels: readonly string[];
  public readonly compacts: boolean;
  public readonly sharedServerTransports: readonly SharedMcpTransport[];
  public readonly sharedServerRefusal: SharedMcpRefusal | null;
  public readonly followsTasks: boolean;
  public readonly backgroundSubAgentsNote: string | null;
  public readonly routedMcpTool: string | null;
  public readonly awaitsTeamRunTools: boolean;
  public readonly interactiveSignIn: boolean;
  public readonly modes: readonly ProviderMode[];
  public readonly defaultMode: string | null;
  /** The mode an isolated session, a title's or a handover summary's, starts in: Grok's Ask mode, which reads and answers and changes nothing. */
  public readonly isolatedMode: string;
  public readonly planMode: string;
  public readonly takesUnlistedModes: boolean;
  public readonly permissionSwitch: AcpPermissionSwitch | null;
  public readonly launchMode: string | null;
  public readonly turnModels: IAcpModelStore | null;

  /**
   * The kind's profile folder is the person's own Grok home, and its own MCP servers show as Grok's to run.
   * @param formerProfileDirectory The folder TeamRun once made for Grok, read as the person's own home.
   * @param home Where each provider's Grok home is; from the environment and `formerProfileDirectory` by default.
   * @param shortHome What a launch names as `GROK_HOME` when the Grok home is too deep for Grok's saved images on Windows.
   */
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, formerProfileDirectory: string, locate?: () => ProcessCommand | null,
    home?: GrokHome, shortHome?: GrokShortHome);

  /**
   * Launches Grok in the provider's Grok home, with `GrokEnvironment`, from the person's home folder, with `--permission-mode bypassPermissions`
   * for Always-approve and `--permission-mode default` otherwise, and without its own sub-agents in a read-only mode; Grok's own settings,
   * memory, rules and MCP servers apply, and TeamRun writes none of its files. A launch with no requested settings is outside a chat turn,
   * so its memory is off. A title session runs in `GrokHome.titleDirectory`, made if missing, signed in through the provider's Grok home's
   * `auth.json`, or the person's own `GROK_AUTH_PATH` for their home, so it reads none of the person's instructions, memory, configuration or
   * MCP servers.
   * @param approvedTools Unused: the turn allows the approved tools of TeamRun's server when Grok asks about them.
   * @param environment The environment the agent's own is built from; `baseEnvironment` by default.
   * @param _chatTurn Unused: Grok's servers don't follow the own-servers switch.
   * @param titleSession Whether it starts a title session; `false` by default.
   * @throws Error when Grok isn't installed.
   */
  public launch(provider: Provider | null, requested: RequestedSettings | null, workingDirectory?: string | null, approvedTools?: readonly string[] | null,
    environment?: NodeJS.ProcessEnv, _chatTurn?: boolean, titleSession?: boolean): AcpLaunch;

  /**
   * Reads the servers Grok blocked through `GrokMcpBlockReader`, from the provider's Grok home.
   */
  public readMcpBlocks(provider: Provider | null, since: string): ReadonlyMap<string, string>;

  /**
   * @returns `null`: only Grok's server can tell.
   */
  public isSignedIn(provider: Provider | null): boolean | null;
  public readModels(initialized: JsonReader): readonly ProviderModel[];
  public readVersion(initialized: JsonReader): string | null;
  public readSignInMethod(initialized: JsonReader): string | null;
  public readEffort(session: JsonReader): string | null;
  /** Returns `null`: Grok's agent has no naming rule. */
  public memberOf(value: string, name: string): AcpModelMember | null;
  public sessionMeta(requested: RequestedSettings): JsonObject | null;
  public formatUnsupported(version: string | null): string | null;
  public formatSignIn(provider: Provider | null): string;
  public formatStopped(reason: string): string;
}

/**
 * The shared ACP adapter's part for an agent TeamRun knows nothing about beyond its command, such as one from the ACP registry or a local command: it
 * runs on the agent's own sign-in in the person's environment without credentials or other providers' settings, learns its modes from each new session's `mode` config option or `modes`, signs in
 * with the first `authMethods` entry of the `agent` type, signs out with ACP's `logout`, and resumes with `session/resume` or `session/load` as the
 * agent offers. No mode is taken for unrestricted, and it can't fork, compact, or report plan usage. It takes no shared MCP server, so no saved value
 * reaches it, until a signed-in capture shows the agent keeps a server's values out of its session files.
 */
export declare class GeneralAcpAgent implements IAcpAgent {
  public readonly descriptor: ProviderKind;
  public readonly baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch | null;
  public readonly toolTitle: string;
  public readonly authMethod: string;
  /** Reads each reply's tokens from its answer's `usage`, where the agent sends it. */
  public readonly usage: IAcpUsageReader;
  public readonly account: IAcpAccountReader | null;
  public readonly toDos: IAcpToDoReader | null;
  public readonly questions: IAcpQuestionReader | null;
  public readonly authMeta: JsonObject | null;
  public readonly initializeMeta: JsonObject | null;
  public readonly stopReasons: readonly string[];
  public readonly prefersResume: boolean;
  public readonly forkMethods: readonly string[];
  public readonly sendsResourceLinks: boolean;
  public readonly signInUnavailable: string;
  public readonly signOut: IAcpSignOutReader | null;
  public readonly logsOut: boolean;
  public readonly authenticates: boolean;
  public readonly effortAtLaunch: boolean;
  public readonly modelAtLaunch: boolean;
  public readonly fallbackModels: readonly string[];
  public readonly compacts: boolean;
  public readonly compactsIfListed: boolean;
  public readonly runsTerminals: boolean;
  public readonly sharedServerTransports: readonly SharedMcpTransport[];
  public readonly sharedServerRefusal: SharedMcpRefusal | null;
  public readonly followsTasks: boolean;
  public readonly backgroundSubAgentsNote: string | null;
  public readonly routedMcpTool: string | null;
  public readonly awaitsTeamRunTools: boolean;
  public readonly interactiveSignIn: boolean;
  public readonly permissionSwitch: AcpPermissionSwitch | null;
  public readonly launchMode: string | null;
  public readonly turnModels: IAcpModelStore | null;

  /**
   * @param id The kind's id, which TeamRun keeps with its providers, chats and messages, such as the registry agent's id.
   * @param displayName The agent's name.
   * @param command The command that starts the agent's ACP server, with its arguments, or `null` when it isn't found yet.
   * @param variables The variables the agent starts with beside the person's own, such as a registry entry's `env`.
   * @param environment The person's environment the agent's own is built from.
   * @param homeDirectory The folder the agent starts in outside a turn, such as for a sign-in check.
   * @param locate Finds the command at each launch while it is `null`, so an update's new version takes effect.
   * @param program The agent's own program, without a batch file's `cmd.exe`, for a terminal sign-in.
   */
  public constructor(id: string, displayName: string, command: ProcessCommand | null, variables: Readonly<Record<string, string>> | (() => Readonly<Record<string, string>>),
    environment: NodeJS.ProcessEnv, homeDirectory: string, locate?: () => ProcessCommand | null, program?: () => string | null);

  /**
   * The command a `terminal` entry of `authMethods` signs in with, when no `agent` entry is listed: the program's name and the entry's `args`, with the program's folder put before
   * `PATH` and the entry's `env`, so any shell can run it; `null` when a word has anything a shell would read. A local command's saved values stay out of the terminal.
   */
  public readTerminalSignIn(initialized: JsonReader): ProviderSignInCommand | null;

  /**
   * The modes the last new session listed, or none before the first.
   */
  public get modes(): readonly ProviderMode[];
  /**
   * The mode the first new session ran in, kept while sessions list it, or the first listed mode; `null` before the first session.
   */
  public get defaultMode(): string | null;

  /**
   * Launches the command with the person's environment, less what `Resources.generalAcpExcludedEnvironment` names, and the agent's variables on top,
   * in the turn's folder or the home folder.
   * @throws Error when the command isn't found.
   */
  public launch(provider: Provider | null, requested: RequestedSettings | null, workingDirectory?: string | null, approvedTools?: readonly string[] | null,
    environment?: NodeJS.ProcessEnv): AcpLaunch;

  /**
   * Learns the session's modes, from its `mode` config option, or else its `modes`; a session that lists none, or modes that can't be read, leaves
   * the modes as they were.
   */
  public readSession(session: JsonReader): void;

  /**
   * The command the agent's turns start, found again on each call, or `null` when it isn't found.
   */
  public currentCommand(): ProcessCommand | null;

  /**
   * @returns `null`: only a session can tell.
   */
  public isSignedIn(provider: Provider | null): boolean | null;
  /** Returns `null`: the session's `model` config option names the models. */
  public readModels(initialized: JsonReader): readonly ProviderModel[] | null;
  public readVersion(initialized: JsonReader): string | null;
  /**
   * The id of the first `authMethods` entry of the `agent` type, or without a type, or `null` when there is none, as when the agent signs in only in a
   * terminal.
   */
  public readSignInMethod(initialized: JsonReader): string | null;
  public readEffort(session: JsonReader): string | null;
  /**
   * Reads the server and tool from the tool call's `_meta["gemini-cli"].mcp`, `server_name` and `tool_name`, as an agent built on Gemini CLI
   * sends with a permission request for an MCP tool; `null` when the call has no such field.
   */
  public mcpToolOf(tool: JsonReader): AcpMcpTool | null;
  /**
   * Returns `Resources.geminiCliUntrustedFolder` when the agent's `initialize` answer names it `gemini-cli` in `agentInfo.name` and
   * {@link GeminiFolderTrust} finds the folder untrusted, with the environment, folder and arguments the agent launches with; Gemini CLI
   * connects no MCP server in a folder it doesn't trust and tells the client nothing. `null` otherwise, and for any other agent.
   */
  public readUntrustedFolder(initialized: JsonReader, environment: NodeJS.ProcessEnv, workingDirectory: string | null): string | null;
  /**
   * Returns `true` when the agent's `initialize` answer names it `gemini-cli` in `agentInfo.name` at version 0.67 or later: in ACP mode it
   * answers `session/new` and `session/load` after `config.initialize()`, which awaits its MCP start-up. `false` for an earlier or unnamed
   * version and for any other agent.
   */
  public listsToolsBeforeSession(initialized: JsonReader): boolean;
  /**
   * Returns `Resources.geminiCliToolsUnlisted` when the agent's `initialize` answer names it `gemini-cli` in `agentInfo.name`; `null` for any
   * other agent.
   */
  public readMissingTools(initialized: JsonReader): string | null;
  /** Returns `null`: a general agent has no naming rule. */
  public memberOf(value: string, name: string): AcpModelMember | null;
  public sessionMeta(): JsonObject | null;
  /** Returns `null`: no version is refused. */
  public formatUnsupported(version: string | null): string | null;
  public formatSignIn(provider: Provider | null): string;
  public formatStopped(reason: string): string;
}

/**
 * The OpenCode part of the shared ACP adapter: the person's own OpenCode, 1.18.31 and later 1.x, started as `opencode acp` in their home folder with
 * their configuration, sign-in and environment (`OpencodeDataFolder`, `OpencodeEnvironment`). OpenCode keeps its own sign-in, made with
 * `opencode auth login` in a TeamRun terminal: its `authenticate` does nothing, so a `session/new` tells whether it is signed in, and its `model`
 * and `mode` config options name the models and the Build and Plan modes; each model's effort levels come from `opencode models --verbose`,
 * since the session's `effort` option names a model's levels only once that model is chosen. Allow All runs in Build with every tool allowed at
 * launch. A resume loads the session, which OpenCode replays; files other than images go as `resource_link` entries; its Sign out runs
 * `opencode auth logout` in a terminal; it can't fork or report plan usage.
 */
export declare class OpencodeAgent implements IAcpAgent {
  public readonly descriptor: ProviderKind;
  public readonly baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch;
  public readonly toolTitle: string;
  public readonly authMethod: string;
  public readonly usage: IAcpUsageReader | null;
  public readonly account: IAcpAccountReader | null;
  public readonly toDos: IAcpToDoReader | null;
  public readonly questions: IAcpQuestionReader | null;
  public readonly authMeta: JsonObject | null;
  public readonly initializeMeta: JsonObject | null;
  public readonly stopReasons: readonly string[];
  public readonly prefersResume: boolean;
  public readonly forkMethods: readonly string[];
  public readonly sendsResourceLinks: boolean;
  public readonly signInUnavailable: string;
  public readonly signOut: IAcpSignOutReader | null;
  public readonly logsOut: boolean;
  public readonly authenticates: boolean;
  public readonly effortAtLaunch: boolean;
  public readonly modelAtLaunch: boolean;
  public readonly fallbackModels: readonly string[];
  public readonly compacts: boolean;
  public readonly sharedServerTransports: readonly SharedMcpTransport[];
  public readonly sharedServerRefusal: SharedMcpRefusal | null;
  public readonly followsTasks: boolean;
  public readonly backgroundSubAgentsNote: string | null;
  public readonly routedMcpTool: string | null;
  public readonly awaitsTeamRunTools: boolean;
  public readonly interactiveSignIn: boolean;
  public readonly modes: readonly ProviderMode[];
  public readonly defaultMode: string | null;
  public readonly planMode: string;
  public readonly permissionSwitch: AcpPermissionSwitch | null;
  public readonly launchMode: string;
  public readonly turnModels: IAcpModelStore | null;

  /**
   * An `OpencodeLevelReader` that runs `opencode models --verbose` with the session's environment.
   */
  public readonly levels: IAcpLevelReader;

  /**
   * Creates the agent, its command looked for again while it is missing.
   * @param formerProfileDirectory The folder TeamRun once made for OpenCode's first provider, which now means the person's own.
   * @param data Where its data goes; from the environment by default.
   */
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, formerProfileDirectory: string, locate?: () => ProcessCommand | null, data?: OpencodeDataFolder);

  /**
   * Launches `opencode acp` in the person's home folder, with `OpencodeEnvironment` built for the provider's folder and the requested mode.
   * @param approvedTools The TeamRun tools the person isn't asked about, as the turn's tools name them; a launch outside a turn, such as a sign-in
   * check, passes `null` and keeps the last turn's tools.
   * @param environment The environment the agent's own is built from; `baseEnvironment` by default.
   * @param chatTurn Whether it starts a chat turn, the only launch whose rules ask for the person's own tools while the provider's own servers are on;
   * any other launch refuses them. `false` by default.
   * @throws Error when OpenCode isn't installed.
   */
  public launch(provider: Provider | null, requested: RequestedSettings | null, workingDirectory?: string | null, approvedTools?: readonly string[] | null,
    environment?: NodeJS.ProcessEnv, chatTurn?: boolean): AcpLaunch;

  /**
   * The command the agent's turns start, found again on each call, or `null` when it isn't found.
   */
  public currentCommand(): ProcessCommand | null;

  /**
   * @returns `null`: only a session can tell.
   */
  public isSignedIn(provider: Provider | null): boolean | null;
  /** Returns `null`: the session's `model` config option names the models. */
  public readModels(initialized: JsonReader): readonly ProviderModel[] | null;
  public readVersion(initialized: JsonReader): string | null;
  /** Returns `null`: OpenCode signs in only in its own terminal. */
  public readSignInMethod(initialized: JsonReader): string | null;
  public readEffort(session: JsonReader): string | null;
  /** Returns `null`: OpenCode's models carry no level in their names. */
  public memberOf(value: string, name: string): AcpModelMember | null;
  public sessionMeta(): JsonObject | null;
  /**
   * Refuses OpenCode 2 and later and 1.x before 1.18.31 with `Resources.formatOpencodeUnsupported`; a version it can't read passes.
   */
  public formatUnsupported(version: string | null): string | null;
  public formatSignIn(provider: Provider | null): string;
  public formatStopped(reason: string): string;
}

/**
 * Reads OpenCode's effort levels from `opencode models --verbose`, which prints each model as a `provider/model` line followed by its JSON:
 * the levels are the keys of its `variants`, in their order, then OpenCode's `default`, so a model with `"variants": {}` offers none and shows no Effort menu.
 */
export declare class OpencodeLevelReader implements IAcpLevelReader {
  /**
   * `launcher` builds the command, as `OpencodeAgent` does with its own launch.
   */
  public constructor(launcher: (provider: Provider | null, environment: NodeJS.ProcessEnv) => AcpLaunch);

  /**
   * @inheritdoc
   */
  public launch(provider: Provider | null, environment: NodeJS.ProcessEnv): AcpLaunch;

  /**
   * Reads each model's `variants` keys by its `provider/model` id; a model whose JSON can't be read or has no `variants` field is left out.
   */
  public read(output: string): ReadonlyMap<string, readonly string[]>;
}

/**
 * The Cursor part of the shared ACP adapter: Cursor's CLI as the person installed it, started as `cursor-agent acp`, with the model chosen at
 * launch by `--model`, in a dedicated TeamRun profile per provider (`CursorProfile`, `CursorEnvironment`). Cursor keeps its own sign-in, made with
 * `cursor-agent login` in a TeamRun terminal; its `cursor_login` method only reuses that sign-in, so a `session/new` tells whether it is signed in.
 * Its Agent and Ask modes are the session's own; Plan is off, since it waits on a plan approval TeamRun doesn't show. Its `cursor/ask_question`
 * requests are read by `CursorQuestionReader`. A resume loads the session; files other than images go as `resource_link` entries; it can't fork,
 * compact, report plan usage, use team MCP servers, follow sub-agents or switch the model during a session, and it signs out with `cursor-agent logout`.
 */
export declare class CursorAgent implements IAcpAgent {
  public readonly descriptor: ProviderKind;
  public readonly baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch;
  public readonly toolTitle: string;
  public readonly authMethod: string;
  public readonly usage: IAcpUsageReader | null;
  public readonly account: IAcpAccountReader | null;
  public readonly toDos: IAcpToDoReader | null;
  public readonly questions: IAcpQuestionReader;
  public readonly plans: IAcpPlanReader;
  public readonly toDoList: IAcpToDoListReader;
  public readonly authMeta: JsonObject | null;
  public readonly initializeMeta: JsonObject | null;
  public readonly stopReasons: readonly string[];
  public readonly prefersResume: boolean;
  public readonly forkMethods: readonly string[];
  public readonly sendsResourceLinks: boolean;
  public readonly signInUnavailable: string;
  public readonly signOut: IAcpSignOutReader | null;
  public readonly logsOut: boolean;
  public readonly authenticates: boolean;
  public readonly effortAtLaunch: boolean;
  public readonly modelAtLaunch: boolean;
  public readonly fallbackModels: readonly string[];
  public readonly compacts: boolean;
  public readonly sharedServerTransports: readonly SharedMcpTransport[];
  public readonly sharedServerRefusal: SharedMcpRefusal | null;
  public readonly followsTasks: boolean;
  public readonly backgroundSubAgentsNote: string | null;
  public readonly routedMcpTool: string | null;
  public readonly awaitsTeamRunTools: boolean;
  public readonly interactiveSignIn: boolean;
  public readonly modes: readonly ProviderMode[];
  public readonly defaultMode: string | null;
  /**
   * The mode an isolated session, a title's or a handover summary's, starts in: Cursor's Ask mode, which reads and answers and changes no file; none
   * on macOS, where an isolated session would keep the person's home, so Cursor names no chat and writes no summary there and isn't offered as a title model.
   */
  public readonly isolatedMode: string | undefined;
  public readonly planMode: string;
  public readonly permissionSwitch: AcpPermissionSwitch | null;
  public readonly launchMode: string | null;
  /** Cursor's Allow all, which TeamRun carries out by allowing each permission request Cursor sends, since Cursor has no mode that asks for nothing. */
  public readonly allowAllMode: string;
  public readonly turnModels: IAcpModelStore | null;

  /**
   * The kind's profile names `CURSOR_CONFIG_DIR` as its variable, set to the profile folder, and Cursor's data, XDG config and app-data folders
   * inside it as its sign-in variables, so the sign-in terminal and the agent's turns keep the sign-in in the same place; it signs out in
   * TeamRun; `defaultProfileDirectory` is its usual folder. On macOS, by default this computer's platform, the kind's `singleAccount` is
   * `Resources.cursorOneAccountPerMac`, since every profile shares the keychain's sign-in; elsewhere the sign-in is a file in the profile.
   */
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, defaultProfileDirectory: string, locate?: () => ProcessCommand | null,
    platform?: string);

  /**
   * Starts `cursor-agent [--model <model>] --disable-project-configs acp`, which ignores a project's `.cursor/cli.json` permission rules,
   * with the provider's profile, with its `cli-config.json` on the static channel allowing the approved tools of TeamRun's server, after the
   * allow and deny rules of the person's own `cli-config.json`. A chat turn's process starts in
   * the turn's folder, since Cursor reads a project's rules and `AGENTS.md` from the folder its ACP server started in, not a session's `cwd`;
   * any other launch starts in the profile.
   * @param workingDirectory The turn's folder, where a chat turn's process starts; `null` outside a turn.
   * @param approvedTools The TeamRun tools the person isn't asked about, as the turn's tools name them, written even when there are none, so
   * a revoked tool asks again. A launch outside a turn, such as a sign-in check, passes `null` and keeps the last turn's tools, so that
   * rewriting the shared profile never takes them from a running turn.
   * @param environment The environment the agent's own is built from; `baseEnvironment` by default.
   * @param chatTurn Whether it starts a chat turn. A chat turn reads the person's rules from `cli-config.json` in their `CURSOR_CONFIG_DIR`, or
   * `.cursor` in their home, unless that is the profile itself; a launch outside a chat turn keeps the last chat turn's rules, and sets
   * `CursorProfile.titleHomes`, so Cursor reads none of the person's hooks or MCP servers. `false` by default.
   * @throws Error when Cursor isn't installed, its profile isn't a TeamRun-managed one, or a chat turn can't read the person's rules.
   */
  public launch(provider: Provider | null, requested: RequestedSettings | null, workingDirectory?: string | null, approvedTools?: readonly string[] | null,
    environment?: NodeJS.ProcessEnv, chatTurn?: boolean): AcpLaunch;

  /**
   * Runs `cursor-agent logout` in the provider's profile, the same way a turn starts.
   * @param environment The environment Cursor's own is built from, as `IProcessStarter.readEnvironmentAsync` read it for this start.
   */
  public signOutLaunch(provider: Provider, environment: NodeJS.ProcessEnv): AcpLaunch;

  /**
   * Reads a chunk that is exactly one of `Resources.cursorRefusals` after `Resources.cursorRefusalLead`, which Cursor sends as its answer when its
   * run fails: the sign-in refusal as an `AcpRequestException` with ACP's sign-in error code, and the others, the plan's among them, as an
   * `Error` with `Resources.formatCursorRefused`.
   * @param text The chunk's text.
   * @returns The error, or `null` for any other text.
   */
  public readRefusal(text: string): Error | null;

  /**
   * Runs `cursor-agent about` in the provider's profile, the same way a turn starts.
   * @param environment The environment Cursor's own is built from, as `IProcessStarter.readEnvironmentAsync` read it for this start.
   */
  public aboutLaunch(provider: Provider, environment: NodeJS.ProcessEnv): AcpLaunch;

  /**
   * Claims the new provider's folder and makes its sign-in folders and config as a launch does, whether or not Cursor is installed, so
   * its sign-in terminal has its folders and what the sign-in writes doesn't make the first launch refuse the folder.
   * @throws Error when the folder isn't empty or TeamRun-managed.
   */
  public prepareProfile(provider: Provider): void;

  /**
   * The command the agent's turns start, found again on each call, or `null` when it isn't found.
   */
  public currentCommand(): ProcessCommand | null;

  /**
   * @returns `null`: only a session can tell.
   */
  public isSignedIn(provider: Provider | null): boolean | null;
  /** Returns `null`: the session names the models. */
  public readModels(initialized: JsonReader): readonly ProviderModel[] | null;
  /** Returns `null`: Cursor's `initialize` names no version; the sign-in check reads it from `cursor-agent about`. */
  public readVersion(initialized: JsonReader): string | null;
  /** Returns `null`: Cursor signs in only in its own terminal. */
  public readSignInMethod(initialized: JsonReader): string | null;
  public readEffort(session: JsonReader): string | null;
  /** Returns `null`: Cursor's models carry no level in their names. */
  public memberOf(value: string, name: string): AcpModelMember | null;
  public sessionMeta(): JsonObject | null;
  /** Returns `null`: Cursor's `initialize` names no version. */
  public formatUnsupported(version: string | null): string | null;
  /** Lists the servers in `~/.cursor/mcp.json`, which Cursor reads for every profile whatever `CURSOR_CONFIG_DIR` says. */
  public listOwnMcpServers(provider: Provider | null): Promise<readonly OwnMcpServer[]>;
  public formatSignIn(provider: Provider | null): string;
  public formatStopped(reason: string): string;
}

/**
 * The fx part of the shared ACP adapter: fx as the person installed it, started as `fx acp` in the person's own fx, whose sign-in, settings,
 * sessions and MCP servers fx keeps in `~/.fx` whatever `FX_HOME` says (`FxEnvironment`), so this computer takes one fx provider. The sign-in
 * is the person's own, made with `fx login` in a TeamRun terminal; signed out, its
 * `initialize` refuses with `-32600` naming `fx login`, which `isSignedOutRefusal` reads as signed out; any other refusal stays an error with fx's words. Its Auto, Ask and Full access modes, its `model` and `effort`
 * config options, a resumed session, images and team MCP servers over stdio and HTTP go through the shared adapter; its `provider` option stays
 * as the person's fx has it. It reports each reply's tokens with `FxUsageReader`; it can't fork, compact, report plan usage, follow sub-agents or
 * stop a background command, and TeamRun doesn't sign it out.
 */
export declare class FxAgent implements IAcpAgent {
  /**
   * How `fx status --json` runs for the provider: with the same environment as `launch`.
   * @param environment The environment fx's own is built from.
   * @throws Error when fx isn't installed.
   */
  public statusLaunch(provider: Provider, environment: NodeJS.ProcessEnv): AcpLaunch;

  /**
   * How `fx logout <account>` runs, in the person's home folder with fx's environment.
   * @param environment The environment fx's own is built from.
   * @throws Error when fx isn't installed.
   */
  public signOutLaunch(account: string, environment: NodeJS.ProcessEnv): AcpLaunch;

  public readonly descriptor: ProviderKind;
  public readonly baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch;
  public readonly toolTitle: string;
  /** Empty: fx's `initialize` names no sign-in method, and TeamRun never calls `authenticate`. */
  public readonly authMethod: string;
  public readonly usage: IAcpUsageReader;
  public readonly account: IAcpAccountReader | null;
  public readonly toDos: IAcpToDoReader | null;
  public readonly questions: IAcpQuestionReader | null;
  public readonly authMeta: JsonObject | null;
  public readonly initializeMeta: JsonObject | null;
  public readonly stopReasons: readonly string[];
  public readonly prefersResume: boolean;
  public readonly forkMethods: readonly string[];
  public readonly sendsResourceLinks: boolean;
  /** fx's steering prompt. */
  public readonly steering: IAcpSteering;
  public readonly signInUnavailable: string;
  public readonly signOut: IAcpSignOutReader | null;
  public readonly logsOut: boolean;
  public readonly authenticates: boolean;
  public readonly effortAtLaunch: boolean;
  public readonly modelAtLaunch: boolean;
  public readonly fallbackModels: readonly string[];
  public readonly compacts: boolean;
  public readonly sharedServerTransports: readonly SharedMcpTransport[];
  public readonly sharedServerRefusal: SharedMcpRefusal | null;
  public readonly followsTasks: boolean;
  public readonly backgroundSubAgentsNote: string | null;
  public readonly routedMcpTool: string | null;
  public readonly awaitsTeamRunTools: boolean;
  public readonly interactiveSignIn: boolean;
  public readonly modes: readonly ProviderMode[];
  public readonly defaultMode: string | null;
  /** The mode an isolated session, a title's or a handover summary's, starts in: fx's Ask mode, which asks before it changes a file or runs a command. */
  public readonly isolatedMode: string;
  /** `model`: fx's `provider` option shares its category. */
  public readonly modelOption: string;
  /** fx's `fast` option: Standard as `false` and Fast as `true`. */
  public readonly speedOption: AcpSpeedOption;
  /** `-32600`, with which fx's `initialize` asks the person to run `fx login`. */
  public readonly permissionSwitch: AcpPermissionSwitch | null;
  public readonly launchMode: string | null;
  public readonly turnModels: IAcpModelStore | null;

  /**
   * The kind's profile is the person's own `.fx` in the home folder that `HOME`, or `USERPROFILE` on Windows, names: its usual folder and a
   * person's folder, so the sign-in terminal runs `fx login` with no profile variable, and the Providers tab's search finds it by its `settings.json`
   * or `auth.json`. Its `singleAccount` is `Resources.fxOneAccountPerComputer` on every platform, since every fx provider would use that fx.
   */
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, locate?: () => ProcessCommand | null, platform?: string);

  /**
   * Starts `fx acp` in the working directory, or in the person's home folder without one; the provider's folder isn't passed.
   * @param environment The environment the agent's own is built from; `baseEnvironment` by default.
   * @throws Error with `Resources.fxNotFound`, or `Resources.fxWindowsNotFound` on Windows, when fx isn't installed.
   */
  /**
   * Whether fx's `initialize` refusal says the person isn't signed in: `-32600` naming `fx login`. fx sends `-32600` to signed-in people too, for a credential it can't refresh.
   */
  public isSignedOutRefusal(code: number | null, message: string): boolean;

  public launch(provider: Provider | null, requested: RequestedSettings | null, workingDirectory?: string | null, approvedTools?: readonly string[] | null,
    environment?: NodeJS.ProcessEnv): AcpLaunch;

  /**
   * Claims the new provider's folder as a launch does, whether or not fx is installed, so its sign-in terminal writes into a TeamRun-managed folder.
   * @throws Error when the folder isn't empty or TeamRun-managed.
   */

  /**
   * The command the agent's turns start, found again on each call, or `null` when it isn't found.
   */
  public currentCommand(): ProcessCommand | null;

  /** Returns `null`: only `initialize` can tell. */
  public isSignedIn(provider: Provider | null): boolean | null;
  /** Returns `null`: the session's `model` option names the models. */
  public readModels(initialized: JsonReader): readonly ProviderModel[] | null;
  /** Reads `agentInfo.version`, or `null` when `initialize` names none. */
  public readVersion(initialized: JsonReader): string | null;
  /** Returns `null`: fx signs in only in its own terminal. */
  public readSignInMethod(initialized: JsonReader): string | null;
  /** Returns `null`: the session's `effort` option names the effort. */
  public readEffort(session: JsonReader): string | null;
  /** Returns `null`: fx's models carry no level in their names. */
  public memberOf(value: string, name: string): AcpModelMember | null;
  public sessionMeta(): JsonObject | null;
  /** Returns `null`: every fx version that runs `fx acp` is taken. */
  public formatUnsupported(version: string | null): string | null;
  /** Lists the servers in `~/.fx/mcp.json`, which fx reads whatever `FX_HOME` says. */
  public listOwnMcpServers(provider: Provider | null): Promise<readonly OwnMcpServer[]>;
  public formatSignIn(provider: Provider | null): string;
  public formatStopped(reason: string): string;
}

/**
 * Reads fx's usage: the prompt answer's `usage`, with `cacheReadTokens`, `cacheWriteTokens` and `reasoningTokens` beside the input and output
 * tokens. fx answers no context or plan method.
 */
export declare class FxUsageReader implements IAcpUsageReader {
  /** None. */
  public readonly contextMethods: readonly string[];
  /** None, so the adapter reads no plan usage. */
  public readonly planMethods: readonly string[];

  /**
   * Reads the input and output tokens, the tokens read from and written to the cache, and the reasoning tokens; `null` when it names neither the
   * input nor the output tokens.
   */
  public readReply(result: JsonValue): ReplyUsage | null;
  /** Returns `null`. */
  public readContext(answer: JsonValue): ContextUsage | null;
  /** Returns `null`. */
  public readPlan(answer: JsonValue): readonly PlanWindow[] | null;
}

/**
 * The Antigravity part of the shared ACP adapter: Google's ACP server in the pinned version 1.3.0, a dedicated profile per provider whose
 * folder is the server's `GEMINI_HOME` with the sign-in token in a file there, `oauth-personal` sign-in, the `model` config option and no
 * effort, `session/resume`, inline images and other files by path. A model listing signs in with a `BROWSER` that opens nothing, and on Windows,
 * which has no such browser, doesn't sign in.
 */
export declare class AntigravityAgent implements IAcpAgent {
  public readonly descriptor: ProviderKind;
  public readonly baseEnvironment: NodeJS.ProcessEnv;
  public readonly profileSearch: ProfileSearch;
  public readonly toolTitle: string;
  public readonly authMethod: string;
  public readonly usage: IAcpUsageReader | null;
  public readonly account: IAcpAccountReader | null;
  public readonly toDos: IAcpToDoReader | null;
  public readonly questions: IAcpQuestionReader;
  public readonly authMeta: JsonObject | null;
  public readonly initializeMeta: JsonObject | null;
  public readonly stopReasons: readonly string[];
  public readonly prefersResume: boolean;
  public readonly forkMethods: readonly string[];
  public readonly sendsResourceLinks: boolean;
  public readonly signInUnavailable: string;
  public readonly signOut: IAcpSignOutReader | null;
  public readonly logsOut: boolean;
  public readonly authenticates: boolean;
  public readonly effortAtLaunch: boolean;
  public readonly modelAtLaunch: boolean;
  public readonly fallbackModels: readonly string[];
  public readonly compacts: boolean;
  public readonly sharedServerTransports: readonly SharedMcpTransport[];
  public readonly sharedServerRefusal: SharedMcpRefusal | null;
  public readonly followsTasks: boolean;
  public readonly backgroundSubAgentsNote: string | null;
  public readonly routedMcpTool: string | null;
  public readonly awaitsTeamRunTools: boolean;
  public readonly interactiveSignIn: boolean;
  public readonly modes: readonly ProviderMode[];
  public readonly defaultMode: string | null;
  /** The mode an isolated session, a title's or a handover summary's, starts in: Antigravity's Default mode, which asks before file edits and commands. */
  public readonly isolatedMode: string;
  public readonly permissionSwitch: AcpPermissionSwitch | null;
  public readonly launchMode: string | null;
  /**
   * Keeps the models a fresh session names in the profile's `.teamrun-models.json`, so the provider's listing reads them after a restart.
   */
  public readonly turnModels: IAcpModelStore;

  /**
   * @param locate Finds the server and its harness for a launch, given the provider's chosen path or `null` for none, or `null` when they
   * aren't there; called at each launch, so a server installed while TeamRun runs is found, and each provider runs the server it chose.
   * @param platform The platform, which picks the temporary-folder variables and, on Linux, the server's `--uid=` argument.
   * @param defaultProfileDirectory The profile of the provider-less teammate.
   * @param tempRoot The folder each profile's private temporary folder sits in, with a short name, since the server unpacks deep paths there.
   * @param log Where a link into the profile that fails is noted; none by default.
   */
  public constructor(locate: (chosen: string | null) => AntigravityServer | null, platform: string, environment: NodeJS.ProcessEnv, defaultProfileDirectory: string,
    tempRoot: string, log?: ILog | null);

  /**
   * Starts in the profile's folder. The first launch of the agent clears its temporary root, where a server stopped by force leaves what it
   * unpacked. A chat turn runs with `GEMINI_HOME` at the profile, where the person's skill folders, from the home that environment names, are
   * linked with `AntigravityProfile.linkPersonFiles`, and each link that fails is noted in the log without failing the launch; any other launch,
   * such as a title session, a model list or a sign-in, runs with `GEMINI_HOME` at the profile's hidden home, which holds none of them.
   * @param environment The environment the server's own is built from; `baseEnvironment` by default.
   * @param chatTurn Whether the launch is for a chat turn the person runs; `false` by default.
   * @throws Error when the server isn't installed, the profile isn't a TeamRun-managed one, or the hidden home can't be prepared.
   */
  public launch(provider: Provider | null, requested?: RequestedSettings | null, workingDirectory?: string | null, approvedTools?: readonly string[] | null,
    environment?: NodeJS.ProcessEnv, chatTurn?: boolean): AcpLaunch;

  /**
   * Whether the provider's profile holds Antigravity's token file. Without it the server would start a browser sign-in of its own, so only
   * a sign-in starts it then.
   */
  public isSignedIn(provider: Provider | null): boolean;

  /**
   * Removes the token file `isSignedIn` reads, after the server answered ACP's `logout`.
   */
  public forgetSignIn(provider: Provider): void;

  /**
   * @returns `null`: Antigravity names its models in the session's config options.
   */
  public readModels(initialized: JsonReader): readonly ProviderModel[] | null;

  /**
   * Reads `agentInfo.version`.
   */
  public readVersion(initialized: JsonReader): string | null;

  /**
   * @returns `oauth-personal`, the Google sign-in, which opens the computer's browser.
   */
  public readSignInMethod(initialized: JsonReader): string | null;
  public readEffort(session: JsonReader): string | null;
  /**
   * Reads the server and tool from the tool call's `_meta.mcp`, `server` and `tool`, as Antigravity's ACP server 1.3.0 sends with a permission
   * request for an MCP tool beside `is_mcp_tool_call`; `null` when the call has no such field.
   */
  public mcpToolOf(tool: JsonReader): AcpMcpTool | null;
  /**
   * Places a flat choice whose id ends `-high`, `-medium` or `-low` and whose name ends `(High)`, `(Medium)` or `(Low)`, with the same level,
   * as that level of the model named by the rest of its id and name; any other choice stays its own model.
   */
  public memberOf(value: string, name: string): AcpModelMember | null;
  public sessionMeta(): JsonObject | null;

  /**
   * Refuses every version but the pinned 1.3.0.
   */
  public formatUnsupported(version: string | null): string | null;
  public formatSignIn(provider: Provider | null): string;
  public formatStopped(reason: string): string;

  /**
   * Reads the person's and the project's Antigravity files with `AntigravityInstructions`, `GEMINI.md` among them, since Antigravity 1.3.0 reads
   * none of them over ACP.
   * @param environment The environment the launch was built from, the person's.
   * @param workingDirectory The turn's folder, or `null` for none, which it is by default.
   */
  public readHomeInstructions(environment: NodeJS.ProcessEnv, workingDirectory?: string | null): string | null;
}

/**
 * Reads a zip archive's central directory, Zip64 included, without unpacking it.
 */
export declare class ZipDirectory {
  /**
   * Returns whether every entry stays inside the folder it's unpacked into: the directory reads, and no entry is a link, absolute, on a drive or
   * has a `..` segment.
   */
  public static isSafe(path: string): boolean;

  /**
   * Returns whether an entry's name is relative and has no `..` segment, with either separator.
   */
  public static isContained(name: string): boolean;
}

/**
 * One pinned build of Google's Antigravity ACP server: where it downloads from, the archive's SHA-256 and size, and the server's and harness's
 * names and sizes inside it.
 */
export declare class AntigravityRelease {
  public readonly version: string;
  public readonly url: string;
  public readonly sha256: string;
  public readonly archiveBytes: number;
  public readonly executableName: string;
  public readonly executableBytes: number;
  public readonly harnessName: string;
  public readonly harnessBytes: number;

  public constructor(version: string, url: string, sha256: string, archiveBytes: number, executableName: string, executableBytes: number, harnessName: string,
    harnessBytes: number);

  /**
   * Returns the pinned build for a platform and architecture, as Node names them, or `null` when Google ships none.
   */
  public static find(platform: string, architecture: string): AntigravityRelease | null;
}

/**
 * One pinned build of Grok: its version, the gzip-compressed download with its SHA-256 and size, and the program's name and size once unpacked.
 */
export declare class GrokRelease {
  public readonly version: string;
  public readonly archive: ReleaseFile;
  public readonly programName: string;
  public readonly programBytes: number;

  public constructor(version: string, archive: ReleaseFile, programName: string, programBytes: number);

  /**
   * Returns the pinned build for a platform and architecture, as Node names them, or `null` when Grok ships none.
   */
  public static find(platform: string, architecture: string): GrokRelease | null;
}

/**
 * One pinned build of Cursor's CLI: its version, the archive with its SHA-256 and size, which are TeamRun's own first observation since Cursor
 * publishes none, the archive's file name, and, inside it, the launcher's path and the pinned sizes of the bundled Node and Cursor's `index.js`.
 */
export declare class CursorRelease {
  public readonly version: string;
  public readonly archive: ReleaseFile;
  public readonly archiveName: string;
  /**
   * The launcher inside the archive, `dist-package/cursor-agent`, or `dist-package/cursor-agent.cmd` on Windows.
   */
  public readonly launcherName: string;
  /**
   * The bundled Node inside the archive, `dist-package/node`, or `dist-package/node.exe` on Windows.
   */
  public readonly nodeName: string;
  public readonly nodeBytes: number;
  /**
   * Cursor's script inside the archive, `dist-package/index.js`.
   */
  public readonly scriptName: string;
  public readonly scriptBytes: number;

  public constructor(version: string, archive: ReleaseFile, archiveName: string, launcherName: string, nodeName: string, nodeBytes: number, scriptName: string,
    scriptBytes: number);

  /**
   * Whether the archive is a zip, as the Windows builds are; the macOS and Linux builds are `.tar.gz`.
   */
  public readonly isZip: boolean;

  /**
   * Returns the pinned build for a platform and architecture, as Node names them, or `null` when Cursor ships none.
   */
  public static find(platform: string, architecture: string): CursorRelease | null;
}

/**
 * Installs the pinned Cursor CLI build into its version's folder, `<directory>/<version>`, which then holds Cursor's `dist-package` folder:
 * it downloads the archive, checking its size and SHA-256 while it streams, checks that no zip entry is a link or leaves its folder, unpacks
 * it with tar, which reads the Windows zip and the macOS and Linux `.tar.gz`, checks that the launcher is there and the bundled Node and
 * `index.js` have their pinned sizes, makes the launcher and Node executable, checks that it reports the version, and renames the folder
 * into place, moving an earlier copy of the version aside first and back when the rename fails. The staging folder is removed whether the
 * install succeeds or not. The signal stops the download and the unpacking, and is checked before the rename. Only a Cursor TeamRun installed
 * is offered the pinned version; one from elsewhere updates by its own means.
 */
export declare class CursorInstaller implements IProviderKindInstallation {
  /**
   * @param locate Finds the installed Cursor, `ExecutableLocator.locateCursor` with the install folder, or `null`.
   * @param versionReader Reads Cursor's version.
   * @param environment The environment its version commands run in.
   * @param release This computer's pinned build, `CursorRelease.find`, or `null` when there is none.
   * @param directory The folder version folders go in.
   * @param platform The platform, which decides whether the launcher and Node are made executable.
   * @param extractor The program `ExecutableLocator.locateTar` found, or `null`.
   * @param runner Runs the extractor.
   * @param program The command that runs a build's launcher at a path, `CursorInstaller.programOf`.
   * @param rename Renames the ready folder into place, or an earlier one aside, `renameSync`; a move into an empty place that fails is thrown as
   * `Resources.formatCursorNotPlaced`.
   * @param settle Moves the build it just ran to `Resources.installReadyName` in the staging folder before anything installed is moved, waiting out a moment's
   * hold on it, `InstallRename.moveAsync`; a move that still fails is thrown as `Resources.formatCursorNotReady`, and nothing installed is changed.
   * It also moves an earlier copy set aside back when the new one can't take its place, waiting out a hold the same way; a move back that still fails is
   * thrown as `Resources.formatCursorReleaseSetAside`.
   * @param unpackTimeout How long unpacking may take, in milliseconds.
   */
  public constructor(locate: () => LocatedExecutable | null, versionReader: ExecutableVersionReader, environment: NodeJS.ProcessEnv, release: CursorRelease | null,
    directory: string, platform: string, extractor: LocatedExecutable | null, runner: CommandRunner, program: (path: string) => ProcessCommand,
    rename: (from: string, to: string) => void, settle: (from: string, to: string) => Promise<void>, unpackTimeout: number);

  /**
   * `Resources.cursorNoBuild` when this computer has no pinned build, `Resources.cursorNoExtractor` when it has no tar, otherwise `null`.
   */
  public readonly unavailable: string | null;

  /**
   * `Resources.tarCommandName` when this computer has a pinned build but no tar, otherwise `null`.
   */
  public readonly missingTool: string | null;

  /**
   * Whether `locate` finds Cursor, wherever it was installed from.
   */
  public readonly isInstalled: boolean;

  /**
   * The path of the program found outside TeamRun's own folder, such as one on `PATH`, which updates on its own; `null` when TeamRun's own copy is the one found,
   * or none is.
   */
  public readonly foundPath: string | null;

  /**
   * Reads the installed Cursor's version, with the pinned version as the latest for the one TeamRun installed, and `null` for none or another.
   */
  public readVersions(): Promise<ProviderKindVersions>;

  /**
   * Installs the pinned build. Staging folders an earlier install left are removed first, but one that keeps an installed folder set aside as
   * `Resources.cursorPreviousName`, which stays until an install succeeds and then goes with the other versions' folders.
   * @param progress Called with the bytes received so far and the pinned size.
   * @param commit Called once, just before the folder moves into place, when the install can no longer be stopped.
   * @returns The installed Cursor's path, its `node.exe` on Windows.
   * @throws Error with the reason when the computer has no pinned build or no tar, the download fails or fails its check, a zip entry is unsafe,
   * the unpacking fails, it doesn't unpack to a launcher, Node and `index.js` of the pinned sizes that report the version, the folder can't be
   * written, the build can't be settled or the version's folder can't be put in place, or the Cursor `locate` finds isn't the one installed; with
   * `Resources.formatInstallCancelled` when the signal is aborted before the folder moves into place.
   */
  public install(progress: (received: number, total: number) => void, signal: AbortSignal, commit?: () => void): Promise<string>;

  /**
   * The command that runs the launcher at a path: the launcher itself with no arguments, or, for Windows' `cursor-agent.cmd`, the `node.exe`
   * beside it with the `index.js` beside it, as the `.cmd` would.
   */
  public static programOf(path: string): ProcessCommand;
}

/**
 * Antigravity's installation as Core sees it: TeamRun's own install, or else a compatible server on `PATH` with its harness beside it.
 * While TeamRun's own copy isn't installed, `readVersions` starts the server on `PATH` once to read its version from `initialize`, and again only
 * when that file changes; a 1.3.x server counts as installed and names its path, and any other version leaves the kind not installed, saying why.
 */
export declare class AntigravityInstallation implements IProviderKindInstallation {
  public get unavailable(): string | null;
  public get missingTool(): string | null;
  /**
   * `true` when TeamRun's own copy is installed or the server on `PATH` was read as compatible and hasn't changed since.
   */
  public get isInstalled(): boolean;
  /**
   * The compatible server on `PATH` while it counts as installed; `null` otherwise.
   */
  public get foundPath(): string | null;
  /**
   * Why the server read on `PATH` doesn't count as installed; `null` when none was read, it is compatible, or TeamRun's own copy is installed.
   */
  public get notInstalledReason(): string | null;

  /**
   * @param installer TeamRun's own install, usually an `AntigravityInstaller`.
   * @param locate Finds the server a launch with no chosen path runs, as `AntigravityAgent` takes it; only one whose `source` is `Path` is read.
   * @param readVersion Starts that server and reads its version, as `AcpAdapter.readServerVersion` does; a failure reads as no version.
   */
  public constructor(installer: IProviderKindInstallation, locate: (chosen: string | null) => AntigravityServer | null,
    readVersion: () => Promise<string | null>);

  /**
   * TeamRun's own versions, with the server on `PATH` as the installed one while it is compatible.
   */
  public readVersions(): Promise<ProviderKindVersions>;
  public install(progress: (received: number, total: number) => void, signal: AbortSignal, commit: () => void): Promise<string>;
}

/**
 * Installs the pinned Antigravity server into its version's folder: it downloads the archive, checks its size and SHA-256 while it streams,
 * checks that no entry leaves its folder, unpacks it with the system's unzip, checks the server's and harness's sizes, makes them executable, and moves them into place in one rename.
 * On an Intel Mac it first re-signs its own copy of the server ad hoc, keeping the hardened runtime and adding only
 * `com.apple.security.cs.allow-unsigned-executable-memory`, which the server's libffi needs to start there.
 * Nothing is left behind when a step fails or the install is cancelled; the signal stops the download, the unpack and the re-sign, and is checked
 * before each of them and before the rename.
 */
export declare class AntigravityInstaller implements IProviderKindInstallation {
  /**
   * @param release The pinned build, or `null` when there is none for this computer.
   * @param installDirectory The folder version folders go in.
   * @param extractor The program `ExecutableLocator.locateUnzip` found, or `null`.
   * @param platform The platform, which decides whether the files are made executable and, with the architecture, whether the server is re-signed.
   * @param architecture The architecture, as Node names it; the server is re-signed only on `darwin` `x64`.
   * @param codesign The command that re-signs the server, usually `/usr/bin/codesign`; its arguments come after the command's own.
   * @param unpackTimeout How long unpacking may take, in milliseconds.
   * @param signTimeout How long re-signing may take, in milliseconds.
   */
  public constructor(release: AntigravityRelease | null, installDirectory: string, extractor: LocatedExecutable | null, platform: string, architecture: string,
    codesign: ProcessCommand, runner: CommandRunner, unpackTimeout: number, signTimeout: number);

  /**
   * The one-line reason this computer can't install Antigravity, or `null` when it can.
   */
  public readonly unavailable: string | null;

  /**
   * `Resources.unzipExecutableName` when this computer has a pinned build but no unzip, otherwise `null`.
   */
  public readonly missingTool: string | null;

  /**
   * Whether the pinned version's server and harness are both in its folder.
   */
  public readonly isInstalled: boolean;

  /**
   * The pinned version as the installed one while it is installed, and as the one an install brings; both `null` when there's no build.
   */
  public readVersions(): Promise<ProviderKindVersions>;

  /**
   * Installs the server, or finds it already installed.
   * @param progress Called with the bytes received so far and the archive's pinned size.
   * @returns The server's path.
   * Leftover staging folders from an earlier install that stopped are removed first.
   * @throws Error with the reason when the computer can't install it, the version folder is incomplete, the download fails its checks, an entry
   * would leave its folder, or unpacking, or re-signing on an Intel Mac, fails or doesn't finish within its own time limit; with
   * `Resources.formatInstallCancelled` when the signal is aborted, whichever step it stopped.
   */
  public install(progress: (received: number, total: number) => void, signal: AbortSignal): Promise<string>;
}

/**
 * A file a tool's release publishes: where it is, its SHA-256, and its size when the release publishes one.
 */
export declare class ReleaseFile {
  public readonly url: string;
  /**
   * The file's SHA-256 in lowercase hexadecimal, or `null` when none is listed: the download then has to stay on HTTPS, or on this computer's loopback, to its end.
   */
  public readonly sha256: string | null;
  /**
   * The file's size in bytes, or `null` when the release publishes none.
   */
  public readonly bytes: number | null;

  public constructor(url: string, sha256: string | null, bytes: number | null);
}

/**
 * Downloads a release's file, the first step every tool's install shares.
 */
export declare class ReleaseDownload {
  /**
   * Downloads the file to a path no file is at yet, uncompressed, checking its size while it streams and its SHA-256 once it ends.
   * It creates the file before it asks the server, and on any failure it closes and removes the file, retrying the removal, before it settles.
   * @param name The tool's name, for the failures' reasons.
   * @param progress Called with the bytes received so far and the file's size: its published one, else the server's, else what was received.
   * @param limit The most bytes a file of no published size may have.
   * @throws Error with `Resources.formatDownloadFailed` when the server answers anything but a body, `Resources.formatDownloadMismatch` when
   * the file is larger or smaller than its published size or its SHA-256 differs, `Resources.formatDownloadTooLarge` when a file of no published size
   * goes past `limit`, and `Resources.formatReleasesUnreachable` when the server can't be reached or the connection drops; the signal's error when it is aborted;
   * the file system's error, `EEXIST` when a file is already at the path, which it keeps; and, when the failed download's file can't be closed or removed,
   * a `ReleaseSourceException` with the download's failure's message, whose cause is a `SuppressedError` with the download's failure as `suppressed`
   * and the close's or removal's failure as `error`.
   */
  public static save(file: ReleaseFile, path: string, name: string, progress: (received: number, total: number) => void, signal: AbortSignal,
    limit?: number): Promise<void>;

  /**
   * Runs a request to a tool's releases, and turns a network failure, such as a host that can't be reached or a connection that drops, into one reason.
   * @throws Error with `Resources.formatReleasesUnreachable` for a network failure while the signal isn't aborted; any other error as it is.
   */
  public static reachable<T>(name: string, signal: AbortSignal, request: () => Promise<T>): Promise<T>;

  /**
   * Destroys the stream unless it has closed, and waits for it to close; an error it was already destroyed with, such as a failed pipeline's, is left to
   * whoever destroyed it.
   * @throws The stream's error when it fails while it closes, such as a file whose close fails.
   */
  public static close(output: Writable): Promise<void>;
}

/**
 * Moves an install's file or folder into place, trying again on Windows while something such as a virus scanner still holds a file the install just ran.
 */
export declare class InstallRename {
  /**
   * @param platform The platform; only Windows tries a refused rename again.
   * @param rename Renames the file or folder, `renameSync`.
   * @param timer Waits between the tries; a `NodeTimer` by default.
   */
  public constructor(platform: string, rename: (from: string, to: string) => void, timer?: ITimer);

  /**
   * Renames the file or folder. On Windows a rename refused with one of `Resources.renameRetryCodes` is tried again after `Resources.renameRetryFirstDelay`,
   * the wait doubling up to `Resources.renameRetryLongestDelay`, until the waits would pass `Resources.renameRetryLimit`; then it throws an
   * `InstallHeldException` with the rename's error as its cause, and on any other error or system the rename's own error.
   */
  public moveAsync(from: string, to: string): Promise<void>;

  /**
   * The file-system error code of an error, such as `EPERM`, or an empty string for a value that is no `Error` or has no code.
   */
  public static codeOf(error: unknown): string;
}

/**
 * The staging folder an install downloads and unpacks in, next to where the tool goes, so a finished install moves into place in one rename.
 */
export declare class InstallStaging {
  /**
   * Removes the staging folders an earlier install left in the folder when it stopped, creating the folder when it's missing, and opens a new one.
   * @returns The new staging folder's path.
   */
  public static open(directory: string): string;

  /**
   * Removes the staging folders an earlier install left in the folder when it stopped; a missing folder has none.
   */
  public static sweep(directory: string): void;

  /**
   * Removes the staging folders an earlier install left, as `sweep` does, but those that hold `kept`, such as an installed folder an install set aside
   * and couldn't move back.
   * @param kept The name inside a staging folder that keeps it.
   */
  public static sweepKeeping(directory: string, kept: string): void;

  /**
   * Removes the staging folders, as `sweep` does, once an install has succeeded, such as one that holds a copy set aside earlier, and stops quietly at
   * the first it can't remove, as one whose copy still runs: the install it follows has succeeded already. Never throws.
   */
  public static tidy(directory: string): void;

  /**
   * Opens a new staging folder in the folder, creating the folder when it's missing.
   * @returns The new staging folder's path.
   */
  public static create(directory: string): string;

  /**
   * Runs a step that writes to an install's folder, and throws the reason instead, with the file system's error as its cause, when the folder can't be written
   * (`Resources.unwritableErrorCodes`); any other error is thrown as it is.
   */
  public static writing<T>(reason: string, step: () => T): T;

  /**
   * Removes the staging folder and everything in it.
   */
  public static close(staging: string): void;
}

/**
 * Unpacks a tool's archive with the program `ExecutableLocator.locateUnzip` found.
 */
export declare class ArchiveUnpacker {
  /**
   * Returns the command that unpacks the archive into the folder: `tar -xf archive -C folder` for tar, `unzip -q -o archive -d folder` otherwise.
   */
  public static command(extractor: LocatedExecutable, archive: string, directory: string): ProcessCommand;
}

/**
 * Installs and updates Grok to its pinned build, `Resources.grokVersion`, into the layout Grok's installers make: it downloads this computer's
 * gzip-compressed build into a staging folder in `~/.grok/downloads`, checks it against its pinned SHA-256 and size, unpacks it with Node's
 * zlib, no larger than its pinned size, and checks that the program reports the version. It then moves the program into place as
 * `~/.grok/downloads/grok-<platform>-<architecture>`, and puts `grok` and `agent` in `~/.grok/bin`: relative symbolic links outside Windows,
 * and copies on Windows, each moved into place by a rename, with what is in the way renamed with `.old` first, as Grok's installers rename a
 * running one, or with `.old-<id>` while an earlier `.old` is still held. The old program is set aside the same way, and when any step from
 * the program's move to the last command fails, the program and every command already replaced are moved back, so Grok is kept as it was;
 * the asides are removed once all are in place, those still held left for the next install. `bin` is made only then, and a `~/.grok` it
 * can't write is named before anything changes. It doesn't change PATH or Grok's settings. The staging folder is removed whether the install succeeds or not. The signal stops
 * the download and the unpacking, and is checked before the program moves into place; the move then runs to its end. Only a Grok in
 * `~/.grok/bin` is offered the pinned version, and only when it is newer than the installed one or that one can't tell its version: a Grok
 * that updated itself past the pin is never downgraded, and one from elsewhere updates by its own means.
 */
export declare class GrokInstaller implements IProviderKindInstallation {
  /**
   * @param locate Finds the installed Grok, or `null`.
   * @param versionReader Reads Grok's version.
   * @param environment The environment its version commands run in.
   * @param release This computer's pinned build, `GrokRelease.find`, or `null` when there is none.
   * @param home The folder Grok is installed in, `ExecutableLocator.grokInstallDirectory`.
   * @param platform The platform, which decides the command names and whether they are links or copies.
   * @param program The command that runs a build's program at a path.
   * @param symlink Makes a symbolic link at a path to a target, `symlinkSync`.
   * @param rename Renames the ready program or a command into place, or what is in the way aside, `renameSync`.
   * @param settle Moves the program it just ran to `Resources.installReadyName`, and each command it wrote to its name with `Resources.installReadySuffix`, in the staging folder before any of them is put in place, waiting out a moment's hold on it, `InstallRename.moveAsync`; a move that still fails is thrown as `Resources.formatGrokNotReady`, and nothing installed is changed.
   */
  public constructor(locate: () => LocatedExecutable | null, versionReader: ExecutableVersionReader, environment: NodeJS.ProcessEnv, release: GrokRelease | null,
    home: string, platform: string, program: (path: string) => ProcessCommand, symlink: (target: string, path: string) => void, rename: (from: string, to: string) => void,
    settle: (from: string, to: string) => Promise<void>);

  /**
   * `Resources.grokNoBuild` when this computer has no pinned build, otherwise `null`.
   */
  public readonly unavailable: string | null;

  /**
   * Always `null`: a Grok install needs no program of this computer's.
   */
  public readonly missingTool: string | null;

  /**
   * Whether `locate` finds Grok, wherever it was installed from.
   */
  public readonly isInstalled: boolean;

  /**
   * The path of the program found outside TeamRun's own folder, such as one on `PATH`, which updates on its own; `null` when TeamRun's own copy is the one found,
   * or none is.
   */
  public readonly foundPath: string | null;

  /**
   * Reads the installed Grok's version, with the pinned version as the latest for a Grok in `~/.grok/bin`, and `null` for none or another.
   */
  public readVersions(): Promise<ProviderKindVersions>;

  /**
   * Installs the pinned build, or updates an installed Grok to it.
   * @param progress Called with the bytes received so far and the pinned size.
   * @param commit Called once, just before the program moves into place, when the install can no longer be stopped.
   * @returns The installed Grok's path.
   * @throws Error with the reason when the computer has no pinned build, the download fails or fails its check, it doesn't unpack to a program
   * of the pinned size that reports the version, `~/.grok` can't be written, the program or a command can't be put in place, with the file system's reason, after all it replaced is moved back, or the Grok `locate` finds
   * isn't the one installed; with `Resources.formatInstallCancelled` when the signal is aborted before the program moves into place, and with
   * the step's own reason when it is aborted after.
   */
  public install(progress: (received: number, total: number) => void, signal: AbortSignal, commit?: () => void): Promise<string>;

  /**
   * Runs a build's program by its path, with no arguments of its own.
   */
  public static programOf(path: string): ProcessCommand;
}

/**
 * Installs and updates Claude Code as its own installers do: it reads the latest version from Claude Code's release channel and that version's
 * manifest, downloads this computer's build, checks its size and the manifest's SHA-256, makes it executable, and runs the build's own setup,
 * `install`, which puts Claude Code where `ExecutableLocator.locateClaude` finds it. The download is staged next to the other staging folders
 * and removed whether it succeeds or not. The signal stops reading the channel and the download, and is checked before the setup, which then
 * runs to its end, with no time limit, so an installed Claude Code is never left half replaced. Only a native install, the one in `~/.local/bin`
 * that Claude Code's own installers make, is offered an update: one from npm, Homebrew, winget or an override updates by its own means.
 */
export declare class ClaudeInstaller implements IProviderKindInstallation {
  /**
   * @param locate Finds the installed Claude Code, or `null`.
   * @param versionReader Reads the installed Claude Code's version.
   * @param environment The environment its version command and setup run in.
   * @param channel The release channel's address, `Resources.claudeReleaseChannel`.
   * @param stagingDirectory The folder its staging folders go in.
   * @param target This computer's build, from `targetOf`, or `null` when there is none.
   * @param program The command that runs a downloaded build at a path.
   * @param channelTimeout How long `readVersions` may wait for the channel, in milliseconds.
   */
  public constructor(locate: () => LocatedExecutable | null, versionReader: ExecutableVersionReader, environment: NodeJS.ProcessEnv, channel: string,
    stagingDirectory: string, target: string | null, runner: CommandRunner, program: (path: string) => ProcessCommand, channelTimeout: number);

  /**
   * `Resources.claudeNoBuild` when this computer has no build, otherwise `null`.
   */
  public readonly unavailable: string | null;

  /**
   * Always `null`: a Claude Code install needs no program of this computer's.
   */
  public readonly missingTool: string | null;

  /**
   * Whether `locate` finds Claude Code, wherever it was installed from.
   */
  public readonly isInstalled: boolean;

  /**
   * The path of the program found outside `~/.local/bin`, such as one on `PATH`, which updates on its own; `null` when TeamRun's own copy is the one found,
   * or none is.
   */
  public readonly foundPath: string | null;

  /**
   * Reads the installed Claude Code's version and the channel's latest one, which is `null` when the channel can't be read in time, and for an
   * installed Claude Code that isn't a native one (`ExecutableSource.LocalBin`), without reading the channel.
   */
  public readVersions(): Promise<ProviderKindVersions>;

  /**
   * Installs the channel's latest version, or updates an installed Claude Code to it.
   * @param progress Called with the bytes received so far and the build's size.
   * @param commit Called once, just before the setup starts, when the install can no longer be stopped.
   * @returns The installed Claude Code's path.
   * @throws Error with the reason when the computer has no build, the channel or the manifest can't be read or has no build for it, the download
   * fails its checks, or the setup fails, is stopped from outside, or leaves no Claude Code to find; with `Resources.formatInstallCancelled`
   * when the signal is aborted before the setup, and with the setup's own reason when it is aborted after.
   */
  public install(progress: (received: number, total: number) => void, signal: AbortSignal, commit?: () => void): Promise<string>;

  /**
   * Runs a downloaded Claude Code build by its path, with no arguments of its own.
   */
  public static programOf(path: string): ProcessCommand;

  /**
   * Names this computer's build: the platform and architecture, as Claude Code's manifest lists them, with `-musl` on a musl Linux.
   * @returns The build's name, or `null` when Claude Code publishes none for it.
   */
  public static targetOf(platform: string, architecture: string, isMusl: boolean): string | null;
}

/**
 * Installs and updates Codex as its own installers do: it reads the latest release from Codex's release site, or its GitHub releases when that
 * fails, downloads this computer's package, checks it against the release's SHA-256, and unpacks it with tar into
 * `<CODEX_HOME>/packages/standalone/releases/<version>-<target>`, unless a complete release of that version is there already. It then points
 * `current` at that release, records it in `auto-update-version`, and links the command where `ExecutableLocator.codexInstallDirectory` names:
 * symbolic links outside Windows, replaced by a rename, and directory junctions on Windows. It doesn't change PATH or remove earlier releases.
 * The download is staged in `releases` and removed whether it succeeds or not, unless it holds an incomplete release that was moved aside and
 * couldn't move back: that one stays until an install succeeds. The signal stops reading the release, the download and the
 * unpacking, and is checked before the release is moved into place; the switch then runs to its end. Only a standalone install, one with a
 * `current` release, is offered an update: a Codex from npm or Homebrew updates by its own means.
 */
export declare class CodexInstaller implements IProviderKindInstallation {
  /**
   * @param locate Finds the installed Codex, or `null`.
   * @param versionReader Reads Codex's version.
   * @param environment The environment its version commands run in.
   * @param channels Where the latest release is read, in order, `Resources.codexReleaseChannels`.
   * @param home Codex's home folder, `CODEX_HOME` or `~/.codex`.
   * @param binDirectory The folder the command is linked in, `ExecutableLocator.codexInstallDirectory`.
   * @param target This computer's package target, from `targetOf`, or `null` when there is none.
   * @param platform The platform, which decides the files a release has and how it is linked.
   * @param extractor The program `ExecutableLocator.locateTar` found, or `null`.
   * @param program The command that runs a release's program at a path.
   * @param symlink Makes a symbolic link at a path to a target, `symlinkSync`.
   * @param rename Renames a release folder, `renameSync`.
   * @param settle Moves a release missing files that was set aside back when the new one can't take its place, waiting out a moment's hold on it,
   * `InstallRename.moveAsync`; a move back that still fails is thrown as `Resources.formatCodexReleaseSetAside`.
   * @param unpackTimeout How long tar may take, in milliseconds.
   * @param channelTimeout How long `readVersions` may wait for the release, in milliseconds.
   */
  public constructor(locate: () => LocatedExecutable | null, versionReader: ExecutableVersionReader, environment: NodeJS.ProcessEnv, channels: readonly string[],
    home: string, binDirectory: string, target: string | null, platform: string, extractor: LocatedExecutable | null, runner: CommandRunner,
    program: (path: string) => ProcessCommand, symlink: (target: string, path: string) => void, rename: (from: string, to: string) => void,
    settle: (from: string, to: string) => Promise<void>, unpackTimeout: number, channelTimeout: number);

  /**
   * `Resources.codexNoBuild` when this computer has no package, `Resources.codexNoTar` when it has no tar, otherwise `null`.
   */
  public readonly unavailable: string | null;

  /**
   * `Resources.tarCommandName` when this computer has a package but no tar, otherwise `null`.
   */
  public readonly missingTool: string | null;

  /**
   * Whether `locate` finds Codex, wherever it was installed from.
   */
  public readonly isInstalled: boolean;

  /**
   * The path of the program found while TeamRun's own standalone copy isn't installed, such as one on `PATH`, which updates on its own; `null` when TeamRun's own copy is the one found,
   * or none is.
   */
  public readonly foundPath: string | null;

  /**
   * Reads the installed Codex's version and the latest release's, which is `null` when no release can be read in time, and without reading
   * a release when no Codex is installed or the one installed isn't a standalone install.
   */
  public readVersions(): Promise<ProviderKindVersions>;

  /**
   * Installs the latest release, or updates an installed Codex to it.
   * @param progress Called with the bytes received so far and the size the server sends, if any.
   * @param commit Called once, just before the release is moved into place, when the install can no longer be stopped.
   * @returns The installed Codex's path.
   * @throws Error with the reason when the computer has no package or tar, no release can be read or it lists no package for the computer, the
   * download fails its check, tar fails or doesn't finish within its time, the release lacks files or reports another version, a path to link
   * isn't a link or an empty folder, or the Codex `locate` finds isn't the one installed; with `Resources.formatInstallCancelled` when the
   * signal is aborted before the release is moved into place, and with the step's own reason when it is aborted after.
   */
  public install(progress: (received: number, total: number) => void, signal: AbortSignal, commit?: () => void): Promise<string>;

  /**
   * Runs a release's program by its path, with no arguments of its own.
   */
  public static programOf(path: string): ProcessCommand;

  /**
   * Names this computer's package target, as Codex's releases name it.
   * @returns The target, or `null` when Codex publishes none for it.
   */
  public static targetOf(platform: string, architecture: string): string | null;
}

/**
 * Installs and updates GitHub Copilot CLI from its GitHub releases, without its own installer, which uses winget on Windows: it reads the
 * latest release, downloads this computer's archive, checks it against the release's SHA-256, and unpacks it with tar into a staging folder
 * in the install folder. Outside Windows it moves `copilot` into `~/.local/bin`, replacing the one there by a rename, as Copilot's own
 * installer does. On Windows it moves the unpacked release into a folder of its version, `<data folder>/providers/copilot/<version>`, so a
 * running `copilot.exe` is never replaced, and keeps earlier versions; `ExecutableLocator.locateCopilot` runs the newest. Copilot's own
 * updater may not know that folder: TeamRun's update covers it. The staging folder is removed whether the install succeeds or not, unless it
 * holds an earlier copy of the version that was moved aside and couldn't move back: that one stays until an install succeeds. The
 * signal stops reading the release, the download and the unpacking, and is checked before the release is moved into place; the move then
 * runs to its end. Only the Copilot it installs, the one in `~/.local/bin`, or in its version folders on Windows, is offered an update: a
 * Copilot from npm, Homebrew or winget updates by its own means.
 */
export declare class CopilotInstaller implements IProviderKindInstallation {
  /**
   * @param locate Finds the installed Copilot, or `null`.
   * @param versionReader Reads Copilot's version.
   * @param environment The environment its version commands run in.
   * @param channel Where the latest release is read, `Resources.copilotReleaseChannel`.
   * @param directory The folder it installs Copilot in, `ExecutableLocator.copilotInstallDirectory`.
   * @param target This computer's build, from `targetOf`, or `null` when there is none.
   * @param platform The platform, which decides the archive and how it is moved into place.
   * @param extractor The program `ExecutableLocator.locateTar` found, or `null`; Windows' own tar unpacks the zip archive.
   * @param program The command that runs a release's program at a path.
   * @param rename Renames the program or a version's ready folder into place, `renameSync`.
   * @param settle On Windows, moves the build it just ran to `Resources.installReadyName` in the staging folder before anything installed is moved, waiting out a moment's hold on it, `InstallRename.moveAsync`; a move that still fails is thrown as `Resources.formatCopilotNotReady`, and nothing installed is changed.
   * It also moves an earlier copy set aside back when the new one can't take its place, waiting out a hold the same way; a move back that still fails is
   * thrown as `Resources.formatCopilotReleaseSetAside`.
   * @param unpackTimeout How long tar may take, in milliseconds.
   * @param channelTimeout How long `readVersions` may wait for the release, in milliseconds.
   */
  public constructor(locate: () => LocatedExecutable | null, versionReader: ExecutableVersionReader, environment: NodeJS.ProcessEnv, channel: string,
    directory: string, target: string | null, platform: string, extractor: LocatedExecutable | null, runner: CommandRunner,
    program: (path: string) => ProcessCommand, rename: (from: string, to: string) => void, settle: (from: string, to: string) => Promise<void>, unpackTimeout: number,
    channelTimeout: number);

  /**
   * `Resources.copilotNoBuild` when this computer has no build, `Resources.copilotNoExtractor` when it has no tar, otherwise `null`.
   */
  public readonly unavailable: string | null;

  /**
   * `Resources.tarCommandName` when this computer has a build but no tar, otherwise `null`.
   */
  public readonly missingTool: string | null;

  /**
   * Whether `locate` finds Copilot, wherever it was installed from.
   */
  public readonly isInstalled: boolean;

  /**
   * The path of the program found outside TeamRun's own folder, such as one on `PATH`, which updates on its own; `null` when TeamRun's own copy is the one found,
   * or none is.
   */
  public readonly foundPath: string | null;

  /**
   * Reads the installed Copilot's version and the latest release's, which is `null` when no release can be read in time, and without reading
   * a release when no Copilot is installed or the one installed isn't one it installs.
   */
  public readVersions(): Promise<ProviderKindVersions>;

  /**
   * Installs the latest release, or updates an installed Copilot to it.
   * @param progress Called with the bytes received so far and the size the server sends, if any.
   * @param commit Called once, just before the release is moved into place, when the install can no longer be stopped.
   * @returns The installed Copilot's path.
   * @throws Error with the reason when the computer has no build or tar, no release can be read or it lists no archive for the computer, the
   * download fails its check, tar fails or doesn't finish within its time, the archive has no program or it reports another version, or the
   * Copilot `locate` finds isn't the one installed; with `Resources.formatInstallCancelled` when the signal is aborted before the release is
   * moved into place, and with the step's own reason when it is aborted after.
   */
  public install(progress: (received: number, total: number) => void, signal: AbortSignal, commit?: () => void): Promise<string>;

  /**
   * Runs a release's program by its path, with no arguments of its own.
   */
  public static programOf(path: string): ProcessCommand;

  /**
   * Names this computer's build, as Copilot's releases name it, with `linuxmusl` for the platform on a musl Linux.
   * @returns The build, or `null` when Copilot publishes none for it.
   */
  public static targetOf(platform: string, architecture: string, isMusl: boolean): string | null;
}

/**
 * Antigravity integration: the shared ACP adapter running `AntigravityAgent`.
 */
export declare class AntigravityAdapter extends AcpAdapter {
  /**
   * The given installation as an `AntigravityInstallation`, which also counts a compatible server on `PATH` as installed.
   */
  public readonly installation: IProviderKindInstallation;

  /**
   * Creates the adapter; its ACP clients' stops wait on the timer, by default `NodeTimer`.
   * @param locate Finds the installed server at each launch, as `AntigravityAgent` takes it.
   * @param installation How TeamRun installs the server, usually an `AntigravityInstaller`.
   */
  public constructor(locate: (chosen: string | null) => AntigravityServer | null, installation: IProviderKindInstallation, platform: string, environment: NodeJS.ProcessEnv,
    defaultProfileDirectory: string, tempRoot: string, clientInfo: AppServerClientInfo, starter: IProcessStarter, timings: ProviderTimings,
    timer?: ITimer, log?: ILog | null);
}

/**
 * The Antigravity server a launch runs: the command that starts it, the harness beside it, and where it was found.
 */
export declare class AntigravityServer {
  public readonly command: ProcessCommand;
  public readonly harnessPath: string;
  /**
   * `Override` for the provider's chosen path, `Managed` for TeamRun's own copy, `Path` for one found on `PATH`.
   */
  public readonly source: ExecutableSource;

  /**
   * @param source Where the server was found; `Managed` by default.
   */
  public constructor(command: ProcessCommand, harnessPath: string, source?: ExecutableSource);
}

/**
 * A dedicated, TeamRun-managed Antigravity profile: the server's `GEMINI_HOME`, where it writes the provider's sign-in token itself.
 */
export declare class AntigravityProfile {
  /**
   * The profile's folder.
   */
  public readonly directory: string;
  /**
   * The profile's private temporary folder, named by a hash of the profile's path, under the temporary root.
   */
  public readonly tempDirectory: string;
  /**
   * The `GEMINI_HOME` of a launch for no chat turn, such as a title session, a model list or a sign-in: a folder in the profile that holds only a link
   * to the profile's `antigravity-acp`, so it shares the sign-in and the sessions but none of the person's skills.
   */
  public readonly hiddenHome: string;

  /**
   * Requires an absolute directory.
   */
  public constructor(directory: string, tempRoot: string);

  /**
   * Initializes an empty or managed profile and its temporary folder; refuses to alter a folder TeamRun doesn't manage.
   */
  public prepare(): void;

  /**
   * Links the person's `config/skills` and `antigravity-cli/skills` into the same places in the profile, by a junction on Windows and a symbolic
   * link elsewhere, so Antigravity reads their skills. A missing source is skipped, and a link an earlier launch left for it is removed; a link
   * already there is kept; an empty folder is replaced; anything else there is left alone. Nothing is written in the person's home, and nothing
   * is linked when that home is the profile.
   * @param personHome The person's own `GEMINI_HOME`.
   * @returns A note for each link that failed.
   */
  public linkPersonFiles(personHome: string): readonly string[];

  /**
   * Makes the profile's `antigravity-acp` and links it into the hidden home, by a junction on Windows and a symbolic link elsewhere, keeping a link
   * already there.
   * @returns The hidden home.
   * @throws Error When something other than a link or an empty folder is in the link's place, or the link fails.
   */
  public prepareHiddenHome(): string;

  /**
   * `true` when the server's sign-in token file exists in the profile; the file is never read.
   */
  public hasToken(): boolean;

  /**
   * Removes Antigravity's token file, which `hasToken` reads, from the TeamRun profile.
   */
  public forgetToken(): void;

  /**
   * Reads the models kept in `.teamrun-models.json`, or `null` when the file is missing or isn't a list of models.
   */
  public readModels(): readonly ProviderModel[] | null;

  /**
   * Replaces `.teamrun-models.json` atomically with the models; the profile must be prepared.
   */
  public keepModels(models: readonly ProviderModel[]): void;
}

/**
 * Keeps each Antigravity provider's models in its profile, as `AntigravityProfile` reads and writes them.
 */
export declare class AntigravityModelStore implements IAcpModelStore {
  /**
   * @param defaultProfileDirectory The profile of the provider-less teammate.
   * @param tempRoot The agent's temporary root, which the profile names but these files don't use.
   */
  public constructor(defaultProfileDirectory: string, tempRoot: string);

  public keep(provider: Provider | null, models: readonly ProviderModel[]): void;

  public read(provider: Provider | null): readonly ProviderModel[] | null;
}

/**
 * Builds the environment for an Antigravity server process.
 */
export declare class AntigravityEnvironment {
  /**
   * Drops credential-like, Google, Gemini, Antigravity, browser and temporary-folder variables, then points `GEMINI_HOME` at the home given,
   * the profile or its hidden home, forces the token into a file there, names the harness, and points the temporary folder at the profile's own.
   */
  public static build(platform: string, base: NodeJS.ProcessEnv, profile: AntigravityProfile, home: string, harnessPath: string): NodeJS.ProcessEnv;
}

/**
 * Copies a base environment for an ACP agent's process.
 */
export declare class AcpEnvironment {
  /**
   * Returns the variables whose names the pattern doesn't match.
   */
  public static copy(base: NodeJS.ProcessEnv, excluded: RegExp): NodeJS.ProcessEnv;

  /**
   * Returns the environment for a sign-in: the base's home and app-data folders, X authority file and browser in place of its own, `HOME`,
   * `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XAUTHORITY` and `BROWSER`, named in any case, each as the base
   * has it, and left out when the base has none. The other variables stay as they are.
   */
  public static forSignIn(environment: NodeJS.ProcessEnv, base: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
}

/**
 * A folder TeamRun manages for an agent, marked so it is never one a person made.
 */
export declare class ManagedProfile {
  public readonly directory: string;

  /**
   * @param markerValue What the marker file holds.
   * @param notAbsolute The failure when the folder isn't absolute.
   * @param notManaged The failure when the folder is someone else's.
   * @throws ArgumentException when the folder isn't absolute.
   */
  public constructor(directory: string, markerValue: string, notAbsolute: string, notManaged: string);

  /**
   * Marks an empty or missing folder as managed, or checks the marker of one already managed.
   * @throws Error when the folder has files but no marker, or another marker.
   */
  public prepare(): void;

  /**
   * Removes one file under the folder, after checking the folder is TeamRun's; a missing file is no failure.
   */
  public removeFile(segments: readonly string[]): void;

  /**
   * Replaces one file in the folder through a temporary file, readable only by its owner.
   */
  public writeFile(name: string, text: string): void;
}

/**
 * Reads the usage the draft ACP "End-Turn Token Usage" puts on a prompt answer: its `usage`, with `cachedReadTokens`, `cachedWriteTokens` and
 * `thoughtTokens` beside the input and output tokens, as GitHub Copilot 1.0.105 sends it. It names no cost, and it answers no context or plan method.
 */
export declare class AcpUsageReader implements IAcpUsageReader {
  /** None. */
  public readonly contextMethods: readonly string[];
  /** None, so the adapter reads no plan usage. */
  public readonly planMethods: readonly string[];

  /**
   * Reads the input and output tokens, the tokens read from and written to the cache, and the thought tokens; `null` when it names neither the input
   * nor the output tokens. The input counts the cached tokens as it names them when `totalTokens` is the input and output tokens alone, as
   * Copilot's is; otherwise, also without `totalTokens`, the cached tokens are added to it, as the draft's example counts them outside.
   */
  public readReply(result: JsonValue): ReplyUsage | null;
  /** Returns `null`. */
  public readContext(answer: JsonValue): ContextUsage | null;
  /** Returns `null`. */
  public readPlan(answer: JsonValue): readonly PlanWindow[] | null;
}

/**
 * Reads Grok's usage: the prompt answer's `_meta.usage`, `x.ai/session/info` and `x.ai/billing`.
 * Whether `inputTokens` already counts the cache reads and creation is unknown, so a reader must not add them to it.
 */
export declare class GrokUsageReader implements IAcpUsageReader {
  /**
   * @inheritdoc
   */
  public readonly contextMethods: readonly string[];
  /**
   * @inheritdoc
   */
  public readonly planMethods: readonly string[];

  /**
   * Reads the input and output tokens, the tokens read from and written to the cache, the reasoning tokens, and the cost from its ticks.
   */
  public readReply(result: JsonValue): ReplyUsage | null;

  /**
   * Reads the context's tokens used and total, and where it compacts from its percentage, blank above 100, from `result.context`: Grok wraps an extension
   * method's answer in `{ result }`.
   */
  public readContext(answer: JsonValue): ContextUsage | null;

  /**
   * Reads the credit use as a weekly or monthly window by its billing period, and none for another period.
   */
  public readPlan(answer: JsonValue): readonly PlanWindow[] | null;
}

/**
 * Lists the agent's models through an extension method, on the connection its `initialize` answered.
 */
export interface IAcpModelListReader {
  /**
   * The methods that answer the model list, tried in order while the agent answers `-32601`.
   */
  readonly methods: readonly string[];

  /**
   * Reads the models from a method's answer, with what `initialized` advertises.
   * @returns The models, or `null` when the answer names none.
   */
  read(answer: JsonValue, initialized: JsonReader): readonly ProviderModel[] | null;
}

/**
 * Lists Grok's catalog from `x.ai/models/list`, which waits up to 10 seconds for Grok's first catalog when it is still loading.
 */
export declare class GrokModelListReader implements IAcpModelListReader {
  /**
   * @inheritdoc
   */
  public readonly methods: readonly string[];

  /**
   * Reads the models from the answer's `result`, a model state as `initialize` gives under `_meta.modelState`.
   * @returns The models, or `null` when the answer has no `result`, such as a handler error.
   */
  public read(answer: JsonValue, initialized: JsonReader): readonly ProviderModel[] | null;
}

/**
 * Reads Grok's account from `x.ai/auth/info`, and its plan from `x.ai/billing`.
 */
export declare class GrokAccountReader implements IAcpAccountReader {
  /**
   * @inheritdoc
   */
  public readonly methods: readonly string[];

  /**
   * @inheritdoc
   */
  public readonly planMethods: readonly string[];

  /**
   * Reads the email, the sign-in method and the organization from `email`, `methodId` and `organizationName`, or `teamName` when it names no
   * organization.
   * @returns The identity, or `null` when the answer names none of them.
   */
  public read(answer: JsonValue): ProviderIdentity | null;

  /**
   * Reads the plan's name from `subscription_tier`.
   * @returns The name, or `null` when the answer names none.
   */
  public readPlan(answer: JsonValue): string | null;
}

/**
 * Reads Grok's own MCP servers from `x.ai/mcp/list`, asked with no session, so its servers carry no status and none is connected.
 */
export declare class GrokMcpServersReader implements IAcpOwnMcpServersReader {
  /**
   * @inheritdoc
   */
  public readonly methods: readonly string[];

  /**
   * Reads each server's `name`, without `teamrun`, as `Configured`; a name Grok lists twice is read once, where it first appears, and an answer
   * with no `servers` field, or a null one, names no server.
   * @throws JsonException when `servers` isn't a list or a server has no name.
   */
  public read(answer: JsonValue): readonly OwnMcpServer[];
}

/**
 * Gives Grok's running turn a person's message through `x.ai/interject`, its text and its content blocks; Grok queues it and reads it at the
 * turn's next safe point.
 */
export declare class GrokSteering implements IAcpSteering {
  /** `x.ai/interject`, as an extension method, then plain. */
  public readonly methods: readonly string[];
  /** @inheritdoc */
  public paramsOf(sessionId: string, steer: TurnSteer, blocks: readonly JsonValue[]): JsonObject;
  /** Any answer means Grok queued it. */
  public took(_result: JsonReader): boolean;
}

/**
 * Gives fx's running turn a person's message as a `session/prompt` marked `_meta.fx.steer`, which fx joins to the turn and answers when the
 * turn ends.
 */
export declare class FxSteering implements IAcpSteering {
  /** `session/prompt`. */
  public readonly methods: readonly string[];
  /**
   * Builds the marked prompt from the message's text alone, where its other files are listed.
   * @returns The params, or `null` for a message with an image, which fx takes only as a prompt of its own.
   */
  public paramsOf(sessionId: string, steer: TurnSteer): JsonObject | null;
  /** Whether fx's answer says the turn absorbed it, in `_meta.fx.steering`; one it dropped because the turn was cancelled doesn't count. */
  public took(result: JsonReader): boolean;
}

/**
 * Reads Grok's answer to `x.ai/auth/logout`.
 */
export declare class GrokSignOutReader implements IAcpSignOutReader {
  /**
   * @inheritdoc
   */
  public readonly methods: readonly string[];

  /**
   * Reads `ok` and `api_key_still_set`.
   * @returns `Resources.grokSignOutRefused` unless `ok` is `true`, `Resources.grokApiKeyStillSet` when `api_key_still_set` is `true`, and
   * `null` otherwise.
   */
  public read(answer: JsonValue): string | null;
}

/**
 * Reads the metadata advertised by the native Grok ACP initialize response.
 */
export declare class GrokModelReader {
  /**
   * Returns native model choices and advertised capabilities.
   */
  public static read(initialized: JsonReader): readonly ProviderModel[];

  /**
   * Reads native model choices from a model state, `currentModelId` and `availableModels`, with the image capability `initialized` advertises.
   */
  public static readState(state: JsonReader, initialized: JsonReader): readonly ProviderModel[];

  /**
   * Returns the observed native harness version.
   */
  public static version(initialized: JsonReader): string | null;

  /**
   * Whether cached, noninteractive authentication is advertised.
   */
  public static canAuthenticate(initialized: JsonReader): boolean;

  /**
   * The first advertised authentication method other than the cached one, such as the browser
   * sign-in; `null` when there is none.
   */
  public static signInMethod(initialized: JsonReader): string | null;
}

/**
 * How a command an ACP agent ran in TeamRun's terminal ended: its exit code, or the signal that ended it.
 */
export interface IAcpTerminalExit {
  readonly exitCode: number | null;
  readonly signal: string | null;
}

/**
 * One command an ACP agent runs in TeamRun's terminal: what it ran, its process, the time before its start and the time it started by, the last output its byte limit keeps
 * and whether that cut any, its exit once it has one, and whether it is a task, is being stopped, or was released.
 */
export interface IAcpTerminal {
  readonly command: string;
  readonly process: StartedProcess;
  readonly launched: number;
  startedBy: number | null;
  readonly limit: number;
  readonly exited: Promise<IAcpTerminalExit>;
  output: string;
  truncated: boolean;
  exit: IAcpTerminalExit | null;
  isTask: boolean;
  stopping: boolean;
  released: boolean;
}

/**
 * One sub-agent an ACP agent started: its spawn's tool call, the item that shows it, its own session once the agent names it, and its state.
 */
export interface IAcpSubAgent {
  /**
   * The id of the tool call that started it.
   */
  readonly toolCallId: string;
  /**
   * The provider item id of its `SubAgent` detail, which its own details name as their parent.
   */
  readonly itemId: string;
  /**
   * Its own session, or `null` until the agent names it.
   */
  readonly childSessionId: string | null;
  /**
   * Grok's id for it, from `subagent_spawned`'s `subagent_id`, or its own session when that has none; `null` until then, and for Copilot.
   */
  readonly subAgentId: string | null;
  /**
   * The sub-agent as last reported.
   */
  readonly agent: import("@noldova/teamrun.protocol").SubAgent;
}

/**
 * How a turn keeps its background sub-agents running past its end.
 */
export interface IAcpSubAgentKeeper {
  /**
   * Asks the agent to cancel a kept sub-agent, by its Grok id; resolves whether the agent will report its end, else the sub-agent ends as Stopped.
   */
  readonly cancel: (subAgentId: string) => Promise<boolean>;
  /**
   * Called once a kept sub-agent ends, with the wake Grok said it would start, or `null` when it will start none.
   */
  readonly ended: (wake: TurnWake | null) => void;
}

/**
 * Maps the sub-agents Grok and Copilot start in one turn to the shared sub-agent row. For Grok, the spawn's tool call starts it, `subagent_spawned` names
 * its session, type and model, `subagent_progress` counts it, and `subagent_finished` or the spawn's end ends it; the child session's text shows as notes
 * in its row. For Copilot, a tool call of kind `other` whose input has an `agent_type` and a `prompt` starts it, with that type, and its end ends it, with
 * its output's `content` or, when it fails, its `message`, unless its `mode` is `background`, which runs on until a `read_agent` call says it has
 * replied, as `endBackground` does, or the turn ends; the sub-agent runs in the
 * parent's session, so its tool calls are the ones whose `_meta` names its `agentId`. A new id names a sub-agent only once exactly one Copilot sub-agent
 * could have made it: of those running when the id was first seen, the one no other id has named, also when it has ended since, since an ended sub-agent's
 * calls can still update. Until then that id's calls and approvals stay unnamed, and the session's text is a sub-agent's only while exactly one that isn't
 * in the background runs.
 */
export declare class AcpSubAgents {
  /**
   * @param listener Receives each sub-agent's row and its notes.
   * @param kindId The provider's kind, which says whether its calls can be Copilot's spawns.
   */
  public constructor(listener: ITurnListener, kindId: string);

  /**
   * Whether a tool call is Grok's `spawn_subagent`, or, for the Copilot kind, Copilot's spawn.
   * @param tool The tool call.
   * @param kindId The provider's kind.
   */
  public static isSpawn(tool: JsonObject, kindId: string): boolean;

  /**
   * The session an approval's tool call says asked, or `null` when it names none.
   */
  public static requestingSessionOf(tool: JsonObject): string | null;

  /**
   * The Copilot sub-agent a tool call's `_meta` names by its `agentId`, or `null` when it names none.
   */
  public static agentIdOf(tool: JsonObject): string | null;

  /**
   * The card's summary for an OpenCode request to start a sub-agent, by the `subagent_type` of its input; null for another kind or request.
   * @param tool The tool call of the permission request.
   * @param kindId The provider's kind.
   */
  public static startOf(tool: JsonObject, kindId: string): string | null;

  /**
   * The Copilot sub-agent a `read_agent` call reads, by the `agent_id` of its input, for the Copilot kind and a call of kind `read`; `null` otherwise.
   * @param tool The tool call, merged with its updates.
   * @param kindId The provider's kind.
   */
  public static readAgentOf(tool: JsonObject, kindId: string): string | null;

  /**
   * The text of a tool call's raw output `content`, or `null` when it has none.
   */
  public static outputOf(tool: JsonObject): string | null;

  /**
   * The sub-agent whose own session this is, or `undefined` when none is.
   */
  public ofChild(sessionId: string | null): IAcpSubAgent | undefined;

  /**
   * The Copilot sub-agent a tool call's `agentId` names, linking a new id once exactly one sub-agent could have made it; `null` while it
   * names a sub-agent that can't be told yet, or `undefined` when the call names none.
   */
  public ofTool(tool: JsonObject): IAcpSubAgent | null | undefined;

  /**
   * Whether a background sub-agent it keeps past its turn still runs, or the agent hasn't yet answered the cancel of one the person's Stop ended.
   */
  public get isKeeping(): boolean;

  /**
   * Keeps its background sub-agents running past the turn: the turn's end stops only the others, each kept one is a task, named by its Grok id, whose
   * stop cancels it, and each kept one's end is reported. A background sub-agent is kept once Grok's `subagent_spawned` names it; one the turn's end
   * finds unnamed ends as Stopped with the others.
   * @param cancel Asks the agent to cancel a sub-agent; resolves whether the agent will report its end, else the sub-agent ends as Stopped here.
   * @param ended Called once a kept sub-agent ends, with the wake Grok said it would start, or `null` when it will start none.
   */
  public keep(cancel: (subAgentId: string) => Promise<boolean>, ended: (wake: TurnWake | null) => void): void;

  /**
   * Whether a session is the own session of a running sub-agent it keeps.
   */
  public keepsChild(sessionId: string | null): boolean;

  /**
   * Whether an update of the parent's session is about a running sub-agent it keeps: a `subagent_spawned` while a kept one waits for its session, or
   * another sub-agent update naming a kept one's session.
   */
  public keepsUpdate(kind: string, update: JsonObject): boolean;

  /**
   * Whether a tool call is a sub-agent's spawn this turn already shows as a row.
   */
  public has(toolCallId: string): boolean;

  /**
   * The running background Copilot sub-agent an `agentId` names, or `undefined` when it names none, one outside the background, or one that has ended.
   */
  public backgroundOf(agentId: string): IAcpSubAgent | undefined;

  /**
   * Ends a background sub-agent as Completed once a `read_agent` call says it has replied: each reply moved out of the parent's text shows as a note
   * in its row, and all its replies, a blank line apart, are its summary.
   * @param entry The sub-agent.
   * @param moved The replies taken out of the parent's text.
   * @param replies Every reply the `read_agent` call gave.
   */
  public endBackgroundAsync(entry: IAcpSubAgent, moved: readonly string[], replies: readonly string[]): Promise<void>;

  /**
   * The Copilot sub-agent whose text the parent's session is streaming: the one running outside the background, `null` when two or more do, or
   * `undefined` when none does.
   */
  public speaker(): IAcpSubAgent | null | undefined;

  /**
   * Counts one more tool use for a sub-agent.
   */
  public countToolAsync(entry: IAcpSubAgent): Promise<void>;

  /**
   * Starts a sub-agent the first time its spawn's tool call shows, and ends it when the spawn fails, Stopped when its spawn was denied, or when it completes,
   * unless the sub-agent runs in the background, whose spawn completes as soon as it starts. A Copilot spawn takes its input's `agent_type` as the type; a
   * failed spawn's summary is its output's `message`, and a completed one's its `output` or else its `content`.
   */
  public noteToolAsync(toolCallId: string, itemId: string, tool: JsonObject, denied: boolean): Promise<void>;

  /**
   * Pairs each of Antigravity's `start_subagent` calls, by its call id, with the earliest running sub-agent no start call has taken yet, in the order
   * they were spawned, and ends that sub-agent Failed when its call fails, with the call's output as the summary, since Antigravity sends no end of its
   * own for a sub-agent and its turn ends `end_turn` either way. A repeated update of a call goes to the sub-agent it was paired with. Any other call,
   * or one with no sub-agent to pair, is ignored.
   */
  public noteStartAsync(toolCallId: string, tool: JsonObject): Promise<void>;

  /**
   * Maps one of Grok's sub-agent updates; a spawn names the waiting sub-agent with its description, or the first waiting one.
   */
  public handleAsync(kind: string, update: JsonObject): Promise<void>;

  /**
   * Links a Copilot sub-agent's `agentId` to the spawn whose tool call its `subagent.started` session event names, now or once that spawn shows,
   * so its calls go under that row from the first, in place of a guess for either. Once an event has linked a spawn that showed, which proves
   * its `data.toolCallId` is the spawn's ACP `toolCallId`, an `agentId` an event names is never guessed while its spawn hasn't shown.
   * An event of another type, without both ids, for an `agentId` an event already linked, or naming a spawn an event already linked is ignored.
   */
  public noteEventAsync(event: JsonObject): Promise<void>;

  /**
   * Adds a sub-agent's text to the note it is writing.
   */
  public appendText(entry: IAcpSubAgent, text: string): void;

  /**
   * Shows the sub-agent's text so far as a note in its row, unless it is blank.
   */
  public flushTextAsync(entry: IAcpSubAgent): Promise<void>;

  /**
   * Ends each running sub-agent that ends with its turn, such as Antigravity's, as Completed, for a turn that ended with `end_turn`: Antigravity sends no end
   * of its own, so the turn's end is the only one there is, unless its start call failed first.
   */
  public endWithTurnAsync(): Promise<void>;

  /**
   * Ends every running sub-agent as Stopped, as when the turn ends, except the background ones it keeps.
   */
  public stopAllAsync(): Promise<void>;

  /**
   * Cancels each running kept sub-agent, as shutdown does before the process stops; a refused cancel is ignored.
   */
  public stopKept(): Promise<void>;

  /**
   * Asks the agent to cancel each kept sub-agent and ends each one as Stopped at once, for a turn the person stopped; it keeps the process open until
   * the agent answers each cancel, and a refused cancel is ignored.
   */
  public cancelKeptAsync(): Promise<void>;

  /**
   * Ends every running sub-agent as Stopped, the kept ones too, as when the process stops. Each of these ends, like an end the agent reports, ends a
   * sub-agent only while it still runs, so one that ended meanwhile keeps its own end and is ended once.
   */
  public endAllAsync(): Promise<void>;
}

/**
 * Opens the ACP session a turn runs in, for any provider that speaks ACP.
 */
export declare class AcpSessionOpener {
  /**
   * Loads the session to resume with `session/load`, or with `session/resume` when `resume` is set, or starts one with `session/new` when there is none.
   * When the load fails for any reason and the turn isn't aborted, it adds a note naming the cause and starts a new session instead.
   * When the agent exited or was stopped during the load, the new session opens in the agent that `reopen` starts.
   * When `startsNew` is false, as for a compaction, it starts no session and adds no note, and returns null instead.
   * @param client The started, initialized and signed-in client.
   * @param params The session's parameters, such as `cwd` and `mcpServers`; the load adds the session id.
   * @param resumeId The native session to resume, or `null`.
   * @param listener Where the note goes.
   * @param signal The turn's abort signal.
   * @param timeout Milliseconds each request may take.
   * @param reopen Stops the exited agent and returns a new one, started, initialized and signed in; it throws the load's failure when no new agent may start,
   * such as after the adapter shut down, even while the exited agent was stopping.
   * @param resume Whether to load the session with `session/resume` instead of `session/load`.
   * @param startsNew Whether to start a new session when there is none to resume or its load fails; true when left out.
   * @returns The session, and whether it is the resumed one; null when there was none to resume and `startsNew` is false.
   * @throws Error when the load fails after an abort, when `reopen` throws, or when `session/new` fails.
   */
  public static open(client: AcpClient, params: Record<string, JsonValue>, resumeId: string | null, listener: ITurnListener,
    signal: AbortSignal, timeout: number, reopen: (failure: unknown) => Promise<AcpClient>, resume?: boolean, startsNew?: boolean): Promise<AcpSession | null>;
}

/**
 * Maps the background tasks Grok reports for one session: `task_backgrounded` starts a task, the start's tool call updates that carry no status
 * are its output, each holding all of it so far, the one that says `BackgroundTaskStarted` names its process, `background_tasks` says whether Grok
 * still runs it, and `task_completed` ends it, Stopped when TeamRun stopped it or Grok killed it, Completed for exit code 0 and Failed otherwise, with
 * the rest of the output its snapshot holds. A task's Stop ends its process tree, only while Grok lists it as running and once it named its process.
 */
export declare class AcpTasks {
  /**
   * @param listener Receives the tasks' starts, output and ends.
   * @param sessionId The session whose tasks it maps.
   * @param providerName The provider's name, for a Stop's refusals.
   * @param timer Gives the time a task's process id arrives, by which that process had started.
   * @param endTree Ends a task's process tree, with that time, refusing a process that isn't the task's any more or no longer runs under the agent's.
   * @param expectWake Called when an ended task's `will_wake` says Grok starts a turn on its own for it.
   */
  public constructor(listener: ITurnListener, sessionId: string, providerName: string, timer: ITimer,
    endTree: (processId: number, startedBy: number) => Promise<void>, expectWake: (wake: TurnWake) => void);

  /**
   * Whether no task is running.
   */
  public get isIdle(): boolean;

  /**
   * Maps a notification that is the session's task start, output or end.
   * @returns Whether the notification belonged to a task, so no turn shows it.
   */
  public handleAsync(method: string, params: JsonReader): Promise<boolean>;

  /**
   * Stops every running task it can, through its Stop, ignoring refusals.
   */
  public stopAll(): Promise<void>;

  /**
   * Ends every running task, as when the agent stops: Stopped when TeamRun stopped it, else Ended. A task the agent ends meanwhile keeps its own end.
   */
  public endAllAsync(): Promise<void>;
}

/**
 * Runs the commands an ACP agent asks for through ACP's client terminals, for one session: `terminal/create` starts the command in the chat's folder,
 * or in a `cwd` inside it, with the turn's environment and the agent's `env`, merging its output and error output and keeping their last
 * `outputByteLimit` bytes, at most 1 MiB, at a character's start; `terminal/output`, `terminal/wait_for_exit`, `terminal/kill` and `terminal/release`
 * answer as ACP says, a kill ending the command's process tree, or the processes it left once its first process has exited; `args`, `env`, `cwd`
 * and `outputByteLimit` set to null count as absent, and a command that can't start exits with a null exit code. A terminal still running when a
 * tool call that shows it completes or fails, or when the turn is released, becomes a task: its output so far and from then on is the task's output,
 * and its end, once its output has closed, ends it, Stopped when TeamRun or the agent stopped it, Completed for exit code 0 and Failed otherwise.
 * A task's Stop ends the command as a kill does.
 */
export declare class AcpTerminals {
  /**
   * @param listener Receives the tasks' starts, output and ends.
   * @param providerName The provider's name, for a refused folder.
   * @param starter Starts the commands.
   * @param timer Gives the times before and by a command's start, for its stop.
   * @param directory The chat's folder, where the commands run and which holds every `cwd`.
   * @param environment The turn's environment, read at each start.
   * @param origin The commands' origin, for the log.
   * @param tree Ends a command's process tree; once its first process has exited, the processes it left, and then the command's own stop is used.
   */
  public constructor(listener: ITurnListener, providerName: string, starter: IProcessStarter, timer: ITimer, directory: string,
    environment: () => NodeJS.ProcessEnv, origin: ProcessOrigin | null, tree: IProcessTree);

  /**
   * Whether no command runs and every task start, output and end has reached the listener.
   */
  public get isIdle(): boolean;

  /**
   * Whether the method is one of ACP's terminal requests.
   */
  public handles(method: string): boolean;

  /**
   * Answers requests for the session from now on, and calls settle when a command ends so the channel can tell it is idle; before, and for another session, requests are refused.
   * A task's start, its output while the start is still being taken, and its end reach the listener one at a time in that order; when the
   * listener fails the output or end a command's own events report, fail receives the error.
   */
  public begin(sessionId: string, settle: () => void, fail: (error: unknown) => void): void;

  /**
   * Answers one terminal request.
   */
  public request(method: string, params: JsonReader): Promise<JsonValue>;

  /**
   * Notes a notification: a completed or failed tool call that shows a running terminal makes that terminal a task.
   */
  public noteAsync(method: string, params: JsonReader): Promise<void>;

  /**
   * Makes every running terminal a task, as when the turn is released.
   */
  public followRunningAsync(): Promise<void>;

  /**
   * Stops every running command, as shutdown does.
   */
  public stopAll(): Promise<void>;

  /**
   * Stops every running command without waiting, as when the agent's process ends.
   */
  public endAll(): void;
}

/**
 * Takes a Copilot background sub-agent's reply out of the parent's text once a `read_agent` call gives it. Copilot streams that reply on the parent's
 * session with nothing that names the sub-agent, so the turn notes each chunk of the parent's text and the point at which each spawn and each `read_agent`
 * call first shows. A reply is taken only when exactly one run of whole chunks, inside one text item and between the sub-agent's spawn and the
 * `read_agent` call, matches it once both are trimmed, a run starting and ending on a chunk that isn't blank; else the parent's text stays as it is.
 */
export declare class AcpBackgroundReplies {
  /**
   * @param listener Receives each parent text item again, without the reply taken out of it.
   */
  public constructor(listener: ITurnListener);

  /**
   * A `read_agent` call's replies, trimmed and without blank ones, when its output's status says the sub-agent has finished; `null` otherwise.
   * @param output The call's output: a line with the sub-agent's status, then each turn after a blank line and `[Turn n]`.
   */
  public static repliesOf(output: string): readonly string[] | null;

  /**
   * Notes one chunk of the parent's text.
   * @param contentId The provider item id of the text item it streams into.
   * @param text The chunk.
   */
  public noteText(contentId: string, text: string): void;

  /**
   * Notes the point at which a spawn or a `read_agent` call first shows; a later call for the same id changes nothing.
   */
  public mark(toolCallId: string): void;

  /**
   * Takes each reply that matches as the class says out of its text item, which it reports again, and returns the replies it took.
   * @param spawnId The sub-agent's spawn, which opens the span searched; one never noted searches nothing.
   * @param readId The `read_agent` call, which closes it; one never noted searches nothing.
   * @param replies The sub-agent's replies.
   */
  public takeAsync(spawnId: string, readId: string, replies: readonly string[]): Promise<readonly string[]>;

  /**
   * Forgets every chunk and point, as when the turn ends.
   */
  public clear(): void;
}

/**
 * Keeps the commands each ACP session listed, from its latest `available_commands_update`, by their names without the leading `/`; the adapter keeps
 * one for each turn, fed by that turn's agent process only, so a resumed session's list is the one the agent sends on that load.
 */
export declare class AcpCommands {
  /**
   * The name of a `/` command, its text from after the `/` up to the first space.
   * @param command The command, as `TurnRequest.command` holds it.
   */
  public static nameOf(command: string): string;

  /**
   * The command as a person reads it: `/` and its name, without its arguments.
   * @param command The command, as `TurnRequest.command` holds it.
   */
  public static shownOf(command: string): string;

  /**
   * Takes over the lists an earlier turn's commands kept, for a turn on a kept session.
   * @param earlier The earlier turn's commands.
   */
  public adopt(earlier: AcpCommands): void;

  /**
   * Keeps the session's list when the notification is its `available_commands_update`, and releases a wait for it; ignores any other.
   * @param method The notification's method.
   * @param params The notification's parameters.
   */
  public note(method: string, params: JsonReader): void;

  /**
   * The session's listed commands, waiting up to `wait` for its first list; `null` when it listed none by then or the signal aborted the wait.
   * @param sessionId The session.
   * @param timer Measures the wait.
   * @param wait How long to wait for the first list, in milliseconds.
   * @param signal Ends the wait.
   */
  public listOf(sessionId: string, timer: ITimer, wait: number, signal: AbortSignal): Promise<readonly string[] | null>;
}

/**
 * Passes an ACP agent process's messages to its listener, and extends a kept session's silence limit for each notification and request.
 */
export declare class AcpActivity implements IAcpClientListener {
  /**
   * Initializes the listener.
   * @param listener The kept session's channel.
   * @param silence Extended by each notification and request.
   */
  public constructor(listener: IAcpClientListener, silence: Deadline);

  /**
   * @inheritdoc
   */
  public onNotificationAsync(method: string, params: JsonReader): Promise<void>;

  /**
   * @inheritdoc
   */
  public onRequest(id: string, method: string, params: JsonReader): Promise<JsonValue>;

  /**
   * @inheritdoc
   */
  public onResponseAsync(method: string, result: JsonReader | null): Promise<void>;

  /**
   * @inheritdoc
   */
  public onExitAsync(): Promise<void>;
}

/**
 * An ACP agent process and its session kept open after a turn, for the chat's next turn. It closes once it has had no turn for its idle limit;
 * background work keeps it open while that work reports within its silence limit, and the work is stopped once it falls silent.
 */
export declare class AcpKeptSession {
  /** The agent process. */
  public readonly client: AcpClient;

  /** The environment the process was launched from. */
  public readonly environment: NodeJS.ProcessEnv;

  /** The kept session. */
  public readonly sessionId: string;

  /** The process's launch: its command, environment and folder; a turn whose launch differs starts its own process. */
  public readonly key: string;

  /** The session's parameters, its folder and servers; a turn whose parameters differ starts its own process. */
  public readonly params: string;

  /** The process's `initialize` answer. */
  public readonly initialized: JsonReader;

  /** The answer that opened the session. */
  public readonly started: JsonReader;

  /**
   * Whether the agent, which lists its MCP servers' tools before it answers `session/new` or `session/load`, had listed none of TeamRun's
   * tools by the answer that opened the session, so they never come in it and a later turn notes them missing without waiting for them.
   */
  public readonly toolsUnlisted: boolean;

  /** The sender token in the process's environment, which the next turn adopts; `null` when it has none. */
  public readonly sender: string | null;

  /** The session's kept token for TeamRun's endpoint, which the next turn adopts; `null` when it has none. */
  public readonly token: string | null;

  /** Revokes the kept token. */
  public readonly revoke: () => void;

  /** The commands the agent listed for the session, which the next turn takes over. */
  public readonly commands: AcpCommands;

  /**
   * Initializes the kept session.
   * @param client The agent process.
   * @param environment The environment the process was launched from.
   * @param sessionId The kept session.
   * @param key The process's launch.
   * @param params The session's parameters.
   * @param initialized The process's `initialize` answer.
   * @param started The answer that opened the session.
   * @param toolsUnlisted Whether TeamRun's tools never come in the session.
   * @param sender The sender token in the process's environment, or `null`.
   * @param token The session's kept token for TeamRun's endpoint, or `null`.
   * @param revoke Revokes the kept token.
   * @param channel The last turn's channel, which tells whether background work runs.
   * @param commands The commands the agent listed for the session.
   * @param timer Tells the time for both limits.
   * @param idleLimit How long the session stays open with no turn and no background work, in milliseconds.
   * @param silenceLimit How long background work keeps the session open while it is silent, in milliseconds.
   * @param close Closes the session once its idle limit passes.
   * @param stopWork Stops the session's background work and closes it once the work falls silent.
   */
  public constructor(client: AcpClient, environment: NodeJS.ProcessEnv, sessionId: string, key: string, params: string, initialized: JsonReader, started: JsonReader,
    toolsUnlisted: boolean, sender: string | null, token: string | null, revoke: () => void, channel: AcpChannel, commands: AcpCommands, timer: ITimer,
    idleLimit: number, silenceLimit: number, close: (kept: AcpKeptSession) => void, stopWork: (kept: AcpKeptSession) => void);

  /** Whether no background work runs in the session. */
  public get isIdle(): boolean;

  /** Whether a newer process now keeps the same session, so no turn takes this one. */
  public get isRetired(): boolean;

  /** Starts the idle limit, or, while background work runs, the silence limit and then the idle limit once the work ends. */
  public hold(): void;

  /** Marks the session retired, once a newer process keeps the same session, and closes it as soon as no background work runs in it. */
  public retire(): void;

  /** Stops the session's background work. */
  public stopTasks(): Promise<void>;

  /** Stops both limits, when a turn takes the session or it closes. */
  public end(): void;
}

/**
 * Routes one ACP agent process's messages: a task's to its tasks, a turn the agent started on its own when a task ended to that turn's reply, through
 * `onWake`, and the rest to the person's turn. It is idle once the person's turn is released and no task runs and no such turn runs or is expected.
 */
export declare class AcpChannel implements IAcpClientListener {
  /**
   * @param turn The person's turn.
   * @param listener The person's turn's listener, which receives the tasks and wakes; `null` for an agent whose tasks aren't followed.
   * @param timer Waits for an expected turn.
   * @param wakeGrace How long a turn the agent said it would start may take to start, in milliseconds.
   * @param createTurn Creates the turn that reports to a wake's reply, from the wake the listener returned and a signal aborted by a Stop on that reply.
   * @param cancel Cancels the session's running prompt.
   * @param resultOf The result of a wake's prompt that ended with the stop reason.
   * @param providerName The provider's name, for a task Stop's refusals.
   * @param endTree Ends a task's process tree, with the time its id arrived, refusing a process that isn't the task's any more or no longer runs
   * under the agent's.
   * @param cancelSubAgent Asks the agent to cancel a background sub-agent a turn keeps, by its Grok id; resolves whether the agent will report its end.
   * @param commands Keeps each session's listed commands, from every notification before it is routed.
   * @param terminals Answers the session's terminal requests and follows its terminals, for an agent TeamRun offers terminals; `null` by default.
   * The process stays open while a terminal runs, its stop and end stop them, and the turn's release follows each still running as a task.
   */
  public constructor(turn: AcpTurn, listener: ITurnListener | null, timer: ITimer, wakeGrace: number, createTurn: (wake: WakeTurn, signal: AbortSignal) => Promise<AcpTurn>,
    cancel: (sessionId: string) => void, resultOf: (stopReason: string, sessionId: string, observed: ObservedSettings) => TurnResult,
    providerName: string, endTree: (processId: number, startedBy: number) => Promise<void>, cancelSubAgent: (subAgentId: string) => Promise<boolean>,
    commands: AcpCommands, terminals?: AcpTerminals | null);

  /**
   * Whether nothing more runs on the process: no task, no turn the agent started and none it said it would start, and no background sub-agent
   * a turn keeps.
   */
  public get isIdle(): boolean;

  /**
   * Releases the person's turn: its running terminals become tasks, and the channel may settle as idle from then on.
   */
  public releaseAsync(): Promise<void>;

  /**
   * Releases the person's turn and waits until it is idle; it rejects when the listener fails a task's output or end that a terminal's own
   * events report.
   */
  public whenIdle(): Promise<void>;

  /**
   * Follows the session's tasks from now on, and has the person's turn, and each turn the agent starts, keep their background sub-agents past their
   * end: their updates go back to the turn that started them, and a sub-agent Grok says it will wake for is expected as a turn whose prompt id is
   * `subagent-completed-` and its id.
   */
  public follow(sessionId: string, observed: ObservedSettings): void;

  /**
   * Stops the running tasks it can and cancels the kept sub-agents, as shutdown does before the process stops.
   */
  public stopTasks(): Promise<void>;

  /**
   * Ends the running tasks, Stopped when TeamRun stopped them, else Ended, the kept sub-agents as Stopped, and a running wake as interrupted, as when
   * the process stops.
   */
  public endAsync(): Promise<void>;

  public onNotificationAsync(method: string, params: JsonReader): Promise<void>;
  public onRequest(id: string, method: string, params: JsonReader): Promise<JsonValue>;
  public onResponseAsync(method: string, result: JsonReader | null): Promise<void>;
  public onExitAsync(): Promise<void>;
}

/**
 * Translates one ACP session's streaming events and per-request approvals, for any provider that speaks ACP.
 * A tool call's detail keeps no image, audio or resource bytes, only their size, and each string in its raw input and output is cut to the
 * tool result limit; a diff's text stays whole.
 */
export declare class AcpTurn implements IAcpClientListener {
  /**
   * Creates an inactive listener; replayed history is ignored until begin.
   * @param kindId Prefixes the provider item ids of the details it reports.
   * @param providerName Names the provider in the steps it reports, such as a compaction.
   * @param toolTitle The title of a tool call that has none.
   * @param savedImageOf Reads the image a completed tool call saved; none by default. A completed tool call with a saved image, the agent's own
   * image tool, and an image message chunk are each reported as a generated image. Any other completed tool call keeps its own row, with the
   * first image its updates sent as the row's `imageData` and `mediaType`, which Core stores as a file.
   * @param routedMcpTool The tool through which the agent calls every MCP tool, as Grok's `use_tool`, or null. A permission request for it, known
   * by its title or by a raw input holding `tool_name` or `file` whatever else it holds, and whose `tool_name` starts with
   * `Resources.routedTeamRunToolPrefix`, is refused without asking, with a note, unless its `tool_name` is a string, it has no `file`, and the
   * rest of the name is one of the tools `teamRunTools` lists; such a call to one of `approvedTools` is allowed without asking.
   * Any other request, as for one of the person's own MCP tools or a bare name, is asked as usual.
   * @param teamRunTools Lists the names of TeamRun's tools in this turn; none by default, and none when the listing fails.
   * @param toDosOf Reads the plan after a completed tool call of the turn's own session, reported as the reply's plan after the tool's row
   * when it gives steps; none by default.
   * @param imageFailureOf Reads why a failed tool call that was the agent's own image tool failed; none by default. Such a call is reported as a
   * failed generated image, with what it returns as the `failure`.
   * @param questions Reads the agent's own question requests, whose methods the turn then answers with the person's answers; none by default, so
   * the turn refuses every request but a permission ask and `elicitation/create` as unsupported.
   * @param plans Reads the agent's own plan requests; none by default. A plan request of the turn's session reports its plan text, and its
   * to-dos as the reply's plan, asks the person to Approve plan or Keep planning, reports the plan text again as approved or refused, and
   * answers the agent with the person's choice; a dismissed or stopped ask answers as cancelled.
   * @param leavePlan Switches the session out of its plan mode once the person approved a plan, before the agent is answered, unless the
   * reader's `leavesPlan` says the agent leaves it by itself; nothing by default.
   * When it fails, the turn reports a note with `Resources.formatPlanModeKept` and the plan is still approved.
   * @param approvedTools The names of TeamRun's tools the person approved for every call; none by default.
   * @param mcpToolOf Reads which MCP server and tool a permission request is for, as `IAcpAgent.mcpToolOf`; none by default. A request it reads
   * as TeamRun's server, `teamrun`, and a tool `readOnlyTools` lists is allowed once without asking; one for another tool of that server is asked
   * as usual, and one that arrives after the turn ended or was stopped is cancelled.
   * @param readOnlyTools Lists the names of TeamRun's tools in this turn marked read-only; none by default, and none when the listing fails.
   * @param allowsAll Whether the turn runs in its agent's `allowAllMode`, where a permission request the rules above don't settle is allowed once
   * without asking rather than asked; false by default.
   * @param planning Whether the turn starts in its agent's plan mode to plan first; until the person approves the plan and the turn leaves that
   * mode, by `leavePlan` or by the agent itself, `allowsAll` allows nothing, and a turn that fails to leave it keeps asking. False by default.
   * @param toDoList Reads the agent's own to-do list notifications; none by default. One of the turn's session, while the turn runs, reports
   * the list as the reply's plan.
   */
  public constructor(kindId: string, providerName: string, toolTitle: string, listener: ITurnListener, signal: AbortSignal, streamInterval: number,
    savedImageOf?: (tool: JsonReader, sessionId: string) => SavedImage | null, routedMcpTool?: string | null,
    teamRunTools?: (signal: AbortSignal) => Promise<readonly string[]>, toDosOf?: (tool: JsonReader, sessionId: string) => readonly PlanStep[] | null,
    imageFailureOf?: (tool: JsonReader) => JsonObject | null, questions?: IAcpQuestionReader | null, plans?: IAcpPlanReader | null,
    leavePlan?: (sessionId: string) => Promise<void>, approvedTools?: readonly string[], mcpToolOf?: (tool: JsonReader) => AcpMcpTool | null,
    readOnlyTools?: (signal: AbortSignal) => Promise<readonly string[]>, allowsAll?: boolean, planning?: boolean,
    toDoList?: IAcpToDoListReader | null);

  /**
   * Whether the agent reported that its context is full, as Grok's failed `context_length` retry state does, so a failed prompt says so.
   */
  public get contextFull(): boolean;

  /**
   * Whether the agent reported that it compacted the session's context during the turn.
   */
  public get compacted(): boolean;

  /**
   * The turn's id: the prompt index of the last echo of the turn's prompt that carried one, as Grok's does, or `null`.
   */
  public get nativeTurnId(): string | null;

  /**
   * The turn's last run of text: the message chunks of its last text block, joined, without thinking, notes or sub-agents' text; empty when
   * it said nothing.
   */
  public get lastText(): string;

  /**
   * The error the agent's refusal, read by the function `watchRefusals` set, stands for, or `null` when it sent none.
   */
  public get refusal(): Error | null;

  /**
   * Whether the turn delivers its session's updates: from begin until finish.
   */
  public get isActive(): boolean;

  /**
   * Starts delivery for the observed native session. A usage update's cost in US dollars is the reply's cost for a new session, and left
   * blank for a resumed one.
   */
  public beginAsync(sessionId: string, resumed: boolean, observed: ObservedSettings, roleApplied?: import("@noldova/teamrun.protocol").RoleApplication | null): Promise<void>;

  /**
   * Flushes remaining text and stops delivery, except of the updates of the background sub-agents it keeps, and ends its other sub-agents as Stopped.
   * A turn whose signal was aborted keeps none: it cancels each kept sub-agent through the agent and ends it as Stopped, without waiting for the agent's answer.
   */
  public finishAsync(): Promise<void>;

  /**
   * Whether a background sub-agent it keeps past its end still runs.
   */
  public get keepsSubAgents(): boolean;

  /**
   * Keeps its background sub-agents running past its end, as `AcpSubAgents.keep` says.
   */
  public keepSubAgents(cancel: (subAgentId: string) => Promise<boolean>, ended: (wake: TurnWake | null) => void): void;

  /**
   * Whether, once ended, a session update or Grok sub-agent update is about one of the background sub-agents it keeps, so it still handles it.
   */
  public owns(method: string, params: JsonReader): boolean;

  /**
   * Cancels the running sub-agents it keeps, as `AcpSubAgents.stopKept` does.
   */
  public stopSubAgents(): Promise<void>;

  /**
   * Ends all its running sub-agents, the kept ones too, as Stopped.
   */
  public endSubAgentsAsync(): Promise<void>;

  /**
   * Handles session updates, and Copilot's `subagent.started` session events for this session; once ended, only those `owns` names.
   * A tool call `mcpToolOf` reads as a call to TeamRun's server, or, when it reads none, whose routed `rawInput.tool_name` (with `routedMcpTool`
   * set) or else whose title names one of TeamRun's tools (`Resources.acpTeamRunToolPattern`), is reported as a note with that tool's name as
   * `tool`, `servedTool` and `servedInput` beside `input`, `rawInput.tool_input` for a routed call and `rawInput` otherwise, and no writes; any
   * other by its ACP kind.
   */
  public onNotificationAsync(method: string, params: JsonReader): Promise<void>;

  /**
   * Routes supported per-request approvals, and asks a form `elicitation/create` of the session as the
   * listener's questions: answered, it accepts with the answers as the form's content, skipped, unreadable or
   * answered with a number that isn't one, it declines, and for another session, a turn not begun or one being
   * stopped, it cancels. A request after the turn ended is still asked, since Core keeps the reply's approvals
   * open while its background work runs, and is cancelled once Core answers that the reply takes no more, as is a
   * routed call, which needs the turn's tools, and one a sub-agent makes, whose row the turn's end showed Stopped.
   * Rejects unsupported requests.
   */
  public onRequest(id: string, method: string, params: JsonReader): Promise<JsonValue>;

  /**
   * Keeps the text the turn sends as its prompt, since a `session_info_update` title that only repeats part of it is no title of the agent's own.
   * Copilot's first such title is its whole prompt, with the role in it.
   * @param text The prompt's text.
   */
  public noteSent(text: string): void;

  /**
   * Leaves the text chunks an isolated turn's agent sends as notices out of the turn's text.
   * @param notice The pattern of a notice's text, or `null` when the agent sends none.
   */
  public leaveOutNotices(notice: RegExp | null): void;

  /**
   * Leaves the main agent's message chunks that a function reads as a refusal out of the turn's text, keeping the error in `refusal`.
   * @param refusalOf Reads a chunk's text, returning the error it stands for or `null`.
   */
  public watchRefusals(refusalOf: (text: string) => Error | null): void;

  /**
   * Ends delivery at the prompt response boundary. A prompt that ended with `end_turn` first ends the sub-agents that end with their turn, such as
   * Antigravity's, as Completed.
   * @param method The request whose response came.
   * @param result The response's result, or `null`.
   */
  public onResponseAsync(method: string, result?: JsonReader | null): Promise<void>;

  /**
   * Ends delivery on process exit.
   */
  public onExitAsync(): Promise<void>;
}
