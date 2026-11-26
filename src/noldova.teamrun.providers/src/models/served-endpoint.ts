/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ServedEndpoint {
  public readonly url: string;
  public readonly token: string;

  public constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }
}
