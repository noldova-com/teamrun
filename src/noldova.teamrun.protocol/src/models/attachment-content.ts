/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class AttachmentContent {
  public readonly name: string;
  public readonly mediaType: string;
  public readonly size: number;
  public readonly data: string;

  public constructor(name: string, mediaType: string, size: number, data: string) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);
    ArgumentException.throwIfNullOrWhitespace(mediaType, Resources.mediaTypeField);
    if (!Number.isSafeInteger(size) || size < 0)
      throw new ArgumentOutOfRangeException(Resources.sizeField, size);

    this.name = name;
    this.mediaType = mediaType;
    this.size = size;
    this.data = data;
  }

  public static fromJson(value: unknown, path?: string): AttachmentContent {
    const reader = JsonReader.fromValue(value, path);
    return new AttachmentContent(reader.readNonBlankString(Resources.nameField), reader.readNonBlankString(Resources.mediaTypeField),
      reader.readInteger(Resources.sizeField), reader.readString(Resources.dataField));
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name, [Resources.mediaTypeField]: this.mediaType, [Resources.sizeField]: this.size, [Resources.dataField]: this.data };
  }
}
