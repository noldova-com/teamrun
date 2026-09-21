/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ObservedSettings, ProviderAccountIdentity } from "@noldova/teamrun-protocol";

@TestClass
export class ObservedSettingsTests {
  @TestMethod
  public startsWithNothingObserved(): void {
    const settings = new ObservedSettings(null, null, null, null, null);

    Assert.isNull(settings.provider);
    Assert.isNull(settings.identity);
    Assert.areEqual("{\"provider\":null,\"model\":null,\"effort\":null,\"harnessVersion\":null,\"identity\":null}", JSON.stringify(settings.toJson()));
  }

  @TestMethod
  public holdsWhatTheProviderServed(): void {
    const settings = new ObservedSettings("codex", "gpt-5-codex", "high", "0.50.0", new ProviderAccountIdentity("ross@example.com"));

    Assert.areEqual("gpt-5-codex", settings.model);
    Assert.areEqual("0.50.0", settings.harnessVersion);
    Assert.areEqual("ross@example.com", settings.identity?.email);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { provider: "codex", model: "gpt-5-codex", effort: null, harnessVersion: "0.50.0", identity: { plan: "pro" } };
    const settings = ObservedSettings.fromJson(json);

    Assert.areEqual("codex", settings.provider);
    Assert.isNull(settings.effort);
    Assert.areEqual("pro", settings.identity?.plan);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(settings.toJson()));
    Assert.isNull(ObservedSettings.fromJson({ ...json, identity: null }).identity);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const json = { provider: null, model: null, effort: null, harnessVersion: null, identity: null };

    Assert.areEqual("$.identity.email", Assert.throws(() => ObservedSettings.fromJson({ ...json, identity: { email: 5 } }), JsonException).path);
    Assert.areEqual("$.model", Assert.throws(() => ObservedSettings.fromJson({ ...json, model: 5 }), JsonException).path);
  }
}
