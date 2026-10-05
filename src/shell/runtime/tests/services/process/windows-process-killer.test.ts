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

import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../../fixtures/simulated-processes.fixture.js";
import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class WindowsProcessKillerTests {
  @TestMethod
  public async closesAProgramsInputThenKillsWhatItStartedBeforeItExitedFromTheTopDownOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const program = await ProgramFixture.locateWindowsProgramAsync(folder.path);
    const environment: NodeJS.ProcessEnv = { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT, psmodulepath: "C:\\Modules", TEAMRUN_KEPT: "kept" };
    let leader = 0;
    let started = 0;
    const command = new SystemCommandFixture([
      () => Promise.resolve([
        `${900_101}\t${leader}\t${started + 1}\t${program}`,
        `${900_102}\t${900_101}\t${started + 2}\t`,
        `${900_103}\t${leader}\t${started - ProcessSupervisorFixture.HOUR}\tC:\\old.exe`,
        `${900_104}\t${900_103}\t${started + 3}\tC:\\unrelated.exe`,
        `${900_105}\t${900_101}\t${started + 4}\tC:\\ended.exe`
      ].join("\r\n")),
      t => simulated.answerKillsAsync(t, [
        `${900_101}\t${leader}\t${started + 1}\t${program}`,
        `${900_106}\t${900_101}\t${started + 5}\tC:\\late.exe`,
        `${900_107}\t${900_101}\t${started + ProcessSupervisorFixture.HOUR}\tC:\\reused.exe`
      ].join("\n")),
      t => simulated.answerKillsAsync(t)
    ]);
    const processes = ProcessSupervisorFixture.createWindows(settings, environment, command);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], undefined, program));
    leader = owned.processId;
    started = owned.started.getTime();
    simulated.own(leader);
    simulated.add(900_101, 0, true);
    simulated.add(900_102, 0);
    simulated.add(900_103, 0);
    simulated.add(900_104, 0);
    simulated.add(900_106, 0);
    simulated.add(900_107, 0);
    await ProgramFixture.readLineAsync(owned);

    const exit = await owned.stopAsync();

    const [table = "", kill = "", late = ""] = command.calls.map(t => Buffer.from(t.at(-1) ?? "", "base64").toString("utf16le"));
    Assert.isTrue(exit.isClean);
    Assert.areEqual(3, command.calls.length);
    for (const [index, call] of command.calls.entries()) {
      Assert.areEqual(path.win32.join(ProcessSupervisorFixture.SYSTEM_ROOT, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), call[0]);
      Assert.areEqual("-NoProfile -NonInteractive -EncodedCommand", call.slice(1, 4).join(" "));
      Assert.areEqual(JSON.stringify({ SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT, TEAMRUN_KEPT: "kept" }), JSON.stringify(command.environments[index]));
    }
    Assert.isTrue(table.includes("Microsoft.PowerShell.Management\\Get-WmiObject -Query 'SELECT ProcessId, ParentProcessId, ExecutablePath FROM Win32_Process' -ErrorAction Stop"), table);
    Assert.isTrue(kill.startsWith(`$targets = @(900101,${started + 1},900102,${started + 2},900105,${started + 4}); $deadline = [DateTime]::UtcNow.AddMilliseconds(500); `), kill);
    Assert.isTrue(kill.includes("Microsoft.PowerShell.Management\\Get-WmiObject -Query 'SELECT ProcessId, ParentProcessId, ExecutablePath FROM Win32_Process' -ErrorAction Stop"), kill);
    Assert.isTrue(late.startsWith(`$targets = @(900106,${started + 5}); $deadline = [DateTime]::UtcNow.AddMilliseconds(500); `), late);
    Assert.isFalse(late.includes("Get-WmiObject"), late);
    for (const script of [table, kill, late])
      Assert.isFalse(/-Cim|CimCmdlets|Add-Type/i.test(script), script);
    Assert.areEqual("900101 SIGKILL,900102 SIGKILL,900106 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_103) && simulated.isAlive(900_104) && simulated.isAlive(900_107));
    Assert.areEqual(
      ProcessSupervisorFixture.line(owned, "It did not end within the grace period, so processes 900101, 900102, 900106 were ended forcefully.") +
      ProcessSupervisorFixture.line(owned, "Processes 900101 were still running after they were ended forcefully."),
      settings.diagnostics.text);
  }
}
