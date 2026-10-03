/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class QuitQuestion {
  public readonly descriptions: readonly string[];
  public readonly isWaiting: boolean;

  public constructor(descriptions: readonly string[], isWaiting: boolean) {
    this.descriptions = [...descriptions];
    this.isWaiting = isWaiting;
  }

  public toJson(): JsonObject {
    return { [Resources.descriptionsField]: [...this.descriptions], [Resources.isWaitingField]: this.isWaiting };
  }
}
