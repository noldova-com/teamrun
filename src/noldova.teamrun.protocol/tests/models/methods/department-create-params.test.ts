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
import { DepartmentCreateParams } from "@noldova/teamrun.protocol";

@TestClass
export class DepartmentCreateParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new DepartmentCreateParams("Design", "d1").toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(DepartmentCreateParams.fromJson(json).toJson()));
    Assert.isNull(DepartmentCreateParams.fromJson(new DepartmentCreateParams("Design", null).toJson()).parentId);
    Assert.areEqual("$.input.name", Assert.throws(() => DepartmentCreateParams.fromJson({ ...json, name: " " }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.parentId", Assert.throws(() => DepartmentCreateParams.fromJson({ name: "Design" }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new DepartmentCreateParams(" ", null), ArgumentException);
    Assert.throws(() => new DepartmentCreateParams("Design", " "), ArgumentException);
  }
}
