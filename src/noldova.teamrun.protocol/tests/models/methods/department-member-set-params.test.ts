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
import { DepartmentMemberSetParams } from "@noldova/teamrun.protocol";

@TestClass
export class DepartmentMemberSetParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new DepartmentMemberSetParams("t1", "d1").toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(DepartmentMemberSetParams.fromJson(json).toJson()));
    Assert.isNull(DepartmentMemberSetParams.fromJson(new DepartmentMemberSetParams("t1", null).toJson()).departmentId);
    Assert.areEqual("$.input.departmentId", Assert.throws(() => DepartmentMemberSetParams.fromJson({ teammateId: "t1" }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new DepartmentMemberSetParams(" ", null), ArgumentException);
    Assert.throws(() => new DepartmentMemberSetParams("t1", " "), ArgumentException);
  }
}
