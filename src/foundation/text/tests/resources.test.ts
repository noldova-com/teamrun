/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ArgumentOutOfRangeException,
  IndexOutOfRangeException,
} from "@noldova/teamrun-foundation-exceptions";
import { EcmaScriptLineTerminator, ReadOnlyStringSpan } from "@noldova/teamrun-foundation-text";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ResourcesTests {
  @TestMethod
  public usesTheCanonicalRangeMessages(): void {
    const lineTerminator = new EcmaScriptLineTerminator();
    const startFailure = Assert.throws(() => new ReadOnlyStringSpan("text", -1), ArgumentOutOfRangeException);
    const startBeyondSourceFailure = Assert.throws(() => new ReadOnlyStringSpan("text", 5), ArgumentOutOfRangeException);
    const lengthFailure = Assert.throws(() => new ReadOnlyStringSpan("text", 0, -1), ArgumentOutOfRangeException);
    const spanFailure = Assert.throws(() => new ReadOnlyStringSpan("text", 3, 2), ArgumentOutOfRangeException);
    const indexFailure = Assert.throws(() => new ReadOnlyStringSpan("text").get(4), IndexOutOfRangeException);
    const lineBreakIndexFailure = Assert.throws(() => lineTerminator.getLength("text", -1), ArgumentOutOfRangeException);

    Assert.areEqual("The span start must be an integer within the source range. (Parameter 'start')", startFailure.message);
    Assert.areEqual("The span start must be an integer within the source range. (Parameter 'start')", startBeyondSourceFailure.message);
    Assert.areEqual("The span length must be a non-negative integer. (Parameter 'length')", lengthFailure.message);
    Assert.areEqual("The span must be contained by its source. (Parameter 'length')", spanFailure.message);
    Assert.areEqual("The index must identify a character within the span.", indexFailure.message);
    Assert.areEqual("The line-break index must be an integer within the string. (Parameter 'index')", lineBreakIndexFailure.message);
  }
}
