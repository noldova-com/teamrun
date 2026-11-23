/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TakenChanges {
  public readonly messageId: string;
  public readonly changed: ReadonlySet<number>;

  public constructor(messageId: string, changed: ReadonlySet<number>) {
    this.messageId = messageId;
    this.changed = changed;
  }
}
