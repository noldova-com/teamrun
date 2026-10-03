/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class OverlaySide {
  public static readonly above: OverlaySide = new OverlaySide(true, false);
  public static readonly below: OverlaySide = new OverlaySide(true, true);
  public static readonly start: OverlaySide = new OverlaySide(false, false);
  public static readonly end: OverlaySide = new OverlaySide(false, true);

  public readonly isVertical: boolean;
  public readonly isForward: boolean;

  private constructor(isVertical: boolean, isForward: boolean) {
    this.isVertical = isVertical;
    this.isForward = isForward;
  }

  public get opposite(): OverlaySide {
    if (this.isVertical)
      return this.isForward ? OverlaySide.above : OverlaySide.below;
    return this.isForward ? OverlaySide.start : OverlaySide.end;
  }
}
