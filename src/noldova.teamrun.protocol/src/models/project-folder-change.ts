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

export class ProjectFolderChange {
  public readonly projectId: string;
  public readonly folderMissing: boolean;

  public constructor(projectId: string, folderMissing: boolean) {
    ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);

    this.projectId = projectId;
    this.folderMissing = folderMissing;
  }

  public static fromJson(value: unknown, path?: string): ProjectFolderChange {
    const reader = JsonReader.fromValue(value, path);
    return new ProjectFolderChange(reader.readNonBlankString(Resources.projectIdField), reader.readBoolean(Resources.folderMissingField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.projectIdField]: this.projectId,
      [Resources.folderMissingField]: this.folderMissing
    };
  }
}
