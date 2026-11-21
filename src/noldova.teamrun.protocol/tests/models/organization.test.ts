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
import { Department, DepartmentMember, Organization, OrganizationTarget } from "@noldova/teamrun.protocol";

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
  public findsWhoATeammateReportsToThroughTheNearestLeaderAbove(): void {
    const design = new Department("design", "Design", null, "lead", 0, "c", "u");
    const web = new Department("web", "Web", "design", "web-lead", 0, "c", "u");
    const docs = new Department("docs", "Docs", "web", null, 1, "c", "u");
    const organization = new Organization([design, web, docs], [new DepartmentMember("lead", "design"), new DepartmentMember("web-lead", "web"),
      new DepartmentMember("dev", "web"), new DepartmentMember("writer", "docs")]);

    Assert.areEqual(JSON.stringify([null, "lead", "web-lead", "web-lead", null]),
      JSON.stringify(["lead", "web-lead", "dev", "writer", "outside"].map(t => organization.managerOf(t))));
  }

  @TestMethod
  public listsTheTeammatesEachTargetGoesToOnceAndSkipsTeammatesNoLongerKnown(): void {
    const design = new Department("design", "Design", null, "lead", 1, "c", "u");
    const web = new Department("web", "Web", "design", null, 0, "c", "u");
    const ops = new Department("ops", "Ops", null, "boss", 0, "c", "u");
    const organization = new Organization([design, web, ops],
      [new DepartmentMember("ann", "design"), new DepartmentMember("lead", "design"), new DepartmentMember("gone", "design"),
        new DepartmentMember("kid", "web"), new DepartmentMember("boss", "ops")]);
    const teammates = ["ann", "boss", "kid", "lead", "solo"];

    Assert.areEqual("lead,ann", organization.recipientsOf(OrganizationTarget.department("design"), teammates).join(","));
    Assert.areEqual("kid", organization.recipientsOf(OrganizationTarget.department("web"), teammates).join(","));
    Assert.areEqual("", organization.recipientsOf(OrganizationTarget.department("missing"), teammates).join(","));
    Assert.areEqual("boss,lead", organization.recipientsOf(OrganizationTarget.leaders, teammates).join(","));
    Assert.areEqual("boss", organization.recipientsOf(OrganizationTarget.leaders, ["boss"]).join(","));
    Assert.areEqual("ann,boss,kid,lead,solo", organization.recipientsOf(OrganizationTarget.everyone, teammates).join(","));
    Assert.areEqual("solo", organization.recipientsOf(OrganizationTarget.teammate("solo"), teammates).join(","));
    Assert.areEqual("", organization.recipientsOf(OrganizationTarget.teammate("gone"), teammates).join(","));
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
