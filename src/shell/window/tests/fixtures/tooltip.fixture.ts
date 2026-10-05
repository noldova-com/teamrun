/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { userEvent } from "vitest/browser";

export class TooltipFixture {
  public static find(text: string): HTMLElement | undefined {
    return [...document.querySelectorAll<HTMLElement>(".cdk-overlay-container tr-tooltip")].find(t => t.textContent?.trim() === text);
  }

  public static async shieldAsync<T>(check: () => Promise<T>): Promise<T> {
    const shield = document.body.appendChild(document.createElement("div"));
    try {
      shield.popover = "manual";
      shield.style.cssText = "position: fixed; inset: 0; width: auto; height: auto; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: transparent;";
      shield.showPopover();
      await userEvent.hover(shield);
      return await check();
    }
    finally {
      shield.remove();
    }
  }

  public static async expectTooltipAsync(anchor: HTMLElement, text: string, whileShown: (tooltip: HTMLElement) => void = () => undefined): Promise<void> {
    await TooltipFixture.shieldAsync(async () => {
      anchor.dispatchEvent(new PointerEvent("pointerenter"));
      await vi.waitFor(() => expect(TooltipFixture.find(text)).toBeDefined());
      whileShown(TooltipFixture.find(text) as HTMLElement);
      anchor.dispatchEvent(new PointerEvent("pointerleave"));
      await vi.waitFor(() => expect(TooltipFixture.find(text)).toBeUndefined());
    });
    expect(anchor.hasAttribute("title")).toBe(false);
  }
}
