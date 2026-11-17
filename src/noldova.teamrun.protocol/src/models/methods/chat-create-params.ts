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

export class ChatCreateParams {
  public readonly projectId: string | null;
  public readonly title: string | null;
  public readonly teammateId: string | null;

  public constructor(projectId: string | null, title: string | null, teammateId: string | null = null) {
    if (!Object.isNull(projectId))
      ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);
    if (!Object.isNull(teammateId))
      ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);

    this.projectId = projectId;
    this.title = title;
    this.teammateId = teammateId;
  }

  public static fromJson(value: unknown, path?: string): ChatCreateParams {
    const reader = JsonReader.fromValue(value, path);
    return new ChatCreateParams(
      Object.isNull(reader.readNullableString(Resources.projectIdField)) ? null : reader.readNonBlankString(Resources.projectIdField),
      reader.readNullableString(Resources.titleField),
      reader.hasField(Resources.teammateIdField) ? reader.readNullableString(Resources.teammateIdField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.projectIdField]: this.projectId,
      [Resources.titleField]: this.title,
      [Resources.teammateIdField]: this.teammateId
    };
  }
}
