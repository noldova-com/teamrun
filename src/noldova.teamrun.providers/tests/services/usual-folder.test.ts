/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { homedir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsualFolder } from "@noldova/teamrun.providers";

@TestClass
export class UsualFolderTests {
  @TestMethod
  public takesTheVariablesFolderWhenItIsSetAndTheHomeFoldersOneOtherwise(): void {
    Assert.areEqual("/work/codex", UsualFolder.of({ CODEX_HOME: "/work/codex" }, "CODEX_HOME", ".codex", "/home/person"));
    Assert.areEqual(join("/home/person", ".codex"), UsualFolder.of({}, "CODEX_HOME", ".codex", "/home/person"));
    Assert.areEqual(join("/home/person", ".codex"), UsualFolder.of({ CODEX_HOME: "  " }, "CODEX_HOME", ".codex", "/home/person"));
    Assert.areEqual(join("/home/person", ".copilot"), UsualFolder.of({ COPILOT_HOME: "/work/copilot" }, null, ".copilot", "/home/person"));
    Assert.areEqual(join(homedir(), ".claude"), UsualFolder.of({}, "CLAUDE_CONFIG_DIR", ".claude"));
  }

  @TestMethod
  public takesTheHomeFromUserProfileOnWindowsAndFromHomeElsewhereOrTheSystemsWhenItIsUnset(): void {
    const environment = { HOME: "/home/person", USERPROFILE: "C:/Users/person" };

    Assert.areEqual("C:/Users/person", UsualFolder.home(environment, "win32"));
    Assert.areEqual("/home/person", UsualFolder.home(environment, "linux"));
    Assert.areEqual(homedir(), UsualFolder.home({ HOME: "  ", USERPROFILE: "C:/Users/person" }, "darwin"));
    Assert.areEqual(homedir(), UsualFolder.home({ HOME: "/home/person" }, "win32"));
  }

  @TestMethod
  public placesTheHomeFoldersOneFirstThenTheVariablesFolderWhenItIsSetToAnother(): void {
    const usual = join("/home/person", ".codex");

    Assert.areEqual([usual, "/work/codex"].join(), UsualFolder.places({ CODEX_HOME: "/work/codex" }, "CODEX_HOME", ".codex", "/home/person").join());
    Assert.areEqual(usual, UsualFolder.places({}, "CODEX_HOME", ".codex", "/home/person").join());
    Assert.areEqual(usual, UsualFolder.places({ CODEX_HOME: " " }, "CODEX_HOME", ".codex", "/home/person").join());
    Assert.areEqual(usual, UsualFolder.places({ CODEX_HOME: "work/codex" }, "CODEX_HOME", ".codex", "/home/person").join());
    Assert.areEqual(usual, UsualFolder.places({ CODEX_HOME: usual }, "CODEX_HOME", ".codex", "/home/person").join());
    Assert.areEqual(join(homedir(), ".claude"), UsualFolder.places({}, "CLAUDE_CONFIG_DIR", ".claude").join());
  }

  @TestMethod
  public placesAFolderAtTheVariablesAbsolutePathElseInTheHomeFolder(): void {
    const usual = join("/home/person", ".config");

    Assert.areEqual(JSON.stringify(["/work/config", usual, usual, usual]), JSON.stringify([
      UsualFolder.place({ XDG_CONFIG_HOME: "/work/config" }, "XDG_CONFIG_HOME", ".config", "/home/person"),
      UsualFolder.place({ XDG_CONFIG_HOME: "work/config" }, "XDG_CONFIG_HOME", ".config", "/home/person"),
      UsualFolder.place({ XDG_CONFIG_HOME: " " }, "XDG_CONFIG_HOME", ".config", "/home/person"),
      UsualFolder.place({}, "XDG_CONFIG_HOME", ".config", "/home/person")]));
  }
}
