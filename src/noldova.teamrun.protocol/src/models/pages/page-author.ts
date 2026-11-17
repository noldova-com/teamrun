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

export class PageAuthor {
  public readonly teammateId: string | null;
  public readonly name: string;

  public constructor(teammateId: string | null, name: string) {
    if (!Object.isNull(teammateId))
      ArgumentException.throwIfNullOrWhitespace(teammateId, PageResources.teammateIdField);
    ArgumentException.throwIfNullOrWhitespace(name, PageResources.nameField);

    this.teammateId = teammateId;
    this.name = name;
  }

  public static fromJson(value: unknown, path?: string): PageAuthor {
    const reader = JsonReader.fromValue(value, path);
    return new PageAuthor(reader.readNullableString(PageResources.teammateIdField), reader.readNonBlankString(PageResources.nameField));
  }

  public toJson(): JsonObject {
    return { [PageResources.teammateIdField]: this.teammateId, [PageResources.nameField]: this.name };
  }
}
