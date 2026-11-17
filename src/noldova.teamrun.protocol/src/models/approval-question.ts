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
import { QuestionOption } from "./question-option.js";

export class ApprovalQuestion {
  public readonly id: string;
  public readonly header: string;
  public readonly text: string;
  public readonly options: readonly QuestionOption[];
  public readonly multiple: boolean;
  public readonly other: boolean;
  public readonly secret: boolean;

  public constructor(id: string, header: string, text: string, options: readonly QuestionOption[], multiple: boolean, other: boolean, secret: boolean) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(text, Resources.textField);
    if (new Set(options.map(t => t.label)).size !== options.length)
      throw new ArgumentException(Resources.questionOptionRepeated, Resources.optionsField);
    if (options.length === 0 && !other)
      throw new ArgumentException(Resources.questionWithoutAnswer, Resources.optionsField);

    this.id = id;
    this.header = header;
    this.text = text;
    this.options = [...options];
    this.multiple = multiple;
    this.other = other;
    this.secret = secret;
  }

  public static fromJson(value: unknown, path?: string): ApprovalQuestion {
    const reader = JsonReader.fromValue(value, path);
    return new ApprovalQuestion(
      reader.readNonBlankString(Resources.idField),
      reader.readString(Resources.headerField),
      reader.readNonBlankString(Resources.textField),
      reader.readObjectArray(Resources.optionsField).map(t => QuestionOption.fromJson(t.toJson(), t.path)),
      reader.readBoolean(Resources.multipleField),
      reader.readBoolean(Resources.otherField),
      reader.readBoolean(Resources.secretField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.headerField]: this.header,
      [Resources.textField]: this.text,
      [Resources.optionsField]: this.options.map(t => t.toJson()),
      [Resources.multipleField]: this.multiple,
      [Resources.otherField]: this.other,
      [Resources.secretField]: this.secret
    };
  }
}
