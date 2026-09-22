/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { InstallationUpdatePhase } from "@noldova/teamrun-runtime";

@TestClass
export class InstallationUpdatePhaseTests {
  @TestMethod
  public namesBothPhases(): void {
    Assert.areEqual("Preparing,Installing", Object.values(InstallationUpdatePhase).join(","));
  }
}
