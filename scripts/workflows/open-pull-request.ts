/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class OpenPullRequest {
  public readonly number: number;
  public readonly isDraft: boolean;
  public readonly base: string;

  public constructor(number: number, isDraft: boolean, base: string) {
    this.number = number;
    this.isDraft = isDraft;
    this.base = base;
  }
}
