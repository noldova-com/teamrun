/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { CliEntry } from "@noldova/desktop.cli";
import "@noldova/context.core";
import { TeammateCommand } from "@noldova/teamrun.core";

import { Resources } from "../resources.js";

export class TeammateCommandFolder {
  private static readonly WINDOWS_PLATFORM: string = "win32";
  private static readonly PATH_VARIABLE: string = "PATH";
  private static readonly RUN_AS_NODE: string = "ELECTRON_RUN_AS_NODE=1";
  private static readonly DATA_DIRECTORY_FLAG: string = "--data-dir=";
  private static readonly PROGRAM_VARIABLE: string = "TEAMRUN_COMMAND_PROGRAM";
  private static readonly ENTRY_VARIABLE: string = "TEAMRUN_COMMAND_ENTRY";
  private static readonly DATA_DIRECTORY_VARIABLE: string = "TEAMRUN_COMMAND_DATA_DIR";
  private static readonly WINDOWS_EXTENSION: string = ".cmd";
  private static readonly WINDOWS_LINE_SEPARATOR: string = "\r\n";
  private static readonly POSIX_LINE_SEPARATOR: string = "\n";
  private static readonly EXECUTABLE_MODE: number = 0o755;

  private readonly program: string;
  private readonly entry: string;
  private readonly platform: string;
  private readonly environment: Readonly<Record<string, string | undefined>>;

  public constructor(program: string, entry: string, platform: string, environment: Readonly<Record<string, string | undefined>>) {
    this.program = program;
    this.entry = entry;
    this.platform = platform;
    this.environment = environment;
  }

  public static fromProcess(): TeammateCommandFolder {
    return new TeammateCommandFolder(process.execPath, CliEntry.entryPath, process.platform, process.env);
  }

  public async writeAsync(moduleFolder: string, productSlug: string, moduleId: string): Promise<TeammateCommand> {
    const folder = path.join(moduleFolder, Resources.commandFolderName);
    const dataDirectory = path.dirname(path.dirname(moduleFolder));
    const script = path.join(folder, productSlug);
    await mkdir(folder, { recursive: true });
    await writeFile(script, this.describePosixCommand(dataDirectory));
    await chmod(script, TeammateCommandFolder.EXECUTABLE_MODE);
    if (this.isWindows)
      await writeFile(`${script}${TeammateCommandFolder.WINDOWS_EXTENSION}`, TeammateCommandFolder.describeWindowsCommand());
    return this.commandOf(moduleFolder, productSlug, moduleId, this.environment);
  }

  public commandOf(moduleFolder: string, productSlug: string, moduleId: string, environment: Readonly<Record<string, string | undefined>>): TeammateCommand {
    const folder = path.join(moduleFolder, Resources.commandFolderName);
    return new TeammateCommand(Resources.formatCommand(productSlug, moduleId), this.describeEnvironment(folder, path.dirname(path.dirname(moduleFolder)), environment));
  }

  private get isWindows(): boolean {
    return this.platform === TeammateCommandFolder.WINDOWS_PLATFORM;
  }

  private describeEnvironment(folder: string, dataDirectory: string, inherited: Readonly<Record<string, string | undefined>>): Record<string, string> {
    const environment = this.describePath(folder, inherited);
    if (!this.isWindows)
      return environment;
    return {
      ...environment,
      [TeammateCommandFolder.PROGRAM_VARIABLE]: this.program,
      [TeammateCommandFolder.ENTRY_VARIABLE]: this.entry,
      [TeammateCommandFolder.DATA_DIRECTORY_VARIABLE]: dataDirectory
    };
  }

  private describePath(folder: string, environment: Readonly<Record<string, string | undefined>>): Record<string, string> {
    const delimiter = this.isWindows ? path.win32.delimiter : path.posix.delimiter;
    const name = this.isWindows
      ? Object.keys(environment).find(t => t.toUpperCase() === TeammateCommandFolder.PATH_VARIABLE) ?? TeammateCommandFolder.PATH_VARIABLE
      : TeammateCommandFolder.PATH_VARIABLE;
    const inherited = environment[name];
    return { [name]: Object.isUndefined(inherited) || inherited.length === 0 ? folder : `${folder}${delimiter}${inherited}` };
  }

  private describePosixCommand(dataDirectory: string): string {
    const quote = (value: string): string => `'${(this.isWindows ? value.replaceAll("\\", "/") : value).replaceAll("'", "'\\''")}'`;
    return [
      "#!/bin/sh",
      `export ${TeammateCommandFolder.RUN_AS_NODE}`,
      `unset ${Resources.crashPipeVariable}`,
      `exec ${quote(this.program)} ${quote(this.entry)} ${quote(`${TeammateCommandFolder.DATA_DIRECTORY_FLAG}${dataDirectory}`)} "$@"`
    ].map(t => `${t}${TeammateCommandFolder.POSIX_LINE_SEPARATOR}`).join(String.empty);
  }

  private static describeWindowsCommand(): string {
    const variable = (name: string): string => `%${name}%`;
    return [
      "@echo off",
      "setlocal DisableDelayedExpansion",
      `if not defined ${TeammateCommandFolder.PROGRAM_VARIABLE} (`,
      `  echo ${Resources.commandOutsideTurn} 1>&2`,
      "  exit /b 1",
      ")",
      `set ${TeammateCommandFolder.RUN_AS_NODE}`,
      `set ${Resources.crashPipeVariable}=`,
      `"${variable(TeammateCommandFolder.PROGRAM_VARIABLE)}" "${variable(TeammateCommandFolder.ENTRY_VARIABLE)}" `
        + `"${TeammateCommandFolder.DATA_DIRECTORY_FLAG}${variable(TeammateCommandFolder.DATA_DIRECTORY_VARIABLE)}" %*`,
      "exit /b %ERRORLEVEL%"
    ].map(t => `${t}${TeammateCommandFolder.WINDOWS_LINE_SEPARATOR}`).join(String.empty);
  }
}
