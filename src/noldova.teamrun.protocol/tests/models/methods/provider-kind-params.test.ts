/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProviderKindParams } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderKindParamsTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    Assert.areEqual("{\"kind\":\"antigravity\"}", JSON.stringify(ProviderKindParams.fromJson({ kind: "antigravity" }).toJson()));
  }

  @TestMethod
  public rejectsABlankProvider(): void {
    Assert.throws(() => new ProviderKindParams(" "), ArgumentException);
    Assert.areEqual("$.kind", Assert.throws(() => ProviderKindParams.fromJson({ kind: 1 }), JsonException).path);
  }
}
