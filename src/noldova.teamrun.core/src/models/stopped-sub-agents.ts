/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message } from "@noldova/teamrun.protocol";

export class StoppedSubAgents {
  public readonly running: Message;
  public readonly message: Message;

  public constructor(running: Message, message: Message) {
    this.running = running;
    this.message = message;
  }
}
