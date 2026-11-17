/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class DataFolder {
  public readonly path: string;
  public readonly databaseFile: string;

  public constructor(path: string, databaseFile: string) {
    ArgumentException.throwIfNullOrWhitespace(path, Resources.pathField);
    ArgumentException.throwIfNullOrWhitespace(databaseFile, Resources.databaseFileField);

    this.path = path;
    this.databaseFile = databaseFile;
  }

  public static fromJson(value: unknown, path?: string): DataFolder {
    const reader = JsonReader.fromValue(value, path);
    return new DataFolder(reader.readNonBlankString(Resources.pathField), reader.readNonBlankString(Resources.databaseFileField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.pathField]: this.path,
      [Resources.databaseFileField]: this.databaseFile
    };
  }
}
