/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CdkConnectedOverlay, CdkOverlayOrigin, type ConnectedPosition } from "@angular/cdk/overlay";
import { ChangeDetectionStrategy, Component, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import type { ModuleFailure } from "../../models/module-failure";
import { WindowPartHostService } from "../../services/window-part-host.service";
import { Resources } from "../../../resources";
import { ModuleFailuresPopoverComponent } from "../module-failures-popover/module-failures-popover.component";

@Component({
  selector: "tr-module-failures",
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, ModuleFailuresPopoverComponent],
  templateUrl: "./module-failures.component.html",
  styleUrl: "./module-failures.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModuleFailuresComponent {
  private readonly isOpen: WritableSignal<boolean> = signal(false);

  protected readonly resources: typeof Resources = Resources;
  protected readonly positions: ConnectedPosition[] = [
    { originX: "end", originY: "top", overlayX: "end", overlayY: "bottom" },
    { originX: "start", originY: "top", overlayX: "start", overlayY: "bottom" }
  ];
  protected readonly failures: Signal<readonly ModuleFailure[]> = inject(WindowPartHostService).failures;
  protected readonly isShown: Signal<boolean> = computed(() => this.isOpen() && this.failures().length > 0);

  protected toggle(): void {
    this.isOpen.update(t => !t);
  }

  protected closeFromKeyboard(event: KeyboardEvent, item: HTMLButtonElement): void {
    if (event.key !== Resources.escapeKey)
      return;
    event.preventDefault();
    this.isOpen.set(false);
    item.focus();
  }

  protected close(): void {
    this.isOpen.set(false);
  }
}
