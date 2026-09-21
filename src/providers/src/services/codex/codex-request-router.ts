/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonReader, JsonValue } from "@noldova/teamrun-foundation-json";

import { UnsupportedServerRequestException } from "../../exceptions/unsupported-server-request.exception.js";
import type { IServerRequestHandler } from "../../interfaces/i-server-request-handler.js";
import { Resources } from "../../resources.js";
import type { CodexTurn } from "./codex-turn.js";

export class CodexRequestRouter implements IServerRequestHandler {
  private readonly turns: Map<string, CodexTurn> = new Map();

  public get activeCount(): number {
    return this.turns.size;
  }

  public register(turn: CodexTurn): void {
    this.turns.set(turn.threadId, turn);
  }

  public unregister(turn: CodexTurn): void {
    if (this.turns.get(turn.threadId) === turn)
      this.turns.delete(turn.threadId);
  }

  public all(): readonly CodexTurn[] {
    return [...this.turns.values()];
  }

  public handleServerRequest(method: string, params: JsonReader): Promise<JsonValue> {
    const threadId = params.hasField(Resources.threadIdField) ? params.readValue(Resources.threadIdField) : null;
    const turn = Object.isString(threadId) ? this.turns.get(threadId) : undefined;
    if (Object.isUndefined(turn))
      return Promise.reject(new UnsupportedServerRequestException(method));

    return turn.handleServerRequest(method, params);
  }
}
