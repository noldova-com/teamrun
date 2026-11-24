/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { MessageDetail } from "@noldova/teamrun.protocol";

import type { SegmentKind } from "../enums/segment-kind";
import { SegmentDetailMissingException } from "../exceptions/segment-detail-missing.exception";
import type { ActivityEntry } from "./activity-entry";

export class ReplySegment {
  public readonly kind: SegmentKind;
  public readonly detail: MessageDetail | null;
  public readonly entries: readonly ActivityEntry[];

  public constructor(kind: SegmentKind, detail: MessageDetail | null, entries: readonly ActivityEntry[]) {
    this.kind = kind;
    this.detail = detail;
    this.entries = entries;
  }

  public get key(): number {
    return Object.isNull(this.detail) ? this.entries[0]?.detail.sequence ?? -1 : this.detail.sequence;
  }

  public get requiredDetail(): MessageDetail {
    if (Object.isNull(this.detail))
      throw new SegmentDetailMissingException(this.kind);
    return this.detail;
  }
}
