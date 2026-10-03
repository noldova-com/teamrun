/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { FocusKeyManager } from "@angular/cdk/a11y";
import { DestroyRef, Directive, Injector, type Signal, type WritableSignal, computed, contentChildren, effect, inject, input, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { ToolbarOrientation } from "../../enums/toolbar-orientation";
import { Resources } from "../../../resources";
import { ToolbarItemDirective } from "./toolbar-item.directive";

@Directive({
  selector: "[trToolbar]",
  host: {
    "role": "toolbar",
    "[attr.aria-orientation]": "ariaOrientation()",
    "[attr.aria-label]": "label()",
    "(focusin)": "follow($event)",
    "(keydown)": "move($event)"
  }
})
export class ToolbarDirective {
  private readonly items: Signal<readonly ToolbarItemDirective[]> = contentChildren(ToolbarItemDirective, { descendants: true });
  private readonly keys: FocusKeyManager<ToolbarItemDirective> = new FocusKeyManager(this.items, inject(Injector)).skipPredicate(() => false).withHomeAndEnd();
  private readonly current: WritableSignal<ToolbarItemDirective | null> = signal(null);

  public readonly orientation = input<ToolbarOrientation>(ToolbarOrientation.Horizontal, { alias: "trToolbarOrientation" });
  public readonly label = input<string | null>(null, { alias: "trToolbarLabel" });
  public readonly isWrapping = input<boolean>(false, { alias: "trToolbarWrap" });
  public readonly ariaOrientation: Signal<string> = computed(() =>
    this.orientation() === ToolbarOrientation.Vertical ? Resources.verticalOrientation : Resources.horizontalOrientation);

  public constructor() {
    const changes = this.keys.change.subscribe(() => this.current.set(this.keys.activeItem));
    inject(DestroyRef).onDestroy(() => {
      changes.unsubscribe();
      this.keys.destroy();
    });
    effect(() => {
      const isVertical = this.orientation() === ToolbarOrientation.Vertical;
      this.keys.withVerticalOrientation(isVertical).withHorizontalOrientation(isVertical ? null : Resources.toolbarDirection).withWrap(this.isWrapping());
    });
    effect(() => {
      const items = this.items();
      const current = this.current();
      const stop = !Object.isNull(current) && items.includes(current) ? current : items[0] ?? null;
      for (const item of items)
        item.setTabStop(item === stop);
    });
  }

  protected follow(event: FocusEvent): void {
    const item = this.items().find(t => t.element === event.target);
    if (Object.isUndefined(item))
      return;
    this.keys.updateActiveItem(item);
    this.current.set(item);
  }

  protected move(event: KeyboardEvent): void {
    if (!Resources.toolbarMoveKeys[this.orientation()].includes(event.key) || !this.items().some(t => t.element === event.target))
      return;
    this.keys.onKeydown(event);
  }
}
