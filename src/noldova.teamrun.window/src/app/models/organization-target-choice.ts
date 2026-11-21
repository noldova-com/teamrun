/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { OrganizationTarget } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { OrganizationTargetKey } from "./organization-target-key";
import type { OrganizationNode } from "./organization.node";

export class OrganizationTargetChoice {
  public readonly key: string;
  public readonly target: OrganizationTarget;
  public readonly label: string;

  public constructor(target: OrganizationTarget, label: string) {
    this.key = OrganizationTargetKey.of(target);
    this.target = target;
    this.label = label;
  }

  public static of(tree: readonly OrganizationNode[]): readonly OrganizationTargetChoice[] {
    return [
      new OrganizationTargetChoice(OrganizationTarget.leaders, Resources.organizationLeadersTitle),
      new OrganizationTargetChoice(OrganizationTarget.everyone, Resources.organizationEveryoneTitle),
      ...tree.flatMap(t => OrganizationTargetChoice.under(t))
    ];
  }

  private static under(node: OrganizationNode): readonly OrganizationTargetChoice[] {
    const department = node.department;
    return [
      ...(Object.isNull(department) ? []
        : [new OrganizationTargetChoice(OrganizationTarget.department(department.id), Resources.formatOrganizationDepartmentOption(department.name))]),
      ...(Object.isNull(node.leader) ? []
        : [new OrganizationTargetChoice(OrganizationTarget.teammate(node.leader.id), Resources.formatOrganizationLeaderOption(node.leader.name, node.name))]),
      ...node.members.map(t => new OrganizationTargetChoice(OrganizationTarget.teammate(t.id), t.name)),
      ...node.children.flatMap(t => OrganizationTargetChoice.under(t))
    ];
  }
}
