/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { InteractivityChecker } from "@angular/cdk/a11y";
import { ChangeDetectionStrategy, Component, ElementRef, type Signal, afterRenderEffect, inject, viewChild } from "@angular/core";

import { DialogComponent, DialogSize } from "@noldova/teamrun-shell-ui";

import { TabLabelService } from "../../services/tab-label.service";
import { ViewDialogService } from "../../services/view-dialog.service";
import { TabContentComponent } from "../tab-content/tab-content.component";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-view-dialog",
  imports: [DialogComponent, TabContentComponent],
  templateUrl: "./view-dialog.component.html",
  styleUrl: "./view-dialog.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewDialogComponent {
  private readonly checker: InteractivityChecker = inject(InteractivityChecker);
  private readonly content: Signal<TabContentComponent> = viewChild.required(TabContentComponent);
  private readonly contentElement: Signal<ElementRef<HTMLElement>> = viewChild.required(TabContentComponent, { read: ElementRef });

  protected readonly large: DialogSize = DialogSize.Large;
  protected readonly dialogs: ViewDialogService = inject(ViewDialogService);
  protected readonly labels: TabLabelService = inject(TabLabelService);

  public constructor() {
    afterRenderEffect(() => {
      if (this.content().isLoaded())
        [...this.contentElement().nativeElement.querySelectorAll<HTMLElement>(Resources.anyElementSelector)].find(t => this.checker.isFocusable(t) && this.checker.isTabbable(t))?.focus();
    });
  }
}
