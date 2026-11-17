/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class QuestionOption {
  public readonly label: string;
  public readonly description: string;

  public constructor(label: string, description: string) {
    ArgumentException.throwIfNullOrWhitespace(label, Resources.labelField);

    this.label = label;
    this.description = description;
  }

  public static fromJson(value: unknown, path?: string): QuestionOption {
    const reader = JsonReader.fromValue(value, path);
    return new QuestionOption(reader.readNonBlankString(Resources.labelField), reader.readString(Resources.descriptionField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.labelField]: this.label,
      [Resources.descriptionField]: this.description
    };
  }
}
