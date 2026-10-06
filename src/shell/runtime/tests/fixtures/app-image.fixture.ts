/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Wait } from "@noldova/teamrun-foundation-testing";

import { ProgramFixture } from "./program.fixture.js";

export class AppImageRun {
  public readonly exitCode: number | null;
  public readonly signal: NodeJS.Signals | null;
  public readonly error: string;

  public constructor(exitCode: number | null, signal: NodeJS.Signals | null, error: string) {
    this.exitCode = exitCode;
    this.signal = signal;
    this.error = error;
  }
}

export class AppImageFixture implements AsyncDisposable {
  private static readonly IMAGE: string = [
    "#!/bin/bash",
    "here=${0%/*}",
    "case $1 in",
    "  --appimage-mount)",
    "    if [[ -e $here/refuse-mount ]]; then exit 1; fi",
    "    mount=$here/mount-$$",
    "    cp -R -- \"$here/payload\" \"$mount\"",
    "    trap 'rm -rf -- \"$mount\"; exit 0' TERM",
    "    echo \"$mount\"",
    "    while :; do sleep 0.05; done",
    "    ;;",
    "  --appimage-extract)",
    "    if [[ -e $here/refuse-extract ]]; then exit 1; fi",
    "    cp -R -- \"$here/payload\" squashfs-root",
    "    ;;",
    "esac",
    ""
  ].join("\n");
  private static readonly PROGRAM: string = [
    "#!/bin/bash",
    "printf '%s|' \"$0\" \"$@\" \"$APPDIR\" > \"$TEAMRUN_FIXTURE_RECORD\"",
    "if [[ $1 == wait ]]; then",
    "  trap 'exit 143' TERM",
    "  : > \"$TEAMRUN_FIXTURE_RECORD.started\"",
    "  while :; do sleep 0.05; done",
    "fi",
    "exit \"${TEAMRUN_FIXTURE_EXIT:-0}\"",
    ""
  ].join("\n");
  private static readonly EXECUTABLE_MODE: number = 0o755;
  private static readonly WAIT_LIMIT: number = 10_000;

  public readonly folder: string;
  private readonly mounters: number[] = [];

  private constructor(folder: string) {
    this.folder = folder;
  }

  public get image(): string {
    return path.join(this.folder, "fixture.AppImage");
  }

  public get root(): string {
    return path.join(this.folder, "client");
  }

  public get program(): string {
    return path.join(this.root, "teamrun");
  }

  public get record(): string {
    return path.join(this.folder, "record");
  }

  public get temporary(): string {
    return path.join(this.folder, "temporary");
  }

  public static async createAsync(): Promise<AppImageFixture> {
    const fixture = new AppImageFixture(await mkdtemp(path.join(tmpdir(), "tr-app-image-")));
    await mkdir(path.join(fixture.folder, "payload"), { recursive: true });
    await mkdir(fixture.root, { recursive: true });
    await mkdir(fixture.temporary, { recursive: true });
    await writeFile(fixture.image, AppImageFixture.IMAGE);
    await writeFile(path.join(fixture.folder, "payload", "teamrun"), AppImageFixture.PROGRAM);
    await chmod(fixture.image, AppImageFixture.EXECUTABLE_MODE);
    await chmod(path.join(fixture.folder, "payload", "teamrun"), AppImageFixture.EXECUTABLE_MODE);
    return fixture;
  }

  public async refuseAsync(option: "mount" | "extract"): Promise<void> {
    await writeFile(path.join(this.folder, `refuse-${option}`), "");
  }

  public async listMountsAsync(): Promise<string[]> {
    return (await readdir(this.folder)).filter(t => t.startsWith("mount-"));
  }

  public async listExtractionsAsync(): Promise<string[]> {
    return readdir(this.temporary);
  }

  public async readRecordAsync(): Promise<string> {
    return readFile(this.record, "utf8");
  }

  public async runAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv = {}, signalWhenStarted: NodeJS.Signals | null = null): Promise<AppImageRun> {
    const child = spawn(executable, launchArguments, {
      env: { ...process.env, TMPDIR: this.temporary, TEAMRUN_FIXTURE_RECORD: this.record, ...environment },
      stdio: ["ignore", "ignore", "pipe"]
    });
    let error = "";
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => error += chunk);
    const closed = once(child, "close");
    if (!Object.isNull(signalWhenStarted)) {
      const started = `${this.record}.started`;
      if (!await Wait.untilAsync(() => existsSync(started), AppImageFixture.WAIT_LIMIT))
        throw new Error(`The program in the fixture AppImage did not start within ${AppImageFixture.WAIT_LIMIT} ms.`);
      child.kill(signalWhenStarted);
    }
    const [exitCode, signal] = await closed as [number | null, NodeJS.Signals | null];
    return new AppImageRun(exitCode, signal, error);
  }

  public async startMounterAsync(): Promise<number> {
    const child = spawn(this.image, ["--appimage-mount"], { stdio: ["ignore", "pipe", "ignore"], detached: true });
    child.unref();
    this.mounters.push(child.pid ?? 0);
    const [line] = await once(child.stdout.setEncoding("utf8"), "data") as [string];
    child.stdout.destroy();
    if (line.trim().length === 0)
      throw new Error("The fixture AppImage printed no mount point.");
    return child.pid ?? 0;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    for (const processId of this.mounters) {
      if (ProgramFixture.isRunning(processId))
        process.kill(processId, "SIGKILL");
    }
    await rm(this.folder, { recursive: true, force: true });
  }
}
