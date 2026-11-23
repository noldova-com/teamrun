/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import { FlowBox } from "./flow-box";

export class FlowFrame {
  private readonly origin: DOMRect;
  private readonly scale: number;

  public constructor(container: HTMLElement) {
    this.origin = container.getBoundingClientRect();
    this.scale = this.origin.width > 0 ? this.origin.width / FlowFrame.layoutWidthOf(container) : 1;
  }

  public static layoutWidthOf(element: HTMLElement): number {
    const style = getComputedStyle(element);
    const sides = style.boxSizing === Resources.borderBox ? [] : [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth];
    return [style.width, ...sides].reduce((t, u) => t + Number.parseFloat(u), 0);
  }

  public boxOf(element: Element): FlowBox {
    return this.toBox(element.getBoundingClientRect());
  }

  public toBox(rect: DOMRect): FlowBox {
    return new FlowBox(this.toLocal(rect.left - this.origin.left), this.toLocal(rect.top - this.origin.top), this.toLocal(rect.width), this.toLocal(rect.height));
  }

  private toLocal(value: number): number {
    return value / this.scale;
  }
}
