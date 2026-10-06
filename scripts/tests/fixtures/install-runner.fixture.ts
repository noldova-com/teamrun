/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import ProcessResult from "../../processes/process-result.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import ProcessTimeoutException from "../../processes/process-timeout.exception.ts";

export default class InstallRunnerFixture extends ProcessRunner {
  private readonly failing: readonly string[];
  private readonly directories: Set<string> = new Set<string>();

  public localAppData: string = "";
  public installedBeforeTimeout: readonly string[] | null = null;
  public libraries: readonly string[] = ["ffmpeg.dll", "libEGL.DLL"];
  public readonly calls: (readonly string[])[] = [];
  public readonly limits: number[] = [];
  public readonly installerEnvironments: (NodeJS.ProcessEnv | undefined)[] = [];

  public constructor(failing: readonly string[] = []) {
    super();

    this.failing = failing;
  }

  public get folder(): string {
    return [...this.directories].join();
  }

  public async disposeAsync(): Promise<void> {
    for (const directory of this.directories)
      await rm(directory, { recursive: true, force: true });
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    const name = path.basename(command);
    this.directories.add(directory);
    this.calls.push([name, ...commandArguments.map(t => t.startsWith(directory) ? path.relative(directory, t) : t)]);
    this.limits.push(timeout);
    this.installerEnvironments.push(environment);
    if (this.failing.includes(name) || this.failing.includes(String(commandArguments[0])))
      return new ProcessResult(9, "", `${name} broke`);
    if (commandArguments[0] === "--appimage-extract")
      await InstallRunnerFixture.createAsync(path.join(directory, "squashfs-root", "fixture-studio"));
    if (commandArguments[0] === "/S" && this.installedBeforeTimeout !== null) {
      for (const file of this.installedBeforeTimeout)
        await InstallRunnerFixture.createAsync(path.join(this.localAppData, "Programs", "fixture-studio", file));
      throw new ProcessTimeoutException(`"${command}" did not finish within ${timeout} ms.`);
    }
    if (commandArguments[0] === "/S") {
      for (const file of ["Fixture Studio.exe", ...this.libraries])
        await InstallRunnerFixture.createAsync(path.join(this.localAppData, "Programs", "fixture-studio", file));
    }
    if (name === "ditto")
      await InstallRunnerFixture.createAsync(path.join(String(commandArguments[1]), "Contents", "MacOS", "Fixture Studio"));
    return new ProcessResult(0, "", "");
  }

  private static async createAsync(file: string): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "program\n");
  }
}
