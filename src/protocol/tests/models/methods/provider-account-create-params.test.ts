/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProviderAccountCreateParams } from "@noldova/teamrun-protocol";

@TestClass
export class ProviderAccountCreateParamsTests {
  private static readonly json: object = { provider: "claude", label: "Work", profileDir: "/profiles/work" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderAccountCreateParams.fromJson(ProviderAccountCreateParamsTests.json);

    Assert.areEqual(JSON.stringify(ProviderAccountCreateParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ProviderAccountCreateParams.fromJson(ProviderAccountCreateParamsTests.json);

    Assert.throws(() => new ProviderAccountCreateParams(String.empty, valid.label, valid.profileDir), ArgumentException);
    Assert.throws(() => new ProviderAccountCreateParams(valid.provider, String.empty, valid.profileDir), ArgumentException);
    Assert.throws(() => new ProviderAccountCreateParams(valid.provider, valid.label, String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const invalid = { ...ProviderAccountCreateParamsTests.json, label: String.empty };
    const exception = Assert.throws(() => ProviderAccountCreateParams.fromJson(invalid), JsonException);

    Assert.areEqual("$.label", exception.path);
  }
}
