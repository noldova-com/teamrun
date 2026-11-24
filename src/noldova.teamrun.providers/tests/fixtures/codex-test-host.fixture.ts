/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type ILog, type ITimer, NodeTimer, TurnRequest } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { AuthStatus, Provider, RequestedSettings } from "@noldova/teamrun.protocol";
import { AppServerClient, AppServerClientInfo, CodexAdapter, type CodexAppServerProgram, type IOrphanSweep, NodeProcessStarter, ProcessCommand, ProcessTerminator,
  ProviderTimings } from "@noldova/teamrun.providers";

import { ProgramRecorder } from "./program-recorder.fixture.js";
import { IsolatedPath } from "./isolated-path.fixture.js";
import { StampedVersionReader } from "./stamped-version-reader.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class CodexTestHost implements Disposable {
  public static readonly FAKE_SERVER_PATH: string = fileURLToPath(new URL("./fake-codex-app-server.fixture.js", import.meta.url));

  public readonly directory: TemporaryDirectory = new TemporaryDirectory();
  public readonly environment: NodeJS.ProcessEnv = IsolatedPath.environment(this.directory.path);
  public readonly command: ProcessCommand = new ProcessCommand(process.execPath, [CodexTestHost.FAKE_SERVER_PATH]);
  public readonly terminator: ProcessTerminator = new ProcessTerminator(process.platform);
  public readonly starter: NodeProcessStarter = new NodeProcessStarter(this.terminator);
  public readonly timings: ProviderTimings = new ProviderTimings(5000, 5000, 5000, 5000, 1000, 300, 500, 500, 200, 1, 20);
  public readonly stayOpenTimings: ProviderTimings = new ProviderTimings(5000, 5000, 5000, 5000, 1000, 300, 1, 500, 200, 1, 20);
  public readonly refusedInterruptTimings: ProviderTimings = new ProviderTimings(5000, 5000, 5000, 5000, 1000, 1, 500, 500, 200, 1, 20);
  public readonly clientInfo: AppServerClientInfo = new AppServerClientInfo("teamrun-tests", "TeamRun tests", "0.0.1");
  public readonly programs: ProgramRecorder = new ProgramRecorder();
  public readonly versionReader: StampedVersionReader = new StampedVersionReader();
  public readonly idleTimer: ManualTimer = new ManualTimer();

  public createAdapter(environment: NodeJS.ProcessEnv = this.environment, command: ProcessCommand | null = this.command,
    timings: ProviderTimings = this.timings, timer: ITimer = new NodeTimer(), log: ILog | null = null, platform?: string, sweep?: IOrphanSweep,
    serverProgram: CodexAppServerProgram | null = null): CodexAdapter {
    return new CodexAdapter(command, environment, this.clientInfo, this.programs.wrap(this.starter), timings, this.versionReader, timer, undefined, null, log, platform, sweep,
      this.idleTimer, serverProgram);
  }

  public installCodex(versionFile: string, version: string): void {
    writeFileSync(versionFile, version);
    this.versionReader.stamp = version;
  }

  public createClient(environment: NodeJS.ProcessEnv = this.environment, command: ProcessCommand = this.command.withArguments("app-server"),
    timings: ProviderTimings = this.timings): AppServerClient {
    return new AppServerClient(command, environment, this.clientInfo, this.programs.wrap(this.starter), timings);
  }

  public createProvider(id: string = "acc-1", directoryName: string = "profile"): Provider {
    return new Provider(id, "codex", "Work", this.directory.resolve(directoryName), AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");
  }

  public createRequest(prompt: string, provider: Provider | null = null, resume: string | null = null, model: string | null = null, effort: string | null = null,
    speed: string | null = null, mode: string | null = null, contextWindow: number | null = null): TurnRequest {
    return new TurnRequest(provider, this.directory.path, prompt, new RequestedSettings("codex", model, effort, speed, mode, false, contextWindow), resume);
  }

  public [Symbol.dispose](): void {
    this.directory[Symbol.dispose]();
  }
}
