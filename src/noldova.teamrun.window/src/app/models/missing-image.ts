/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MissingImage {
  public readonly text: string;
  public readonly reason: string | null;

  public constructor(text: string, reason: string | null = null) {
    this.text = text;
    this.reason = reason;
  }
}
