/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class ComposerDefaultSaveParams {
  public readonly choice: JsonObject;
  public readonly onlyIfNone: boolean;

  public constructor(choice: JsonObject, onlyIfNone: boolean = false) {
    this.choice = choice;
    this.onlyIfNone = onlyIfNone;
  }

  public static fromJson(value: unknown, path?: string): ComposerDefaultSaveParams {
    const reader = JsonReader.fromValue(value, path);
    return new ComposerDefaultSaveParams(reader.readObject(Resources.choiceField).toJson(),
      reader.hasField(Resources.onlyIfNoneField) ? reader.readBoolean(Resources.onlyIfNoneField) : false);
  }

  public toJson(): JsonObject {
    return {
      [Resources.choiceField]: this.choice,
      [Resources.onlyIfNoneField]: this.onlyIfNone
    };
  }
}
