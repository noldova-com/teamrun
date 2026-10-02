/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import path from "node:path";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TaskbarIdentity } from "@noldova/teamrun-shell-desktop";

@TestClass
export class TaskbarIdentityTests {
  private static readonly WORK: string = path.resolve("work folder");
  private static readonly PROGRAM: string = path.resolve("Team Run", "TeamRun.exe");

  @TestMethod
  public relaunchesAPackagedBuildByItsProgramWithItsPathsMadeAbsolute(): void {
    const data = path.resolve("data");
    const identity = TaskbarIdentity.create(true, TaskbarIdentityTests.PROGRAM, "main.js", [
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
  public relaunchesADevelopmentBuildWithItsMainScriptMadeAbsoluteUnderItsOwnAppId(): void {
    const identity = TaskbarIdentity.create(false, TaskbarIdentityTests.PROGRAM, "main.js", [], TaskbarIdentityTests.WORK);
    const command = `"${TaskbarIdentityTests.PROGRAM}" "${path.join(TaskbarIdentityTests.WORK, "main.js")}"`;

    Assert.areEqual("com.noldova.teamrun.development", identity.appId);
    Assert.areEqual(command, identity.relaunchCommand);
    Assert.areEqual(JSON.stringify({
      appId: "com.noldova.teamrun.development",
      appIconPath: TaskbarIdentityTests.PROGRAM,
      appIconIndex: 0,
      relaunchCommand: command,
      relaunchDisplayName: "TeamRun"
    }), JSON.stringify(identity.toAppDetails()));
  }

  @TestMethod
  @TestData(" ", "icon.exe", "\"icon.exe\"")
  @TestData("com.noldova.teamrun", "", "\"icon.exe\"")
  @TestData("com.noldova.teamrun", "icon.exe", " ")
  public refusesABlankPart(appId: string, iconPath: string, relaunchCommand: string): void {
    Assert.throws(() => new TaskbarIdentity(appId, iconPath, relaunchCommand), ArgumentException);
  }
}
