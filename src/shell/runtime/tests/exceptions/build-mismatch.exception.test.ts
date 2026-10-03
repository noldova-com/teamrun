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
import { BuildMismatchException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class BuildMismatchExceptionTests {
  @TestMethod
  public namesTheRunningTeamRun(): void {
    const handover = new RuntimeHandover(new BuildIdentity("1.0.0", BuildIdentity.supportedProtocolVersion, "older"), "/opt/teamrun/teamrun");

    const exception = new BuildMismatchException(handover);

    Assert.areEqual("TeamRun 1.0.0 at /opt/teamrun/teamrun owns this data directory; it is another build, and taking it over was not asked for.", exception.message);
    Assert.areEqual(handover, exception.handover);
    Assert.areEqual("BuildMismatchException", exception.name);
  }
}
