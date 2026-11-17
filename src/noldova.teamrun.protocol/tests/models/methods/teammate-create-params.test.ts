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
import { TeammateCreateParams, TeammateFallback, Harness } from "@noldova/teamrun.protocol";

@TestClass
export class TeammateCreateParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new TeammateCreateParams("Alice", "Review carefully.", "providerId-1", Harness.Provider, "model-a", "high");
    const json = value.toJson();
    Assert.areEqual(JSON.stringify(json), JSON.stringify(TeammateCreateParams.fromJson(json).toJson()));
    Assert.isNull(TeammateCreateParams.fromJson(new TeammateCreateParams("Alice",
      null,
      "providerId-1",
      Harness.Provider,
      "model-a",
      "high").toJson()).role);
    Assert.isNull(TeammateCreateParams.fromJson(new TeammateCreateParams("Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      null,
      "high").toJson()).model);
    Assert.isNull(TeammateCreateParams.fromJson(new TeammateCreateParams("Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      "model-a",
      null).toJson()).effort);
    Assert.areEqual("$.input.name", Assert.throws(() => TeammateCreateParams.fromJson({ ...json, name: 42 }, "$.input"), JsonException).path);
    Assert.throws(() => TeammateCreateParams.fromJson({ ...json, harness: "unsupported" }), JsonException);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new TeammateCreateParams(" ", "Review carefully.", "providerId-1", Harness.Provider, "model-a", "high"), ArgumentException);
    Assert.throws(() => new TeammateCreateParams("Alice", " ", "providerId-1", Harness.Provider, "model-a", "high"), ArgumentException);
    Assert.throws(() => new TeammateCreateParams("Alice", "Review carefully.", " ", Harness.Provider, "model-a", "high"), ArgumentException);
    Assert.throws(() => new TeammateCreateParams("Alice",
      "Review carefully.",
      "providerId-1",
      "unsupported" as Harness,
      "model-a",
      "high"),
      ArgumentException);
    Assert.throws(() => new TeammateCreateParams("Alice", "Review carefully.", "providerId-1", Harness.Provider, " ", "high"), ArgumentException);
    Assert.throws(() => new TeammateCreateParams("Alice", "Review carefully.", "providerId-1", Harness.Provider, "model-a", " "), ArgumentException);
  }

  @TestMethod
  public keepsItsChosenSpeedThroughJsonAndReadsNoneFromOlderJson(): void {
    const value = new TeammateCreateParams("Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "priority");
    const older = { ...value.toJson() };
    delete older["speed"];

    Assert.areEqual("priority", TeammateCreateParams.fromJson(value.toJson()).speed);
    Assert.isNull(TeammateCreateParams.fromJson(older).speed);
    Assert.isNull(new TeammateCreateParams("Alice", null, "providerId-1", Harness.Provider, "model-a", "high").speed);
    Assert.areEqual("speed", Assert.throws(() => new TeammateCreateParams("Alice", null, "providerId-1", Harness.Provider, "model-a", "high", " "), ArgumentException).parameterName);
  }

  @TestMethod
  public keepsItsChosenModeThroughJsonAndReadsNoneFromOlderJson(): void {
    const value = new TeammateCreateParams("Alice", null, "providerId-1", Harness.Provider, "model-a", "high", null, "plan");
    const older = { ...value.toJson() };
    delete older["mode"];

    Assert.areEqual("plan", TeammateCreateParams.fromJson(value.toJson()).mode);
    Assert.isNull(TeammateCreateParams.fromJson(older).mode);
    Assert.isNull(new TeammateCreateParams("Alice", null, "providerId-1", Harness.Provider, "model-a", "high").mode);
    Assert.areEqual("mode", Assert.throws(() => new TeammateCreateParams("Alice", null, "providerId-1", Harness.Provider, "model-a", "high", null, " "), ArgumentException).parameterName);
  }

  @TestMethod
  public keepsItsChosenContextWindowThroughJsonAndWritesNoneForTheProvidersOwn(): void {
    const value = new TeammateCreateParams("Alice", null, "providerId-1", Harness.Provider, "model-a", "high", null, null, 300_000);
    const own = new TeammateCreateParams("Alice", null, "providerId-1", Harness.Provider, "model-a", "high");

    Assert.areEqual(300_000, TeammateCreateParams.fromJson(value.toJson()).contextWindow);
    Assert.isNull(own.contextWindow);
    Assert.isFalse(Object.hasOwn(own.toJson(), "contextWindow"));
    Assert.areEqual("contextWindow", Assert.throws(() => new TeammateCreateParams("Alice", null, "providerId-1", Harness.Provider, "model-a", "high", null, null, 0),
      ArgumentException).parameterName);
  }

  @TestMethod
  public keepsItsUsageHandOffsInOrderThroughJsonAndRefusesARepeatOrABlankId(): void {
    const value = new TeammateCreateParams("Alice", null, "providerId-1", Harness.Provider, null, null, null, null, null, ["id-3", "id-2"]);
    const off = new TeammateCreateParams("Alice", null, "providerId-1", Harness.Provider, null, null);

    Assert.areEqual("id-3|id-2", TeammateCreateParams.fromJson(value.toJson()).usageHandOffs.join("|"));
    Assert.isFalse(Object.hasOwn(off.toJson(), "usageHandOffs"));
    Assert.areEqual(0, TeammateCreateParams.fromJson(off.toJson()).usageHandOffs.length);
    for (const list of [["id-2", "id-2"], [""]])
      Assert.areEqual("usageHandOffs", Assert.throws(() => new TeammateCreateParams("Alice", null, "providerId-1", Harness.Provider, null, null, null, null, null,
        list), ArgumentException).parameterName);
  }

  @TestMethod
  public keepsItsSustainSettingsThroughJsonAndTakesTheirDefaultsFromOlderJson(): void {
    const value = new TeammateCreateParams("Alice", null, "providerId-1", Harness.Provider, "model-a", "high", null, null, null, [], true,
      [new TeammateFallback("providerId-2", "model-b")], false);
    const own = new TeammateCreateParams("Alice", null, "providerId-1", Harness.Provider, "model-a", "high");
    const read = TeammateCreateParams.fromJson(value.toJson());

    Assert.areEqual("true|providerId-2:model-b:|false", [read.sustain, read.fallbacks.map(t => [t.providerId, t.model, t.effort].join(":")).join(),
      read.resetsSoonestFirst].join("|"));
    Assert.areEqual("false|0|true", [own.sustain, own.fallbacks.length, own.resetsSoonestFirst].join("|"));
    Assert.isFalse(["sustain", "fallbacks", "resetsSoonestFirst"].some(t => Object.hasOwn(own.toJson(), t)));
    Assert.areEqual("$.resetsSoonestFirst", Assert.throws(() => TeammateCreateParams.fromJson({ ...own.toJson(), resetsSoonestFirst: 1 }), JsonException).path);
  }
}
