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

  public constructor(id: string, label: string, icon: string | null = null, children: readonly TreeNode[] = []) {
    this.id = id;
    this.label = label;
    this.icon = icon;
    this.children = children;
  }

  public get isBranch(): boolean {
    return this.children.length > 0;
  }
}
