/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { ProcessSupervisorFixture } from "../fixtures/process-supervisor.fixture.js";
import { SettingsFixture } from "../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../fixtures/simulated-processes.fixture.js";
import { SystemCommandFixture } from "../fixtures/system-command.fixture.js";

@TestClass
export class ProcessTableEntryTests {
  @TestMethod
  public async endsTheGroupOfAGoneProgramOnlyForAProcessThatCertainlyStartedBeforeItWasLastSeenOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    const elapsed = new Map([[900_112, "00:02"], [900_116, "00:03"]]);
    for (const [leader, member] of [[900_111, 900_112], [900_115, 900_116]] as const) {
      settings.database.run(ProcessSupervisorFixture.INSERT, "notes", leader, "tool", "/usr/bin/tool", "boot", now - 10_000, now - 10_000, now - 1_100, 0);
      simulated.add(member, leader);
    }
    const command = new SystemCommandFixture([() => Promise.resolve(simulated.list(t => `${t} 1 ${t - 1} ${elapsed.get(t)}`))]);
    const processes = ProcessSupervisorFixture.createLinux(settings, command);

    await processes.cleanUpAsync();

    Assert.areEqual("-900115 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_112));
    Assert.areEqual(
      "The module notes's program tool (process 900115): An earlier runtime left processes 900116 running, so they were ended.\n" +
      "The module notes's program tool (process 900111): It was no longer running, and nothing showed that processes 900112 were what it started, so they were left running.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }
}
