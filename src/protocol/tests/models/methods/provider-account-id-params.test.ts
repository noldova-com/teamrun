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
import { ProviderAccountIdParams } from "@noldova/teamrun-protocol";

@TestClass
export class ProviderAccountIdParamsTests {
  private static readonly json: object = { providerAccountId: "acc-1" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderAccountIdParams.fromJson(ProviderAccountIdParamsTests.json);

    Assert.areEqual(JSON.stringify(ProviderAccountIdParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ProviderAccountIdParams(String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const invalid = { ...ProviderAccountIdParamsTests.json, providerAccountId: " " };
    const exception = Assert.throws(() => ProviderAccountIdParams.fromJson(invalid), JsonException);

    Assert.areEqual("$.providerAccountId", exception.path);
  }
}
