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

import { PageKind } from "../../enums/pages/page-kind.js";
import { PageResources } from "./page-resources.js";
import { PageAuthor } from "./page-author.js";

export class Page {
  public readonly id: string;
  public readonly chatId: string;
  public readonly title: string;
  public readonly version: number;
  public readonly madeBy: PageAuthor;
  public readonly editedBy: PageAuthor;
  public readonly path: string;
  public readonly bytes: number;
  public readonly createdAt: string;
  public readonly updatedAt: string;
  public readonly kind: PageKind;

  public constructor(id: string, chatId: string, title: string, version: number, madeBy: PageAuthor, editedBy: PageAuthor, path: string, bytes: number,
    createdAt: string, updatedAt: string, kind: PageKind = PageKind.Page) {
    ArgumentException.throwIfNullOrWhitespace(id, PageResources.idField);
    ArgumentException.throwIfNullOrWhitespace(chatId, PageResources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(title, PageResources.titleField);
    if (!Number.isInteger(version) || version < 1)
      throw new ArgumentOutOfRangeException(PageResources.versionField, version);
    ArgumentException.throwIfNullOrWhitespace(path, PageResources.pathField);
    if (!Number.isInteger(bytes) || bytes < 0)
      throw new ArgumentOutOfRangeException(PageResources.bytesField, bytes);
    ArgumentException.throwIfNullOrWhitespace(createdAt, PageResources.createdAtField);
    ArgumentException.throwIfNullOrWhitespace(updatedAt, PageResources.updatedAtField);
    if (!Object.values(PageKind).includes(kind))
      throw new ArgumentOutOfRangeException(PageResources.kindField, kind);

    this.id = id;
    this.chatId = chatId;
    this.title = title;
    this.version = version;
    this.madeBy = madeBy;
    this.editedBy = editedBy;
    this.path = path;
    this.bytes = bytes;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.kind = kind;
  }

  public static fromJson(value: unknown, path?: string): Page {
    const reader = JsonReader.fromValue(value, path);
    const madeBy = reader.readObject(PageResources.madeByField);
    const editedBy = reader.readObject(PageResources.editedByField);
    return new Page(
      reader.readNonBlankString(PageResources.idField),
      reader.readNonBlankString(PageResources.chatIdField),
      reader.readNonBlankString(PageResources.titleField),
      reader.readInteger(PageResources.versionField),
      PageAuthor.fromJson(madeBy.toJson(), madeBy.path),
      PageAuthor.fromJson(editedBy.toJson(), editedBy.path),
      reader.readNonBlankString(PageResources.pathField),
      reader.readInteger(PageResources.bytesField),
      reader.readNonBlankString(PageResources.createdAtField),
      reader.readNonBlankString(PageResources.updatedAtField),
      reader.hasField(PageResources.kindField) ? reader.readOneOf(PageResources.kindField, Object.values(PageKind)) : PageKind.Page);
  }

  public toJson(): JsonObject {
    return {
      [PageResources.idField]: this.id,
      [PageResources.chatIdField]: this.chatId,
      [PageResources.titleField]: this.title,
      [PageResources.versionField]: this.version,
      [PageResources.madeByField]: this.madeBy.toJson(),
      [PageResources.editedByField]: this.editedBy.toJson(),
      [PageResources.pathField]: this.path,
      [PageResources.bytesField]: this.bytes,
      [PageResources.createdAtField]: this.createdAt,
      [PageResources.updatedAtField]: this.updatedAt,
      [PageResources.kindField]: this.kind
    };
  }
}
