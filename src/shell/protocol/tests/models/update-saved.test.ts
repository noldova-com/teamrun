/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateSaved } from "@noldova/teamrun-shell-protocol";

@TestClass
export class UpdateSavedTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"processId\":4120,\"problems\":[\"The main window's Notes failed to save.\"]}";
    const problems = ["The main window's Notes failed to save."];
    const saved = new UpdateSaved(4120, problems);
    problems.push("later");

    Assert.areEqual(text, JSON.stringify(saved.toJson()));
    Assert.areEqual(text, JSON.stringify(UpdateSaved.fromJson(JSON.parse(text)).toJson()));
    Assert.areEqual("{\"processId\":7,\"problems\":[]}", JSON.stringify(new UpdateSaved(7, []).toJson()));
  }

  @TestMethod
  public rejectsAnInvalidProcessIdABlankProblemOrAnUnknownField(): void {
    Assert.throws(() => new UpdateSaved(0, []), ArgumentOutOfRangeException);
    Assert.throws(() => new UpdateSaved(1.5, []), ArgumentOutOfRangeException);
    Assert.throws(() => new UpdateSaved(1, [" "]), ArgumentException);
    Assert.areEqual("$.processId", Assert.throws(() => UpdateSaved.fromJson({ processId: -1, problems: [] }), JsonException).path);
    Assert.areEqual("$.problems.0", Assert.throws(() => UpdateSaved.fromJson({ processId: 1, problems: [2] }), JsonException).path);
    Assert.areEqual("$.client", Assert.throws(() => UpdateSaved.fromJson({ processId: 1, problems: [], client: "cli" }), JsonException).path);
  }

  @TestMethod
  public takesAtMostAHundredProblemsOfAtMostAThousandCharacters(): void {
    const most = new UpdateSaved(1, Array.from({ length: 100 }, () => "x".repeat(1_000)));

    Assert.areEqual(100, most.problems.length);
    Assert.throws(() => new UpdateSaved(1, Array.from({ length: 101 }, () => "x")), ArgumentOutOfRangeException);
    Assert.throws(() => new UpdateSaved(1, ["x".repeat(1_001)]), ArgumentOutOfRangeException);
    Assert.areEqual("$.problems", Assert.throws(() => UpdateSaved.fromJson({ processId: 1, problems: Array.from({ length: 101 }, () => "x") }), JsonException).path);
  }
}
