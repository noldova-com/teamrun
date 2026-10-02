/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ShellMethods, WindowStateKey } from "@noldova/teamrun-shell-protocol";
import { RuntimeWindowStateStore, WindowStateException } from "@noldova/teamrun-shell-desktop";

import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";

@TestClass
export class RuntimeWindowStateStoreTests {
  private static readonly KEY: WindowStateKey = new WindowStateKey("device-1", "main");

  @TestMethod
  public async writesAndReadsTheWindowsStateThroughTheRuntime(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const store = new RuntimeWindowStateStore(() => connection, RuntimeWindowStateStoreTests.KEY, ShellMethods.readWindowBounds, ShellMethods.writeWindowBounds);

    const before = await store.readAsync();
    await store.writeAsync({ width: 900 });

    Assert.isNull(before);
    Assert.areEqual(JSON.stringify({ width: 900 }), JSON.stringify(await store.readAsync()));
    Assert.areEqual(JSON.stringify(["shell.readWindowBounds", "shell.writeWindowBounds", "shell.readWindowBounds"]), JSON.stringify(connection.calls));
  }

  @TestMethod
  public async failsWithoutAConnectionOrWhenTheRuntimeRefuses(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.isFailing = true;
    const detached = new RuntimeWindowStateStore(() => null, RuntimeWindowStateStoreTests.KEY, ShellMethods.readWindowLayout, ShellMethods.writeWindowLayout);
    const refused = new RuntimeWindowStateStore(() => connection, RuntimeWindowStateStoreTests.KEY, ShellMethods.readWindowLayout, ShellMethods.writeWindowLayout);

    Assert.areEqual("TeamRun is not connected to its runtime.", (await Assert.throwsAsync(() => detached.readAsync(), WindowStateException)).message);
    Assert.areEqual("The runtime refused shell.writeWindowLayout: The database is busy.", (await Assert.throwsAsync(() => refused.writeAsync({}), WindowStateException)).message);
  }
}
