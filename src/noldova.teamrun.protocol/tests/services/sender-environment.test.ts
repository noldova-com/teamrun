/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SenderEnvironment } from "@noldova/teamrun.protocol";

@TestClass
export class SenderEnvironmentTests {
  @TestMethod
  public carriesTheTurnsTokenAloneAndReadsItBack(): void {
    const environment = SenderEnvironment.of("token");

    Assert.areEqual(JSON.stringify({ TEAMRUN_SENDER_TOKEN: "token" }), JSON.stringify(environment));
    Assert.areEqual("token", SenderEnvironment.read({ PATH: "/bin", ...environment }));
  }

  @TestMethod
  public readsNoTokenFromAnEnvironmentWithoutOne(): void {
    Assert.isNull(SenderEnvironment.read({ PATH: "/bin", TEAMRUN_CHAT_ID: "c1", TEAMRUN_TEAMMATE_ID: "t1" }));
  }
}
