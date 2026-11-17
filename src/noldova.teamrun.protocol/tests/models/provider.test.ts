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
import { AuthStatus, Provider, ProviderIdentity } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderTests {
  private static readonly json: object = {
    id: "acc-1", kind: "codex", label: "Work", profileDir: "/profiles/work", authStatus: "LoggedIn",
    identity: { email: "person@example.com" }, harnessVersion: "0.50.0", lastCheckedAt: "2026-09-08T10:00:00Z", lastError: null, createdAt: "2026-09-08T09:00:00Z",
    enabled: true,
    ownMcpServers: true,
    binaryPath: "/opt/agy/agy_acp_server"
  };

  @TestMethod
  public holdsTheProviderAndItsObservedState(): void {
    const profile = new Provider(
      "acc-1", "claude", "Personal", "/profiles/personal", AuthStatus.Unknown, null, null, null, null, "2026-09-08T09:00:00Z");

    Assert.areEqual("claude", profile.kind);
    Assert.areEqual(AuthStatus.Unknown, profile.authStatus);
    Assert.isNull(profile.identity);
    Assert.isNull(profile.harnessVersion);
    Assert.isNull(profile.toJson()["identity"]);
  }

  @TestMethod
  public rejectsBlankRequiredText(): void {
    Assert.throws(() => new Provider(" ", "codex", "Work", "/p", AuthStatus.Unknown, null, null, null, null, "t"), ArgumentException);
    Assert.throws(() => new Provider("acc", " ", "Work", "/p", AuthStatus.Unknown, null, null, null, null, "t"), ArgumentException);
    Assert.throws(() => new Provider("acc", "codex", String.empty, "/p", AuthStatus.Unknown, null, null, null, null, "t"), ArgumentException);
    Assert.throws(() => new Provider("acc", "codex", "Work", String.empty, AuthStatus.Unknown, null, null, null, null, "t"), ArgumentException);
    Assert.throws(() => new Provider("acc", "codex", "Work", "/p", AuthStatus.Unknown, null, null, null, null, String.empty), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const profile = Provider.fromJson(ProviderTests.json);

    Assert.areEqual("acc-1", profile.id);
    Assert.areEqual("codex", profile.kind);
    Assert.areEqual(AuthStatus.LoggedIn, profile.authStatus);
    Assert.isInstanceOf(profile.identity, ProviderIdentity);
    Assert.areEqual("person@example.com", profile.identity?.email);
    Assert.areEqual("0.50.0", profile.harnessVersion);
    Assert.isNull(profile.lastError);
    Assert.areEqual(JSON.stringify(ProviderTests.json), JSON.stringify(profile.toJson()));
  }

  @TestMethod
  public keepsTheProvidersOwnMcpServersOffUnlessSwitchedOn(): void {
    const stored = Provider.fromJson({ ...ProviderTests.json, ownMcpServers: undefined });
    const switched = stored.withOwnMcpServers(true);

    Assert.isFalse(stored.ownMcpServers);
    Assert.isFalse(new Provider("a1", "codex", "Work", "/p", AuthStatus.Unknown, null, null, null, null, "t").ownMcpServers);
    Assert.isTrue(switched.ownMcpServers);
    Assert.areEqual(JSON.stringify({ ...stored.toJson(), ownMcpServers: true }), JSON.stringify(switched.toJson()));
    Assert.isTrue(switched.withCheck(AuthStatus.LoggedIn, null, null, "t2", null).ownMcpServers);
    Assert.isTrue(switched.withProfile("Other", switched.profileDir).ownMcpServers);
    Assert.isTrue(switched.withProfile("Work", "/profiles/other").ownMcpServers);
    Assert.areEqual("$.ownMcpServers", Assert.throws(() => Provider.fromJson({ ...ProviderTests.json, ownMcpServers: "yes" }), JsonException).path);
  }

  @TestMethod
  public keepsItsChosenServerThroughItsCopiesAndClearsItsCheckForAnother(): void {
    const identity = new ProviderIdentity("person@example.com");
    const chosen = Provider.fromJson({ ...ProviderTests.json, identity: identity.toJson(), lastError: "Sign in again." });
    const stored = Provider.fromJson({ ...ProviderTests.json, binaryPath: undefined });
    const moved = chosen.withBinaryPath("/usr/local/bin/agy_acp_server");
    const cleared = chosen.withBinaryPath(null);

    Assert.areEqual("/opt/agy/agy_acp_server", chosen.binaryPath);
    Assert.isNull(stored.binaryPath);
    Assert.isNull(Provider.fromJson({ ...ProviderTests.json, binaryPath: null }).binaryPath);
    Assert.isNull(new Provider("a1", "antigravity", "Work", "/p", AuthStatus.Unknown, null, null, null, null, "t").binaryPath);
    Assert.areEqual(chosen.binaryPath, chosen.withCheck(AuthStatus.LoggedIn, null, null, "t2", null).binaryPath);
    Assert.areEqual(chosen.binaryPath, chosen.withProfile("Other", chosen.profileDir).binaryPath);
    Assert.areEqual(chosen.binaryPath, chosen.withProfile("Work", "/profiles/other").binaryPath);
    Assert.areEqual(chosen.binaryPath, chosen.withEnabled(false).binaryPath);
    Assert.areEqual(chosen.binaryPath, chosen.withOwnMcpServers(false).binaryPath);
    Assert.isTrue(chosen.withBinaryPath(chosen.binaryPath) === chosen);
    Assert.areEqual(JSON.stringify({ ...chosen.toJson(), authStatus: AuthStatus.Unknown, identity: null, harnessVersion: null, lastCheckedAt: null,
      lastError: null, binaryPath: "/usr/local/bin/agy_acp_server" }), JSON.stringify(moved.toJson()));
    Assert.isNull(cleared.binaryPath);
    Assert.areEqual(AuthStatus.Unknown, cleared.authStatus);
    Assert.throws(() => chosen.withBinaryPath(" "), ArgumentException);
    Assert.areEqual("$.binaryPath", Assert.throws(() => Provider.fromJson({ ...ProviderTests.json, binaryPath: 1 }), JsonException).path);
  }

  @TestMethod
  public readsWhetherItIsEnabledAndKeepsItThroughItsCopies(): void {
    const disabled = Provider.fromJson({ ...ProviderTests.json, enabled: false });
    const stored = Provider.fromJson({ ...ProviderTests.json, enabled: undefined });

    Assert.isFalse(disabled.enabled);
    Assert.isFalse(disabled.toJson()["enabled"] as boolean);
    Assert.isTrue(stored.enabled);
    Assert.isTrue(new Provider("a1", "claude", "Work", "/p", AuthStatus.Unknown, null, null, null, null, "t").enabled);
    Assert.isFalse(disabled.withCheck(AuthStatus.LoggedIn, null, null, "t2", null).enabled);
    Assert.isFalse(disabled.withProfile("Home", disabled.profileDir).enabled);
    Assert.isFalse(disabled.withProfile("Home", "/profiles/home").enabled);
    Assert.areEqual(JSON.stringify({ ...disabled.toJson(), enabled: true }), JSON.stringify(disabled.withEnabled(true).toJson()));
    Assert.areEqual("$.enabled", Assert.throws(() => Provider.fromJson({ ...ProviderTests.json, enabled: "no" }), JsonException).path);
  }

  @TestMethod
  public readsANullIdentity(): void {
    const profile = Provider.fromJson({ ...ProviderTests.json, identity: null });

    Assert.isNull(profile.identity);
    Assert.isNull(profile.toJson()["identity"]);
  }

  @TestMethod
  public rejectsUnknownValuesWithTheirPath(): void {
    const blankKind = Assert.throws(() => Provider.fromJson({ ...ProviderTests.json, kind: String.empty }), JsonException);
    Assert.areEqual("$.kind", blankKind.path);
    Assert.areEqual("$.authStatus", Assert.throws(() => Provider.fromJson({ ...ProviderTests.json, authStatus: "ok" }), JsonException).path);
    const nested = Assert.throws(() => Provider.fromJson({ ...ProviderTests.json, identity: { email: 1 } }), JsonException);
    Assert.areEqual("$.identity.email", nested.path);
    Assert.areEqual("$.identity", Assert.throws(() => Provider.fromJson({ ...ProviderTests.json, identity: "none" }), JsonException).path);
  }

  @TestMethod
  public producesACheckedCopy(): void {
    const provider = new Provider("a1", "codex", "Work", "D:/profiles/codex", AuthStatus.Unknown, null, null, null, null, "t1");
    const identity = new ProviderIdentity("person@example.com", "plus", undefined, "chatgpt");

    const checked = provider.withCheck(AuthStatus.LoggedIn, identity, "0.50.0", "t2", null);
    const failed = provider.withCheck(AuthStatus.Error, null, null, "t3", "codex.exe not found");

    Assert.areEqual(AuthStatus.Unknown, provider.authStatus);
    Assert.areEqual(AuthStatus.LoggedIn, checked.authStatus);
    Assert.areEqual("person@example.com", checked.identity?.email);
    Assert.areEqual("0.50.0", checked.harnessVersion);
    Assert.areEqual("t2", checked.lastCheckedAt);
    Assert.areEqual("codex.exe not found", failed.lastError);
    Assert.areEqual(provider.id, failed.id);
  }

  @TestMethod
  public keepsItsCheckForTheSameProfileAndClearsItForAnother(): void {
    const identity = new ProviderIdentity("person@example.com", "plus", undefined, "chatgpt");
    const provider = new Provider("a1", "codex", "Work", "D:/profiles/codex", AuthStatus.Expired, identity, "0.50.0", "t2", "token expired", "t1");

    const renamed = provider.withProfile("Personal", provider.profileDir);
    const moved = provider.withProfile("Work", "D:/profiles/other");

    Assert.areEqual(JSON.stringify({ ...provider.toJson(), label: "Personal" }), JSON.stringify(renamed.toJson()));
    Assert.areEqual(JSON.stringify({ ...provider.toJson(), profileDir: "D:/profiles/other", authStatus: AuthStatus.Unknown, identity: null,
      harnessVersion: null, lastCheckedAt: null, lastError: null }), JSON.stringify(moved.toJson()));
  }
}
