/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { DoNotDisturbChange } from "@noldova/teamrun-shell-protocol";

import type { IMethodHandler } from "../../interfaces/method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { DoNotDisturbStore } from "./do-not-disturb-store.js";

export class SetDoNotDisturbMethod implements IMethodHandler {
  private readonly store: DoNotDisturbStore;
  private readonly changed: () => void;

  public constructor(store: DoNotDisturbStore, changed: () => void) {
    this.store = store;
    this.changed = changed;
  }

  public async handleAsync(context: RequestContext): Promise<JsonValue> {
    const change = DoNotDisturbChange.fromJson(context.payload);
    this.store.set(change.device, change.isOn);
    this.changed();
    return null;
  }
}
