/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import * as api from "@noldova/teamrun.core";
import * as testing from "@noldova/teamrun.core/testing";

@TestClass
export class CoreTestingApiTests {
  @TestMethod
  public exportsTheTestDoublesFromTheTestingEntryAndNeverFromTheMainOne(): void {
    Assert.areEqual("ManualDelay,ManualTimer", Object.keys(testing).sort().join(","));
    Assert.areEqual("", Object.keys(testing).filter(t => t in api).join(","));
  }
}
