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

import type ProcessRunner from "../processes/process-runner.ts";
import RetriedDownload from "../processes/retried-download.ts";

export default class ElectronBinary {
  private static readonly PACKAGE_SEGMENTS: readonly string[] = ["node_modules", "electron"];
  private static readonly INSTALLER_FILE: string = "install.js";
  private static readonly PATH_FILE: string = "path.txt";
  private static readonly DISTRIBUTION_FOLDER: string = "dist";
  private static readonly SUBJECT: string = "Electron's binary";
  private static readonly INSTALLING: string = "Installing Electron's binary...\n";

  private readonly directory: string;
  private readonly root: string;
  private readonly runner: ProcessRunner;

  public constructor(root: string, runner: ProcessRunner) {
    this.root = root;
    this.directory = path.join(root, ...ElectronBinary.PACKAGE_SEGMENTS);
    this.runner = runner;
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
    await RetriedDownload.runAsync(ElectronBinary.SUBJECT, output, async () => {
      const result = await this.runner.captureAsync(process.execPath, [installer], this.root, RetriedDownload.ATTEMPT_TIMEOUT);
      if (result.isSuccessful && this.isInstalled())
        return null;
      return result.isSuccessful ? "it reported success, but the binary is still missing" : `exit code ${result.exitCode}: ${result.errorOutput.trim()}`;
    });
  }
}
