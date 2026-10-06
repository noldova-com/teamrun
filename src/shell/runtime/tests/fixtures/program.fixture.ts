/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { symlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Wait } from "@noldova/teamrun-foundation-testing";
import { type OwnedProcess, ProcessRequest } from "@noldova/teamrun-shell-runtime";

export class ProgramFixture {
  public static readonly WAIT: string = "wait";
  public static readonly STUBBORN: string = "stubborn";
  public static readonly EXIT: string = "exit";
  public static readonly PARENT: string = "parent";
  public static readonly FOREVER: string = "forever";
  public static readonly ENVIRONMENT: string = "environment";
  public static readonly ARGUMENTS: string = "arguments";
  public static readonly READY: string = "ready";
  public static readonly file: string = fileURLToPath(import.meta.url);

  private static readonly KEPT_PREFIX: string = "TEAMRUN_";

  public static request(workingFolder: string, launchArguments: readonly string[], signal?: AbortSignal, program: string = process.execPath): ProcessRequest {
    return new ProcessRequest(program, [ProgramFixture.file, ...launchArguments], workingFolder, {}, [], signal);
  }

  public static async locateWindowsProgramAsync(folder: string): Promise<string> {
    if (process.platform === "win32")
      return process.execPath;
    const program = path.join(folder, "node.exe");
    await symlink(process.execPath, program);
    return program;
  }

  public static async readLineAsync(owned: OwnedProcess): Promise<string> {
    owned.output.setEncoding("utf8");
    let text = "";
    while (!text.includes("\n")) {
      const [chunk] = await once(owned.output, "data") as [string];
      text += chunk;
    }
    return text.slice(0, text.indexOf("\n")).trim();
  }

  public static async readAllAsync(owned: OwnedProcess): Promise<string> {
    owned.output.setEncoding("utf8");
    let text = "";
    owned.output.on("data", (t: string) => {
      text += t;
    });
    await owned.exited;
    if (!owned.output.readableEnded)
      await once(owned.output, "end");
    return text.trim();
  }

  public static isRunning(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }

  public static async waitForEndAsync(processId: number, milliseconds: number): Promise<boolean> {
    return await Wait.untilAsync(() => !ProgramFixture.isRunning(processId), milliseconds);
  }

  public static run(behavior: string, launchArguments: readonly string[]): void {
    switch (behavior) {
      case ProgramFixture.WAIT:
        ProgramFixture.waitForInputEnd();
        break;
      case ProgramFixture.STUBBORN:
        process.on("SIGTERM", () => undefined);
        setInterval(() => undefined, 1_000);
        process.stdout.write(`${ProgramFixture.READY}\n`);
        break;
      case ProgramFixture.EXIT:
        process.exitCode = Number(launchArguments[0]);
        break;
      case ProgramFixture.PARENT:
        ProgramFixture.startChild(launchArguments[0] ?? ProgramFixture.WAIT);
        break;
      case ProgramFixture.FOREVER:
        setInterval(() => undefined, 1_000);
        break;
      case ProgramFixture.ENVIRONMENT:
        process.stderr.write(`${ProgramFixture.ENVIRONMENT}\n`);
        process.stdout.write(`${JSON.stringify({
          folder: process.cwd(),
          path: process.env["PATH"] ?? null,
          kept: Object.entries(process.env).filter(([t]) => t.startsWith(ProgramFixture.KEPT_PREFIX)).sort(([t], [u]) => t.localeCompare(u))
        })}\n`);
        break;
      default:
        process.stdout.write(`${JSON.stringify(launchArguments)}\n`);
    }
  }

  private static waitForInputEnd(): void {
    process.stdin.on("end", () => process.exit(0));
    process.stdin.resume();
    process.stdout.write(`${ProgramFixture.READY}\n`);
  }

  private static startChild(then: string): void {
    const child = spawn(process.execPath, [ProgramFixture.file, ProgramFixture.FOREVER], { stdio: "ignore", windowsHide: true });
    process.stdout.write(`${child.pid}\n`, () => {
      if (then === ProgramFixture.WAIT)
        ProgramFixture.waitForInputEnd();
      else
        process.exit(Number(then));
    });
  }
}

if (import.meta.main)
  ProgramFixture.run(process.argv[2] ?? ProgramFixture.ARGUMENTS, process.argv.slice(3));
