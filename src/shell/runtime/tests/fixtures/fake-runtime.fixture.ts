/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { BuildIdentity } from "@noldova/teamrun-shell-protocol";
import {
  ClientSettings,
  DataDirectory,
  DiscoveryPublisher,
  LaunchSettings,
  OwnershipLock,
  RuntimeDiscovery,
  RuntimeEntry
} from "@noldova/teamrun-shell-runtime";

import { FolderProtectorFixture } from "./folder-protector.fixture.js";
import { RuntimeServerFixture } from "./runtime-server.fixture.js";

export class FakeRuntimeFixture implements AsyncDisposable {
  public static readonly NEWER: BuildIdentity = new BuildIdentity("2.0.0", BuildIdentity.supportedProtocolVersion, "newer-build");

  private readonly root: string;
  private readonly lock: OwnershipLock;

  public readonly server: RuntimeServerFixture;
  public readonly dataDirectory: DataDirectory;

  private constructor(root: string, dataDirectory: DataDirectory, lock: OwnershipLock, server: RuntimeServerFixture) {
    this.root = root;
    this.dataDirectory = dataDirectory;
    this.lock = lock;
    this.server = server;
  }

  public static async startAsync(token: string = RuntimeServerFixture.TOKEN, endpoint?: string): Promise<FakeRuntimeFixture> {
    const root = await mkdtemp(path.join(tmpdir(), "tr-fake-"));
    const dataDirectory = new DataDirectory(path.join(root, "data"));
    const lock = OwnershipLock.acquire(dataDirectory);
    const server = await RuntimeServerFixture.startAsync();
    const identity = RuntimeServerFixture.IDENTITY;
    const discovery = new RuntimeDiscovery(
      endpoint ?? String(server.endpoint),
      token,
      process.pid,
      process.execPath,
      identity.productVersion,
      identity.protocolVersion,
      identity.fingerprint);
    await new DiscoveryPublisher(lock, new FolderProtectorFixture()).publishAsync(discovery);
    return new FakeRuntimeFixture(root, dataDirectory, lock, server);
  }

  public createSettings(launchTimeout: number = 5_000): LaunchSettings {
    return new LaunchSettings(
      this.dataDirectory,
      process.execPath,
      RuntimeEntry.entryPath,
      {},
      process.platform,
      30_000,
      launchTimeout,
      25,
      new ClientSettings(1_000, 2_000, 500));
  }

  public release(): void {
    this.lock.release();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.server[Symbol.asyncDispose]();
    this.lock.release();
    await rm(this.root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }
}
