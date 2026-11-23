/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FlowBox } from "../../../src/app/models/flow-box";
import { FlowFrame } from "../../../src/app/models/flow-frame";
import { Required } from "../../fixtures/required.fixture";

describe("FlowFrame", () => {
  const at = (left: number, top: number, width: number, height: number): string => `position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px`;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => container.remove());

  it("reads a container's layout width without rounding, its padding and border counted once in either box model", () => {
    const sized = (sizing: string): number => {
      container.setAttribute("style", `${at(0, 0, 400.5, 300)}; padding: 0 10px; border: 2px solid; box-sizing: ${sizing}`);
      return FlowFrame.layoutWidthOf(container);
    };

    expect([sized("content-box"), sized("border-box")]).toEqual([424.5, 400.5]);
  });

  it("reads an element's box in the zoomed container's own pixels, and a hidden container's at its own scale", () => {
    container.setAttribute("style", `${at(10, 20, 400, 300)}; transform-origin: 0 0; transform: scale(2)`);
    container.innerHTML = `<div style="${at(30, 40, 100, 50)}"></div>`;
    const card = Required.of(container.firstElementChild);
    const zoomed = new FlowFrame(container).boxOf(card);
    container.style.display = "none";

    expect([zoomed, new FlowFrame(container).boxOf(card)]).toEqual([new FlowBox(30, 40, 100, 50), new FlowBox(0, 0, 0, 0)]);
  });
});
