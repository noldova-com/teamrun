/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CardFlowLines } from "../../../src/app/models/card-flow-lines";
import { FlowBox } from "../../../src/app/models/flow-box";

describe("CardFlowLines", () => {
  const at = (left: number, top: number, width: number, height: number): string => `position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px`;
  let canvas: HTMLElement;
  let container: HTMLElement;
  let chat: HTMLElement;

  beforeEach(() => {
    canvas = document.createElement("nol-canvas");
    canvas.setAttribute("style", at(200, 200, 500, 300));
    container = document.createElement("div");
    container.setAttribute("style", at(0, 0, 400, 300));
    container.innerHTML = [
      `<div data-flow-node="a" style="${at(10, 10, 100, 40)}"></div>`,
      `<div data-flow-node="b" style="${at(200, 100, 100, 40)}"></div>`,
      `<div data-flow-node="c" style="${at(10, 100, 100, 40)}"></div>`,
      `<div data-flow-node="d" style="${at(20, 20, 50, 50)}"></div>`,
      `<div data-flow-node="a" style="${at(300, 250, 50, 20)}"></div>`
    ].join("");
    canvas.append(container);
    chat = document.createElement("div");
    document.body.append(canvas, chat);
  });

  afterEach(() => {
    container.remove();
    canvas.remove();
    chat.remove();
  });

  const route = (fromKey: string, toKey: string, panel: HTMLElement | null = chat): [string, FlowBox | null] | null => {
    const found = CardFlowLines.of(container, panel).between(fromKey, toKey);
    return Object.isNull(found) ? null : [found.path, found.target];
  };

  it("runs at right angles from a card's edge to another's, across the gap between their columns or between their rows, and from a key's first card", () => {
    const b = new FlowBox(200, 100, 100, 40);
    const a = new FlowBox(10, 10, 100, 40);
    const c = new FlowBox(10, 100, 100, 40);

    expect([route("a", "b"), route("b", "a"), route("a", "c"), route("c", "a")]).toEqual([["M 110 30 L 155 30 L 155 120 L 200 120", b],
      ["M 200 120 L 155 120 L 155 30 L 110 30", a], ["M 60 50 L 60 75 L 60 100", c], ["M 60 100 L 60 75 L 60 50", a]]);
  });

  it("draws no route between overlapping cards, nor to or from a key with no card", () => {
    expect([route("a", "d"), route("a", "nobody"), route("nobody", "a"), route("person", "nobody")]).toEqual([null, null, null, null]);
  });

  it("starts your messages at the canvas's edge on the chat panel's side, level with the card, and ends a teammate's message to you there with no card to glow", () => {
    const b = new FlowBox(200, 100, 100, 40);
    const placed = (left: number, top: number, width: number, height: number): [[string, FlowBox | null] | null, [string, FlowBox | null] | null] => {
      chat.setAttribute("style", at(left, top, width, height));
      return [route("person", "b"), route("b", "person")];
    };

    expect([placed(800, 200, 100, 300), placed(200, 600, 500, 50), placed(0, 200, 100, 300), placed(200, 0, 500, 100)]).toEqual([
      [["M 400 120 L 300 120", b], ["M 300 120 L 400 120", null]], [["M 250 300 L 250 140", b], ["M 250 140 L 250 300", null]],
      [["M 0 120 L 200 120", b], ["M 200 120 L 0 120", null]], [["M 250 0 L 250 100", b], ["M 250 100 L 250 0", null]]]);
  });

  it("takes the container's own box for the canvas when no canvas holds it", () => {
    document.body.append(container);
    chat.setAttribute("style", at(450, 0, 100, 300));

    expect(route("person", "b")).toEqual(["M 400 120 L 300 120", new FlowBox(200, 100, 100, 40)]);
  });

  it("draws none of your messages with no chat panel, a hidden one, or one over the canvas", () => {
    const hidden = (): [string, FlowBox | null] | null => {
      chat.setAttribute("style", `${at(800, 200, 100, 300)}; display: none`);
      return route("person", "b");
    };
    const over = (): [string, FlowBox | null] | null => {
      chat.setAttribute("style", at(300, 300, 50, 50));
      return route("person", "b");
    };

    expect([route("person", "b", null), hidden(), over()]).toEqual([null, null, null]);
  });
});
