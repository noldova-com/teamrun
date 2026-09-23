/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ReadingPosition {
  public readonly messageId: string;
  public readonly sequence: number;
  public readonly distance: number;

  public constructor(messageId: string, sequence: number, distance: number) {
    this.messageId = messageId;
    this.sequence = sequence;
    this.distance = distance;
  }
}
