/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BrowserMatchersFixture } from "./browser-matchers.fixture";

describe("BrowserMatchersFixture", () => {
  const script = "/@fs/vitest/browser/dist/expect-element.js";

  function page(source: string | null): Document {
    const created = document.implementation.createHTMLDocument();
    if (source !== null) {
      const element = created.createElement("script");
      element.type = "module";
      element.src = source;
      created.head.appendChild(element);
    }
    return created;
  }

  function request(name: string, responseStatus: number): PerformanceResourceTiming {
    return { name, responseStatus } as PerformanceResourceTiming;
  }

  it("passes in this page, where the browser matchers loaded", () => {
    expect(() => BrowserMatchersFixture.ensure()).not.toThrow();
  });

  it("fails naming the matchers' script and the page's failed requests when expect.element is missing", () => {
    const requests = [request("/a.js", 200), request("/b.js", 504), request("/c.js", 304), request("/d.js", 0), request("/e.js", 404)];

    expect(() => BrowserMatchersFixture.ensure({}, page(script), requests)).toThrow(`Vitest's browser matchers did not load in this page, so expect.element is missing. Their script is ${script}. `
      + "Requests in this page that failed: /b.js (504), /d.js (0), /e.js (404).");
  });

  it("says when the page has no matchers' script and no request failed", () => {
    expect(() => BrowserMatchersFixture.ensure({ element: true }, page(null), [request("/a.js", 200)])).toThrow("Their script is missing from the page. Requests in this page that failed: none.");
  });
});
