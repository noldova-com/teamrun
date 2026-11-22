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
    nodes.map(t => [t.id, t.leader?.id ?? null, t.members.map(u => u.id), t.headcount, t.total, t.hidden, shape(t.children)]);

  it("nests departments in their order, each with its leader apart from its members in name order, and counts what collapsing it hides, its nested departments' people too", () => {
    const organization = SampleData.organizationOf([
      new Department("design", "Design", OrganizationParent.person, "dee", 1, "c", "u"),
      new Department("build", "Build", OrganizationParent.person, null, 0, "c", "u"),
      new Department("ui", "UI", OrganizationParent.department("design"), "bea", 0, "c", "u")
    ], [new TeammatePlacement("dee", OrganizationParent.department("design"), 0), new TeammatePlacement("cy", OrganizationParent.department("design"), 1),
      new TeammatePlacement("ada", OrganizationParent.department("design"), 2), new TeammatePlacement("bea", OrganizationParent.department("ui"), 0)]);

    expect(shape(OrganizationNode.treeOf(organization, [ada, bea, cy, dee])))
      .toEqual([["build", null, [], 0, 0, 0, []], ["design", "dee", ["ada", "cy"], 3, 4, 3, [["ui", "bea", [], 1, 1, 0, []]]]]);
  });

  it("counts a nested department's leader and members once each in what collapsing its parent hides", () => {
    const organization = SampleData.organizationOf([new Department("design", "Design", OrganizationParent.person, "ada", 0, "c", "u"),
      new Department("ui", "UI", OrganizationParent.department("design"), "bea", 0, "c", "u")],
      [new TeammatePlacement("ada", OrganizationParent.department("design"), 0), new TeammatePlacement("cy", OrganizationParent.department("design"), 1),
        new TeammatePlacement("bea", OrganizationParent.department("ui"), 0), new TeammatePlacement("dee", OrganizationParent.department("ui"), 1),
        new TeammatePlacement("eve", OrganizationParent.department("ui"), 2)]);

    expect(shape(OrganizationNode.treeOf(organization, [ada, bea, cy, dee, eve])))
      .toEqual([["design", "ada", ["cy"], 2, 5, 4, [["ui", "bea", ["dee", "eve"], 3, 3, 2, []]]]]);
  });

  it("counts the people of departments nested two levels down in what collapsing the top one hides", () => {
    const organization = SampleData.organizationOf([new Department("design", "Design", OrganizationParent.person, "ada", 0, "c", "u"),
      new Department("ui", "UI", OrganizationParent.department("design"), "bea", 0, "c", "u"),
      new Department("icons", "Icons", OrganizationParent.department("ui"), "dee", 0, "c", "u")],
        [new TeammatePlacement("ada", OrganizationParent.department("design"), 0), new TeammatePlacement("bea", OrganizationParent.department("ui"), 0),
      new TeammatePlacement("cy", OrganizationParent.department("ui"), 1), new TeammatePlacement("dee", OrganizationParent.department("icons"), 0),
        new TeammatePlacement("eve", OrganizationParent.department("icons"), 1), new TeammatePlacement("fay", OrganizationParent.department("icons"), 2)]);

    expect(shape(OrganizationNode.treeOf(organization, [ada, bea, cy, dee, eve, fay])))
      .toEqual([["design", "ada", [], 1, 6, 5, [["ui", "bea", ["cy"], 2, 5, 4, [["icons", "dee", ["eve", "fay"], 3, 3, 2, []]]]]]]);
  });

  it("leaves out a leader or member whose teammate it doesn't know", () => {
    const organization = SampleData.organizationOf([new Department("design", "Design", OrganizationParent.person, "gone", 0, "c", "u")],
      [new TeammatePlacement("gone", OrganizationParent.department("design"), 0), new TeammatePlacement("lost", OrganizationParent.department("design"), 1),
        new TeammatePlacement("ada", OrganizationParent.department("design"), 2)]);

    expect(shape(OrganizationNode.treeOf(organization, [ada]))).toEqual([["design", null, ["ada"], 1, 1, 1, []]]);
  });

  it("leaves the teammates placed outside every department out of the tree, listing them apart as the person's direct reports in name order", () => {
    const departments = [new Department("design", "Design", OrganizationParent.person, "ada", 0, "c", "u"),
      new Department("ui", "UI", OrganizationParent.department("design"), null, 0, "c", "u")];
    const inDepartments = [new TeammatePlacement("ada", OrganizationParent.department("design"), 0), new TeammatePlacement("bea", OrganizationParent.department("ui"), 0)];
    const organization = SampleData.organizationOf(departments, [...inDepartments, new TeammatePlacement("cy", OrganizationParent.person, 0),
      new TeammatePlacement("fay", OrganizationParent.person, 1), new TeammatePlacement("dee", OrganizationParent.teammate("ada"), 0)]);
    const teammates = [fay, ada, dee, bea, cy];

    expect([shape(OrganizationNode.treeOf(organization, teammates)), OrganizationNode.directReportsOf(organization, teammates).map(t => t.id)]).toEqual([
      [["design", "ada", [], 1, 2, 1, [["ui", null, ["bea"], 1, 1, 1, []]]]], ["cy", "fay"]
    ]);
    expect(OrganizationNode.directReportsOf(SampleData.organizationOf(departments, inDepartments), [ada, bea])).toEqual([]);
  });

  it("leaves out every teammate the organization doesn't hold, so a new teammate shows nowhere until it is placed", () => {
    const organization = SampleData.organizationOf([new Department("design", "Design", OrganizationParent.person, "ada", 0, "c", "u")],
      [new TeammatePlacement("ada", OrganizationParent.department("design"), 0)]);

    expect([shape(OrganizationNode.treeOf(organization, [ada, bea, cy])), OrganizationNode.directReportsOf(organization, [ada, bea, cy])])
      .toEqual([[["design", "ada", [], 1, 1, 0, []]], []]);
    expect([OrganizationNode.treeOf(SampleData.organizationOf([], []), [bea, ada]), OrganizationNode.directReportsOf(SampleData.organizationOf([], []), [bea, ada])])
      .toEqual([[], []]);
  });
});
