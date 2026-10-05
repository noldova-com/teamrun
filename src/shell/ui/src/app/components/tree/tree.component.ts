/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CdkTree, CdkTreeNode, CdkTreeNodeDef } from "@angular/cdk/tree";
import { ChangeDetectionStrategy, Component, type Signal, type WritableSignal, afterRenderEffect, computed, input, output, signal, viewChild, viewChildren } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { TreeNode } from "../../models/tree-node";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-tree",
  imports: [CdkTree, CdkTreeNode, CdkTreeNodeDef],
  templateUrl: "./tree.component.html",
  styleUrl: "./tree.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreeComponent {
  private readonly tree: Signal<CdkTree<TreeNode, string>> = viewChild.required<CdkTree<TreeNode, string>>(CdkTree);
  private readonly rows: Signal<readonly CdkTreeNode<TreeNode, string>[]> = viewChildren<CdkTreeNode<TreeNode, string>>(CdkTreeNode);

  private readonly opened: Set<string> = new Set();
  private readonly stopId: WritableSignal<string | null> = signal(null);

  public readonly nodes = input.required<readonly TreeNode[]>();
  public readonly label = input.required<string>();
  public readonly current = input<string | null>(null);
  public readonly activated = output<TreeNode>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly data: Signal<TreeNode[]> = computed(() => [...this.nodes()]);
  protected readonly hasBranches: Signal<boolean> = computed(() => this.nodes().some(t => t.isBranch));
  protected readonly childrenOf = (node: TreeNode): TreeNode[] => [...node.children];
  protected readonly keyOf = (node: TreeNode): string => node.id;
  protected readonly trackBy = (_: number, node: TreeNode): string => node.id;

  public constructor() {
    afterRenderEffect(() => {
      for (const branch of this.nodes().flatMap(t => t.startOpenBranches).filter(t => !this.opened.has(t.id))) {
        this.opened.add(branch.id);
        this.tree().expand(branch);
      }
    });
    afterRenderEffect(() => {
      const stop = this.rowOf(this.stopId()) ?? this.rowOf(this.current()) ?? this.rows()[0];
      for (const row of this.rows())
        if (row === stop)
          row.makeFocusable();
        else
          row.unfocus();
    });
  }

  public focus(): void {
    (this.rowOf(this.current()) ?? this.rows()[0])?.focus();
  }

  protected take(row: CdkTreeNode<TreeNode, string>): void {
    this.stopId.set(row.data.id);
  }

  protected choose(node: TreeNode): void {
    if (node.isBranch)
      this.tree().toggle(node);
    this.activated.emit(node);
  }

  private rowOf(id: string | null): CdkTreeNode<TreeNode, string> | undefined {
    return this.rows().find(t => t.data.id === id);
  }
}
