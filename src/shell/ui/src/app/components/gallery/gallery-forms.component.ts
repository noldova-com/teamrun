/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, type WritableSignal, signal } from "@angular/core";

import { ButtonVariant } from "../../enums/button-variant";
import { ChipKind } from "../../enums/chip-kind";
import { GallerySize } from "../../enums/gallery-size";
import { SelectOption } from "../../models/select-option";
import { ButtonComponent } from "../button/button.component";
import { CheckboxComponent } from "../checkbox/checkbox.component";
import { IconButtonComponent } from "../icon-button/icon-button.component";
import { ChipComponent } from "../chip/chip.component";
import { ChoicePillsComponent } from "../choice-pills/choice-pills.component";
import { ConfigurationTableActionDirective } from "../configuration-table/configuration-table-action.directive";
import { ConfigurationTableFillDirective } from "../configuration-table/configuration-table-fill.directive";
import { ConfigurationTableComponent } from "../configuration-table/configuration-table.component";
import { ConfigurationTableDirective } from "../configuration-table/configuration-table.directive";
import { FieldMessageComponent } from "../field-message/field-message.component";
import { ProgressComponent } from "../progress/progress.component";
import { SelectComponent } from "../select/select.component";
import { SpinnerComponent } from "../spinner/spinner.component";
import { TextFieldComponent } from "../text-field/text-field.component";
import { TooltipDirective } from "../tooltip/tooltip.directive";
import { GalleryCellComponent } from "./gallery-cell.component";
import { GalleryResources } from "./gallery-resources";
import { GallerySpecimenComponent } from "./gallery-specimen.component";
import { GalleryStateDirective } from "./gallery-state.directive";

@Component({
  selector: "tr-gallery-forms",
  imports: [ButtonComponent, CheckboxComponent, ChipComponent, ChoicePillsComponent, ConfigurationTableActionDirective, ConfigurationTableComponent, ConfigurationTableDirective, ConfigurationTableFillDirective, FieldMessageComponent, GalleryCellComponent, GallerySpecimenComponent, GalleryStateDirective, IconButtonComponent, NgTemplateOutlet, ProgressComponent, SelectComponent, SpinnerComponent, TextFieldComponent, TooltipDirective],
  templateUrl: "./gallery-forms.component.html",
  styleUrl: "./gallery-forms.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryFormsComponent {
  private static count: number = 0;

  protected readonly messageId: string = `${GalleryResources.fieldMessageIdPrefix}${GalleryFormsComponent.count++}`;
  protected readonly text: typeof GalleryResources.text = GalleryResources.text;
  protected readonly sizes: typeof GallerySize = GallerySize;
  protected readonly hoveredPill: string = GalleryResources.hoveredPill;
  protected readonly focusedPill: string = GalleryResources.focusedPill;
  protected readonly focusedCheckbox: string = GalleryResources.focusedCheckbox;
  protected readonly focusedSelect: string = GalleryResources.focusedSelect;
  protected readonly variants: typeof ButtonVariant = ButtonVariant;
  protected readonly options: readonly SelectOption[] = GalleryResources.text.selectOptions.map(t => new SelectOption(t.value, t.title));
  protected readonly pillOptions: readonly SelectOption[] = GalleryResources.text.choicePillOptions.map(t => new SelectOption(t.value, t.title));
  protected readonly longPillOptions: readonly SelectOption[] = GalleryResources.text.choicePillOptionsLong.map(t => new SelectOption(t.value, t.title));
  protected readonly wideTable: typeof GalleryResources.text.configurationWideTable = GalleryResources.text.configurationWideTable;
  protected readonly narrowTable: typeof GalleryResources.text.configurationNarrowTable = GalleryResources.text.configurationNarrowTable;
  protected readonly unheadedTable: typeof GalleryResources.text.configurationUnheadedTable = GalleryResources.text.configurationUnheadedTable;
  protected readonly chipKinds: typeof ChipKind = ChipKind;
  protected readonly pill: WritableSignal<string> = signal(GalleryResources.text.choicePillInitial);
  protected readonly choice: WritableSignal<string> = signal(GalleryResources.text.selectInitial);
  protected readonly isChecked: WritableSignal<boolean> = signal(true);
  protected readonly isPressed: WritableSignal<boolean> = signal(true);
}
