/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

export class DialogActionsFixture {
  public static expectCloseThenPrimary(root: ParentNode, primary: string): void {
    const actions = DialogActionsFixture.find(root, ".nol-dialog-actions");
    const close = DialogActionsFixture.find(actions, ".nol-teamrun-cancel");
    const main = DialogActionsFixture.find(actions, primary);
    const closeBox = close.getBoundingClientRect();
    const mainBox = main.getBoundingClientRect();
    const actionsBox = actions.getBoundingClientRect();
    const height = AppearanceFixture.measureLook("button-height");

    expect(actions.children).toHaveLength(2);
    expect(actions.firstElementChild).toBe(close);
    expect(actions.lastElementChild).toBe(main);
    expect(close.classList).toContain("nol-button-text");
    expect(main.classList).not.toContain("nol-button-text");
    expect(main.classList).not.toContain("nol-button-secondary");
    expect(getComputedStyle(close).borderTopWidth).toBe("0px");
    AppearanceFixture.expectPixels(closeBox.height, height);
    AppearanceFixture.expectPixels(mainBox.height, height);
    AppearanceFixture.expectPixels(closeBox.top, mainBox.top);
    AppearanceFixture.expectPixels(mainBox.left - closeBox.right, AppearanceFixture.measureLook("space-2"));
    AppearanceFixture.expectPixels(actionsBox.right - Number.parseFloat(getComputedStyle(actions).paddingRight) - mainBox.right, 0);
  }

  private static find(root: ParentNode, selector: string): HTMLElement {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`The dialog shows no ${selector}.`);
    return found;
  }
}
