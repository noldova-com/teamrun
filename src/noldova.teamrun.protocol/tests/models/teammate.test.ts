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
import { Teammate, TeammateFallback, Harness } from "@noldova/teamrun.protocol";

@TestClass
export class TeammateTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      "model-a",
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z");
    const json = value.toJson();
    Assert.areEqual(JSON.stringify(json), JSON.stringify(Teammate.fromJson(json).toJson()));
    Assert.isNull(Teammate.fromJson(new Teammate("id-1",
      "Alice",
      null,
      "providerId-1",
      Harness.Provider,
      "model-a",
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z").toJson()).role);
    Assert.isNull(Teammate.fromJson(new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      null,
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z").toJson()).model);
    Assert.isNull(Teammate.fromJson(new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      "model-a",
      null,
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z").toJson()).effort);
    Assert.areEqual("$.input.id", Assert.throws(() => Teammate.fromJson({ ...json, id: 42 }, "$.input"), JsonException).path);
    Assert.throws(() => Teammate.fromJson({ ...json, harness: "unsupported" }), JsonException);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new Teammate(" ",
      "Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      "model-a",
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z"),
      ArgumentException);
    Assert.throws(() => new Teammate("id-1",
      " ",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      "model-a",
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z"),
      ArgumentException);
    Assert.throws(() => new Teammate("id-1",
      "Alice",
      " ",
      "providerId-1",
      Harness.Provider,
      "model-a",
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z"),
      ArgumentException);
    Assert.throws(() => new Teammate("id-1",
      "Alice",
      "Review carefully.",
      " ",
      Harness.Provider,
      "model-a",
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z"),
      ArgumentException);
    Assert.throws(() => new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerId-1",
      "unsupported" as Harness,
      "model-a",
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z"),
      ArgumentException);
    Assert.throws(() => new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      " ",
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z"),
      ArgumentException);
    Assert.throws(() => new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      "model-a",
      " ",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z"),
      ArgumentException);
    Assert.throws(() => new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      "model-a",
      "high",
      " ",
      "2026-09-15T00:00:00Z"),
      ArgumentException);
    Assert.throws(() => new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      "model-a",
      "high",
      "2026-09-15T00:00:00Z",
      " "),
      ArgumentException);
  }

  @TestMethod
  public keepsItsChosenSpeedThroughJsonAndReadsNoneFromOlderJson(): void {
    const value = new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "2026-09-15T00:00:00Z", "2026-09-15T00:00:00Z", "priority");
    const older = { ...value.toJson() };
    delete older["speed"];

    Assert.areEqual("priority", Teammate.fromJson(value.toJson()).speed);
    Assert.isNull(Teammate.fromJson(older).speed);
    Assert.isNull(new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "2026-09-15T00:00:00Z", "2026-09-15T00:00:00Z").speed);
    Assert.areEqual("speed", Assert.throws(() => new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "2026-09-15T00:00:00Z", "2026-09-15T00:00:00Z", " "), ArgumentException).parameterName);
  }

  @TestMethod
  public keepsItsChosenModeThroughJsonAndReadsNoneFromOlderJson(): void {
    const value = new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "2026-09-15T00:00:00Z", "2026-09-15T00:00:00Z", null, "plan");
    const older = { ...value.toJson() };
    delete older["mode"];

    Assert.areEqual("plan", Teammate.fromJson(value.toJson()).mode);
    Assert.isNull(Teammate.fromJson(older).mode);
    Assert.isNull(new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "2026-09-15T00:00:00Z", "2026-09-15T00:00:00Z").mode);
    Assert.areEqual("mode", Assert.throws(() => new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "2026-09-15T00:00:00Z", "2026-09-15T00:00:00Z", null, " "), ArgumentException).parameterName);
  }

  @TestMethod
  public keepsItsChosenContextWindowThroughJsonAndWritesNoneForTheProvidersOwn(): void {
    const value = new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "2026-09-15T00:00:00Z", "2026-09-15T00:00:00Z", null, null,
      300_000);
    const own = new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "2026-09-15T00:00:00Z", "2026-09-15T00:00:00Z");

    Assert.areEqual(300_000, Teammate.fromJson(value.toJson()).contextWindow);
    Assert.isNull(own.contextWindow);
    Assert.isFalse(Object.hasOwn(own.toJson(), "contextWindow"));
    Assert.isNull(Teammate.fromJson({ ...own.toJson(), contextWindow: null }).contextWindow);
    for (const size of [0, -1, 150_000.5])
      Assert.areEqual("contextWindow", Assert.throws(() => new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high",
        "2026-09-15T00:00:00Z", "2026-09-15T00:00:00Z", null, null, size), ArgumentException).parameterName);
  }

  @TestMethod
  public keepsItsUsageHandOffsInOrderThroughJsonAndWritesNoneWhenOff(): void {
    const at = "2026-11-11T00:00:00Z";
    const value = new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, null, null, at, at, null, null, null, ["id-3", "id-2"]);
    const off = new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, null, null, at, at);

    Assert.areEqual("id-3|id-2", Teammate.fromJson(value.toJson()).usageHandOffs.join("|"));
    Assert.areEqual(0, off.usageHandOffs.length);
    Assert.isFalse(Object.hasOwn(off.toJson(), "usageHandOffs"));
    Assert.areEqual(0, Teammate.fromJson(off.toJson()).usageHandOffs.length);
    for (const list of [["id-1"], ["id-2", "id-2"], [" "]])
      Assert.areEqual("usageHandOffs", Assert.throws(() => new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, null, null, at, at, null, null,
        null, list), ArgumentException).parameterName);
    Assert.throws(() => Teammate.fromJson({ ...value.toJson(), usageHandOffs: [42] }), JsonException);
  }

  @TestMethod
  public keepsItsSustainSettingsThroughJsonAndTakesTheirDefaultsFromOlderJson(): void {
    const fallbacks = [new TeammateFallback("providerId-2", "model-b", "high"), new TeammateFallback("providerId-3")];
    const value = new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "2026-09-15T00:00:00Z", "2026-09-15T00:00:00Z", null, null,
      null, [], true, fallbacks, false);
    const own = new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "2026-09-15T00:00:00Z", "2026-09-15T00:00:00Z");
    const read = Teammate.fromJson(value.toJson());

    Assert.areEqual("true|providerId-2:model-b:high,providerId-3::|false", [read.sustain, read.fallbacks.map(t => [t.providerId, t.model, t.effort].join(":")).join(),
      read.resetsSoonestFirst].join("|"));
    Assert.areEqual("false|0|true", [own.sustain, own.fallbacks.length, own.resetsSoonestFirst].join("|"));
    Assert.isFalse(["sustain", "fallbacks", "resetsSoonestFirst"].some(t => Object.hasOwn(own.toJson(), t)));
    Assert.areEqual(JSON.stringify(own.toJson()), JSON.stringify(Teammate.fromJson(own.toJson()).toJson()));
    Assert.areEqual("$.fallbacks.0.providerId", Assert.throws(() => Teammate.fromJson({ ...own.toJson(), fallbacks: [{ providerId: " ", model: null, effort: null }] }),
      JsonException).path);
    Assert.areEqual("$.sustain", Assert.throws(() => Teammate.fromJson({ ...own.toJson(), sustain: "on" }), JsonException).path);
  }
}
