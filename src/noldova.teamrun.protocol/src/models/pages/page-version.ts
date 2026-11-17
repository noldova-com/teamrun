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

import { PageAuthor } from "./page-author.js";
import { PageResources } from "./page-resources.js";

export class PageVersion {
  public readonly version: number;
  public readonly editedBy: PageAuthor;
  public readonly createdAt: string;

  public constructor(version: number, editedBy: PageAuthor, createdAt: string) {
    if (!Number.isInteger(version) || version < 1)
      throw new ArgumentOutOfRangeException(PageResources.versionField, version);
    ArgumentException.throwIfNullOrWhitespace(createdAt, PageResources.createdAtField);

    this.version = version;
    this.editedBy = editedBy;
    this.createdAt = createdAt;
  }

  public static fromJson(value: unknown, path?: string): PageVersion {
    const reader = JsonReader.fromValue(value, path);
    const editedBy = reader.readObject(PageResources.editedByField);
    return new PageVersion(reader.readInteger(PageResources.versionField), PageAuthor.fromJson(editedBy.toJson(), editedBy.path),
      reader.readNonBlankString(PageResources.createdAtField));
  }

  public toJson(): JsonObject {
    return { [PageResources.versionField]: this.version, [PageResources.editedByField]: this.editedBy.toJson(), [PageResources.createdAtField]: this.createdAt };
  }
}
