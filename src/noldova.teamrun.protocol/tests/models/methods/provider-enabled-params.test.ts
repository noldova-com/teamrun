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
import { ProviderEnabledParams } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderEnabledParamsTests {
  private static readonly json: object = { providerId: "acc-1", enabled: false };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderEnabledParams.fromJson(ProviderEnabledParamsTests.json);

    Assert.areEqual(JSON.stringify(ProviderEnabledParamsTests.json), JSON.stringify(value.toJson()));
    Assert.isTrue(ProviderEnabledParams.fromJson({ providerId: "acc-1", enabled: true }).enabled);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ProviderEnabledParams(String.empty, true), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const blank = Assert.throws(() => ProviderEnabledParams.fromJson({ ...ProviderEnabledParamsTests.json, providerId: " " }), JsonException);
    const missing = Assert.throws(() => ProviderEnabledParams.fromJson({ providerId: "acc-1" }), JsonException);
    const text = Assert.throws(() => ProviderEnabledParams.fromJson({ ...ProviderEnabledParamsTests.json, enabled: "no" }), JsonException);

    Assert.areEqual("$.providerId,$.enabled,$.enabled", [blank.path, missing.path, text.path].join(","));
  }
}
