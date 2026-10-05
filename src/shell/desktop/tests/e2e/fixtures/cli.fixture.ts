/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

export default class CliFixture {
  private static readonly TIMEOUT: number = 30_000;

  public static async runAsync(...commandLine: string[]): Promise<string> {
    const executable = await readFile(path.resolve("_build", "development-app", "path.txt"), "utf8");
    const entry = path.resolve("node_modules", "@noldova", "teamrun-shell-cli", "services", "cli-entry.js");
    const { stdout } = await promisify(execFile)(executable, [entry, ...commandLine], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, encoding: "utf8", timeout: CliFixture.TIMEOUT });
    return stdout;
  }
}
