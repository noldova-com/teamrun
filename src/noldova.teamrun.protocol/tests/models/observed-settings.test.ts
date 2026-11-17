/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ObservedSettings } from "@noldova/teamrun.protocol";

@TestClass
export class ObservedSettingsTests {
  @TestMethod
  public startsWithNothingObserved(): void {
    const settings = new ObservedSettings(null, null, null, null);

    Assert.isNull(settings.kind);
    Assert.isFalse(settings.unavailableModel);
    Assert.areEqual("{\"kind\":null,\"model\":null,\"effort\":null,\"harnessVersion\":null,\"unavailableModel\":false,\"speed\":null,\"speedUnavailable\":null}", JSON.stringify(settings.toJson()));
  }

  @TestMethod
  public holdsWhatTheProviderServed(): void {
    const settings = new ObservedSettings("codex", "gpt-5-codex", "high", "0.50.0");

    Assert.areEqual("gpt-5-codex", settings.model);
    Assert.areEqual("0.50.0", settings.harnessVersion);
  }

  @TestMethod
  public dropsThePersonsSignInAReplyKeptBefore(): void {
    const json = { kind: "claude", model: "opus", effort: null, harnessVersion: "2.1.0",
      identity: { email: "person@example.com", plan: "max", organization: "Org", authMethod: "claude.ai login" } };
    const settings = ObservedSettings.fromJson(json);

    Assert.areEqual("claude opus 2.1.0", [settings.kind, settings.model, settings.harnessVersion].join(" "));
    Assert.isFalse(Object.hasOwn(settings.toJson(), "identity"));
    Assert.isFalse(JSON.stringify(settings.toJson()).includes("person@example.com"));
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { kind: "copilot", model: null, effort: null, harnessVersion: "0.50.0", unavailableModel: true, speed: null, speedUnavailable: "cooldown" };
    const settings = ObservedSettings.fromJson(json);

    Assert.areEqual("copilot", settings.kind);
    Assert.isTrue(settings.unavailableModel);
    Assert.isFalse(ObservedSettings.fromJson({ kind: null, model: null, effort: null, harnessVersion: null }).unavailableModel);
    Assert.isNull(settings.effort);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(settings.toJson()));
    Assert.areEqual("cooldown", settings.speedUnavailable);
    const older = ObservedSettings.fromJson({ kind: null, model: null, effort: null, harnessVersion: null });
    Assert.areEqual("null|null", [older.speed, older.speedUnavailable].map(String).join("|"));
    Assert.areEqual("priority", new ObservedSettings("codex", null, null, null, false, "priority").speed);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const json = { kind: null, model: null, effort: null, harnessVersion: null };

    Assert.areEqual("$.model", Assert.throws(() => ObservedSettings.fromJson({ ...json, model: 5 }), JsonException).path);
    Assert.areEqual("$.unavailableModel", Assert.throws(() => ObservedSettings.fromJson({ ...json, unavailableModel: "yes" }), JsonException).path);
    Assert.areEqual("$.speedUnavailable", Assert.throws(() => ObservedSettings.fromJson({ ...json, speedUnavailable: 1 }), JsonException).path);
  }
}
