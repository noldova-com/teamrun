/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { LaunchException, LaunchSettings, RuntimeBuild, RuntimeEntry, RuntimeLauncher } from "@noldova/teamrun-shell-runtime";

import { ClientListenerFixture } from "../fixtures/client-listener.fixture.js";
import { RuntimeLaunchFixture } from "../fixtures/runtime-launch.fixture.js";
import { ScriptedStarterFixture } from "../fixtures/scripted-starter.fixture.js";

@TestClass
export class StartedRuntimeTests {
  @TestMethod
  public async reportsARuntimeThatExitsWhileStarting(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    const token = "9f".repeat(32);
    const starter = new ScriptedStarterFixture(
      `console.error("Cannot open " + ${JSON.stringify(path.join(homedir(), "data"))} + " with token ${token}"); process.exit(1);`);
    const started = Date.now();

    const exception = await Assert.throwsAsync(
      () => new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity, starter).attachAsync("desktop", new ClientListenerFixture()),
      LaunchException);

    Assert.isTrue(Date.now() - started < 3_000, "the launcher stops waiting well before its time limit");
    Assert.areEqual(`The runtime exited while starting: Cannot open ${path.join("~", "data")} with token [redacted]`, exception.message);
    Assert.isFalse(exception.message.includes(token));
    Assert.isFalse(exception.message.includes(homedir()));
    const request = starter.requests[0] ?? [];
    const name = request[request.indexOf("--start-log") + 1];
    Assert.isTrue(/^start-[0-9a-f-]{36}\.log$/.test(String(name)));
    Assert.areEqual(path.join(launch.dataDirectory.logsFolder, String(name)), starter.errorFiles[0]);
    Assert.areEqual("", (await readdir(launch.dataDirectory.logsFolder)).join(","), "the start log is removed after reading it");
  }

  @TestMethod
  public async reportsARuntimeThatExitsWithoutAReason(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();

    const exception = await Assert.throwsAsync(
      () => new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity, new ScriptedStarterFixture("process.exit(1);")).attachAsync("desktop", new ClientListenerFixture()),
      LaunchException);

    Assert.areEqual("The runtime exited while starting and left no reason.", exception.message);
  }

  @TestMethod
  public async removesItsStartLogWhenTheRuntimeNeverStarts(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    const starter = new ScriptedStarterFixture("setTimeout(() => {}, 1000);");
    const settings = new LaunchSettings(launch.dataDirectory, process.execPath, RuntimeEntry.entryPath, {}, process.platform, 1_000, 400, 25);

    const exception = await Assert.throwsAsync(() => new RuntimeLauncher(settings, RuntimeBuild.identity, starter).attachAsync("desktop", new ClientListenerFixture()), LaunchException);

    Assert.areEqual("The runtime did not start in time.", exception.message);
    Assert.areEqual("", (await readdir(launch.dataDirectory.logsFolder)).join(","));
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(Number(starter.processIds[0])));
  }
}
