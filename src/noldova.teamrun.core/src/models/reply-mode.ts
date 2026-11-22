/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message, ProviderMode } from "@noldova/teamrun.protocol";

export class ReplyMode {
  public readonly reply: Message;
  public readonly mode: ProviderMode | null;

  public constructor(reply: Message, mode: ProviderMode | null) {
    this.reply = reply;
    this.mode = mode;
  }
}
