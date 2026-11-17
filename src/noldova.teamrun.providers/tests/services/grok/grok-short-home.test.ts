/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { GrokShortHome, Resources } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class GrokShortHomeTests {
  private static readonly DEEP: string = "x".repeat(230);

  @TestMethod
  public leavesTheHomeAloneOffWindowsWithoutAFolderOrAppDataOrWhileImagesFit(): void {
    using directory = new TemporaryDirectory();
    const home = GrokShortHomeTests.home(directory);
    const local = directory.resolve("local");
    mkdirSync(local);
    const deep = `C:\\${GrokShortHomeTests.DEEP}`;

    Assert.areEqual(home, new GrokShortHome("linux").of(home, deep, { LOCALAPPDATA: local }));
    Assert.areEqual(home, new GrokShortHome("win32").of(home, null, { LOCALAPPDATA: local }));
    Assert.areEqual(home, new GrokShortHome("win32").of(home, deep, {}));
    Assert.areEqual(home, new GrokShortHome("win32").of(home, "C:\\p", { LOCALAPPDATA: local }));
    Assert.areEqual(directory.resolve("missing"), new GrokShortHome("win32").of(directory.resolve("missing"), deep, { LOCALAPPDATA: local }));
    Assert.areEqual(0, readdirSync(local).length);
  }

  @TestMethod
  public keepsTheImagesFolderWithinWindowsLimitAtTeamRunsDepthsThroughTheShortHome(): void {
    const user = "C:\\Users\\a.long.user.name.here";
    const local = `${user}\\AppData\\Local`;
    for (const data of [`${user}\\.noldova\\teamrun`, "D:\\Projects\\Noldova\\checkouts\\teamrun\\_build\\data"]) {
      const module = `${data}\\modules\\teamrun`;
      const chat = `${module}\\chats\\01a19a36-2a7d-7c5f-9588-a5c6bfb75292`;
      const short = `${local}\\${Resources.grokShortHomeFolder}\\${"0".repeat(Resources.grokShortHomeNameLength)}`;

      Assert.isTrue(GrokShortHome.imagesFolderOf(`${module}\\profiles\\grok\\Work`, chat).length > Resources.grokImagesFolderLimit, data);
      Assert.isTrue(GrokShortHome.imagesFolderOf(short, chat).length <= Resources.grokImagesFolderLimit, data);
    }
    Assert.areEqual(248, Resources.grokImagesFolderLimit);
  }

  @TestMethod
  public linksALongHomeThroughAShortFolderAndUsesTheSameLinkAgain(): void {
    using directory = new TemporaryDirectory();
    const home = GrokShortHomeTests.home(directory);
    writeFileSync(join(home, "seen"), "1");
    const local = directory.resolve("local");
    mkdirSync(local);
    const shortHome = new GrokShortHome("win32");

    const linked = shortHome.of(home, `C:\\${GrokShortHomeTests.DEEP}`, { LOCALAPPDATA: local });
    const again = shortHome.of(home, `C:\\${GrokShortHomeTests.DEEP}`, { LOCALAPPDATA: local });

    Assert.areEqual(join(local, Resources.grokShortHomeFolder), dirname(linked));
    Assert.areEqual(Resources.grokShortHomeNameLength, linked.length - dirname(linked).length - 1);
    Assert.areEqual(linked, again);
    Assert.areEqual(realpathSync(home), realpathSync(linked));
    Assert.isTrue(existsSync(join(linked, "seen")));
  }

  @TestMethod
  public fallsBackToTheHomeLeavingAtMostTheEmptyShortFolderWhenTheLinkOrItsFolderCantBeMade(): void {
    using directory = new TemporaryDirectory();
    const home = GrokShortHomeTests.home(directory);
    const local = directory.resolve("local");
    mkdirSync(local);
    const deep = `C:\\${GrokShortHomeTests.DEEP}`;
    const refused = new GrokShortHome("win32", () => { throw new Error("refused"); });
    const blocked = directory.resolve("blocked");
    writeFileSync(blocked, "");

    Assert.areEqual(home, refused.of(home, deep, { LOCALAPPDATA: local }));
    Assert.areEqual(Resources.grokShortHomeFolder, readdirSync(local).join());
    Assert.areEqual(0, readdirSync(join(local, Resources.grokShortHomeFolder)).length);
    Assert.areEqual(home, new GrokShortHome("win32").of(home, deep, { LOCALAPPDATA: blocked }));
    Assert.areEqual(home, new GrokShortHome("win32").of(home, deep, { LOCALAPPDATA: directory.resolve("absent") }));
    Assert.isFalse(existsSync(directory.resolve("absent")));

    const filled = new GrokShortHome("win32", (_target, path) => {
      writeFileSync(join(dirname(path), "other"), "");
      throw new Error("refused");
    });
    Assert.areEqual(home, filled.of(home, deep, { LOCALAPPDATA: local }));
    Assert.isTrue(existsSync(join(local, Resources.grokShortHomeFolder, "other")));
  }

  @TestMethod
  public usesTheLinkAnotherLaunchJustMade(): void {
    using directory = new TemporaryDirectory();
    const home = GrokShortHomeTests.home(directory);
    const local = directory.resolve("local");
    mkdirSync(local);
    const raced = new GrokShortHome("win32", (target, path) => {
      symlinkSync(target, path, Resources.junctionLinkType);
      throw new Error("already there");
    });

    const linked = raced.of(home, `C:\\${GrokShortHomeTests.DEEP}`, { LOCALAPPDATA: local });

    Assert.areNotEqual(home, linked);
    Assert.areEqual(realpathSync(home), realpathSync(linked));
  }

  @TestMethod
  public keepsAHomeNoLongerThanTheShortFolderWouldBeAndMakesNothing(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("h");
    mkdirSync(home);
    const local = directory.resolve("local");
    mkdirSync(local);

    Assert.areEqual(home, new GrokShortHome("win32").of(home, `C:\\${GrokShortHomeTests.DEEP}`, { LOCALAPPDATA: local }));
    Assert.areEqual(0, readdirSync(local).length);
  }

  @TestMethod
  public linksThroughTheShortFolderAnotherLaunchMadeJustBeforeThisOne(): void {
    using directory = new TemporaryDirectory();
    const home = GrokShortHomeTests.home(directory);
    const local = directory.resolve("local");
    mkdirSync(local);
    const raced = new GrokShortHome("win32", undefined, folder => {
      mkdirSync(folder);
      GrokShortHome.makeFolder(folder);
    });

    const linked = raced.of(home, `C:\\${GrokShortHomeTests.DEEP}`, { LOCALAPPDATA: local });

    Assert.areEqual(join(local, Resources.grokShortHomeFolder), dirname(linked));
    Assert.areEqual(realpathSync(home), realpathSync(linked));
  }

  @TestMethod
  public leavesALinkToAnotherHomeAloneAndKeepsTheHome(): void {
    using directory = new TemporaryDirectory();
    const home = GrokShortHomeTests.home(directory);
    const other = directory.resolve("other");
    mkdirSync(other);
    const local = directory.resolve("local");
    mkdirSync(local);
    const deep = `C:\\${GrokShortHomeTests.DEEP}`;
    let taken = "";
    new GrokShortHome("win32", (_target, path) => {
      taken = path;
      throw new Error("refused");
    }).of(home, deep, { LOCALAPPDATA: local });
    mkdirSync(dirname(taken), { recursive: true });
    symlinkSync(other, taken, Resources.junctionLinkType);

    Assert.areEqual(home, new GrokShortHome("win32").of(home, deep, { LOCALAPPDATA: local }));
    Assert.areEqual(realpathSync(other), realpathSync(taken));
  }

  private static home(directory: TemporaryDirectory): string {
    const home = directory.resolve("data", "modules", "teamrun", "profiles", "grok", "a-provider-folder-name");
    mkdirSync(home, { recursive: true });
    return home;
  }
}
