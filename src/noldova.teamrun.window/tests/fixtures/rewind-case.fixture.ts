/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message } from "@noldova/teamrun.protocol";

export class RewindCase {
  public readonly kind: string;
  public readonly message: Message;

  public constructor(kind: string, message: Message) {
    this.kind = kind;
    this.message = message;
  }
}
