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
import { DepartmentMoveParams } from "@noldova/teamrun.protocol";

@TestClass
export class DepartmentMoveParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new DepartmentMoveParams("d1", "d0", 2).toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(DepartmentMoveParams.fromJson(json).toJson()));
    Assert.isNull(DepartmentMoveParams.fromJson(new DepartmentMoveParams("d1", null, 0).toJson()).parentId);
    Assert.areEqual("$.input.order", Assert.throws(() => DepartmentMoveParams.fromJson({ ...json, order: "last" }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new DepartmentMoveParams(" ", null, 0), ArgumentException);
    Assert.throws(() => new DepartmentMoveParams("d1", " ", 0), ArgumentException);
    Assert.areEqual("parentId", Assert.throws(() => new DepartmentMoveParams("d1", "d1", 0), ArgumentException).parameterName);
    Assert.areEqual("order", Assert.throws(() => new DepartmentMoveParams("d1", null, -1), ArgumentException).parameterName);
  }
}
