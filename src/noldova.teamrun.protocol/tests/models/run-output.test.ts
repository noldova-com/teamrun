/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RunOutput } from "@noldova/teamrun.protocol";

@TestClass
export class RunOutputTests {
  private static readonly json: object = { chatId: "c1", messageId: "m3", site: "body", block: 2, output: { lines: [{ text: "$ ls" }], cutLines: 0 } };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = RunOutput.fromJson(RunOutputTests.json);

    Assert.areEqual(JSON.stringify(RunOutputTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public keepsItsOwnCopyOfTheOutput(): void {
    const output = { lines: [{ text: "$ ls" }], cutLines: 0 };
    const value = new RunOutput("c1", "m3", "body", 0, output);
    output.cutLines = 4;
    const rendered = value.toJson();
    Reflect.set(rendered, "output", null);

    Assert.areEqual(JSON.stringify({ lines: [{ text: "$ ls" }], cutLines: 0 }), JSON.stringify(value.output));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new RunOutput(String.empty, "m3", "body", 0, {}), ArgumentException);
    Assert.throws(() => new RunOutput("c1", " ", "body", 0, {}), ArgumentException);
    Assert.throws(() => new RunOutput("c1", "m3", String.empty, 0, {}), ArgumentException);
    Assert.throws(() => new RunOutput("c1", "m3", "body", -1, {}), ArgumentOutOfRangeException);
    Assert.throws(() => new RunOutput("c1", "m3", "body", 1.5, {}), ArgumentOutOfRangeException);
    Assert.areEqual(0, new RunOutput("c1", "m3", "body", 0, {}).block);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const blank = Assert.throws(() => RunOutput.fromJson({ ...RunOutputTests.json, site: String.empty }), JsonException);
    const text = Assert.throws(() => RunOutput.fromJson({ ...RunOutputTests.json, output: "lines" }), JsonException);

    Assert.areEqual(JSON.stringify(["$.site", "$.output"]), JSON.stringify([blank.path, text.path]));
  }
}
