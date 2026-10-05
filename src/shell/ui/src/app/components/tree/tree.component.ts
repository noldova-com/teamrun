/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LiveAnnouncer } from "@angular/cdk/a11y";
import { CdkTree, CdkTreeNode, CdkTreeNodeDef } from "@angular/cdk/tree";
import { DOCUMENT } from "@angular/common";
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, type Signal, type WritableSignal, afterRenderEffect, computed, inject, input, output, signal, viewChild, viewChildren } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../../resources";
import { TreeDropPlace } from "../../enums/tree-drop-place";
import { TreeStep } from "../../enums/tree-step";
import { TreeMove } from "../../models/tree-move";
import { TreeNode } from "../../models/tree-node";
import { TreeDragSession } from "../../services/tree-drag-session";

@Component({
  selector: "tr-tree",
  imports: [CdkTree, CdkTreeNode, CdkTreeNodeDef],
  templateUrl: "./tree.component.html",
  styleUrl: "./tree.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "[class.tr-tree-movable]": "movable()" }
})
export class TreeComponent {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly announcer: LiveAnnouncer = inject(LiveAnnouncer);
  private readonly tree: Signal<CdkTree<TreeNode, string>> = viewChild.required<CdkTree<TreeNode, string>>(CdkTree);
  private readonly rows: Signal<readonly CdkTreeNode<TreeNode, string>[]> = viewChildren<CdkTreeNode<TreeNode, string>>(CdkTreeNode);

  private readonly elements: Signal<readonly ElementRef<HTMLElement>[]> = viewChildren(CdkTreeNode, { read: ElementRef<HTMLElement> });
  private readonly opened: Set<string> = new Set();
  private readonly stopId: WritableSignal<string | null> = signal(null);
  private tops: ReadonlyMap<string, number> | null = null;
  private refocus: string | null = null;

  public readonly nodes = input.required<readonly TreeNode[]>();
  public readonly label = input.required<string>();
  public readonly current = input<string | null>(null);
  public readonly movable = input<boolean>(false);
  public readonly activated = output<TreeNode>();
  public readonly moved = output<TreeMove>();

  protected readonly session: TreeDragSession = new TreeDragSession(inject(DOCUMENT), this.host, this.nodes, row => this.nodeOf(row), node => this.tree().isExpanded(node),
    node => this.tree().expand(node), move => this.commit(move));
  protected readonly resources: typeof Resources = Resources;
  protected readonly places: typeof TreeDropPlace = TreeDropPlace;
  protected readonly data: Signal<TreeNode[]> = computed(() => [...this.nodes()]);
  protected readonly hasBranches: Signal<boolean> = computed(() => this.nodes().some(t => t.isBranch));
  protected readonly childrenOf = (node: TreeNode): TreeNode[] => [...node.children];
  protected readonly keyOf = (node: TreeNode): string => node.id;
  protected readonly trackBy = (_: number, node: TreeNode): string => node.id;

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.session.stop());
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
    afterRenderEffect(() => {
      this.nodes();
      this.settle();
    });
  }

  public focus(): void {
    (this.rowOf(this.current()) ?? this.rows()[0])?.focus();
  }

  protected take(row: CdkTreeNode<TreeNode, string>): void {
    this.stopId.set(row.data.id);
  }

  protected press(event: PointerEvent, node: TreeNode): void {
    if (this.movable())
      this.session.begin(event, node);
  }

  protected nudge(event: KeyboardEvent, node: TreeNode): void {
    const step = this.movable() && event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey ? this.stepOf(event.key) : undefined;
    if (Object.isUndefined(step))
      return;
    event.preventDefault();
    event.stopPropagation();
    const move = TreeMove.step(this.nodes(), node.id, step);
    if (Object.isNull(move))
      return;
    this.refocus = node.id;
    this.commit(move);
  }

  protected choose(node: TreeNode): void {
    if (node.isBranch)
      this.tree().toggle(node);
    this.activated.emit(node);
  }

  private commit(move: TreeMove): void {
    const spot = move.spot(this.nodes());
    this.announcer.announce(Resources.formatTreeMoved(spot.label, spot.parentLabel, spot.position, spot.count), "polite");
    this.tops = this.topsOfRows();
    this.moved.emit(move);
  }

  private stepOf(key: string): TreeStep | undefined {
    const isRightToLeft = this.host.matches(Resources.rightToLeftSelector);
    switch (key) {
      case Resources.arrowUpKey:
        return TreeStep.Up;
      case Resources.arrowDownKey:
        return TreeStep.Down;
      case Resources.arrowRightKey:
        return isRightToLeft ? TreeStep.Out : TreeStep.In;
      case Resources.arrowLeftKey:
        return isRightToLeft ? TreeStep.In : TreeStep.Out;
      default:
        return undefined;
    }
  }

  private nodeOf(row: Element): TreeNode | undefined {
    return this.rows()[this.elements().findIndex(t => t.nativeElement === row)]?.data;
  }

  private topsOfRows(): ReadonlyMap<string, number> {
    return new Map(this.rows().map((row, index) => [row.data.id, (this.elements()[index] as ElementRef<HTMLElement>).nativeElement.getBoundingClientRect().top]));
  }

  private settle(): void {
    const before = this.tops;
    this.tops = null;
    for (const [index, row] of this.rows().entries()) {
      const item = (this.elements()[index] as ElementRef<HTMLElement>).nativeElement;
      const shift = (before?.get(row.data.id) ?? item.getBoundingClientRect().top) - item.getBoundingClientRect().top;
      if (shift === 0)
        continue;
      item.style.setProperty(Resources.treeShiftProperty, `${shift}px`);
      item.classList.remove(Resources.treeShiftingClass);
      item.getBoundingClientRect();
      item.classList.add(Resources.treeShiftingClass);
      item.addEventListener(Resources.animationEndEvent, () => item.classList.remove(Resources.treeShiftingClass), { once: true });
    }
    if (!Object.isNull(this.refocus))
      this.rowOf(this.refocus)?.focus();
    this.refocus = null;
  }

  private rowOf(id: string | null): CdkTreeNode<TreeNode, string> | undefined {
    return this.rows().find(t => t.data.id === id);
  }
}
