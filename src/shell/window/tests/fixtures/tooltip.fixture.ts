/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { userEvent } from "vitest/browser";

export class TooltipFixture {
  public static async expectTooltipAsync(anchor: HTMLElement | null | undefined, text: string, whileShown: (tooltip: HTMLElement) => void = () => undefined): Promise<void> {
    const tooltip = (): HTMLElement | undefined => [...document.querySelectorAll<HTMLElement>(".cdk-overlay-container tr-tooltip")].find(t => t.textContent?.trim() === text);
    const shield = document.createElement("div");
    shield.style.cssText = "position: fixed; inset: 0; z-index: 2147483647";
    document.body.append(shield);
    try {
      await userEvent.hover(shield);
      anchor?.dispatchEvent(new PointerEvent("pointerenter"));
      await vi.waitFor(() => expect(tooltip()).toBeDefined());
      whileShown(tooltip() as HTMLElement);
      anchor?.dispatchEvent(new PointerEvent("pointerleave"));
      await vi.waitFor(() => expect(tooltip()).toBeUndefined());
    }
    finally {
      shield.remove();
    }
    expect(anchor?.hasAttribute("title")).toBe(false);
  }
}
