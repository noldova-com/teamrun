/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Department, DepartmentMember, Harness, Organization, Teammate } from "@noldova/teamrun.protocol";

import { OrganizationNode } from "../../../src/app/models/organization.node";
import { Resources } from "../../../src/resources";

describe("OrganizationNode", () => {
  const teammate = (id: string, name: string): Teammate => new Teammate(id, name, null, "a1", Harness.Provider, null, null, "t", "t");
  const [ada, bea, cy, dee, eve, fay] = [teammate("ada", "Ada"), teammate("bea", "Bea"), teammate("cy", "Cy"), teammate("dee", "Dee"), teammate("eve", "Eve"),
    teammate("fay", "Fay")];
  const shape = (nodes: readonly OrganizationNode[]): unknown[] =>
    nodes.map(t => [t.id, t.leader?.id ?? null, t.members.map(u => u.id), t.headcount, t.total, t.hidden, shape(t.children)]);

  it("nests departments in their order, each with its leader apart from its members in name order, and counts what collapsing it hides, its nested departments' people too", () => {
    const organization = new Organization([
      new Department("design", "Design", null, "dee", 1, "c", "u"),
      new Department("build", "Build", null, null, 0, "c", "u"),
      new Department("ui", "UI", "design", "bea", 0, "c", "u")
    ], [new DepartmentMember("dee", "design"), new DepartmentMember("cy", "design"), new DepartmentMember("ada", "design"), new DepartmentMember("bea", "ui")]);

    expect(shape(OrganizationNode.treeOf(organization, [ada, bea, cy, dee])))
      .toEqual([["build", null, [], 0, 0, 0, []], ["design", "dee", ["ada", "cy"], 3, 4, 3, [["ui", "bea", [], 1, 1, 0, []]]]]);
  });

  it("counts a nested department's leader and members once each in what collapsing its parent hides", () => {
    const organization = new Organization([new Department("design", "Design", null, "ada", 0, "c", "u"), new Department("ui", "UI", "design", "bea", 0, "c", "u")],
      [new DepartmentMember("ada", "design"), new DepartmentMember("cy", "design"), new DepartmentMember("bea", "ui"), new DepartmentMember("dee", "ui"),
        new DepartmentMember("eve", "ui")]);

    expect(shape(OrganizationNode.treeOf(organization, [ada, bea, cy, dee, eve])))
      .toEqual([["design", "ada", ["cy"], 2, 5, 4, [["ui", "bea", ["dee", "eve"], 3, 3, 2, []]]]]);
  });

  it("counts the people of departments nested two levels down in what collapsing the top one hides", () => {
    const organization = new Organization([new Department("design", "Design", null, "ada", 0, "c", "u"), new Department("ui", "UI", "design", "bea", 0, "c", "u"),
      new Department("icons", "Icons", "ui", "dee", 0, "c", "u")], [new DepartmentMember("ada", "design"), new DepartmentMember("bea", "ui"),
      new DepartmentMember("cy", "ui"), new DepartmentMember("dee", "icons"), new DepartmentMember("eve", "icons"), new DepartmentMember("fay", "icons")]);

    expect(shape(OrganizationNode.treeOf(organization, [ada, bea, cy, dee, eve, fay])))
      .toEqual([["design", "ada", [], 1, 6, 5, [["ui", "bea", ["cy"], 2, 5, 4, [["icons", "dee", ["eve", "fay"], 3, 3, 2, []]]]]]]);
  });

  it("leaves out a leader or member whose teammate it doesn't know", () => {
    const organization = new Organization([new Department("design", "Design", null, "gone", 0, "c", "u")],
      [new DepartmentMember("gone", "design"), new DepartmentMember("lost", "design"), new DepartmentMember("ada", "design")]);

    expect(shape(OrganizationNode.treeOf(organization, [ada]))).toEqual([["design", null, ["ada"], 1, 1, 1, []]]);
  });

  it("puts the teammates in no department last, under No department in name order, and leaves it out once every teammate is placed", () => {
    const organization = new Organization([new Department("design", "Design", null, "ada", 0, "c", "u"), new Department("ui", "UI", "design", null, 0, "c", "u")],
      [new DepartmentMember("ada", "design"), new DepartmentMember("bea", "ui")]);
    const tree = OrganizationNode.treeOf(organization, [fay, ada, dee, bea, cy]);

    expect([shape(tree), tree.map(t => [t.name, t.isUnplaced, t.department?.id ?? null])]).toEqual([
      [["design", "ada", [], 1, 2, 1, [["ui", null, ["bea"], 1, 1, 1, []]]], ["no-department", null, ["cy", "dee", "fay"], 3, 3, 3, []]],
      [["Design", false, "design"], [Resources.organizationNoDepartment, true, null]]
    ]);
    expect(shape(OrganizationNode.treeOf(organization, [ada, bea]))).toEqual([["design", "ada", [], 1, 2, 1, [["ui", null, ["bea"], 1, 1, 1, []]]]]);
    expect(shape(OrganizationNode.treeOf(Organization.empty, [bea, ada]))).toEqual([["no-department", null, ["ada", "bea"], 2, 2, 2, []]]);
  });
});
