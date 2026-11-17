/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { fileURLToPath } from "node:url";

import { type ILog, TurnRequest } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { AuthStatus, Provider, RequestedSettings } from "@noldova/teamrun.protocol";
import { ClaudeAdapter, CommandRunner, ExecutableVersionReader, ProcessCommand, ProcessTerminator, ProviderTimings } from "@noldova/teamrun.providers";

import { FakeClaudeQueryFactory } from "./fake-claude-query-factory.fixture.js";
import { IsolatedPath } from "./isolated-path.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";
import { WatchingProcessStarter } from "./watching-process-starter.fixture.js";

export class ClaudeTestHost implements Disposable {
  public static readonly FAKE_CLAUDE_PATH: string = fileURLToPath(new URL("./fake-claude.fixture.js", import.meta.url));

  public readonly directory: TemporaryDirectory = new TemporaryDirectory();
  public readonly environment: NodeJS.ProcessEnv = IsolatedPath.environment(this.directory.path);
  public readonly command: ProcessCommand = new ProcessCommand(process.execPath, [ClaudeTestHost.FAKE_CLAUDE_PATH]);
  public readonly terminator: ProcessTerminator = new ProcessTerminator(process.platform);
  public readonly starter: WatchingProcessStarter = new WatchingProcessStarter(() => undefined);
  public readonly runner: CommandRunner = new CommandRunner(this.starter);
  public readonly timings: ProviderTimings = new ProviderTimings(5000, 5000, 5000, 5000, 1000, 300, 500, 500, 200, 1, 20, 50, 40);
  public readonly versionReader: ExecutableVersionReader = new ExecutableVersionReader(this.runner, this.timings.versionTimeout);
  public readonly factory: FakeClaudeQueryFactory = new FakeClaudeQueryFactory();
  public readonly timer: ManualTimer = new ManualTimer();
  public readonly idleTimer: ManualTimer = new ManualTimer();

  public createAdapter(environment: NodeJS.ProcessEnv = this.environment, command: ProcessCommand | null = this.command, timings: ProviderTimings = this.timings,
    homeDirectory?: string, log: ILog | null = null): ClaudeAdapter {
    return new ClaudeAdapter(command, environment, "0.0.1-test", this.factory, this.runner, this.versionReader, timings, this.timer, undefined, undefined, homeDirectory,
      log, this.idleTimer);
  }

  public createProvider(id: string = "acc-1", directoryName: string = "profile"): Provider {
    return new Provider(id, "claude", "Home", this.directory.resolve(directoryName), AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");
  }

  public createRequest(prompt: string, provider: Provider | null = null, resume: string | null = null, model: string | null = null, effort: string | null = null,
    speed: string | null = null, mode: string | null = null, contextWindow: number | null = null): TurnRequest {
    return new TurnRequest(provider, this.directory.path, prompt, new RequestedSettings("claude", model, effort, speed, mode, false, contextWindow), resume);
  }

  public [Symbol.dispose](): void {
    this.directory[Symbol.dispose]();
  }
}
