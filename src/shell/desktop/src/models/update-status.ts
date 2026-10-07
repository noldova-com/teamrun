/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { UpdateStateKind } from "../enums/update-state-kind.js";
import { Resources } from "../resources.js";

export class UpdateStatus {
  public static readonly off: UpdateStatus = new UpdateStatus(UpdateStateKind.Off, null, null, null, null, false);

  public readonly kind: UpdateStateKind;
  public readonly version: string | null;
  public readonly progress: number | null;
  public readonly checkedAt: number | null;
  public readonly reason: string | null;
  public readonly mustMove: boolean;

  public constructor(kind: UpdateStateKind, version: string | null, progress: number | null, checkedAt: number | null, reason: string | null, mustMove: boolean) {
    this.kind = kind;
    this.version = version;
    this.progress = progress;
    this.checkedAt = checkedAt;
    this.reason = reason;
    this.mustMove = mustMove;
  }

  public get isBusy(): boolean {
    return [UpdateStateKind.Checking, UpdateStateKind.Downloading, UpdateStateKind.Ready].includes(this.kind);
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.updateVersionField]: this.version,
      [Resources.updateProgressField]: this.progress,
      [Resources.updateCheckedAtField]: this.checkedAt,
      [Resources.updateReasonField]: this.reason,
      [Resources.updateMustMoveField]: this.mustMove
    };
  }
}
