/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ShellMethods, WindowStateKey } from "@noldova/teamrun-shell-protocol";
import { ConnectionException } from "@noldova/teamrun-shell-runtime";
import { RuntimeWindowStateStore, WindowStateException, WindowStateUnavailableException } from "@noldova/teamrun-shell-desktop";

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

    Assert.areEqual("TeamRun is not connected to its runtime.", (await Assert.throwsAsync(() => detached.readAsync(), WindowStateUnavailableException)).message);
    const refusal = await Assert.throwsAsync(() => refused.writeAsync({}), WindowStateException);
    Assert.areEqual("The runtime refused shell.writeWindowLayout: The database is busy.", refusal.message);
    Assert.isFalse(refusal instanceof WindowStateUnavailableException);
  }

  @TestMethod
  public async reportsAConnectionThatFailsAsUnreachableAndPassesOtherErrorsOn(): Promise<void> {
    const lost = new FakeRuntimeConnection();
    lost.rejection = new ConnectionException("The runtime closed the connection.");
    const broken = new FakeRuntimeConnection();
    broken.rejection = new RangeError("A defect.");
    const store = (connection: FakeRuntimeConnection): RuntimeWindowStateStore =>
      new RuntimeWindowStateStore(() => connection, RuntimeWindowStateStoreTests.KEY, ShellMethods.readWindowBounds, ShellMethods.writeWindowBounds);

    const unreachable = await Assert.throwsAsync(() => store(lost).writeAsync({}), WindowStateUnavailableException);
    const defect = await Assert.throwsAsync(() => store(broken).writeAsync({}), RangeError);

    Assert.areEqual("The runtime closed the connection.", unreachable.message);
    Assert.areEqual("A defect.", defect.message);
  }
}
