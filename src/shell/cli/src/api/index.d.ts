/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventEmitter } from "node:events";
import type { Readable, Writable } from "node:stream";

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import type { BuildIdentity } from "@noldova/teamrun-shell-protocol";
import type { IProcessStarter } from "@noldova/teamrun-shell-runtime";

/**
 * The command line's exit codes. They are stable: scripts may rely on them.
 */
export declare enum ExitCode {
  /**
   * The command succeeded.
   */
  Success = 0,

  /**
   * The command, or the method it called, failed.
   */
  Failed = 1,

  /**
   * The command line was not valid.
   */
  Usage = 2,

  /**
   * No runtime is running, and the command does not start one.
   */
  NoRuntime = 3,

  /**
   * Another build's runtime owns the data directory and was not taken over.
   */
  BuildMismatch = 4,

  /**
   * The data directory cannot be used: it holds data from before the shell,
   * another program's runtime owns it, or it is not writable.
   */
  DataDirectoryUnusable = 5,

  /**
   * The command timed out or was cancelled.
   */
  Stopped = 6,

  /**
   * The command's module is not active: it failed or is blocked in the
   * runtime, or its command-line part failed to start.
   */
  ModuleNotActive = 7,

  /**
   * TeamRun is installing an update: the update was still under way after
   * the wait, or one handed to the installer may not have finished.
   */
  Updating = 8,

  /**
   * The command succeeded and printed its result, but a command-line part
   * failed to stop.
   */
  PartNotStopped = 9
}

/**
 * Starts the desktop for `open`.
 */
export interface IDesktopOpener {
  /**
   * Starts the program detached from the command line.
   *
   * @param executable The program to start.
   * @param launchArguments Its arguments.
   * @param environment Its environment.
   * @returns A promise that settles once the program has started.
   * @throws {Error} Rejected when the program cannot be started.
   * @example
   * ```ts
   * import type { IDesktopOpener } from "@noldova/teamrun-shell-cli";
   *
   * export function openAsync(opener: IDesktopOpener, executable: string): Promise<void> {
   *   return opener.openAsync(executable, ["--data-dir=/data"], process.env);
   * }
   * ```
   */
  openAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<void>;
}

/**
 * Starts the desktop as a detached process that outlives the command line.
 */
export declare class DesktopOpener implements IDesktopOpener {
  /**
   * Starts the program detached, with its standard streams ignored, and
   * lets the command line end without waiting for it.
   *
   * @param executable The program to start.
   * @param launchArguments Its arguments.
   * @param environment Its environment.
   * @returns A promise that settles once the program has started.
   * @throws {Error} Rejected when the program cannot be started.
   * @example
   * ```ts
   * import { DesktopOpener } from "@noldova/teamrun-shell-cli";
   *
   * export function openAsync(executable: string): Promise<void> {
   *   return new DesktopOpener().openAsync(executable, ["--data-dir=/data"], process.env);
   * }
   * ```
   */
  public openAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<void>;
}

/**
 * What a command line runs with: its environment, its streams, and the
 * program and runtime build it starts.
 */
export declare class CliContext {
  /**
   * The environment, which also names the development checkout.
   */
  public readonly environment: NodeJS.ProcessEnv;

  /**
   * The platform, as `process.platform` names it.
   */
  public readonly platform: string;

  /**
   * The person's home folder.
   */
  public readonly homeFolder: string;

  /**
   * The program that runs the command line, which also starts the runtime
   * and the desktop.
   */
  public readonly executablePath: string;

  /**
   * The runtime's entry script.
   */
  public readonly runtimeEntryPath: string;

  /**
   * The build the command line belongs to.
   */
  public readonly identity: BuildIdentity;

  /**
   * Receives the command's output.
   */
  public readonly output: Writable;

  /**
   * Receives errors.
   */
  public readonly error: Writable;

  /**
   * Supplies a command's arguments when they are read from standard input.
   */
  public readonly input: Readable;

  /**
   * Raises `SIGINT` when the person interrupts a running command, and `SIGHUP` when its terminal closes.
   */
  public readonly signals: EventEmitter;

  /**
   * Starts the runtime.
   */
  public readonly runtimeStarter: IProcessStarter;

  /**
   * Starts the desktop.
   */
  public readonly desktopOpener: IDesktopOpener;

  /**
   * The command line's process id, which it reports when a runtime prepares
   * for an update.
   */
  public readonly processId: number;

  /**
   * How long a command waits for an update that is under way to finish
   * before it gives up, in milliseconds.
   */
  public readonly updateWaitMilliseconds: number;

  /**
   * Creates the context.
   *
   * @param environment The environment.
   * @param platform The platform.
   * @param homeFolder The person's home folder.
   * @param executablePath The program that runs the command line.
   * @param runtimeEntryPath The runtime's entry script.
   * @param identity The command line's build.
   * @param output Receives the command's output.
   * @param error Receives errors.
   * @param input Supplies arguments read from standard input.
   * @param signals Raises `SIGINT` when the person interrupts a command, and `SIGHUP` when its terminal closes.
   * @param runtimeStarter Starts the runtime; a direct process launch by default.
   * @param desktopOpener Starts the desktop; a detached process by default.
   * @param processId The command line's process id; the running process's by default.
   * @param updateWaitMilliseconds How long to wait for an update under way, in milliseconds; 30 seconds by default.
   * @example
   * ```ts
   * import { homedir } from "node:os";
   *
   * import { CliContext } from "@noldova/teamrun-shell-cli";
   * import { RuntimeBuild, RuntimeEntry } from "@noldova/teamrun-shell-runtime";
   *
   * export const context: CliContext = new CliContext(process.env, process.platform, homedir(), process.execPath,
   *   RuntimeEntry.entryPath, RuntimeBuild.identity, process.stdout, process.stderr, process.stdin, process);
   * ```
   */
  public constructor(
    environment: NodeJS.ProcessEnv,
    platform: string,
    homeFolder: string,
    executablePath: string,
    runtimeEntryPath: string,
    identity: BuildIdentity,
    output: Writable,
    error: Writable,
    input: Readable,
    signals: EventEmitter,
    runtimeStarter?: IProcessStarter,
    desktopOpener?: IDesktopOpener,
    processId?: number,
    updateWaitMilliseconds?: number);
}

/**
 * The `teamrun` command line: `status`, `commands`, `run`, `open`, `help` and
 * the modules' own commands, with human output or `--json`. The package's
 * README describes the commands, options and exit codes.
 */
export declare class Cli {
  /**
   * Creates the command line.
   *
   * @param context What it runs with.
   * @example
   * ```ts
   * import { Cli, type CliContext } from "@noldova/teamrun-shell-cli";
   *
   * export function create(context: CliContext): Cli {
   *   return new Cli(context);
   * }
   * ```
   */
  public constructor(context: CliContext);

  /**
   * Runs one command line. Output goes to the context's output, errors to
   * its error stream; nothing is ever asked of the person.
   *
   * @param commandLineArguments The arguments after the program and script.
   * @returns A promise of the exit code, one of {@link ExitCode}.
   * @example
   * ```ts
   * import { Cli, type CliContext } from "@noldova/teamrun-shell-cli";
   *
   * export function statusAsync(context: CliContext): Promise<number> {
   *   return new Cli(context).runAsync(["status", "--json"]);
   * }
   * ```
   */
  public runAsync(commandLineArguments: readonly string[]): Promise<number>;
}

/**
 * The command line's program entry, run on the product's own executable in
 * Node mode.
 */
export declare class CliEntry {
  /**
   * The entry script to run with the product's executable.
   *
   * @example
   * ```ts
   * import { CliEntry } from "@noldova/teamrun-shell-cli";
   *
   * export const entry: string = CliEntry.entryPath;
   * ```
   */
  public static get entryPath(): string;

  /**
   * Creates the context of a running process.
   *
   * @param running The process.
   * @returns Its context, with the installed runtime and this build.
   * @example
   * ```ts
   * import { CliEntry, type CliContext } from "@noldova/teamrun-shell-cli";
   *
   * export const context: CliContext = CliEntry.createContext(process);
   * ```
   */
  public static createContext(running: NodeJS.Process): CliContext;

  /**
   * Sets the exit code a run ends with, or writes a run that rejected and
   * sets {@link ExitCode.Failed}, then ends the process once both streams
   * have written what they hold, even while a command-line part that never
   * finished starting still holds a timer, socket or child process.
   *
   * @param run The run.
   * @param output The standard output the run writes to.
   * @param error Receives a rejection.
   * @param exit Takes the exit code and ends the process.
   * @returns A promise that settles once the process is told to exit.
   * @example
   * ```ts
   * import { Cli, CliEntry } from "@noldova/teamrun-shell-cli";
   *
   * export function settleAsync(): Promise<void> {
   *   return CliEntry.settleAsync(new Cli(CliEntry.createContext(process)).runAsync(process.argv.slice(2)), process.stdout, process.stderr, process);
   * }
   * ```
   */
  public static settleAsync(run: Promise<number>, output: Writable, error: Writable, exit: Pick<NodeJS.Process, "exitCode"> & { exit(): void }): Promise<void>;
}

/**
 * The exception a module command throws when it refuses its arguments: the
 * command line exits with {@link ExitCode.Usage} and prints the message with
 * the command's usage.
 */
export declare class UsageException extends Exception {
  /**
   * The exception's name, `"UsageException"`, which the class sets itself so
   * that a minified build keeps it.
   */
  public override readonly name: string;

  /**
   * Creates the exception.
   *
   * @param message What is wrong with the arguments, for people.
   * @example
   * ```ts
   * import { UsageException } from "@noldova/teamrun-shell-cli";
   *
   * export function refuse(): never {
   *   throw new UsageException("The title cannot be blank.");
   * }
   * ```
   */
  public constructor(message: string);
}

/**
 * The exception a module command throws when it fails: the command line exits
 * with {@link ExitCode.Failed} and reports the module's own code, message and
 * details.
 */
export declare class CliCommandException extends Exception {
  /**
   * The exception's name, `"CliCommandException"`, which the class sets itself
   * so that a minified build keeps it.
   */
  public override readonly name: string;

  /**
   * The module's code for the failure, which `--json` reports.
   */
  public readonly code: string;

  /**
   * More about the failure, which `--json` reports, or `null`.
   */
  public readonly details: JsonObject | null;

  /**
   * Creates the exception.
   *
   * @param code The module's code for the failure; not blank.
   * @param message What failed, for people.
   * @param details More about the failure; `null` by default.
   * @throws ArgumentException When the code is blank.
   * @example
   * ```ts
   * import { CliCommandException } from "@noldova/teamrun-shell-cli";
   *
   * export function fail(title: string): never {
   *   throw new CliCommandException("NoteExists", `A note named ${title} exists already.`, { title });
   * }
   * ```
   */
  public constructor(code: string, message: string, details?: JsonObject | null);
}

/**
 * What a module command returns: its JSON value, which `--json` prints, and
 * its text for people, which the command line prints otherwise.
 */
export declare class CliCommandResult {
  /**
   * The command's JSON value.
   */
  public readonly value: JsonValue;

  /**
   * The command's text for people; nothing is printed when it is empty.
   */
  public readonly text: string;

  /**
   * Creates the result.
   *
   * @param value The command's JSON value.
   * @param text Its text for people.
   * @example
   * ```ts
   * import { CliCommandResult } from "@noldova/teamrun-shell-cli";
   *
   * export const result: CliCommandResult = new CliCommandResult({ id: 7 }, "Added note 7.");
   * ```
   */
  public constructor(value: JsonValue, text: string);
}

/**
 * Runs one of a module's command-line commands.
 */
export interface ICliCommandHandler {
  /**
   * Runs the command once the command line has read its arguments and options
   * against the command's declaration.
   *
   * @param values The arguments and options by their names: a variadic
   * argument and a repeated option as lists, a `Boolean` option as `true`, an
   * option not given as its default, and nothing for others not given.
   * @param signal Aborts when the person presses Ctrl+C or the command's
   * `--timeout` passes; the command line then reports the stop without
   * waiting for the handler.
   * @returns A promise of the command's result.
   * @throws UsageException Rejected when the command refuses its arguments.
   * @throws CliCommandException Rejected when the command fails; the command
   * line reports any other rejection as one with the code `Failed`.
   * @example
   * ```ts
   * import { CliCommandResult, type ICliCommandHandler } from "@noldova/teamrun-shell-cli";
   *
   * export const handler: ICliCommandHandler = {
   *   handleAsync: async values => new CliCommandResult(values, `Got ${Object.keys(values).length} values.`)
   * };
   * ```
   */
  handleAsync(values: Readonly<Record<string, JsonValue>>, signal: AbortSignal): Promise<CliCommandResult>;
}

/**
 * What a module's command-line part may register and use while it activates.
 */
export interface ICliPartContext {
  /**
   * The part's module.
   */
  readonly moduleId: string;

  /**
   * Registers one of the command-line commands the module declares.
   *
   * @param name The command's declared name, such as `notes.addNote`.
   * @param handler Runs it.
   * @throws ArgumentException When the module does not declare the command or
   * it is registered already.
   * @example
   * ```ts
   * import { CliCommandResult, type ICliPartContext } from "@noldova/teamrun-shell-cli";
   *
   * export function register(context: ICliPartContext): void {
   *   context.registerCommand("notes.addNote", { handleAsync: async () => new CliCommandResult(null, "Added.") });
   * }
   * ```
   */
  registerCommand(name: string, handler: ICliCommandHandler): void;

  /**
   * Calls a method of the runtime over the command line's connection, which
   * is how a command reaches its module's runtime part. The method belongs to
   * the part's module or to a module it depends on.
   *
   * @param method The method's qualified name, such as `notes.add`.
   * @param payload Its payload.
   * @param signal Cancels the call; pass the command's signal.
   * @returns A promise of the method's result.
   * @throws ArgumentException Rejected when the name is not a qualified name
   * or the method belongs to another module.
   * @throws MethodFailureException Rejected with the runtime's failure.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/teamrun-foundation-json";
   * import type { ICliPartContext } from "@noldova/teamrun-shell-cli";
   *
   * export function addAsync(context: ICliPartContext, title: string, signal: AbortSignal): Promise<JsonValue> {
   *   return context.requestAsync("notes.add", { title }, signal);
   * }
   * ```
   */
  requestAsync(method: string, payload: JsonValue, signal: AbortSignal): Promise<JsonValue>;
}

/**
 * A module's command-line part. A module's CLI package exports it as the
 * class `CliPart`, which the command line constructs without arguments. The
 * command line starts it, after the parts of the module's dependencies, only
 * to run one of its module's commands or of a module that depends on it.
 */
export interface ICliPart {
  /**
   * Activates the part: it registers the module's commands.
   *
   * @param context What the part may register and use.
   * @returns A promise that resolves once the part is active; a rejection
   * ends the command with {@link ExitCode.ModuleNotActive}.
   * @example
   * ```ts
   * import { CliCommandResult, type ICliPart, type ICliPartContext } from "@noldova/teamrun-shell-cli";
   *
   * export class CliPart implements ICliPart {
   *   public async activateAsync(context: ICliPartContext): Promise<void> {
   *     context.registerCommand("notes.addNote", {
   *       handleAsync: async (values, signal) => new CliCommandResult(await context.requestAsync("notes.add", values, signal), "Added.")
   *     });
   *   }
   *
   *   public async deactivateAsync(): Promise<void> {
   *   }
   * }
   * ```
   */
  activateAsync(context: ICliPartContext): Promise<void>;

  /**
   * Deactivates the part once the command has ended, also when its
   * activation failed: it releases its timers and files. A part still
   * activating when the command times out or is cancelled is deactivated once
   * its activation settles.
   *
   * @returns A promise that resolves once the part has released everything; a
   * rejection is reported on standard error, and a command that succeeded
   * then ends with {@link ExitCode.PartNotStopped}.
   * @example
   * ```ts
   * import type { ICliPart } from "@noldova/teamrun-shell-cli";
   *
   * export function stopAsync(part: ICliPart): Promise<void> {
   *   return part.deactivateAsync();
   * }
   * ```
   */
  deactivateAsync(): Promise<void>;
}
