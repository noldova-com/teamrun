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
import { RequestedSettings } from "@noldova/teamrun.protocol";

@TestClass
export class RequestedSettingsTests {
  @TestMethod
  public holdsTheRequestedValues(): void {
    const settings = new RequestedSettings("codex", null, "high");

    Assert.areEqual("codex", settings.kind);
    Assert.isNull(settings.model);
    Assert.areEqual("high", settings.effort);
    Assert.isNull(settings.speed);
    Assert.areEqual("fast", new RequestedSettings("claude", null, null, "fast").speed);
    Assert.isNull(settings.mode);
    Assert.areEqual("plan", new RequestedSettings("claude", null, null, null, "plan").mode);
  }

  @TestMethod
  public rejectsABlankProvider(): void {
    Assert.throws(() => new RequestedSettings(" ", null, null), ArgumentException);
    Assert.areEqual("speed", Assert.throws(() => new RequestedSettings("codex", null, null, " "), ArgumentException).parameterName);
    Assert.areEqual("mode", Assert.throws(() => new RequestedSettings("codex", null, null, null, " "), ArgumentException).parameterName);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { kind: "claude", model: "claude-opus-5", effort: null, speed: "fast", mode: "plan" };
    const settings = RequestedSettings.fromJson(json);

    Assert.areEqual("claude-opus-5", settings.model);
    Assert.isNull(settings.effort);
    Assert.areEqual("fast", settings.speed);
    Assert.areEqual("plan", settings.mode);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(settings.toJson()));
    Assert.isNull(RequestedSettings.fromJson({ kind: "codex", model: null, effort: null }).speed);
    Assert.isNull(RequestedSettings.fromJson({ kind: "codex", model: null, effort: null }).mode);
  }

  @TestMethod
  public carriesPlanFirstOnlyWhenSet(): void {
    const settings = new RequestedSettings("claude", "claude-opus-5", null, null, "acceptEdits");
    const planning = settings.withPlanFirst(true);

    Assert.isFalse(settings.planFirst);
    Assert.areEqual(settings, settings.withPlanFirst(false));
    Assert.areEqual(JSON.stringify(["acceptEdits", true]), JSON.stringify([planning.mode, planning.planFirst]));
    Assert.areEqual(JSON.stringify({ ...settings.toJson(), planFirst: true }), JSON.stringify(planning.toJson()));
    Assert.isTrue(RequestedSettings.fromJson(planning.toJson()).planFirst);
    Assert.isFalse("planFirst" in settings.toJson());
    Assert.areEqual("$.planFirst", Assert.throws(() => RequestedSettings.fromJson({ ...settings.toJson(), planFirst: "yes" }), JsonException).path);
  }

  @TestMethod
  public reportsMissingFieldsWithTheirPath(): void {
    const missingModel = Assert.throws(() => RequestedSettings.fromJson({ kind: "codex", effort: null }, "$.turn.requested"), JsonException);

    Assert.areEqual("$.turn.requested.model", missingModel.path);
  }

  @TestMethod
  public carriesAChosenContextWindowOnlyWhenOneIsChosen(): void {
    const settings = new RequestedSettings("claude", "claude-opus-5", null, null, null, false, 300_000);
    const own = new RequestedSettings("claude", "claude-opus-5", null);

    Assert.areEqual(300_000, RequestedSettings.fromJson(settings.toJson()).contextWindow);
    Assert.areEqual(300_000, settings.withPlanFirst(true).contextWindow);
    Assert.isNull(own.contextWindow);
    Assert.isFalse(Object.hasOwn(own.toJson(), "contextWindow"));
    Assert.areEqual("contextWindow", Assert.throws(() => new RequestedSettings("claude", null, null, null, null, false, -5), ArgumentException).parameterName);
  }
}
