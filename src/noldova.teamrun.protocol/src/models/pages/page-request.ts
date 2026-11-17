/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { PageResources } from "./page-resources.js";

export class PageRequest {
  public readonly pageId: string;
  public readonly version: number | null;

  public constructor(pageId: string, version: number | null = null) {
    ArgumentException.throwIfNullOrWhitespace(pageId, PageResources.pageIdField);
    if (!Object.isNull(version) && (!Number.isInteger(version) || version < 1))
      throw new ArgumentOutOfRangeException(PageResources.versionField, version);

    this.pageId = pageId;
    this.version = version;
  }

  public static fromJson(value: unknown, path?: string): PageRequest {
    const reader = JsonReader.fromValue(value, path);
    return new PageRequest(reader.readNonBlankString(PageResources.pageIdField), reader.readNullableInteger(PageResources.versionField));
  }

  public toJson(): JsonObject {
    return { [PageResources.pageIdField]: this.pageId, [PageResources.versionField]: this.version };
  }
}
