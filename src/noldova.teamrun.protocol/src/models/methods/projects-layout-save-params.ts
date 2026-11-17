/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class ProjectsLayoutSaveParams {
  public readonly layout: JsonObject;
  public readonly onlyIfNone: boolean;

  public constructor(layout: JsonObject, onlyIfNone: boolean = false) {
    this.layout = layout;
    this.onlyIfNone = onlyIfNone;
  }

  public static fromJson(value: unknown, path?: string): ProjectsLayoutSaveParams {
    const reader = JsonReader.fromValue(value, path);
    return new ProjectsLayoutSaveParams(reader.readObject(Resources.layoutField).toJson(),
      reader.hasField(Resources.onlyIfNoneField) ? reader.readBoolean(Resources.onlyIfNoneField) : false);
  }

  public toJson(): JsonObject {
    return {
      [Resources.layoutField]: this.layout,
      [Resources.onlyIfNoneField]: this.onlyIfNone
    };
  }
}
