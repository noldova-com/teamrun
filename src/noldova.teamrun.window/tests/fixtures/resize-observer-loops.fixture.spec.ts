/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ResizeObserverLoops } from "./resize-observer-loops.fixture";

describe("ResizeObserverLoops", () => {
  const loop = "ResizeObserver loop completed with undelivered notifications.";

  it("keeps each ResizeObserver loop the page reports until taken, and only once", () => {
    const target = new EventTarget();
    const loops = new ResizeObserverLoops(target);
    target.dispatchEvent(new ErrorEvent("error", { message: loop }));
    target.dispatchEvent(new ErrorEvent("error", { message: "ResizeObserver loop limit exceeded" }));

    expect(loops.take()).toEqual([loop, "ResizeObserver loop limit exceeded"]);
    expect(loops.take()).toEqual([]);
  });

  it("leaves out every other error the page reports", () => {
    const target = new EventTarget();
    const loops = new ResizeObserverLoops(target);
    target.dispatchEvent(new ErrorEvent("error", { message: "TypeError: x is undefined" }));
    target.dispatchEvent(new Event("error"));

    expect(loops.take()).toEqual([]);
  });

  it("is one recorder for the page", () => {
    expect(ResizeObserverLoops.shared).toBe(ResizeObserverLoops.shared);
  });
});
