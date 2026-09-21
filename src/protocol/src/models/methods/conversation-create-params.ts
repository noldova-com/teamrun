/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";

export class ConversationCreateParams {
  public readonly projectId: string;
  public readonly title: string | null;

  public constructor(projectId: string, title: string | null) {
    ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);

    this.projectId = projectId;
    this.title = title;
  }

  public static fromJson(value: unknown, path?: string): ConversationCreateParams {
    const reader = JsonReader.fromValue(value, path);
    return new ConversationCreateParams(reader.readNonBlankString(Resources.projectIdField), reader.readNullableString(Resources.titleField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.projectIdField]: this.projectId,
      [Resources.titleField]: this.title
    };
  }
}
