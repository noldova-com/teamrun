/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SignInCheck } from "@noldova/teamrun-core";
import { AuthStatus, ProviderAccountIdentity } from "@noldova/teamrun-protocol";

@TestClass
export class SignInCheckTests {
  @TestMethod
  public holdsWhatACheckObserved(): void {
    const check = new SignInCheck(AuthStatus.LoggedIn, new ProviderAccountIdentity("dev@example.com"), "1.0.0", null);
    const failed = new SignInCheck(AuthStatus.Error, null, null, "not found");

    Assert.areEqual(AuthStatus.LoggedIn, check.authStatus);
    Assert.areEqual("dev@example.com", check.identity?.email);
    Assert.areEqual("1.0.0", check.harnessVersion);
    Assert.isNull(check.error);
    Assert.areEqual("not found", failed.error);
  }
}
