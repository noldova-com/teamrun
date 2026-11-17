/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PermissionRisk } from "@noldova/teamrun.protocol";

@TestClass
export class PermissionRiskTests {
  @TestMethod
  public usesDesktopCoresValues(): void {
    Assert.areEqual("Low,Medium,High", Object.values(PermissionRisk).join(","));
  }
}
