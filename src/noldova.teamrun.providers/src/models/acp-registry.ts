/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { AcpRegistryException } from "../exceptions/acp-registry.exception.js";
import { Resources } from "../resources.js";
import { AcpRegistryAgent } from "./acp-registry-agent.js";

export class AcpRegistry {
  public readonly agents: readonly AcpRegistryAgent[];
  public readonly skipped: readonly string[];

  public constructor(agents: readonly AcpRegistryAgent[], skipped: readonly string[] = []) {
    this.agents = [...agents];
    this.skipped = [...skipped];
  }

  public static read(text: string): AcpRegistry {
    let entries: unknown;
    try {
      entries = JsonReader.fromValue(JSON.parse(text) as unknown).readValue(Resources.acpRegistryAgentsField);
    }
    catch {
      throw new AcpRegistryException(Resources.acpRegistryUnreadable);
    }
    if (!Array.isArray(entries))
      throw new AcpRegistryException(Resources.acpRegistryUnreadable);
    const agents: AcpRegistryAgent[] = [];
    const skipped: string[] = [];
    for (const [position, entry] of (entries as readonly unknown[]).entries()) {
      try {
        const agent = AcpRegistryAgent.fromJson(JsonReader.fromValue(entry, `${Resources.acpRegistryAgentsField}[${position}]`));
        if (!agents.some(t => t.id === agent.id))
          agents.push(agent);
      }
      catch {
        skipped.push(AcpRegistry.nameOf(entry) ?? String(position));
      }
    }
    return new AcpRegistry(agents, skipped);
  }

  private static nameOf(entry: unknown): string | null {
    const id = Object.isObject(entry) && !Array.isArray(entry) ? (entry as JsonObject)[Resources.idField] : null;
    return typeof id === "string" && !String.isNullOrWhitespace(id) ? id : null;
  }

  public find(id: string): AcpRegistryAgent | null {
    return this.agents.find(t => t.id === id) ?? null;
  }
}
