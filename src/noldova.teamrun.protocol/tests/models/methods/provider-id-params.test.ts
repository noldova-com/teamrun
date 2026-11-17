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
import { ProviderIdParams } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderIdParamsTests {
  private static readonly json: object = { providerId: "acc-1" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderIdParams.fromJson(ProviderIdParamsTests.json);

    Assert.areEqual(JSON.stringify(ProviderIdParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ProviderIdParams(String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const invalid = { ...ProviderIdParamsTests.json, providerId: " " };
    const exception = Assert.throws(() => ProviderIdParams.fromJson(invalid), JsonException);

    Assert.areEqual("$.providerId", exception.path);
  }
}
