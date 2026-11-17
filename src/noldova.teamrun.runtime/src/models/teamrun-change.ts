/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IToolDescriptor } from "@noldova/desktop.runtime";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import type { MethodName } from "@noldova/teamrun.protocol";

import { ChangeGuard } from "../enums/change-guard.js";

export class TeamRunChange {
  public readonly descriptor: IToolDescriptor;
  public readonly method: MethodName;
  public readonly asks: boolean;
  public readonly asksInOwnChat: boolean;
  public readonly guard: ChangeGuard;
  private readonly fields: ReadonlyMap<string, string>;
  private readonly defaults: Readonly<Record<string, JsonValue>>;

  public constructor(descriptor: IToolDescriptor, method: MethodName, fields: ReadonlyMap<string, string>, asks: boolean = false,
    guard: ChangeGuard = ChangeGuard.None, defaults: Readonly<Record<string, JsonValue>> = {}, asksInOwnChat: boolean = true) {
    this.descriptor = descriptor;
    this.method = method;
    this.fields = fields;
    this.asks = asks;
    this.guard = guard;
    this.defaults = defaults;
    this.asksInOwnChat = asksInOwnChat;
  }

  public payloadOf(input: JsonObject, current: Readonly<Record<string, JsonValue>> = {}): Record<string, JsonValue> {
    const payload: Record<string, JsonValue> = { ...this.defaults, ...current };
    for (const [argument, field] of this.fields)
      if (Object.hasOwn(input, argument))
        payload[field] = input[argument]!;
    return payload;
  }
}
