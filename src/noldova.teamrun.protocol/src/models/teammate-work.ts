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
import { TeammateDocument } from "./teammate-document.js";

export class TeammateWork {
  public readonly teammateId: string;
  public readonly folder: string | null;
  public readonly folders: readonly string[];
  public readonly documents: readonly TeammateDocument[];

  public constructor(teammateId: string, folder: string | null, folders: readonly string[], documents: readonly TeammateDocument[]) {
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    if (!Object.isNull(folder) && !folders.includes(folder))
      throw new ArgumentException(Resources.teammateWorkFolderUnlisted, Resources.folderField);

    this.teammateId = teammateId;
    this.folder = folder;
    this.folders = [...folders];
    this.documents = [...documents];
  }

  public static fromJson(value: unknown, path?: string): TeammateWork {
    const reader = JsonReader.fromValue(value, path);
    return new TeammateWork(reader.readNonBlankString(Resources.teammateIdField), reader.readNullableString(Resources.folderField),
      reader.readStringArray(Resources.foldersField), reader.readObjectArray(Resources.documentsField).map(t => TeammateDocument.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.teammateIdField]: this.teammateId,
      [Resources.folderField]: this.folder,
      [Resources.foldersField]: [...this.folders],
      [Resources.documentsField]: this.documents.map(t => t.toJson())
    };
  }
}
