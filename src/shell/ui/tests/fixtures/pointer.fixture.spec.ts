/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PointerFixture } from "./pointer.fixture";

describe("PointerFixture", () => {
  let added: HTMLElement[];

  beforeEach(() => {
    added = [];
  });

  afterEach(() => added.forEach(t => t.remove()));

  function append(): HTMLElement {
    const element = document.body.appendChild(document.createElement("div"));
    added.push(element);
    return element;
  }

  it("hovers its target although an earlier child of body goes away while the hover starts, and leaves it without a test id", async () => {
    const earlier = [append(), append(), append()];
    const target = append();
    target.popover = "manual";
    target.style.cssText = "position: fixed; inset: 0 auto auto 0; width: 4px; height: 4px; margin: 0; padding: 0; border: 0;";
    target.showPopover();
    queueMicrotask(() => earlier[0]?.remove());

    await PointerFixture.hoverAsync(target);

    expect([target.isConnected, earlier[0]?.isConnected, target.matches(":hover"), target.hasAttribute("data-testid")]).toEqual([true, false, true, false]);
  });
});
