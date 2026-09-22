/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { InstallationRegistry, InstallationRole, type InstallationMember } from "@noldova/teamrun-runtime";
import { type IRestartProcesses, RestartProcesses, UpdatePeer } from "@noldova/teamrun-desktop";

import { CheckpointBridgeHost } from "./checkpoint-bridge-host.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class RestartFixture implements IRestartProcesses, AsyncDisposable {
  private readonly children: ChildProcess[] = [];
  private readonly peers: UpdatePeer[] = [];
  private readonly peerClosures: Promise<void>[] = [];
  private readonly nativeProcesses = new RestartProcesses(process.execPath, process.env);

  public readonly directory = new TemporaryDirectory();
  public readonly registry = new InstallationRegistry(this.directory.resolve("installations", "a".repeat(64), "instances.db"));
  public readonly reopened: string[] = [];
  public readonly waited: number[] = [];
  public readonly bridges: CheckpointBridgeHost[] = [];

  public async addDesktop(name: string): Promise<UpdatePeer> {
    const host = new CheckpointBridgeHost();
    this.bridges.push(host);
    const peer = new UpdatePeer(this.registry, this.directory.resolve(name), "1.0.0", host.checkpoint, () => {
      this.peerClosures.push(peer.dispose());
    }, 10);
    this.peers.push(peer);
    await peer.start();
    return peer;
  }

  public async addRuntime(name: string): Promise<InstallationMember> {
    const directory = this.directory.resolve(name);
    const child = spawn(process.execPath, [fileURLToPath(new URL("./update-runtime-child.fixture.js", import.meta.url)), directory, this.registry.path],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    this.children.push(child);
    let errors = "";
    child.stderr?.on("data", chunk => { errors += String(chunk); });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error(`Fixture runtime timed out: ${errors}`)); }, 20_000);
      child.once("error", error => { clearTimeout(timer); reject(error); });
      child.once("exit", code => { clearTimeout(timer); reject(new Error(`Fixture runtime exited ${code}: ${errors}`)); });
      child.stdout?.on("data", chunk => {
        if (String(chunk).includes("ready")) { clearTimeout(timer); resolve(); }
      });
    });
    const member = this.registry.members().find(t => t.role === InstallationRole.Runtime && t.dataDirectory === realpathSync.native(directory));
    if (!member) throw new Error("Runtime registration missing");
    return member;
  }

  public async waitForExit(processId: number): Promise<void> {
    this.waited.push(processId);
    if (processId === process.pid)
      await Promise.all(this.peerClosures);
    else
      await this.nativeProcesses.waitForExit(processId);
  }

  public reopen(directory: string): Promise<void> {
    this.reopened.push(directory);
    return Promise.resolve();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    for (const peer of this.peers)
      await peer.dispose();
    for (const child of this.children) {
      child.stdin?.end();
      if (child.pid) await this.nativeProcesses.waitForExit(child.pid);
    }
    this.directory[Symbol.dispose]();
  }
}
