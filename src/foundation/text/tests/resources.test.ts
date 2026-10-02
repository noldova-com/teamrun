/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { EcmaScriptLineTerminator } from "@noldova/teamrun-foundation-text";

@TestClass
export class ResourcesTests {
  @TestMethod
  public usesTheCanonicalLineBreakIndexMessage(): void {
    const failure = Assert.throws(() => new EcmaScriptLineTerminator().getLength("text", -1), ArgumentOutOfRangeException);

    Assert.areEqual("The line-break index must be an integer within the string. (Parameter 'index')", failure.message);
  }
}
