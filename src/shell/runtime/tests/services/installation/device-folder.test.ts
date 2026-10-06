/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DeviceFolder } from "@noldova/teamrun-shell-runtime";

@TestClass
export class DeviceFolderTests {
  @TestMethod
  public isInTheOperatingSystemsLocalApplicationData(): void {
    Assert.areEqual(path.join("C:\Users\person\AppData\Local", "Noldova", "TeamRun"), DeviceFolder.locate("win32", { LOCALAPPDATA: "C:\Users\person\AppData\Local" }, "C:\Users\person"));
    Assert.areEqual(path.join("C:\Users\person", "AppData", "Local", "Noldova", "TeamRun"), DeviceFolder.locate("win32", {}, "C:\Users\person"));
    Assert.areEqual(path.join("/Users/person", "Library", "Application Support", "Noldova", "TeamRun"), DeviceFolder.locate("darwin", {}, "/Users/person"));
    Assert.areEqual(path.join("/state", "noldova", "teamrun"), DeviceFolder.locate("linux", { XDG_STATE_HOME: "/state" }, "/home/person"));
    Assert.areEqual(path.join("/home/person", ".local", "state", "noldova", "teamrun"), DeviceFolder.locate("linux", { XDG_STATE_HOME: " " }, "/home/person"));
    Assert.areEqual(path.join("/home/person", ".local", "state", "noldova", "teamrun"), DeviceFolder.locate("linux", {}, "/home/person"));
  }
}
