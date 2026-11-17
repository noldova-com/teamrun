/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { AcpAgentEntry } from "./acp-agent-entry.js";

export class AcpAgentListing {
  public readonly agents: readonly AcpAgentEntry[];
  public readonly localCommands: readonly AcpAgentEntry[];
  public readonly failure: string | null;
  public readonly fetchedAt: string | null;

  public constructor(agents: readonly AcpAgentEntry[], localCommands: readonly AcpAgentEntry[], failure: string | null, fetchedAt: string | null) {
    this.agents = [...agents];
    this.localCommands = [...localCommands];
    this.failure = failure;
    this.fetchedAt = fetchedAt;
  }

  public static fromJson(value: unknown, path?: string): AcpAgentListing {
    const reader = JsonReader.fromValue(value, path);
    return new AcpAgentListing(reader.readObjectArray(Resources.agentsField).map(t => AcpAgentEntry.fromJson(t.toJson())),
      reader.readObjectArray(Resources.localCommandsField).map(t => AcpAgentEntry.fromJson(t.toJson())),
      reader.readNullableString(Resources.failureField), reader.readNullableString(Resources.fetchedAtField));
  }

  public toJson(): JsonObject {
    return { [Resources.agentsField]: this.agents.map(t => t.toJson()), [Resources.localCommandsField]: this.localCommands.map(t => t.toJson()),
      [Resources.failureField]: this.failure, [Resources.fetchedAtField]: this.fetchedAt };
  }
}
