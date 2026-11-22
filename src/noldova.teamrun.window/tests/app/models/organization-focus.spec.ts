/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Department, Harness, OrganizationParent, OrganizationTarget, Teammate, TeammatePlacement } from "@noldova/teamrun.protocol";

import { OrganizationTargetKey } from "../../../src/app/models/organization-target-key";
import { OrganizationFocus } from "../../../src/app/models/organization-focus";
import { OrganizationNode } from "../../../src/app/models/organization.node";
import { SampleData } from "../../fixtures/sample-data.fixture";

describe("OrganizationFocus", () => {
  const teammate = (id: string, name: string): Teammate => new Teammate(id, name, null, "a1", Harness.Provider, null, null, "t", "t");
  const [ada, cy] = [teammate("ada", "Ada"), teammate("cy", "Cy")];
  const tree = OrganizationNode.treeOf(SampleData.organizationOf([new Department("design", "Design", "department", OrganizationParent.person, "ada", 0, "c", "u"),
    new Department("build", "Build", "department", OrganizationParent.person, null, 1, "c", "u")],
    [new TeammatePlacement("ada", OrganizationParent.department("design"), 0),
      new TeammatePlacement("cy", OrganizationParent.department("build"), 0)]), [ada, cy]);
  const shape = (focus: OrganizationFocus): unknown[] =>
    [OrganizationTargetKey.of(focus.target), focus.path.map(t => t.id), focus.teammate?.id ?? null, focus.departmentName];

  it("focuses a member of a department with no leader, with that department's name", () => {
    expect(shape(OrganizationFocus.resolve(tree.subDepartments, [], "Teammate:cy"))).toEqual(["Teammate:cy", ["build"], "cy", "Build"]);
  });

  it("opens on the leaders, with no department name, for a teammate it doesn't know", () => {
    expect(shape(OrganizationFocus.resolve(tree.subDepartments, [], "Teammate:nobody"))).toEqual([OrganizationTargetKey.of(OrganizationTarget.leaders), [], null, ""]);
  });

  it("focuses a direct report in no department under Organization alone, saying it reports to you, and opens on the leaders for the old No department", () => {
    const eve = teammate("eve", "Eve");
    const organization = SampleData.organizationOf([new Department("design", "Design", "department", OrganizationParent.person, "ada", 0, "c", "u")],
      [new TeammatePlacement("ada", OrganizationParent.department("design"), 0), new TeammatePlacement("eve", OrganizationParent.person, 0)]);
    const placed = OrganizationNode.treeOf(organization, [ada, eve]);
    const reports = placed.directReports;

    expect([shape(OrganizationFocus.resolve(placed.subDepartments, reports, "Teammate:eve")), shape(OrganizationFocus.resolve(placed.subDepartments, reports, "Department:no-department"))]).toEqual([
      ["Teammate:eve", [], "eve", "Reports to you"], [OrganizationTargetKey.of(OrganizationTarget.leaders), [], null, ""]
    ]);
  });
});
