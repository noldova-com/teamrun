/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";

import { DetailKind } from "../enums/detail-kind.js";
import { Resources } from "../resources.js";

export class MessageDetail {
  public readonly sequence: number;
  public readonly kind: DetailKind;
  public readonly text: string;
  public readonly payload: JsonValue;
  public readonly createdAt: string;

  public constructor(sequence: number, kind: DetailKind, text: string, payload: JsonValue, createdAt: string) {
    if (!Number.isInteger(sequence) || sequence < 0)
      throw new ArgumentOutOfRangeException(Resources.sequenceField, sequence);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);

    this.sequence = sequence;
    this.kind = kind;
    this.text = text;
    this.payload = payload;
    this.createdAt = createdAt;
  }

  public static fromJson(value: unknown, path?: string): MessageDetail {
    const reader = JsonReader.fromValue(value, path);
    return new MessageDetail(
      reader.readInteger(Resources.sequenceField),
      reader.readOneOf(Resources.kindField, Object.values(DetailKind)),
      reader.readString(Resources.textField),
      reader.readValue(Resources.payloadField),
      reader.readNonBlankString(Resources.createdAtField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.sequenceField]: this.sequence,
      [Resources.kindField]: this.kind,
      [Resources.textField]: this.text,
      [Resources.payloadField]: this.payload,
      [Resources.createdAtField]: this.createdAt
    };
  }
}
