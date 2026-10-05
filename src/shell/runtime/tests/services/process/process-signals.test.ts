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
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../../fixtures/simulated-processes.fixture.js";
import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ProcessSignalsTests {
  @TestMethod
  public async treatsAProcessItCannotProbeAsRunningOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    simulated.fail(-900_031, 0, "unknown");
    simulated.fail(-900_032, 0, new Error("no code"));
    simulated.fail(-900_033, 0, Object.assign(new Error("kill EINVAL"), { code: "EINVAL" }));
    const command = new SystemCommandFixture(["", "", ""]);
    const processes = ProcessSupervisorFixture.createLinux(settings, command);

    for (const processId of [900_031, 900_032, 900_033]) {
      settings.database.run(ProcessSupervisorFixture.INSERT, "notes", processId, "tool", "/usr/bin/tool", "boot", now, now, now, 0);
      await processes.cleanUpAsync();
    }

    Assert.areEqual(3, command.calls.length);
    Assert.areEqual("", simulated.signals.join(","));
    Assert.areEqual("", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async killsAProgramThatDoesNotExitWithinTheGracePeriod(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.STUBBORN]));
    await ProgramFixture.readLineAsync(owned);
    const started = Date.now();

    const exit = await owned.stopAsync();

    Assert.isTrue(Date.now() - started >= 300);
    Assert.isFalse(exit.isClean);
    Assert.areEqual(process.platform === "win32" ? null : "SIGKILL", exit.signal);
    const text = settings.diagnostics.text;
    Assert.isTrue(
      ProcessSupervisorFixture.endsTheTree(text.slice(0, text.indexOf("\n") + 1), owned, "It did not end within the grace period, so processes", "were ended forcefully."),
      text);
  }
}
