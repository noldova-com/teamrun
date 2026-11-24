/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class DocsMode {
  public readonly mode: string;
  public readonly scheme: string;

  public constructor(mode: string, scheme: string) {
    this.mode = mode;
    this.scheme = scheme;
  }
}
