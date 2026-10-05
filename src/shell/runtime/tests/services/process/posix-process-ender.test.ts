/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../../fixtures/simulated-processes.fixture.js";
import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class PosixProcessEnderTests {
  @TestMethod
  @PlatformFixture.posixOnly()
  public async endsTheRestOfAProgramsGroupWhenItExitsWithAnError(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.PARENT, "3"]));
    const child = Number(await ProgramFixture.readLineAsync(owned));

    const exit = await owned.exited;
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(3, exit.code);
    Assert.isTrue(await ProgramFixture.waitForEndAsync(child, 1_000));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async endsTheGroupAProgramLeftAfterACleanExitWhileAProcessItHeldStillRunsInItOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const rows = (): Promise<string> => Promise.resolve(simulated.list(t => `${t} 1 ${leader} 00:00`));
    const command = new SystemCommandFixture([rows, rows]);
    const processes = ProcessSupervisorFixture.createLinux(settings, command);

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    leader = owned.processId;
    simulated.add(900_011, leader);
    await owned.exited;
    await ProcessSupervisorFixture.waitForAsync(() => processes.programs.some(t => t.hasExited));
    const listed = processes.programs.map(t => `${t.moduleId} ${t.program} ${t.processId} ${t.started.getTime()} ${t.hasExited}`);
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(`notes ${owned.program} ${leader} ${owned.started.getTime()} true`, listed.join(","));
    Assert.areEqual(`-${leader} SIGTERM`, simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_011));
    Assert.areEqual(2, command.calls.length);
    Assert.areEqual("", settings.diagnostics.text);
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async leavesAGroupWhoseProcessesItCanNoLongerRecogniseAfterACleanExitAndNamesThemOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const rows = (): Promise<string> => Promise.resolve(simulated.list(t => `${t} 1 ${leader} 00:00`));
    const processes = ProcessSupervisorFixture.createLinux(settings, new SystemCommandFixture([rows, rows]));

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    leader = owned.processId;
    simulated.add(900_012, leader);
    await owned.exited;
    await ProcessSupervisorFixture.waitForAsync(() => processes.programs.some(t => t.hasExited));
    simulated.remove(900_012);
    simulated.add(900_013, leader);
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual("", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_013));
    Assert.areEqual(
      ProcessSupervisorFixture.line(owned, "It was no longer running, and nothing showed that processes 900013 were what it started, so they were left running."),
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async keepsTheRecordOfAGroupItCouldNotSignalAndEndsTheOthersOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const rows = (): Promise<string> => Promise.resolve(simulated.list(t => `${t} 1 ${leader} 00:00`));
    const processes = ProcessSupervisorFixture.createLinux(settings, new SystemCommandFixture([rows, rows]));
    const clean = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    leader = clean.processId;
    simulated.add(900_021, leader);
    await clean.exited;
    await ProcessSupervisorFixture.waitForAsync(() => processes.programs.some(t => t.hasExited));
    const running = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    simulated.own(running.processId);
    await ProgramFixture.readLineAsync(running);
    simulated.fail(-running.processId, "SIGTERM", "denied");

    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    running.input.end();
    await running.exited;

    Assert.areEqual(`-${running.processId} SIGTERM,-${clean.processId} SIGTERM`, simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_021));
    Assert.areEqual(ProcessSupervisorFixture.line(running, "'denied'"), settings.diagnostics.text);
    Assert.areEqual(String(running.processId), settings.database.readAll(ProcessSupervisorFixture.RECORDS).map(t => t["process_id"]).join(","));
  }

  @TestMethod
  public async killsTheOtherGroupsWhenOneCannotBeKilledOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    for (const processId of [900_091, 900_095]) {
      settings.database.run(ProcessSupervisorFixture.INSERT, "notes", processId, "tool", "/usr/bin/tool", "boot", now, now, now, 0);
      simulated.add(processId, processId);
    }
    simulated.fail(-900_091, "SIGKILL", "denied");
    const command = new SystemCommandFixture([() => Promise.resolve(simulated.list(t => `${t} 1 ${t} 00:00`))]);
    const processes = ProcessSupervisorFixture.createLinux(settings, command);

    await processes.cleanUpAsync();

    Assert.areEqual("-900091 SIGKILL,-900095 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_091));
    Assert.isFalse(simulated.isAlive(900_095));
    Assert.areEqual(
      "The module notes's program tool (process 900095): An earlier runtime left processes 900095 running, so they were ended.\n" +
      "The module notes's program tool (process 900091): 'denied'\n",
      settings.diagnostics.text);
    Assert.areEqual("900091", settings.database.readAll(ProcessSupervisorFixture.RECORDS).map(t => t["process_id"]).join(","));
  }

  @TestMethod
  public async forgetsAGroupThatEndedWithItsLeaderAndStopsARunningOneWithoutTheTableOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const command = new SystemCommandFixture([]);
    const processes = ProcessSupervisorFixture.createLinux(settings, command);
    const ended = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "2"]));
    await ended.exited;
    const running = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    simulated.own(running.processId);
    await ProgramFixture.readLineAsync(running);

    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    await running.exited;

    Assert.areEqual(`-${running.processId} SIGTERM`, simulated.signals.join(","));
    Assert.areEqual(0, command.calls.length);
    Assert.areEqual("", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async leavesAloneAGroupWhoseLeadersIdWasReusedOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_041, "tool", "/usr/bin/tool", "boot", now, now, now, 0);
    simulated.add(900_041, 900_041);
    simulated.add(900_042, 900_041);
    const command = new SystemCommandFixture([() => Promise.resolve(simulated.list(t => `${t} 1 900041 1-00:00:00`))]);
    const processes = ProcessSupervisorFixture.createLinux(settings, command);

    await processes.cleanUpAsync();

    Assert.areEqual(1, command.calls.length);
    Assert.areEqual("", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_041) && simulated.isAlive(900_042));
    Assert.areEqual("", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async leavesTheGroupOfAGoneProgramThatHoldsNoProcessStartedBeforeItWasLastSeenAndNamesItsProcessesOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    const command = new SystemCommandFixture([() => Promise.resolve(simulated.list(t => `${t} 1 900051 00:00`))]);
    const processes = ProcessSupervisorFixture.createLinux(settings, command);
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_058, "tool", "/usr/bin/tool", "boot", now, now, now, 0);

    await processes.cleanUpAsync();
    const readForEndedGroup = command.calls.length;
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_051, "tool", "/usr/bin/tool", "boot", now - 2_000, now - 2_000, now - 1_000, 0);
    simulated.add(900_052, 900_051);
    await processes.cleanUpAsync();

    Assert.areEqual(0, readForEndedGroup);
    Assert.areEqual(1, command.calls.length);
    Assert.areEqual("", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_052));
    Assert.areEqual(
      "The module notes's program tool (process 900051): It was no longer running, and nothing showed that processes 900052 were what it started, so they were left running.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async killsTheGroupOfAGoneProgramThatHoldsAProcessStartedBeforeItWasLastSeenOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_081, "tool", "/usr/bin/tool", "boot", now - 10_000, now - 10_000, now - 1_000, 0);
    simulated.add(900_082, 900_081);
    simulated.add(900_083, 900_081);
    const command = new SystemCommandFixture([() => Promise.resolve(simulated.list(t => `${t} 900081 900081 ${t === 900_082 ? "00:05" : "00:00"}`))]);
    const processes = ProcessSupervisorFixture.createLinux(settings, command);

    await processes.cleanUpAsync();

    Assert.areEqual("-900081 SIGKILL", simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_082) || simulated.isAlive(900_083));
    Assert.areEqual(
      "The module notes's program tool (process 900081): An earlier runtime left processes 900082, 900083 running, so they were ended.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async killsTheWholeGroupOfALeftoverWhoseProgramStillRunsOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_061, "tool", "/usr/bin/tool", "boot", now, now, now, 0);
    simulated.add(900_061, 900_061);
    simulated.add(900_062, 900_061);
    const command = new SystemCommandFixture([() => Promise.resolve(simulated.list(t => `${t} 1 900061 00:00`))]);
    const processes = ProcessSupervisorFixture.createLinux(settings, command);

    await processes.cleanUpAsync();

    Assert.areEqual("-900061 SIGKILL", simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_061) || simulated.isAlive(900_062));
    Assert.areEqual("The module notes's program tool (process 900061): An earlier runtime left processes 900061, 900062 running, so they were ended.\n", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async removesTheRecordsOfAnotherBootWithoutReadingTheTableOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_071, "tool", "/usr/bin/tool", "earlier boot", now, now, now, 0);
    simulated.add(900_071, 900_071);
    const command = new SystemCommandFixture([]);
    const processes = ProcessSupervisorFixture.createLinux(settings, command);

    await processes.cleanUpAsync();

    Assert.areEqual(0, command.calls.length);
    Assert.areEqual("", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_071));
    Assert.areEqual("", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }
}
