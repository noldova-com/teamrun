/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { StopPolicy, StopRequest } from "@noldova/teamrun-shell-protocol";

@TestClass
export class StopRequestTests {
  @TestMethod
  @TestData(StopPolicy.IfIdle, "{\"policy\":\"IfIdle\"}")
  @TestData(StopPolicy.StopWork, "{\"policy\":\"StopWork\"}")
  public pinsItsWireForm(policy: StopPolicy, text: string): void {
    Assert.areEqual(text, JSON.stringify(new StopRequest(policy).toJson()));
    Assert.areEqual(policy, StopRequest.fromJson(JSON.parse(text)).policy);
  }

  @TestMethod
  public rejectsAnUnknownPolicy(): void {
    Assert.areEqual("$.policy", Assert.throws(() => StopRequest.fromJson({ policy: "Never" }), JsonException).path);
  }
}
