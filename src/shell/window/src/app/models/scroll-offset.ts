/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ScrollOffset {
  public readonly element: Element;
  public readonly top: number;
  public readonly left: number;

  public constructor(element: Element, top: number, left: number) {
    this.element = element;
    this.top = top;
    this.left = left;
  }

  public static of(element: Element): ScrollOffset {
    return new ScrollOffset(element, element.scrollTop, element.scrollLeft);
  }

  public restore(): void {
    this.element.scrollTop = this.top;
    this.element.scrollLeft = this.left;
  }
}
