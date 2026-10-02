/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";

export interface IDesktopBridge {
  readonly platform: string;

  notifyReady(appearance: JsonObject): void;
  onCloseRequest(listener: (requestId: string) => void): () => void;
  answerClose(requestId: string, isSaved: boolean): Promise<boolean>;
}
