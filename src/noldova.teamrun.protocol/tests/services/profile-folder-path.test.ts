/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProfileFolderPath } from "@noldova/teamrun.protocol";

@TestClass
export class ProfileFolderPathTests {
  @TestMethod
  public findsTheSameFolderWithoutItsEndsSeparatorsAndAWindowsPathInAnyCase(): void {
    const same: readonly (readonly [string, string])[] = [
      ["/home/person/.codex", "/home/person/.codex"], ["/home/person/.codex/", "/home/person/.codex"], [" /home/person/.codex ", "/home/person/.codex//"],
      ["C:\\Users\\Person\\.codex", "c:\\users\\person\\.codex\\"], ["C:\\Users\\Person\\.codex", "C:/Users/Person/.codex"],
      ["\\\\server\\share\\.codex", "\\\\SERVER\\share\\.codex"]];
    const different: readonly (readonly [string, string])[] = [
      ["/home/person/.codex", "/home/Person/.codex"], ["/home/person/.codex", "/home/person/.codex-work"], ["C:\\Users\\Person\\.codex", "D:\\Users\\Person\\.codex"],
      ["/home/person/.codex", "/home/person"]];

    Assert.areEqual(same.map(() => "true").join(","), same.map(([first, second]) => String(ProfileFolderPath.isSame(first, second))).join(","));
    Assert.areEqual(different.map(() => "false").join(","), different.map(([first, second]) => String(ProfileFolderPath.isSame(first, second))).join(","));
  }
}
