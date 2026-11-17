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
import { ProviderSignIns } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderSignInsTests {
  private static readonly json: object = { providerIds: ["a1", "a2"] };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderSignIns.fromJson(ProviderSignInsTests.json);

    Assert.areEqual(JSON.stringify(ProviderSignInsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("a1,a2", value.providerIds.join(","));
    Assert.areEqual(JSON.stringify({ providerIds: [] }), JSON.stringify(new ProviderSignIns([]).toJson()));
  }

  @TestMethod
  public keepsItsOwnCopyOfTheIds(): void {
    const ids = ["a1"];
    const value = new ProviderSignIns(ids);

    ids.push("a2");

    Assert.areEqual("a1", value.providerIds.join(","));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ProviderSignIns(["a1", " "]), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ProviderSignIns.fromJson({ providerIds: ["a1", 2] }), JsonException);

    Assert.isTrue(exception.path.startsWith("$.providerIds"));
  }
}
