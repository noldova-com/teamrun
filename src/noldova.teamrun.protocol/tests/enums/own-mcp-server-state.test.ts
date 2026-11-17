/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { OwnMcpServerState } from "@noldova/teamrun.protocol";

@TestClass
export class OwnMcpServerStateTests {
  @TestMethod
  public namesWhatAProviderReportsWithoutConnecting(): void {
    Assert.areEqual("Configured,Enabled,Disabled,NeedsSignIn", Object.values(OwnMcpServerState).join(","));
  }
}
