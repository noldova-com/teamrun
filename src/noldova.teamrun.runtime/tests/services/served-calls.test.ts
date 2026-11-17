/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ServedCalls } from "@noldova/teamrun.runtime";

@TestClass
export class ServedCallsTests {
  @TestMethod
  public findsEachOpenCallByItsOwnIdUntilItClosesAndNoneForNoIdOrAnUnknownOne(): void {
    const calls = new ServedCalls();
    const choose = calls.open("browser_click", { ref: "e5" });
    const cancel = calls.open("browser_click", { ref: "e7" });

    const open = [calls.find(choose), calls.find(cancel), calls.find(null), calls.find("unknown")];
    calls.close(choose);
    calls.close("unknown");

    Assert.areNotEqual(choose, cancel);
    Assert.areEqual(JSON.stringify([{ tool: "browser_click", input: { ref: "e5" } }, { tool: "browser_click", input: { ref: "e7" } }, null, null]),
      JSON.stringify(open));
    Assert.areEqual(JSON.stringify([null, { tool: "browser_click", input: { ref: "e7" } }]), JSON.stringify([calls.find(choose), calls.find(cancel)]));
  }
}
