/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ForkedSession } from "@noldova/teamrun.protocol";

@TestClass
export class ForkedSessionTests {
  private static readonly json: object = { kind: "codex", providerId: "acc-1", nativeSessionId: "thread-2", resumeAt: null };

  @TestMethod
  public roundTripsThroughJsonAndMatchesItsProviderAndProvider(): void {
    const session = ForkedSession.fromJson(ForkedSessionTests.json);

    Assert.areEqual(JSON.stringify(ForkedSessionTests.json), JSON.stringify(session.toJson()));
    Assert.areEqual("thread-2", session.nativeSessionId);
    Assert.isTrue(session.matches("codex", "acc-1"));
    Assert.isFalse(session.matches("codex", null));
    Assert.isFalse(session.matches("claude", "acc-1"));
    Assert.isTrue(new ForkedSession("codex", null, "thread-3").matches("codex", null));
  }

  @TestMethod
  public keepsTheTurnToResumeAtAndReadsItsAbsenceAsNone(): void {
    const json = { kind: "claude", providerId: null, nativeSessionId: "session-1", resumeAt: "entry-4" };

    const session = ForkedSession.fromJson(json);

    Assert.areEqual("entry-4", session.resumeAt);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(session.toJson()));
    Assert.isNull(ForkedSession.fromJson({ kind: "codex", providerId: null, nativeSessionId: "thread-2" }).resumeAt);
  }

  @TestMethod
  public rejectsBlanksAndInvalidJson(): void {
    Assert.throws(() => new ForkedSession(String.empty, null, "thread-2"), ArgumentException);
    Assert.throws(() => new ForkedSession("codex", null, " "), ArgumentException);
    Assert.throws(() => new ForkedSession("claude", null, "session-1", " "), ArgumentException);
    Assert.areEqual("$.nativeSessionId", Assert.throws(() => ForkedSession.fromJson({ kind: "codex", providerId: null }), JsonException).path);
  }
}
