/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CursorPermissions, CursorProfile } from "@noldova/teamrun.providers";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class CursorProfileTests {
  @TestMethod
  public makesItsFoldersAndConfigAndRefusesAFolderTeamRunDoesntManage(): void {
    using directory = new TemporaryDirectory();
    Assert.throws(() => new CursorProfile("relative"), ArgumentException);
    const profile = new CursorProfile(directory.resolve("managed"));

    profile.prepare();
    writeFileSync(directory.resolve("managed", "cursor-owned.fixture"), "preserve");
    profile.prepare();

    Assert.areEqual("preserve", readFileSync(directory.resolve("managed", "cursor-owned.fixture"), "utf8"));
    Assert.areEqual(JSON.stringify(process.platform === "win32" ? { CURSOR_DATA_DIR: directory.resolve("managed", "data"),
      APPDATA: directory.resolve("managed", "home", "AppData", "Roaming") } : process.platform === "darwin" ? { CURSOR_DATA_DIR: directory.resolve("managed", "data") }
      : { CURSOR_DATA_DIR: directory.resolve("managed", "data"), XDG_CONFIG_HOME: directory.resolve("managed", "home", ".config") }), JSON.stringify(profile.folders));
    Assert.areEqual(JSON.stringify([["CURSOR_DATA_DIR", "XDG_CONFIG_HOME"], ["CURSOR_DATA_DIR"], ["CURSOR_DATA_DIR", "APPDATA"], ["CURSOR_DATA_DIR", "XDG_CONFIG_HOME"]]),
      JSON.stringify(["linux", "darwin", "win32", "freebsd"].map(t => Object.keys(new CursorProfile(directory.resolve("managed"), t).folders))));
    for (const folder of Object.values(profile.folders))
      Assert.isTrue(statSync(folder).isDirectory(), folder);
    Assert.areEqual("TeamRun Cursor profile v1\n", readFileSync(directory.resolve("managed", ".teamrun-managed-profile"), "utf8"));
    if (process.platform !== "win32")
      Assert.areEqual(0o600, statSync(directory.resolve("managed", "cli-config.json")).mode & 0o777);
    writeFileSync(directory.resolve("managed", ".teamrun-managed-profile"), "TeamRun Grok profile v1\n");
    Assert.throws(() => profile.prepare(), Error);
    mkdirSync(directory.resolve("own"));
    writeFileSync(directory.resolve("own", "cli-config.json"), "unchanged");
    Assert.throws(() => new CursorProfile(directory.resolve("own")).prepare(), Error);
    Assert.areEqual("unchanged", readFileSync(directory.resolve("own", "cli-config.json"), "utf8"));
    Assert.isFalse(existsSync(directory.resolve("own", "data")));
  }

  @TestMethod
  public turnsOffUpdatesAndAllowsOnlyTheApprovedTeamRunTools(): void {
    using directory = new TemporaryDirectory();
    const profile = new CursorProfile(directory.resolve("managed"));
    const config = (): string => readFileSync(directory.resolve("managed", "cli-config.json"), "utf8");

    profile.prepare(["open_panel", "teamrun_*", "terminal run", "a)b", "*"]);
    const approved = config();
    profile.prepare();

    Assert.areEqual(JSON.stringify({ version: 1, channel: "static", approvalMode: "allowlist", permissions: { allow: ["Mcp(teamrun:open_panel)"], deny: [] } }),
      JSON.stringify(JSON.parse(approved)));
    Assert.areEqual("[]", JSON.stringify((JSON.parse(config()) as { permissions: { allow: readonly string[] } }).permissions.allow));
  }

  @TestMethod
  public writesThePersonsRulesBeforeTheApprovedTeamRunToolsEachOnce(): void {
    using directory = new TemporaryDirectory();
    const profile = new CursorProfile(directory.resolve("managed"));

    profile.prepare(["open_panel"], new CursorPermissions(["Shell(ls)", "Mcp(teamrun:open_panel)"], ["Shell(rm)"]));

    Assert.areEqual(JSON.stringify({ allow: ["Shell(ls)", "Mcp(teamrun:open_panel)"], deny: ["Shell(rm)"] }),
      JSON.stringify((JSON.parse(readFileSync(directory.resolve("managed", "cli-config.json"), "utf8")) as { permissions: unknown }).permissions));
  }

  @TestMethod
  public makesAnEmptyTitleHomeForHomeOnLinuxHomeAndUserProfileOnWindowsAndNoneOnMacOs(): void {
    using directory = new TemporaryDirectory();
    const titleHome = directory.resolve("managed", "title-home");
    const homes = (platform: string): string => JSON.stringify(new CursorProfile(directory.resolve("managed"), platform).titleHomes);

    new CursorProfile(directory.resolve("managed"), "linux").prepare();

    Assert.areEqual(JSON.stringify({ HOME: titleHome }), homes("linux"));
    Assert.areEqual(JSON.stringify({ HOME: titleHome, USERPROFILE: titleHome }), homes("win32"));
    Assert.areEqual("{}", homes("darwin"));
    Assert.areEqual(JSON.stringify({ HOME: titleHome }), homes("freebsd"));
    Assert.areEqual("", readdirSync(titleHome).join(","));
  }
}
