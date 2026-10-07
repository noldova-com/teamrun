/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { QuitAnswered } from "@noldova/teamrun-shell-protocol";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { QuitRelay } from "./quit-relay.js";

export class QuitAnsweredMethod implements IMethodHandler {
  private readonly relay: QuitRelay;

  public constructor(relay: QuitRelay) {
    this.relay = relay;
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    this.relay.recordAnswer(context.connection, QuitAnswered.fromJson(context.payload));
    return Promise.resolve(null);
  }
}
