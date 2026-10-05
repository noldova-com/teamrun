/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type WritableSignal, signal } from "@angular/core";

import { ButtonVariant } from "../../enums/button-variant";
import { ChipKind } from "../../enums/chip-kind";
import { SelectOption } from "../../models/select-option";
import { ButtonComponent } from "../button/button.component";
import { CheckboxComponent } from "../checkbox/checkbox.component";
import { IconButtonComponent } from "../icon-button/icon-button.component";
import { ChipComponent } from "../chip/chip.component";
import { ChoicePillsComponent } from "../choice-pills/choice-pills.component";
import { ProgressComponent } from "../progress/progress.component";
import { SelectComponent } from "../select/select.component";
import { SpinnerComponent } from "../spinner/spinner.component";
import { TextFieldComponent } from "../text-field/text-field.component";
import { TooltipDirective } from "../tooltip/tooltip.directive";
import { GalleryResources } from "./gallery-resources";
import { GallerySpecimenComponent } from "./gallery-specimen.component";

@Component({
  selector: "tr-gallery-forms",
  imports: [ButtonComponent, CheckboxComponent, ChipComponent, ChoicePillsComponent, GallerySpecimenComponent, IconButtonComponent, ProgressComponent, SelectComponent, SpinnerComponent, TextFieldComponent, TooltipDirective],
  templateUrl: "./gallery-forms.component.html",
  styleUrl: "./gallery-forms.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryFormsComponent {
  protected readonly text: typeof GalleryResources.text = GalleryResources.text;
  protected readonly variants: typeof ButtonVariant = ButtonVariant;
  protected readonly options: readonly SelectOption[] = GalleryResources.text.selectOptions.map(t => new SelectOption(t.value, t.title));
  protected readonly pillOptions: readonly SelectOption[] = GalleryResources.text.choicePillOptions.map(t => new SelectOption(t.value, t.title));
  protected readonly longPillOptions: readonly SelectOption[] = GalleryResources.text.choicePillOptionsLong.map(t => new SelectOption(t.value, t.title));
  protected readonly chipKinds: typeof ChipKind = ChipKind;
  protected readonly pill: WritableSignal<string> = signal(GalleryResources.text.choicePillInitial);
  protected readonly choice: WritableSignal<string> = signal(GalleryResources.text.selectInitial);
  protected readonly isChecked: WritableSignal<boolean> = signal(true);
  protected readonly isPressed: WritableSignal<boolean> = signal(true);
}
