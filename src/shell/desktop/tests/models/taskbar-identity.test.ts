/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TaskbarIdentity } from "@noldova/teamrun-shell-desktop";

@TestClass
export class TaskbarIdentityTests {
  private static readonly ARGUMENTS: readonly string[] = ["C:\TeamRun\TeamRun.exe", "--data-dir=D:\data", "--inspect=0", "--user-data-dir=D:\profile", "--device-dir=D:\device"];

  @TestMethod
  public relaunchesAPackagedBuildByItsProgramUnderTheProductsAppId(): void {
    const identity = TaskbarIdentity.create(true, "C:\TeamRun\TeamRun.exe", "C:\TeamRun\resources\main.js", TaskbarIdentityTests.ARGUMENTS);

    Assert.areEqual("com.noldova.teamrun", identity.appId);
    Assert.areEqual("C:\TeamRun\TeamRun.exe", identity.iconPath);
    Assert.areEqual("\"C:\TeamRun\TeamRun.exe\" \"--data-dir=D:\data\" \"--user-data-dir=D:\profile\" \"--device-dir=D:\device\"", identity.relaunchCommand);
  }

  @TestMethod
  public relaunchesADevelopmentBuildWithItsMainScriptUnderItsOwnAppId(): void {
    const identity = TaskbarIdentity.create(false, "D:\checkout\electron.exe", "D:\checkout\main.js", ["D:\checkout\electron.exe", "D:\checkout\main.js"]);

    Assert.areEqual("com.noldova.teamrun.development", identity.appId);
    Assert.areEqual("\"D:\checkout\electron.exe\" \"D:\checkout\main.js\"", identity.relaunchCommand);
    Assert.areEqual(JSON.stringify({
      appId: "com.noldova.teamrun.development",
      appIconPath: "D:\checkout\electron.exe",
      appIconIndex: 0,
      relaunchCommand: "\"D:\checkout\electron.exe\" \"D:\checkout\main.js\"",
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
