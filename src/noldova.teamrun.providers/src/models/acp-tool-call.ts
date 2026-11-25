/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class AcpToolCall {
  public readonly name: string;
  public readonly summary: string;

  public constructor(name: string, summary: string) {
    this.name = name;
    this.summary = summary;
  }
}
