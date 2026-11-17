/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type InputSignal, type OutputEmitterRef, type WritableSignal, input, linkedSignal, output } from "@angular/core";

import "@noldova/context.core";
import { ButtonComponent, ButtonVariant, DialogComponent, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";

@Component({
  selector: "nol-teamrun-rename-dialog",
  imports: [ButtonComponent, DialogComponent, TextFieldComponent],
  templateUrl: "./rename-dialog.component.html",
  styleUrl: "../settings-dialog.css"
})
export class RenameDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;

  public readonly initialTitle: InputSignal<string> = input.required<string>();
  public readonly answered: OutputEmitterRef<string | null> = output<string | null>();

  protected readonly title: WritableSignal<string> = linkedSignal(() => this.initialTitle());

  protected canSave(): boolean {
    return !String.isNullOrWhitespace(this.title());
  }

  protected edit(event: globalThis.Event): void {
    if (!(event.target instanceof HTMLInputElement))
      return;
    this.title.set(event.target.value);
  }

  protected save(event: globalThis.Event): void {
    event.preventDefault();
    if (this.canSave())
      this.answered.emit(this.title().trim());
  }
}
