/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { NotificationPost } from "@noldova/desktop.protocol";

export class PostedNotice {
  public readonly id: string;
  public readonly post: NotificationPost;
  public isShown: boolean;

  public constructor(id: string, post: NotificationPost, isShown: boolean) {
    this.id = id;
    this.post = post;
    this.isShown = isShown;
  }
}
