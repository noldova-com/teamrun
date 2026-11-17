/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { fileURLToPath } from "node:url";
import { type ILog, type ITimer, TurnRequest } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { AuthStatus, Provider, RequestedSettings } from "@noldova/teamrun.protocol";
import { AppServerClientInfo, CopilotAdapter, NodeProcessStarter, ProcessCommand, ProcessTerminator, ProviderTimings, Resources } from "@noldova/teamrun.providers";

import { ElapsedDelayTimer } from "./elapsed-delay-timer.fixture.js";
import { HeldDelayTimer } from "./held-delay-timer.fixture.js";
import { IsolatedPath } from "./isolated-path.fixture.js";
import { ProgramRecorder } from "./program-recorder.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class CopilotTestHost implements AsyncDisposable {
  public readonly directory = new TemporaryDirectory();
  public readonly environment: NodeJS.ProcessEnv = { ...IsolatedPath.environment(this.directory.path), TEAMRUN_FAKE_ACP_AGENT: "copilot" };
  public readonly command = new ProcessCommand(process.execPath, [fileURLToPath(new URL("./fake-acp-agent.fixture.js", import.meta.url))]);
  public readonly programs = new ProgramRecorder();
  public readonly terminator = new ProcessTerminator(process.platform);
  public readonly timings = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 100, 100, 5000, 100, 1, 10);
  public readonly timer = new HeldDelayTimer(this.timings.killWait);
  public readonly patientTimings = new ProviderTimings(2000, 2000, 60_000, 60_000, 100, 100, 100, 5000, 100, 1, 10);
  public readonly patientTimer = new HeldDelayTimer(this.patientTimings.killWait, Resources.modelCheckWait);
  public readonly info = new AppServerClientInfo("teamrun-tests", "TeamRun tests", "test");
  public readonly provider = new Provider("a", "copilot", "Work", this.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null, "t");
  public readonly elapsedIdleTimer: ElapsedDelayTimer = new ElapsedDelayTimer(this.timings.idleLimit);
  private readonly adapters: CopilotAdapter[] = [];

  public createAdapter(environment: NodeJS.ProcessEnv = {}, command: ProcessCommand | null = this.command, log: ILog | null = null,
    timings: ProviderTimings = this.timings, terminator: ProcessTerminator = this.terminator, timer: ITimer = this.timer): CopilotAdapter {
    const adapter = new CopilotAdapter(command, { ...this.environment, ...environment }, this.directory.resolve("work"), this.info,
      this.programs.wrap(new NodeProcessStarter(terminator)), timings, timer, log, undefined, null, this.elapsedIdleTimer);
    this.adapters.push(adapter);
    return adapter;
  }

  public createPatientAdapter(environment: NodeJS.ProcessEnv, timer: ITimer = this.patientTimer): CopilotAdapter {
    return this.createAdapter(environment, this.command, null, this.patientTimings, this.terminator, timer);
  }

  public createManualAdapter(environment: NodeJS.ProcessEnv, log: ILog, timings: ProviderTimings = this.timings): CopilotAdapter {
    return this.createAdapter(environment, this.command, log, timings, this.terminator, new ManualTimer());
  }

  public request(prompt: string, resume: string | null = null, model: string | null = null, effort: string | null = null,
    provider: Provider | null = null, freshPrompt: string | null = null, mode: string | null = null): TurnRequest {
    return new TurnRequest(provider, this.directory.path, prompt, new RequestedSettings("copilot", model, effort, null, mode), resume, [], null, freshPrompt);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await Promise.all(this.adapters.map(t => t.shutdown()));
    this.directory[Symbol.dispose]();
  }
}
