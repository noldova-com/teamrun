/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class WindowsSigningAccount {
  public readonly endpoint: string;
  public readonly account: string;
  public readonly profile: string;

  public constructor(endpoint: string, account: string, profile: string) {
    this.endpoint = endpoint;
    this.account = account;
    this.profile = profile;
  }
}
