/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProcessClock, SystemCommand } from "@noldova/teamrun-shell-runtime";

import { ProcessClockFixture } from "../fixtures/process-clock.fixture.js";
import { ProcessSupervisorFixture } from "../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../fixtures/program.fixture.js";
import { SettingsFixture } from "../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../fixtures/simulated-processes.fixture.js";
import { SystemCommandFixture } from "../fixtures/system-command.fixture.js";

@TestClass
export class ProcessRecordTests {
  @TestMethod
  public async leavesAloneAProcessWhoseIdWasReusedWhenItCleansUp(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const clock = ProcessClock.create(process.platform);
    const other = await ProcessSupervisorFixture.spawnAsync();
    try {
      const processId = Number(other.pid);
      const now = clock.now();
      const hourAgo = now - ProcessSupervisorFixture.HOUR;
      settings.database.run(ProcessSupervisorFixture.INSERT, "notes", processId, process.execPath, process.execPath, clock.boot, hourAgo, hourAgo, hourAgo, clock.offset());
      if (process.platform === "win32")
        settings.database.run(ProcessSupervisorFixture.INSERT, "notes", processId, "other.exe", path.join(ProcessSupervisorFixture.SYSTEM_ROOT, "other.exe"), clock.boot, now, now, now, clock.offset());
      const processes = ProcessSupervisorFixture.create(settings, process.platform, process.env, new SystemCommand(), clock);

      await processes.cleanUpAsync();

      Assert.isTrue(ProgramFixture.isRunning(processId));
      Assert.areEqual("", settings.diagnostics.text);
      Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
    }
    finally {
      await ProcessSupervisorFixture.endAsync(other);
    }
  }

  @TestMethod
  public async leavesAloneARunningProgramThatARecordFromAnEarlierBootNamesWhenItCleansUp(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const clock = ProcessClock.create(process.platform);
    const other = await ProcessSupervisorFixture.spawnAsync();
    try {
      const processId = Number(other.pid);
      const now = clock.now();
      const earlier = process.platform === "linux" ? "0f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b" : String(Number(clock.boot) - 86_400);
      settings.database.run(ProcessSupervisorFixture.INSERT, "notes", processId, process.execPath, process.execPath, earlier, now, now, now, clock.offset());
      const command = new SystemCommandFixture([]);
      const processes = ProcessSupervisorFixture.create(settings, process.platform, process.env, command, clock);

      await processes.cleanUpAsync();

      Assert.isTrue(ProgramFixture.isRunning(processId));
      Assert.areEqual(0, command.calls.length);
      Assert.areEqual("", settings.diagnostics.text);
      Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
    }
    finally {
      await ProcessSupervisorFixture.endAsync(other);
    }
  }

  @TestMethod
  public async leavesWhatAProgramStartedWhenTheClockChangedSinceItWasLastSeen(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const clock = new ProcessClockFixture(1_000_000);
    clock.clockOffset = 5_000;
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_131, "tool", "/usr/bin/tool", clock.boot, 990_000, 990_000, 999_000, 3_501);
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_135, "tool", "/usr/bin/tool", clock.boot, 990_000, 990_000, 999_000, 3_499);
    simulated.add(900_131, 900_131);
    simulated.add(900_135, 900_135);
    const command = new SystemCommandFixture([() => Promise.resolve(simulated.list(t => `${t} 1 ${t} 00:10`))]);
    const processes = ProcessSupervisorFixture.create(settings, "linux", process.env, command, clock);

    await processes.cleanUpAsync();

    Assert.areEqual("-900131 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_135));
    Assert.areEqual(
      "The module notes's program tool (process 900135): The system clock changed by more than a second after it was last seen running, " +
      "so what it started could not be told apart from other processes and was left running.\n" +
      "The module notes's program tool (process 900131): An earlier runtime left processes 900131 running, so they were ended.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }
}
