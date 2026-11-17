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
import { ContextUsage, ObservedSettings, Provenance, ReplyUsage, RequestedSettings, RoleApplication } from "@noldova/teamrun.protocol";

@TestClass
export class ProvenanceTests {
  private static readonly requested: RequestedSettings = new RequestedSettings("codex", null, null);
  private static readonly observed: ObservedSettings = new ObservedSettings(null, null, null, null);
  private static readonly json: object = {
    providerId: "acc-1",
    requested: { kind: "codex", model: null, effort: null, speed: null, mode: null },
    observed: { kind: "codex", model: "gpt-5-codex", effort: "medium", harnessVersion: "0.50.0", unavailableModel: false, speed: null, speedUnavailable: null },
    nativeSessionId: "thread-9",
    resumedNativeSession: true,
    nativeTurnId: "turn-3"
  };

  @TestMethod
  public holdsWhereAReplyCameFrom(): void {
    const provenance = new Provenance(null, ProvenanceTests.requested, ProvenanceTests.observed, null, false);

    Assert.isNull(provenance.providerId);
    Assert.areEqual("codex", provenance.requested.kind);
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
  public keepsAndMergesTheReplyUsage(): void {
    const provenance = new Provenance(null, ProvenanceTests.requested, ProvenanceTests.observed, null, false);
    const context = new ContextUsage(86000, 100000, 85000);
    const used = provenance.withUsage(new ReplyUsage(1200, null, null, context)).withUsage(new ReplyUsage(null, 340, 0.5, null));
    const carried = used.withNativeSession("thread-1", false).withObserved(ProvenanceTests.observed).withRoleApplied(RoleApplication.Prompt);

    Assert.isNull(provenance.usage);
    Assert.isFalse(Object.hasOwn(provenance.toJson(), "usage"));
    Assert.areEqual(JSON.stringify({ inputTokens: 1200, outputTokens: 340, costUsd: 0.5, context: context.toJson(), cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null }), JSON.stringify(carried.usage?.toJson()));
    Assert.areEqual(JSON.stringify(carried.toJson()), JSON.stringify(Provenance.fromJson(carried.toJson()).toJson()));
    Assert.throws(() => Provenance.fromJson({ ...ProvenanceTests.json, usage: { inputTokens: -1, outputTokens: null, costUsd: null, context: null } }), ArgumentException);
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

    Assert.areEqual("acc-1", provenance.providerId);
    Assert.areEqual("gpt-5-codex", provenance.observed.model);
    Assert.areEqual("thread-9", provenance.nativeSessionId);
    Assert.isTrue(provenance.resumedNativeSession);
    Assert.areEqual("turn-3", provenance.nativeTurnId);
    Assert.areEqual(JSON.stringify(ProvenanceTests.json), JSON.stringify(provenance.toJson()));
    Assert.isNull(Provenance.fromJson({ ...ProvenanceTests.json, nativeTurnId: undefined }).nativeTurnId);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const missingKind = Assert.throws(() => Provenance.fromJson({ ...ProvenanceTests.json, requested: { model: null, effort: null } }), JsonException);
    const wrongModel = Assert.throws(() => Provenance.fromJson({ ...ProvenanceTests.json, observed: { kind: null, model: 1 } }), JsonException);
    const wrongFlag = Assert.throws(() => Provenance.fromJson({ ...ProvenanceTests.json, resumedNativeSession: "yes" }), JsonException);

    Assert.areEqual("$.requested.kind", missingKind.path);
    Assert.areEqual("$.observed.model", wrongModel.path);
    Assert.areEqual("$.resumedNativeSession", wrongFlag.path);
  }

  @TestMethod
  public producesCopiesWithTheSessionAndTheObservedSettings(): void {
    const provenance = new Provenance("a1", new RequestedSettings("codex", null, null), new ObservedSettings(null, null, null, null), null, false);
    const observed = new ObservedSettings("codex", "gpt-5-codex", "high", "0.50.0");

    const started = provenance.withNativeSession("thread-1", false);
    const resumed = provenance.withNativeSession("thread-1", true);
    const traced = started.withObserved(observed);

    Assert.isNull(provenance.nativeSessionId);
    Assert.areEqual("thread-1", started.nativeSessionId);
    Assert.isFalse(started.resumedNativeSession);
    Assert.isTrue(resumed.resumedNativeSession);
    Assert.areEqual("high", traced.observed.effort);
    Assert.areEqual("a1", traced.providerId);
    Assert.throws(() => provenance.withNativeSession(null, true), ArgumentException);
  }
}
