/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PageMethodName } from "@noldova/teamrun.protocol";

@TestClass
export class PageMethodNameTests {
  @TestMethod
  public namesEachMemberByItsNameInOrder(): void {
    Assert.areEqual("PageOpen,PageRead,PageRestore,PageList,PageEditedList", Object.values(PageMethodName).join(","));
  }
}
