/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class ContextUsage {
  public readonly usedTokens: number;
  public readonly windowTokens: number;
  public readonly compactAtTokens: number | null;

  public constructor(usedTokens: number, windowTokens: number, compactAtTokens: number | null) {
    ContextUsage.throwIfNotCount(usedTokens, Resources.usedTokensField);
    if (!Number.isSafeInteger(windowTokens) || windowTokens <= 0)
      throw new ArgumentException(Resources.contextWindowInvalid, Resources.windowTokensField);
    if (!Object.isNull(compactAtTokens) && (!Number.isSafeInteger(compactAtTokens) || compactAtTokens <= 0))
      throw new ArgumentException(Resources.contextWindowInvalid, Resources.compactAtTokensField);

    this.usedTokens = usedTokens;
    this.windowTokens = windowTokens;
    this.compactAtTokens = compactAtTokens;
  }

  public static fromJson(value: unknown, path?: string): ContextUsage {
    const reader = JsonReader.fromValue(value, path);
    return new ContextUsage(reader.readInteger(Resources.usedTokensField), reader.readInteger(Resources.windowTokensField),
      reader.readNullableInteger(Resources.compactAtTokensField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.usedTokensField]: this.usedTokens,
      [Resources.windowTokensField]: this.windowTokens,
      [Resources.compactAtTokensField]: this.compactAtTokens
    };
  }

  public static throwIfNotCount(value: number, name: string): void {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new ArgumentException(Resources.usageFigureNegative, name);
  }
}
