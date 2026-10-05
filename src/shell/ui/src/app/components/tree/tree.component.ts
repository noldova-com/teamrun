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
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, type Signal, type WritableSignal, afterNextRender, afterRenderEffect, computed, inject, input, output, signal, viewChild, viewChildren } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../../resources";
import { TreeDropPlace } from "../../enums/tree-drop-place";
import { TreeStep } from "../../enums/tree-step";
import { TreeDragHooks } from "../../models/tree-drag-hooks";
import type { TreeMove } from "../../models/tree-move";
import { TreeNode } from "../../models/tree-node";
import { TreePlace } from "../../models/tree-place";
import { TreePlan } from "../../models/tree-plan";
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
  private readonly injector: Injector = inject(Injector);
  private readonly tree: Signal<CdkTree<TreeNode, string>> = viewChild.required<CdkTree<TreeNode, string>>(CdkTree);
  private readonly rows: Signal<readonly CdkTreeNode<TreeNode, string>[]> = viewChildren<CdkTreeNode<TreeNode, string>>(CdkTreeNode);

  private readonly area: Signal<ElementRef<HTMLElement>> = viewChild.required(CdkTree, { read: ElementRef<HTMLElement> });
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

  protected readonly session: TreeDragSession = new TreeDragSession(inject(DOCUMENT), this.host, this.nodes, new TreeDragHooks(
    row => this.nodeOf(row),
    node => this.elementOf(node),
    () => Number.parseFloat(getComputedStyle(this.area().nativeElement).rowGap),
    node => this.tree().isExpanded(node),
    node => this.openBranch(node),
    move => this.commit(move)
  ));
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
  }

  public focus(): void {
    (this.rowOf(this.current()) ?? this.rows()[0])?.focus();
  }

  protected take(row: CdkTreeNode<TreeNode, string>): void {
    this.stopId.set(row.data.id);
  }

  protected press(event: PointerEvent, node: TreeNode, element: HTMLElement): void {
    if (this.movable())
      this.session.begin(event, node, element);
  }

  protected nudge(event: KeyboardEvent, node: TreeNode): void {
    const step = this.movable() && event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey ? this.stepOf(event.key) : undefined;
    if (Object.isUndefined(step))
      return;
    event.preventDefault();
    event.stopPropagation();
    const move = TreePlan.step(this.nodes(), node.id, step);
    if (Object.isNull(move))
      return;
    this.commit(move);
  }

  protected choose(node: TreeNode): void {
    if (node.isBranch)
      this.tree().toggle(node);
    this.activated.emit(node);
  }

  private commit(move: TreeMove): void {
    const spot = TreePlan.spot(move, this.nodes());
    void this.announcer.announce(Resources.formatTreeMoved(spot.label, spot.parentLabel, spot.position, spot.count), Resources.politeAnnouncement);
    const parent = Object.isNull(move.parentId) ? undefined : TreePlace.find(this.nodes(), move.parentId)?.node;
    if (!Object.isUndefined(parent))
      this.tree().expand(parent);
    const before = this.nodes();
    this.tops = this.topsOfRows();
    this.refocus = move.id;
    this.moved.emit(move);
    afterNextRender(() => this.settle(before), { injector: this.injector });
  }

  private openBranch(node: TreeNode): void {
    this.tree().expand(node);
    afterNextRender(() => this.session.reevaluate(), { injector: this.injector });
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
    const tops = this.elements().map(t => t.nativeElement.getBoundingClientRect().top);
    return new Map(this.rows().map((row, index) => [row.data.id, tops[index] as number]));
  }

  private settle(before: readonly TreeNode[]): void {
    const tops = this.tops;
    const refocus = this.refocus;
    this.tops = null;
    this.refocus = null;
    if (this.nodes() === before)
      return;
    const items = this.elements().map(t => t.nativeElement);
    const next = items.map(t => t.getBoundingClientRect().top);
    if (!matchMedia(Resources.reducedMotionQuery).matches)
      for (const [index, row] of this.rows().entries()) {
        const shift = (tops?.get(row.data.id) ?? next[index] as number) - (next[index] as number);
        if (shift !== 0)
          items[index]?.animate({ translate: [`0 ${shift}px`, "0 0"] }, { duration: Resources.treeShiftDuration, easing: Resources.treeShiftEasing });
      }
    this.rowOf(refocus)?.focus();
  }

  private elementOf(node: TreeNode): HTMLElement | undefined {
    return this.elements()[this.rows().findIndex(t => t.data.id === node.id)]?.nativeElement;
  }

  private rowOf(id: string | null): CdkTreeNode<TreeNode, string> | undefined {
    return this.rows().find(t => t.data.id === id);
  }
}
