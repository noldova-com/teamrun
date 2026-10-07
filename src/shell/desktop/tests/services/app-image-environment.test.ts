/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { Condition } from "../fixtures/condition.fixture.js";
import { DesktopStartFixture } from "../fixtures/desktop-start.fixture.js";
import { FakeDesktopProcess } from "../fixtures/fake-desktop-process.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";

@TestClass
export class AppImageEnvironmentTests {
  @TestMethod
  public async dropsAppRunsVariablesAndItsEntriesFromThePathsItWrappedAndKeepsTheRest(): Promise<void> {
    const electron = new FakeElectron(true, true);
    const process = new FakeDesktopProcess("linux", ["/electron/electron"], {
      APPIMAGE: "/home/person/Applications/TeamRun.AppImage",
      APPDIR: "/electron",
      ARGV0: "./TeamRun.AppImage",
      OWD: "/home/person/work",
      PATH: "/electron:/electron/usr/sbin:/usr/local/bin:/usr/bin",
      XDG_DATA_DIRS: "/electron/usr/share/:/usr/local/share:/usr/share/gnome:/usr/local/share/:/usr/share/",
      LD_LIBRARY_PATH: "/electron/usr/lib:",
      GSETTINGS_SCHEMA_DIR: "/usr/share/glib-2.0/schemas",
      HOME: "/home/person"
    });
    process.isTerminal = true;

    DesktopStartFixture.start(electron, process);
    await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

    Assert.areEqual(
      JSON.stringify({ PATH: "/usr/local/bin:/usr/bin", XDG_DATA_DIRS: "/usr/local/share", GSETTINGS_SCHEMA_DIR: "/usr/share/glib-2.0/schemas", HOME: "/home/person" }),
      JSON.stringify(process.relaunched[0]?.environment));
  }
}
