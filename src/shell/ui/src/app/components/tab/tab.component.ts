/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, ViewEncapsulation, computed, input, output } from "@angular/core";

import { Resources } from "../../../resources";

@Component({
  selector: "tr-tab",
  templateUrl: "./tab.component.html",
  styleUrl: "./tab.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    "class": "tr-tab",
    "role": "tab",
    "[attr.aria-selected]": "selected()",
    "[attr.aria-busy]": "working() || null",
    "[attr.tabindex]": "selected() ? 0 : -1",
    "[class.tr-tab-selected]": "selected()",
    "[class.tr-tab-preview]": "preview()",
    "[class.tr-tab-working]": "working()",
    "(click)": "activate.emit()",
    "(keydown.enter)": "activate.emit()",
    "(keydown.space)": "onSpace($event)",
    "(keydown.delete)": "requestClose()",
    "(mousedown)": "onMouseDown($event)",
    "(auxclick)": "onAuxiliaryClick($event)"
  }
})
export class TabComponent {
  protected readonly resources: typeof Resources = Resources;

  public readonly label = input.required<string>();
  public readonly icon = input<string>();
  public readonly selected = input<boolean>(false);
  public readonly preview = input<boolean>(false);
  public readonly working = input<boolean>(false);
  public readonly closable = input<boolean>(true);
  public readonly activate = output<void>();
  public readonly close = output<void>();
  public readonly closeLabel: Signal<string> = computed(() => Resources.formatCloseTab(this.label()));

  public onSpace(event: Event): void {
    event.preventDefault();
    this.activate.emit();
  }

  public onMouseDown(event: MouseEvent): void {
    if (event.button === Resources.middleButton)
      event.preventDefault();
  }

  public onAuxiliaryClick(event: MouseEvent): void {
    if (event.button !== Resources.middleButton)
      return;
    event.preventDefault();
    this.requestClose();
  }

  public onCloseClick(event: MouseEvent): void {
    event.stopPropagation();
    this.requestClose();
  }

  public requestClose(): void {
    if (this.closable())
      this.close.emit();
  }
}
