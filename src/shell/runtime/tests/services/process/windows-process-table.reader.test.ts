/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../../fixtures/simulated-processes.fixture.js";
import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";

@TestClass
export class WindowsProcessTableReaderTests {
  @TestMethod
  public async endsOnlyTheLeftoversRunByTheirRecordedProgramOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.WINDOWS.now();
    const records: [number, string][] = [[900_301, "C:\\Tools\\Tool.EXE"], [900_302, "C:\\Tools\\tool.exe"], [900_305, "C:\\Tools\\tool.exe"], [900_306, "C:\\Tools\\tool.exe"]];
    for (const [processId, executable] of records) {
      settings.database.run(ProcessSupervisorFixture.INSERT, "notes", processId, "tool", executable, ProcessSupervisorFixture.WINDOWS.boot, now, now, now, ProcessSupervisorFixture.WINDOWS.offset());
      simulated.add(processId, 0);
    }
    const command = new SystemCommandFixture([[
      `900301\t1\t${now}\tc:/tools/tool.exe`,
      `900302\t1\t${now}\t`,
      `900305\t1\t${now}\tC:\\Other\\tool.exe`,
      `900306\t1\t${now + ProcessSupervisorFixture.HOUR}\tC:\\Tools\\tool.exe`
    ].join("\n"), t => simulated.answerKillsAsync(t)]);
    const processes = ProcessSupervisorFixture.createWindows(settings, { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, command);

    await processes.cleanUpAsync();

    Assert.areEqual("900301 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_302) && simulated.isAlive(900_305) && simulated.isAlive(900_306));
    Assert.areEqual("The module notes's program tool (process 900301): An earlier runtime left processes 900301 running, so they were ended.\n", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }
}
