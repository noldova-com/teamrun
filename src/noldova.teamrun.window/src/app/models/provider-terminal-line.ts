/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProviderTerminalLine {
  public readonly providerId: string;
  public readonly sessionId: string;
  public readonly title: string;

  public constructor(providerId: string, sessionId: string, title: string) {
    this.providerId = providerId;
    this.sessionId = sessionId;
    this.title = title;
  }
}
