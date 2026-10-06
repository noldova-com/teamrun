/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateProcess } from "@noldova/teamrun-shell-protocol";
import { ProcessPresence, SystemCommand } from "@noldova/teamrun-shell-runtime";

import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";

@TestClass
export class ProcessPresenceTests {
  private static readonly WINDOWS_TABLE: string = "4120\t1\t1500000\t\n4188\t4120\t1600000\t";

  @TestMethod
  public async findsTheRunningTestProcess(): Promise<void> {
    const presence = ProcessPresence.create(process.platform, new SystemCommand(), process.env);

    const [stamp] = await presence.stampAsync([[process.pid, "cli"]]);

    Assert.isDefined(stamp);
    Assert.areEqual(`${process.pid} cli`, `${stamp.processId} ${stamp.role}`);
    Assert.isTrue(await presence.isRunningAsync(stamp));
  }

  @TestMethod
  public async stampsTheProcessesTheTableListsWithTheRangeTheirStartFallsIn(): Promise<void> {
    const command = new SystemCommandFixture([ProcessPresenceTests.WINDOWS_TABLE]);
    const presence = ProcessPresence.create("win32", command, { SystemRoot: "C:/Windows" });

    const stamps = await presence.stampAsync([[4188, "program"], [4999, "cli"], [4120, "desktop"]]);

    Assert.areEqual("4188 1599950 1600050 program|4120 1499950 1500050 desktop", stamps.map(t => `${t.processId} ${t.earliest} ${t.latest} ${t.role}`).join("|"));
    Assert.areEqual(1, command.calls.length);
  }

  @TestMethod
  public async readsNoTableToStampNoProcesses(): Promise<void> {
    const command = new SystemCommandFixture([]);
    const presence = ProcessPresence.create("darwin", command, {});

    Assert.areEqual(0, (await presence.stampAsync([])).length);
    Assert.areEqual(0, command.calls.length);
  }

  @TestMethod
  public async findsAProcessOnlyWhenItsIdIsListedWithAStartThatCanFallInItsRange(): Promise<void> {
    const table = ProcessPresenceTests.WINDOWS_TABLE;
    const presence = ProcessPresence.create("win32", new SystemCommandFixture([table, table, table, table]), { SystemRoot: "C:/Windows" });

    const results = [
      await presence.isRunningAsync(new UpdateProcess(4120, 1500050, 1500100, "desktop")),
      await presence.isRunningAsync(new UpdateProcess(4120, 1499900, 1499950, "desktop")),
      await presence.isRunningAsync(new UpdateProcess(4120, 1500051, 1500100, "desktop")),
      await presence.isRunningAsync(new UpdateProcess(4999, 1500000, 1500000, "desktop"))
    ];

    Assert.areEqual("true true false false", results.join(" "));
  }

  @TestMethod
  public async readsThePosixTableWithPs(): Promise<void> {
    const command = new SystemCommandFixture(["  4120     1  4120   01:00\n", "  4120     1  4120   01:00\n"]);
    const presence = ProcessPresence.create("darwin", command, {});

    const [stamp] = await presence.stampAsync([[4120, "desktop"]]);

    Assert.isDefined(stamp);
    Assert.isTrue(await presence.isRunningAsync(stamp));
    Assert.areEqual("/bin/ps -A -o pid=,ppid=,pgid=,etime=", command.calls[0]?.join(" "));
  }
}
