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
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod, Wait } from "@noldova/teamrun-foundation-testing";
import { AppImageRestart } from "@noldova/teamrun-shell-desktop";
import { ChildProcessStarter, type IProcessStarter } from "@noldova/teamrun-shell-runtime";

import { PlatformFixture } from "../fixtures/platform.fixture.js";

@TestClass
export class AppImageRestartTests {
  private static readonly ENVIRONMENT: NodeJS.ProcessEnv = {
    APPIMAGE: "/home/person/Applications/TeamRun.AppImage", APPDIR: "/tmp/.mount_TeamRuX", ARGV0: "TeamRun.AppImage", OWD: "/home/person", HOME: "/home/person"
  };
  private static readonly GONE: number = 0x3fffffff;

  @TestMethod
  public findsNothingOutsideALinuxAppImage(): void {
    const starter = AppImageRestartTests.createStarter([], 1);

    Assert.isNull(AppImageRestart.find("win32", AppImageRestartTests.ENVIRONMENT, "/tmp/.mount_TeamRuX/teamrun", [], starter, 100, "/tmp/restart.log"));
    Assert.isNull(AppImageRestart.find("darwin", AppImageRestartTests.ENVIRONMENT, "/tmp/.mount_TeamRuX/teamrun", [], starter, 100, "/tmp/restart.log"));
    Assert.isNull(AppImageRestart.find("linux", {}, "/opt/teamrun/teamrun", [], starter, 100, "/tmp/restart.log"));
    Assert.isNull(AppImageRestart.find("linux", AppImageRestartTests.ENVIRONMENT, "/opt/teamrun/teamrun", [], starter, 100, "/tmp/restart.log"));
  }

  @TestMethod
  public async startsBashToStartTheAppImageFileOnceTheDesktopExitsWithoutTheOldMountsVariables(): Promise<void> {
    const calls: [string, readonly string[], NodeJS.ProcessEnv, string][] = [];
    const restart = AppImageRestart.find("linux", AppImageRestartTests.ENVIRONMENT, "/tmp/.mount_TeamRuX/teamrun", ["--data-dir", "/home/person/data"],
      AppImageRestartTests.createStarter(calls, AppImageRestartTests.GONE), 4120, "/tmp/restart.log");

    await restart?.startAsync();

    Assert.areEqual(1, calls.length);
    const [executable, launchArguments, environment, errorFile] = calls[0] ?? ["", [], {}, ""];
    Assert.areEqual("/bin/bash", executable);
    Assert.areEqual(JSON.stringify(["teamrun-restart", "4120", "/home/person/Applications/TeamRun.AppImage", "--data-dir", "/home/person/data"]), JSON.stringify(launchArguments.slice(5)));
    Assert.areEqual(JSON.stringify(["--noprofile", "--norc", "-p", "-c"]), JSON.stringify(launchArguments.slice(0, 4)));
    Assert.areEqual(JSON.stringify({ HOME: "/home/person" }), JSON.stringify(environment));
    Assert.areEqual("/tmp/restart.log", errorFile);
    restart?.cancel();
    restart?.cancel();
  }

  @TestMethod
  public async cancellingEndsTheStartedBashAndDoesNothingBeforeItStarts(): Promise<void> {
    const waiting = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], { stdio: "ignore" });
    await once(waiting, "spawn");
    const exited = once(waiting, "exit");
    const restart = AppImageRestart.find("linux", AppImageRestartTests.ENVIRONMENT, "/tmp/.mount_TeamRuX/teamrun", [], AppImageRestartTests.createStarter([], Number(waiting.pid)), 4120,
      "/tmp/restart.log");

    restart?.cancel();
    await restart?.startAsync();
    restart?.cancel();
    await exited;

    Assert.isNotNull(waiting.exitCode ?? waiting.signalCode);
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async startsTheAppImageFromTheRootFolderOnlyOnceTheDesktopHasExitedAndReportsOneThatCannotStart(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "tr-restart-"));
    try {
      const image = path.join(folder, "TeamRun.AppImage");
      const marker = path.join(folder, "started");
      const errorFile = path.join(folder, "restart.log");
      await writeFile(image, `#!/bin/bash\nprintf '%s|%s|%s' "$PWD" "$*" "\${APPIMAGE-unset}" > ${JSON.stringify(marker)}\n`);
      await chmod(image, 0o755);
      const desktop = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], { stdio: "ignore" });
      await once(desktop, "spawn");
      const environment = { ...process.env, APPIMAGE: image, APPDIR: path.join(folder, "mount") };
      const restart = AppImageRestart.find("linux", environment, path.join(folder, "mount", "teamrun"), ["--one", "two"], new ChildProcessStarter(), Number(desktop.pid), errorFile);

      await restart?.startAsync();
      const isEarly = existsSync(marker);
      desktop.kill();

      Assert.isFalse(isEarly, "the AppImage started while the desktop still ran");
      Assert.isTrue(await Wait.untilAsync(() => existsSync(marker), 10_000), "the AppImage did not start after the desktop exited");
      Assert.isTrue(await Wait.untilAsync(async () => (await readFile(marker, "utf8")).length > 0, 10_000));
      Assert.areEqual("/|--one two|unset", await readFile(marker, "utf8"));

      await chmod(image, 0o644);
      const missing = AppImageRestart.find("linux", environment, path.join(folder, "mount", "teamrun"), [], new ChildProcessStarter(), AppImageRestartTests.GONE, errorFile);
      await missing?.startAsync();

      Assert.isTrue(await Wait.untilAsync(async () => (await readFile(errorFile, "utf8")).includes(`${image} cannot be started after the update.`), 10_000));
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  private static createStarter(calls: [string, readonly string[], NodeJS.ProcessEnv, string][], processId: number): IProcessStarter {
    return {
      startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number> {
        calls.push([executable, launchArguments, environment, errorFile]);
        return Promise.resolve(processId);
      }
    };
  }
}
