/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FocusTrapFactory } from "@angular/cdk/a11y";
import { ChangeDetectionStrategy, Component, type Signal, afterRenderEffect, inject, viewChild } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { DialogComponent, DialogSize } from "@noldova/teamrun-shell-ui";

import { TabLabelService } from "../../services/tab-label.service";
import { ViewDialogService } from "../../services/view-dialog.service";
import { TabSlotComponent } from "../tab-slot/tab-slot.component";

@Component({
  selector: "tr-view-dialog",
  imports: [DialogComponent, TabSlotComponent],
  templateUrl: "./view-dialog.component.html",
  styleUrl: "./view-dialog.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewDialogComponent {
  private readonly focusTraps: FocusTrapFactory = inject(FocusTrapFactory);
  private readonly slot: Signal<TabSlotComponent> = viewChild.required(TabSlotComponent);

  protected readonly large: DialogSize = DialogSize.Large;
  protected readonly dialogs: ViewDialogService = inject(ViewDialogService);
  protected readonly labels: TabLabelService = inject(TabLabelService);

  public constructor() {
    afterRenderEffect({
      read: () => {
        const content = this.slot().content();
        if (Object.isNull(content) || !content.isLoaded())
          return;
        const trap = this.focusTraps.create(content.element, true);
        trap.focusFirstTabbableElement({ preventScroll: true });
        trap.destroy();
      }
    });
  }
}
