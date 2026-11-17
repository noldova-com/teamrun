/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonReader, JsonValue } from "@noldova/context.json";

import { UnsupportedServerRequestException } from "../../exceptions/unsupported-server-request.exception.js";
import type { IServerRequestHandler } from "../../interfaces/i-server-request-handler.js";
import { Resources } from "../../resources.js";
import type { CodexSubAgents } from "./codex-sub-agents.js";
import type { CodexTurn } from "./codex-turn.js";

export class CodexRequestRouter implements IServerRequestHandler {
  private readonly turns: Map<string, CodexTurn> = new Map();
  private readonly readers: Set<CodexSubAgents> = new Set();

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

  public follow(subAgents: CodexSubAgents): void {
    this.readers.add(subAgents);
  }

  public unfollow(subAgents: CodexSubAgents): void {
    this.readers.delete(subAgents);
  }

  public all(): readonly CodexTurn[] {
    return [...this.turns.values()];
  }

  public async handleServerRequest(method: string, params: JsonReader, signal: AbortSignal): Promise<JsonValue> {
    const threadId = params.hasField(Resources.threadIdField) ? params.readValue(Resources.threadIdField) : null;
    const turn = Object.isString(threadId) ? this.turns.get(threadId) : undefined;
    if (!Object.isUndefined(turn))
      return turn.handleServerRequest(method, params, signal);
    const readers = [...this.readers].reverse();
    const reader = readers.find(t => t.follows(threadId));
    if (!Object.isUndefined(reader))
      return reader.handleServerRequest(method, params, signal);
    const waiting = readers.filter(t => t.mayFollow(threadId));
    if (waiting.length === 0)
      throw new UnsupportedServerRequestException(method);
    const named = await CodexRequestRouter.namerOf(waiting, threadId);

    return (named ?? waiting.find(t => t.isStopped) ?? waiting[0]!).handleServerRequest(method, params, signal);
  }

  private static namerOf(readers: readonly CodexSubAgents[], threadId: JsonValue | null): Promise<CodexSubAgents | null> {
    const named = Promise.withResolvers<CodexSubAgents | null>();
    let left = readers.length;
    for (const reader of readers)
      void reader.whenNamed(threadId).then(t => {
        if (t)
          named.resolve(reader);
        else if (--left === 0)
          named.resolve(null);
      });
    return named.promise;
  }
}
