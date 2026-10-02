/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class UiFailure {
  public readonly title: string;
  public readonly message: string;

  public constructor(title: string, message: string) {
    this.title = title;
    this.message = message;
  }
}
