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

export class AttachmentInput {
  public readonly name: string;
  public readonly mediaType: string;
  public readonly data: string | null;
  public readonly path: string | null;
  public readonly grant: string | null;

  public constructor(name: string, mediaType: string, data: string | null, path: string | null, grant: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);
    ArgumentException.throwIfNullOrWhitespace(mediaType, Resources.mediaTypeField);
    if ([data, path, grant].filter(t => !Object.isNull(t)).length !== 1)
      throw new ArgumentException(Resources.attachmentSourceRequired, Resources.attachmentsField);
    if (!Object.isNull(path))
      ArgumentException.throwIfNullOrWhitespace(path, Resources.pathField);
    if (!Object.isNull(grant))
      ArgumentException.throwIfNullOrWhitespace(grant, Resources.grantField);

    this.name = name;
    this.mediaType = mediaType;
    this.data = data;
    this.path = path;
    this.grant = grant;
  }

  public static fromJson(value: unknown, path?: string): AttachmentInput {
    const reader = JsonReader.fromValue(value, path);
    return new AttachmentInput(reader.readNonBlankString(Resources.nameField), reader.readNonBlankString(Resources.mediaTypeField),
      reader.readNullableString(Resources.dataField), reader.readNullableString(Resources.pathField),
      reader.hasField(Resources.grantField) ? reader.readNullableString(Resources.grantField) : null);
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name, [Resources.mediaTypeField]: this.mediaType, [Resources.dataField]: this.data, [Resources.pathField]: this.path,
      ...(Object.isNull(this.grant) ? {} : { [Resources.grantField]: this.grant }) };
  }
}
