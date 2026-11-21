/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Department, DepartmentMember, Harness, Organization, OrganizationTarget, Teammate } from "@noldova/teamrun.protocol";

import { OrganizationConversation } from "../../../src/app/models/organization-conversation";
import { OrganizationFocus } from "../../../src/app/models/organization-focus";
import { OrganizationNode } from "../../../src/app/models/organization.node";

describe("OrganizationFocus", () => {
  const teammate = (id: string, name: string): Teammate => new Teammate(id, name, null, "a1", Harness.Provider, null, null, "t", "t");
  const [ada, cy] = [teammate("ada", "Ada"), teammate("cy", "Cy")];
  const tree = OrganizationNode.treeOf(new Organization([new Department("design", "Design", null, "ada", 0, "c", "u"), new Department("build", "Build", null, null, 1, "c", "u")],
    [new DepartmentMember("ada", "design"), new DepartmentMember("cy", "build")]), [ada, cy]);
  const shape = (focus: OrganizationFocus): unknown[] =>
    [OrganizationConversation.keyOf(focus.target), focus.path.map(t => t.department.id), focus.teammate?.id ?? null, focus.departmentName];

  it("focuses a member of a department with no leader, with that department's name", () => {
    expect(shape(OrganizationFocus.resolve(tree, "Teammate:cy"))).toEqual(["Teammate:cy", ["build"], "cy", "Build"]);
  });

  it("opens on the leaders, with no department name, for a teammate in no department", () => {
    expect(shape(OrganizationFocus.resolve(tree, "Teammate:nobody"))).toEqual([OrganizationConversation.keyOf(OrganizationTarget.leaders), [], null, ""]);
  });
});
