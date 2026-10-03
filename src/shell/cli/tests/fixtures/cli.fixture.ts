/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "node:events";
import path from "node:path";
import { PassThrough } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";
import { Cli, CliContext } from "@noldova/teamrun-shell-cli";
import type { BuildIdentity } from "@noldova/teamrun-shell-protocol";
import { DataDirectory, DiscoveryReader, type IProcessStarter, OwnershipLock, RuntimeBuild, RuntimeEntry, RuntimeHost, RuntimeOptions, ServerSettings } from "@noldova/teamrun-shell-runtime";

import { FakeDesktopOpenerFixture } from "./fake-desktop-opener.fixture.js";
import type { ProbeBuildFixture } from "./probe-build.fixture.js";
import { SocketFolderFixture } from "./socket-folder.fixture.js";

export class CliFixture implements AsyncDisposable {
  public static readonly CHECKOUT_VARIABLE: string = "TEAMRUN_CHECKOUT";
  public static readonly DATA_DIRECTORY_VARIABLE: string = "TEAMRUN_DATA_DIR";
  private static readonly STOP_LIMIT: number = 15_000;
  private static readonly POLL_INTERVAL: number = 25;

  private readonly folder: SocketFolderFixture;
  private readonly hosts: RuntimeHost[] = [];

  public readonly root: string;
  public readonly dataDirectory: string;
  public readonly homeFolder: string;
  public readonly opener: FakeDesktopOpenerFixture = new FakeDesktopOpenerFixture();
  public readonly signals: EventEmitter = new EventEmitter();

  private constructor(folder: SocketFolderFixture) {
    this.folder = folder;
    this.root = folder.path;
    this.dataDirectory = path.join(folder.path, "data");
    this.homeFolder = path.join(folder.path, "home");
  }

  public static async createAsync(): Promise<CliFixture> {
    return new CliFixture(await SocketFolderFixture.createAsync("tr-cli-"));
  }

  public get environment(): NodeJS.ProcessEnv {
    const environment = { ...process.env };
    delete environment[CliFixture.CHECKOUT_VARIABLE];
    delete environment[CliFixture.DATA_DIRECTORY_VARIABLE];
    return environment;
  }

  public async runAsync(
    commandLineArguments: readonly string[],
    build: ProbeBuildFixture | null = null,
    environment: NodeJS.ProcessEnv = this.environment,
    input: string = "",
    starter?: IProcessStarter): Promise<{ code: number; output: string; error: string }> {
    const output = new PassThrough({ encoding: "utf8" });
    const error = new PassThrough({ encoding: "utf8" });
    const inputStream = new PassThrough({ encoding: "utf8" });
    inputStream.end(input);
    const identity: BuildIdentity = build?.identity ?? RuntimeBuild.identity;
    const context = new CliContext(environment, process.platform, this.homeFolder, process.execPath, build?.entryPath ?? RuntimeEntry.entryPath, identity,
      output, error, inputStream, this.signals, starter, this.opener);
    const code = await new Cli(context).runAsync(commandLineArguments);
    return { code, output: String(output.read() ?? ""), error: String(error.read() ?? "") };
  }

  public withDataDirectory(commandLineArguments: readonly string[]): string[] {
    return [...commandLineArguments, "--data-dir", this.dataDirectory];
  }

  public async startHostAsync(declarationsFile: string): Promise<RuntimeHost> {
    const options = new RuntimeOptions(new DataDirectory(this.dataDirectory), 30_000, new ServerSettings(), declarationsFile);
    const host = await RuntimeHost.startAsync(options, process.platform, process.env);
    this.hosts.push(host);
    return host;
  }

  public async readRuntimeProcessIdAsync(): Promise<number | null> {
    return (await DiscoveryReader.readAsync(new DataDirectory(this.dataDirectory)))?.processId ?? null;
  }

  public async stopRuntimeAsync(): Promise<void> {
    const processId = await this.readRuntimeProcessIdAsync();
    if (processId === null || processId === process.pid)
      return;
    try {
      process.kill(processId);
    }
    catch {
      return;
    }
    const deadline = Date.now() + CliFixture.STOP_LIMIT;
    while (OwnershipLock.isOwned(new DataDirectory(this.dataDirectory)) && Date.now() < deadline)
      await delay(CliFixture.POLL_INTERVAL);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    for (const host of this.hosts) {
      host.requestStop("test");
      await host.waitForStopAsync().catch(() => undefined);
    }
    await this.stopRuntimeAsync();
    await this.folder[Symbol.asyncDispose]();
  }
}
