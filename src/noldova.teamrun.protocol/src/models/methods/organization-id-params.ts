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

export class OrganizationIdParams {
  public readonly organizationId: string;

  public constructor(organizationId: string) {
    ArgumentException.throwIfNullOrWhitespace(organizationId, Resources.organizationIdField);

    this.organizationId = organizationId;
  }

  public static fromJson(value: unknown, path?: string): OrganizationIdParams {
    return new OrganizationIdParams(JsonReader.fromValue(value, path).readNonBlankString(Resources.organizationIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.organizationIdField]: this.organizationId
    };
  }
}
