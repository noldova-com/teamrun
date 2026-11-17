/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TeammateFallback } from "@noldova/teamrun.protocol";

@TestClass
export class TeammateFallbackTests {
  @TestMethod
  public keepsItsAccountModelAndEffortThroughJsonAndTakesTheProvidersDefaultsWhenNull(): void {
    const value = new TeammateFallback("providerId-2", "model-b", "high");
    const defaults = new TeammateFallback("providerId-3");

    Assert.areEqual(JSON.stringify({ providerId: "providerId-2", model: "model-b", effort: "high" }), JSON.stringify(TeammateFallback.fromJson(value.toJson()).toJson()));
    Assert.areEqual(JSON.stringify({ providerId: "providerId-3", model: null, effort: null }), JSON.stringify(defaults.toJson()));
    Assert.isTrue(value.equals(new TeammateFallback("providerId-2", "model-b", "high")));
    Assert.isFalse(value.equals(new TeammateFallback("providerId-2", "model-b", null)));
    Assert.isFalse(value.equals(new TeammateFallback("providerId-2", "model-c", "high")));
    Assert.isFalse(value.equals(new TeammateFallback("providerId-3", "model-b", "high")));
  }

  @TestMethod
  public refusesABlankFieldAndNamesTheEntryOfAMalformedList(): void {
    Assert.areEqual("providerId", Assert.throws(() => new TeammateFallback(" "), ArgumentException).parameterName);
    Assert.areEqual("model", Assert.throws(() => new TeammateFallback("providerId-2", " "), ArgumentException).parameterName);
    Assert.areEqual("effort", Assert.throws(() => new TeammateFallback("providerId-2", null, " "), ArgumentException).parameterName);
    Assert.areEqual("$.fallbacks.1.providerId", Assert.throws(() => TeammateFallback.readList(JsonReader.fromValue({ fallbacks: [{ providerId: "providerId-2",
      model: null, effort: null }, { model: null, effort: null }] })), JsonException).path);
    Assert.areEqual("providerId-2,providerId-3", TeammateFallback.readList(JsonReader.fromValue({ fallbacks: [{ providerId: "providerId-2", model: null, effort: null },
      { providerId: "providerId-3", model: "model-c", effort: null }] })).map(t => t.providerId).join());
  }
}
