/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Department, OrganizationParent } from "@noldova/teamrun.protocol";

@TestClass
export class DepartmentTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new Department("d1", "Research & Development", OrganizationParent.department("d0"), "t1", 2, "2026-11-20T00:00:00.000Z",
      "2026-11-20T01:00:00.000Z");
    const json = value.toJson();
    const top = Department.fromJson(new Department("d2", "Design", OrganizationParent.person, null, 0, "c", "u").toJson());

    Assert.areEqual(JSON.stringify(json), JSON.stringify(Department.fromJson(json).toJson()));
    Assert.areEqual("d1,Research & Development,d0,t1,2", [value.id, value.name, value.parentId, value.leaderId, value.order].join(","));
    Assert.isNull(top.parentId);
    Assert.isNull(top.leaderId);
    Assert.isNull(new Department("d3", "Docs", OrganizationParent.teammate("t1"), null, 0, "c", "u").parentId);
    Assert.areEqual("t1", Department.fromJson(new Department("d3", "Docs", OrganizationParent.teammate("t1"), null, 0, "c", "u").toJson()).parent.id);
    Assert.areEqual("$.input.parent", Assert.throws(() => Department.fromJson({ ...json, parent: null }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.parent.kind", Assert.throws(() => Department.fromJson({ ...json, parent: { kind: "Team", id: "d0" } }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.name", Assert.throws(() => Department.fromJson({ ...json, name: "Two\nlines" }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.order", Assert.throws(() => Department.fromJson({ ...json, order: "first" }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new Department(" ", "Design", OrganizationParent.person, null, 0, "c", "u"), ArgumentException);
    Assert.throws(() => new Department("d1", "Design", OrganizationParent.department(" "), null, 0, "c", "u"), ArgumentException);
    Assert.throws(() => new Department("d1", "Design", OrganizationParent.person, " ", 0, "c", "u"), ArgumentException);
    Assert.throws(() => new Department("d1", "Design", OrganizationParent.person, null, 0, " ", "u"), ArgumentException);
    Assert.throws(() => new Department("d1", "Design", OrganizationParent.person, null, 0, "c", " "), ArgumentException);
    Assert.areEqual("parent", Assert.throws(() => new Department("d1", "Design", OrganizationParent.department("d1"), null, 0, "c", "u"), ArgumentException).parameterName);
    Assert.isNotNull(new Department("d1", "Design", OrganizationParent.teammate("d1"), null, 0, "c", "u"));
  }

  @TestMethod
  @TestData("")
  @TestData("   ")
  @TestData("Two\nlines")
  @TestData("Tab\there")
  public refusesANameThatIsBlankOrHasAControlCharacter(name: string): void {
    Assert.areEqual("name", Assert.throws(() => Department.validateName(name), ArgumentException).parameterName);
  }

  @TestMethod
  public takesANameOfUpTo100Characters(): void {
    Department.validateName("x".repeat(100));
    Department.validateName("R&D / Ops (EU)");

    Assert.throws(() => Department.validateName("x".repeat(101)), ArgumentException);
  }

  @TestMethod
  @TestData(-1)
  @TestData(1.5)
  @TestData(Number.NaN)
  public refusesAnOrderThatIsNotAWholeNumberFromZero(order: number): void {
    Assert.areEqual("order", Assert.throws(() => Department.validateOrder(order), ArgumentException).parameterName);
  }
}
