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
  private static readonly UNINSTALLER: string = "Uninstall Fixture Studio.exe";

  private readonly failing: readonly string[];
  private readonly directories: Set<string> = new Set<string>();

  public localAppData: string = "";
  public installedBeforeTimeout: readonly string[] | null = null;
  public libraries: readonly string[] = ["ffmpeg.dll", "libEGL.DLL"];
  public userPath: string | null = null;
  public registryAnswers: boolean = true;
  public pathEntries: number = 1;
  public uninstallLeaves: readonly string[] = [];
  public uninstallKeepsPath: boolean = false;
  public uninstallerStays: boolean = false;
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

  private get installFolder(): string {
    return path.join(this.localAppData, "Programs", "fixture-studio");
  }

  private get commandFolder(): string {
    return path.join(this.installFolder, "bin");
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
    if (name === "reg.exe")
      return this.answerRegistry();
    if (name === InstallRunnerFixture.UNINSTALLER)
      return this.uninstallAsync();
    if (commandArguments[0] === "--appimage-extract")
      await InstallRunnerFixture.createAsync(path.join(directory, "squashfs-root", "fixture-studio"));
    if (commandArguments[0] === "/S" && this.installedBeforeTimeout !== null) {
      for (const file of this.installedBeforeTimeout)
        await InstallRunnerFixture.createAsync(path.join(this.installFolder, file));
      throw new ProcessTimeoutException(`"${command}" did not finish within ${timeout} ms.`);
    }
    if (commandArguments[0] === "/S")
      await this.installAsync();
    if (name === "ditto")
      await InstallRunnerFixture.createAsync(path.join(String(commandArguments[1]), "Contents", "MacOS", "Fixture Studio"));
    return new ProcessResult(0, "", "");
  }

  private static async createAsync(file: string): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "program\n");
  }

  private answerRegistry(): ProcessResult {
    if (!this.registryAnswers)
      return new ProcessResult(5, "", "ERROR: Access is denied.");
    if (this.userPath === null)
      return new ProcessResult(1, "", "ERROR: The system was unable to find the specified registry key or value.");
    return new ProcessResult(0, `\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    ${this.userPath}\r\n\r\n`, "");
  }

  private async installAsync(): Promise<void> {
    for (const file of ["Fixture Studio.exe", InstallRunnerFixture.UNINSTALLER, path.join("bin", "fixture-studio.cmd"), ...this.libraries])
      await InstallRunnerFixture.createAsync(path.join(this.installFolder, file));
    const value = this.userPath ?? "";
    const added = Array<string>(this.pathEntries).fill(this.commandFolder).join(";");
    if (value.split(";").includes(this.commandFolder) || added.length === 0)
      this.userPath = value;
    else if (value.length === 0)
      this.userPath = added;
    else
      this.userPath = value.endsWith(";") ? `${value}${added};` : `${value};${added}`;
  }

  private async uninstallAsync(): Promise<ProcessResult> {
    await rm(this.installFolder, { recursive: true, force: true });
    for (const file of this.uninstallLeaves)
      await InstallRunnerFixture.createAsync(path.join(this.installFolder, file));
    await InstallRunnerFixture.createAsync(path.join(this.installFolder, InstallRunnerFixture.UNINSTALLER, ...(this.uninstallerStays ? ["locked"] : [])));
    if (!this.uninstallKeepsPath) {
      const rest = `;${this.userPath ?? ""};`.split(`;${this.commandFolder};`).join(";").slice(1, -1);
      this.userPath = rest.length > 0 ? rest : null;
    }
    return new ProcessResult(0, "", "");
  }
}
