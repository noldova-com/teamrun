/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TurnRequest } from "@noldova/teamrun.core";
import { AuthStatus, type MessageAttachment, Provider, RequestedSettings } from "@noldova/teamrun.protocol";
import { AppServerClientInfo, NodeProcessStarter, CursorAdapter, type IProcessStarter, ProcessCommand, ProcessTerminator, ProviderTimings }
  from "@noldova/teamrun.providers";

import { HeldDelayTimer } from "./held-delay-timer.fixture.js";
import { IsolatedPath } from "./isolated-path.fixture.js";
import { ProgramRecorder } from "./program-recorder.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class CursorTestHost implements AsyncDisposable {
  public readonly directory = new TemporaryDirectory();
  public readonly environment: NodeJS.ProcessEnv = { ...IsolatedPath.environment(this.directory.path), TEAMRUN_FAKE_ACP_AGENT: "cursor",
    CURSOR_CONFIG_DIR: this.directory.resolve("person-cursor") };
  public readonly command = new ProcessCommand(process.execPath, [fileURLToPath(new URL("./fake-acp-agent.fixture.js", import.meta.url))]);
  public readonly programs = new ProgramRecorder();
  public readonly terminator = new ProcessTerminator(process.platform);
  public readonly timings = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 100, 100, 4000, 100, 1, 10);
  public readonly timer = new HeldDelayTimer(this.timings.killWait);
  public readonly info = new AppServerClientInfo("teamrun-tests", "TeamRun tests", "test");
  public readonly provider = new Provider("c", "cursor", "Work", this.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null, "t");
  private readonly adapters: CursorAdapter[] = [];

  public createAdapter(environment: NodeJS.ProcessEnv = {}, command: ProcessCommand | null = this.command,
    starter: IProcessStarter = new NodeProcessStarter(this.terminator), platform: string = process.platform): CursorAdapter {
    mkdirSync(this.directory.resolve("chat"), { recursive: true });
    const adapter = new CursorAdapter(command, { ...this.environment, ...environment }, this.directory.resolve("default-profile"), this.info,
      this.programs.wrap(starter), this.timings, this.timer, undefined, undefined, null, platform);
    this.adapters.push(adapter);
    return adapter;
  }

  public request(prompt: string, mode: string | null = null, resume: string | null = null, attachments: readonly MessageAttachment[] = [],
    model: string | null = null, effort: string | null = null): TurnRequest {
    return new TurnRequest(this.provider, this.directory.resolve("chat"), prompt, new RequestedSettings("cursor", model, effort, null, mode), resume, attachments);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await Promise.all(this.adapters.map(t => t.shutdown()));
    this.directory[Symbol.dispose]();
  }
}
