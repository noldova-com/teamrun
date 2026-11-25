/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { indexPage } from "@docs-generated/index-page";

describe("The page shell", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-nol-theme-mode");
    localStorage.removeItem("noldova-theme");
  });

  it("lets search engines index the site", () => {
    const head = new DOMParser().parseFromString(indexPage, "text/html").head;

    expect(head.querySelectorAll("meta[name=robots]")).toHaveLength(0);
  });

  it.each([["light", "Light"], ["dark", "Dark"], ["system", null], ["Dark", null], [null, null]])(
    "applies a saved noldova-theme of %s before the page renders, as every Noldova site does", (saved, mode) => {
      const script = new DOMParser().parseFromString(indexPage, "text/html").head.querySelector("script:not([src])")?.textContent ?? String();
      const root = document.documentElement;
      root.removeAttribute("data-nol-theme-mode");
      if (Object.isNull(saved))
        localStorage.removeItem("noldova-theme");
      else
        localStorage.setItem("noldova-theme", saved);

      new Function(script)();

      expect(root.getAttribute("data-nol-theme-mode")).toBe(mode);
    });

  it("keeps the site's title", () => {
    const head = new DOMParser().parseFromString(indexPage, "text/html").head;

    expect(head.querySelector("title")?.textContent).toBe("TeamRun");
  });

  it("gives the Noldova N as an SVG favicon with PNG fallbacks at 32px and 180px", async () => {
    const head = new DOMParser().parseFromString(indexPage, "text/html").head;
    const icons = [...head.querySelectorAll("link[rel=icon], link[rel=apple-touch-icon]")].map(t => [t.getAttribute("rel"), t.getAttribute("href"), t.getAttribute("type"), t.getAttribute("sizes")]);

    expect(icons).toEqual([
      ["icon", "favicon.svg", "image/svg+xml", null],
      ["icon", "favicon-32.png", "image/png", "32x32"],
      ["apple-touch-icon", "apple-touch-icon.png", null, "180x180"]
    ]);
    const served: string[] = [];
    for (const [, href] of icons) {
      const response = await fetch(new URL(String(href), document.baseURI));
      const bytes = new Uint8Array(await response.arrayBuffer());
      const isPng = new TextDecoder().decode(bytes.subarray(1, 4)) === "PNG";
      const isSvg = new TextDecoder().decode(bytes).includes("<svg");
      served.push(`${href} ${response.status} ${isPng ? "png" : isSvg ? "svg" : "other"}`);
    }

    expect(served).toEqual(["favicon.svg 200 svg", "favicon-32.png 200 png", "apple-touch-icon.png 200 png"]);
  });
});
