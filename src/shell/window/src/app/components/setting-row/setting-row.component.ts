/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, type WritableSignal, computed, input, linkedSignal, output } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { type SettingDefinition, SettingKind } from "@noldova/teamrun-shell-protocol";
import { ButtonComponent, ButtonVariant, CheckboxComponent, ChoicePillsComponent, FieldMessageComponent, SelectComponent, SelectOption, TextFieldComponent, TooltipDirective } from "@noldova/teamrun-shell-ui";

import { Resources } from "../../../resources";
import { HighlightedTextComponent } from "../highlighted-text/highlighted-text.component";

@Component({
  selector: "tr-setting-row",
  imports: [ButtonComponent, CheckboxComponent, ChoicePillsComponent, FieldMessageComponent, HighlightedTextComponent, SelectComponent, TextFieldComponent, TooltipDirective],
  templateUrl: "./setting-row.component.html",
  styleUrl: "./setting-row.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-setting-row",
    "[attr.data-setting]": "definition().name.text"
  }
})
export class SettingRowComponent {
  private static count: number = 0;

  private readonly index: number = SettingRowComponent.count++;

  protected readonly resources: typeof Resources = Resources;
  protected readonly errorId: string = `${Resources.settingErrorIdPrefix}${this.index}`;
  protected readonly descriptionId: string = `${Resources.settingDescriptionIdPrefix}${this.index}`;
  protected readonly kinds: typeof SettingKind = SettingKind;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;

  public readonly definition = input.required<SettingDefinition>();
  public readonly value = input<JsonValue | undefined>(undefined);
  public readonly isSet = input<boolean>(false);
  public readonly query = input<string>("");
  public readonly modules = input<readonly SelectOption[]>([]);
  public readonly languages = input<readonly SelectOption[]>([]);
  public readonly languagesNote = input<string | null>(null);
  public readonly isInverse = input<boolean>(false);
  public readonly canRun = input<boolean>(false);
  public readonly changed = output<JsonValue>();
  public readonly reset = output<void>();
  public readonly run = output<void>();

  protected readonly current: Signal<JsonValue> = computed(() => this.value() ?? this.definition().defaultValue);
  protected readonly error: WritableSignal<string | null> = linkedSignal<JsonValue, string | null>({ source: this.current, computation: () => null });
  protected readonly describedBy: Signal<string> = computed(() => Object.isNull(this.error()) ? this.descriptionId : `${this.descriptionId} ${this.errorId}`);
  protected readonly options: Signal<readonly SelectOption[]> = computed(() => this.definition().type.options.map(t => new SelectOption(t.value, t.title)));
  protected readonly isFew: Signal<boolean> = computed(() => this.options().length >= Resources.choicePillMinimum && this.options().length <= Resources.choicePillLimit);
  protected readonly chosen: Signal<ReadonlySet<string>> = computed(() => {
    const value = this.current();
    return new Set(Array.isArray(value) ? value.filter((t): t is string => typeof t === "string") : []);
  });

  protected choose(value: JsonValue): void {
    this.error.set(null);
    this.changed.emit(value);
  }

  protected commitNumber(event: Event): void {
    if (!(event.target instanceof HTMLInputElement))
      return;
    const value = event.target.valueAsNumber;
    const type = this.definition().type;
    if (!Number.isNaN(value) && type.accepts(value)) {
      this.choose(value);
      return;
    }
    this.error.set(Resources.formatNumberRange(type.minimum, type.maximum, type.step));
  }

  protected revertNumber(event: Event): void {
    if (!(event.target instanceof HTMLInputElement))
      return;
    if (Object.isNull(this.error()) && event.target.valueAsNumber === this.current())
      return;
    event.stopPropagation();
    event.target.value = String(this.current());
    this.error.set(null);
  }

  protected commitText(event: Event): void {
    if (event.target instanceof HTMLInputElement)
      this.choose(event.target.value);
  }

  protected toggleModule(id: string, isChecked: boolean): void {
    const isChosen = isChecked !== this.isInverse();
    const chosen = new Set(this.chosen());
    if (isChosen)
      chosen.add(id);
    else
      chosen.delete(id);
    this.choose(this.modules().map(t => t.value).filter(t => chosen.has(t)));
  }

  protected toggleLanguage(tag: string, isChecked: boolean): void {
    const chosen = new Set(this.chosen());
    if (isChecked)
      chosen.add(tag);
    else
      chosen.delete(tag);
    this.choose(this.languages().map(t => t.value).filter(t => chosen.has(t)));
  }

  protected asString(value: JsonValue): string {
    return String(value);
  }
}
