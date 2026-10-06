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
import { WindowsProcessApiFixture } from "../fixtures/windows-process-api.fixture.js";

@TestClass
export class ProcessKillingTests {
  @TestMethod
  public async leavesAProcessThatTookAnIdAfterTheTableWasReadAndKillsTheRestOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const clock = ProcessSupervisorFixture.WINDOWS;
    const now = clock.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_821, "tool", "C:\\Tools\\tool.exe", clock.boot, now - 10_000, now - 10_000, now - 1_000, clock.offset());
    for (const processId of [900_821, 900_822, 900_823, 900_824, 900_825])
      simulated.add(processId, 0);
    simulated.fail(900_823, "SIGKILL", Object.assign(new Error("kill EPERM"), { code: "EPERM" }));
    const windows = new WindowsProcessApiFixture([[
      `900821\t1\t${now - 10_000}\tC:\\Tools\\tool.exe`,
      `900822\t900821\t${now - 9_999}\tC:\\Tools\\child.exe`,
      `900823\t900821\t${now - 9_998}\tC:\\Tools\\child.exe`,
      `900824\t900821\t${now - 9_997}\tC:\\Tools\\child.exe`
    ].join("\n"), [
      `900822\t4\t${now - 9_997}\tC:\\Other\\holder.exe`,
      `900825\t900822\t${now - 9_996}\tC:\\Other\\child.exe`,
      `900823\t900821\t${now - 9_998}\tC:\\Tools\\child.exe`
    ].join("\n")]);
    windows.replaced.set(900_822, WindowsProcessApiFixture.END);
    const processes = ProcessSupervisorFixture.createWindows(settings, windows);

    await processes.cleanUpAsync();

    Assert.areEqual("900821 SIGKILL,900823 SIGKILL,900824 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_822) && simulated.isAlive(900_823) && simulated.isAlive(900_825));
    Assert.areEqual(
      "The module notes's program tool (process 900821): An earlier runtime left processes 900821, 900824 running, so they were ended.\n" +
      "The module notes's program tool (process 900821): Processes 900823 were still running after they were ended forcefully.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, windows.openHandles);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }
}
