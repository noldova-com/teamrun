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
import { ApprovalDecideParams } from "@noldova/teamrun-protocol";

@TestClass
export class ApprovalDecideParamsTests {
  private static readonly json: object = { approvalId: "apr-1", optionId: "acceptForSession" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ApprovalDecideParams.fromJson(ApprovalDecideParamsTests.json);

    Assert.areEqual(JSON.stringify(ApprovalDecideParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ApprovalDecideParams.fromJson(ApprovalDecideParamsTests.json);

    Assert.throws(() => new ApprovalDecideParams(String.empty, valid.optionId), ArgumentException);
    Assert.throws(() => new ApprovalDecideParams(valid.approvalId, String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ApprovalDecideParams.fromJson({ ...ApprovalDecideParamsTests.json, optionId: String.empty }), JsonException);

    Assert.areEqual("$.optionId", exception.path);
  }
}
