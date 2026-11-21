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

export class OrganizationChat {
  public readonly organizationId: string;
  public readonly teammateId: string;

  public constructor(organizationId: string, teammateId: string) {
    ArgumentException.throwIfNullOrWhitespace(organizationId, Resources.organizationIdField);
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);

    this.organizationId = organizationId;
    this.teammateId = teammateId;
  }

  public static fromJson(value: unknown, path?: string): OrganizationChat {
    const reader = JsonReader.fromValue(value, path);
    return new OrganizationChat(reader.readNonBlankString(Resources.organizationIdField), reader.readNonBlankString(Resources.teammateIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.organizationIdField]: this.organizationId,
      [Resources.teammateIdField]: this.teammateId
    };
  }
}
