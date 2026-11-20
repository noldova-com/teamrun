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
import { Department, DepartmentMember, Organization } from "@noldova/teamrun.protocol";

@TestClass
export class OrganizationTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new Organization([OrganizationTests.department("d1", null, 0), OrganizationTests.department("d2", "d1", 0)],
      [new DepartmentMember("t1", "d2")]);
    const json = value.toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(Organization.fromJson(json).toJson()));
    Assert.areEqual("$.input.departments.0.id",
      Assert.throws(() => Organization.fromJson({ ...json, departments: [{ ...OrganizationTests.department("d1", null, 0).toJson(), id: 1 }] }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.members.0.teammateId",
      Assert.throws(() => Organization.fromJson({ ...json, members: [{ departmentId: "d1" }] }, "$.input"), JsonException).path);
    Assert.areEqual(0, Organization.empty.departments.length + Organization.empty.members.length);
  }

  @TestMethod
  public listsDepartmentsByOrderThenByCreation(): void {
    const organization = new Organization([OrganizationTests.department("late", null, 1, "2"), OrganizationTests.department("b", null, 0, "3"),
      OrganizationTests.department("a", null, 1, "1"), OrganizationTests.department("child", "a", 0, "0")], []);

    Assert.areEqual("b,a,late", organization.childrenOf(null).map(t => t.id).join(","));
    Assert.areEqual("child", organization.childrenOf("a").map(t => t.id).join(","));
    Assert.areEqual(0, organization.childrenOf("b").length);
  }

  @TestMethod
  public findsTheDepartmentOfATeammateOrNone(): void {
    const organization = new Organization([OrganizationTests.department("d1", null, 0)], [new DepartmentMember("t1", "d1")]);

    Assert.areEqual("d1", organization.departmentOf("t1"));
    Assert.isNull(organization.departmentOf("t2"));
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    const d1 = OrganizationTests.department("d1", null, 0);

    Assert.areEqual("departments", Assert.throws(() => new Organization([d1, d1], []), ArgumentException).parameterName);
    Assert.areEqual("departments", Assert.throws(() => new Organization([OrganizationTests.department("d2", "gone", 0)], []), ArgumentException).parameterName);
    Assert.areEqual("members", Assert.throws(() => new Organization([d1], [new DepartmentMember("t1", "gone")]), ArgumentException).parameterName);
    Assert.areEqual("members", Assert.throws(() => new Organization([d1, OrganizationTests.department("d2", null, 1)],
      [new DepartmentMember("t1", "d1"), new DepartmentMember("t1", "d2")]), ArgumentException).parameterName);
  }

  private static department(id: string, parentId: string | null, order: number, createdAt: string = "c"): Department {
    return new Department(id, id, parentId, null, order, createdAt, "u");
  }
}
