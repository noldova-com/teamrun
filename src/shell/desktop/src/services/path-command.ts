/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, type Stats } from "node:fs";
import { lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { PathCommandOutcome } from "../enums/path-command-outcome.js";
import { PathCommandException } from "../exceptions/path-command.exception.js";
import type { IPathCommandFiles } from "../interfaces/i-path-command-files.js";
import { Resources } from "../resources.js";

export class PathCommand {
  private readonly target: string;
  private readonly link: string;
  private readonly files: IPathCommandFiles;
  private readonly runProgramAsync: (program: string, args: readonly string[]) => Promise<void>;

  public constructor(target: string, link: string, files: IPathCommandFiles, runProgramAsync: (program: string, args: readonly string[]) => Promise<void>) {
    this.target = target;
    this.link = link;
    this.files = files;
    this.runProgramAsync = runProgramAsync;
  }

  public static forBundle(executablePath: string, runProgramAsync: (program: string, args: readonly string[]) => Promise<void>): PathCommand {
    return new PathCommand(
      join(dirname(executablePath), ...Resources.bundleCommandSegments, Resources.commandName),
      join(Resources.pathCommandFolder, Resources.commandName),
      { lstat, readlink, rm, mkdir, symlink },
      runProgramAsync);
  }

  public get linkPath(): string {
    return this.link;
  }

  public async installAsync(): Promise<PathCommandOutcome> {
    if (!existsSync(this.target))
      return PathCommandOutcome.Missing;
    try {
      const stats = await this.readStatsAsync();
      if (!Object.isNull(stats) && !stats.isSymbolicLink())
        return PathCommandOutcome.Occupied;
      if (!Object.isNull(stats) && await this.files.readlink(this.link) === this.target)
        return PathCommandOutcome.AlreadyInstalled;
      if (!Object.isNull(stats))
        await this.files.rm(this.link);
      await this.files.mkdir(dirname(this.link), { recursive: true });
      await this.files.symlink(this.target, this.link);
      return PathCommandOutcome.Installed;
    }
    catch (error) {
      if (!PathCommand.hasCode(error, Resources.deniedErrorCodes))
        throw new PathCommandException(Resources.formatPathCommandFailed(this.link, String(error)), new ExceptionOptions(error));
    }
    try {
      await this.runProgramAsync(Resources.scriptRunner, [...Resources.administratorScript, this.target, dirname(this.link), this.link, Resources.formatAdministratorPrompt(this.link)]);
      return PathCommandOutcome.Installed;
    }
    catch (error) {
      if (String(error).includes(Resources.userCancelledCode))
        return PathCommandOutcome.Cancelled;
      if (String(error).includes(Resources.occupiedExitCode))
        return PathCommandOutcome.Occupied;
      throw new PathCommandException(Resources.formatPathCommandFailed(this.link, String(error)), new ExceptionOptions(error));
    }
  }

  private async readStatsAsync(): Promise<Stats | null> {
    try {
      return await this.files.lstat(this.link);
    }
    catch (error) {
      if (PathCommand.hasCode(error, [Resources.missingErrorCode]))
        return null;
      throw error;
    }
  }

  private static hasCode(error: unknown, codes: readonly string[]): boolean {
    return Object.isObject(error) && Resources.errorCodeField in error && codes.includes(String(error[Resources.errorCodeField]));
  }
}
