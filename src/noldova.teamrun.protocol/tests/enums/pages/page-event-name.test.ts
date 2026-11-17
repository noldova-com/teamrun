/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PageEventName } from "@noldova/teamrun.protocol";

@TestClass
export class PageEventNameTests {
  @TestMethod
  public namesEachMemberByItsNameInOrder(): void {
    Assert.areEqual("PageShown,PageUpdated,PageStopped", Object.values(PageEventName).join(","));
  }
}
