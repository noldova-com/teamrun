/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { FocusableOption } from "@angular/cdk/a11y";
import { Directive, ElementRef, type Signal, type WritableSignal, inject, signal } from "@angular/core";

@Directive({
  selector: "[trToolbarItem]",
  host: {
    "[attr.tabindex]": "tabIndex()"
  }
})
export class ToolbarItemDirective implements FocusableOption {
  private readonly tabIndexValue: WritableSignal<number> = signal(-1);

  public readonly element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  public readonly tabIndex: Signal<number> = this.tabIndexValue.asReadonly();

  public setTabStop(isTabStop: boolean): void {
    this.tabIndexValue.set(isTabStop ? 0 : -1);
  }

  public focus(): void {
    this.element.focus();
  }
}
