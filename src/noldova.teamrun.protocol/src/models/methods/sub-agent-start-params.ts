/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class SubAgentStartParams {
  public readonly senderToken: string;
  public readonly agent: string;
  public readonly description: string;
  public readonly brief: string;

  public constructor(senderToken: string, agent: string, description: string, brief: string) {
    ArgumentException.throwIfNullOrWhitespace(senderToken, Resources.senderTokenField);
    ArgumentException.throwIfNullOrWhitespace(agent, Resources.agentField);
    ArgumentException.throwIfNullOrWhitespace(description, Resources.descriptionField);
    ArgumentException.throwIfNullOrWhitespace(brief, Resources.briefField);

    this.senderToken = senderToken;
    this.agent = agent;
    this.description = description;
    this.brief = brief;
  }

  public static fromJson(value: unknown, path?: string): SubAgentStartParams {
    const reader = JsonReader.fromValue(value, path);
    return new SubAgentStartParams(reader.readNonBlankString(Resources.senderTokenField), reader.readNonBlankString(Resources.agentField),
      reader.readNonBlankString(Resources.descriptionField), reader.readNonBlankString(Resources.briefField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.senderTokenField]: this.senderToken,
      [Resources.agentField]: this.agent,
      [Resources.descriptionField]: this.description,
      [Resources.briefField]: this.brief
    };
  }
}
