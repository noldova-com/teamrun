/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessRecord } from "./process-record.js";

export class ProcessEnding {
  public readonly record: ProcessRecord;
  public readonly forced: readonly number[];
  public readonly remaining: readonly number[];
  public readonly left: readonly number[];

  public constructor(record: ProcessRecord, forced: readonly number[] = [], remaining: readonly number[] = [], left: readonly number[] = []) {
    this.record = record;
    this.forced = [...forced];
    this.remaining = [...remaining];
    this.left = [...left];
  }
}
