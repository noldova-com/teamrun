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
import { Department } from "@noldova/teamrun.protocol";

@TestClass
export class DepartmentTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new Department("d1", "Research & Development", "d0", "t1", 2, "2026-11-20T00:00:00.000Z", "2026-11-20T01:00:00.000Z");
    const json = value.toJson();
    const top = Department.fromJson(new Department("d2", "Design", null, null, 0, "c", "u").toJson());

    Assert.areEqual(JSON.stringify(json), JSON.stringify(Department.fromJson(json).toJson()));
    Assert.areEqual("d1,Research & Development,d0,t1,2", [value.id, value.name, value.parentId, value.leaderId, value.order].join(","));
    Assert.isNull(top.parentId);
    Assert.isNull(top.leaderId);
    Assert.areEqual("$.input.name", Assert.throws(() => Department.fromJson({ ...json, name: "Two\nlines" }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.order", Assert.throws(() => Department.fromJson({ ...json, order: "first" }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new Department(" ", "Design", null, null, 0, "c", "u"), ArgumentException);
    Assert.throws(() => new Department("d1", "Design", " ", null, 0, "c", "u"), ArgumentException);
    Assert.throws(() => new Department("d1", "Design", null, " ", 0, "c", "u"), ArgumentException);
    Assert.throws(() => new Department("d1", "Design", null, null, 0, " ", "u"), ArgumentException);
    Assert.throws(() => new Department("d1", "Design", null, null, 0, "c", " "), ArgumentException);
    Assert.areEqual("parentId", Assert.throws(() => new Department("d1", "Design", "d1", null, 0, "c", "u"), ArgumentException).parameterName);
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
