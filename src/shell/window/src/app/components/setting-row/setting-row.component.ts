/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, type WritableSignal, computed, input, output, signal } from "@angular/core";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { type SettingDefinition, SettingKind } from "@noldova/teamrun-shell-protocol";
import { ButtonComponent, ButtonVariant, CheckboxComponent, SelectComponent, SelectOption, TextFieldComponent, TooltipDirective } from "@noldova/teamrun-shell-ui";

import { Resources } from "../../../resources";
import { HighlightedTextComponent } from "../highlighted-text/highlighted-text.component";

@Component({
  selector: "tr-setting-row",
  imports: [ButtonComponent, CheckboxComponent, HighlightedTextComponent, SelectComponent, TextFieldComponent, TooltipDirective],
  templateUrl: "./setting-row.component.html",
  styleUrl: "./setting-row.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-setting-row",
    "[attr.data-setting]": "definition().name.text"
  }
})
export class SettingRowComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly kinds: typeof SettingKind = SettingKind;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly error: WritableSignal<string | null> = signal(null);

  public readonly definition = input.required<SettingDefinition>();
  public readonly value = input<JsonValue | undefined>(undefined);
  public readonly isSet = input<boolean>(false);
  public readonly query = input<string>("");
  public readonly modules = input<readonly SelectOption[]>([]);
  public readonly isInverse = input<boolean>(false);
  public readonly changed = output<JsonValue>();
  public readonly reset = output<void>();

  protected readonly current: Signal<JsonValue> = computed(() => this.value() ?? this.definition().defaultValue);
  protected readonly options: Signal<readonly SelectOption[]> = computed(() => this.definition().type.options.map(t => new SelectOption(t.value, t.title)));
  protected readonly chosenModules: Signal<ReadonlySet<string>> = computed(() => {
    const value = this.current();
    return new Set(Array.isArray(value) ? value.filter((t): t is string => typeof t === "string") : []);
  });

  protected choose(value: JsonValue): void {
    this.error.set(null);
    this.changed.emit(value);
  }

  protected commitNumber(event: Event): void {
    const field = event.target as HTMLInputElement;
    const value = field.valueAsNumber;
    const type = this.definition().type;
    if (!Number.isNaN(value) && type.accepts(value)) {
      this.choose(value);
      return;
    }
    this.error.set(Resources.formatNumberRange(type.minimum, type.maximum, type.step));
    field.value = String(this.current());
  }

  protected commitText(event: Event): void {
    this.choose((event.target as HTMLInputElement).value);
  }

  protected toggleModule(id: string, isChecked: boolean): void {
    const isChosen = isChecked !== this.isInverse();
    const chosen = new Set(this.chosenModules());
    if (isChosen)
      chosen.add(id);
    else
      chosen.delete(id);
    this.choose(this.modules().map(t => t.value).filter(t => chosen.has(t)));
  }

  protected asString(value: JsonValue): string {
    return String(value);
  }
}
