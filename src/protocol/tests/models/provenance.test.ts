/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ObservedSettings, Provenance, RequestedSettings, RoleApplication } from "@noldova/teamrun-protocol";

@TestClass
export class ProvenanceTests {
  private static readonly requested: RequestedSettings = new RequestedSettings("codex", null, null);
  private static readonly observed: ObservedSettings = new ObservedSettings(null, null, null, null, null);
  private static readonly json: object = {
    providerAccountId: "acc-1",
    requested: { provider: "codex", model: null, effort: null },
    observed: { provider: "codex", model: "gpt-5-codex", effort: "medium", harnessVersion: "0.50.0", identity: null },
    nativeSessionId: "thread-9",
    resumedNativeSession: true,
    nativeTurnId: "turn-3"
  };

  @TestMethod
  public holdsWhereAReplyCameFrom(): void {
    const provenance = new Provenance(null, ProvenanceTests.requested, ProvenanceTests.observed, null, false);

    Assert.isNull(provenance.providerAccountId);
    Assert.areEqual("codex", provenance.requested.provider);
    Assert.isNull(provenance.observed.model);
    Assert.isNull(provenance.nativeSessionId);
    Assert.isFalse(provenance.resumedNativeSession);
    Assert.isNull(provenance.nativeTurnId);
    Assert.areEqual("turn-1", provenance.withNativeSession("thread-1", false, "turn-1").nativeTurnId);
    Assert.areEqual("turn-1", provenance.withNativeSession("thread-1", false, "turn-1").withNativeSession("thread-1", true).nativeTurnId);
    Assert.areEqual("turn-1", provenance.withNativeSession("thread-1", false, "turn-1").withObserved(ProvenanceTests.observed).nativeTurnId);
    const role = provenance.withRoleApplied(RoleApplication.Prompt).withNativeSession("native", false).withObserved(ProvenanceTests.observed);
    Assert.areEqual(RoleApplication.Prompt, Provenance.fromJson(role.toJson()).roleApplied);
    Assert.isNull(Provenance.fromJson({ ...role.toJson(), roleApplied: null }).roleApplied);
    Assert.throws(() => Provenance.fromJson({ ...role.toJson(), roleApplied: "unknown" }), JsonException);
  }

  @TestMethod
  public aResumedReplyNamesItsNativeSession(): void {
    const exception = Assert.throws(() => new Provenance(null, ProvenanceTests.requested, ProvenanceTests.observed, null, true), ArgumentException);

    Assert.areEqual("resumedNativeSession", exception.parameterName);
    Assert.doesNotThrow(() => new Provenance(null, ProvenanceTests.requested, ProvenanceTests.observed, "thread-9", true));
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const provenance = Provenance.fromJson(ProvenanceTests.json);

    Assert.areEqual("acc-1", provenance.providerAccountId);
    Assert.areEqual("gpt-5-codex", provenance.observed.model);
    Assert.areEqual("thread-9", provenance.nativeSessionId);
    Assert.isTrue(provenance.resumedNativeSession);
    Assert.areEqual("turn-3", provenance.nativeTurnId);
    Assert.areEqual(JSON.stringify(ProvenanceTests.json), JSON.stringify(provenance.toJson()));
    Assert.isNull(Provenance.fromJson({ ...ProvenanceTests.json, nativeTurnId: undefined }).nativeTurnId);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const missingProvider = Assert.throws(() => Provenance.fromJson({ ...ProvenanceTests.json, requested: { model: null, effort: null } }), JsonException);
    const wrongModel = Assert.throws(() => Provenance.fromJson({ ...ProvenanceTests.json, observed: { provider: null, model: 1 } }), JsonException);
    const wrongFlag = Assert.throws(() => Provenance.fromJson({ ...ProvenanceTests.json, resumedNativeSession: "yes" }), JsonException);

    Assert.areEqual("$.requested.provider", missingProvider.path);
    Assert.areEqual("$.observed.model", wrongModel.path);
    Assert.areEqual("$.resumedNativeSession", wrongFlag.path);
  }

  @TestMethod
  public producesCopiesWithTheSessionAndTheObservedSettings(): void {
    const provenance = new Provenance("a1", new RequestedSettings("codex", null, null), new ObservedSettings(null, null, null, null, null), null, false);
    const observed = new ObservedSettings("codex", "gpt-5-codex", "high", "0.50.0", null);

    const started = provenance.withNativeSession("thread-1", false);
    const resumed = provenance.withNativeSession("thread-1", true);
    const traced = started.withObserved(observed);

    Assert.isNull(provenance.nativeSessionId);
    Assert.areEqual("thread-1", started.nativeSessionId);
    Assert.isFalse(started.resumedNativeSession);
    Assert.isTrue(resumed.resumedNativeSession);
    Assert.areEqual("high", traced.observed.effort);
    Assert.areEqual("a1", traced.providerAccountId);
    Assert.throws(() => provenance.withNativeSession(null, true), ArgumentException);
  }
}
