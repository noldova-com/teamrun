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

export class LinkedPaths {
  public readonly paths: readonly string[];

  public constructor(paths: readonly string[]) {
    for (const path of paths)
      ArgumentException.throwIfNullOrWhitespace(path, Resources.pathsField);

    this.paths = [...paths];
  }

  public static fromJson(value: unknown, path?: string): LinkedPaths {
    return new LinkedPaths(JsonReader.fromValue(value, path).readStringArray(Resources.pathsField));
  }

  public toJson(): JsonObject {
    return { [Resources.pathsField]: [...this.paths] };
  }
}
