/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CdkListbox, CdkOption, type ListboxValueChangeEvent } from "@angular/cdk/listbox";
import { TemplatePortal } from "@angular/cdk/portal";
import {
  ChangeDetectionStrategy, Component, DestroyRef, type ElementRef, Injector, type Signal, type TemplateRef, ViewContainerRef, type WritableSignal, computed, inject, input, output, signal, viewChild
} from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { OverlayAlignment } from "../../enums/overlay-alignment";
import { OverlayAnchoring } from "../../models/overlay-anchoring";
import { OverlaySide } from "../../models/overlay-side";
import type { SelectOption } from "../../models/select-option";
import { AnchoredOverlay } from "../../services/anchored-overlay";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-select",
  imports: [CdkListbox, CdkOption],
  templateUrl: "./select.component.html",
  styleUrl: "./select.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-select"
  }
})
export class SelectComponent {
  private readonly injector: Injector = inject(Injector);
  private readonly viewContainer: ViewContainerRef = inject(ViewContainerRef);
  private readonly button: Signal<ElementRef<HTMLButtonElement>> = viewChild.required<ElementRef<HTMLButtonElement>>("button");
  private overlay: AnchoredOverlay | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly isOpen: WritableSignal<boolean> = signal(false);

  public readonly isExpanded: Signal<boolean> = this.isOpen.asReadonly();

  public readonly options = input.required<readonly SelectOption[]>();
  public readonly value = input.required<string>();
  public readonly label = input.required<string>();
  public readonly disabled = input<boolean>(false);
  public readonly valueChange = output<string>();

  protected readonly title: Signal<string> = computed(() => this.options().find(t => t.value === this.value())?.title ?? this.value());
  protected readonly marked: Signal<readonly string[]> = computed(() => this.options().some(t => t.value === this.value()) ? [this.value()] : []);

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.close());
  }

  public focus(): void {
    this.button().nativeElement.focus();
  }

  protected toggle(button: HTMLButtonElement, list: TemplateRef<unknown>): void {
    if (this.isOpen()) {
      this.close();
      return;
    }
    const overlay = new AnchoredOverlay(this.injector, Resources.dropdownPaneClass);
    overlay.outsidePointerEvents.subscribe(event => {
      if (!(event.target instanceof Node && button.contains(event.target)))
        this.close();
    });
    overlay.keydownEvents.subscribe(event => {
      if (event.key !== Resources.escapeKey && event.key !== Resources.tabKey)
        return;
      event.preventDefault();
      this.closeTo(button);
    });
    overlay.originLost.subscribe(() => this.close());
    this.overlay = overlay;
    this.isOpen.set(true);
    overlay.openTemplate(new TemplatePortal(list, this.viewContainer), button, new OverlayAnchoring(OverlaySide.below, OverlayAlignment.Start, 0));
    overlay.element.querySelector<HTMLElement>(Resources.listboxSelector)?.focus();
  }

  protected choose(event: ListboxValueChangeEvent<string>, button: HTMLButtonElement): void {
    this.closeTo(button);
    for (const chosen of event.value)
      this.valueChange.emit(chosen);
  }

  protected chooseAgain(event: KeyboardEvent, button: HTMLButtonElement): void {
    if (event.key === Resources.enterKey || event.key === Resources.spaceKey)
      this.closeOnCurrent((event.target as HTMLElement).getAttribute(Resources.valueAttribute), button);
  }

  protected closeOnCurrent(value: string | null, button: HTMLButtonElement): void {
    if (value === this.value())
      this.closeTo(button);
  }

  private closeTo(button: HTMLButtonElement): void {
    this.close();
    button.focus();
  }

  private close(): void {
    this.isOpen.set(false);
    this.overlay?.dispose();
    this.overlay = null;
  }
}
