/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CdkTree, CdkTreeNode, CdkTreeNodeDef } from "@angular/cdk/tree";
import { DOCUMENT } from "@angular/common";
import { ChangeDetectionStrategy, Component, ElementRef, type Signal, afterRenderEffect, computed, inject, input, output, viewChild, viewChildren } from "@angular/core";

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
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document: Document = inject(DOCUMENT);
  private readonly tree: Signal<CdkTree<TreeNode, string>> = viewChild.required<CdkTree<TreeNode, string>>(CdkTree);
  private readonly rows: Signal<readonly CdkTreeNode<TreeNode, string>[]> = viewChildren<CdkTreeNode<TreeNode, string>>(CdkTreeNode);

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
      for (const branch of this.nodes().flatMap(t => t.openBranches))
        this.tree().expand(branch);
    });
    afterRenderEffect(() => {
      const row = this.rowOf(this.current());
      if (row === undefined || this.host.contains(this.document.activeElement))
        return;
      for (const other of this.rows())
        if (other === row)
          other.makeFocusable();
        else
          other.unfocus();
    });
  }

  public focus(): void {
    (this.rowOf(this.current()) ?? this.rows()[0])?.focus();
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
