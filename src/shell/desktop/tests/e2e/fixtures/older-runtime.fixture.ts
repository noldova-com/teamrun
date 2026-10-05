/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { DataDirectory, DiscoveryReader, ProductInfo, RuntimeBuild, RuntimeEntry } from "@noldova/teamrun-shell-runtime";

export default class OlderRuntimeFixture {
  private static readonly VERSION: string = "0.0.0";
  private static readonly START_TIMEOUT: number = 20_000;
  private static readonly DECLARATIONS: readonly string[] = ["_build", "modules", "declarations.json"];
  private static readonly PRODUCT: readonly string[] = ["_build", "product.json"];

  private readonly folder: string;
  private readonly child: ChildProcess;

  public readonly processId: number;

  private constructor(folder: string, child: ChildProcess, processId: number) {
    this.folder = folder;
    this.child = child;
    this.processId = processId;
  }

  public static async startAsync(dataDirectory: string): Promise<OlderRuntimeFixture> {
    const installed = path.resolve(path.dirname(RuntimeEntry.entryPath), "..");
    const folder = path.resolve("_build", "runtime-builds", `${OlderRuntimeFixture.VERSION}-${process.pid}-${Date.now()}`);
    const copy = path.join(folder, "node_modules", "@noldova", "teamrun-shell-runtime");
    await cp(installed, copy, { recursive: true });
    await cp(path.resolve(...OlderRuntimeFixture.DECLARATIONS), path.join(folder, ...OlderRuntimeFixture.DECLARATIONS));
    const product = { ...JSON.parse(await readFile(ProductInfo.file, "utf8")), version: OlderRuntimeFixture.VERSION, build: `${RuntimeBuild.identity.fingerprint}-${OlderRuntimeFixture.VERSION}` };
    await writeFile(path.join(folder, ...OlderRuntimeFixture.PRODUCT), JSON.stringify(product));
    const child = spawn(process.execPath, [path.join(copy, "services", "runtime-entry.js"), "--data-dir", dataDirectory], { stdio: "ignore", windowsHide: true });
    const processId = child.pid ?? -1;
    await expect.poll(async () => (await DiscoveryReader.readAsync(new DataDirectory(dataDirectory)))?.productVersion, { timeout: OlderRuntimeFixture.START_TIMEOUT })
      .toBe(OlderRuntimeFixture.VERSION);
    return new OlderRuntimeFixture(folder, child, processId);
  }

  public get hasExited(): boolean {
    return this.child.exitCode !== null || this.child.signalCode !== null;
  }

  public async disposeAsync(): Promise<void> {
    if (!this.hasExited)
      this.child.kill();
    await rm(this.folder, { recursive: true, force: true, maxRetries: 10 });
  }
}
