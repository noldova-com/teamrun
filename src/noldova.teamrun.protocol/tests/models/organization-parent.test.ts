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
import { OrganizationNodeKind, OrganizationParent } from "@noldova/teamrun.protocol";

@TestClass
export class OrganizationParentTests {
  @TestMethod
  public namesEachKindOfNodeAndRoundTripsIt(): void {
    const nodes = [OrganizationParent.person, OrganizationParent.teammate("t1"), OrganizationParent.department("d1"),
      OrganizationParent.departmentOrPerson("d2"), OrganizationParent.departmentOrPerson(null)];

    Assert.areEqual("Person:,Teammate:t1,Department:d1,Department:d2,Person:", nodes.map(t => `${t.kind}:${t.id ?? ""}`).join(","));
    Assert.areEqual(JSON.stringify(nodes.map(t => t.toJson())), JSON.stringify(nodes.map(t => OrganizationParent.fromJson(t.toJson()).toJson())));
    Assert.areEqual(JSON.stringify({ kind: "Department", id: "d1" }), JSON.stringify(OrganizationParent.department("d1").toJson()));
    Assert.areEqual("Person,Teammate,Department", Object.values(OrganizationNodeKind).join(","));
  }

  @TestMethod
  public equalsOnlyTheSameKindAndId(): void {
    Assert.isTrue(OrganizationParent.teammate("a").equals(new OrganizationParent(OrganizationNodeKind.Teammate, "a")));
    Assert.isTrue(OrganizationParent.person.equals(OrganizationParent.departmentOrPerson(null)));
    Assert.isFalse(OrganizationParent.teammate("a").equals(OrganizationParent.department("a")));
    Assert.isFalse(OrganizationParent.department("a").equals(OrganizationParent.department("b")));
  }

  @TestMethod
  public refusesAnIdThatDoesNotFitTheKind(): void {
    Assert.areEqual("id", Assert.throws(() => new OrganizationParent(OrganizationNodeKind.Person, "p1"), ArgumentException).parameterName);
    Assert.areEqual("id", Assert.throws(() => new OrganizationParent(OrganizationNodeKind.Teammate, null), ArgumentException).parameterName);
    Assert.areEqual("id", Assert.throws(() => OrganizationParent.department(" "), ArgumentException).parameterName);
    Assert.areEqual("$.input.kind", Assert.throws(() => OrganizationParent.fromJson({ kind: "Team", id: "a" }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.id", Assert.throws(() => OrganizationParent.fromJson({ kind: "Teammate", id: 1 }, "$.input"), JsonException).path);
  }
}
