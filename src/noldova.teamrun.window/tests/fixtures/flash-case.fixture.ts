/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message } from "@noldova/teamrun.protocol";

export class FlashCase {
  public readonly shape: string;
  public readonly message: () => Message;
  public readonly painted: string;
  public readonly layer: string | null;
  public readonly fill: string;

  public constructor(shape: string, message: () => Message, painted: string, layer: string | null, fill: string) {
    this.shape = shape;
    this.message = message;
    this.painted = painted;
    this.layer = layer;
    this.fill = fill;
  }
}
