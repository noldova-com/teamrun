/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QuestionOption } from "@noldova/teamrun.protocol";

@TestClass
export class QuestionOptionTests {
  @TestMethod
  public holdsALabelAndItsDescription(): void {
    const option = new QuestionOption("Desktop app", "A window with a side panel");

    Assert.areEqual("Desktop app", option.label);
    Assert.areEqual("A window with a side panel", option.description);
    Assert.areEqual(String.empty, new QuestionOption("Web page", String.empty).description);
  }

  @TestMethod
  public rejectsABlankLabel(): void {
    Assert.throws(() => new QuestionOption(" ", "Nothing"), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJsonAndReportsAMissingDescription(): void {
    const json = { label: "Web page", description: "Runs in the browser" };
    const missing = Assert.throws(() => QuestionOption.fromJson({ label: "Web page" }, "$.options.1"), JsonException);

    Assert.areEqual(JSON.stringify(json), JSON.stringify(QuestionOption.fromJson(json).toJson()));
    Assert.areEqual("$.options.1.description", missing.path);
  }
}
