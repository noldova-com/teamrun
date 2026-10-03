/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TemplatePortal } from "@angular/cdk/portal";
import {
  ChangeDetectionStrategy, Component, DestroyRef, Injector, type Signal, type TemplateRef, ViewContainerRef, type WritableSignal, computed, effect, inject, signal
} from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { AnchoredOverlay, OverlayAlignment, OverlayAnchoring, OverlayBoundsService, OverlaySide } from "@noldova/teamrun-shell-ui";

import type { ModuleFailure } from "../../models/module-failure";
import { WindowPartHostService } from "../../services/window-part-host.service";
import { Resources } from "../../../resources";
import { ModuleFailuresPopoverComponent } from "../module-failures-popover/module-failures-popover.component";

@Component({
  selector: "tr-module-failures",
  imports: [ModuleFailuresPopoverComponent],
  templateUrl: "./module-failures.component.html",
  styleUrl: "./module-failures.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModuleFailuresComponent {
  private readonly injector: Injector = inject(Injector);
  private readonly viewContainer: ViewContainerRef = inject(ViewContainerRef);
  private readonly bounds: OverlayBoundsService = inject(OverlayBoundsService);
  private readonly isOpen: WritableSignal<boolean> = signal(false);
  private overlay: AnchoredOverlay | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly failures: Signal<readonly ModuleFailure[]> = inject(WindowPartHostService).failures;
  protected readonly isShown: Signal<boolean> = computed(() => this.isOpen() && this.failures().length > 0);

  public constructor() {
    effect(() => {
      if (!this.isShown())
        this.close();
    });
    inject(DestroyRef).onDestroy(() => this.close());
  }

  protected toggle(item: HTMLButtonElement, popover: TemplateRef<unknown>): void {
    if (this.isOpen()) {
      this.close();
      return;
    }
    const overlay = new AnchoredOverlay(this.injector, Resources.popoverPaneClass);
    overlay.outsidePointerEvents.subscribe(event => {
      if (!(event.target instanceof Node && item.contains(event.target)))
        this.close();
    });
    overlay.keydownEvents.subscribe(event => this.closeFromKeyboard(event, item));
    overlay.originScrolls.subscribe(() => this.close());
    this.overlay = overlay;
    this.isOpen.set(true);
    overlay.openTemplate(new TemplatePortal(popover, this.viewContainer), item, new OverlayAnchoring(OverlaySide.above, OverlayAlignment.End, this.bounds.gap));
  }

  private closeFromKeyboard(event: KeyboardEvent, item: HTMLButtonElement): void {
    if (event.key !== Resources.escapeKey)
      return;
    event.preventDefault();
    this.close();
    item.focus();
  }

  private close(): void {
    this.isOpen.set(false);
    this.overlay?.dispose();
    this.overlay = null;
  }
}
