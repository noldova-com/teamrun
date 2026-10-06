/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ScrollOffset } from "../../../src/app/models/scroll-offset";

describe("ScrollOffset", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    root.style.cssText = "width: 100px; height: 100px; overflow: auto";
    root.innerHTML = "<div style=\"width: 400px; height: 400px\"></div>";
    document.body.append(root);
  });

  afterEach(() => root.remove());

  it("reads an element's offsets and puts them back once the page has dropped them", () => {
    root.scrollTop = 40;
    root.scrollLeft = 30;

    const offset = ScrollOffset.of(root);
    root.remove();
    document.body.append(root);
    const lost = [root.scrollTop, root.scrollLeft];
    offset.restore();

    expect([offset.element, offset.top, offset.left]).toEqual([root, 40, 30]);
    expect(lost).toEqual([0, 0]);
    expect([root.scrollTop, root.scrollLeft]).toEqual([40, 30]);
  });
});
