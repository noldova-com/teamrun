/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TreeKeyManager } from "@angular/cdk/a11y";
import { DestroyRef, type Injector, type Signal, type WritableSignal, afterNextRender, computed, signal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";

import "@noldova/context.core";

import type { TreeItemDirective } from "../components/projects-view/tree-item.directive";
import { Resources } from "../../resources";

export class TreeFocus {
  private readonly stopKey: WritableSignal<string | null> = signal(null);
  private readonly manager: TreeKeyManager<TreeItemDirective>;
  private readonly injector: Injector;
  private readonly items: Signal<readonly TreeItemDirective[]>;

  public readonly stop: Signal<TreeItemDirective | undefined>;

  public constructor(all: Signal<readonly TreeItemDirective[]>, preferredKey: Signal<string | null>, injector: Injector) {
    this.injector = injector;
    this.items = computed(() => all().filter(t => t.owner() === this).sort(TreeFocus.byPlace));
    this.stop = computed(() => {
      const items = this.items();
      return items.find(t => t.treeKey() === this.stopKey()) ?? items.find(t => t.treeKey() === preferredKey()) ?? items[0];
    });
    this.manager = new TreeKeyManager(toObservable(computed(() => [...this.items()]), { injector }), { trackBy: t => t.treeKey(), typeAheadDebounceInterval: true });
    injector.get(DestroyRef).onDestroy(() => this.manager.destroy());
  }

  public parentOf(item: TreeItemDirective): TreeItemDirective | null {
    return this.items().find(t => t.treeKey() === item.treeParent()) ?? null;
  }

  public childrenOf(item: TreeItemDirective): TreeItemDirective[] {
    return this.items().filter(t => t.treeParent() === item.treeKey());
  }

  public take(item: TreeItemDirective): void {
    this.stopKey.set(item.treeKey());
    this.manager.focusItem(item, { emitChangeEvent: false });
  }

  public press(event: KeyboardEvent, item: TreeItemDirective): void {
    if (event.key === Resources.renameKey && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      item.renamed.emit();
    } else if (!event.ctrlKey && !event.altKey && !event.metaKey)
      this.manager.onKeydown(event);
  }

  public focusLater(key: string | undefined): void {
    afterNextRender(() => this.items().find(t => t.treeKey() === key)?.focus(), { injector: this.injector });
  }

  public keepFocusLater(key: string, left: Element | null): void {
    const focused = document.activeElement;
    if (this.items().some(t => t.treeKey() === key && (focused === document.body || t.element.contains(focused)) && focused === left))
      this.focusLater(key);
  }

  private static byPlace(first: TreeItemDirective, second: TreeItemDirective): number {
    return first.element.compareDocumentPosition(second.element) === Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  }
}
