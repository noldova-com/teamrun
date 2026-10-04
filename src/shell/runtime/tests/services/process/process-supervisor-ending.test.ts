/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { type OwnedProcess, ProcessClock, ProcessSettings, ProcessStartException, ProcessSupervisor, SystemCommand } from "@noldova/teamrun-shell-runtime";

import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../../fixtures/simulated-processes.fixture.js";
import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ProcessSupervisorEndingTests {
  private static readonly MODULE: string = "notes";
  private static readonly RECORDS: string = "SELECT process_id FROM owned_processes";
  private static readonly INSERT: string =
    "INSERT INTO owned_processes (module, process_id, program, executable, boot, requested, started, seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
  private static readonly SEEN: string = "SELECT started, seen FROM owned_processes";
  private static readonly HOUR: number = 3_600_000;
  private static readonly SYSTEM_ROOT: string = process.env["SystemRoot"] ?? "C:\\Windows";
  private static readonly LINUX: ProcessClock = new ProcessClock("boot", true);
  private static readonly WINDOWS: ProcessClock = ProcessClock.create("win32");

  @TestMethod
  public async stopsAProgramAndWhatItStartedAndReportsHowItExited(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorEndingTests.create(settings);
    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.PARENT, ProgramFixture.WAIT]));
    const child = Number(await ProgramFixture.readLineAsync(owned));

    const stopping = owned.stopAsync();
    const exit = await owned.stopAsync();

    Assert.areEqual(stopping, owned.stopAsync());
    Assert.areEqual(process.platform === "win32" ? "0 null" : "null SIGTERM", `${exit.code} ${exit.signal}`);
    Assert.isFalse(ProgramFixture.isRunning(child));
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async killsAProgramThatDoesNotExitWithinTheGracePeriod(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorEndingTests.create(settings);
    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.STUBBORN]));
    await ProgramFixture.readLineAsync(owned);
    const started = Date.now();

    const exit = await owned.stopAsync();

    Assert.isTrue(Date.now() - started >= 300);
    Assert.isFalse(exit.isClean);
    Assert.areEqual(process.platform === "win32" ? null : "SIGKILL", exit.signal);
    const text = settings.diagnostics.text;
    Assert.isTrue(
      ProcessSupervisorEndingTests.endsTheTree(text.slice(0, text.indexOf("\n") + 1), owned, "It did not end within the grace period, so processes", "were ended forcefully."),
      text);
  }

  @TestMethod
  public async endsWhatAnEarlierRuntimeLeftRunningWhenItCleansUp(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const earlier = ProcessSupervisorEndingTests.create(settings);
    const owned = await earlier.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await ProgramFixture.readLineAsync(owned);
    const later = ProcessSupervisorEndingTests.create(settings);

    await later.cleanUpAsync();
    await owned.exited;
    await earlier.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);
    await later.cleanUpAsync();

    Assert.isTrue(
      ProcessSupervisorEndingTests.endsTheTree(settings.diagnostics.text, owned, "An earlier runtime left processes", "running, so they were ended."),
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async leavesAloneAProcessWhoseIdWasReusedWhenItCleansUp(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const clock = ProcessClock.create(process.platform);
    const other = await ProcessSupervisorEndingTests.spawnAsync();
    try {
      const processId = Number(other.pid);
      const now = clock.now();
      const hourAgo = now - ProcessSupervisorEndingTests.HOUR;
      settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", processId, process.execPath, process.execPath, clock.boot, hourAgo, hourAgo, hourAgo);
      if (process.platform === "win32")
        settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", processId, "other.exe", path.join(ProcessSupervisorEndingTests.SYSTEM_ROOT, "other.exe"), clock.boot, now, now, now);
      const processes = ProcessSupervisorEndingTests.create(settings, process.platform, process.env, new SystemCommand(), clock);

      await processes.cleanUpAsync();

      Assert.isTrue(ProgramFixture.isRunning(processId));
      Assert.areEqual("", settings.diagnostics.text);
      Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
    }
    finally {
      await ProcessSupervisorEndingTests.endAsync(other);
    }
  }

  @TestMethod
  public async leavesAloneARunningProgramThatARecordFromAnEarlierBootNamesWhenItCleansUp(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const clock = ProcessClock.create(process.platform);
    const other = await ProcessSupervisorEndingTests.spawnAsync();
    try {
      const processId = Number(other.pid);
      const now = clock.now();
      const earlier = process.platform === "linux" ? "0f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b" : String(Number(clock.boot) - 86_400);
      settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", processId, process.execPath, process.execPath, earlier, now, now, now);
      const command = new SystemCommandFixture([]);
      const processes = ProcessSupervisorEndingTests.create(settings, process.platform, process.env, command, clock);

      await processes.cleanUpAsync();

      Assert.isTrue(ProgramFixture.isRunning(processId));
      Assert.areEqual(0, command.calls.length);
      Assert.areEqual("", settings.diagnostics.text);
      Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
    }
    finally {
      await ProcessSupervisorEndingTests.endAsync(other);
    }
  }

  @TestMethod
  public async refusesAModulesStartsOnceItsProgramsBeginToEndAndEveryStartOnceAllDo(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorEndingTests.create(settings);
    const notes = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    const tasks = await processes.startAsync("tasks", ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await ProgramFixture.readLineAsync(notes);
    await ProgramFixture.readLineAsync(tasks);

    const stopping = processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);
    const refused = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT])),
      ProcessStartException);
    await stopping;
    const tasksRunning = processes.programs.map(t => t.moduleId);
    const stoppingAll = processes.stopAllAsync();
    const refusedAll = await Assert.throwsAsync(() => processes.startAsync("tasks", ProgramFixture.request(folder.path, [ProgramFixture.WAIT])), ProcessStartException);
    await stoppingAll;
    await Promise.all([notes.exited, tasks.exited]);

    Assert.areEqual(`${process.execPath} was not started, because the module notes is stopping.`, refused.message);
    Assert.areEqual(`${process.execPath} was not started, because the module tasks is stopping.`, refusedAll.message);
    Assert.areEqual("tasks", tasksRunning.join(","));
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async renewsWhenItLastSawEachRunningProgramWhileItRuns(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorEndingTests.createSeeing(settings);
    const first = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    const second = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await Promise.all([ProgramFixture.readLineAsync(first), ProgramFixture.readLineAsync(second)]);

    await ProcessSupervisorEndingTests.waitForAsync(() => {
      const rows = settings.database.readAll(ProcessSupervisorEndingTests.SEEN);
      return rows.length === 2 && rows.every(t => Number(t["seen"]) > Number(t["started"]));
    });
    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);

    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
    Assert.areEqual("", settings.diagnostics.text);
  }

  @TestMethod
  public async reportsARunningProgramWhoseRecordItCannotRenew(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorEndingTests.createSeeing(settings);
    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await ProgramFixture.readLineAsync(owned);

    settings.database.run("DROP TABLE owned_processes");
    await ProcessSupervisorEndingTests.waitForAsync(() => settings.diagnostics.text.includes("no such table"));
    const text = settings.diagnostics.text;
    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);
    await owned.exited;

    Assert.isTrue(text.startsWith(ProcessSupervisorEndingTests.line(owned, "").trimEnd()), text);
    Assert.isTrue(text.includes("no such table: owned_processes"), text);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async endsTheRestOfAProgramsGroupWhenItExitsWithAnError(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorEndingTests.create(settings);
    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.PARENT, "3"]));
    const child = Number(await ProgramFixture.readLineAsync(owned));

    const exit = await owned.exited;
    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);

    Assert.areEqual(3, exit.code);
    Assert.isTrue(await ProgramFixture.waitForEndAsync(child, 1_000));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async leavesAProgramsGroupAfterACleanExitUntilItsModuleStops(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorEndingTests.create(settings);
    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.PARENT, "0"]));
    const child = Number(await ProgramFixture.readLineAsync(owned));

    await owned.exited;
    await ProcessSupervisorEndingTests.waitForAsync(() => processes.programs.some(t => t.hasExited));
    const keptAfterExit = ProgramFixture.isRunning(child);
    const listedAfterExit = processes.programs.map(t => `${t.processId} ${t.hasExited}`);
    const recordedAfterExit = settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length;
    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);

    Assert.isTrue(keptAfterExit);
    Assert.areEqual(`${owned.processId} true`, listedAfterExit.join(","));
    Assert.areEqual(1, recordedAfterExit);
    Assert.isTrue(await ProgramFixture.waitForEndAsync(child, 1_000));
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
    Assert.areEqual("", settings.diagnostics.text);
  }

  @TestMethod
  public async killsTheGroupThatOutlastsAnErrorExitAndReportsWhatStaysOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const rows = (): Promise<string> => Promise.resolve([
      simulated.list(t => `  ${t} ${leader} ${leader} 00:00`),
      `${leader + 1} 1 1 1-00:00:00`,
      `${leader + 2} 1 1 01:02:03`,
      "",
      `${leader + 3} 1 1 00:01`
    ].join("\n"));
    const processes = ProcessSupervisorEndingTests.createLinux(settings, new SystemCommandFixture([rows]));

    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "2"]));
    leader = owned.processId;
    simulated.add(900_001, leader, true);
    await owned.exited;
    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);

    Assert.areEqual(`-${leader} SIGTERM,-${leader} SIGKILL`, simulated.signals.join(","));
    Assert.areEqual(
      ProcessSupervisorEndingTests.line(owned, "It did not end within the grace period, so processes 900001 were ended forcefully.") +
      ProcessSupervisorEndingTests.line(owned, "Processes 900001 were still running after they were ended forcefully."),
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async endsTheGroupAProgramLeftAfterACleanExitWhileAProcessItHeldStillRunsInItOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const rows = (): Promise<string> => Promise.resolve(simulated.list(t => `${t} 1 ${leader} 00:00`));
    const command = new SystemCommandFixture([rows, rows]);
    const processes = ProcessSupervisorEndingTests.createLinux(settings, command);

    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    leader = owned.processId;
    simulated.add(900_011, leader);
    await owned.exited;
    await ProcessSupervisorEndingTests.waitForAsync(() => processes.programs.some(t => t.hasExited));
    const listed = processes.programs.map(t => `${t.moduleId} ${t.program} ${t.processId} ${t.started.getTime()} ${t.hasExited}`);
    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);

    Assert.areEqual(`notes ${owned.program} ${leader} ${owned.started.getTime()} true`, listed.join(","));
    Assert.areEqual(`-${leader} SIGTERM`, simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_011));
    Assert.areEqual(2, command.calls.length);
    Assert.areEqual("", settings.diagnostics.text);
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async leavesAGroupWhoseProcessesItCanNoLongerRecogniseAfterACleanExitAndNamesThemOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const rows = (): Promise<string> => Promise.resolve(simulated.list(t => `${t} 1 ${leader} 00:00`));
    const processes = ProcessSupervisorEndingTests.createLinux(settings, new SystemCommandFixture([rows, rows]));

    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    leader = owned.processId;
    simulated.add(900_012, leader);
    await owned.exited;
    await ProcessSupervisorEndingTests.waitForAsync(() => processes.programs.some(t => t.hasExited));
    simulated.remove(900_012);
    simulated.add(900_013, leader);
    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);

    Assert.areEqual("", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_013));
    Assert.areEqual(
      ProcessSupervisorEndingTests.line(owned, "It was no longer running, and nothing showed that processes 900013 were what it started, so they were left running."),
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async leavesAGroupItCouldNotListWhenItsProgramExitedCleanlyOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const command = new SystemCommandFixture([
      () => Promise.resolve("not a row"),
      () => Promise.resolve(simulated.list(t => `${t} ${leader} ${leader} 00:00`))
    ]);
    const processes = ProcessSupervisorEndingTests.createLinux(settings, command);

    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    leader = owned.processId;
    simulated.add(900_014, leader);
    await owned.exited;
    await ProcessSupervisorEndingTests.waitForAsync(() => processes.programs.some(t => t.hasExited));
    await processes.stopOwnedByAsync("other");
    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);

    const text = settings.diagnostics.text;
    Assert.isTrue(text.startsWith(ProcessSupervisorEndingTests.line(owned, "").trimEnd()), text);
    Assert.isTrue(text.includes("The process table has a row that could not be read: not a row"), text);
    Assert.isTrue(
      text.endsWith(ProcessSupervisorEndingTests.line(owned, "It was no longer running, and nothing showed that processes 900014 were what it started, so they were left running.")),
      text);
    Assert.areEqual("", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_014));
    Assert.areEqual(2, command.calls.length);
    Assert.areEqual("/bin/ps -A -o pid=,ppid=,pgid=,etime=", command.calls[0]?.join(" "));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async keepsTheRecordsOfTheGroupsItCouldNotSignalOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const rows = (): Promise<string> => Promise.resolve(simulated.list(t => `${t} 1 ${leader} 00:00`));
    const processes = ProcessSupervisorEndingTests.createLinux(settings, new SystemCommandFixture([rows, rows]));
    const clean = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    leader = clean.processId;
    simulated.add(900_021, leader);
    await clean.exited;
    await ProcessSupervisorEndingTests.waitForAsync(() => processes.programs.some(t => t.hasExited));
    const running = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    simulated.own(running.processId);
    await ProgramFixture.readLineAsync(running);
    simulated.fail(-running.processId, "SIGTERM", "denied");

    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);
    running.input.end();
    await running.exited;

    Assert.areEqual(`-${running.processId} SIGTERM`, simulated.signals.join(","));
    Assert.isTrue(settings.diagnostics.text.includes(ProcessSupervisorEndingTests.line(running, "'denied'")), settings.diagnostics.text);
    Assert.isTrue(settings.diagnostics.text.includes(ProcessSupervisorEndingTests.line(clean, "'denied'")), settings.diagnostics.text);
    Assert.areEqual(2, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async treatsAProcessItCannotProbeAsRunningOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorEndingTests.LINUX.now();
    simulated.fail(-900_031, 0, "unknown");
    simulated.fail(-900_032, 0, new Error("no code"));
    simulated.fail(-900_033, 0, Object.assign(new Error("kill EINVAL"), { code: "EINVAL" }));
    const command = new SystemCommandFixture(["", "", ""]);
    const processes = ProcessSupervisorEndingTests.createLinux(settings, command);

    for (const processId of [900_031, 900_032, 900_033]) {
      settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", processId, "tool", "/usr/bin/tool", "boot", now, now, now);
      await processes.cleanUpAsync();
    }

    Assert.areEqual(3, command.calls.length);
    Assert.areEqual("", simulated.signals.join(","));
    Assert.areEqual("", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async forgetsAGroupThatEndedWithItsLeaderAndStopsARunningOneWithoutTheTableOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const command = new SystemCommandFixture([]);
    const processes = ProcessSupervisorEndingTests.createLinux(settings, command);
    const ended = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "2"]));
    await ended.exited;
    const running = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    simulated.own(running.processId);
    await ProgramFixture.readLineAsync(running);

    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);
    await running.exited;

    Assert.areEqual(`-${running.processId} SIGTERM`, simulated.signals.join(","));
    Assert.areEqual(0, command.calls.length);
    Assert.areEqual("", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async leavesAloneAGroupWhoseLeadersIdWasReusedOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorEndingTests.LINUX.now();
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", 900_041, "tool", "/usr/bin/tool", "boot", now, now, now);
    simulated.add(900_041, 900_041);
    simulated.add(900_042, 900_041);
    const command = new SystemCommandFixture([() => Promise.resolve(simulated.list(t => `${t} 1 900041 1-00:00:00`))]);
    const processes = ProcessSupervisorEndingTests.createLinux(settings, command);

    await processes.cleanUpAsync();

    Assert.areEqual(1, command.calls.length);
    Assert.areEqual("", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_041) && simulated.isAlive(900_042));
    Assert.areEqual("", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async leavesTheGroupOfAGoneProgramThatHoldsNoProcessStartedBeforeItWasLastSeenAndNamesItsProcessesOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorEndingTests.LINUX.now();
    const command = new SystemCommandFixture([() => Promise.resolve(simulated.list(t => `${t} 1 900051 00:00`))]);
    const processes = ProcessSupervisorEndingTests.createLinux(settings, command);
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", 900_058, "tool", "/usr/bin/tool", "boot", now, now, now);

    await processes.cleanUpAsync();
    const readForEndedGroup = command.calls.length;
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", 900_051, "tool", "/usr/bin/tool", "boot", now - 2_000, now - 2_000, now - 1_000);
    simulated.add(900_052, 900_051);
    await processes.cleanUpAsync();

    Assert.areEqual(0, readForEndedGroup);
    Assert.areEqual(1, command.calls.length);
    Assert.areEqual("", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_052));
    Assert.areEqual(
      "The module notes's program tool (process 900051): It was no longer running, and nothing showed that processes 900052 were what it started, so they were left running.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async killsTheGroupOfAGoneProgramThatHoldsAProcessStartedBeforeItWasLastSeenOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorEndingTests.LINUX.now();
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", 900_081, "tool", "/usr/bin/tool", "boot", now - 10_000, now - 10_000, now - 1_000);
    simulated.add(900_082, 900_081);
    simulated.add(900_083, 900_081);
    const command = new SystemCommandFixture([() => Promise.resolve(simulated.list(t => `${t} 900081 900081 ${t === 900_082 ? "00:05" : "00:00"}`))]);
    const processes = ProcessSupervisorEndingTests.createLinux(settings, command);

    await processes.cleanUpAsync();

    Assert.areEqual("-900081 SIGKILL", simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_082) || simulated.isAlive(900_083));
    Assert.areEqual(
      "The module notes's program tool (process 900081): An earlier runtime left processes 900082, 900083 running, so they were ended.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async killsTheWholeGroupOfALeftoverWhoseProgramStillRunsOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorEndingTests.LINUX.now();
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", 900_061, "tool", "/usr/bin/tool", "boot", now, now, now);
    simulated.add(900_061, 900_061);
    simulated.add(900_062, 900_061);
    const command = new SystemCommandFixture([() => Promise.resolve(simulated.list(t => `${t} 1 900061 00:00`))]);
    const processes = ProcessSupervisorEndingTests.createLinux(settings, command);

    await processes.cleanUpAsync();

    Assert.areEqual("-900061 SIGKILL", simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_061) || simulated.isAlive(900_062));
    Assert.areEqual("The module notes's program tool (process 900061): An earlier runtime left processes 900061, 900062 running, so they were ended.\n", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async removesTheRecordsOfAnotherBootWithoutReadingTheTableOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorEndingTests.LINUX.now();
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", 900_071, "tool", "/usr/bin/tool", "earlier boot", now, now, now);
    simulated.add(900_071, 900_071);
    const command = new SystemCommandFixture([]);
    const processes = ProcessSupervisorEndingTests.createLinux(settings, command);

    await processes.cleanUpAsync();

    Assert.areEqual(0, command.calls.length);
    Assert.areEqual("", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_071));
    Assert.areEqual("", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async closesAProgramsInputThenKillsWhatItStartedBeforeItExitedFromTheTopDownOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const program = await ProgramFixture.locateWindowsProgramAsync(folder.path);
    const environment: NodeJS.ProcessEnv = { SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT, psmodulepath: "C:\\Modules", TEAMRUN_KEPT: "kept" };
    let leader = 0;
    let started = 0;
    const command = new SystemCommandFixture([
      () => Promise.resolve([
        `${900_101}\t${leader}\t${started + 1}\t${program}`,
        `${900_102}\t${900_101}\t${started + 2}\t`,
        `${900_103}\t${leader}\t${started - ProcessSupervisorEndingTests.HOUR}\tC:\\old.exe`,
        `${900_104}\t${900_103}\t${started + 3}\tC:\\unrelated.exe`,
        `${900_105}\t${900_101}\t${started + 4}\tC:\\ended.exe`
      ].join("\r\n")),
      () => Promise.resolve([
        `${900_101}\t${leader}\t${started + 1}\t${program}`,
        `${900_106}\t${900_101}\t${started + 5}\tC:\\late.exe`,
        `${900_107}\t${900_101}\t${started + ProcessSupervisorEndingTests.HOUR}\tC:\\reused.exe`
      ].join("\n"))
    ]);
    const processes = ProcessSupervisorEndingTests.createWindows(settings, environment, command);
    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], undefined, program));
    leader = owned.processId;
    started = owned.started.getTime();
    simulated.own(leader);
    simulated.add(900_101, 0, true);
    simulated.add(900_102, 0);
    simulated.add(900_103, 0);
    simulated.add(900_104, 0);
    simulated.add(900_107, 0);
    await ProgramFixture.readLineAsync(owned);

    const exit = await owned.stopAsync();

    const script = Buffer.from(command.calls[0]?.at(-1) ?? "", "base64").toString("utf16le");
    Assert.isTrue(exit.isClean);
    Assert.areEqual(path.win32.join(ProcessSupervisorEndingTests.SYSTEM_ROOT, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), command.calls[0]?.[0]);
    Assert.areEqual("-NoProfile -NonInteractive -EncodedCommand", command.calls[0]?.slice(1, 4).join(" "));
    Assert.isTrue(script.includes("CimCmdlets\\Get-CimInstance -ClassName Win32_Process"), script);
    Assert.areEqual(JSON.stringify({ SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT, TEAMRUN_KEPT: "kept" }), JSON.stringify(command.environments[0]));
    Assert.areEqual(2, command.calls.length);
    Assert.areEqual("900101 SIGKILL,900102 SIGKILL,900105 SIGKILL,900106 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_103) && simulated.isAlive(900_104) && simulated.isAlive(900_107));
    Assert.areEqual(
      ProcessSupervisorEndingTests.line(owned, "It did not end within the grace period, so processes 900101, 900102, 900105, 900106 were ended forcefully.") +
      ProcessSupervisorEndingTests.line(owned, "Processes 900101 were still running after they were ended forcefully."),
      settings.diagnostics.text);
  }

  @TestMethod
  public async readsTheTableOnceForAProgramThatExitsWhenItsInputClosesAndLeftNothingOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const program = await ProgramFixture.locateWindowsProgramAsync(folder.path);
    const command = new SystemCommandFixture([""]);
    const processes = ProcessSupervisorEndingTests.createWindows(settings, { SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT }, command);
    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], undefined, program));
    simulated.own(owned.processId);
    await ProgramFixture.readLineAsync(owned);

    const exit = await owned.stopAsync();

    Assert.isTrue(exit.isClean);
    Assert.areEqual(1, command.calls.length);
    Assert.areEqual("", simulated.signals.join(","));
    Assert.areEqual("", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
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
      ""
    ]);
    const processes = ProcessSupervisorEndingTests.createWindows(settings, { SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT }, command);
    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.STUBBORN], undefined, program));
    leader = owned.processId;
    started = owned.started.getTime();
    simulated.own(leader);
    simulated.add(900_201, 0);
    await ProgramFixture.readLineAsync(owned);
    owned.input.end();

    const exit = await owned.stopAsync();

    Assert.isFalse(exit.isClean);
    Assert.areEqual(`${leader} SIGKILL,900201 SIGKILL`, simulated.signals.join(","));
    Assert.areEqual(ProcessSupervisorEndingTests.line(owned, `It did not end within the grace period, so processes ${leader}, 900201 were ended forcefully.`), settings.diagnostics.text);
  }

  @TestMethod
  public async killsWhatARunningProgramMissingFromTheTableStartedOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const program = await ProgramFixture.locateWindowsProgramAsync(folder.path);
    let leader = 0;
    let started = 0;
    const command = new SystemCommandFixture([() => Promise.resolve(`${900_211}\t${leader}\t${started + 1}\tC:\\child.exe`), ""]);
    const processes = ProcessSupervisorEndingTests.createWindows(settings, { SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT }, command);
    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.STUBBORN], undefined, program));
    leader = owned.processId;
    started = owned.started.getTime();
    simulated.own(leader);
    simulated.add(900_211, 0);
    await ProgramFixture.readLineAsync(owned);

    const stopping = owned.stopAsync();
    await ProcessSupervisorEndingTests.waitForAsync(() => settings.diagnostics.text.length > 0);
    const signals = simulated.signals.join(",");
    process.kill(leader, "SIGKILL");
    const exit = await stopping;

    Assert.isFalse(exit.isClean);
    Assert.areEqual("900211 SIGKILL", signals);
    Assert.areEqual(ProcessSupervisorEndingTests.line(owned, "It did not end within the grace period, so processes 900211 were ended forcefully."), settings.diagnostics.text);
  }

  @TestMethod
  public async endsOnlyTheLeftoversRunByTheirRecordedProgramOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorEndingTests.WINDOWS.now();
    const records: [number, string][] = [[900_301, "C:\\Tools\\Tool.EXE"], [900_302, "C:\\Tools\\tool.exe"], [900_305, "C:\\Tools\\tool.exe"], [900_306, "C:\\Tools\\tool.exe"]];
    for (const [processId, executable] of records) {
      settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", processId, "tool", executable, ProcessSupervisorEndingTests.WINDOWS.boot, now, now, now);
      simulated.add(processId, 0);
    }
    const command = new SystemCommandFixture([[
      `900301\t1\t${now}\tc:/tools/tool.exe`,
      `900302\t1\t${now}\t`,
      `900305\t1\t${now}\tC:\\Other\\tool.exe`,
      `900306\t1\t${now + ProcessSupervisorEndingTests.HOUR}\tC:\\Tools\\tool.exe`
    ].join("\n"), ""]);
    const processes = ProcessSupervisorEndingTests.createWindows(settings, { SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT }, command);

    await processes.cleanUpAsync();

    Assert.areEqual("900301 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_302) && simulated.isAlive(900_305) && simulated.isAlive(900_306));
    Assert.areEqual("The module notes's program tool (process 900301): An earlier runtime left processes 900301 running, so they were ended.\n", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async endsWhatAGoneProgramStartedBeforeItWasLastSeenAndNamesWhatItStartedLaterOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorEndingTests.WINDOWS.now();
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", 900_601, "tool", "C:\\Tools\\tool.exe", ProcessSupervisorEndingTests.WINDOWS.boot, now - 10_000, now - 10_000, now - 5_000);
    for (const processId of [900_602, 900_603, 900_604, 900_605])
      simulated.add(processId, 0);
    const command = new SystemCommandFixture([[
      `900602\t900601\t${now - 8_000}\tC:\\Tools\\child.exe`,
      `900603\t900602\t${now - 1_000}\tC:\\Tools\\grandchild.exe`,
      `900604\t900601\t${now - 4_999}\tC:\\Tools\\late.exe`,
      `900605\t900601\t${now - ProcessSupervisorEndingTests.HOUR}\tC:\\Windows\\explorer.exe`
    ].join("\n"), ""]);
    const processes = ProcessSupervisorEndingTests.createWindows(settings, { SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT }, command);

    await processes.cleanUpAsync();

    Assert.areEqual("900602 SIGKILL,900603 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_604) && simulated.isAlive(900_605));
    Assert.areEqual(
      "The module notes's program tool (process 900601): An earlier runtime left processes 900602, 900603 running, so they were ended.\n" +
      "The module notes's program tool (process 900601): It was no longer running, and nothing showed that processes 900604 were what it started, so they were left running.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async endsWhatAGoneProgramStartedOnlyUntilAnotherProcessTookItsIdOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorEndingTests.WINDOWS.now();
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", 900_701, "tool", "C:\\Tools\\tool.exe", ProcessSupervisorEndingTests.WINDOWS.boot, now - 10_000, now - 10_000, now - 3_000);
    for (const processId of [900_701, 900_702, 900_703, 900_704, 900_705])
      simulated.add(processId, 0);
    const command = new SystemCommandFixture([[
      `900701\t1\t${now - 5_000}\tC:\\Tools\\tool.exe`,
      `900702\t900701\t${now - 8_000}\tC:\\Tools\\child.exe`,
      `900703\t900701\t${now - 4_000}\tC:\\Tools\\child.exe`,
      `900704\t900701\t${now - 5_000}\tC:\\Other\\child.exe`,
      `900705\t900701\t${now - 1_000}\tC:\\Other\\child.exe`
    ].join("\n"), ""]);
    const processes = ProcessSupervisorEndingTests.createWindows(settings, { SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT }, command);

    await processes.cleanUpAsync();

    Assert.areEqual("900702 SIGKILL", simulated.signals.join(","));
    Assert.isTrue([900_701, 900_703, 900_704, 900_705].every(t => simulated.isAlive(t)));
    Assert.areEqual(
      "The module notes's program tool (process 900701): An earlier runtime left processes 900702 running, so they were ended.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async leavesAloneAnEarlierBootsProgramAndWhatAnEndedProgramsIdParentsOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const clock = ProcessSupervisorEndingTests.WINDOWS;
    const now = clock.now();
    const executable = "C:\\Tools\\tool.exe";
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", 900_501, "tool", executable, String(Number(clock.boot) - 86_400), now, now, now);
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", 900_502, "tool", executable, clock.boot, now, now, now);
    for (const processId of [900_501, 900_503, 900_504])
      simulated.add(processId, 0);
    const command = new SystemCommandFixture([[
      `900501\t1\t${now}\t${executable}`,
      `900503\t900502\t${now - ProcessSupervisorEndingTests.HOUR}\tC:\\Windows\\explorer.exe`,
      `900504\t900502\t${now + 1}\tC:\\Tools\\child.exe`
    ].join("\n")]);
    const processes = ProcessSupervisorEndingTests.createWindows(settings, { SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT }, command);

    await processes.cleanUpAsync();

    Assert.areEqual(1, command.calls.length);
    Assert.areEqual("", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_501) && simulated.isAlive(900_503) && simulated.isAlive(900_504));
    Assert.areEqual(
      "The module notes's program tool (process 900502): It was no longer running, and nothing showed that processes 900504 were what it started, so they were left running.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async keepsTheLeftoversItCannotListAndReportsWhyOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const clock = ProcessSupervisorEndingTests.WINDOWS;
    const now = clock.now();
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", 900_401, "tool", "C:\\tool.exe", clock.boot, now, now, now);
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "tasks", 900_402, "tool", "C:\\tool.exe", clock.boot, now, now, now);
    const missingRoot = ProcessSupervisorEndingTests.createWindows(settings, {}, new SystemCommandFixture([]));
    const unreadable = ProcessSupervisorEndingTests.createWindows(settings, { SystemRoot: "C:\\Windows" }, new SystemCommandFixture(["900401\tnot a row"]));

    await missingRoot.cleanUpAsync();
    const reported = settings.diagnostics.text;
    await unreadable.cleanUpAsync();

    Assert.isTrue(reported.startsWith("The module notes's program tool (process 900401): "), reported);
    Assert.isTrue(reported.includes("The module tasks's program tool (process 900402): "), reported);
    Assert.isTrue(reported.includes("SystemRoot is not set, so the Windows system tools cannot be found."), reported);
    Assert.isTrue(settings.diagnostics.text.includes("The process table has a row that could not be read: 900401\tnot a row"), settings.diagnostics.text);
    Assert.areEqual(2, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async forgetsAProgramThatExitsOnItsOwnOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const program = await ProgramFixture.locateWindowsProgramAsync(folder.path);
    const command = new SystemCommandFixture([]);
    const processes = ProcessSupervisorEndingTests.createWindows(settings, { SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT }, command);
    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "4"], undefined, program));

    const exit = await owned.exited;
    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);
    const stopped = await owned.stopAsync();

    Assert.areEqual(4, exit.code);
    Assert.areEqual(exit, stopped);
    Assert.areEqual(0, command.calls.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  private static line(owned: OwnedProcess, text: string): string {
    return `The module notes's program ${owned.program} (process ${owned.processId}): ${text}\n`;
  }

  private static endsTheTree(text: string, owned: OwnedProcess, before: string, after: string): boolean {
    const start = ProcessSupervisorEndingTests.line(owned, `${before} `).slice(0, -1);
    const end = ` ${after}\n`;
    if (!text.startsWith(start) || !text.endsWith(end))
      return false;
    const ended = text.slice(start.length, -end.length).split(", ");
    return ended.includes(String(owned.processId)) && ended.every(t => /^[1-9]\d*$/.test(t));
  }

  private static async waitForAsync(condition: () => boolean): Promise<void> {
    const deadline = Date.now() + 5_000;
    while (!condition()) {
      if (Date.now() >= deadline)
        throw new Error("The condition did not hold within 5 seconds.");
      await new Promise(t => setTimeout(t, 25));
    }
  }

  private static async spawnAsync(): Promise<ChildProcess> {
    const other = spawn(process.execPath, [ProgramFixture.file, ProgramFixture.FOREVER], { stdio: "ignore", detached: process.platform !== "win32", windowsHide: true });
    await once(other, "spawn");
    return other;
  }

  private static async endAsync(other: ChildProcess): Promise<void> {
    const exited = once(other, "exit");
    other.kill("SIGKILL");
    await exited;
  }

  private static createLinux(settings: SettingsFixture, command: SystemCommand): ProcessSupervisor {
    return ProcessSupervisorEndingTests.create(settings, "linux", process.env, command, ProcessSupervisorEndingTests.LINUX);
  }

  private static createWindows(settings: SettingsFixture, environment: NodeJS.ProcessEnv, command: SystemCommand): ProcessSupervisor {
    return ProcessSupervisorEndingTests.create(settings, "win32", environment, command, ProcessSupervisorEndingTests.WINDOWS);
  }

  private static createSeeing(settings: SettingsFixture): ProcessSupervisor {
    return new ProcessSupervisor(settings.database, process.platform, process.env, new SystemCommand(), settings.diagnostics, new ProcessSettings(300, 500, 20));
  }

  private static create(
    settings: SettingsFixture,
    platform: string = process.platform,
    environment: NodeJS.ProcessEnv = process.env,
    command: SystemCommand = new SystemCommand(),
    clock: ProcessClock = ProcessClock.create(process.platform)): ProcessSupervisor {
    return new ProcessSupervisor(settings.database, platform, environment, command, settings.diagnostics, new ProcessSettings(300, 500), clock);
  }
}
