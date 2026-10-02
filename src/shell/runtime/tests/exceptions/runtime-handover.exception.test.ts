/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity, RuntimeHandover } from "@noldova/teamrun-shell-protocol";
import { RuntimeHandoverException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class RuntimeHandoverExceptionTests {
  @TestMethod
  public namesTheNewerTeamRun(): void {
    const handover = new RuntimeHandover(new BuildIdentity("2.0.0", BuildIdentity.supportedProtocolVersion, "newer"), "/opt/teamrun/teamrun");

    const exception = new RuntimeHandoverException(handover);

    Assert.areEqual("TeamRun 2.0.0 at /opt/teamrun/teamrun owns this data directory and is newer; open that TeamRun instead.", exception.message);
    Assert.areEqual(handover, exception.handover);
    Assert.areEqual("RuntimeHandoverException", exception.name);
  }
}
