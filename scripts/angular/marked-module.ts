/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class MarkedModule {
  public readonly code: string;
  public readonly map: null = null;

  public constructor(code: string) {
    this.code = code;
  }
}
