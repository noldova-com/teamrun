/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeOperation } from "@noldova/teamrun-foundation-data";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ChangeOperationTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Insert", ChangeOperation.Insert);
    Assert.areEqual("Update", ChangeOperation.Update);
    Assert.areEqual("Delete", ChangeOperation.Delete);
    Assert.areEqual(3, Object.values(ChangeOperation).length);
  }
}
