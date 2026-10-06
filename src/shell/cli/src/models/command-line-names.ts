/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CommandLineNames {
  public static readonly status: string = "status";
  public static readonly commands: string = "commands";
  public static readonly run: string = "run";
  public static readonly open: string = "open";
  public static readonly help: string = "help";
  public static readonly ownCommands: readonly string[] = [
    CommandLineNames.status,
    CommandLineNames.commands,
    CommandLineNames.run,
    CommandLineNames.open,
    CommandLineNames.help
  ];

  public static readonly dataDirectory: string = "data-dir";
  public static readonly deviceDirectory: string = "device-dir";
  public static readonly json: string = "json";
  public static readonly noStart: string = "no-start";
  public static readonly takeOver: string = "take-over";
  public static readonly timeout: string = "timeout";
  public static readonly argumentsFile: string = "args-file";
  public static readonly valueOptions: readonly string[] = [
    CommandLineNames.dataDirectory,
    CommandLineNames.deviceDirectory,
    CommandLineNames.timeout,
    CommandLineNames.argumentsFile
  ];
  public static readonly switches: readonly string[] = [
    CommandLineNames.json,
    CommandLineNames.noStart,
    CommandLineNames.takeOver,
    CommandLineNames.help
  ];
  public static readonly ownOptions: readonly string[] = [...CommandLineNames.valueOptions, ...CommandLineNames.switches];
}
