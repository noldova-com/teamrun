/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class AttachmentInput {
  public readonly name: string;
  public readonly mediaType: string;
  public readonly data: string | null;
  public readonly path: string | null;

  public constructor(name: string, mediaType: string, data: string | null, path: string | null) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);
    ArgumentException.throwIfNullOrWhitespace(mediaType, Resources.mediaTypeField);
    if (Object.isNull(data) === Object.isNull(path))
      throw new ArgumentException(Resources.attachmentSourceRequired, Resources.attachmentsField);
    if (!Object.isNull(path))
      ArgumentException.throwIfNullOrWhitespace(path, Resources.pathField);

    this.name = name;
    this.mediaType = mediaType;
    this.data = data;
    this.path = path;
  }

  public static fromJson(value: unknown, path?: string): AttachmentInput {
    const reader = JsonReader.fromValue(value, path);
    return new AttachmentInput(reader.readNonBlankString(Resources.nameField), reader.readNonBlankString(Resources.mediaTypeField),
      reader.readNullableString(Resources.dataField), reader.readNullableString(Resources.pathField));
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name, [Resources.mediaTypeField]: this.mediaType, [Resources.dataField]: this.data, [Resources.pathField]: this.path };
  }
}
