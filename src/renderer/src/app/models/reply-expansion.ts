/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";

export class ReplyExpansion {
  public readonly activity = signal<ReadonlySet<number>>(new Set());
  public readonly activityBodies = signal<ReadonlySet<number>>(new Set());
  public readonly files = signal<ReadonlySet<string>>(new Set());
  public readonly wrappedFiles = signal<ReadonlySet<string>>(new Set());
  public readonly allFiles = signal(false);

  public get hasChanges(): boolean {
    return this.activity().size + this.activityBodies().size + this.files().size + this.wrappedFiles().size > 0 || this.allFiles();
  }
}
