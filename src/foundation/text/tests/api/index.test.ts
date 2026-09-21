/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import * as api from "@noldova/teamrun-foundation-text";

@TestClass
export class TextApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    Assert.isDefined(api.EcmaScriptLineTerminator);
    Assert.isDefined(api.LineTerminator);
    Assert.isDefined(api.ReadOnlyStringSpan);
    Assert.isDefined(api.StringBuilder);
    Assert.isDefined(api.UnicodeCodePoint);
  }
}
