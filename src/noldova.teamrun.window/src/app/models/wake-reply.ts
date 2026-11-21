/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageStatus } from "@noldova/teamrun.protocol";

export class WakeReply {
  public constructor(public readonly name: string, public readonly status: MessageStatus, public readonly text: string | null) {
  }
}
