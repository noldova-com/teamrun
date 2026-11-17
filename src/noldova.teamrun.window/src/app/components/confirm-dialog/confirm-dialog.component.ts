/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type InputSignal, type OutputEmitterRef, input, output } from "@angular/core";

import { ButtonComponent, ButtonVariant, DialogComponent, DialogDescriptionDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import type { ConfirmRequest } from "../../models/confirm-request";

@Component({
  selector: "nol-teamrun-confirm-dialog",
  imports: [ButtonComponent, DialogComponent, DialogDescriptionDirective],
  templateUrl: "./confirm-dialog.component.html"
})
export class ConfirmDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;

  public readonly request: InputSignal<ConfirmRequest> = input.required<ConfirmRequest>();
  public readonly answered: OutputEmitterRef<boolean> = output<boolean>();
  public readonly other: OutputEmitterRef<void> = output<void>();
}
