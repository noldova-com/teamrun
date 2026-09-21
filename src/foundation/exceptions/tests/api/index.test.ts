/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as api from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ExceptionsApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const exportNames = [
      "ArgumentException",
      "ArgumentNullException",
      "ArgumentOutOfRangeException",
      "Exception",
      "ExceptionOptions",
      "IndexOutOfRangeException"
    ];

    Assert.areEqual(exportNames.sort().join(","), Object.keys(api).sort().join(","));
  }

  @TestMethod
  public keepsTheHierarchyRootedInError(): void {
    Assert.isInstanceOf(api.ArgumentNullException.prototype, api.ArgumentException);
    Assert.isInstanceOf(api.ArgumentOutOfRangeException.prototype, api.ArgumentException);
    Assert.isInstanceOf(api.ArgumentException.prototype, api.Exception);
    Assert.isInstanceOf(api.IndexOutOfRangeException.prototype, api.Exception);
    Assert.isInstanceOf(api.Exception.prototype, Error);
  }
}
