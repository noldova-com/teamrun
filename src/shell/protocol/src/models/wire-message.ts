/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";

import type { WireMessageKind } from "../enums/wire-message-kind.js";
import { Resources } from "../resources.js";

export abstract class WireMessage {
  public abstract readonly kind: WireMessageKind;

  public toJson(): JsonObject {
    return { [Resources.kindField]: this.kind, ...this.toJsonFields() };
  }

  public toText(): string {
    return JSON.stringify(this.toJson());
  }

  protected abstract toJsonFields(): JsonObject;
}
