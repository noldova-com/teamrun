/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, type Signal, type WritableSignal, computed, inject, input, output, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { SashOrientation } from "../../enums/sash-orientation";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-sash",
  templateUrl: "./sash.component.html",
  styleUrl: "./sash.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "role": "separator",
    "tabindex": "0",
    "[attr.aria-label]": "label()",
    "[attr.aria-orientation]": "ariaOrientation()",
    "[attr.aria-valuenow]": "value() ?? null",
    "[attr.aria-valuemin]": "minimum() ?? null",
    "[attr.aria-valuemax]": "maximum() ?? null",
    "[class.tr-sash-vertical]": "isVertical()",
    "[class.tr-sash-active]": "isActive()",
    "(pointerenter)": "onPointerEnter()",
    "(pointerleave)": "onPointerLeave()",
    "(pointerdown)": "onPointerDown($event)",
    "(pointermove)": "onPointerMove($event)",
    "(pointerup)": "onPointerEnd($event)",
    "(pointercancel)": "onPointerEnd($event)",
    "(keydown)": "onKeyDown($event)"
  }
})
export class SashComponent {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly isHovered: WritableSignal<boolean> = signal(false);
  private readonly isDragging: WritableSignal<boolean> = signal(false);
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPosition: number = 0;

  protected readonly isVertical: Signal<boolean> = computed(() => this.orientation() === SashOrientation.Vertical);
  protected readonly ariaOrientation: Signal<string> = computed(() => this.isVertical() ? Resources.verticalOrientation : Resources.horizontalOrientation);
  protected readonly isActive: Signal<boolean> = computed(() => this.isHovered() || this.isDragging());

  public readonly orientation = input.required<SashOrientation>();
  public readonly label = input.required<string>();
  public readonly value = input<number>();
  public readonly minimum = input<number>();
  public readonly maximum = input<number>();
  public readonly step = input<number>(Resources.sashKeyboardStep);
  public readonly resize = output<number>();

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.clearHoverTimer());
  }

  protected onPointerEnter(): void {
    this.clearHoverTimer();
    this.hoverTimer = setTimeout(() => this.isHovered.set(true), Resources.sashHoverDelay);
  }

  protected onPointerLeave(): void {
    this.clearHoverTimer();
    this.isHovered.set(false);
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== Resources.primaryButton)
      return;
    event.preventDefault();
    this.host.setPointerCapture(event.pointerId);
    this.lastPosition = this.readPosition(event);
    this.isDragging.set(true);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.isDragging())
      return;
    const position = this.readPosition(event);
    const delta = position - this.lastPosition;
    this.lastPosition = position;
    if (delta !== 0)
      this.resize.emit(delta);
  }

  protected onPointerEnd(event: PointerEvent): void {
    if (!this.isDragging())
      return;
    this.host.releasePointerCapture(event.pointerId);
    this.isDragging.set(false);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    const orientation = this.orientation();
    if (event.key === Resources.sashDecreaseKeys[orientation])
      this.resize.emit(-this.step());
    else if (event.key === Resources.sashIncreaseKeys[orientation])
      this.resize.emit(this.step());
    else
      return;
    event.preventDefault();
  }

  private readPosition(event: PointerEvent): number {
    return this.isVertical() ? event.clientX : event.clientY;
  }

  private clearHoverTimer(): void {
    if (!Object.isNull(this.hoverTimer))
      clearTimeout(this.hoverTimer);
    this.hoverTimer = null;
  }
}
