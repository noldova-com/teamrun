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
import { Department, DepartmentUpdateParams, OrganizationParent } from "@noldova/teamrun.protocol";

@TestClass
export class DepartmentUpdateParamsTests {
  @TestMethod
  public writesOnlyTheFieldsItChanges(): void {
    Assert.areEqual('{"organizationId":"o1","departmentId":"d1","name":"Design","leaderId":"t1"}', JSON.stringify(new DepartmentUpdateParams("o1", "d1", "Design", "t1").toJson()));
    Assert.areEqual('{"organizationId":"o1","departmentId":"d1","name":"Design"}', JSON.stringify(new DepartmentUpdateParams("o1", "d1", "Design", undefined).toJson()));
    Assert.areEqual('{"organizationId":"o1","departmentId":"d1","leaderId":null}', JSON.stringify(new DepartmentUpdateParams("o1", "d1", undefined, null).toJson()));
  }

  @TestMethod
  public readsOmittedFieldsAsKeptAndANullLeaderAsCleared(): void {
    const renamed = DepartmentUpdateParams.fromJson({ organizationId: "o1", departmentId: "d1", name: "Design" });
    const cleared = DepartmentUpdateParams.fromJson({ organizationId: "o1", departmentId: "d1", leaderId: null });

    Assert.areEqual("Design", renamed.name);
    Assert.isUndefined(renamed.leaderId);
    Assert.isUndefined(cleared.name);
    Assert.isNull(cleared.leaderId);
    Assert.areEqual("t1", DepartmentUpdateParams.fromJson({ organizationId: "o1", departmentId: "d1", leaderId: "t1" }).leaderId);
    Assert.areEqual("$.input.name", Assert.throws(() => DepartmentUpdateParams.fromJson({ organizationId: "o1", departmentId: "d1", name: "" }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.departmentId", Assert.throws(() => DepartmentUpdateParams.fromJson({ organizationId: "o1", name: "Design" }, "$.input"), JsonException).path);
  }

  @TestMethod
  public appliesItsChangesAndKeepsTheRest(): void {
    const department = new Department("d1", "Design", OrganizationParent.department("d0"), "t1", 3, "c", "u");

    const renamed = new DepartmentUpdateParams("o1", "d1", "Product", undefined).applyTo(department, "later");
    const cleared = new DepartmentUpdateParams("o1", "d1", undefined, null).applyTo(department, "later");

    Assert.areEqual("d1,Product,d0,t1,3,c,later",
      [renamed.id, renamed.name, renamed.parentId, renamed.leaderId, renamed.order, renamed.createdAt, renamed.updatedAt].join(","));
    Assert.areEqual("Design", cleared.name);
    Assert.isNull(cleared.leaderId);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("organizationId", Assert.throws(() => new DepartmentUpdateParams(" ", "d1", "Design", undefined), ArgumentException).parameterName);
    Assert.areEqual("$.input.organizationId", Assert.throws(() => DepartmentUpdateParams.fromJson({ departmentId: "d1", name: "Design" }, "$.input"), JsonException).path);
    Assert.throws(() => new DepartmentUpdateParams("o1", " ", "Design", undefined), ArgumentException);
    Assert.areEqual("departmentId", Assert.throws(() => new DepartmentUpdateParams("o1", "d1", undefined, undefined), ArgumentException).parameterName);
    Assert.throws(() => new DepartmentUpdateParams("o1", "d1", " ", undefined), ArgumentException);
    Assert.throws(() => new DepartmentUpdateParams("o1", "d1", undefined, " "), ArgumentException);
  }
}
