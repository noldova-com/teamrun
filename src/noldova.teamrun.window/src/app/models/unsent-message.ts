/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class UnsentMessage {
  public readonly providerId: string | null;
  public readonly teammateId: string | null;

  public constructor(providerId: string | null, teammateId: string | null) {
    this.providerId = providerId;
    this.teammateId = teammateId;
  }
}
