/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TaskbarIdentity } from "@noldova/teamrun-shell-desktop";

@TestClass
export class TaskbarIdentityTests {
  private static readonly WORK: string = path.resolve("work folder");
  private static readonly PROGRAM: string = path.resolve("Team Run", "TeamRun.exe");
  private static readonly ICON: string = path.resolve("checkout", "assets", "icons", "icon-dark.ico");

  @TestMethod
  public relaunchesAPackagedBuildByItsProgramWithItsPathsMadeAbsoluteAndShowsTheProgramsIcon(): void {
    const data = path.resolve("data");
    const identity = TaskbarIdentity.create(true, TaskbarIdentityTests.PROGRAM, TaskbarIdentityTests.ICON, "main.js", [
      TaskbarIdentityTests.PROGRAM,
      `--data-dir=${data}`,
      "--inspect=0",
      "--user-data-dir=../teamrun-look",
      "--device-dir=device"
    ], TaskbarIdentityTests.WORK);

    Assert.areEqual("com.noldova.teamrun", identity.appId);
    Assert.areEqual(TaskbarIdentityTests.PROGRAM, identity.iconPath);
    Assert.areEqual([
      `"${TaskbarIdentityTests.PROGRAM}"`,
      `"--data-dir=${data}"`,
      `"--user-data-dir=${path.resolve(TaskbarIdentityTests.WORK, "..", "teamrun-look")}"`,
      `"--device-dir=${path.join(TaskbarIdentityTests.WORK, "device")}"`
    ].join(" "), identity.relaunchCommand);
  }

  @TestMethod
  public relaunchesADevelopmentBuildWithItsMainScriptMadeAbsoluteUnderItsOwnAppIdAndShowsTheIconFile(): void {
    const identity = TaskbarIdentity.create(false, TaskbarIdentityTests.PROGRAM, TaskbarIdentityTests.ICON, "main.js", [], TaskbarIdentityTests.WORK);
    const command = `"${TaskbarIdentityTests.PROGRAM}" "${path.join(TaskbarIdentityTests.WORK, "main.js")}"`;
    const checkout = path.resolve(TaskbarIdentityTests.WORK, "..", "..", "..");
    const appId = `com.noldova.teamrun.development.${createHash("sha256").update(checkout).digest("hex").slice(0, 8)}`;

    Assert.areEqual(appId, identity.appId);
    Assert.areEqual(command, identity.relaunchCommand);
    Assert.areEqual(JSON.stringify({
      appId,
      appIconPath: TaskbarIdentityTests.ICON,
      appIconIndex: 0,
      relaunchCommand: command,
      relaunchDisplayName: "TeamRun"
    }), JSON.stringify(identity.toAppDetails()));
  }

  @TestMethod
  public async givesALinkedCheckoutTheIdOfTheFolderItLinksTo(): Promise<void> {
    const root = await mkdtemp(path.join(tmpdir(), "teamrun-taskbar-"));
    try {
      const checkout = path.join(root, "checkout");
      const linked = path.join(root, "linked");
      await mkdir(checkout);
      await symlink(checkout, linked, "junction");
      const appId = (folder: string): string =>
        TaskbarIdentity.create(false, TaskbarIdentityTests.PROGRAM, TaskbarIdentityTests.ICON, path.join(folder, "node_modules", "@noldova", "teamrun-shell-desktop", "main.js"), [], TaskbarIdentityTests.WORK).appId;

      Assert.areEqual(appId(checkout), appId(linked));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public givesEachCheckoutItsOwnDevelopmentAppIdAndAPackagedBuildThePlainOne(): void {
    const appId = (checkout: string, isPackaged: boolean = false): string =>
      TaskbarIdentity.create(isPackaged, TaskbarIdentityTests.PROGRAM, TaskbarIdentityTests.ICON, path.join(checkout, "node_modules", "@noldova", "teamrun-shell-desktop", "main.js"), [], TaskbarIdentityTests.WORK).appId;
    const first = path.resolve("lanes", "first");

    Assert.isTrue(/^com\.noldova\.teamrun\.development\.[0-9a-f]{8}$/.test(appId(first)));
    Assert.areEqual(appId(first), appId(path.join(first, "..", "first")));
    Assert.areNotEqual(appId(first), appId(path.resolve("lanes", "second")));
    Assert.areEqual("com.noldova.teamrun", appId(first, true));
    Assert.areEqual("com.noldova.teamrun", appId(path.resolve("lanes", "second"), true));
  }

  @TestMethod
  @TestData(" ", "icon.exe", "\"icon.exe\"")
  @TestData("com.noldova.teamrun", "", "\"icon.exe\"")
  @TestData("com.noldova.teamrun", "icon.exe", " ")
  public refusesABlankPart(appId: string, iconPath: string, relaunchCommand: string): void {
    Assert.throws(() => new TaskbarIdentity(appId, iconPath, relaunchCommand), ArgumentException);
  }
}
