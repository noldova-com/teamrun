/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";
import { setTimeout } from "node:timers/promises";

import type ProcessRunner from "../processes/process-runner.ts";
import ProcessException from "../processes/process.exception.ts";

export default class ElectronBinary {
  private static readonly PACKAGE_SEGMENTS: readonly string[] = ["node_modules", "electron"];
  private static readonly INSTALLER_FILE: string = "install.js";
  private static readonly PATH_FILE: string = "path.txt";
  private static readonly DISTRIBUTION_FOLDER: string = "dist";
  private static readonly ATTEMPTS: number = 4;
  private static readonly ATTEMPT_TIMEOUT: number = 600_000;
  private static readonly INSTALLING: string = "Installing Electron's binary...\n";

  private readonly directory: string;
  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly pauseMilliseconds: number;

  public constructor(root: string, runner: ProcessRunner, pauseMilliseconds: number = 15_000) {
    this.root = root;
    this.directory = path.join(root, ...ElectronBinary.PACKAGE_SEGMENTS);
    this.runner = runner;
    this.pauseMilliseconds = pauseMilliseconds;
  }

  public isInstalled(): boolean {
    const pathFile = path.join(this.directory, ElectronBinary.PATH_FILE);
    return existsSync(pathFile) && existsSync(path.join(this.directory, ElectronBinary.DISTRIBUTION_FOLDER, readFileSync(pathFile, "utf8")));
  }

  public async installAsync(output: Writable): Promise<void> {
    const installer = path.join(this.directory, ElectronBinary.INSTALLER_FILE);
    if (!existsSync(installer) || this.isInstalled())
      return;

    output.write(ElectronBinary.INSTALLING);
    let failure = "";
    for (let attempt = 1; attempt <= ElectronBinary.ATTEMPTS; attempt++) {
      const result = await this.runner.captureAsync(process.execPath, [installer], this.root, ElectronBinary.ATTEMPT_TIMEOUT);
      if (result.isSuccessful && this.isInstalled())
        return;
      failure = result.isSuccessful ? "it reported success, but the binary is still missing" : `exit code ${result.exitCode}: ${result.errorOutput.trim()}`;
      if (attempt < ElectronBinary.ATTEMPTS) {
        output.write(`Electron's binary could not be installed (attempt ${attempt} of ${ElectronBinary.ATTEMPTS}); trying again in ${this.pauseMilliseconds / 1000} seconds.\n`);
        await setTimeout(this.pauseMilliseconds);
      }
    }
    throw new ProcessException(`Electron's binary could not be installed in ${ElectronBinary.ATTEMPTS} attempts; the last failed with ${failure}.`);
  }
}
