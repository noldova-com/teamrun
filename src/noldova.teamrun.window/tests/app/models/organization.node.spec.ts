/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Department, Harness, OrganizationParent, Teammate, TeammatePlacement } from "@noldova/teamrun.protocol";

import { OrganizationNode } from "../../../src/app/models/organization.node";
import { SampleData } from "../../fixtures/sample-data.fixture";

describe("OrganizationNode", () => {
  const teammate = (id: string, name: string): Teammate => new Teammate(id, name, null, "a1", Harness.Provider, null, null, "t", "t");
  const [ada, bea, cy, dee, eve, fay] = [teammate("ada", "Ada"), teammate("bea", "Bea"), teammate("cy", "Cy"), teammate("dee", "Dee"), teammate("eve", "Eve"),
    teammate("fay", "Fay")];
  const shape = (nodes: readonly OrganizationNode[]): unknown[] =>
    nodes.map(t => [t.id, t.leader?.id ?? null, t.members.map(u => u.id), t.headcount, t.total, t.hidden, shape(t.departments)]);

  it("nests departments in their order, each with its leader apart from its members in name order, and counts what collapsing it hides, its nested departments' people too", () => {
    const organization = SampleData.organizationOf([
      new Department("design", "Design", "department", OrganizationParent.person, "dee", 1, "c", "u"),
      new Department("build", "Build", "department", OrganizationParent.person, null, 0, "c", "u"),
      new Department("ui", "UI", "department", OrganizationParent.department("design"), "bea", 0, "c", "u")
    ], [new TeammatePlacement("dee", OrganizationParent.department("design"), 0), new TeammatePlacement("cy", OrganizationParent.department("design"), 1),
      new TeammatePlacement("ada", OrganizationParent.department("design"), 2), new TeammatePlacement("bea", OrganizationParent.department("ui"), 0)]);

    expect(shape(OrganizationNode.treeOf(organization, [ada, bea, cy, dee]).departments))
      .toEqual([["build", null, [], 0, 0, 0, []], ["design", "dee", ["ada", "cy"], 3, 4, 3, [["ui", "bea", [], 1, 1, 0, []]]]]);
  });

  it("counts a nested department's leader and members once each in what collapsing its parent hides", () => {
    const organization = SampleData.organizationOf([new Department("design", "Design", "department", OrganizationParent.person, "ada", 0, "c", "u"),
      new Department("ui", "UI", "department", OrganizationParent.department("design"), "bea", 0, "c", "u")],
      [new TeammatePlacement("ada", OrganizationParent.department("design"), 0), new TeammatePlacement("cy", OrganizationParent.department("design"), 1),
        new TeammatePlacement("bea", OrganizationParent.department("ui"), 0), new TeammatePlacement("dee", OrganizationParent.department("ui"), 1),
        new TeammatePlacement("eve", OrganizationParent.department("ui"), 2)]);

    expect(shape(OrganizationNode.treeOf(organization, [ada, bea, cy, dee, eve]).departments))
      .toEqual([["design", "ada", ["cy"], 2, 5, 4, [["ui", "bea", ["dee", "eve"], 3, 3, 2, []]]]]);
  });

  it("counts the people of departments nested two levels down in what collapsing the top one hides", () => {
    const organization = SampleData.organizationOf([new Department("design", "Design", "department", OrganizationParent.person, "ada", 0, "c", "u"),
      new Department("ui", "UI", "department", OrganizationParent.department("design"), "bea", 0, "c", "u"),
      new Department("icons", "Icons", "department", OrganizationParent.department("ui"), "dee", 0, "c", "u")],
        [new TeammatePlacement("ada", OrganizationParent.department("design"), 0), new TeammatePlacement("bea", OrganizationParent.department("ui"), 0),
      new TeammatePlacement("cy", OrganizationParent.department("ui"), 1), new TeammatePlacement("dee", OrganizationParent.department("icons"), 0),
        new TeammatePlacement("eve", OrganizationParent.department("icons"), 1), new TeammatePlacement("fay", OrganizationParent.department("icons"), 2)]);

    expect(shape(OrganizationNode.treeOf(organization, [ada, bea, cy, dee, eve, fay]).departments))
      .toEqual([["design", "ada", [], 1, 6, 5, [["ui", "bea", ["cy"], 2, 5, 4, [["icons", "dee", ["eve", "fay"], 3, 3, 2, []]]]]]]);
  });

  it("leaves out a leader or member whose teammate it doesn't know", () => {
    const organization = SampleData.organizationOf([new Department("design", "Design", "department", OrganizationParent.person, "gone", 0, "c", "u")],
      [new TeammatePlacement("gone", OrganizationParent.department("design"), 0), new TeammatePlacement("lost", OrganizationParent.department("design"), 1),
        new TeammatePlacement("ada", OrganizationParent.department("design"), 2)]);

    expect(shape(OrganizationNode.treeOf(organization, [ada]).departments)).toEqual([["design", null, ["ada"], 1, 1, 1, []]]);
  });

  it("puts the placed teammates in no department under the person as its direct reports in name order, a teammate's own reports under it, and leaves a teammate outside the organization out", () => {
    const organization = SampleData.organizationOf([new Department("design", "Design", "department", OrganizationParent.person, "ada", 0, "c", "u"), new Department("ui", "UI", "department", OrganizationParent.department("design"), null, 0, "c", "u")],
      [new TeammatePlacement("ada", OrganizationParent.department("design"), 1), new TeammatePlacement("bea", OrganizationParent.department("ui"), 0),
        new TeammatePlacement("fay", OrganizationParent.person, 0), new TeammatePlacement("cy", OrganizationParent.teammate("fay"), 0)]);
    const root = OrganizationNode.treeOf(organization, [fay, ada, dee, bea, cy]);

    expect([shape(root.departments), root.directReports.map(t => t.id), root.members.map(t => t.id), root.reports.map(t => t.directReports.map(u => u.id))]).toEqual([
      [["design", "ada", [], 1, 2, 1, [["ui", null, ["bea"], 1, 1, 1, []]]]], ["fay"], ["cy", "fay"], [["cy"]]
    ]);
    expect(OrganizationNode.treeOf(organization, [ada, bea]).directReports).toEqual([]);
    expect([shape(OrganizationNode.treeOf(SampleData.organizationOf([], []), [bea, ada]).departments), OrganizationNode.treeOf(SampleData.organizationOf([], []), [bea, ada]).directReports.map(t => t.id)])
      .toEqual([[], []]);
  });

  it("nests teammates under the teammate they report to, and departments under a teammate, counting both in the person's total", () => {
    const organization = SampleData.organizationOf([new Department("ui", "UI", "department", OrganizationParent.teammate("bea"), "cy", 0, "c", "u")],
      [new TeammatePlacement("ada", OrganizationParent.person, 0), new TeammatePlacement("bea", OrganizationParent.teammate("ada"), 0),
        new TeammatePlacement("dee", OrganizationParent.teammate("ada"), 1), new TeammatePlacement("cy", OrganizationParent.department("ui"), 0),
        new TeammatePlacement("eve", OrganizationParent.department("ui"), 1)]);
    const root = OrganizationNode.treeOf(organization, [ada, bea, cy, dee, eve]);
    const [adaNode] = root.reports;

    expect([root.directReports.map(t => t.id), adaNode?.directReports.map(t => t.id), adaNode?.members.map(t => t.id), root.subDepartments.map(t => t.id),
      shape(root.subDepartments), root.total, root.name, root.id]).toEqual([["ada"], ["bea", "dee"], ["bea", "dee"], ["ui"],
      [["ui", "cy", ["eve"], 2, 2, 1, []]], 5, "You", "person"]);
  });

  it("carries each department's type, none for a type the organization doesn't have, and none for the person", () => {
    const organization = SampleData.organizationOf([new Department("design", "Design", "department", OrganizationParent.person, null, 0, "c", "u"),
      new Department("build", "Build", "gone", OrganizationParent.person, null, 1, "c", "u")], []);
    const root = OrganizationNode.treeOf(organization, []);

    expect([root.type, ...root.departments.map(t => t.type?.name ?? null)]).toEqual([null, "Department", null]);
  });

  it("lifts the reports of a teammate it doesn't know to that teammate's place", () => {
    const organization = SampleData.organizationOf([], [new TeammatePlacement("gone", OrganizationParent.person, 0), new TeammatePlacement("ada", OrganizationParent.teammate("gone"), 0)]);

    expect(OrganizationNode.treeOf(organization, [ada]).directReports.map(t => t.id)).toEqual(["ada"]);
  });

  it("lays a node's reports in at least four columns, or fewer when it has fewer, and the square root's columns past sixteen", () => {
    const placed = (count: number): OrganizationNode => {
      const ids = Array.from({ length: count }, (_, i) => `t${String(i).padStart(2, "0")}`);
      return OrganizationNode.treeOf(SampleData.organizationOf([], ids.map((t, i) => new TeammatePlacement(t, OrganizationParent.person, i))),
        ids.map(t => teammate(t, t.toUpperCase())));
    };

    expect([1, 3, 4, 9, 16, 17, 25, 26].map(t => placed(t).columns)).toEqual([1, 3, 4, 4, 4, 5, 5, 6]);
  });
});
