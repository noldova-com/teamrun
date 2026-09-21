/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";

export class ProjectOpenParams {
  public readonly rootPath: string;

  public constructor(rootPath: string) {
    ArgumentException.throwIfNullOrWhitespace(rootPath, Resources.rootPathField);

    this.rootPath = rootPath;
  }

  public static fromJson(value: unknown, path?: string): ProjectOpenParams {
    const reader = JsonReader.fromValue(value, path);
    return new ProjectOpenParams(reader.readNonBlankString(Resources.rootPathField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.rootPathField]: this.rootPath
    };
  }
}
