/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type ILog, type ITimer, TurnRequest } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { RequestedSettings } from "@noldova/teamrun.protocol";
import { AcpAdapter, AppServerClientInfo, GrokAdapter, type IAcpAgent, type IProcessStarter, type IProcessTree, NodeProcessStarter, ProcessCommand, ProcessTerminator, ProviderTimings } from "@noldova/teamrun.providers";

import { ElapsedDelayTimer } from "./elapsed-delay-timer.fixture.js";
import { HeldDelayTimer } from "./held-delay-timer.fixture.js";
import { ProgramRecorder } from "./program-recorder.fixture.js";
import { IsolatedPath } from "./isolated-path.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class GrokTestHost implements AsyncDisposable {
  public readonly directory = new TemporaryDirectory();
  public readonly environment: NodeJS.ProcessEnv = { ...IsolatedPath.environment(this.directory.path), HOME: this.directory.resolve("person"),
    USERPROFILE: this.directory.resolve("person"), GROK_HOME: this.directory.resolve("person", ".grok"), GEMINI_HOME: this.directory.resolve("person", ".gemini") };
  public readonly command = new ProcessCommand(process.execPath, [fileURLToPath(new URL("./fake-acp-agent.fixture.js", import.meta.url))]);
  public readonly programs = new ProgramRecorder();
  public readonly terminator = new ProcessTerminator(process.platform);
  public readonly starter = new NodeProcessStarter(this.terminator);
  public readonly timings = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 100, 100, 4000, 100, 1, 10);
  public readonly stayOpenTimings = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 1, 1, 4000, 100, 1, 10);
  public readonly ignoredCancelTimings = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 1, 100, 4000, 100, 1, 10);
  public readonly closingTimings = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 100, 10_000, 4000, 100, 1, 10);
  public readonly heldGraceTimings = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 40_000, 50_000, 4000, 100, 1, 10);
  public readonly hangingSignInTimings = new ProviderTimings(2000, 500, 10_000, 2000, 100, 100, 100, 4000, 100, 1, 10);
  public readonly stoppingTimings = new ProviderTimings(2000, 2000, 10_000, 2000, 10_000, 100, 100, 4000, 100, 1, 10);
  public readonly timer = new HeldDelayTimer(this.timings.killWait);
  public readonly idleTimer: ManualTimer = new ManualTimer();
  public readonly elapsedIdleTimer: ElapsedDelayTimer = new ElapsedDelayTimer(this.timings.idleLimit);
  public readonly info = new AppServerClientInfo("teamrun-tests", "TeamRun tests", "test");
  private readonly adapters: AcpAdapter[] = [];

  public constructor() {
    mkdirSync(this.directory.resolve("person"));
  }

  public createAdapter(environment: NodeJS.ProcessEnv = this.environment, command: ProcessCommand | null = this.command, terminator: ProcessTerminator = this.terminator,
    timings: ProviderTimings = this.timings, starter: IProcessStarter = new NodeProcessStarter(terminator), processTree?: IProcessTree, timer: ITimer = this.timer,
    log: ILog | null = null, idleTimer: ITimer = this.elapsedIdleTimer): GrokAdapter {
    const adapter = new GrokAdapter(command, environment, this.directory.resolve("profile"), this.info, this.programs.wrap(starter), timings, timer, processTree, undefined, log, null,
      idleTimer);
    this.adapters.push(adapter);
    return adapter;
  }

  public createAcpAdapter(agent: IAcpAgent, starter: IProcessStarter = this.starter, timings: ProviderTimings = this.timings, log: ILog | null = null,
    timer: ITimer = this.timer, idleTimer: ITimer = this.elapsedIdleTimer): AcpAdapter {
    const adapter = new AcpAdapter(agent, this.info, this.programs.wrap(starter), timings, timer, null, log, undefined, idleTimer);
    this.adapters.push(adapter);
    return adapter;
  }

  public request(prompt: string, resume: string | null = null, model: string | null = null, effort: string | null = null,
    freshPrompt: string | null = null, mode: string | null = null): TurnRequest {
    return new TurnRequest(null, this.directory.path, prompt, new RequestedSettings("grok", model, effort, null, mode), resume, [], null, freshPrompt);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await Promise.all(this.adapters.map(t => t.shutdown()));
    this.directory[Symbol.dispose]();
  }
}
