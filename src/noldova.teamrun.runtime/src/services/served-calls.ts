/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

export class ServedCalls {
  private readonly calls: Map<string, { readonly tool: string; readonly input: JsonObject }> = new Map();

  public open(tool: string, input: JsonObject): string {
    const id = randomUUID();
    this.calls.set(id, { tool, input });
    return id;
  }

  public close(id: string): void {
    this.calls.delete(id);
  }

  public find(id: string | null): { readonly tool: string; readonly input: JsonObject } | null {
    return Object.isNull(id) ? null : this.calls.get(id) ?? null;
  }
}
