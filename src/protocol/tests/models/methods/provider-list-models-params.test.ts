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
import { ProviderListModelsParams } from "@noldova/teamrun-protocol";

@TestClass
export class ProviderListModelsParamsTests {
  private static readonly json: object = { provider: "codex", providerAccountId: null };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderListModelsParams.fromJson(ProviderListModelsParamsTests.json);

    Assert.areEqual(JSON.stringify(ProviderListModelsParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ProviderListModelsParams.fromJson(ProviderListModelsParamsTests.json);

    Assert.throws(() => new ProviderListModelsParams(String.empty, valid.providerAccountId), ArgumentException);
    Assert.throws(() => new ProviderListModelsParams(valid.provider, " "), ArgumentException);
    Assert.doesNotThrow(() => new ProviderListModelsParams(valid.provider, "acc-1"));
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ProviderListModelsParams.fromJson({ ...ProviderListModelsParamsTests.json, provider: 1 }), JsonException);

    Assert.areEqual("$.provider", exception.path);
  }
}
