/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type ElementRef, type Signal, type WritableSignal, afterNextRender, computed, input, signal, viewChild } from "@angular/core";

import { ButtonVariant } from "../../enums/button-variant";
import { ButtonComponent } from "../button/button.component";
import { GalleryResources } from "./gallery-resources";

@Component({
  selector: "tr-gallery-specimen",
  imports: [ButtonComponent],
  templateUrl: "./gallery-specimen.component.html",
  styleUrl: "./gallery-specimen.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GallerySpecimenComponent {
  private readonly body: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("body");
  private readonly isFocusableState: WritableSignal<boolean> = signal(false);

  protected readonly text: typeof GalleryResources.text = GalleryResources.text;
  protected readonly variants: typeof ButtonVariant = ButtonVariant;
  protected readonly isFocusable: Signal<boolean> = this.isFocusableState.asReadonly();
  protected readonly focusLabel: Signal<string> = computed(() => GalleryResources.formatShowFocus(this.name()));

  public readonly name = input.required<string>();

  public constructor() {
    afterNextRender(() => this.isFocusableState.set(this.body().nativeElement.querySelector(GalleryResources.focusableSelector) !== null));
  }

  protected showFocus(): void {
    this.body().nativeElement.querySelector<HTMLElement>(GalleryResources.focusableSelector)?.focus();
  }
}
