/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { InstallationRole } from "@noldova/teamrun-runtime";

@TestClass
export class InstallationRoleTests {
  @TestMethod
  public namesBothRoles(): void {
    Assert.areEqual("Desktop,Runtime", Object.values(InstallationRole).join(","));
  }
}
