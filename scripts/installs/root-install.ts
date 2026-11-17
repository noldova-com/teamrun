/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";

export class RootInstall {
  public static readonly ARGUMENTS: readonly string[] = ["ci", "--ignore-scripts", "--no-audit", "--no-fund"];

  private static readonly MODULES_FOLDER: string = "node_modules";
  private static readonly NPM_VARIABLE: string = "npm_execpath";
  private static readonly FAILED_EXIT_CODE: number = 1;
  private static readonly INSTALLING: string = "The root has no node_modules, so npm ci installs the root's and src/'s packages first, with install scripts off.\n";
  private static readonly UNAVAILABLE: string = "The root has no node_modules and npm_execpath is not set; run npm run build, which installs the packages through npm.\n";

  private readonly root: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;

  public constructor(root: string, environment: NodeJS.ProcessEnv, output: Writable) {
    this.root = root;
    this.environment = environment;
    this.output = output;
  }

  public async runAsync(): Promise<number> {
    if (existsSync(path.join(this.root, RootInstall.MODULES_FOLDER)))
      return 0;
    const npm = this.environment[RootInstall.NPM_VARIABLE];
    if (npm === undefined || npm.length === 0) {
      this.output.write(RootInstall.UNAVAILABLE);
      return RootInstall.FAILED_EXIT_CODE;
    }
    this.output.write(RootInstall.INSTALLING);
    return await new Promise<number>((resolve, reject) => {
      const child = spawn(process.execPath, [npm, ...RootInstall.ARGUMENTS], { cwd: this.root, shell: false, stdio: "inherit", env: this.environment });
      child.once("error", reject);
      child.once("close", exitCode => resolve(exitCode ?? RootInstall.FAILED_EXIT_CODE));
    });
  }
}

if (import.meta.main)
  process.exitCode = await new RootInstall(process.cwd(), process.env, process.stdout).runAsync();
