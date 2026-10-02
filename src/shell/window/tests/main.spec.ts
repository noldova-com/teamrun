/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DesktopBridgeFixture } from "./fixtures/desktop-bridge.fixture";

describe("main", () => {
  afterEach(() => DesktopBridgeFixture.remove());

  it("starts the window in the page's tr-window element", async () => {
    const bridge = DesktopBridgeFixture.install();
    const host = document.createElement("tr-window");
    document.body.append(host);

    await import("../src/main");
    await new Promise(t => requestAnimationFrame(() => requestAnimationFrame(t)));

    expect(host.querySelector("tr-empty-window")?.textContent).toContain("No modules");
    expect(bridge.appearances.length).toBe(1);
  });
});
