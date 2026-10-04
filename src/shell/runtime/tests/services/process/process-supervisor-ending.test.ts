/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { type OwnedProcess, ProcessSettings, ProcessSupervisor, SystemCommand } from "@noldova/teamrun-shell-runtime";

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
  private static readonly INSERT: string = "INSERT INTO owned_processes (module, process_id, program, executable, requested, started) VALUES (?, ?, ?, ?, ?, ?)";
  private static readonly HOUR: number = 3_600_000;
  private static readonly SYSTEM_ROOT: string = process.env["SystemRoot"] ?? "C:\\Windows";

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
      ProcessSupervisorEndingTests.endsTheTree(settings.diagnostics.text, owned, "An earlier runtime left it running, so processes", "were ended."),
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async leavesAloneAProcessWhoseIdWasReusedWhenItCleansUp(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const other = spawn(process.execPath, [ProgramFixture.file, ProgramFixture.FOREVER], { stdio: "ignore", detached: process.platform !== "win32", windowsHide: true });
    try {
      await once(other, "spawn");
      const processId = Number(other.pid);
      const now = Date.now();
      settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", processId, process.execPath, process.execPath, now - ProcessSupervisorEndingTests.HOUR, now - ProcessSupervisorEndingTests.HOUR);
      if (process.platform === "win32")
        settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", processId, "other.exe", path.join(ProcessSupervisorEndingTests.SYSTEM_ROOT, "other.exe"), now, now);
      const processes = ProcessSupervisorEndingTests.create(settings);

      await processes.cleanUpAsync();

      Assert.isTrue(ProgramFixture.isRunning(processId));
      Assert.areEqual("", settings.diagnostics.text);
      Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
    }
    finally {
      const exited = once(other, "exit");
      other.kill("SIGKILL");
      await exited;
    }
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
    await new Promise(t => setTimeout(t, 100));
    const keptAfterExit = ProgramFixture.isRunning(child);
    const recordedAfterExit = settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length;
    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);

    Assert.isTrue(keptAfterExit);
    Assert.areEqual(1, recordedAfterExit);
    Assert.isFalse(ProgramFixture.isRunning(child));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
    Assert.areEqual("", settings.diagnostics.text);
  }

  @TestMethod
  public async killsTheGroupMembersThatOutlastAnErrorExitAndReportsThoseThatStayOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const rows = (): Promise<string> => Promise.resolve([
      simulated.list(t => `  ${t} ${leader} ${leader} 00:00`),
      `${leader + 1} 1 ${leader} 1-00:00:00`,
      `${leader + 2} 1 ${leader} 01:02:03`,
      "",
      `${leader + 3} 1 1 00:01`
    ].join("\n"));
    const processes = ProcessSupervisorEndingTests.create(settings, "linux", process.env, new SystemCommandFixture([rows, rows]));

    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "2"]));
    leader = owned.processId;
    simulated.add(900_001, leader, true);
    await owned.exited;
    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);

    Assert.areEqual("900001 SIGTERM,900001 SIGKILL", simulated.signals.join(","));
    Assert.areEqual(
      ProcessSupervisorEndingTests.line(owned, "It did not end within the grace period, so processes 900001 were ended forcefully.") +
      ProcessSupervisorEndingTests.line(owned, "Processes 900001 were still running after they were ended forcefully."),
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async keepsAGroupItCouldNotReadAndEndsItWhenItsModuleStopsOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const command = new SystemCommandFixture([
      () => Promise.resolve("not a row"),
      () => Promise.resolve(simulated.list(t => `${t} ${leader} ${leader} 00:00`))
    ]);
    const processes = ProcessSupervisorEndingTests.create(settings, "linux", process.env, command);

    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "2"]));
    leader = owned.processId;
    simulated.add(900_011, leader);
    await owned.exited;
    await processes.stopOwnedByAsync("other");
    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);
    const readFailure = settings.diagnostics.text;
    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);

    Assert.isTrue(readFailure.startsWith(ProcessSupervisorEndingTests.line(owned, "").trimEnd()), readFailure);
    Assert.isTrue(readFailure.includes("The process table has a row that could not be read: not a row"), readFailure);
    Assert.areEqual("900011 SIGTERM", simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_011));
    Assert.areEqual(readFailure, settings.diagnostics.text);
    Assert.areEqual(2, command.calls.length);
    Assert.areEqual("/bin/ps -A -o pid=,ppid=,pgid=,etime=", command.calls[0]?.join(" "));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async stopsARunningGroupAndALeftoverTogetherAndKeepsTheirRecordsWhenSignalsFailOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const rows = (): Promise<string> => Promise.resolve(simulated.list(t => `${t} 1 ${leader} 00:00`));
    const processes = ProcessSupervisorEndingTests.create(settings, "linux", process.env, new SystemCommandFixture([rows, rows]));
    const clean = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    leader = clean.processId;
    simulated.add(900_021, leader, true);
    simulated.fail(900_021, 0, Object.assign(new Error("kill EPERM"), { code: "EPERM" }));
    await clean.exited;
    const running = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    simulated.own(running.processId);
    await ProgramFixture.readLineAsync(running);
    simulated.fail(900_021, "SIGKILL", "denied");

    await processes.stopOwnedByAsync(ProcessSupervisorEndingTests.MODULE);
    await running.exited;

    Assert.areEqual(`-${running.processId} SIGTERM,900021 SIGTERM,900021 SIGKILL`, simulated.signals.join(","));
    Assert.isTrue(settings.diagnostics.text.includes(ProcessSupervisorEndingTests.line(running, "'denied'")), settings.diagnostics.text);
    Assert.isTrue(settings.diagnostics.text.includes(ProcessSupervisorEndingTests.line(clean, "'denied'")), settings.diagnostics.text);
    Assert.areEqual(2, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async treatsAProcessItCannotProbeAsRunningOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = Date.now();
    simulated.fail(-900_031, 0, "unknown");
    simulated.fail(-900_032, 0, new Error("no code"));
    simulated.fail(-900_033, 0, Object.assign(new Error("kill EINVAL"), { code: "EINVAL" }));
    const command = new SystemCommandFixture(["", "", ""]);
    const processes = ProcessSupervisorEndingTests.create(settings, "linux", process.env, command);

    for (const processId of [900_031, 900_032, 900_033]) {
      settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", processId, "tool", "/usr/bin/tool", now, now);
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
    const processes = ProcessSupervisorEndingTests.create(settings, "linux", process.env, command);
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
    const now = Date.now();
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", 900_041, "tool", "/usr/bin/tool", now, now);
    simulated.add(900_041, 900_041);
    simulated.add(900_042, 900_041);
    const command = new SystemCommandFixture([() => Promise.resolve(simulated.list(t => `${t} 1 900041 1-00:00:00`))]);
    const processes = ProcessSupervisorEndingTests.create(settings, "linux", process.env, command);

    await processes.cleanUpAsync();

    Assert.areEqual(1, command.calls.length);
    Assert.areEqual("", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_041) && simulated.isAlive(900_042));
    Assert.areEqual("", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async closesAProgramsInputThenKillsItsTreeFromTheProcessTableOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const program = await ProgramFixture.locateWindowsProgramAsync(folder.path);
    const environment: NodeJS.ProcessEnv = { SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT, psmodulepath: "C:\\Modules", TEAMRUN_KEPT: "kept" };
    let leader = 0;
    let started = 0;
    const command = new SystemCommandFixture([() => Promise.resolve([
      `${900_101}\t${leader}\t${started + 10}\t${program}`,
      `${900_102}\t${900_101}\t${started + 20}\t`,
      `${900_103}\t${leader}\t${started - ProcessSupervisorEndingTests.HOUR}\tC:\\old.exe`,
      `${900_104}\t${900_103}\t${started + 30}\tC:\\unrelated.exe`,
      `${900_105}\t${900_101}\t${started + 40}\tC:\\ended.exe`
    ].join("\r\n"))]);
    const processes = ProcessSupervisorEndingTests.create(settings, "win32", environment, command);
    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], undefined, program));
    leader = owned.processId;
    started = owned.started.getTime();
    simulated.own(leader);
    simulated.add(900_101, 0, true);
    simulated.add(900_102, 0);
    simulated.add(900_103, 0);
    simulated.add(900_104, 0);
    await ProgramFixture.readLineAsync(owned);

    const exit = await owned.stopAsync();

    const script = Buffer.from(command.calls[0]?.at(-1) ?? "", "base64").toString("utf16le");
    Assert.isTrue(exit.isClean);
    Assert.areEqual(path.win32.join(ProcessSupervisorEndingTests.SYSTEM_ROOT, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), command.calls[0]?.[0]);
    Assert.areEqual("-NoProfile -NonInteractive -EncodedCommand", command.calls[0]?.slice(1, 4).join(" "));
    Assert.isTrue(script.includes("CimCmdlets\\Get-CimInstance -ClassName Win32_Process"), script);
    Assert.areEqual(JSON.stringify({ SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT, TEAMRUN_KEPT: "kept" }), JSON.stringify(command.environments[0]));
    Assert.areEqual("900105 SIGKILL,900102 SIGKILL,900101 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_103) && simulated.isAlive(900_104));
    Assert.areEqual(
      ProcessSupervisorEndingTests.line(owned, "It did not end within the grace period, so processes 900105, 900102, 900101 were ended forcefully.") +
      ProcessSupervisorEndingTests.line(owned, "Processes 900101 were still running after they were ended forcefully."),
      settings.diagnostics.text);
  }

  @TestMethod
  public async killsAProgramThatKeepsRunningAfterItsInputClosesOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const program = await ProgramFixture.locateWindowsProgramAsync(folder.path);
    let leader = 0;
    let started = 0;
    const command = new SystemCommandFixture([() => Promise.resolve([
      `${leader}\t900201\t${started}\t${program}`,
      `${900_201}\t${leader}\t${started}\t${program}`
    ].join("\n"))]);
    const processes = ProcessSupervisorEndingTests.create(settings, "win32", { SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT }, command);
    const owned = await processes.startAsync(ProcessSupervisorEndingTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.STUBBORN], undefined, program));
    leader = owned.processId;
    started = owned.started.getTime();
    simulated.own(leader);
    simulated.add(900_201, 0);
    await ProgramFixture.readLineAsync(owned);
    owned.input.end();

    const exit = await owned.stopAsync();

    Assert.isFalse(exit.isClean);
    Assert.areEqual(`900201 SIGKILL,${leader} SIGKILL`, simulated.signals.join(","));
    Assert.areEqual(ProcessSupervisorEndingTests.line(owned, `It did not end within the grace period, so processes 900201, ${leader} were ended forcefully.`), settings.diagnostics.text);
  }

  @TestMethod
  public async endsTheLeftoversRunByTheirRecordedProgramOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = Date.now();
    const records: [number, string][] = [[900_301, "C:\\Tools\\Tool.EXE"], [900_302, "C:\\Tools\\tool.exe"], [900_303, "C:\\Tools\\tool.exe"], [900_305, "C:\\Tools\\tool.exe"], [900_306, "C:\\Tools\\tool.exe"]];
    for (const [processId, executable] of records) {
      settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", processId, "tool", executable, now, now);
      simulated.add(processId, 0);
    }
    simulated.add(900_304, 0);
    const command = new SystemCommandFixture([[
      `900301\t1\t${now}\tc:/tools/tool.exe`,
      `900302\t1\t${now}\t`,
      `900304\t900303\t${now}\tC:\\Tools\\child.exe`,
      `900305\t1\t${now}\tC:\\Other\\tool.exe`,
      `900306\t1\t${now + ProcessSupervisorEndingTests.HOUR}\tC:\\Tools\\tool.exe`
    ].join("\n")]);
    const processes = ProcessSupervisorEndingTests.create(settings, "win32", { SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT }, command);

    await processes.cleanUpAsync();

    Assert.areEqual("900301 SIGKILL,900304 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_302) && simulated.isAlive(900_305) && simulated.isAlive(900_306));
    Assert.areEqual(
      "The module notes's program tool (process 900301): An earlier runtime left it running, so processes 900301 were ended.\n" +
      "The module notes's program tool (process 900303): An earlier runtime left it running, so processes 900304 were ended.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorEndingTests.RECORDS).length);
  }

  @TestMethod
  public async keepsTheLeftoversItCannotListAndReportsWhyOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const now = Date.now();
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "notes", 900_401, "tool", "C:\\tool.exe", now, now);
    settings.database.run(ProcessSupervisorEndingTests.INSERT, "tasks", 900_402, "tool", "C:\\tool.exe", now, now);
    const missingRoot = ProcessSupervisorEndingTests.create(settings, "win32", {}, new SystemCommandFixture([]));
    const unreadable = ProcessSupervisorEndingTests.create(settings, "win32", { SystemRoot: "C:\\Windows" }, new SystemCommandFixture(["900401\tnot a row"]));

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
    const processes = ProcessSupervisorEndingTests.create(settings, "win32", { SystemRoot: ProcessSupervisorEndingTests.SYSTEM_ROOT }, command);
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
    return ended.at(-1) === String(owned.processId) && ended.every(t => /^[1-9]\d*$/.test(t));
  }

  private static create(
    settings: SettingsFixture,
    platform: string = process.platform,
    environment: NodeJS.ProcessEnv = process.env,
    command: SystemCommand = new SystemCommand()): ProcessSupervisor {
    return new ProcessSupervisor(settings.database, platform, environment, command, settings.diagnostics, new ProcessSettings(300, 500));
  }
}
