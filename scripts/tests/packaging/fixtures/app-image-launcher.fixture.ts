/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync, spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import AppImageLauncher from "../../../packaging/app-image-launcher.ts";

export default class AppImageLauncherFixture implements AsyncDisposable {
  private readonly directory: string;

  public readonly appDirectory: string;
  public readonly launcherPath: string;

  private constructor(directory: string) {
    this.directory = directory;
    this.appDirectory = path.join(directory, "application with spaces");
    this.launcherPath = path.join(this.appDirectory, "AppRun");
  }

  public static async create(): Promise<AppImageLauncherFixture> {
    const fixture = new AppImageLauncherFixture(await mkdtemp(path.join(tmpdir(), "teamrun-apprun-")));
    await mkdir(fixture.appDirectory);
    await AppImageLauncher.write(fixture.launcherPath);
    const header = "#!/usr/bin/env bash\n# @license\n# Copyright (c) Noldova.\n#\n" +
      "# This source code is licensed under the license found in the\n" +
      "# LICENSE file in the root directory of this source tree.\n\n";
    await writeFile(path.join(fixture.appDirectory, "teamrun"), header + [
      'printf "%s\\0" "$#" "$APPDIR" "$LD_LIBRARY_PATH" "$XDG_DATA_DIRS" "$GSETTINGS_SCHEMA_DIR" "$@" > "$LAUNCH_RECORD"',
      'exit "$LAUNCH_EXIT_CODE"',
      ""
    ].join("\n"), { mode: 0o755 });
    await writeFile(path.join(fixture.appDirectory, "unshare"), header + 'echo called > "$PROBE_RECORD"\nexit 1\n', { mode: 0o755 });
    await writeFile(path.join(fixture.directory, "launch"), header + [
      'IFS= read -r inherited < inherited-path',
      'export LD_LIBRARY_PATH="$inherited" XDG_DATA_DIRS="$inherited" GSETTINGS_SCHEMA_DIR="$inherited"',
      'export APPDIR="/wrong/inherited/appdir"',
      "args=()",
      'while IFS= read -r -d "" arg; do args+=("$arg"); done < arguments',
      'exec "$LAUNCHER_FILE" "${args[@]}"',
      ""
    ].join("\n"), { mode: 0o755 });
    return fixture;
  }

  public async run(args: readonly string[], exitCode: number, inheritedPaths: string,
    environment: Readonly<Record<string, string>> = {}): Promise<SpawnSyncReturns<string>> {
    await writeFile(path.join(this.directory, "arguments"), args.map(t => t + "\0").join(""));
    await writeFile(path.join(this.directory, "inherited-path"), inheritedPaths + "\n");
    const bash = process.platform === "win32"
      ? path.resolve(execFileSync("git", ["--exec-path"], { encoding: "utf8", timeout: 10_000 }).trim(), "../../..", "bin/bash.exe")
      : "bash";
    return spawnSync(bash, [path.join(this.directory, "launch").replaceAll("\\", "/")], {
      cwd: this.directory,
      env: {
        ...process.env,
        MSYS2_ENV_CONV_EXCL: "*",
        LAUNCHER_FILE: this.launcherPath.replaceAll("\\", "/"),
        LAUNCH_RECORD: path.join(this.directory, "record").replaceAll("\\", "/"),
        PROBE_RECORD: path.join(this.directory, "probe").replaceAll("\\", "/"),
        LAUNCH_EXIT_CODE: String(exitCode),
        ...environment
      },
      encoding: "utf8",
      timeout: 10_000
    });
  }

  public async readRecord(): Promise<readonly string[]> {
    return (await readFile(path.join(this.directory, "record"), "utf8")).split("\0").slice(0, -1);
  }

  public async readProbe(): Promise<string> {
    return await readFile(path.join(this.directory, "probe"), "utf8");
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.directory, { recursive: true, force: true });
  }
}
