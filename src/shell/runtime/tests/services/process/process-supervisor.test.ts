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
import { DataDirectory, OwnershipLock, ProcessStartException, ProcessSupervisor, ShellDatabase, ShellMigrations, SystemCommand } from "@noldova/teamrun-shell-runtime";

import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class ProcessSupervisorTests {
  @TestMethod
  public async reportsAProgramThatCannotStartAndRecordsNothing(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);

    const missingFolder = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(path.join(folder.path, "missing"), [ProgramFixture.WAIT])),
      ProcessStartException);
    const invalidArgument = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, ["nul\0"])),
      ProcessStartException);

    Assert.areEqual(`${process.execPath} could not be started.`, missingFolder.message);
    Assert.areEqual("ENOENT", (missingFolder.cause as { code: string }).code);
    Assert.areEqual(`${process.execPath} could not be started.`, invalidArgument.message);
    Assert.areEqual("ERR_INVALID_ARG_VALUE", (invalidArgument.cause as { code: string }).code);
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async reportsEachStartAndStopOnceWithAGrowingSequenceUntilItsListenerIsDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const changes: string[] = [];
    const watching = processes.onChanged(() => changes.push(`${processes.status.sequence}:${processes.status.programs.map(t => `${t.moduleId} ${t.hasExited}`).join(",")}`));

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await ProgramFixture.readLineAsync(owned);
    const listed = processes.status;
    await owned.stopAsync();
    watching[Symbol.dispose]();
    const later = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    await later.exited;

    Assert.areEqual("1:notes false|2:", changes.join("|"));
    Assert.areEqual(`1 ${owned.processId} ${process.execPath}`, [listed.sequence, ...listed.programs.map(t => `${t.processId} ${t.program}`)].join(" "));
    Assert.areEqual(4, processes.status.sequence);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async reportsACleanExitThatLeavesItsGroupAndTheGroupsEndAsSeparateChanges(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const changes: string[] = [];
    processes.onChanged(() => changes.push(`${processes.status.sequence}:${processes.status.programs.map(t => `${t.processId} ${t.hasExited}`).join(",")}`));

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.PARENT, "0"]));
    await ProgramFixture.readLineAsync(owned);
    await owned.exited;
    await ProcessSupervisorFixture.waitForAsync(() => changes.length === 2);
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(`1:${owned.processId} false|2:${owned.processId} true|3:`, changes.join("|"));
  }

  @TestMethod
  public async startsNoProgramWhilePausedAndListsItsProgramsForAnUpdate(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));

    processes.pause();
    const refused = await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT])), ProcessStartException);
    const listed = processes.updateProcesses;
    processes.resume();
    const resumed = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(`${process.execPath} was not started for the module notes, because the runtime is preparing for an update.`, refused.message);
    Assert.areEqual(`${owned.processId} program`, listed.map(t => `${t.processId} ${t.role}`).join(","));
    Assert.isTrue(listed.every(t => t.earliest <= t.latest));
    Assert.areNotEqual(owned.processId, resumed.processId);
  }

  @TestMethod
  public async endsAProgramItCannotRecord(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    database.close();
    const processes = new ProcessSupervisor(database, process.platform, process.env, new SystemCommand(), new TextOutputFixture());

    const failure = await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT])), Error);

    Assert.isFalse(failure instanceof ProcessStartException);
    Assert.areEqual(0, processes.programs.length);
  }

  @TestMethod
  public async refusesARequestWhoseSignalHasAlreadyAborted(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);

    const failure = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], AbortSignal.abort())),
      Error);

    Assert.areEqual("AbortError", failure.name);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async stopsAProgramWhenItsSignalAbortsWhileItRunsOrStarts(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const running = new AbortController();
    const starting = new AbortController();

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], running.signal));
    const ready = await ProgramFixture.readLineAsync(owned);
    running.abort();
    await owned.exited;
    const pending = processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], starting.signal));
    starting.abort();
    const aborted = await pending;
    await aborted.exited;
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(ProgramFixture.READY, ready);
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async endsWhatAnEarlierRuntimeLeftRunningWhenItCleansUp(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const earlier = ProcessSupervisorFixture.create(settings);
    const owned = await earlier.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await ProgramFixture.readLineAsync(owned);
    const later = ProcessSupervisorFixture.create(settings);

    await later.cleanUpAsync();
    await owned.exited;
    await earlier.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    await later.cleanUpAsync();

    Assert.isTrue(
      ProcessSupervisorFixture.endsTheTree(settings.diagnostics.text, owned, "An earlier runtime left processes", "running, so they were ended."),
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async refusesAModulesStartsOnceItsProgramsBeginToEndAndEveryStartOnceAllDo(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const notes = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    const tasks = await processes.startAsync("tasks", ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await ProgramFixture.readLineAsync(notes);
    await ProgramFixture.readLineAsync(tasks);

    const stopping = processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    const refused = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT])),
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
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }
}
