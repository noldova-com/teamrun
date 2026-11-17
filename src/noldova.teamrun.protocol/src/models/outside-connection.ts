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

export class OutsideConnection {
  public readonly enabled: boolean;
  public readonly url: string;
  public readonly token: string | null;
  public readonly failure: string | null;
  public readonly note: string | null;

  public constructor(enabled: boolean, url: string, token: string | null, failure: string | null, note: string | null) {
    ArgumentException.throwIfNullOrWhitespace(url, Resources.urlField);
    if (!Object.isNull(token))
      ArgumentException.throwIfNullOrWhitespace(token, Resources.tokenField);
    if (!Object.isNull(failure))
      ArgumentException.throwIfNullOrWhitespace(failure, Resources.failureField);
    if (!Object.isNull(note))
      ArgumentException.throwIfNullOrWhitespace(note, Resources.noteField);

    this.enabled = enabled;
    this.url = url;
    this.token = token;
    this.failure = failure;
    this.note = note;
  }

  public static fromJson(value: unknown, path?: string): OutsideConnection {
    const reader = JsonReader.fromValue(value, path);
    return new OutsideConnection(reader.readBoolean(Resources.enabledField), reader.readNonBlankString(Resources.urlField),
      Object.isNull(reader.readNullableString(Resources.tokenField)) ? null : reader.readNonBlankString(Resources.tokenField),
      Object.isNull(reader.readNullableString(Resources.failureField)) ? null : reader.readNonBlankString(Resources.failureField),
      Object.isNull(reader.readNullableString(Resources.noteField)) ? null : reader.readNonBlankString(Resources.noteField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.enabledField]: this.enabled,
      [Resources.urlField]: this.url,
      [Resources.tokenField]: this.token,
      [Resources.failureField]: this.failure,
      [Resources.noteField]: this.note
    };
  }
}
