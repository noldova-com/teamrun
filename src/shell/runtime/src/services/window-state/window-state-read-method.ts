/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { WindowStateKey, WindowStateValue } from "@noldova/teamrun-shell-protocol";

import type { WindowStateKind } from "../../enums/window-state-kind.js";
import type { IMethodHandler } from "../../interfaces/method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { WindowStateStore } from "./window-state-store.js";

export class WindowStateReadMethod implements IMethodHandler {
  private readonly store: WindowStateStore;
  private readonly kind: WindowStateKind;

  public constructor(store: WindowStateStore, kind: WindowStateKind) {
    this.store = store;
    this.kind = kind;
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    return Promise.resolve(new WindowStateValue(this.store.read(this.kind, WindowStateKey.fromJson(context.payload))).toJson());
  }
}
