/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { TeammateName } from "../services/teammate-name.js";

export class TeammateMention {
  public readonly teammateId: string;
  public readonly name: string;

  public constructor(
    teammateId: string,
    name: string) {
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    TeammateName.validate(name);

    this.teammateId = teammateId;
    this.name = name;
  }

  public static fromJson(value: unknown, path?: string): TeammateMention {
    const reader = JsonReader.fromValue(value, path);
    return new TeammateMention(
      reader.readNonBlankString(Resources.teammateIdField),
      TeammateName.read(reader));
  }

  public toJson(): JsonObject {
    return {
      [Resources.teammateIdField]: this.teammateId,
      [Resources.nameField]: this.name
    };
  }
}
