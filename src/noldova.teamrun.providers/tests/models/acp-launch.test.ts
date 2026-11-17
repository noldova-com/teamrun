/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpLaunch, ProcessCommand } from "@noldova/teamrun.providers";

@TestClass
export class AcpLaunchTests {
  @TestMethod
  public keepsTheProcessItsAgentStartsIn(): void {
    const command = new ProcessCommand("agent", ["acp"]);
    const environment = { HOME: "/profile/home" };
    const launch = new AcpLaunch(command, environment, "/profile");

    Assert.areEqual(command, launch.command);
    Assert.areEqual(environment, launch.environment);
    Assert.areEqual("/profile", launch.directory);
  }
}
