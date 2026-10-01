/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RunningWork } from "@noldova/teamrun-shell-protocol";

@TestClass
export class RunningWorkTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"descriptions\":[\"A reply in Planning\",\"A command in a terminal\"]}";
    const descriptions = ["A reply in Planning", "A command in a terminal"];
    const work = new RunningWork(descriptions);
    descriptions.push("later");

    Assert.areEqual(text, JSON.stringify(work.toJson()));
    Assert.areEqual("A reply in Planning|A command in a terminal", RunningWork.fromJson(JSON.parse(text)).descriptions.join("|"));
  }

  @TestMethod
  public rejectsAnEmptyListOrABlankDescription(): void {
    Assert.throws(() => new RunningWork([]), ArgumentException);
    Assert.throws(() => new RunningWork(["work", " "]), ArgumentException);
    Assert.areEqual("$.descriptions", Assert.throws(() => RunningWork.fromJson({ descriptions: [] }), JsonException).path);
    Assert.areEqual("$.descriptions.1", Assert.throws(() => RunningWork.fromJson({ descriptions: ["work", 2] }), JsonException).path);
  }
}
