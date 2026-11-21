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

export class OrganizationLayoutSaveParams {
  public readonly layout: JsonObject;

  public constructor(layout: JsonObject) {
    this.layout = layout;
  }

  public static fromJson(value: unknown, path?: string): OrganizationLayoutSaveParams {
    return new OrganizationLayoutSaveParams(JsonReader.fromValue(value, path).readObject(Resources.layoutField).toJson());
  }

  public toJson(): JsonObject {
    return { [Resources.layoutField]: this.layout };
  }
}
