/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { DefaultTeammate } from "../default-teammate.js";

export class DefaultTeammateSetParams {
  public readonly defaultTeammate: DefaultTeammate | null;

  public constructor(defaultTeammate: DefaultTeammate | null) {
    this.defaultTeammate = defaultTeammate;
  }

  public static fromJson(value: unknown, path?: string): DefaultTeammateSetParams {
    const reader = JsonReader.fromValue(value, path);
    const defaultTeammate = reader.readNullableObject(Resources.defaultTeammateField);
    return new DefaultTeammateSetParams(Object.isNull(defaultTeammate) ? null : DefaultTeammate.fromJson(defaultTeammate.toJson(), defaultTeammate.path));
  }

  public toJson(): JsonObject {
    return {
      [Resources.defaultTeammateField]: Object.isNull(this.defaultTeammate) ? null : this.defaultTeammate.toJson()
    };
  }
}
