/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import { Failure, FailureCode, type QualifiedName, Response, ShellMethods, WindowStateKey, WindowStateWrite } from "@noldova/teamrun-shell-protocol";
import type { IRuntimeConnection } from "@noldova/teamrun-shell-desktop";

export class FakeRuntimeConnection implements IRuntimeConnection {
  public readonly states: Map<string, JsonObject> = new Map();
  public readonly calls: string[] = [];
  public isClosed: boolean = false;
  public isFailing: boolean = false;
  public onCall?: () => void;
  public rejection?: Error;
  public readonly answers: Map<string, Response> = new Map();

  public callAsync(method: QualifiedName, payload: JsonValue): Promise<Response> {
    this.calls.push(method.text);
    this.onCall?.();
    if (!Object.isUndefined(this.rejection))
      return Promise.reject(this.rejection);
    const answer = this.answers.get(method.text);
    if (!Object.isUndefined(answer))
      return Promise.resolve(answer);
    if (this.isFailing)
      return Promise.resolve(Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    if (method.text === ShellMethods.writeWindowBounds.text || method.text === ShellMethods.writeWindowLayout.text) {
      const write = WindowStateWrite.fromJson(payload);
      this.states.set(`${method.member}:${write.key.device}:${write.key.window}`, write.value);
      return Promise.resolve(Response.success("r", null));
    }
    const key = WindowStateKey.fromJson(payload);
    const member = method.member.replace("read", "write");
    return Promise.resolve(Response.success("r", { value: this.states.get(`${member}:${key.device}:${key.window}`) ?? null }));
  }

  public close(): void {
    this.isClosed = true;
  }
}
