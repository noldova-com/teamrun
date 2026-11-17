/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProviderKindVersions } from "@noldova/teamrun.core";

@TestClass
export class ProviderKindVersionsTests {
  @TestMethod
  public offersTheLatestVersionOnlyWhenItIsNewerThanTheInstalledOneOrTheInstalledOneIsUnknown(): void {
    const cases: readonly [string | null, string | null, string | null][] = [
      ["2.1.211", "2.1.212", "2.1.212"],
      ["1.9.9", "1.10.0", "1.10.0"],
      ["2.1", "2.1.1", "2.1.1"],
      ["1.0.70", "1.0.62", null],
      ["2.1.211", "2.1.211", null],
      ["2.1.0", "2.1", null],
      ["2.1.211-beta.1", "2.1.211", null],
      ["2.1.211", null, null],
      [null, "2.1.212", "2.1.212"]
    ];

    for (const [installed, latest, update] of cases)
      Assert.areEqual(update, new ProviderKindVersions(installed, latest).update, `${installed} ${latest}`);
    Assert.areEqual("null null null", [ProviderKindVersions.unknown.installed, ProviderKindVersions.unknown.latest, ProviderKindVersions.unknown.update].map(String).join(" "));
  }
}
