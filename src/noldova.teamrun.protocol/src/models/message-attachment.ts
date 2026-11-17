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

export class MessageAttachment {
  public readonly name: string;
  public readonly mediaType: string;
  public readonly size: number;
  public readonly path: string;
  public readonly width: number | null;
  public readonly height: number | null;

  public constructor(name: string, mediaType: string, size: number, path: string, width: number | null = null, height: number | null = null) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);
    ArgumentException.throwIfNullOrWhitespace(mediaType, Resources.mediaTypeField);
    ArgumentException.throwIfNullOrWhitespace(path, Resources.pathField);
    if (!Number.isSafeInteger(size) || size < 0)
      throw new ArgumentOutOfRangeException(Resources.sizeField, size);
    if (Object.isNull(width) !== Object.isNull(height) || [width, height].some(t => !Object.isNull(t) && (!Number.isSafeInteger(t) || t < 1)))
      throw new ArgumentException(Resources.attachmentImageSizeInvalid, Resources.widthField);

    this.name = name;
    this.mediaType = mediaType;
    this.size = size;
    this.path = path;
    this.width = width;
    this.height = height;
  }

  public get isImage(): boolean {
    return Resources.attachmentImageMediaTypes.includes(this.mediaType);
  }

  public static fromJson(value: unknown, path?: string): MessageAttachment {
    const reader = JsonReader.fromValue(value, path);
    return new MessageAttachment(reader.readNonBlankString(Resources.nameField), reader.readNonBlankString(Resources.mediaTypeField),
      reader.readInteger(Resources.sizeField), reader.readNonBlankString(Resources.pathField),
      reader.hasField(Resources.widthField) ? reader.readNullableInteger(Resources.widthField) : null,
      reader.hasField(Resources.heightField) ? reader.readNullableInteger(Resources.heightField) : null);
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name, [Resources.mediaTypeField]: this.mediaType, [Resources.sizeField]: this.size, [Resources.pathField]: this.path,
      [Resources.widthField]: this.width, [Resources.heightField]: this.height };
  }
}
