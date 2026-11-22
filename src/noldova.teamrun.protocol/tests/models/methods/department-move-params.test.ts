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
import { DepartmentMoveParams, OrganizationParent } from "@noldova/teamrun.protocol";

@TestClass
export class DepartmentMoveParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new DepartmentMoveParams("o1", "d1", OrganizationParent.department("d0"), 2).toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(DepartmentMoveParams.fromJson(json).toJson()));
    Assert.areEqual("Person", DepartmentMoveParams.fromJson(new DepartmentMoveParams("o1", "d1", OrganizationParent.person, 0).toJson()).parent.kind);
    Assert.areEqual("$.input.order", Assert.throws(() => DepartmentMoveParams.fromJson({ ...json, order: "last" }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.parent", Assert.throws(() => DepartmentMoveParams.fromJson({ ...json, parent: "d0" }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("organizationId", Assert.throws(() => new DepartmentMoveParams(" ", "d1", OrganizationParent.person, 0), ArgumentException).parameterName);
    Assert.areEqual("$.input.organizationId", Assert.throws(() => DepartmentMoveParams.fromJson({ departmentId: "d1", parent: OrganizationParent.person.toJson(), order: 0 }, "$.input"), JsonException).path);
    Assert.throws(() => new DepartmentMoveParams("o1", " ", OrganizationParent.person, 0), ArgumentException);
    Assert.areEqual("parent", Assert.throws(() => new DepartmentMoveParams("o1", "d1", OrganizationParent.department("d1"), 0), ArgumentException).parameterName);
    Assert.areEqual("order", Assert.throws(() => new DepartmentMoveParams("o1", "d1", OrganizationParent.person, -1), ArgumentException).parameterName);
    Assert.areEqual("d1", new DepartmentMoveParams("o1", "d1", OrganizationParent.teammate("d1"), 0).parent.id);
  }
}
