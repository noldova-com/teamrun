/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class DownloadProgress {
  public readonly received: number;
  public readonly total: number;

  public constructor(received: number, total: number) {
    this.received = received;
    this.total = total;
  }
}
