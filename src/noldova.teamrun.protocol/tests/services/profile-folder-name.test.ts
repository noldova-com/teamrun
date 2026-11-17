/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProfileFolderName } from "@noldova/teamrun.protocol";

@TestClass
export class ProfileFolderNameTests {
  @TestMethod
  public namesAFolderAfterTheLabelWithWhatEveryFileSystemAccepts(): void {
    const labels: readonly (readonly [string, string])[] = [
      ["Work", "Work"], ["a/b\\c:d*e?f\"g<h>i|j\u0001k", "a-b-c-d-e-f-g-h-i-j-k"], ["  ..Team. .", "Team"], ["CON", "_CON"], ["nul.txt", "_nul.txt"],
      ["lpt9", "_lpt9"], ["COM0", "_COM0"], ["lpt0.log", "_lpt0.log"], ["COM¹", "_COM¹"], ["lpt²", "_lpt²"],
      ["COM³.txt", "_COM³.txt"], ["COM10", "COM10"], ["COM⁴", "COM⁴"], ["Console", "Console"], ["x".repeat(70), "x".repeat(60)], ["\u{1F600}".repeat(70), "\u{1F600}".repeat(60)],
      [`${"a".repeat(59)}. b`, "a".repeat(59)], ["Équipe à 2", "Équipe à 2"]];

    Assert.areEqual(labels.map(([, name]) => name).join("\n"), labels.map(([label]) => ProfileFolderName.of(label)).join("\n"));
  }

  @TestMethod
  public namesNoFolderWhenTheLabelLeavesNoCharacterAFolderNameCanUse(): void {
    for (const label of [". . .", "   ", ""])
      Assert.isNull(ProfileFolderName.of(label));
  }
}
