/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { type JsonObject, JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources";

export class FieldMenuRequest {
  public readonly x: number;
  public readonly y: number;
  public readonly isKeyboard: boolean;
  public readonly word: string;
  public readonly suggestions: readonly string[];

  public constructor(x: number, y: number, isKeyboard: boolean, word: string, suggestions: readonly string[]) {
    this.x = x;
    this.y = y;
    this.isKeyboard = isKeyboard;
    this.word = word;
    this.suggestions = suggestions;
  }

  public static fromJson(value: unknown): FieldMenuRequest {
    const json = JsonReader.fromValue(value);
    return new FieldMenuRequest(json.readNumber(Resources.xField), json.readNumber(Resources.yField), json.readBoolean(Resources.isKeyboardField),
      json.readString(Resources.wordArgument), json.readStringArray(Resources.suggestionsArgument));
  }

  public toContext(): JsonObject {
    return { [Resources.wordArgument]: this.word, [Resources.suggestionsArgument]: [...this.suggestions] };
  }
}
