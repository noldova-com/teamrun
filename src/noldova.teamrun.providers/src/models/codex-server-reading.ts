/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CodexServerReading {
  public readonly acceptsSource: boolean;
  public readonly version: string | null;

  public constructor(acceptsSource: boolean, version: string | null) {
    this.acceptsSource = acceptsSource;
    this.version = version;
  }

  public get isKnown(): boolean {
    return this.acceptsSource || !Object.isNull(this.version);
  }
}
