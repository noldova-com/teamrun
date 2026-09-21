/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AuthStatus } from "@noldova/teamrun-protocol";
import { ClaudeSignInReader } from "@noldova/teamrun-providers";

@TestClass
export class ClaudeSignInReaderTests {
  private static readonly reader: ClaudeSignInReader = new ClaudeSignInReader();

  @TestMethod
  public readsEveryStatusShape(): void {
    const signedIn = ClaudeSignInReaderTests.reader.read("noise before {\"loggedIn\":true,\"email\":\"a@b.c\",\"subscriptionType\":\"max\",\"orgName\":\"Org\",\"authMethod\":\"claude.ai\"}", "2.1.0");
    const bare = ClaudeSignInReaderTests.reader.read("{\"loggedIn\":true}", null);
    const signedOut = ClaudeSignInReaderTests.reader.read("{\"loggedIn\":false}", "2.1.0");
    const unknown = ClaudeSignInReaderTests.reader.read("{}", "2.1.0");
    const noJson = ClaudeSignInReaderTests.reader.read("nothing here", "2.1.0");
    const badJson = ClaudeSignInReaderTests.reader.read("{ broken", null);

    Assert.areEqual(AuthStatus.LoggedIn, signedIn.authStatus);
    Assert.areEqual("a@b.c", signedIn.identity?.email);
    Assert.areEqual("max", signedIn.identity?.plan);
    Assert.areEqual("Org", signedIn.identity?.organization);
    Assert.areEqual("claude.ai", signedIn.identity?.authMethod);
    Assert.areEqual("2.1.0", signedIn.harnessVersion);
    Assert.isUndefined(bare.identity?.email);
    Assert.areEqual(AuthStatus.LoggedOut, signedOut.authStatus);
    Assert.areEqual(AuthStatus.LoggedOut, unknown.authStatus);
    Assert.areEqual(AuthStatus.Error, noJson.authStatus);
    Assert.areEqual("Unexpected output from the sign-in check: nothing here", noJson.error);
    Assert.areEqual(AuthStatus.Error, badJson.authStatus);
    Assert.isTrue(badJson.error?.startsWith("Unexpected output from the sign-in check: ") ?? false);
  }
}
