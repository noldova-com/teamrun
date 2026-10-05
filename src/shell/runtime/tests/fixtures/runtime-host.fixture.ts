/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import "@noldova/teamrun-foundation-core";
import { type BuildIdentity, Handshake, type Response } from "@noldova/teamrun-shell-protocol";
import { DataDirectory, DiscoveryReader, Endpoint, type RuntimeDiscovery, RuntimeHost, RuntimeOptions, ServerSettings } from "@noldova/teamrun-shell-runtime";

import { RawConnectionFixture } from "./raw-connection.fixture.js";
import { SocketFolderFixture } from "./socket-folder.fixture.js";

export class RuntimeHostFixture implements AsyncDisposable {
  private readonly connections: RawConnectionFixture[] = [];
  private currentHost: RuntimeHost | null = null;

  public readonly root: string;
  public readonly dataDirectory: DataDirectory;

  private constructor(root: string) {
    this.root = root;
    this.dataDirectory = new DataDirectory(path.join(root, "data"));
  }

  public get host(): RuntimeHost {
    if (this.currentHost === null)
      throw new Error("The host has not started.");
    return this.currentHost;
  }

  public static async createAsync(): Promise<RuntimeHostFixture> {
    return new RuntimeHostFixture((await SocketFolderFixture.createAsync("tr-host-")).path);
  }

  public async startAsync(idleGraceMilliseconds: number = 30_000, declarationsFile?: string, takeoverMilliseconds?: number): Promise<RuntimeHost> {
    const options = new RuntimeOptions(this.dataDirectory, idleGraceMilliseconds, new ServerSettings(), declarationsFile, null, takeoverMilliseconds);
    this.currentHost = await RuntimeHost.startAsync(options, process.platform, process.env);
    return this.currentHost;
  }

  public async writeModulesAsync(modules: readonly (readonly [string, string | null])[]): Promise<string> {
    const folder = path.join(this.root, "build");
    await mkdir(folder, { recursive: true });
    const declarations = [];
    for (const [id, source] of modules) {
      const file = path.join(folder, `${id}.mjs`);
      if (source !== null)
        await writeFile(file, source);
      declarations.push({ id, version: "0.0.1", displayName: id, description: id, dependencies: [], runtimePackage: pathToFileURL(file).href, contributes: { methods: [`${id}.echo`], commands: [`${id}.tick`, `${id}.pause`], notifications: [`${id}.alarm`] } });
    }
    const declarationsFile = path.join(folder, "declarations.json");
    await writeFile(declarationsFile, JSON.stringify({ formatVersion: 1, modules: declarations }));
    return declarationsFile;
  }

  public async readDiscoveryAsync(): Promise<RuntimeDiscovery> {
    const discovery = await DiscoveryReader.readAsync(this.dataDirectory);
    if (discovery === null)
      throw new Error("The host has published no discovery metadata.");
    return discovery;
  }

  public async handshakeAsync(client: string, identity: BuildIdentity): Promise<[RawConnectionFixture, Response]> {
    const discovery = await this.readDiscoveryAsync();
    const connection = await RawConnectionFixture.connectAsync(Endpoint.parse(discovery.endpoint));
    this.connections.push(connection);
    connection.sendMessages(new Handshake(`${client}:0`, identity, discovery.token, client));
    return [connection, await connection.readResponseAsync()];
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    for (const connection of this.connections)
      connection[Symbol.dispose]();
    if (this.currentHost !== null) {
      this.currentHost.requestStop("test");
      await this.currentHost.waitForStopAsync().catch(() => undefined);
    }
    await rm(this.root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }
}
