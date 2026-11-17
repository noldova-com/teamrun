/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TreeKeyManagerItem } from "@angular/cdk/a11y";
import { Directive, ElementRef, type InputSignal, type OnInit, type OutputEmitterRef, type Signal, type WritableSignal, computed, inject, input, output, signal } from "@angular/core";

import type { TreeFocus } from "../../models/tree-focus";

@Directive({
  selector: "[nolTeamrunTreeItem]",
  host: {
    "role": "treeitem",
    "[attr.tabindex]": "tabIndex()",
    "[attr.aria-level]": "treeParent() === null ? 1 : 2",
    "[attr.aria-expanded]": "treeExpanded()",
    "(focus)": "take()",
    "(keydown)": "press($event)"
  }
})
export class TreeItemDirective implements TreeKeyManagerItem, OnInit {
  public readonly element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  public readonly tree: InputSignal<TreeFocus> = input.required<TreeFocus>({ alias: "nolTeamrunTreeItem" });
  public readonly treeKey: InputSignal<string> = input.required<string>();
  public readonly treeLabel: InputSignal<string> = input.required<string>();
  public readonly treeParent: InputSignal<string | null> = input<string | null>(null);
  public readonly treeExpanded: InputSignal<boolean | null> = input<boolean | null>(null);
  public readonly treeMovable: InputSignal<boolean> = input<boolean>(false);
  public readonly activated: OutputEmitterRef<void> = output();
  public readonly toggled: OutputEmitterRef<void> = output();
  public readonly moved: OutputEmitterRef<number> = output();
  public readonly renamed: OutputEmitterRef<void> = output();
  public readonly owner: WritableSignal<TreeFocus | null> = signal(null);
  public readonly isExpanded: () => boolean = () => this.treeExpanded() === true;
  public readonly makeFocusable: () => void = () => undefined;
  public readonly unfocus: () => void = () => undefined;

  protected readonly tabIndex: Signal<number> = computed(() => this.tree().stop() === this ? 0 : -1);

  public ngOnInit(): void {
    this.owner.set(this.tree());
  }

  public getLabel(): string {
    return this.treeLabel();
  }

  public getParent(): TreeItemDirective | null {
    return this.tree().parentOf(this);
  }

  public getChildren(): TreeItemDirective[] {
    return this.tree().childrenOf(this);
  }

  public expand(): void {
    if (this.treeExpanded() === false)
      this.toggled.emit();
  }

  public collapse(): void {
    this.toggled.emit();
  }

  public activate(): void {
    this.activated.emit();
  }

  public focus(): void {
    this.element.focus();
  }

  protected take(): void {
    this.tree().take(this);
  }

  protected press(event: KeyboardEvent): void {
    if (event.target === this.element)
      this.tree().press(event, this);
  }
}
