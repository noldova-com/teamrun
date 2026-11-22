/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, type InputSignal, type OutputEmitterRef, type Signal, type WritableSignal, input, linkedSignal, output } from "@angular/core";

import "@noldova/context.core";
import { ButtonComponent, ButtonVariant, DialogComponent, FieldMessageComponent, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";

@Component({
  selector: "nol-teamrun-rename-dialog",
  imports: [ButtonComponent, DialogComponent, FieldMessageComponent, TextFieldComponent],
  templateUrl: "./rename-dialog.component.html",
  styleUrl: "../settings-dialog.css"
})
export class RenameDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly messageId: string = "nol-teamrun-rename-message";

  public readonly initialTitle: InputSignal<string> = input.required<string>();
  public readonly heading: InputSignal<string> = input<string>(Resources.renameTitle);
  public readonly fieldLabel: InputSignal<string> = input<string>(Resources.renameFieldLabel);
  public readonly maxLength: InputSignal<number | null> = input<number | null>(null);
  public readonly oneLine: InputSignal<boolean> = input<boolean>(false);
  public readonly answered: OutputEmitterRef<string | null> = output<string | null>();

  protected readonly title: WritableSignal<string> = linkedSignal(() => this.initialTitle());
  protected readonly refusal: Signal<string | null> = computed(() => {
    const limit = this.maxLength();
    if (this.oneLine() && Resources.controlCharacterPattern.test(this.title()))
      return Resources.nameHasControlCharacter;
    return Object.isNull(limit) || [...this.title().trim()].length <= limit ? null : Resources.formatNameTooLong(limit);
  });

  protected canSave(): boolean {
    return !String.isNullOrWhitespace(this.title()) && Object.isNull(this.refusal());
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
