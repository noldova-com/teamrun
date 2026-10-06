/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm } from "node:fs/promises";
import path from "node:path";

import { Wait } from "@noldova/teamrun-foundation-testing";
import { ClientSettings, DataDirectory, DiscoveryReader, LaunchSettings, OwnershipLock, RuntimeEntry } from "@noldova/teamrun-shell-runtime";

import { RecordingStarterFixture } from "./recording-starter.fixture.js";
import { SocketFolderFixture } from "./socket-folder.fixture.js";

export class RuntimeLaunchFixture implements AsyncDisposable {
  private static readonly EXIT_TIMEOUT: number = 5_000;
  private static readonly POLL_INTERVAL: number = 25;

  private readonly root: string;

  public readonly dataDirectory: DataDirectory;
  public readonly starter: RecordingStarterFixture = new RecordingStarterFixture();

  private constructor(root: string) {
    this.root = root;
    this.dataDirectory = new DataDirectory(path.join(root, "data"));
  }

  public static async createAsync(): Promise<RuntimeLaunchFixture> {
    return new RuntimeLaunchFixture((await SocketFolderFixture.createAsync("tr-launch-")).path);
  }

  public static isRunning(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }

  public static waitForExitAsync(processId: number): Promise<boolean> {
    return Wait.untilAsync(() => !RuntimeLaunchFixture.isRunning(processId), RuntimeLaunchFixture.EXIT_TIMEOUT);
  }

  public createSettings(idleGraceMilliseconds: number = 30_000, entryPath: string = RuntimeEntry.entryPath): LaunchSettings {
    return new LaunchSettings(
      this.dataDirectory,
      process.execPath,
      entryPath,
      { ...process.env },
      process.platform,
      idleGraceMilliseconds,
      10_000,
      RuntimeLaunchFixture.POLL_INTERVAL,
      new ClientSettings(2_000, 5_000, 1_000));
  }

  public async readProcessIdAsync(): Promise<number> {
    const discovery = await DiscoveryReader.readAsync(this.dataDirectory);
    if (discovery === null)
      throw new Error("No runtime has published discovery metadata.");
    return discovery.processId;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    const running = await this.starter.stopAsync(RuntimeLaunchFixture.EXIT_TIMEOUT);
    if (running.length > 0)
      throw new Error(`The runtime processes ${running.join(", ")} were still running ${RuntimeLaunchFixture.EXIT_TIMEOUT} ms after they were killed, so ${this.root} was kept.`);
    if (OwnershipLock.isOwned(this.dataDirectory))
      throw new Error(`A process the fixture did not start owns ${this.dataDirectory.root}, so ${this.root} was kept.`);
    await rm(this.root, { recursive: true, force: true, maxRetries: 20, retryDelay: RuntimeLaunchFixture.POLL_INTERVAL });
  }
}
