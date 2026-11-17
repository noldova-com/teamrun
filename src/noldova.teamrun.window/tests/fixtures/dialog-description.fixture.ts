/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogRef } from "@angular/cdk/dialog";

import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { Wait } from "./wait.fixture";

export class DialogDescriptionFixture {
  public static async focusedAsync(focus: string): Promise<HTMLElement> {
    await Wait.until(() => expect(document.activeElement?.matches(`[role='dialog'] ${focus}`)).toBe(true));
    return DialogDescriptionFixture.dialog();
  }

  public static expectDescribedBy(dialog: HTMLElement, texts: readonly string[]): void {
    const ids = (dialog.getAttribute("aria-describedby") ?? String.empty).split(" ").filter(t => !String.isNullOrEmpty(t));
    const described = ids.map(t => document.getElementById(t));
    const titleElement = DialogDescriptionFixture.find(dialog, ".nol-dialog-title");
    const title = titleElement.getBoundingClientRect();
    const titleStart = title.left + Number.parseFloat(getComputedStyle(titleElement).paddingLeft);

    expect(described.map(t => t?.textContent?.trim())).toEqual(texts);
    for (const element of described) {
      expect(dialog.contains(element)).toBe(true);
      const box = element!.getBoundingClientRect();
      AppearanceFixture.expectPixels(box.left, titleStart);
      expect(box.top).toBeGreaterThanOrEqual(title.bottom);
    }
  }

  public static async closeAsync<T>(reference: DialogRef<unknown, T>): Promise<void> {
    reference.close();
    await Wait.until(() => expect(document.querySelector("[role='dialog']")).toBeNull());
  }

  private static dialog(): HTMLElement {
    const dialogs = document.querySelectorAll<HTMLElement>("[role='dialog']");
    const dialog = dialogs.item(dialogs.length - 1);
    if (Object.isNull(dialog))
      throw new Error("No dialog is open.");
    return dialog;
  }

  private static find(root: ParentNode, selector: string): HTMLElement {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`The dialog shows no ${selector}.`);
    return found;
  }
}
