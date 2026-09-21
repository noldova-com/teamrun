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

export class ProjectIdParams {
  public readonly projectId: string;

  public constructor(projectId: string) {
    ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);

    this.projectId = projectId;
  }

  public static fromJson(value: unknown, path?: string): ProjectIdParams {
    const reader = JsonReader.fromValue(value, path);
    return new ProjectIdParams(reader.readNonBlankString(Resources.projectIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.projectIdField]: this.projectId
    };
  }
}
