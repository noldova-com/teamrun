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
import { ProviderCreateParams } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderCreateParamsTests {
  private static readonly json: object = { kind: "claude", label: "Work", profileDir: "/profiles/work" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderCreateParams.fromJson(ProviderCreateParamsTests.json);

    Assert.areEqual(JSON.stringify(ProviderCreateParamsTests.json), JSON.stringify(value.toJson()));
    const fresh = ProviderCreateParams.fromJson({ ...ProviderCreateParamsTests.json, profileDir: null });
    Assert.isNull(fresh.profileDir);
    Assert.areEqual(JSON.stringify({ ...ProviderCreateParamsTests.json, profileDir: null }), JSON.stringify(fresh.toJson()));
    Assert.isNull(new ProviderCreateParams("claude", "Work", null).profileDir);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ProviderCreateParams.fromJson(ProviderCreateParamsTests.json);

    Assert.throws(() => new ProviderCreateParams(String.empty, valid.label, valid.profileDir), ArgumentException);
    Assert.throws(() => new ProviderCreateParams(valid.kind, String.empty, valid.profileDir), ArgumentException);
    Assert.throws(() => new ProviderCreateParams(valid.kind, valid.label, String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const invalid = { ...ProviderCreateParamsTests.json, label: String.empty };
    const exception = Assert.throws(() => ProviderCreateParams.fromJson(invalid), JsonException);

    Assert.areEqual("$.label", exception.path);
    const blank = Assert.throws(() => ProviderCreateParams.fromJson({ ...ProviderCreateParamsTests.json, profileDir: " " }), JsonException);
    Assert.areEqual("$.profileDir", blank.path);
    const missing = Assert.throws(() => ProviderCreateParams.fromJson({ kind: "claude", label: "Work" }), JsonException);
    Assert.areEqual("$.profileDir", missing.path);
  }
}
