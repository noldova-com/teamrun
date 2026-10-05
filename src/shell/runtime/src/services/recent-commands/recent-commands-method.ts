/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { RecentCommandsQuery } from "@noldova/teamrun-shell-protocol";

import type { IMethodHandler } from "../../interfaces/method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { RecentCommandsStore } from "./recent-commands-store.js";

export class RecentCommandsMethod implements IMethodHandler {
  private readonly store: RecentCommandsStore;

  public constructor(store: RecentCommandsStore) {
    this.store = store;
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    return Promise.resolve(this.store.read(RecentCommandsQuery.fromJson(context.payload).device).toJson());
  }
}
