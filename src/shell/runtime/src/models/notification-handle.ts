/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { NotificationPost } from "@noldova/teamrun-shell-protocol";

export class NotificationHandle {
  private readonly change: (post: NotificationPost) => void;
  private readonly remove: () => void;

  public readonly id: number;

  public constructor(id: number, change: (post: NotificationPost) => void, remove: () => void) {
    this.id = id;
    this.change = change;
    this.remove = remove;
  }

  public update(post: NotificationPost): void {
    this.change(post);
  }

  public dismiss(): void {
    this.remove();
  }
}
