/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class BrowserMatchersFixture {
  public static readonly SCRIPT_SELECTOR: string = "script[type=\"module\"][src*=\"expect-element\"]";
  private static readonly NO_SCRIPT: string = "missing from the page";
  private static readonly NO_FAILED_REQUEST: string = "none";

  public static ensure(target: object = expect, page: Document = document,
    requests: readonly PerformanceResourceTiming[] = performance.getEntriesByType("resource").filter(t => t instanceof PerformanceResourceTiming)): void {
    if ("element" in target && typeof target.element === "function")
      return;
    const script = page.querySelector(BrowserMatchersFixture.SCRIPT_SELECTOR)?.getAttribute("src") ?? BrowserMatchersFixture.NO_SCRIPT;
    throw new Error(`Vitest's browser matchers did not load in this page, so expect.element is missing. Their script is ${script}. `
      + `Requests in this page that failed: ${BrowserMatchersFixture.failed(requests)}.`);
  }

  private static failed(requests: readonly PerformanceResourceTiming[]): string {
    const failed = requests.filter(t => t.responseStatus < 200 || t.responseStatus >= 400);
    return failed.length === 0 ? BrowserMatchersFixture.NO_FAILED_REQUEST : failed.map(t => `${t.name} (${t.responseStatus})`).join(", ");
  }
}
