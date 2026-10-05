/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { NotificationPost } from "@noldova/teamrun-shell-protocol";

export class NotificationHandle {
  private readonly change: (post: NotificationPost) => Promise<boolean>;
  private readonly remove: () => void;

  public readonly id: string;

  public constructor(id: string, change: (post: NotificationPost) => Promise<boolean>, remove: () => void) {
    this.id = id;
    this.change = change;
    this.remove = remove;
  }

  public updateAsync(post: NotificationPost): Promise<boolean> {
    return this.change(post);
  }

  public dismiss(): void {
    this.remove();
  }
}
