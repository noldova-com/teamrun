/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ComposerDefaultSaveParams } from "@noldova/teamrun.protocol";

@TestClass
export class ComposerDefaultSaveParamsTests {
  @TestMethod
  public roundTripsAChoiceThroughJsonAsItIs(): void {
    const json = { choice: { kind: "codex", model: "gpt-5", effort: "high", providerId: "a1", teammateId: null }, onlyIfNone: true };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(ComposerDefaultSaveParams.fromJson(json).toJson()));
    Assert.isFalse(ComposerDefaultSaveParams.fromJson({ choice: {} }).onlyIfNone);
    Assert.areEqual("$.onlyIfNone", Assert.throws(() => ComposerDefaultSaveParams.fromJson({ choice: {}, onlyIfNone: "yes" }), JsonException).path);
  }

  @TestMethod
  public rejectsAMissingChoiceOrOneThatIsNotAnObjectWithItsPath(): void {
    for (const json of [{}, { choice: null }, { choice: ["codex"] }, { choice: "{}" }])
      Assert.areEqual("$.choice", Assert.throws(() => ComposerDefaultSaveParams.fromJson(json), JsonException).path);
  }
}
