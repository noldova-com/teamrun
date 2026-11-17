/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ImageDimensions } from "./image-dimensions";

export class KeptSize {
  public readonly conversationId: string | null;
  public readonly size: ImageDimensions;

  public constructor(conversationId: string | null, size: ImageDimensions) {
    this.conversationId = conversationId;
    this.size = size;
  }
}
