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
import { DepartmentMember } from "@noldova/teamrun.protocol";

@TestClass
export class DepartmentMemberTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new DepartmentMember("t1", "d1");
    const json = value.toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(DepartmentMember.fromJson(json).toJson()));
    Assert.areEqual("$.input.departmentId", Assert.throws(() => DepartmentMember.fromJson({ ...json, departmentId: null }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new DepartmentMember(" ", "d1"), ArgumentException);
    Assert.throws(() => new DepartmentMember("t1", " "), ArgumentException);
  }
}
