/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { TurnRequest } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { AuthStatus, type MessageAttachment, Provider, RequestedSettings } from "@noldova/teamrun.protocol";
import { CommandRunner, NodeProcessStarter, PiAdapter, PiRpcClient, ProcessCommand, ProcessTerminator, ProviderTimings }
  from "@noldova/teamrun.providers";

import { ProgramRecorder } from "./program-recorder.fixture.js";
import { StampedVersionReader } from "./stamped-version-reader.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class PiTestHost implements Disposable, AsyncDisposable {
  public static readonly FAKE_PI_PATH: string = fileURLToPath(new URL("./fake-pi.fixture.js", import.meta.url));

  public readonly directory: TemporaryDirectory = new TemporaryDirectory();
  public readonly log: string = this.directory.resolve("pi.log");
  public readonly command: ProcessCommand = new ProcessCommand(process.execPath, [PiTestHost.FAKE_PI_PATH]);
  public readonly starter: NodeProcessStarter = new NodeProcessStarter(new ProcessTerminator(process.platform));
  public readonly programs: ProgramRecorder = new ProgramRecorder();
  public readonly timings: ProviderTimings = new ProviderTimings(5000, 5000, 5000, 5000, 1000, 300, 500, 500, 200, 1, 20);
  public readonly versionReader: StampedVersionReader = new StampedVersionReader();
  public readonly environment: NodeJS.ProcessEnv;
  public readonly idleTimer: ManualTimer = new ManualTimer();
  private readonly adapters: PiAdapter[] = [];

  public constructor(scenario: Readonly<Record<string, string>> = {}) {
    this.environment = { ...process.env, TEAMRUN_FAKE_PI_LOG: this.log, TEAMRUN_FAKE_PI_SESSIONS: this.directory.path, ...scenario };
  }

  public get records(): readonly Record<string, unknown>[] {
    return existsSync(this.log) ? readFileSync(this.log, "utf8").split("\n").filter(t => t.length > 0).map(t => JSON.parse(t) as Record<string, unknown>) : [];
  }

  public commands(type: string): readonly Record<string, unknown>[] {
    return this.records.filter(t => t["type"] === type);
  }

  public createAdapter(command: ProcessCommand | null = this.command, timings: ProviderTimings = this.timings,
    locate?: () => ProcessCommand | null, promptTimeout?: number, starter: NodeProcessStarter = this.starter): PiAdapter {
    const runner = new CommandRunner(this.programs.wrap(starter));
    const adapter = new PiAdapter(command, this.environment, this.directory.resolve("extension"), this.programs.wrap(starter), runner, timings,
      this.versionReader, locate, promptTimeout, this.idleTimer);
    this.adapters.push(adapter);
    return adapter;
  }

  public createClient(args: readonly string[] = ["--mode", "rpc"], stopGrace: number = 500): PiRpcClient {
    return new PiRpcClient(this.command.withArguments(...args), this.environment, this.directory.path, this.programs.wrap(this.starter), stopGrace);
  }

  public createProvider(settings: Readonly<Record<string, unknown>> | null = { defaultProvider: "anthropic" }, directoryName: string = "profile"): Provider {
    const folder = this.directory.resolve(directoryName);
    mkdirSync(folder, { recursive: true });
    if (settings !== null)
      writeFileSync(this.directory.resolve(directoryName, "settings.json"), JSON.stringify(settings));
    return new Provider("pi-1", "pi", "Work", folder, AuthStatus.Unknown, null, null, null, null, "2026-11-01T00:00:00.000Z");
  }

  public createRequest(prompt: string, provider: Provider | null = null, resume: string | null = null, model: string | null = null, effort: string | null = null,
    mode: string | null = null, attachments: readonly MessageAttachment[] = [], compacts: boolean = false, instructions: string | null = null): TurnRequest {
    return new TurnRequest(provider, this.directory.path, prompt, new RequestedSettings("pi", model, effort, null, mode), resume, attachments, instructions, null,
      { TEAMRUN_FAKE_PI_EXTRA: "from the request" }, compacts);
  }

  public [Symbol.dispose](): void {
    this.directory[Symbol.dispose]();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await Promise.all(this.adapters.map(t => t.shutdown()));
    this.directory[Symbol.dispose]();
  }
}
