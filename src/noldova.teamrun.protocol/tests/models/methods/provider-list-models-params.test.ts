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
import { ProviderListModelsParams } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderListModelsParamsTests {
  private static readonly json: object = { kind: "codex", providerId: null, refresh: true };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderListModelsParams.fromJson(ProviderListModelsParamsTests.json);

    Assert.areEqual(JSON.stringify(ProviderListModelsParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public carriesAFolderOnlyWhenOneIsGiven(): void {
    const value = new ProviderListModelsParams("codex", null, false, "/work");

    Assert.areEqual("/work", ProviderListModelsParams.fromJson(value.toJson()).workingDirectory);
    Assert.isNull(ProviderListModelsParams.fromJson({ kind: "codex", providerId: null }).workingDirectory);
    Assert.isFalse("workingDirectory" in new ProviderListModelsParams("codex", null).toJson());
  }

  @TestMethod
  public readsAMissingRefreshAsNone(): void {
    Assert.isFalse(ProviderListModelsParams.fromJson({ kind: "codex", providerId: null }).refresh);
    Assert.isFalse(new ProviderListModelsParams("codex", null).refresh);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ProviderListModelsParams.fromJson(ProviderListModelsParamsTests.json);

    Assert.throws(() => new ProviderListModelsParams(String.empty, valid.providerId), ArgumentException);
    Assert.throws(() => new ProviderListModelsParams(valid.kind, " "), ArgumentException);
    Assert.doesNotThrow(() => new ProviderListModelsParams(valid.kind, "acc-1"));
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ProviderListModelsParams.fromJson({ ...ProviderListModelsParamsTests.json, kind: 1 }), JsonException);

    Assert.areEqual("$.kind", exception.path);
  }
}
