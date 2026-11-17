/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CursorEnvironment, CursorProfile } from "@noldova/teamrun.providers";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class CursorEnvironmentTests {
  @TestMethod
  public pointsCursorsFoldersIntoTheProfileAndLeavesOutThePersonsKeysAndCursorSettings(): void {
    using directory = new TemporaryDirectory();
    const base = { PATH: "/bin", HOME: "/home/person", CURSOR_API_KEY: "fixture", CURSOR_CONFIG_DIR: "/personal", CURSOR_AUTH_TOKEN: "fixture", OPENAI_API_KEY: "fixture",
      GITHUB_TOKEN: "fixture", CLAUDE_CONFIG_DIR: "/personal/.claude", COPILOT_HOME: "/personal/.copilot", GH_HOST: "github.example", OPENROUTER_BASE_URL: "fixture",
      XDG_CONFIG_HOME: "/personal/.config", APPDATA: "/personal/AppData/Roaming", TEAMRUN_TEST_VARIABLE: "kept" };
    const built = (platform: string): string => JSON.stringify(Object.fromEntries(Object.entries(CursorEnvironment.build(base,
      new CursorProfile(directory.resolve("managed"), platform))).sort(([a], [b]) => a < b ? -1 : 1)));
    const kept = { CURSOR_CONFIG_DIR: directory.resolve("managed"), CURSOR_DATA_DIR: directory.resolve("managed", "data"), HOME: "/home/person", NO_COLOR: "1",
      NO_OPEN_BROWSER: "1", PATH: "/bin", TEAMRUN_TEST_VARIABLE: "kept" };

    Assert.areEqual(JSON.stringify({ APPDATA: "/personal/AppData/Roaming", ...kept, XDG_CONFIG_HOME: directory.resolve("managed", "home", ".config") }), built("linux"));
    Assert.areEqual(JSON.stringify({ APPDATA: "/personal/AppData/Roaming", ...kept, XDG_CONFIG_HOME: "/personal/.config" }), built("darwin"));
    Assert.areEqual(JSON.stringify({ APPDATA: directory.resolve("managed", "home", "AppData", "Roaming"), ...kept, XDG_CONFIG_HOME: "/personal/.config" }), built("win32"));
  }

  @TestMethod
  public pointsTheHomeOfATitleSessionAtTheProfilesEmptyTitleHomeExceptOnMacOs(): void {
    using directory = new TemporaryDirectory();
    const base = { PATH: "/bin", HOME: "/home/person", USERPROFILE: "/profiles/person" };
    const homes = (platform: string, titleSession: boolean): string => {
      const built = CursorEnvironment.build(base, new CursorProfile(directory.resolve("managed"), platform), titleSession);
      return JSON.stringify([built["HOME"], built["USERPROFILE"]]);
    };
    const titleHome = directory.resolve("managed", "title-home");

    Assert.areEqual(JSON.stringify([titleHome, "/profiles/person"]), homes("linux", true));
    Assert.areEqual(JSON.stringify([titleHome, titleHome]), homes("win32", true));
    Assert.areEqual(JSON.stringify(["/home/person", "/profiles/person"]), homes("darwin", true));
    for (const platform of ["linux", "win32", "darwin"])
      Assert.areEqual(JSON.stringify(["/home/person", "/profiles/person"]), homes(platform, false), platform);
  }
}
