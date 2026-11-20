/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SharedMcpSignInStarted } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpSignInStartedTests {
  @TestMethod
  public keepsTheAddressThePersonOpensToSignIn(): void {
    const json = { url: "https://auth.example.com/authorize?client_id=c1&code_challenge=x" };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpSignInStarted.fromJson(json).toJson()));
    Assert.areEqual("$.s.url", Assert.throws(() => SharedMcpSignInStarted.fromJson({ url: 1 }, "$.s"), JsonException).path);
  }

  @TestMethod
  public carriesNoAddressForASignInEndedBeforeItHadOne(): void {
    Assert.areEqual(JSON.stringify({ url: null }), JSON.stringify(SharedMcpSignInStarted.fromJson({ url: null }).toJson()));
    Assert.isNull(new SharedMcpSignInStarted(null).url);
  }

  @TestMethod
  public refusesAnAddressThatIsntHttpOrHttps(): void {
    for (const url of ["not an address", "file:///etc/passwd", "javascript:alert(1)"])
      Assert.areEqual("url", Assert.throws(() => new SharedMcpSignInStarted(url), ArgumentException).parameterName, url);
  }
}
