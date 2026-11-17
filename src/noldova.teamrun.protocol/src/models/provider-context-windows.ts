/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class ProviderContextWindows {
  public readonly presets: readonly number[];
  public readonly minimum: number;
  public readonly maximum: number;
  public readonly reported: boolean;

  public constructor(presets: readonly number[], minimum: number, maximum: number, reported: boolean) {
    if (![minimum, maximum, ...presets].every(t => ProviderContextWindows.isSize(t)) || maximum < minimum || new Set(presets).size !== presets.length
      || presets.some(t => t < minimum || t > maximum))
      throw new ArgumentException(Resources.contextWindowsInvalid, Resources.contextWindowsField);

    this.presets = [...presets];
    this.minimum = minimum;
    this.maximum = maximum;
    this.reported = reported;
  }

  public static fromJson(value: unknown, path?: string): ProviderContextWindows {
    const reader = JsonReader.fromValue(value, path);
    const presets = reader.readValue(Resources.presetsField);
    if (!Array.isArray(presets) || !presets.every(t => typeof t === "number"))
      throw new JsonException(Resources.contextWindowsInvalid, `${reader.path}.${Resources.presetsField}`);
    return new ProviderContextWindows(presets as number[], reader.readInteger(Resources.minimumField), reader.readInteger(Resources.maximumField),
      reader.readBoolean(Resources.reportedField));
  }

  public static isSize(tokens: number): boolean {
    return Number.isSafeInteger(tokens) && tokens > 0;
  }

  public static nameOf(tokens: number): string {
    return tokens % Resources.millionTokens === 0 ? Resources.formatMillionTokens(tokens / Resources.millionTokens)
      : Resources.formatThousandTokens(tokens / Resources.thousandTokens);
  }

  public static parse(text: string): number | null {
    const match = Resources.contextWindowSizePattern.exec(text.trim());
    if (Object.isNull(match))
      return null;
    const unit = match[2]!.toUpperCase();
    const scale = unit === Resources.millionUnit ? Resources.millionTokens : unit === Resources.thousandUnit ? Resources.thousandTokens : 1;
    const tokens = Math.round(Number(match[1]) * scale);
    return ProviderContextWindows.isSize(tokens) ? tokens : null;
  }

  public allows(tokens: number): boolean {
    return ProviderContextWindows.isSize(tokens) && tokens >= this.minimum && tokens <= this.maximum;
  }

  public toJson(): JsonObject {
    return {
      [Resources.presetsField]: [...this.presets],
      [Resources.minimumField]: this.minimum,
      [Resources.maximumField]: this.maximum,
      [Resources.reportedField]: this.reported
    };
  }
}
