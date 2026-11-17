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
import { ComputerUseGrantIdParams } from "@noldova/teamrun.protocol";

@TestClass
export class ComputerUseGrantIdParamsTests {
  private static readonly json: object = { grantId: "grant-1" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ComputerUseGrantIdParams.fromJson(ComputerUseGrantIdParamsTests.json);

    Assert.areEqual(JSON.stringify(ComputerUseGrantIdParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ComputerUseGrantIdParams(String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const invalid = { ...ComputerUseGrantIdParamsTests.json, grantId: " " };
    const exception = Assert.throws(() => ComputerUseGrantIdParams.fromJson(invalid), JsonException);

    Assert.areEqual("$.grantId", exception.path);
  }
}
