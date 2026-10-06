/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";

import "@noldova/teamrun-foundation-core";
import { Assert, Wait } from "@noldova/teamrun-foundation-testing";
import { type OwnedProcess, ProcessClock, ProcessSettings, ProcessSupervisor, SystemCommand } from "@noldova/teamrun-shell-runtime";

import { ProcessClockFixture } from "./process-clock.fixture.js";
import { ProgramFixture } from "./program.fixture.js";
import type { SettingsFixture } from "./settings.fixture.js";
import { SystemCommandFixture } from "./system-command.fixture.js";
import type { WindowsProcessApiFixture } from "./windows-process-api.fixture.js";

export class ProcessSupervisorFixture {
  public static readonly MODULE: string = "notes";
  public static readonly RECORDS: string = "SELECT module, program, process_id FROM owned_processes";
  public static readonly INSERT: string =
    "INSERT INTO owned_processes (module, process_id, program, executable, boot, requested, started, seen, clock_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
  public static readonly SEEN: string = "SELECT started, seen FROM owned_processes";
  public static readonly HOUR: number = 3_600_000;
  public static readonly SYSTEM_ROOT: string = process.env["SystemRoot"] ?? "C:\\Windows";
  public static readonly LINUX: ProcessClock = new ProcessClockFixture(24 * ProcessSupervisorFixture.HOUR, "boot", true);
  public static readonly WINDOWS: ProcessClock = ProcessClock.create("win32");

  public static readStarted(settings: SettingsFixture): number {
    return Number(settings.database.read("SELECT started FROM owned_processes")?.["started"]);
  }

  public static line(owned: OwnedProcess, text: string): string {
    return `The module notes's program ${owned.program} (process ${owned.processId}): ${text}\n`;
  }

  public static endsTheTree(text: string, owned: OwnedProcess, before: string, after: string): boolean {
    const start = ProcessSupervisorFixture.line(owned, `${before} `).slice(0, -1);
    const end = ` ${after}\n`;
    if (!text.startsWith(start) || !text.endsWith(end))
      return false;
    const ended = text.slice(start.length, -end.length).split(", ");
    return ended.includes(String(owned.processId)) && ended.every(t => /^[1-9]\d*$/.test(t));
  }

  public static async waitForAsync(condition: () => boolean): Promise<void> {
    Assert.isTrue(await Wait.untilAsync(condition, 5_000), "The condition did not hold within 5 seconds.");
  }

  public static async spawnAsync(): Promise<ChildProcess> {
    const other = spawn(process.execPath, [ProgramFixture.file, ProgramFixture.FOREVER], { stdio: "ignore", detached: process.platform !== "win32", windowsHide: true });
    await once(other, "spawn");
    return other;
  }

  public static async endAsync(other: ChildProcess): Promise<void> {
    const exited = once(other, "exit");
    other.kill("SIGKILL");
    await exited;
  }

  public static createLinux(settings: SettingsFixture, command: SystemCommand): ProcessSupervisor {
    return ProcessSupervisorFixture.create(settings, "linux", process.env, command, ProcessSupervisorFixture.LINUX);
  }

  public static createWindows(settings: SettingsFixture, windows: WindowsProcessApiFixture, command: SystemCommand = new SystemCommandFixture([])): ProcessSupervisor {
    return ProcessSupervisorFixture.create(settings, "win32", { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, command, ProcessSupervisorFixture.WINDOWS, windows);
  }

  public static createSeeing(settings: SettingsFixture): ProcessSupervisor {
    return new ProcessSupervisor(settings.database, process.platform, process.env, new SystemCommand(), settings.diagnostics, new ProcessSettings(300, 500, 20));
  }

  public static create(
    settings: SettingsFixture,
    platform: string = process.platform,
    environment: NodeJS.ProcessEnv = process.env,
    command: SystemCommand = new SystemCommand(),
    clock: ProcessClock = ProcessClock.create(process.platform),
    windows?: WindowsProcessApiFixture): ProcessSupervisor {
    return new ProcessSupervisor(settings.database, platform, environment, command, settings.diagnostics, new ProcessSettings(300, 500), clock, windows);
  }
}
