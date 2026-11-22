/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Department, Harness, OrganizationNodeKind, OrganizationParent, Teammate, TeammatePlacement } from "@noldova/teamrun.protocol";

import { OrganizationPlaceChoice } from "../../../src/app/models/organization-place-choice";
import { OrganizationNode } from "../../../src/app/models/organization.node";
import { SampleData } from "../../fixtures/sample-data.fixture";

describe("OrganizationPlaceChoice", () => {
  const teammate = (id: string, name: string): Teammate => new Teammate(id, name, null, "a1", Harness.Provider, null, null, "t", "t");
  const team = [teammate("ada", "Ada"), teammate("bea", "Bea"), teammate("cy", "Cy")];
  const root = OrganizationNode.treeOf(SampleData.organizationOf([new Department("design", "Design", "department", OrganizationParent.person, "ada", 0, "c", "u")],
    [new TeammatePlacement("ada", OrganizationParent.department("design"), 0), new TeammatePlacement("bea", OrganizationParent.department("design"), 1),
      new TeammatePlacement("cy", OrganizationParent.teammate("bea"), 0)]), team);

  it("lists you, then every place in the tree in its drawn order, a department's leader after it, but the node moved", () => {
    expect([OrganizationPlaceChoice.of(root, OrganizationParent.teammate("bea")).map(t => [t.key, t.label]),
      OrganizationPlaceChoice.of(root, OrganizationParent.department("design")).map(t => t.label)]).toEqual([
      [["Person:", "You"], ["Department:design", "Design (Department)"], ["Teammate:ada", "Ada"], ["Teammate:cy", "Cy"]],
      ["You", "Ada", "Bea", "Cy"]
    ]);
  });

  it("reads back the id a key names for its kind alone, and none for another kind, a bare kind or anything else", () => {
    expect([OrganizationPlaceChoice.idsOf("Teammate:ada", OrganizationNodeKind.Teammate), OrganizationPlaceChoice.idsOf("Teammate:ada", OrganizationNodeKind.Department),
      OrganizationPlaceChoice.idsOf("Department:", OrganizationNodeKind.Department), OrganizationPlaceChoice.idsOf("Ada", OrganizationNodeKind.Teammate),
      OrganizationPlaceChoice.idsOf(OrganizationPlaceChoice.keyOf(OrganizationParent.department("design")), OrganizationNodeKind.Department)])
      .toEqual([["ada"], [], [], [], ["design"]]);
  });
});
