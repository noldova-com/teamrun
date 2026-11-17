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

export class PageListRequest {
  public readonly chatId: string;

  public constructor(chatId: string) {
    ArgumentException.throwIfNullOrWhitespace(chatId, PageResources.chatIdField);

    this.chatId = chatId;
  }

  public static fromJson(value: unknown, path?: string): PageListRequest {
    return new PageListRequest(JsonReader.fromValue(value, path).readNonBlankString(PageResources.chatIdField));
  }

  public toJson(): JsonObject {
    return { [PageResources.chatIdField]: this.chatId };
  }
}
