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
export class WindowsProcessEnderTests {
  @TestMethod
  public async readsTheTableOnceForAProgramThatExitsWhenItsInputClosesAndLeftNothingOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const program = await ProgramFixture.locateWindowsProgramAsync(folder.path);
    const command = new SystemCommandFixture([""]);
    const processes = ProcessSupervisorFixture.createWindows(settings, { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, command);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], undefined, program));
    simulated.own(owned.processId);
    await ProgramFixture.readLineAsync(owned);

    const exit = await owned.stopAsync();

    Assert.isTrue(exit.isClean);
    Assert.areEqual(1, command.calls.length);
    Assert.areEqual("", simulated.signals.join(","));
    Assert.areEqual("", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async killsAProgramThatKeepsRunningAfterItsInputClosesBeforeWhatItStartedOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const program = await ProgramFixture.locateWindowsProgramAsync(folder.path);
    let leader = 0;
    let started = 0;
    const command = new SystemCommandFixture([
      () => Promise.resolve([
        `${leader}\t900201\t${started}\t${program}`,
        `${900_201}\t${leader}\t${started}\t${program}`
      ].join("\n")),
      t => simulated.answerKillsAsync(t)
    ]);
    const processes = ProcessSupervisorFixture.createWindows(settings, { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, command);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.STUBBORN], undefined, program));
    leader = owned.processId;
    started = ProcessSupervisorFixture.readStarted(settings);
    simulated.own(leader);
    simulated.add(900_201, 0);
    await ProgramFixture.readLineAsync(owned);
    owned.input.end();

    const exit = await owned.stopAsync();

    Assert.isFalse(exit.isClean);
    Assert.areEqual(`${leader} SIGKILL,900201 SIGKILL`, simulated.signals.join(","));
    Assert.areEqual(ProcessSupervisorFixture.line(owned, `It did not end within the grace period, so processes ${leader}, 900201 were ended forcefully.`), settings.diagnostics.text);
  }

  @TestMethod
  public async killsWhatARunningProgramMissingFromTheTableStartedOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const program = await ProgramFixture.locateWindowsProgramAsync(folder.path);
    let leader = 0;
    let started = 0;
    const command = new SystemCommandFixture([
      () => Promise.resolve(`${900_211}\t${leader}\t${started + 1}\tC:\\child.exe`),
      t => simulated.answerKillsAsync(t)
    ]);
    const processes = ProcessSupervisorFixture.createWindows(settings, { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, command);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.STUBBORN], undefined, program));
    leader = owned.processId;
    started = owned.started.getTime();
    simulated.own(leader);
    simulated.add(900_211, 0);
    await ProgramFixture.readLineAsync(owned);

    const stopping = owned.stopAsync();
    await ProcessSupervisorFixture.waitForAsync(() => settings.diagnostics.text.length > 0);
    const signals = simulated.signals.join(",");
    process.kill(leader, "SIGKILL");
    const exit = await stopping;

    Assert.isFalse(exit.isClean);
    Assert.areEqual("900211 SIGKILL", signals);
    Assert.areEqual(ProcessSupervisorFixture.line(owned, "It did not end within the grace period, so processes 900211 were ended forcefully."), settings.diagnostics.text);
  }

  @TestMethod
  public async endsWhatAGoneProgramStartedOnlyUntilAnotherProcessTookItsIdOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.WINDOWS.now();
    settings.database.run(
      ProcessSupervisorFixture.INSERT, "notes", 900_701, "tool", "C:\\Tools\\tool.exe", ProcessSupervisorFixture.WINDOWS.boot, now - 10_000, now - 10_000, now - 3_000,
      ProcessSupervisorFixture.WINDOWS.offset());
    for (const processId of [900_701, 900_702, 900_703, 900_704, 900_705])
      simulated.add(processId, 0);
    const command = new SystemCommandFixture([[
      `900701\t1\t${now - 5_000}\tC:\\Tools\\tool.exe`,
      `900702\t900701\t${now - 5_001}\tC:\\Tools\\child.exe`,
      `900703\t900701\t${now - 4_000}\tC:\\Tools\\child.exe`,
      `900704\t900701\t${now - 5_000}\tC:\\Other\\child.exe`,
      `900705\t900701\t${now - 1_000}\tC:\\Other\\child.exe`
    ].join("\n"), t => simulated.answerKillsAsync(t)]);
    const processes = ProcessSupervisorFixture.createWindows(settings, { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, command);

    await processes.cleanUpAsync();

    Assert.areEqual("900702 SIGKILL", simulated.signals.join(","));
    Assert.isTrue([900_701, 900_703, 900_704, 900_705].every(t => simulated.isAlive(t)));
    Assert.areEqual(
      "The module notes's program tool (process 900701): An earlier runtime left processes 900702 running, so they were ended.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async leavesAloneAnEarlierBootsProgramAndWhatAnEndedProgramsIdParentsOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const clock = ProcessSupervisorFixture.WINDOWS;
    const now = clock.now();
    const executable = "C:\\Tools\\tool.exe";
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_501, "tool", executable, String(Number(clock.boot) - 86_400), now, now, now, clock.offset());
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_502, "tool", executable, clock.boot, now, now, now, clock.offset());
    for (const processId of [900_501, 900_503, 900_504])
      simulated.add(processId, 0);
    const command = new SystemCommandFixture([[
      `900501\t1\t${now}\t${executable}`,
      `900503\t900502\t${now - ProcessSupervisorFixture.HOUR}\tC:\\Windows\\explorer.exe`,
      `900504\t900502\t${now + 51}\tC:\\Tools\\child.exe`
    ].join("\n")]);
    const processes = ProcessSupervisorFixture.createWindows(settings, { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, command);

    await processes.cleanUpAsync();

    Assert.areEqual(1, command.calls.length);
    Assert.areEqual("", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_501) && simulated.isAlive(900_503) && simulated.isAlive(900_504));
    Assert.areEqual(
      "The module notes's program tool (process 900502): It was no longer running, and nothing showed that processes 900504 were what it started, so they were left running.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async keepsTheLeftoversItCannotListAndReportsWhyOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const clock = ProcessSupervisorFixture.WINDOWS;
    const now = clock.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_401, "tool", "C:\\tool.exe", clock.boot, now, now, now, clock.offset());
    settings.database.run(ProcessSupervisorFixture.INSERT, "tasks", 900_402, "tool", "C:\\tool.exe", clock.boot, now, now, now, clock.offset());
    const missingRoot = ProcessSupervisorFixture.createWindows(settings, {}, new SystemCommandFixture([]));
    const unreadable = ProcessSupervisorFixture.createWindows(settings, { SystemRoot: "C:\\Windows" }, new SystemCommandFixture(["900401\tnot a row"]));

    await missingRoot.cleanUpAsync();
    const reported = settings.diagnostics.text;
    await unreadable.cleanUpAsync();

    Assert.isTrue(reported.startsWith("The module notes's program tool (process 900401): "), reported);
    Assert.isTrue(reported.includes("The module tasks's program tool (process 900402): "), reported);
    Assert.isTrue(reported.includes("SystemRoot is not set, so the Windows system tools cannot be found."), reported);
    Assert.isTrue(settings.diagnostics.text.includes("The process table has a row that could not be read: 900401\tnot a row"), settings.diagnostics.text);
    Assert.areEqual(2, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async leavesWhatAProcessThatTookAGoneProgramsIdStartedAfterThatProcessExitedOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const clock = ProcessSupervisorFixture.WINDOWS;
    const now = clock.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_811, "tool", "C:\\Tools\\tool.exe", clock.boot, now - 10_000, now - 10_000, now - 5_000, clock.offset());
    for (const processId of [900_812, 900_813, 900_814])
      simulated.add(processId, 0);
    const command = new SystemCommandFixture([[
      `900812\t900811\t${now - 6_000}\tC:\\Tools\\child.exe`,
      `900813\t900811\t${now - 2_000}\tC:\\Other\\holder-child.exe`,
      `900814\t900813\t${now - 1_000}\tC:\\Other\\grandchild.exe`
    ].join("\n"), t => simulated.answerKillsAsync(t)]);
    const processes = ProcessSupervisorFixture.createWindows(settings, { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, command);

    await processes.cleanUpAsync();

    Assert.areEqual("900812 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_813) && simulated.isAlive(900_814));
    Assert.areEqual(
      "The module notes's program tool (process 900811): An earlier runtime left processes 900812 running, so they were ended.\n" +
      "The module notes's program tool (process 900811): It was no longer running, and nothing showed that processes 900813, 900814 were what it started, so they were left running.\n",
      settings.diagnostics.text);
  }

  @TestMethod
  public async forgetsAProgramThatExitsOnItsOwnOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const program = await ProgramFixture.locateWindowsProgramAsync(folder.path);
    const command = new SystemCommandFixture([]);
    const processes = ProcessSupervisorFixture.createWindows(settings, { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, command);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "4"], undefined, program));

    const exit = await owned.exited;
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    const stopped = await owned.stopAsync();

    Assert.areEqual(4, exit.code);
    Assert.areEqual(exit, stopped);
    Assert.areEqual(0, command.calls.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }
}
