/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GrantColumnShares {
  public readonly app: number;
  public readonly chat: number;
  public readonly granted: number;
  public readonly actions: number;

  public constructor(app: number, chat: number, granted: number, actions: number) {
    this.app = app;
    this.chat = chat;
    this.granted = granted;
    this.actions = actions;
  }
}
