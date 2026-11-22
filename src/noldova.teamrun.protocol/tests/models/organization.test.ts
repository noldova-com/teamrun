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
import { Department, NodeType, Organization, OrganizationNodeKind, OrganizationParent, OrganizationTarget, Resources, TeammatePlacement } from "@noldova/teamrun.protocol";

const nodeTypes = [new NodeType("department", "Department", null, null, "c", "u")];

@TestClass
export class OrganizationTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = OrganizationTests.of([OrganizationTests.department("d1", null, 0), OrganizationTests.department("d2", "d1", 0)],
      [new TeammatePlacement("t1", OrganizationParent.department("d2"), 0), new TeammatePlacement("t2", OrganizationParent.teammate("t1"), 0)]);
    const json = value.toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(Organization.fromJson(json).toJson()));
    Assert.areEqual("$.input.departments.0.id",
      Assert.throws(() => Organization.fromJson({ ...json, departments: [{ ...OrganizationTests.department("d1", null, 0).toJson(), id: 1 }] }, "$.input"),
        JsonException).path);
    Assert.areEqual("$.input.placements.0.teammateId",
      Assert.throws(() => Organization.fromJson({ ...json, placements: [{ parent: OrganizationParent.person.toJson(), order: 0 }] }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.placements", Assert.throws(() => Organization.fromJson({ ...json, placements: undefined }, "$.input"), JsonException).path);
    Assert.areEqual(0, OrganizationTests.of([], []).departments.length + OrganizationTests.of([], []).placements.length);
  }

  @TestMethod
  public listsDepartmentsByOrderThenByCreation(): void {
    const organization = OrganizationTests.of([OrganizationTests.department("late", null, 1, "2"), OrganizationTests.department("b", null, 0, "3"),
      OrganizationTests.department("a", null, 1, "1"), OrganizationTests.department("child", "a", 0, "0")], []);

    Assert.areEqual("b,a,late", organization.departmentsUnder(OrganizationParent.person).map(t => t.id).join(","));
    Assert.areEqual("child", organization.departmentsUnder(OrganizationParent.department("a")).map(t => t.id).join(","));
    Assert.areEqual(0, organization.departmentsUnder(OrganizationParent.department("b")).length);
  }

  @TestMethod
  public listsEachNodesChildrenDepartmentsFirstThenTeammatesByOrderThenById(): void {
    const organization = OrganizationTests.tree();

    Assert.areEqual("Department:ops,Teammate:boss,Teammate:solo", OrganizationTests.names(organization.childrenOf(OrganizationParent.person)));
    Assert.areEqual("Department:web,Teammate:ann,Teammate:lead", OrganizationTests.names(organization.childrenOf(OrganizationParent.department("design"))));
    Assert.areEqual("Department:design,Teammate:aide", OrganizationTests.names(organization.childrenOf(OrganizationParent.teammate("boss"))));
    Assert.areEqual("ann,lead", organization.placementsUnder(OrganizationParent.department("design")).map(t => t.teammateId).join(","));
    Assert.areEqual("", OrganizationTests.names(organization.childrenOf(OrganizationParent.teammate("kid"))));
  }

  @TestMethod
  public findsEachNodesParentAndItsPathFromTheTop(): void {
    const organization = OrganizationTests.tree();

    Assert.areEqual("Teammate:boss", OrganizationTests.names([organization.parentOf(OrganizationParent.department("design")) ?? OrganizationParent.person]));
    Assert.areEqual("Department:web", OrganizationTests.names([organization.parentOf(OrganizationParent.teammate("kid")) ?? OrganizationParent.person]));
    Assert.isNull(organization.parentOf(OrganizationParent.person));
    Assert.isNull(organization.parentOf(OrganizationParent.teammate("nobody")));
    Assert.isNull(organization.parentOf(OrganizationParent.department("missing")));
    Assert.areEqual("Teammate:boss,Department:design,Department:web,Teammate:kid", OrganizationTests.names(organization.pathOf(OrganizationParent.teammate("kid"))));
    Assert.areEqual("", OrganizationTests.names(organization.pathOf(OrganizationParent.person)));
    Assert.areEqual("Teammate:nobody", OrganizationTests.names(organization.pathOf(OrganizationParent.teammate("nobody"))));
  }

  @TestMethod
  public findsTheNearestDepartmentAboveATeammateOrNone(): void {
    const organization = OrganizationTests.tree();

    Assert.areEqual(JSON.stringify(["web", "design", null, null, null]),
      JSON.stringify(["kid", "ann", "boss", "aide", "nobody"].map(t => organization.departmentOf(t))));
  }

  @TestMethod
  public keepsTheDepartmentMembersAsTheTeammatesDirectlyInADepartment(): void {
    const organization = OrganizationTests.tree();

    Assert.areEqual("ann:design,boss2:ops,kid:web,lead:design", organization.members.map(t => `${t.teammateId}:${t.departmentId}`).join(","));
  }

  @TestMethod
  public listsTheTeammatesPlacedAndNotYetPlaced(): void {
    Assert.areEqual("new,other", OrganizationTests.tree().unplaced(["ann", "new", "boss", "other"]).join(","));
  }

  @TestMethod
  public countsDepartmentLeadersAndTeammatesWithSomeoneUnderThemAsLeaders(): void {
    Assert.areEqual("boss2,lead,boss", OrganizationTests.tree().leaders.join(","));
    Assert.areEqual("", OrganizationTests.of([], []).leaders.join(","));
  }

  @TestMethod
  public findsWhoATeammateReportsToThroughTheNearestLeaderAbove(): void {
    const design = new Department("design", "Design", "department", OrganizationParent.person, "lead", 0, "c", "u");
    const web = new Department("web", "Web", "department", OrganizationParent.department("design"), "web-lead", 0, "c", "u");
    const docs = new Department("docs", "Docs", "department", OrganizationParent.department("web"), null, 1, "c", "u");
    const organization = OrganizationTests.of([design, web, docs], [new TeammatePlacement("lead", OrganizationParent.department("design"), 0),
      new TeammatePlacement("web-lead", OrganizationParent.department("web"), 0),
      new TeammatePlacement("dev", OrganizationParent.department("web"), 1), new TeammatePlacement("writer", OrganizationParent.department("docs"), 0),
      new TeammatePlacement("intern", OrganizationParent.teammate("dev"), 0)]);

    Assert.areEqual(JSON.stringify([null, "lead", "web-lead", "web-lead", "dev", null]),
      JSON.stringify(["lead", "web-lead", "dev", "writer", "intern", "outside"].map(t => organization.managerOf(t))));
    Assert.areEqual(JSON.stringify(["lead", "boss", "boss", "lead", null]),
      JSON.stringify(["ann", "lead", "aide", "kid", "boss"].map(t => OrganizationTests.tree().managerOf(t))));
  }

  @TestMethod
  public saysWhyANodeCantMoveUnderAParent(): void {
    const organization = OrganizationTests.tree();
    const error = (node: OrganizationParent, parent: OrganizationParent): string | null => organization.moveError(node, parent);

    Assert.areEqual(Resources.personCannotMove, error(OrganizationParent.person, OrganizationParent.department("ops")));
    Assert.areEqual(Resources.unknownOrganizationParent, error(OrganizationParent.department("web"), OrganizationParent.department("missing")));
    Assert.areEqual(Resources.unknownOrganizationParent, error(OrganizationParent.department("web"), OrganizationParent.teammate("nobody")));
    Assert.areEqual(Resources.organizationNodeUnderItself, error(OrganizationParent.department("design"), OrganizationParent.department("design")));
    Assert.areEqual(Resources.organizationNodeUnderItself, error(OrganizationParent.department("design"), OrganizationParent.teammate("kid")));
    Assert.areEqual(Resources.organizationNodeUnderItself, error(OrganizationParent.teammate("boss"), OrganizationParent.department("web")));
    Assert.isNull(error(OrganizationParent.department("web"), OrganizationParent.person));
    Assert.isNull(error(OrganizationParent.teammate("kid"), OrganizationParent.teammate("solo")));
    Assert.isNull(error(OrganizationParent.teammate("new"), OrganizationParent.department("ops")));
  }

  @TestMethod
  public listsThePlacedTeammatesEachTargetGoesToOnceWithTheDepartmentTargetReachingEveryTeammateInItAndTheLeadersTargetTheTeammatesUnderThePerson(): void {
    const design = new Department("design", "Design", "department", OrganizationParent.person, "lead", 1, "c", "u");
    const web = new Department("web", "Web", "department", OrganizationParent.department("design"), null, 0, "c", "u");
    const ops = new Department("ops", "Ops", "department", OrganizationParent.person, "boss", 0, "c", "u");
    const organization = OrganizationTests.of([design, web, ops],
      [new TeammatePlacement("ann", OrganizationParent.department("design"), 0), new TeammatePlacement("lead", OrganizationParent.department("design"), 1),
        new TeammatePlacement("gone", OrganizationParent.department("design"), 2),
        new TeammatePlacement("kid", OrganizationParent.department("web"), 0), new TeammatePlacement("boss", OrganizationParent.department("ops"), 0),
        new TeammatePlacement("aide", OrganizationParent.teammate("ann"), 0), new TeammatePlacement("sol", OrganizationParent.person, 0)]);
    const teammates = ["aide", "ann", "boss", "kid", "lead", "sol", "solo"];

    Assert.areEqual("lead,aide,ann", organization.recipientsOf(OrganizationTarget.department("design"), teammates).join(","));
    Assert.areEqual("kid", organization.recipientsOf(OrganizationTarget.department("web"), teammates).join(","));
    Assert.areEqual("", organization.recipientsOf(OrganizationTarget.department("missing"), teammates).join(","));
    Assert.areEqual("boss,lead,ann,sol", organization.recipientsOf(OrganizationTarget.leaders, teammates).join(","));
    Assert.areEqual("boss", organization.recipientsOf(OrganizationTarget.leaders, ["boss"]).join(","));
    Assert.areEqual("", OrganizationTests.of([new Department("ops", "Ops", "department", OrganizationParent.person, "outside", 0, "c", "u")], [])
      .recipientsOf(OrganizationTarget.leaders, ["solo", "outside"]).join(","));
    Assert.areEqual("aide,ann,boss,kid,lead,sol", organization.recipientsOf(OrganizationTarget.everyone, teammates).join(","));
    Assert.areEqual("sol", organization.recipientsOf(OrganizationTarget.teammate("sol"), teammates).join(","));
    Assert.areEqual("", organization.recipientsOf(OrganizationTarget.teammate("solo"), teammates).join(","));
    Assert.areEqual("", organization.recipientsOf(OrganizationTarget.teammate("gone"), teammates).join(","));
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    const d1 = OrganizationTests.department("d1", null, 0);
    const d2 = OrganizationTests.department("d2", null, 1);

    Assert.areEqual("departments", Assert.throws(() => OrganizationTests.of([d1, d1], []), ArgumentException).parameterName);
    Assert.areEqual("placements", Assert.throws(() => OrganizationTests.of([d1, d2],
      [new TeammatePlacement("t1", OrganizationParent.department("d1"), 0), new TeammatePlacement("t1", OrganizationParent.department("d2"), 0)]),
      ArgumentException).parameterName);
    Assert.areEqual("parent", Assert.throws(() => OrganizationTests.of([OrganizationTests.department("d2", "gone", 0)], []), ArgumentException).parameterName);
    Assert.areEqual("parent", Assert.throws(() => OrganizationTests.of([d1], [new TeammatePlacement("t1", OrganizationParent.department("gone"), 0)]),
      ArgumentException).parameterName);
    Assert.areEqual("parent", Assert.throws(() => OrganizationTests.of([d1], [new TeammatePlacement("t1", OrganizationParent.teammate("nobody"), 0)]),
      ArgumentException).parameterName);
    Assert.isTrue(Assert.throws(() => OrganizationTests.of([OrganizationTests.department("d2", "gone", 0)], []), ArgumentException).message
      .startsWith(Resources.unknownOrganizationParent));
  }

  @TestMethod
  public refusesATreeWithACycle(): void {
    const a = new Department("a", "A", "department", OrganizationParent.teammate("t1"), null, 0, "c", "u");
    const b = new Department("b", "B", "department", OrganizationParent.department("a"), null, 0, "c", "u");
    const cycle = (departments: readonly Department[], placements: readonly TeammatePlacement[]): boolean =>
      Assert.throws(() => OrganizationTests.of(departments, placements), ArgumentException).message.startsWith(Resources.organizationNodeUnderItself);

    Assert.isTrue(cycle([OrganizationTests.department("x", "y", 0), OrganizationTests.department("y", "x", 0)], []));
    Assert.isTrue(cycle([], [new TeammatePlacement("t1", OrganizationParent.teammate("t2"), 0),
      new TeammatePlacement("t2", OrganizationParent.teammate("t1"), 0)]));
    Assert.isTrue(cycle([a, b], [new TeammatePlacement("t1", OrganizationParent.department("b"), 0)]));
    Assert.isTrue(cycle([OrganizationTests.department("z", "x", 0), OrganizationTests.department("x", "y", 1),
      OrganizationTests.department("y", "x", 1)], []));
    Assert.areEqual(OrganizationNodeKind.Teammate,
      OrganizationTests.of([a, b], [new TeammatePlacement("t1", OrganizationParent.person, 0)]).departments[0]?.parent.kind);
  }

  @TestMethod
  public keepsItsNameFolderAndOrder(): void {
    const value = new Organization("o2", "Studio", "/work/studio", 1, "c", "u", nodeTypes, [], []);
    const moved = value.withTree([OrganizationTests.department("d1", null, 0)], [new TeammatePlacement("t1", OrganizationParent.person, 0)]);
    const json = value.toJson();

    Assert.areEqual("o2|Studio|/work/studio|1|c|u", [moved.id, moved.name, moved.folder, moved.order, moved.createdAt, moved.updatedAt].join("|"));
    Assert.areEqual("d1|t1", `${moved.departments[0]?.id ?? ""}|${moved.placements[0]?.teammateId ?? ""}`);
    Assert.isNull(Organization.fromJson({ ...json, folder: null }).folder);
    Assert.areEqual("id", Assert.throws(() => new Organization(" ", "Studio", null, 0, "c", "u", nodeTypes, [], []), ArgumentException).parameterName);
    Assert.areEqual("name", Assert.throws(() => new Organization("o2", "a\nb", null, 0, "c", "u", nodeTypes, [], []), ArgumentException).parameterName);
    Assert.areEqual("folder", Assert.throws(() => new Organization("o2", "Studio", " ", 0, "c", "u", nodeTypes, [], []), ArgumentException).parameterName);
    Assert.areEqual("order", Assert.throws(() => new Organization("o2", "Studio", null, -1, "c", "u", nodeTypes, [], []), ArgumentException).parameterName);
    Assert.areEqual("order", Assert.throws(() => new Organization("o2", "Studio", null, 0.5, "c", "u", nodeTypes, [], []), ArgumentException).parameterName);
    Assert.areEqual("createdAt", Assert.throws(() => new Organization("o2", "Studio", null, 0, "", "u", nodeTypes, [], []), ArgumentException).parameterName);
    Assert.areEqual("updatedAt", Assert.throws(() => new Organization("o2", "Studio", null, 0, "c", "", nodeTypes, [], []), ArgumentException).parameterName);
    Assert.areEqual("$.input.name", Assert.throws(() => Organization.fromJson({ ...json, name: " " }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.folder", Assert.throws(() => Organization.fromJson({ ...json, folder: " " }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.folder", Assert.throws(() => Organization.fromJson({ ...json, folder: 1 }, "$.input"), JsonException).path);
  }

  @TestMethod
  public keepsItsNodeTypesAndFindsEachDepartmentsType(): void {
    const team = new NodeType("team", "Team", "groups", "teal", "c", "u");
    const value = new Organization("o2", "Studio", null, 1, "c", "u", [...nodeTypes, team],
      [new Department("d1", "Design", "team", OrganizationParent.person, null, 0, "c", "u")], []);
    const json = value.toJson();

    Assert.areEqual("department,team", Organization.fromJson(json).nodeTypes.map(t => t.id).join(","));
    Assert.areEqual("department,team", value.withTree([], []).nodeTypes.map(t => t.id).join(","));
    Assert.areEqual("Team", value.typeOf("d1")?.name);
    Assert.isNull(value.typeOf("gone"));
    Assert.areEqual("$.input.nodeTypes", Assert.throws(() => Organization.fromJson({ ...json, nodeTypes: null }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.nodeTypes[1].icon", Assert.throws(() => Organization.fromJson({ ...json, nodeTypes: [...nodeTypes.map(t => t.toJson()),
      { ...team.toJson(), icon: "No" }] }, "$.input"), JsonException).path);
  }

  @TestMethod
  public refusesTwoNodeTypesOfOneIdOrOneNameAndADepartmentOfATypeItLacks(): void {
    const design = new Department("d1", "Design", "team", OrganizationParent.person, null, 0, "c", "u");
    const team = new NodeType("team", "Team", null, null, "c", "u");

    Assert.areEqual("nodeTypes", Assert.throws(() => new Organization("o2", "Studio", null, 0, "c", "u", [team, new NodeType("team", "Squad", null, null, "c", "u")], [], []),
      ArgumentException).parameterName);
    Assert.areEqual("nodeTypes", Assert.throws(() => new Organization("o2", "Studio", null, 0, "c", "u", [team, new NodeType("squad", "TEAM", null, null, "c", "u")], [], []),
      ArgumentException).parameterName);
    Assert.areEqual("departments", Assert.throws(() => new Organization("o2", "Studio", null, 0, "c", "u", nodeTypes, [design], []), ArgumentException).parameterName);
    Assert.areEqual(1, new Organization("o2", "Studio", null, 0, "c", "u", [team], [design], []).departments.length);
  }

  private static of(departments: readonly Department[], placements: readonly TeammatePlacement[]): Organization {
    return new Organization("o1", "My organization", null, 0, "c", "u", nodeTypes, departments, placements);
  }

  private static tree(): Organization {
    return OrganizationTests.of([
      new Department("ops", "Ops", "department", OrganizationParent.person, "boss2", 0, "c", "u"),
      new Department("design", "Design", "department", OrganizationParent.teammate("boss"), "lead", 0, "c", "u"),
      new Department("web", "Web", "department", OrganizationParent.department("design"), null, 0, "c", "u")
    ], [
      new TeammatePlacement("boss", OrganizationParent.person, 0),
      new TeammatePlacement("solo", OrganizationParent.person, 1),
      new TeammatePlacement("aide", OrganizationParent.teammate("boss"), 0),
      new TeammatePlacement("lead", OrganizationParent.department("design"), 1),
      new TeammatePlacement("ann", OrganizationParent.department("design"), 0),
      new TeammatePlacement("kid", OrganizationParent.department("web"), 0),
      new TeammatePlacement("boss2", OrganizationParent.department("ops"), 0)
    ]);
  }

  private static names(nodes: readonly OrganizationParent[]): string {
    return nodes.map(t => `${t.kind}:${t.id ?? ""}`).join(",");
  }

  private static department(id: string, parentId: string | null, order: number, createdAt: string = "c"): Department {
    return new Department(id, id, "department", OrganizationParent.departmentOrPerson(parentId), null, order, createdAt, "u");
  }
}
