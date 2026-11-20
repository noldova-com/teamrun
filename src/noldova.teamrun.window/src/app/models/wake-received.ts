/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WakeReply } from "./wake-reply";

export class WakeReceived {
  public constructor(public readonly chatId: string, public readonly replies: readonly WakeReply[], public readonly end: string | null) {
  }
}
