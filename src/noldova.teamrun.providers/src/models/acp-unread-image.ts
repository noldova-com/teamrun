/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader } from "@noldova/context.json";

export class AcpUnreadImage {
  public readonly params: JsonReader;
  public readonly sessionId: string;

  public constructor(params: JsonReader, sessionId: string) {
    this.params = params;
    this.sessionId = sessionId;
  }
}
