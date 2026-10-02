/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowAppearance } from "../../../src/app/models/window-appearance";

describe("WindowAppearance", () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.body.removeAttribute("style");
  });

  it("reads the page's background and the window row's colors and height as the browser computes them", () => {
    const row = document.createElement("div");
    document.body.style.backgroundColor = "#181818";
    row.style.cssText = "background-color: #f8f8f8; color: #1e1e1e; height: 34.6px";
    document.body.append(row);

    const appearance = WindowAppearance.read(row);

    expect(appearance.background).toBe("rgb(24, 24, 24)");
    expect(appearance.titleBar).toBe("rgb(248, 248, 248)");
    expect(appearance.titleBarText).toBe("rgb(30, 30, 30)");
    expect(appearance.titleBarHeight).toBe(35);
  });

  it("writes its JSON", () => {
    expect(new WindowAppearance("#000", "#111", "#222", 20).toJson()).toEqual({ background: "#000", titleBar: "#111", titleBarText: "#222", titleBarHeight: 20 });
  });
});
