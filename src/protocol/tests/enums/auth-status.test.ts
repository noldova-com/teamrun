/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AuthStatus } from "@noldova/teamrun-protocol";

@TestClass
export class AuthStatusTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Unknown", AuthStatus.Unknown);
    Assert.areEqual("LoggedIn", AuthStatus.LoggedIn);
    Assert.areEqual("LoggedOut", AuthStatus.LoggedOut);
    Assert.areEqual("Expired", AuthStatus.Expired);
    Assert.areEqual("Error", AuthStatus.Error);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(AuthStatus);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
