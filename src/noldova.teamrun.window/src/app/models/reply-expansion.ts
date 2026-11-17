/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";

export class ReplyExpansion {
  public readonly activity: WritableSignal<ReadonlySet<number>>;
  public readonly activityClosed: WritableSignal<ReadonlySet<number>>;
  public readonly activityBodies: WritableSignal<ReadonlySet<number>>;
  public readonly activityChildren: WritableSignal<ReadonlyMap<number, number>>;
  public readonly files: WritableSignal<ReadonlySet<string>>;
  public readonly wrappedFiles: WritableSignal<ReadonlySet<string>>;
  public readonly allFiles: WritableSignal<boolean>;
  public readonly plan: WritableSignal<boolean>;
  public readonly handovers: WritableSignal<ReadonlySet<number>>;

  public constructor() {
    this.activity = signal(new Set());
    this.activityClosed = signal(new Set());
    this.activityBodies = signal(new Set());
    this.activityChildren = signal(new Map());
    this.files = signal(new Set());
    this.wrappedFiles = signal(new Set());
    this.allFiles = signal(false);
    this.plan = signal(false);
    this.handovers = signal(new Set());
  }

  public get hasChanges(): boolean {
    return this.activity().size + this.activityClosed().size + this.activityBodies().size + this.activityChildren().size + this.files().size + this.wrappedFiles().size
      + this.handovers().size > 0 || this.allFiles() || this.plan();
  }
}
