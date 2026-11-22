/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SendKeyCase {
  public readonly platform: string;
  public readonly modifier: string;

  public constructor(platform: string, modifier: string) {
    this.platform = platform;
    this.modifier = modifier;
  }
}
