/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ExecutableSource, LocatedExecutable } from "@noldova/teamrun.providers";

export class FakeNpm {
  private static readonly SCRIPT: string = `const fs = require("node:fs");
const path = require("node:path");
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, "plan.json"), "utf8"));
const args = process.argv.slice(2);
fs.writeFileSync(path.join(__dirname, "record.json"), JSON.stringify({ args, environment: process.env }));
const prefix = args[args.indexOf("--prefix") + 1];
for (const [name, text] of Object.entries(plan.files)) {
  fs.mkdirSync(path.dirname(path.join(prefix, name)), { recursive: true });
  fs.writeFileSync(path.join(prefix, name), text);
}
process.stderr.write(plan.stderr);
process.exitCode = plan.exitCode;
`;

  public readonly executable: LocatedExecutable;

  private readonly directory: string;

  public constructor(directory: string, files: Readonly<Record<string, string>>, exitCode: number = 0, stderr: string = "") {
    this.directory = directory;
    writeFileSync(join(directory, "fake-npm.cjs"), FakeNpm.SCRIPT);
    writeFileSync(join(directory, "plan.json"), JSON.stringify({ files, exitCode, stderr }));
    const shim = join(directory, process.platform === "win32" ? "npm.cmd" : "npm");
    writeFileSync(shim, process.platform === "win32" ? `@echo off\r\n"${process.execPath}" "%~dp0fake-npm.cjs" %*\r\n`
      : `#!/bin/sh\nexec "${process.execPath}" "${join(directory, "fake-npm.cjs")}" "$@"\n`);
    chmodSync(shim, 0o755);
    this.executable = new LocatedExecutable(shim, ExecutableSource.Path);
  }

  public static package(name: string, version: string, bin: unknown, programs: readonly string[] = []): Readonly<Record<string, string>> {
    return { [`node_modules/${name}/package.json`]: JSON.stringify({ name, version, bin }),
      ...Object.fromEntries(programs.flatMap(t => [[`node_modules/.bin/${t}`, "program"], [`node_modules/.bin/${t}.cmd`, "program"]])) };
  }

  public get arguments(): readonly string[] {
    return this.record.args;
  }

  public get environment(): NodeJS.ProcessEnv {
    return this.record.environment;
  }

  private get record(): { readonly args: readonly string[]; readonly environment: NodeJS.ProcessEnv } {
    return JSON.parse(readFileSync(join(this.directory, "record.json"), "utf8")) as { readonly args: readonly string[]; readonly environment: NodeJS.ProcessEnv };
  }
}
