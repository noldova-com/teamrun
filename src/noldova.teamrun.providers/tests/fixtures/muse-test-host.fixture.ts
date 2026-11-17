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
import { AppServerClientInfo, CommandSource, MuseAdapter, NodeProcessStarter, ProcessCommand, ProcessTerminator, ProviderTimings } from "@noldova/teamrun.providers";

import { HeldDelayTimer } from "./held-delay-timer.fixture.js";
import { IsolatedPath } from "./isolated-path.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

const OPTIONS = [
  { type: "select", id: "model", name: "Model", category: "model", currentValue: "muse-1", options: [{ value: "muse-1", name: "Muse 1" }, { value: "muse-2", name: "Muse 2" }] },
  { type: "select", id: "effort", name: "Reasoning effort", category: "thought_level", currentValue: "high", options: [{ value: "high", name: "High" }, { value: "low", name: "Low" }] },
  { type: "select", id: "mode", name: "Mode", category: "mode", currentValue: "on-request", options: [{ value: "on-request", name: "Ask on request" }, { value: "allow-all", name: "Allow all" }] }
];

export class MuseTestHost implements AsyncDisposable {
  public readonly directory = new TemporaryDirectory();
  public readonly environment: NodeJS.ProcessEnv = { ...IsolatedPath.environment(this.directory.path), TEAMRUN_FAKE_ACP_AGENT: "opencode", TEAMRUN_FAKE_ACP_OPTIONS: JSON.stringify(OPTIONS) };
  public readonly command = new ProcessCommand(process.execPath, [fileURLToPath(new URL("./fake-acp-agent.fixture.js", import.meta.url))]);
  public readonly terminator = new ProcessTerminator(process.platform);
  public readonly timings = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 100, 100, 5000, 100, 1, 10);
  public readonly timer = new HeldDelayTimer(this.timings.killWait);
  public readonly info = new AppServerClientInfo("teamrun-tests", "TeamRun tests", "test");
  public readonly provider = new Provider("m", "muse", "Work", this.directory.resolve("config"), AuthStatus.Unknown, null, null, null, null, "t");
  private readonly adapters: MuseAdapter[] = [];

  public createAdapter(environment: NodeJS.ProcessEnv = {}, command: ProcessCommand | null = this.command,
    locate: () => ProcessCommand | null = CommandSource.none): MuseAdapter {
    mkdirSync(this.directory.resolve("chat"), { recursive: true });
    const adapter = new MuseAdapter(command, { ...this.environment, ...environment }, this.directory.path, this.info, new NodeProcessStarter(this.terminator), this.timings,
      locate, this.timer);
    this.adapters.push(adapter);
    return adapter;
  }

  public request(prompt: string, resume: string | null = null, attachments: readonly MessageAttachment[] = [], mode: string | null = null,
    model: string | null = null, effort: string | null = null, compacts: boolean = false): TurnRequest {
    return new TurnRequest(this.provider, this.directory.resolve("chat"), prompt, new RequestedSettings("muse", model, effort, null, mode), resume, attachments, null, null, {}, compacts);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await Promise.all(this.adapters.map(t => t.shutdown()));
    this.directory[Symbol.dispose]();
  }
}
