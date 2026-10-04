/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { addAbortListener, once } from "node:events";
import type { Writable } from "node:stream";
import { inspect } from "node:util";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { ProcessStartException } from "../../exceptions/process-start.exception.js";
import type { IProcessEnder } from "../../interfaces/process-ender.js";
import { OwnedProcess } from "../../models/owned-process.js";
import type { ProcessEnding } from "../../models/process-ending.js";
import { ProcessExit } from "../../models/process-exit.js";
import { ProcessLaunch } from "../../models/process-launch.js";
import type { ProcessRecord } from "../../models/process-record.js";
import type { ProcessRequest } from "../../models/process-request.js";
import { ProcessSettings } from "../../models/process-settings.js";
import { RunningProcess } from "../../models/running-process.js";
import { RunningProgram } from "../../models/running-program.js";
import { Resources } from "../../resources.js";
import type { SystemCommand } from "../commands/system-command.js";
import type { ShellDatabase } from "../database/shell-database.js";
import { BatchCommandLine } from "./batch-command-line.js";
import { ProcessEnderFactory } from "./process-ender-factory.js";
import { ProcessEnvironment } from "./process-environment.js";
import { ProcessRecordStore } from "./process-record-store.js";
import { ProgramLocator } from "./program-locator.js";

export class ProcessSupervisor {
  private readonly platform: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly records: ProcessRecordStore;
  private readonly locator: ProgramLocator;
  private readonly ender: IProcessEnder;
  private readonly diagnostics: Writable;
  private readonly running: Map<OwnedProcess, ProcessRecord> = new Map();
  private readonly leftovers: Set<ProcessRecord> = new Set();
  private readonly pending: Map<Promise<void>, string> = new Map();

  public constructor(
    database: ShellDatabase,
    platform: string,
    environment: NodeJS.ProcessEnv,
    command: SystemCommand,
    diagnostics: Writable,
    settings: ProcessSettings = new ProcessSettings()) {
    this.platform = platform;
    this.environment = environment;
    this.records = new ProcessRecordStore(database);
    this.locator = new ProgramLocator(platform);
    this.ender = ProcessEnderFactory.create(platform, command, environment, settings);
    this.diagnostics = diagnostics;
  }

  public get programs(): readonly RunningProgram[] {
    return [...this.running].map(([process, record]) => new RunningProgram(record.moduleId, record.program, record.processId, process.started));
  }

  public startAsync(moduleId: string, request: ProcessRequest): Promise<OwnedProcess> {
    const starting = this.launchAsync(moduleId, request);
    this.track(moduleId, starting.then(() => undefined, () => undefined));
    return starting;
  }

  public async stopOwnedByAsync(moduleId: string): Promise<void> {
    await Promise.all([...this.pending].filter(([, t]) => t === moduleId).map(([t]) => t));
    const running = [...this.running].filter(([, t]) => t.moduleId === moduleId).map(([process, record]) => new RunningProcess(process, record));
    const leftovers = [...this.leftovers].filter(t => t.moduleId === moduleId);
    if (running.length > 0 || leftovers.length > 0)
      await this.endAsync(running, leftovers);
  }

  public async cleanUpAsync(): Promise<void> {
    const records = this.records.readAll();
    if (records.length === 0)
      return;
    try {
      for (const ending of await this.ender.endLeftoversAsync(records)) {
        this.records.remove(ending.record);
        if (ending.forced.length > 0)
          this.write(ending.record, Resources.formatLeftoversEnded(ending.forced));
        this.reportRemaining(ending);
      }
    }
    catch (error) {
      for (const record of records)
        this.report(record, error);
    }
  }

  private async launchAsync(moduleId: string, request: ProcessRequest): Promise<OwnedProcess> {
    request.signal?.throwIfAborted();
    const environment = ProcessEnvironment.create(this.platform, this.environment, request);
    const program = this.locator.locate(request.program, environment);
    const launch = this.locator.isBatch(program) ? BatchCommandLine.create(this.environment, program, request.arguments) : new ProcessLaunch(program, request.arguments, false);
    const requested = Date.now();
    const child = this.spawn(program, launch, request.workingFolder, environment.values);
    const exited = new Promise<ProcessExit>(resolve => child.once(Resources.exitEvent, (code: number | null, signal: NodeJS.Signals | null) => resolve(new ProcessExit(code, signal))));
    try {
      await once(child, Resources.spawnEvent);
    }
    catch (error) {
      throw new ProcessStartException(Resources.formatProcessStartFailed(program), new ExceptionOptions(error));
    }

    const record = this.record(child, moduleId, program, launch.executable, requested);
    const owned = new OwnedProcess(child, program, new Date(record.started), exited, t => this.stopAsync(t));
    child.stdin.on(Resources.errorEvent, (error: Error) => this.report(record, error));
    this.running.set(owned, record);
    if (!Object.isUndefined(request.signal)) {
      const listener = addAbortListener(request.signal, () => void owned.stopAsync());
      void exited.then(() => listener[Symbol.dispose]());
    }
    void exited.then(t => this.track(moduleId, this.handleExitAsync(owned, record, t)));
    return owned;
  }

  private spawn(program: string, launch: ProcessLaunch, workingFolder: string, environment: NodeJS.ProcessEnv): ChildProcessWithoutNullStreams {
    try {
      return spawn(launch.executable, [...launch.arguments], {
        cwd: workingFolder,
        env: environment,
        stdio: Resources.pipedOutput,
        windowsHide: true,
        detached: this.platform !== Resources.windowsPlatform,
        windowsVerbatimArguments: launch.isVerbatim
      });
    }
    catch (error) {
      throw new ProcessStartException(Resources.formatProcessStartFailed(program), new ExceptionOptions(error));
    }
  }

  private record(child: ChildProcessWithoutNullStreams, moduleId: string, program: string, executable: string, requested: number): ProcessRecord {
    try {
      return this.records.add(moduleId, Number(child.pid), program, executable, requested, Date.now());
    }
    catch (error) {
      child.kill(Resources.killSignal);
      throw error;
    }
  }

  private stopAsync(owned: OwnedProcess): Promise<void> {
    const record = this.running.get(owned);
    if (Object.isUndefined(record))
      return Promise.resolve();
    const stop = this.endAsync([new RunningProcess(owned, record)], []);
    this.track(record.moduleId, stop);
    return stop;
  }

  private async handleExitAsync(owned: OwnedProcess, record: ProcessRecord, exit: ProcessExit): Promise<void> {
    if (!this.running.delete(owned))
      return;
    try {
      const endings = await this.ender.endAfterExitAsync(record, exit);
      if (Object.isNull(endings))
        this.leftovers.add(record);
      else
        this.finish(endings);
    }
    catch (error) {
      this.leftovers.add(record);
      this.report(record, error);
    }
  }

  private async endAsync(running: readonly RunningProcess[], leftovers: readonly ProcessRecord[]): Promise<void> {
    for (const item of running)
      this.running.delete(item.process);
    for (const record of leftovers)
      this.leftovers.delete(record);
    try {
      this.finish(await this.ender.stopAsync(running, leftovers));
    }
    catch (error) {
      for (const record of [...running.map(t => t.record), ...leftovers])
        this.report(record, error);
    }
  }

  private finish(endings: readonly ProcessEnding[]): void {
    for (const ending of endings) {
      this.records.remove(ending.record);
      if (ending.forced.length > 0)
        this.write(ending.record, Resources.formatProcessesForced(ending.forced));
      this.reportRemaining(ending);
    }
  }

  private reportRemaining(ending: ProcessEnding): void {
    if (ending.remaining.length > 0)
      this.write(ending.record, Resources.formatProcessesRemaining(ending.remaining));
  }

  private report(record: ProcessRecord, error: unknown): void {
    this.write(record, inspect(error));
  }

  private write(record: ProcessRecord, text: string): void {
    this.diagnostics.write(Resources.formatProcessDiagnostic(record.moduleId, record.program, record.processId, text));
  }

  private track(moduleId: string, work: Promise<void>): void {
    this.pending.set(work, moduleId);
    void work.finally(() => this.pending.delete(work));
  }
}
