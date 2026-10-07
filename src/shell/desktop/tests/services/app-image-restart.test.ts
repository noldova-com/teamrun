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
import type { IProcessStarter } from "@noldova/teamrun-shell-runtime";

import { LinuxLaunchFixture } from "../fixtures/linux-launch.fixture.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";
import { RestartParentFixture } from "../fixtures/restart-parent.fixture.js";

@TestClass
export class AppImageRestartTests {
  private static readonly MOUNT: string = "/tmp/.mount_TeamRuX";
  private static readonly ENVIRONMENT: NodeJS.ProcessEnv = {
    APPIMAGE: "/home/person/Applications/TeamRun.AppImage",
    APPDIR: AppImageRestartTests.MOUNT,
    ARGV0: "TeamRun.AppImage",
    OWD: "/home/person",
    HOME: "/home/person",
    PATH: `${AppImageRestartTests.MOUNT}:${AppImageRestartTests.MOUNT}/usr/sbin:/usr/bin:/bin`,
    XDG_DATA_DIRS: `${AppImageRestartTests.MOUNT}/usr/share/:/usr/local/share:/usr/share:/usr/share/gnome:/usr/local/share/:/usr/share/`,
    LD_LIBRARY_PATH: `${AppImageRestartTests.MOUNT}/usr/lib`,
    GSETTINGS_SCHEMA_DIR: "/opt/schemas",
    EMPTY: "",
    UNSET: undefined
  };
  private static readonly GONE: number = 0x3fffffff;
  private static readonly LIMIT: number = 10_000;

  @TestMethod
  public findsNothingOutsideALinuxAppImage(): void {
    const starter = AppImageRestartTests.createStarter([], 1);

    Assert.isNull(AppImageRestart.find("win32", AppImageRestartTests.ENVIRONMENT, `${AppImageRestartTests.MOUNT}/teamrun`, [], starter, 100, "/tmp/restart.log"));
    Assert.isNull(AppImageRestart.find("darwin", AppImageRestartTests.ENVIRONMENT, `${AppImageRestartTests.MOUNT}/teamrun`, [], starter, 100, "/tmp/restart.log"));
    Assert.isNull(AppImageRestart.find("linux", {}, "/opt/teamrun/teamrun", [], starter, 100, "/tmp/restart.log"));
    Assert.isNull(AppImageRestart.find("linux", AppImageRestartTests.ENVIRONMENT, "/opt/teamrun/teamrun", [], starter, 100, "/tmp/restart.log"));
  }

  @TestMethod
  public async startsBashThroughTheLaunchCommandWithoutWhatTheAppImageAddedToTheEnvironment(): Promise<void> {
    using _launch = new LinuxLaunchFixture();
    const calls: [string, readonly string[], NodeJS.ProcessEnv, string][] = [];
    const starter = AppImageRestartTests.createStarter(calls, AppImageRestartTests.GONE);
    const restart = AppImageRestart.find("linux", AppImageRestartTests.ENVIRONMENT, `${AppImageRestartTests.MOUNT}/teamrun`, ["--data-dir", "/home/person/data"], starter, 4120,
      "/tmp/restart.log");
    const other = AppImageRestart.find("linux", {
      ...AppImageRestartTests.ENVIRONMENT, XDG_DATA_DIRS: `${AppImageRestartTests.MOUNT}/usr/share/:/usr/share`, LD_LIBRARY_PATH: `${AppImageRestartTests.MOUNT}/usr/lib:`
    }, `${AppImageRestartTests.MOUNT}/teamrun`, [], starter, 4120, "/tmp/restart.log");

    await restart?.startAsync();
    await other?.startAsync();

    Assert.areEqual(2, calls.length);
    const [executable, launchArguments, environment, errorFile] = calls[0] ?? ["", [], {}, ""];
    Assert.areEqual("/bin/bash", executable);
    Assert.areEqual(JSON.stringify(["--noprofile", "--norc", "-p", "-c"]), JSON.stringify(launchArguments.slice(0, 4)));
    Assert.areEqual(JSON.stringify(["teamrun-launch", "/bin/bash", "--noprofile", "--norc", "-p", "-c"]), JSON.stringify(launchArguments.slice(5, 11)));
    Assert.areEqual(JSON.stringify(["teamrun-restart", "4120", "/home/person/Applications/TeamRun.AppImage", "--data-dir", "/home/person/data"]),
      JSON.stringify(launchArguments.slice(12)));
    Assert.areEqual(JSON.stringify({
      HOME: "/home/person", PATH: "/usr/bin:/bin", XDG_DATA_DIRS: "/usr/local/share:/usr/share", GSETTINGS_SCHEMA_DIR: "/opt/schemas", EMPTY: ""
    }), JSON.stringify(environment));
    Assert.areEqual("/tmp/restart.log", errorFile);
    Assert.areEqual(`${AppImageRestartTests.MOUNT}/usr/share/:/usr/share`, calls[1]?.[2]["XDG_DATA_DIRS"]);
    Assert.isFalse(Object.hasOwn(calls[1]?.[2] ?? {}, "LD_LIBRARY_PATH"));
    restart?.cancel();
    restart?.cancel();
  }

  @TestMethod
  public async cancellingEndsTheStartedBashAndDoesNothingBeforeItStarts(): Promise<void> {
    using _launch = new LinuxLaunchFixture();
    const waiting = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], { stdio: "ignore" });
    await once(waiting, "spawn");
    const exited = once(waiting, "exit");
    const restart = AppImageRestart.find("linux", AppImageRestartTests.ENVIRONMENT, `${AppImageRestartTests.MOUNT}/teamrun`, [],
      AppImageRestartTests.createStarter([], Number(waiting.pid)), 4120, "/tmp/restart.log");

    restart?.cancel();
    await restart?.startAsync();
    restart?.cancel();
    await exited;

    Assert.isNotNull(waiting.exitCode ?? waiting.signalCode);
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async startsTheAppImageFromTheRootFolderWithoutInheritedDescriptorsOnlyOnceItsParentHasExited(): Promise<void> {
    await AppImageRestartTests.runInFolderAsync(async (folder, image, marker) => {
      await using parent = await RestartParentFixture.createAsync();
      const restart = AppImageRestartTests.find(folder, image, ["--one", "two"], parent, parent.processId);

      await restart?.startAsync();
      const isWaiting = await Wait.untilAsync(() => RestartParentFixture.isWaitingAsync(parent.started), AppImageRestartTests.LIMIT);
      const isEarly = existsSync(marker);
      await parent.exitAsync();

      Assert.isTrue(isWaiting, "Bash did not wait for its parent to exit");
      Assert.isFalse(isEarly, "the AppImage started while Bash's parent still ran");
      Assert.isTrue(await Wait.untilAsync(() => existsSync(marker), AppImageRestartTests.LIMIT), "the AppImage did not start after Bash's parent exited");
      Assert.areEqual("/|--one two|unset|unset\n0 1 2 3 ", await readFile(marker, "utf8"));
    });
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async endsTheWaitingBashWhenCancelledWithoutStartingTheAppImage(): Promise<void> {
    await AppImageRestartTests.runInFolderAsync(async (folder, image, marker) => {
      await using parent = await RestartParentFixture.createAsync();
      const restart = AppImageRestartTests.find(folder, image, [], parent, parent.processId);

      await restart?.startAsync();
      Assert.isTrue(await Wait.untilAsync(() => RestartParentFixture.isWaitingAsync(parent.started), AppImageRestartTests.LIMIT), "Bash did not wait for its parent to exit");
      restart?.cancel();

      Assert.isTrue(await Wait.untilAsync(() => RestartParentFixture.hasEndedAsync(parent.started), AppImageRestartTests.LIMIT), "Bash did not end when cancelled");
      await parent.exitAsync();
      Assert.isFalse(existsSync(marker), "the AppImage started after a cancel");
    });
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async reportsAnAppImageThatCannotStart(): Promise<void> {
    await AppImageRestartTests.runInFolderAsync(async (folder, image) => {
      const errorFile = path.join(folder, "restart.log");
      await chmod(image, 0o644);
      await using parent = await RestartParentFixture.createAsync();
      const restart = AppImageRestartTests.find(folder, image, [], parent, AppImageRestartTests.GONE);

      await restart?.startAsync();

      Assert.isTrue(await Wait.untilAsync(async () => (await readFile(errorFile, "utf8")).includes(`${image} cannot be started after the update.`), AppImageRestartTests.LIMIT));
    });
  }

  private static async runInFolderAsync(action: (folder: string, image: string, marker: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "tr-restart-"));
    try {
      const image = path.join(folder, "TeamRun.AppImage");
      const marker = path.join(folder, "started");
      await writeFile(image, [
        "#!/bin/bash",
        `{ printf '%s|%s|%s|%s\\n' "$PWD" "$*" "\${APPIMAGE-unset}" "\${LD_LIBRARY_PATH-unset}"; ls /proc/self/fd | tr '\\n' ' '; } > ${JSON.stringify(`${marker}.part`)}`,
        `mv ${JSON.stringify(`${marker}.part`)} ${JSON.stringify(marker)}`
      ].join("\n"));
      await chmod(image, 0o755);
      await action(folder, image, marker);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  private static find(folder: string, image: string, launchArguments: readonly string[], starter: IProcessStarter, processId: number): AppImageRestart | null {
    const mount = path.join(folder, "mount");
    const environment = { ...process.env, APPIMAGE: image, APPDIR: mount, LD_LIBRARY_PATH: `${mount}/usr/lib` };
    return AppImageRestart.find("linux", environment, path.join(mount, "teamrun"), launchArguments, starter, processId, path.join(folder, "restart.log"));
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
