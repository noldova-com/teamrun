/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FocusRing {
  public readonly element: Element;
  public readonly style: string;
  public readonly width: number;
  public readonly color: string;
  public readonly offset: number;

  public constructor(element: Element) {
    const style = getComputedStyle(element);
    this.element = element;
    this.style = style.outlineStyle;
    this.width = Number.parseFloat(style.outlineWidth);
    this.color = style.outlineColor;
    this.offset = Number.parseFloat(style.outlineOffset);
  }

  public static borderWidthOf(root: Element): number {
    const probe = root.appendChild(document.createElement("span"));
    probe.style.border = "var(--nol-border-width) solid";
    const width = Number.parseFloat(getComputedStyle(probe).borderTopWidth);
    probe.remove();
    return width;
  }

  public static colorOf(root: Element, value: string): string {
    const probe = root.appendChild(document.createElement("span"));
    probe.style.color = value;
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }
}
