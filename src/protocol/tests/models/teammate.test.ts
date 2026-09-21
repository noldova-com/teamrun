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
import { Teammate, Harness } from "@noldova/teamrun-protocol";

@TestClass
export class TeammateTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerAccountId-1",
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
      "providerAccountId-1",
      Harness.Provider,
      "model-a",
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z").toJson()).role);
    Assert.isNull(Teammate.fromJson(new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerAccountId-1",
      Harness.Provider,
      null,
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z").toJson()).model);
    Assert.isNull(Teammate.fromJson(new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerAccountId-1",
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
      "providerAccountId-1",
      Harness.Provider,
      "model-a",
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z"),
      ArgumentException);
    Assert.throws(() => new Teammate("id-1",
      " ",
      "Review carefully.",
      "providerAccountId-1",
      Harness.Provider,
      "model-a",
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z"),
      ArgumentException);
    Assert.throws(() => new Teammate("id-1",
      "Alice",
      " ",
      "providerAccountId-1",
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
      "providerAccountId-1",
      "unsupported" as Harness,
      "model-a",
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z"),
      ArgumentException);
    Assert.throws(() => new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerAccountId-1",
      Harness.Provider,
      " ",
      "high",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z"),
      ArgumentException);
    Assert.throws(() => new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerAccountId-1",
      Harness.Provider,
      "model-a",
      " ",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00Z"),
      ArgumentException);
    Assert.throws(() => new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerAccountId-1",
      Harness.Provider,
      "model-a",
      "high",
      " ",
      "2026-09-15T00:00:00Z"),
      ArgumentException);
    Assert.throws(() => new Teammate("id-1",
      "Alice",
      "Review carefully.",
      "providerAccountId-1",
      Harness.Provider,
      "model-a",
      "high",
      "2026-09-15T00:00:00Z",
      " "),
      ArgumentException);
  }
}
