/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PermissionDetailKind } from "@noldova/teamrun.protocol";

@TestClass
export class PermissionDetailKindTests {
  @TestMethod
  public usesDesktopCoresValues(): void {
    Assert.areEqual("Text,Code,Secret,AgentText", Object.values(PermissionDetailKind).join(","));
  }
}
