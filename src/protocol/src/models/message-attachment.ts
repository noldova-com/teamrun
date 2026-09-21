/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class MessageAttachment {
  public readonly name: string;
  public readonly mediaType: string;
  public readonly size: number;
  public readonly path: string;

  public constructor(name: string, mediaType: string, size: number, path: string) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);
    ArgumentException.throwIfNullOrWhitespace(mediaType, Resources.mediaTypeField);
    ArgumentException.throwIfNullOrWhitespace(path, Resources.pathField);
    if (!Number.isSafeInteger(size) || size < 0)
      throw new ArgumentOutOfRangeException(Resources.sizeField, size);

    this.name = name;
    this.mediaType = mediaType;
    this.size = size;
    this.path = path;
  }

  public get isImage(): boolean {
    return Resources.attachmentImageMediaTypes.includes(this.mediaType);
  }

  public static fromJson(value: unknown, path?: string): MessageAttachment {
    const reader = JsonReader.fromValue(value, path);
    return new MessageAttachment(reader.readNonBlankString(Resources.nameField), reader.readNonBlankString(Resources.mediaTypeField),
      reader.readInteger(Resources.sizeField), reader.readNonBlankString(Resources.pathField));
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name, [Resources.mediaTypeField]: this.mediaType, [Resources.sizeField]: this.size, [Resources.pathField]: this.path };
  }
}
