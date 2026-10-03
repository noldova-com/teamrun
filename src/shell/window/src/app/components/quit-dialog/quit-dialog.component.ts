/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, inject, viewChild } from "@angular/core";

import { ButtonComponent, ButtonVariant, DialogComponent } from "@noldova/teamrun-shell-ui";

import { QuitChoice } from "../../enums/quit-choice";
import { QuitService } from "../../services/quit.service";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-quit-dialog",
  imports: [DialogComponent, ButtonComponent],
  templateUrl: "./quit-dialog.component.html",
  styleUrl: "./quit-dialog.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuitDialogComponent {
  private readonly cancel = viewChild.required(Resources.cancelReference, { read: ElementRef<HTMLButtonElement> });
  private wasWaiting: boolean = false;

  protected readonly resources: typeof Resources = Resources;
  protected readonly choices: typeof QuitChoice = QuitChoice;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly quit: QuitService = inject(QuitService);

  public constructor() {
    afterRenderEffect(() => {
      const isWaiting = this.quit.question()?.isWaiting === true;
      if (isWaiting && !this.wasWaiting)
        this.cancel().nativeElement.focus();
      this.wasWaiting = isWaiting;
    });
  }
}
