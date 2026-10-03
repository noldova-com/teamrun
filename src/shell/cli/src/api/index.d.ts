/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventEmitter } from "node:events";
import type { Readable, Writable } from "node:stream";

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
  Stopped = 6
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
   * Raises `SIGINT` when the person interrupts a running command.
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
   * @param signals Raises `SIGINT` when the person interrupts a command.
   * @param runtimeStarter Starts the runtime; a direct process launch by default.
   * @param desktopOpener Starts the desktop; a detached process by default.
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
    desktopOpener?: IDesktopOpener);
}

/**
 * The `teamrun` command line: `status`, `commands`, `run` and `open`, with
 * human output or `--json`. The package's README describes the commands,
 * options and exit codes.
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
   * sets {@link ExitCode.Failed}.
   *
   * @param run The run.
   * @param error Receives a rejection.
   * @param exit Takes the exit code.
   * @returns A promise that settles once the exit code is set.
   * @example
   * ```ts
   * import { Cli, CliEntry } from "@noldova/teamrun-shell-cli";
   *
   * export function settleAsync(): Promise<void> {
   *   return CliEntry.settleAsync(new Cli(CliEntry.createContext(process)).runAsync(process.argv.slice(2)), process.stderr, process);
   * }
   * ```
   */
  public static settleAsync(run: Promise<number>, error: Writable, exit: Pick<NodeJS.Process, "exitCode">): Promise<void>;
}
