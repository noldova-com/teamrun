/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PanelOutcome } from "@noldova/teamrun.protocol";

@TestClass
export class PanelOutcomeTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    for (const [name, value] of Object.entries(PanelOutcome))
      Assert.areEqual(name, value);
    Assert.areEqual(JSON.stringify(["Done", "Refused", "Failed"]), JSON.stringify(Object.values(PanelOutcome)));
  }
}
