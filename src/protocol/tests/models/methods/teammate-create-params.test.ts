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
import { TeammateCreateParams, Harness } from "@noldova/teamrun-protocol";

@TestClass
export class TeammateCreateParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new TeammateCreateParams("Alice", "Review carefully.", "providerAccountId-1", Harness.Provider, "model-a", "high");
    const json = value.toJson();
    Assert.areEqual(JSON.stringify(json), JSON.stringify(TeammateCreateParams.fromJson(json).toJson()));
    Assert.isNull(TeammateCreateParams.fromJson(new TeammateCreateParams("Alice",
      null,
      "providerAccountId-1",
      Harness.Provider,
      "model-a",
      "high").toJson()).role);
    Assert.isNull(TeammateCreateParams.fromJson(new TeammateCreateParams("Alice",
      "Review carefully.",
      "providerAccountId-1",
      Harness.Provider,
      null,
      "high").toJson()).model);
    Assert.isNull(TeammateCreateParams.fromJson(new TeammateCreateParams("Alice",
      "Review carefully.",
      "providerAccountId-1",
      Harness.Provider,
      "model-a",
      null).toJson()).effort);
    Assert.areEqual("$.input.name", Assert.throws(() => TeammateCreateParams.fromJson({ ...json, name: 42 }, "$.input"), JsonException).path);
    Assert.throws(() => TeammateCreateParams.fromJson({ ...json, harness: "unsupported" }), JsonException);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new TeammateCreateParams(" ", "Review carefully.", "providerAccountId-1", Harness.Provider, "model-a", "high"), ArgumentException);
    Assert.throws(() => new TeammateCreateParams("Alice", " ", "providerAccountId-1", Harness.Provider, "model-a", "high"), ArgumentException);
    Assert.throws(() => new TeammateCreateParams("Alice", "Review carefully.", " ", Harness.Provider, "model-a", "high"), ArgumentException);
    Assert.throws(() => new TeammateCreateParams("Alice",
      "Review carefully.",
      "providerAccountId-1",
      "unsupported" as Harness,
      "model-a",
      "high"),
      ArgumentException);
    Assert.throws(() => new TeammateCreateParams("Alice", "Review carefully.", "providerAccountId-1", Harness.Provider, " ", "high"), ArgumentException);
    Assert.throws(() => new TeammateCreateParams("Alice", "Review carefully.", "providerAccountId-1", Harness.Provider, "model-a", " "), ArgumentException);
  }
}
