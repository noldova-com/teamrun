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
import { TeammateUpdateParams, Harness } from "@noldova/teamrun-protocol";

@TestClass
export class TeammateUpdateParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new TeammateUpdateParams("teammateId-1", "Alice", "Review carefully.", "providerAccountId-1", Harness.Provider, "model-a", "high");
    const json = value.toJson();
    Assert.areEqual(JSON.stringify(json), JSON.stringify(TeammateUpdateParams.fromJson(json).toJson()));
    Assert.isNull(TeammateUpdateParams.fromJson(new TeammateUpdateParams("teammateId-1",
      "Alice",
      null,
      "providerAccountId-1",
      Harness.Provider,
      "model-a",
      "high").toJson()).role);
    Assert.isNull(TeammateUpdateParams.fromJson(new TeammateUpdateParams("teammateId-1",
      "Alice",
      "Review carefully.",
      "providerAccountId-1",
      Harness.Provider,
      null,
      "high").toJson()).model);
    Assert.isNull(TeammateUpdateParams.fromJson(new TeammateUpdateParams("teammateId-1",
      "Alice",
      "Review carefully.",
      "providerAccountId-1",
      Harness.Provider,
      "model-a",
      null).toJson()).effort);
    Assert.areEqual("$.input.teammateId", Assert.throws(() => TeammateUpdateParams.fromJson({ ...json, teammateId: 42 }, "$.input"), JsonException).path);
    Assert.throws(() => TeammateUpdateParams.fromJson({ ...json, harness: "unsupported" }), JsonException);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new TeammateUpdateParams(" ",
      "Alice",
      "Review carefully.",
      "providerAccountId-1",
      Harness.Provider,
      "model-a",
      "high"),
      ArgumentException);
    Assert.throws(() => new TeammateUpdateParams("teammateId-1",
      " ",
      "Review carefully.",
      "providerAccountId-1",
      Harness.Provider,
      "model-a",
      "high"),
      ArgumentException);
    Assert.throws(() => new TeammateUpdateParams("teammateId-1", "Alice", " ", "providerAccountId-1", Harness.Provider, "model-a", "high"), ArgumentException);
    Assert.throws(() => new TeammateUpdateParams("teammateId-1", "Alice", "Review carefully.", " ", Harness.Provider, "model-a", "high"), ArgumentException);
    Assert.throws(() => new TeammateUpdateParams("teammateId-1",
      "Alice",
      "Review carefully.",
      "providerAccountId-1",
      "unsupported" as Harness,
      "model-a",
      "high"),
      ArgumentException);
    Assert.throws(() => new TeammateUpdateParams("teammateId-1",
      "Alice",
      "Review carefully.",
      "providerAccountId-1",
      Harness.Provider,
      " ",
      "high"),
      ArgumentException);
    Assert.throws(() => new TeammateUpdateParams("teammateId-1",
      "Alice",
      "Review carefully.",
      "providerAccountId-1",
      Harness.Provider,
      "model-a",
      " "),
      ArgumentException);
  }
}
