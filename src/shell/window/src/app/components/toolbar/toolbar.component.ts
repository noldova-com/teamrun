/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ErrorHandler, type Signal, type WritableSignal, afterRenderEffect, computed, inject, input, signal, viewChild } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { MenuTriggerDirective, OverlaySide, ToolbarButtonComponent, ToolbarDirective, ToolbarItemDirective, TooltipDirective } from "@noldova/teamrun-shell-ui";

import { Resources } from "../../../resources";
import { MenuCheck } from "../../enums/menu-check";
import type { CommandRow } from "../../models/command-row";
import type { MenuSection } from "../../models/menu-section";
import { ToolbarFit } from "../../models/toolbar-fit";
import type { Toolbar } from "../../models/toolbar";
import { CommandService } from "../../services/command.service";
import { ToolbarDragService } from "../../services/toolbar-drag.service";
import { PlaceMenuComponent } from "../place-menu/place-menu.component";

@Component({
  selector: "tr-toolbar",
  imports: [MenuTriggerDirective, PlaceMenuComponent, ToolbarButtonComponent, ToolbarDirective, ToolbarItemDirective, TooltipDirective],
  templateUrl: "./toolbar.component.html",
  styleUrl: "./toolbar.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-toolbar",
    "[attr.data-toolbar]": "toolbar().name",
    "[class.tr-toolbar-dragging]": "drag.dragging() === toolbar().name",
    "[style.flex-basis.px]": "naturalWidth()"
  }
})
export class ToolbarComponent {
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly content: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("content");
  private readonly ghost: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("ghost");
  private readonly grip: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("grip");
  private readonly edges: WritableSignal<readonly number[]> = signal([]);
  private readonly overflowSpace: WritableSignal<number> = signal(0);
  private readonly available: WritableSignal<number> = signal(Number.POSITIVE_INFINITY);
  private readonly gripWidth: WritableSignal<number> = signal(0);

  protected readonly resources: typeof Resources = Resources;
  protected readonly menuCheck: typeof MenuCheck = MenuCheck;
  protected readonly below: OverlaySide = OverlaySide.below;
  protected readonly drag: ToolbarDragService = inject(ToolbarDragService);

  public readonly toolbar = input.required<Toolbar>();
  public readonly count: Signal<number> = computed(() => ToolbarFit.count(this.edges(), this.overflowSpace(), this.available()));
  public readonly shown: Signal<readonly MenuSection[]> = computed(() => this.toolbar().sections.slice(0, this.count()));
  public readonly overflowing: Signal<readonly MenuSection[]> = computed(() => this.toolbar().sections.slice(this.count()));
  public readonly naturalWidth: Signal<number | null> = computed(() => {
    const last = this.edges().at(-1);
    return Object.isUndefined(last) ? null : this.gripWidth() + last;
  });

  public constructor() {
    const observer = new ResizeObserver(() => this.measure());
    inject(DestroyRef).onDestroy(() => observer.disconnect());
    afterRenderEffect(() => {
      this.toolbar();
      const [content, ghost, grip] = [this.content().nativeElement, this.ghost().nativeElement, this.grip().nativeElement];
      observer.disconnect();
      observer.observe(content);
      observer.observe(ghost);
      observer.observe(grip);
      this.measure();
    });
  }

  protected tooltipOf(row: CommandRow): string {
    return Object.isNull(row.key) ? row.title : `${row.title} (${row.key})`;
  }

  protected run(row: CommandRow): void {
    if (row.isEnabled)
      this.commands.runAsync(row.command, row.commandArguments).catch((error: unknown) => this.errors.handleError(error));
  }

  private measure(): void {
    const ghost = this.ghost().nativeElement;
    const origin = ghost.getBoundingClientRect().left;
    const edges = [...ghost.querySelectorAll<HTMLElement>(Resources.toolbarSectionSelector)].map(t => t.getBoundingClientRect().right - origin);
    this.edges.set(edges);
    const overflowRight = [...ghost.querySelectorAll<HTMLElement>(Resources.toolbarOverflowSelector)].reduce((_, t) => t.getBoundingClientRect().right, origin);
    this.overflowSpace.set(overflowRight - origin - edges.reduce((_, t) => t, 0));
    this.available.set(this.content().nativeElement.getBoundingClientRect().width);
    this.gripWidth.set(this.content().nativeElement.getBoundingClientRect().left - this.grip().nativeElement.getBoundingClientRect().left);
  }
}
