/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../src/resources";
import { DesktopBridgeFixture } from "./fixtures/desktop-bridge.fixture";

describe("main", () => {
  afterEach(() => DesktopBridgeFixture.remove());

  it("names the page after the product and starts the window in the page's tr-window element", async () => {
    const bridge = DesktopBridgeFixture.install();
    const host = document.body.appendChild(document.createElement("tr-window"));

    const { application } = await import("../src/main");
    await application.whenStable();
    const content = host.querySelector("tr-empty-window")?.textContent;
    application.destroy();
    host.remove();

    expect(content).toContain("No modules");
    expect(bridge.appearances.length).toBe(1);
    expect(document.title).toBe(Resources.productName);
  });

  it("leaves no application running for the specs after it", () => {
    expect(document.documentElement.style.length).toBe(0);
    expect(document.querySelector("tr-window")).toBeNull();
  });
});
