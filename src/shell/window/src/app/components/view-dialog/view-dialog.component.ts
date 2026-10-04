/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FocusTrapFactory } from "@angular/cdk/a11y";
import { ChangeDetectionStrategy, Component, type Signal, afterRenderEffect, inject, viewChild } from "@angular/core";

import { DialogComponent, DialogSize } from "@noldova/teamrun-shell-ui";

import { TabLabelService } from "../../services/tab-label.service";
import { ViewDialogService } from "../../services/view-dialog.service";
import { TabContentComponent } from "../tab-content/tab-content.component";

@Component({
  selector: "tr-view-dialog",
  imports: [DialogComponent, TabContentComponent],
  templateUrl: "./view-dialog.component.html",
  styleUrl: "./view-dialog.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewDialogComponent {
  private readonly focusTraps: FocusTrapFactory = inject(FocusTrapFactory);
  private readonly content: Signal<TabContentComponent> = viewChild.required(TabContentComponent);

  protected readonly large: DialogSize = DialogSize.Large;
  protected readonly dialogs: ViewDialogService = inject(ViewDialogService);
  protected readonly labels: TabLabelService = inject(TabLabelService);

  public constructor() {
    afterRenderEffect(() => {
      const content = this.content();
      if (!content.isLoaded())
        return;
      const trap = this.focusTraps.create(content.element, true);
      trap.focusFirstTabbableElement();
      trap.destroy();
    });
  }
}
