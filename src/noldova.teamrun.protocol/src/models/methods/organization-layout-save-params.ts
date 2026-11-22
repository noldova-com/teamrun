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

import { Resources } from "../../resources.js";

export class OrganizationLayoutSaveParams {
  public readonly organizationId: string;
  public readonly layout: JsonObject;

  public constructor(organizationId: string, layout: JsonObject) {
    ArgumentException.throwIfNullOrWhitespace(organizationId, Resources.organizationIdField);

    this.organizationId = organizationId;
    this.layout = layout;
  }

  public static fromJson(value: unknown, path?: string): OrganizationLayoutSaveParams {
    const reader = JsonReader.fromValue(value, path);
    return new OrganizationLayoutSaveParams(reader.readNonBlankString(Resources.organizationIdField), reader.readObject(Resources.layoutField).toJson());
  }

  public toJson(): JsonObject {
    return {
      [Resources.organizationIdField]: this.organizationId,
      [Resources.layoutField]: this.layout
    };
  }
}
