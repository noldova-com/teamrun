/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, ElementRef, inject, input, type InputSignal, type Signal, viewChild } from "@angular/core";

import "@noldova/context.core";
import type { ContextUsage } from "@noldova/teamrun.protocol";
import { TooltipDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { UsageFormatterService } from "../../services/usage-formatter.service";

@Component({
  selector: "nol-teamrun-context-gauge",
  imports: [TooltipDirective],
  templateUrl: "./context-gauge.component.html",
  styleUrl: "./context-gauge.component.css"
})
export class ContextGaugeComponent {
  private readonly formatter: UsageFormatterService = inject(UsageFormatterService);
  private readonly meter: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("meter");
  private readonly track: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("track");
  private readonly text: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("text");

  public readonly context: InputSignal<ContextUsage> = input.required<ContextUsage>();
  public readonly teammate: InputSignal<string> = input.required<string>();
  public readonly trackOnly: InputSignal<boolean> = input(false);

  protected readonly percent: Signal<number> = computed(() => this.formatter.contextPercent(this.context()));
  protected readonly compactAt: Signal<number | null> = computed(() => this.formatter.compactPercent(this.context()));
  protected readonly label: Signal<string> = computed(() => Resources.formatContextGauge(this.percent()));
  protected readonly detail: Signal<string> = computed(() => this.formatter.contextDetail(this.context(), this.teammate()));
  protected readonly hint: Signal<string> = computed(() => Resources.formatContextHint(this.label(), this.detail()));

  public get labelElement(): HTMLElement {
    return this.text().nativeElement;
  }

  public fullWidth(): number {
    const length = (value: string): number => Number.parseFloat(value) || 0;
    const [track, text] = [this.track().nativeElement, this.text().nativeElement];
    return length(getComputedStyle(this.meter().nativeElement).columnGap) + length(getComputedStyle(track).marginInlineStart) + track.getBoundingClientRect().width
      + text.getBoundingClientRect().width + length(getComputedStyle(text).marginInlineEnd);
  }

  public trackWidth(): number {
    const length = (value: string): number => Number.parseFloat(value) || 0;
    const track = this.track().nativeElement;
    return length(getComputedStyle(track).marginInlineStart) + track.getBoundingClientRect().width + length(getComputedStyle(this.text().nativeElement).marginInlineEnd);
  }
}
