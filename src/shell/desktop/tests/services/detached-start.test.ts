/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DetachedStart, DetachedStartReply, DetachedStartRequest } from "@noldova/teamrun-shell-desktop";
import { type IProcessStarter, LaunchException } from "@noldova/teamrun-shell-runtime";

import { FakeParentPort } from "../fixtures/fake-parent-port.fixture.js";

@TestClass
export class DetachedStartTests {
  @TestMethod
  public startsTheRequestedProgramAndRepliesWithItsProcess(): Promise<void> {
    return DetachedStartTests.runInFolderAsync(async folder => {
      const errorFile = path.join(folder, "start.log");
      const port = new FakeParentPort();
      const request = new DetachedStartRequest(process.execPath, ["-e", "console.error('started')"], errorFile, process.env);

      await DetachedStart.runAsync(request.toJson(), port);

      const processId = DetachedStartReply.fromJson(port.messages[0]).requireProcessId();
      Assert.isTrue(processId > 0);
      await DetachedStartTests.waitForAsync(async () => (await readFile(errorFile, "utf8")).includes("started"));
      Assert.areEqual(1, port.messages.length);
    });
  }

  @TestMethod
  public passesTheEnvironmentToTheStarter(): Promise<void> {
    const port = new FakeParentPort();
    const environments: NodeJS.ProcessEnv[] = [];
    const starter: IProcessStarter = { startAsync: (_executable, _arguments, environment) => Promise.resolve(environments.push(environment)) };

    return DetachedStart.runAsync(new DetachedStartRequest("node", [], "start.log", { ELECTRON_RUN_AS_NODE: "1", UNSET: undefined }).toJson(), port, starter).then(() => {
      Assert.areEqual("ELECTRON_RUN_AS_NODE", Object.keys(environments[0] ?? {}).join(","));
      Assert.areEqual("1", environments[0]?.["ELECTRON_RUN_AS_NODE"]);
      Assert.areEqual(1, DetachedStartReply.fromJson(port.messages[0]).processId);
    });
  }

  @TestMethod
  public async settlesOnlyOnceTheDesktopAcknowledgesTheReply(): Promise<void> {
    const port = new FakeParentPort(false);
    const starter: IProcessStarter = { startAsync: () => Promise.resolve(4120) };
    let isSettled = false;

    const answering = DetachedStart.runAsync(new DetachedStartRequest("node", [], "start.log", {}).toJson(), port, starter).then(() => {
      isSettled = true;
    });
    await DetachedStartTests.waitForAsync(() => Promise.resolve(port.messages.length === 1));
    await new Promise(resolve => setImmediate(resolve));

    Assert.isFalse(isSettled);
    Assert.areEqual(4120, DetachedStartReply.fromJson(port.messages[0]).processId);
    port.acknowledge();
    await answering;
    Assert.isTrue(isSettled);
  }

  @TestMethod
  public async repliesWithTheFailure(): Promise<void> {
    const port = new FakeParentPort();
    const starter: IProcessStarter = { startAsync: () => Promise.reject(new LaunchException("The runtime could not be started with node.")) };

    await DetachedStart.runAsync(new DetachedStartRequest("node", [], "start.log", {}).toJson(), port, starter);
    await DetachedStart.runAsync({ executable: "node" }, port, starter);

    Assert.areEqual("LaunchException: The runtime could not be started with node.", DetachedStartReply.fromJson(port.messages[0]).failure);
    Assert.isTrue(String(DetachedStartReply.fromJson(port.messages[1]).failure).startsWith("JsonException: "));
  }

  private static async waitForAsync(condition: () => Promise<boolean>): Promise<void> {
    const deadline = Date.now() + 5_000;
    while (!await condition()) {
      if (Date.now() >= deadline)
        throw new Error("The condition did not hold in time.");
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }

  private static async runInFolderAsync(test: (folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "tr-detached-"));
    try {
      await test(folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }
}
