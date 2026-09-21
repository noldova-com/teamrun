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
import { AuthStatus, ProviderAccount, ProviderAccountIdentity } from "@noldova/teamrun-protocol";

@TestClass
export class ProviderAccountTests {
  private static readonly json: object = {
    id: "acc-1", provider: "codex", label: "Work", profileDir: "/profiles/work", authStatus: "LoggedIn",
    identity: { email: "ross@example.com" }, harnessVersion: "0.50.0", lastCheckedAt: "2026-09-08T10:00:00Z", lastError: null, createdAt: "2026-09-08T09:00:00Z"
  };

  @TestMethod
  public holdsTheAccountAndItsObservedState(): void {
    const profile = new ProviderAccount(
      "acc-1", "claude", "Personal", "/profiles/personal", AuthStatus.Unknown, null, null, null, null, "2026-09-08T09:00:00Z");

    Assert.areEqual("claude", profile.provider);
    Assert.areEqual(AuthStatus.Unknown, profile.authStatus);
    Assert.isNull(profile.identity);
    Assert.isNull(profile.harnessVersion);
    Assert.isNull(profile.toJson()["identity"]);
  }

  @TestMethod
  public rejectsBlankRequiredText(): void {
    Assert.throws(() => new ProviderAccount(" ", "codex", "Work", "/p", AuthStatus.Unknown, null, null, null, null, "t"), ArgumentException);
    Assert.throws(() => new ProviderAccount("acc", " ", "Work", "/p", AuthStatus.Unknown, null, null, null, null, "t"), ArgumentException);
    Assert.throws(() => new ProviderAccount("acc", "codex", String.empty, "/p", AuthStatus.Unknown, null, null, null, null, "t"), ArgumentException);
    Assert.throws(() => new ProviderAccount("acc", "codex", "Work", String.empty, AuthStatus.Unknown, null, null, null, null, "t"), ArgumentException);
    Assert.throws(() => new ProviderAccount("acc", "codex", "Work", "/p", AuthStatus.Unknown, null, null, null, null, String.empty), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const profile = ProviderAccount.fromJson(ProviderAccountTests.json);

    Assert.areEqual("acc-1", profile.id);
    Assert.areEqual("codex", profile.provider);
    Assert.areEqual(AuthStatus.LoggedIn, profile.authStatus);
    Assert.isInstanceOf(profile.identity, ProviderAccountIdentity);
    Assert.areEqual("ross@example.com", profile.identity?.email);
    Assert.areEqual("0.50.0", profile.harnessVersion);
    Assert.isNull(profile.lastError);
    Assert.areEqual(JSON.stringify(ProviderAccountTests.json), JSON.stringify(profile.toJson()));
  }

  @TestMethod
  public readsANullIdentity(): void {
    const profile = ProviderAccount.fromJson({ ...ProviderAccountTests.json, identity: null });

    Assert.isNull(profile.identity);
    Assert.isNull(profile.toJson()["identity"]);
  }

  @TestMethod
  public rejectsUnknownValuesWithTheirPath(): void {
    const blankProvider = Assert.throws(() => ProviderAccount.fromJson({ ...ProviderAccountTests.json, provider: String.empty }), JsonException);
    Assert.areEqual("$.provider", blankProvider.path);
    Assert.areEqual("$.authStatus", Assert.throws(() => ProviderAccount.fromJson({ ...ProviderAccountTests.json, authStatus: "ok" }), JsonException).path);
    const nested = Assert.throws(() => ProviderAccount.fromJson({ ...ProviderAccountTests.json, identity: { email: 1 } }), JsonException);
    Assert.areEqual("$.identity.email", nested.path);
    Assert.areEqual("$.identity", Assert.throws(() => ProviderAccount.fromJson({ ...ProviderAccountTests.json, identity: "none" }), JsonException).path);
  }

  @TestMethod
  public producesACheckedCopy(): void {
    const account = new ProviderAccount("a1", "codex", "Work", "D:/profiles/codex", AuthStatus.Unknown, null, null, null, null, "t1");
    const identity = new ProviderAccountIdentity("ross@example.com", "plus", undefined, "chatgpt");

    const checked = account.withCheck(AuthStatus.LoggedIn, identity, "0.50.0", "t2", null);
    const failed = account.withCheck(AuthStatus.Error, null, null, "t3", "codex.exe not found");

    Assert.areEqual(AuthStatus.Unknown, account.authStatus);
    Assert.areEqual(AuthStatus.LoggedIn, checked.authStatus);
    Assert.areEqual("ross@example.com", checked.identity?.email);
    Assert.areEqual("0.50.0", checked.harnessVersion);
    Assert.areEqual("t2", checked.lastCheckedAt);
    Assert.areEqual("codex.exe not found", failed.lastError);
    Assert.areEqual(account.id, failed.id);
  }
}
