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
import { DepartmentCreateParams, OrganizationParent } from "@noldova/teamrun.protocol";

@TestClass
export class DepartmentCreateParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new DepartmentCreateParams("o1", "Design", "department", OrganizationParent.department("d1"), "t1").toJson();
    const top = DepartmentCreateParams.fromJson({ organizationId: "o1", name: "Design", typeId: "department", parent: OrganizationParent.person.toJson() });

    Assert.areEqual(JSON.stringify(json), JSON.stringify(DepartmentCreateParams.fromJson(json).toJson()));
    Assert.areEqual("Person,", `${top.parent.kind},${top.leaderId ?? ""}`);
    Assert.areEqual("Teammate:t1", [DepartmentCreateParams.fromJson({ ...json, parent: OrganizationParent.teammate("t1").toJson() }).parent]
      .map(t => `${t.kind}:${t.id ?? ""}`).join(","));
    Assert.areEqual("$.input.name", Assert.throws(() => DepartmentCreateParams.fromJson({ ...json, name: " " }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.parent", Assert.throws(() => DepartmentCreateParams.fromJson({ organizationId: "o1", name: "Design", typeId: "department" }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.typeId", Assert.throws(() => DepartmentCreateParams.fromJson({ ...json, typeId: undefined }, "$.input"), JsonException).path);
    Assert.areEqual("department", top.typeId);
    Assert.areEqual("$.input.parent.id", Assert.throws(() => DepartmentCreateParams.fromJson({ ...json, parent: { kind: "Department", id: 1 } }, "$.input"),
      JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("organizationId", Assert.throws(() => new DepartmentCreateParams(" ", "Design", "department", OrganizationParent.person), ArgumentException).parameterName);
    Assert.areEqual("$.input.organizationId", Assert.throws(() => DepartmentCreateParams.fromJson({ name: "Design", typeId: "department", parent: OrganizationParent.person.toJson() }, "$.input"), JsonException).path);
    Assert.areEqual("typeId", Assert.throws(() => new DepartmentCreateParams("o1", "Design", " ", OrganizationParent.person), ArgumentException).parameterName);
    Assert.throws(() => new DepartmentCreateParams("o1", " ", "department", OrganizationParent.person), ArgumentException);
    Assert.areEqual("leaderId", Assert.throws(() => new DepartmentCreateParams("o1", "Design", "department", OrganizationParent.person, " "), ArgumentException).parameterName);
  }
}
