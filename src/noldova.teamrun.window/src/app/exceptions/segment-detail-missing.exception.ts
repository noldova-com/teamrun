/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SegmentKind } from "../enums/segment-kind";
import { Resources } from "../../resources";
import { WindowException } from "./window.exception";

export class SegmentDetailMissingException extends WindowException {
  public override readonly name: string = "SegmentDetailMissingException";
  public readonly kind: SegmentKind;

  public constructor(kind: SegmentKind) {
    super(Resources.formatSegmentDetailMissing(kind));
    this.kind = kind;
  }
}
