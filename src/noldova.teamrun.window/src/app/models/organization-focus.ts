/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { OrganizationTarget, OrganizationTargetKind, type Teammate } from "@noldova/teamrun.protocol";

import type { OrganizationNode } from "./organization.node";

export class OrganizationFocus {
  private static readonly separator: string = ":";

  public readonly target: OrganizationTarget;
  public readonly path: readonly OrganizationNode[];
  public readonly teammate: Teammate | null;

  private constructor(target: OrganizationTarget, path: readonly OrganizationNode[], teammate: Teammate | null) {
    this.target = target;
    this.path = path;
    this.teammate = teammate;
  }

  public get department(): OrganizationNode | null {
    return this.path.at(-1) ?? null;
  }

  public static keyOf(target: OrganizationTarget): string {
    return Object.isNull(target.id) ? target.kind : `${target.kind}${OrganizationFocus.separator}${target.id}`;
  }

  public static resolve(tree: readonly OrganizationNode[], key: string | null): OrganizationFocus {
    const at = key?.indexOf(OrganizationFocus.separator) ?? -1;
    const kind = Object.isNull(key) || at < 0 ? null : key.slice(0, at);
    const id = Object.isNull(key) || at < 0 ? String.empty : key.slice(at + 1);
    if (kind === OrganizationTargetKind.Department) {
      const path = OrganizationFocus.pathTo(tree, t => t.department.id === id);
      if (path.length > 0)
        return new OrganizationFocus(OrganizationTarget.department(id), path, null);
    }
    if (kind === OrganizationTargetKind.Teammate) {
      const path = OrganizationFocus.pathTo(tree, t => t.leader?.id === id || t.members.some(member => member.id === id));
      const node = path.at(-1);
      const teammate = Object.isUndefined(node) ? undefined : [...Object.isNull(node.leader) ? [] : [node.leader], ...node.members].find(t => t.id === id);
      if (!Object.isUndefined(teammate))
        return new OrganizationFocus(OrganizationTarget.teammate(id), path, teammate);
    }
    return new OrganizationFocus(OrganizationTarget.leaders, [], null);
  }

  private static pathTo(nodes: readonly OrganizationNode[], matches: (node: OrganizationNode) => boolean): readonly OrganizationNode[] {
    for (const node of nodes) {
      if (matches(node))
        return [node];
      const below = OrganizationFocus.pathTo(node.children, matches);
      if (below.length > 0)
        return [node, ...below];
    }
    return [];
  }
}
