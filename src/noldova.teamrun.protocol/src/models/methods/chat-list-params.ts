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

export class ChatListParams {
  public readonly projectId: string | null;

  public constructor(projectId: string | null) {
    if (!Object.isNull(projectId))
      ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);

    this.projectId = projectId;
  }

  public static fromJson(value: unknown, path?: string): ChatListParams {
    const reader = JsonReader.fromValue(value, path);
    return new ChatListParams(Object.isNull(reader.readNullableString(Resources.projectIdField)) ? null : reader.readNonBlankString(Resources.projectIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.projectIdField]: this.projectId
    };
  }
}
