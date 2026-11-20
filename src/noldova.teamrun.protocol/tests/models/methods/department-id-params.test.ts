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
import { DepartmentIdParams } from "@noldova/teamrun.protocol";

@TestClass
export class DepartmentIdParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new DepartmentIdParams("d1").toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(DepartmentIdParams.fromJson(json).toJson()));
    Assert.areEqual("$.input.departmentId", Assert.throws(() => DepartmentIdParams.fromJson({ departmentId: 42 }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new DepartmentIdParams(" "), ArgumentException);
  }
}
