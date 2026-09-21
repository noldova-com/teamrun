/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ForkedSession } from "@noldova/teamrun-protocol";

@TestClass
export class ForkedSessionTests {
  private static readonly json: object = { provider: "codex", providerAccountId: "acc-1", nativeSessionId: "thread-2" };

  @TestMethod
  public roundTripsThroughJsonAndMatchesItsProviderAndAccount(): void {
    const session = ForkedSession.fromJson(ForkedSessionTests.json);

    Assert.areEqual(JSON.stringify(ForkedSessionTests.json), JSON.stringify(session.toJson()));
    Assert.areEqual("thread-2", session.nativeSessionId);
    Assert.isTrue(session.matches("codex", "acc-1"));
    Assert.isFalse(session.matches("codex", null));
    Assert.isFalse(session.matches("claude", "acc-1"));
    Assert.isTrue(new ForkedSession("codex", null, "thread-3").matches("codex", null));
  }

  @TestMethod
  public rejectsBlanksAndInvalidJson(): void {
    Assert.throws(() => new ForkedSession(String.empty, null, "thread-2"), ArgumentException);
    Assert.throws(() => new ForkedSession("codex", null, " "), ArgumentException);
    Assert.areEqual("$.nativeSessionId", Assert.throws(() => ForkedSession.fromJson({ provider: "codex", providerAccountId: null }), JsonException).path);
  }
}
