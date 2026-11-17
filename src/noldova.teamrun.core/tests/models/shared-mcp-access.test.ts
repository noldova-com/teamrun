/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SharedMcpAccess } from "@noldova/teamrun.core";

@TestClass
export class SharedMcpAccessTests {
  @TestMethod
  public givesATokenUntilItExpiresOrNoTokenWithWhyASignInIsNeeded(): void {
    const granted = SharedMcpAccess.granted("access-token-5b2e8d", "2026-11-02T11:00:00.000Z");
    const refused = SharedMcpAccess.refused("The server refused the refresh.");

    Assert.areEqual(JSON.stringify(["access-token-5b2e8d", "2026-11-02T11:00:00.000Z", null]), JSON.stringify([granted.token, granted.expiresAt, granted.needsSignIn]));
    Assert.areEqual(JSON.stringify(["", null, "The server refused the refresh."]), JSON.stringify([refused.token, refused.expiresAt, refused.needsSignIn]));
  }
}
