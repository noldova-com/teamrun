/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Department, DepartmentMember, Harness, Organization, Teammate } from "@noldova/teamrun.protocol";

import { OrganizationNode } from "../../../src/app/models/organization-node";

describe("OrganizationNode", () => {
  const teammate = (id: string, name: string): Teammate => new Teammate(id, name, null, "a1", Harness.Provider, null, null, "t", "t");
  const [ada, bea, cy, dee] = [teammate("ada", "Ada"), teammate("bea", "Bea"), teammate("cy", "Cy"), teammate("dee", "Dee")];
  const shape = (nodes: readonly OrganizationNode[]): unknown[] =>
    nodes.map(t => [t.department.id, t.leader?.id ?? null, t.members.map(u => u.id), t.headcount, shape(t.children)]);

  it("nests departments in their order, each with its leader apart from its members in name order", () => {
    const organization = new Organization([
      new Department("design", "Design", null, "dee", 1, "c", "u"),
      new Department("build", "Build", null, null, 0, "c", "u"),
      new Department("ui", "UI", "design", "bea", 0, "c", "u")
    ], [new DepartmentMember("dee", "design"), new DepartmentMember("cy", "design"), new DepartmentMember("ada", "design"), new DepartmentMember("bea", "ui")]);

    expect(shape(OrganizationNode.treeOf(organization, [ada, bea, cy, dee])))
      .toEqual([["build", null, [], 0, []], ["design", "dee", ["ada", "cy"], 3, [["ui", "bea", [], 1, []]]]]);
  });

  it("leaves out a leader or member whose teammate it doesn't know", () => {
    const organization = new Organization([new Department("design", "Design", null, "gone", 0, "c", "u")],
      [new DepartmentMember("gone", "design"), new DepartmentMember("lost", "design"), new DepartmentMember("ada", "design")]);

    expect(shape(OrganizationNode.treeOf(organization, [ada]))).toEqual([["design", null, ["ada"], 1, []]]);
  });
});
