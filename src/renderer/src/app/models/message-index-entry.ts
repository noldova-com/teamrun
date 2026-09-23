/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageControlState } from "./message-control-state";

export class MessageIndexEntry {
  public readonly id: string;
  public readonly sequence: number;
  public height: number | null = null;
  public controls: MessageControlState | null = null;

  public constructor(id: string, sequence: number) {
    this.id = id;
    this.sequence = sequence;
  }
}
