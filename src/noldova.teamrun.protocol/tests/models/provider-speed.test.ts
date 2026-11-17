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
import { ProviderSpeed } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderSpeedTests {
  private static readonly json: object = { id: "priority", name: "Fast", description: "Faster replies at a higher cost." };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderSpeed.fromJson(ProviderSpeedTests.json);

    Assert.areEqual("priority|Fast|Faster replies at a higher cost.", [value.id, value.name, value.description].join("|"));
    Assert.areEqual(JSON.stringify(ProviderSpeedTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(JSON.stringify({ id: "fast", name: null, description: null }), JSON.stringify(new ProviderSpeed("fast").toJson()));
  }

  @TestMethod
  public takesAFilledIdAndNameOrDescriptionWhenGiven(): void {
    Assert.areEqual("id", Assert.throws(() => new ProviderSpeed(" "), ArgumentException).parameterName);
    Assert.areEqual("name", Assert.throws(() => new ProviderSpeed("fast", ""), ArgumentException).parameterName);
    Assert.areEqual("description", Assert.throws(() => new ProviderSpeed("fast", "Fast", " "), ArgumentException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    Assert.areEqual("$.id", Assert.throws(() => ProviderSpeed.fromJson({ id: " ", name: null, description: null }), JsonException).path);
    Assert.areEqual("$.name", Assert.throws(() => ProviderSpeed.fromJson({ id: "fast", name: 1, description: null }), JsonException).path);
  }
}
