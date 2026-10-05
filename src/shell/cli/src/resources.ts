/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProductInfo } from "@noldova/teamrun-shell-runtime";

export class Resources {
  public static get productName(): string {
    return ProductInfo.current.name;
  }

  public static get productSlug(): string {
    return ProductInfo.current.slug;
  }

  public static get checkoutVariable(): string {
    return `${Resources.productSlug.toUpperCase()}_CHECKOUT`;
  }

  public static readonly clientName: string = "cli";
  public static readonly runAsNodeVariable: string = "ELECTRON_RUN_AS_NODE";
  public static readonly runAsNodeValue: string = "1";
  public static get desktopMainSegments(): readonly string[] {
    return ["node_modules", "@noldova", `${Resources.productSlug}-shell-desktop`, "main.js"];
  }

  public static readonly utf8Encoding: BufferEncoding = "utf8";
  public static readonly interruptSignal: string = "SIGINT";
  public static readonly millisecondsPerSecond: number = 1_000;
  public static readonly maximumTimeoutSeconds: number = 3_600;
  public static readonly jsonIndent: number = 2;

  public static readonly statusCommand: string = "status";
  public static readonly commandsCommand: string = "commands";
  public static readonly runCommand: string = "run";
  public static readonly openCommand: string = "open";
  public static readonly helpCommand: string = "help";
  public static readonly dataDirectoryFlag: string = "--data-dir";
  public static readonly jsonFlag: string = "--json";
  public static readonly noStartFlag: string = "--no-start";
  public static readonly takeOverFlag: string = "--take-over";
  public static readonly timeoutFlag: string = "--timeout";
  public static readonly argumentsFileFlag: string = "--args-file";
  public static readonly helpFlag: string = "--help";
  public static readonly inputArgument: string = "-";
  public static readonly valueSeparator: string = "=";
  public static readonly flagPrefix: string = "--";

  public static readonly usageCode: string = "Usage";
  public static readonly noRuntimeCode: string = "NoRuntime";
  public static readonly buildMismatchCode: string = "BuildMismatch";
  public static readonly dataDirectoryUnusableCode: string = "DataDirectoryUnusable";
  public static readonly failedCode: string = "Failed";
  public static readonly unavailableCode: string = "Unavailable";
  public static readonly unusableDirectoryErrorCodes: readonly string[] = ["EACCES", "EPERM", "EROFS", "ENOTDIR", "EEXIST"];

  public static get usage(): string {
    return [
      `Usage: ${Resources.productSlug} <command> [options]`,
      "",
      "Commands:",
      "  status                                   Reports the runtime, its modules and its work in progress. Never starts a runtime.",
      "  commands                                 Lists the runtime's commands.",
      "  run <command> [<json> | --args-file <path> | -]",
      "                                           Runs a runtime command with its arguments, printing its result.",
      `  open                                     Starts ${Resources.productName} or brings its window forward.`,
      "",
      "Options:",
      "  --data-dir <path>   The data directory to use.",
      "  --json              Prints one JSON value on standard output, and errors as JSON on standard error.",
      "  --no-start          Fails instead of starting a runtime when none is running (commands, run).",
      "  --take-over         Asks another build's idle runtime to stop and takes its place (commands, run).",
      "  --timeout <seconds> How long a command may run (run).",
      "",
      "Exit codes: 0 success, 1 the command failed, 2 usage, 3 no runtime running, 4 another build's runtime,",
      "5 data directory unusable, 6 timed out or cancelled."
    ].join("\n");
  }

  public static readonly commandRequired: string = "A command is required.";
  public static readonly commandNameRequired: string = "The run command needs the name of a command to run.";
  public static readonly argumentsTwice: string = "The command's arguments were given more than once.";
  public static readonly timeoutInvalid: string = `The --timeout option takes a number of seconds from 1 to ${Resources.maximumTimeoutSeconds}.`;
  public static get windowCommandsNote(): string {
    return `Commands of ${Resources.productName}'s window are not reachable from the command line.`;
  }

  public static readonly noCommands: string = "No commands are available.";
  public static readonly noModules: string = "none";
  public static readonly noWork: string = "none";
  public static get desktopNotStarted(): string {
    return `${Resources.productName} could not be started.`;
  }

  public static readonly cancelled: string = "The command was cancelled.";
  public static readonly timedOut: string = "The command did not finish in time.";

  public static formatUnknownCommand(command: string): string {
    return `"${command}" is not a command.`;
  }

  public static formatUnknownOption(option: string): string {
    return `"${option}" is not an option.`;
  }

  public static formatOptionNotForCommand(option: string, command: string): string {
    return `The ${option} option does not apply to ${command}.`;
  }

  public static formatOptionNeedsValue(option: string): string {
    return `The ${option} option needs a value.`;
  }

  public static formatUnexpectedArgument(argument: string): string {
    return `"${argument}" was not expected.`;
  }

  public static formatArgumentsInvalid(reason: string): string {
    return `The command's arguments are not valid JSON: ${reason}`;
  }

  public static formatArgumentsFileUnreadable(file: string, reason: string): string {
    return `The arguments file ${file} could not be read: ${reason}`;
  }

  public static formatDataDirectoryUnusable(reason: string): string {
    return `The data directory cannot be used: ${reason}`;
  }

  public static formatRuntime(productVersion: string, fingerprint: string): string {
    return `Runtime: ${Resources.productName} ${productVersion} (build ${fingerprint})`;
  }

  public static formatDataDirectory(root: string): string {
    return `Data directory: ${root}`;
  }

  public static formatModules(modules: string): string {
    return `Modules: ${modules}`;
  }

  public static formatModule(id: string, state: string, cause: string | null): string {
    return cause === null ? `${id} (${state.toLowerCase()})` : `${id} (${state.toLowerCase()}: ${cause})`;
  }

  public static formatWork(work: string): string {
    return `Work in progress: ${work}`;
  }

  public static formatOpened(root: string): string {
    return `${Resources.productName} is opening with ${root}.`;
  }
}
