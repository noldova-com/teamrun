/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { WindowStateWrite } from "@noldova/teamrun-shell-protocol";

import type { WindowStateKind } from "../../enums/window-state-kind.js";
import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { WindowStateStore } from "./window-state-store.js";

export class WindowStateWriteMethod implements IMethodHandler {
  private readonly store: WindowStateStore;
  private readonly kind: WindowStateKind;

  public constructor(store: WindowStateStore, kind: WindowStateKind) {
    this.store = store;
    this.kind = kind;
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    const write = WindowStateWrite.fromJson(context.payload);
    this.store.write(this.kind, write.key, write.value);
    return Promise.resolve(null);
  }
}
