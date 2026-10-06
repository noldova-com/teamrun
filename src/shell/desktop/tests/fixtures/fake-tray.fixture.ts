/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ITray } from "@noldova/teamrun-shell-desktop";

export class FakeTray implements ITray {
  private readonly clicks: (() => void)[] = [];

  public readonly images: string[] = [];
  public readonly toolTips: string[] = [];
  public readonly menus: unknown[] = [];
  public isDestroyed: boolean = false;

  public constructor(image: string) {
    this.images.push(image);
  }

  public get listeners(): number {
    return this.clicks.length;
  }

  public setImage(image: string): void {
    this.images.push(image);
  }

  public setToolTip(toolTip: string): void {
    this.toolTips.push(toolTip);
  }

  public setContextMenu(menu: unknown): void {
    this.menus.push(menu);
  }

  public on(_event: "click", listener: () => void): this {
    this.clicks.push(listener);
    return this;
  }

  public click(): void {
    for (const listener of this.clicks)
      listener();
  }

  public destroy(): void {
    this.isDestroyed = true;
  }
}
