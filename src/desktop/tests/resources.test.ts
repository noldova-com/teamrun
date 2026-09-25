/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Assert, Skip, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Resources } from "@noldova/teamrun-desktop";

@TestClass
export class ResourcesTests {
  @TestMethod
  public formatsMessages(): void {
    Assert.areEqual("The runtime could not be reached. why", Resources.formatRuntimeFailure("why"));
    Assert.areEqual("Screenshot written to shot.png.", Resources.formatScreenshotWritten("shot.png"));
  }

  @TestMethod
  public namesTheUpdateInformationOfEachTarget(): void {
    Assert.areEqual("windows-x64", Resources.formatUpdateTarget("win32", "x64"));
    Assert.areEqual("mac-arm64", Resources.formatUpdateTarget("darwin", "arm64"));
    Assert.areEqual("linux-arm64", Resources.formatUpdateTarget("linux", "arm64"));
    Assert.areEqual("latest-windows-arm64.yml", Resources.formatUpdateInfoName("windows-arm64"));
  }

  @TestMethod
  public carriesTheStampedProductVersion(): void {
    Assert.isFalse(Resources.productVersion.includes("__"));
    Assert.isTrue(Resources.productVersion.length > 0);
  }

  @TestMethod
  public preloadRepeatsTheChannelNames(): void {
    const preloadPath = createRequire(import.meta.url).resolve("@noldova/teamrun-desktop/preload.cjs");
    const preload = readFileSync(preloadPath, "utf8");

    const channels = [
      Resources.invokeChannel, Resources.eventChannel, Resources.openExternalChannel, Resources.pickDirectoryChannel, Resources.infoChannel,
      Resources.titleBarChannel, Resources.imageChannel
    ];
    for (const channel of channels)
      Assert.isTrue(preload.includes(`"${channel}"`), channel);
  }
}

@TestClass
export class AppImageRestartTests {
  private static readonly RECORD_VARIABLE: string = "TEAMRUN_RESTART_RECORD";
  private static readonly DEADLINE_MILLISECONDS: number = 10_000;

  @TestMethod
  public async startsTheAppImageWithoutInheritedDescriptorsAfterTheProcessExits(): Promise<void> {
    await AppImageRestartTests.run(50, async (holder, helper, record) => {
      await delay(500);
      Assert.isFalse(existsSync(record));
      holder.kill();
      await once(helper, "exit", { signal: AbortSignal.timeout(AppImageRestartTests.DEADLINE_MILLISECONDS) });
      Assert.areEqual("0\n0\n1\n2\n3\n", await readFile(record, "utf8"));
    });
  }

  @TestMethod
  public async startsTheAppImageWhenTheProcessDoesNotExitInTime(): Promise<void> {
    await AppImageRestartTests.run(3, async (holder, helper, record) => {
      await once(helper, "exit", { signal: AbortSignal.timeout(AppImageRestartTests.DEADLINE_MILLISECONDS) });
      Assert.isNull(holder.exitCode);
      Assert.isTrue(existsSync(record));
    });
  }

  private static async run(polls: number, verify: (holder: ChildProcess, helper: ChildProcess, record: string) => Promise<void>): Promise<void> {
    const directory = await mkdtemp(join(tmpdir(), "teamrun restart "));
    const first = await open(join(directory, "first"), "w");
    const second = await open(join(directory, "second"), "w");
    const holder = spawn("sleep", ["30"], { stdio: "ignore" });
    let helper: ChildProcess | null = null;
    try {
      const record = join(directory, "record");
      const appImage = join(directory, "Team Run.AppImage");
      const variable = AppImageRestartTests.RECORD_VARIABLE;
      await writeFile(appImage, `#!/usr/bin/env bash\nprintf '%s\\n' "$#" > "$${variable}"\nexec ls /proc/self/fd >> "$${variable}"\n`, { mode: 0o755 });
      Assert.isDefined(holder.pid);
      helper = spawn(Resources.appImageRestartShell, Resources.formatAppImageRestartArguments(appImage, holder.pid, polls),
        { stdio: ["ignore", "ignore", "ignore", first.fd, second.fd], env: { ...process.env, [variable]: record } });
      await verify(holder, helper, record);
    }
    finally {
      helper?.kill();
      holder.kill();
      await first.close();
      await second.close();
      await rm(directory, { recursive: true, force: true });
    }
  }
}

if (process.platform !== Resources.linuxPlatform) {
  const reason = "The AppImage restart runs only on Linux.";
  Skip(reason)(AppImageRestartTests.prototype.startsTheAppImageWithoutInheritedDescriptorsAfterTheProcessExits);
  Skip(reason)(AppImageRestartTests.prototype.startsTheAppImageWhenTheProcessDoesNotExitInTime);
}
