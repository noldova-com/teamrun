/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";

import { SettingKind } from "../enums/setting-kind.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { KeyChord } from "./key-chord.js";
import { QualifiedName } from "./qualified-name.js";
import { SettingOption } from "./setting-option.js";

export class SettingType {
  private static readonly KIND_FIELDS: Readonly<Record<SettingKind, readonly string[]>> = {
    [SettingKind.Boolean]: [],
    [SettingKind.Choice]: [Resources.optionsField],
    [SettingKind.Number]: [Resources.minimumField, Resources.maximumField, Resources.stepField],
    [SettingKind.Text]: [Resources.maxLengthField],
    [SettingKind.Modules]: [],
    [SettingKind.KeyBindings]: [],
    [SettingKind.Action]: [Resources.commandField, Resources.labelField]
  };

  public readonly kind: SettingKind;
  public readonly options: readonly SettingOption[];
  public readonly minimum: number | null;
  public readonly maximum: number | null;
  public readonly step: number | null;
  public readonly maxLength: number | null;
  public readonly command: QualifiedName | null;
  public readonly label: string | null;

  private constructor(
    kind: SettingKind,
    options: readonly SettingOption[],
    minimum: number | null,
    maximum: number | null,
    step: number | null,
    maxLength: number | null,
    command: QualifiedName | null = null,
    label: string | null = null) {
    this.kind = kind;
    this.options = options;
    this.minimum = minimum;
    this.maximum = maximum;
    this.step = step;
    this.maxLength = maxLength;
    this.command = command;
    this.label = label;
  }

  public static boolean(): SettingType {
    return new SettingType(SettingKind.Boolean, [], null, null, null, null);
  }

  public static choice(options: readonly SettingOption[]): SettingType {
    if (options.length === 0 || new Set(options.map(t => t.value)).size !== options.length)
      throw new ArgumentException(Resources.settingOptionsInvalid, Resources.optionsField);
    return new SettingType(SettingKind.Choice, [...options], null, null, null, null);
  }

  public static number(minimum: number, maximum: number, step: number): SettingType {
    if (![minimum, maximum, step].every(t => Number.isFinite(t)) || minimum > maximum || step <= 0)
      throw new ArgumentException(Resources.settingRangeInvalid, Resources.minimumField);
    return new SettingType(SettingKind.Number, [], minimum, maximum, step, null);
  }

  public static text(maxLength: number): SettingType {
    if (!Number.isInteger(maxLength) || maxLength <= 0)
      throw new ArgumentException(Resources.settingMaxLengthInvalid, Resources.maxLengthField);
    return new SettingType(SettingKind.Text, [], null, null, null, maxLength);
  }

  public static modules(): SettingType {
    return new SettingType(SettingKind.Modules, [], null, null, null, null);
  }

  public static keyBindings(): SettingType {
    return new SettingType(SettingKind.KeyBindings, [], null, null, null, null);
  }

  public static action(command: QualifiedName, label: string): SettingType {
    if (String.isNullOrWhitespace(label))
      throw new ArgumentException(Resources.settingLabelInvalid, Resources.labelField);
    return new SettingType(SettingKind.Action, [], null, null, null, null, command, label);
  }

  public static fromJson(value: unknown, path?: string): SettingType {
    const reader = JsonReader.fromValue(value, path);
    const kind = reader.readOneOf(Resources.kindField, Object.values(SettingKind));
    WireContract.requireKnownFields(reader, [Resources.kindField, ...SettingType.KIND_FIELDS[kind]]);
    return WireContract.create(reader, () => {
      switch (kind) {
        case SettingKind.Choice:
          return SettingType.choice(reader.readObjectArray(Resources.optionsField).map(t => SettingOption.fromJson(t.toJson(), t.path)));
        case SettingKind.Number:
          return SettingType.number(reader.readNumber(Resources.minimumField), reader.readNumber(Resources.maximumField), reader.readNumber(Resources.stepField));
        case SettingKind.Text:
          return SettingType.text(reader.readInteger(Resources.maxLengthField));
        case SettingKind.Modules:
          return SettingType.modules();
        case SettingKind.KeyBindings:
          return SettingType.keyBindings();
        case SettingKind.Action:
          return SettingType.action(QualifiedName.parse(reader.readString(Resources.commandField), Resources.commandField), reader.readString(Resources.labelField));
        default:
          return SettingType.boolean();
      }
    });
  }

  public accepts(value: JsonValue): boolean {
    switch (this.kind) {
      case SettingKind.Boolean:
        return Object.isBoolean(value);
      case SettingKind.Choice:
        return Object.isString(value) && this.options.some(t => t.value === value);
      case SettingKind.Number:
        return Object.isNumber(value) && this.isInRange(value);
      case SettingKind.Text:
        return Object.isString(value) && value.length <= Number(this.maxLength);
      case SettingKind.Modules:
        return Array.isArray(value) && value.every(t => Object.isString(t) && !String.isNullOrWhitespace(t)) && new Set(value).size === value.length;
      case SettingKind.Action:
        return Object.isNull(value);
      default:
        return Object.isObject(value) && !Array.isArray(value) && Object.entries(value).every(([name, key]) => SettingType.isBinding(name, key));
    }
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      ...this.kind === SettingKind.Choice ? { [Resources.optionsField]: this.options.map(t => t.toJson()) } : {},
      ...this.kind === SettingKind.Number ? { [Resources.minimumField]: this.minimum, [Resources.maximumField]: this.maximum, [Resources.stepField]: this.step } : {},
      ...this.kind === SettingKind.Text ? { [Resources.maxLengthField]: this.maxLength } : {},
      ...this.kind === SettingKind.Action ? { [Resources.commandField]: String(this.command), [Resources.labelField]: this.label } : {}
    };
  }

  private static isBinding(name: string, key: JsonValue): boolean {
    const command = QualifiedName.find(name);
    return !Object.isNull(command) && (Object.isNull(key) || (Object.isString(key) && KeyChord.find(key)?.canBind(command) === true));
  }

  private isInRange(value: number): boolean {
    const minimum = Number(this.minimum);
    const steps = (value - minimum) / Number(this.step);
    return value >= minimum && value <= Number(this.maximum) && Math.abs(steps - Math.round(steps)) < Resources.stepTolerance;
  }
}
