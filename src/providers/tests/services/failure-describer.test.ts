/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FailureDescriber } from "@noldova/teamrun-providers";

@TestClass
export class FailureDescriberTests {
  @TestMethod
  public describesErrorsAndOtherValues(): void {
    Assert.areEqual("boom", FailureDescriber.describe(new Error("boom")));
    Assert.areEqual("42", FailureDescriber.describe(42));
  }
}
