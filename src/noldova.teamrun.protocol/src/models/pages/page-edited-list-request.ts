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

import { PageResources } from "./page-resources.js";

export class PageEditedListRequest {
  public readonly teammateId: string;

  public constructor(teammateId: string) {
    ArgumentException.throwIfNullOrWhitespace(teammateId, PageResources.teammateIdField);

    this.teammateId = teammateId;
  }

  public static fromJson(value: unknown, path?: string): PageEditedListRequest {
    return new PageEditedListRequest(JsonReader.fromValue(value, path).readNonBlankString(PageResources.teammateIdField));
  }

  public toJson(): JsonObject {
    return { [PageResources.teammateIdField]: this.teammateId };
  }
}
