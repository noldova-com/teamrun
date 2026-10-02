/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WindowStateValue } from "@noldova/teamrun-shell-protocol";

@TestClass
export class WindowStateValueTests {
  @TestMethod
  @TestData("{\"value\":{\"width\":1280}}")
  @TestData("{\"value\":null}")
  public pinsItsWireForm(text: string): void {
    const value = WindowStateValue.fromJson(JSON.parse(text));

    Assert.areEqual(text, JSON.stringify(value.toJson()));
    Assert.areEqual(text, JSON.stringify(new WindowStateValue(value.value).toJson()));
  }

  @TestMethod
  @TestData("{}", "$.value")
  @TestData("{\"value\":1}", "$.value")
  @TestData("{\"value\":null,\"extra\":1}", "$.extra")
  public rejectsAnAnswerThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => WindowStateValue.fromJson(JSON.parse(text)), JsonException).path);
  }
}
