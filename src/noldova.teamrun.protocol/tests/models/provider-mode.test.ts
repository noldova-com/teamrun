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
import { ProviderMode } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderModeTests {
  private static readonly json: object = { id: "bypassPermissions", name: "Bypass permissions", description: "Runs every tool without asking.", unrestricted: true,
    readOnly: false };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderMode.fromJson(ProviderModeTests.json);

    Assert.areEqual("bypassPermissions|Bypass permissions|Runs every tool without asking.|true|false",
      [value.id, value.name, value.description, value.unrestricted, value.readOnly].join("|"));
    Assert.areEqual(JSON.stringify(ProviderModeTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(JSON.stringify({ id: "plan", name: "Plan", description: null, unrestricted: false, readOnly: false }), JSON.stringify(new ProviderMode("plan", "Plan").toJson()));
    Assert.areEqual(true, ProviderMode.fromJson(new ProviderMode("plan", "Plan", null, false, true).toJson()).readOnly);
  }

  @TestMethod
  public takesAFilledIdAndNameAndADescriptionWhenGiven(): void {
    Assert.areEqual("id", Assert.throws(() => new ProviderMode(" ", "Plan"), ArgumentException).parameterName);
    Assert.areEqual("name", Assert.throws(() => new ProviderMode("plan", ""), ArgumentException).parameterName);
    Assert.areEqual("description", Assert.throws(() => new ProviderMode("plan", "Plan", " "), ArgumentException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    Assert.areEqual("$.id", Assert.throws(() => ProviderMode.fromJson({ id: " ", name: "Plan", description: null, unrestricted: false, readOnly: false }), JsonException).path);
    Assert.areEqual("$.name", Assert.throws(() => ProviderMode.fromJson({ id: "plan", name: null, description: null, unrestricted: false, readOnly: false }), JsonException).path);
    Assert.areEqual("$.unrestricted", Assert.throws(() => ProviderMode.fromJson({ id: "plan", name: "Plan", description: null, readOnly: false }), JsonException).path);
    Assert.areEqual("$.readOnly", Assert.throws(() => ProviderMode.fromJson({ id: "plan", name: "Plan", description: null, unrestricted: false }), JsonException).path);
  }
}
