/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TreeNode {
  public readonly id: string;
  public readonly label: string;
  public readonly icon: string | null;
  public readonly children: readonly TreeNode[];
  public readonly startsOpen: boolean;

  public constructor(id: string, label: string, icon: string | null = null, children: readonly TreeNode[] = [], startsOpen: boolean = false) {
    this.id = id;
    this.label = label;
    this.icon = icon;
    this.children = children;
    this.startsOpen = startsOpen;
  }

  public static open(id: string, label: string, icon: string | null, children: readonly TreeNode[]): TreeNode {
    return new TreeNode(id, label, icon, children, true);
  }

  public get isBranch(): boolean {
    return this.children.length > 0;
  }

  public get startOpenBranches(): readonly TreeNode[] {
    return [...this.startsOpen && this.isBranch ? [this] : [], ...this.children.flatMap(t => t.startOpenBranches)];
  }
}
