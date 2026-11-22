/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { OrganizationNodeKind, OrganizationParent } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import type { OrganizationNode } from "./organization.node";

export class OrganizationPlaceChoice {
  public readonly key: string;
  public readonly parent: OrganizationParent;
  public readonly label: string;

  public constructor(parent: OrganizationParent, label: string) {
    this.key = OrganizationPlaceChoice.keyOf(parent);
    this.parent = parent;
    this.label = label;
  }

  public static keyOf(parent: OrganizationParent): string {
    return `${parent.kind}:${parent.id ?? String.empty}`;
  }

  public static idsOf(key: string, kind: OrganizationNodeKind): readonly string[] {
    const prefix = `${kind}:`;
    return key.startsWith(prefix) && key.length > prefix.length ? [key.slice(prefix.length)] : [];
  }

  public static of(root: OrganizationNode, node: OrganizationParent): readonly OrganizationPlaceChoice[] {
    return [new OrganizationPlaceChoice(OrganizationParent.person, Resources.organizationOwnerName), ...OrganizationPlaceChoice.under(root)]
      .filter(t => !t.parent.equals(node));
  }

  private static under(node: OrganizationNode): readonly OrganizationPlaceChoice[] {
    return node.children.flatMap(t => [
      new OrganizationPlaceChoice(t.key, t.key.kind === OrganizationNodeKind.Department ? Resources.formatOrganizationDepartmentOption(t.name) : t.name),
      ...(Object.isNull(t.leader) ? [] : [new OrganizationPlaceChoice(OrganizationParent.teammate(t.leader.id), t.leader.name)]),
      ...OrganizationPlaceChoice.under(t)
    ]);
  }
}
