/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TeammateIdParams } from "@noldova/teamrun-protocol";

@TestClass
export class TeammateIdParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new TeammateIdParams("teammateId-1");
    const json = value.toJson();
    Assert.areEqual(JSON.stringify(json), JSON.stringify(TeammateIdParams.fromJson(json).toJson()));
    Assert.areEqual("$.input.teammateId", Assert.throws(() => TeammateIdParams.fromJson({ ...json, teammateId: 42 }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new TeammateIdParams(" "), ArgumentException);
  }
}
