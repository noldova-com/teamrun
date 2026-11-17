/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import type { ITurnToolSession } from "@noldova/teamrun.core";

import { ChangeSignal } from "./change-signal.fixture.js";

export class FakeTurnToolSession implements ITurnToolSession {
  public readonly id: string;
  public readonly scope: string;
  public readonly calls: { name: string; input: JsonObject; signal: AbortSignal }[] = [];
  public ends: number = 0;
  public listed: readonly JsonObject[] | null = null;
  public listFailure: Error | null = null;

  public constructor(id: string, scope: string) {
    this.id = id;
    this.scope = scope;
  }

  public listToolsAsync(): Promise<readonly JsonObject[]> {
    if (!Object.isNull(this.listFailure))
      return Promise.reject(this.listFailure);
    return Promise.resolve(this.listed ?? [{ name: "teamrun_list_chats", description: this.scope }]);
  }

  public callToolAsync(name: string, input: JsonObject, signal: AbortSignal): Promise<JsonObject> {
    this.calls.push({ name, input, signal });
    ChangeSignal.notify();
    return Promise.resolve({ content: [{ type: "text", text: `${this.scope} ${name}` }], isError: false });
  }

  public end(): void {
    this.ends += 1;
    ChangeSignal.notify();
  }
}
