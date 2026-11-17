/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PointerEventsFixture } from "./pointer-events.fixture";

describe("PointerEventsFixture", () => {
  const heard: string[] = [];
  let outer: HTMLElement;
  let inner: HTMLElement;

  beforeEach(() => {
    heard.length = 0;
    outer = document.createElement("div");
    inner = document.createElement("span");
    outer.append(inner);
    document.body.append(outer);
    for (const [name, element] of [["outer", outer], ["inner", inner]] as const)
      for (const type of ["pointerenter", "pointerleave"])
        element.addEventListener(type, event => heard.push(`${name} ${event.type} ${event instanceof PointerEvent ? event.pointerType : "none"}`));
  });

  afterEach(() => {
    outer.remove();
  });

  it("sends a mouse's pointerenter to each of the element's ancestors and then to it, outermost first, as a pointer crossing onto it from outside the page", () => {
    PointerEventsFixture.enter(inner);

    expect(heard).toEqual(["outer pointerenter mouse", "inner pointerenter mouse"]);
  });

  it("sends a mouse's pointerleave to the element and then to each of its ancestors, innermost first, as a pointer leaving the page from it", () => {
    PointerEventsFixture.leave(inner);

    expect(heard).toEqual(["inner pointerleave mouse", "outer pointerleave mouse"]);
  });
});
