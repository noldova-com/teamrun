/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Department, Harness, Organization, OrganizationParent, OrganizationTarget, Teammate, TeammatePlacement } from "@noldova/teamrun.protocol";

import { OrganizationConversation } from "../../../src/app/models/organization-conversation";
import { OrganizationFocus } from "../../../src/app/models/organization-focus";
import { OrganizationNode } from "../../../src/app/models/organization.node";

describe("OrganizationFocus", () => {
  const teammate = (id: string, name: string): Teammate => new Teammate(id, name, null, "a1", Harness.Provider, null, null, "t", "t");
  const [ada, cy] = [teammate("ada", "Ada"), teammate("cy", "Cy")];
  const tree = OrganizationNode.treeOf(new Organization([new Department("design", "Design", OrganizationParent.person, "ada", 0, "c", "u"),
    new Department("build", "Build", OrganizationParent.person, null, 1, "c", "u")],
    [new TeammatePlacement("ada", OrganizationParent.department("design"), 0),
      new TeammatePlacement("cy", OrganizationParent.department("build"), 0)]), [ada, cy]);
  const shape = (focus: OrganizationFocus): unknown[] =>
    [OrganizationConversation.keyOf(focus.target), focus.path.map(t => t.id), focus.teammate?.id ?? null, focus.departmentName];

  it("focuses a member of a department with no leader, with that department's name", () => {
    expect(shape(OrganizationFocus.resolve(tree, [], "Teammate:cy"))).toEqual(["Teammate:cy", ["build"], "cy", "Build"]);
  });

  it("opens on the leaders, with no department name, for a teammate it doesn't know", () => {
    expect(shape(OrganizationFocus.resolve(tree, [], "Teammate:nobody"))).toEqual([OrganizationConversation.keyOf(OrganizationTarget.leaders), [], null, ""]);
  });

  it("focuses a direct report in no department under Organization alone, saying it reports to you, and opens on the leaders for the old No department", () => {
    const eve = teammate("eve", "Eve");
    const organization = new Organization([new Department("design", "Design", OrganizationParent.person, "ada", 0, "c", "u")],
      [new TeammatePlacement("ada", OrganizationParent.department("design"), 0), new TeammatePlacement("eve", OrganizationParent.person, 0)]);
    const placed = OrganizationNode.treeOf(organization, [ada, eve]);
    const reports = OrganizationNode.directReportsOf(organization, [ada, eve]);

    expect([shape(OrganizationFocus.resolve(placed, reports, "Teammate:eve")), shape(OrganizationFocus.resolve(placed, reports, "Department:no-department"))]).toEqual([
      ["Teammate:eve", [], "eve", "Reports to you"], [OrganizationConversation.keyOf(OrganizationTarget.leaders), [], null, ""]
    ]);
  });
});
