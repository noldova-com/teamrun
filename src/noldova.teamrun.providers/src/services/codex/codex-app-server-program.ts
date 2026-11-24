/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { ILog } from "@noldova/teamrun.core";

import { CodexServerChoice } from "../../models/codex-server-choice.js";
import { CodexServerReading } from "../../models/codex-server-reading.js";
import { ProcessCommand } from "../../models/process-command.js";
import { Resources } from "../../resources.js";
import type { ExecutableVersionReader } from "../executables/executable-version.reader.js";
import type { CommandRunner } from "../process/command-runner.js";
import type { CodexAppServerDownload } from "./codex-app-server-download.js";

export class CodexAppServerProgram {
  private readonly runner: CommandRunner;
  private readonly versionReader: ExecutableVersionReader;
  private readonly download: CodexAppServerDownload;
  private readonly helpTimeout: number;
  private readonly log: ILog | null;
  private readonly readings: Map<string, Promise<CodexServerReading>> = new Map();
  private readonly refused: Set<string> = new Set();
  private readonly stopping: AbortController = new AbortController();

  public constructor(runner: CommandRunner, versionReader: ExecutableVersionReader, download: CodexAppServerDownload, helpTimeout: number, log: ILog | null = null) {
    this.runner = runner;
    this.versionReader = versionReader;
    this.download = download;
    this.helpTimeout = helpTimeout;
    this.log = log;
  }

  public static sharedOf(command: ProcessCommand): ProcessCommand {
    return command.withArguments(Resources.appServerArgument);
  }

  public async choose(command: ProcessCommand, environment: NodeJS.ProcessEnv, signal: AbortSignal): Promise<CodexServerChoice> {
    const shared = new CodexServerChoice(CodexAppServerProgram.sharedOf(command), null);
    const reading = await this.read(command, environment, signal);
    if (reading.acceptsSource)
      return new CodexServerChoice(shared.command.withArguments(Resources.codexSessionSourceArgument, Resources.codexHiddenSessionSource), null);
    if (Object.isNull(reading.version))
      return shared;
    const program = this.download.programOf(reading.version);
    return Object.isNull(program) || this.refused.has(program) ? shared
      : new CodexServerChoice(new ProcessCommand(program, [Resources.codexSessionSourceArgument, Resources.codexHiddenSessionSource]), program);
  }

  public async readNotice(command: ProcessCommand, environment: NodeJS.ProcessEnv, downloads: boolean): Promise<string | null> {
    const reading = await this.read(command, environment, this.stopping.signal);
    if (reading.acceptsSource)
      return null;
    if (Object.isNull(reading.version))
      return Resources.codexThreadsListedNotice;
    const program = this.download.programOf(reading.version);
    if (!Object.isNull(program) && !this.refused.has(program))
      return null;
    if (downloads && Object.isNull(program))
      void this.download.fetch(reading.version, this.stopping.signal);
    return Resources.codexThreadsListedNotice;
  }

  public stop(): void {
    this.stopping.abort();
  }

  public refuse(program: string, reason: string): void {
    this.refused.add(program);
    this.log?.write(Resources.formatCodexAppServerRefused(program, reason));
  }

  private read(command: ProcessCommand, environment: NodeJS.ProcessEnv, signal: AbortSignal): Promise<CodexServerReading> {
    const stamp = this.versionReader.readStamp(command);
    const known = Object.isNull(stamp) ? undefined : this.readings.get(stamp);
    if (!Object.isUndefined(known))
      return known;
    const reading = this.readNow(command, environment, signal);
    if (!Object.isNull(stamp)) {
      this.readings.set(stamp, reading);
      const forget = (): boolean => this.readings.delete(stamp);
      void reading.then(t => t.isKnown || forget(), forget);
    }
    return reading;
  }

  private async readNow(command: ProcessCommand, environment: NodeJS.ProcessEnv, signal: AbortSignal): Promise<CodexServerReading> {
    const help = await this.runner.run(CodexAppServerProgram.sharedOf(command).withArguments(Resources.helpArgument), environment, this.helpTimeout, signal)
      .catch(() => null);
    if (!Object.isNull(help) && help.succeeded && help.stdout.includes(Resources.codexSessionSourceArgument))
      return new CodexServerReading(true, null);
    return new CodexServerReading(false, await this.versionReader.read(command, environment, signal));
  }
}
