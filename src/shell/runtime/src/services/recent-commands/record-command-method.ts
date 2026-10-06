/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { RecentCommandUse } from "@noldova/teamrun-shell-protocol";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { EventChannel } from "../../models/event-channel.js";
import type { RequestContext } from "../../models/request-context.js";
import type { RecentCommandsStore } from "./recent-commands-store.js";

export class RecordCommandMethod implements IMethodHandler {
  private readonly store: RecentCommandsStore;
  private readonly changed: EventChannel;

  public constructor(store: RecentCommandsStore, changed: EventChannel) {
    this.store = store;
    this.changed = changed;
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    this.changed.publish(this.store.record(RecentCommandUse.fromJson(context.payload)).toJson());
    return Promise.resolve(null);
  }
}
