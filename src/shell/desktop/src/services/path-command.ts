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
import { Resources } from "../resources.js";

export class PathCommand {
  private readonly target: string;
  private readonly link: string;
  private readonly runProgramAsync: (program: string, args: readonly string[]) => Promise<void>;

  public constructor(target: string, link: string, runProgramAsync: (program: string, args: readonly string[]) => Promise<void>) {
    this.target = target;
    this.link = link;
    this.runProgramAsync = runProgramAsync;
  }

  public static forBundle(executablePath: string, runProgramAsync: (program: string, args: readonly string[]) => Promise<void>): PathCommand {
    return new PathCommand(
      join(dirname(executablePath), ...Resources.bundleCommandSegments, Resources.commandName),
      join(Resources.pathCommandFolder, Resources.commandName),
      runProgramAsync);
  }

  public get linkPath(): string {
    return this.link;
  }

  public async installAsync(): Promise<PathCommandOutcome> {
    if (!existsSync(this.target))
      return PathCommandOutcome.Missing;
    try {
      const stats = await PathCommand.readStatsAsync(this.link);
      if (!Object.isNull(stats) && !stats.isSymbolicLink())
        return PathCommandOutcome.Occupied;
      if (!Object.isNull(stats) && await readlink(this.link) === this.target)
        return PathCommandOutcome.AlreadyInstalled;
      await this.writeLinkAsync(!Object.isNull(stats));
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
      throw new PathCommandException(Resources.formatPathCommandFailed(this.link, String(error)), new ExceptionOptions(error));
    }
  }

  protected async writeLinkAsync(isReplacing: boolean): Promise<void> {
    if (isReplacing)
      await rm(this.link);
    await mkdir(dirname(this.link), { recursive: true });
    await symlink(this.target, this.link);
  }

  private static hasCode(error: unknown, codes: readonly string[]): boolean {
    return Object.isObject(error) && Resources.errorCodeField in error && codes.includes(String(error[Resources.errorCodeField]));
  }

  private static async readStatsAsync(file: string): Promise<Stats | null> {
    try {
      return await lstat(file);
    }
    catch {
      return null;
    }
  }
}
