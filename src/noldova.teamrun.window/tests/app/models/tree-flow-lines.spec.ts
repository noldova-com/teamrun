/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FlowBox } from "../../../src/app/models/flow-box";
import { FlowPoint } from "../../../src/app/models/flow-point";
import { TreeFlowLines } from "../../../src/app/models/tree-flow-lines";

describe("TreeFlowLines", () => {
  const at = (left: number, top: number, width: number, height: number): string => `position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px`;
  const markup = [
    `<style>.reports::before { position: absolute; top: 0; height: 12px; content: ""; }</style>`,
    `<div data-flow-node="you" data-flow-shape="Root" style="${at(0, 0, 40, 20)}"></div>`,
    `<div class="stem" style="${at(100, 10, 2, 20)}"></div>`,
    `<div data-flow-node="leader" data-flow-parent="department" data-flow-shape="Stem" style="${at(60, 30, 100, 40)}"></div>`,
    `<div class="reports" style="${at(20, 80, 150, 100)}"><div data-flow-node="member" data-flow-parent="leader" data-flow-shape="Grid"
      style="${at(30, 20, 100, 40)}"></div></div>`,
    `<div><div class="kids" style="${at(200, 0, 180, 200)}"><div class="kid" style="${at(20, 20, 60, 100)}"><div data-flow-node="report" data-flow-parent="you"
      data-flow-shape="Bus" style="${at(0, 30, 60, 40)}"></div></div></div></div>`,
    `<div><div data-flow-node="lonely" data-flow-shape="Stem"></div></div>`,
    `<div data-flow-node="loose" data-flow-shape="Grid"></div>`,
    `<div data-flow-node="outside" data-flow-shape="Bus"></div>`,
    `<div class="kid"><div data-flow-node="kidless" data-flow-shape="Bus"></div></div>`,
    `<div><div class="kids" style="${at(200, 120, 180, 60)}"><div class="kid" style="${at(100, 12, 60, 48)}"><div data-flow-node="kidReport" data-flow-parent="you"
      data-flow-shape="Grid" style="${at(0, 12, 60, 36)}"></div></div></div></div>`,
    `<div><div class="reports" style="${at(0, 200, 120, 60)}; column-gap: 10px"><div style="${at(10, 20, 40, 15)}"></div><div style="${at(60, 20, 40, 15)}"></div>`,
    `<div data-flow-node="second" data-flow-parent="head" data-flow-shape="Grid" style="${at(10, 41, 40, 15)}"></div></div><div class="adds"></div>`,
    `<div class="kids" style="${at(0, 260, 120, 40)}"><div class="kid" style="${at(0, 8, 60, 30)}"><div data-flow-node="nested"`,
    ` data-flow-parent="head" data-flow-shape="Bus" style="${at(0, 10, 60, 20)}"></div></div></div></div>`,
    `<div><div class="reports" style="${at(200, 200, 100, 40)}; column-gap: 16px"><div style="${at(20, 24, 60, 16)}"></div></div>`,
    `<div class="kids" style="${at(200, 240, 100, 40)}"><div class="kid" style="${at(0, 12, 100, 28)}"><div data-flow-node="under" data-flow-parent="head"`,
    ` data-flow-shape="Bus" style="${at(20, 12, 80, 16)}"></div></div><div class="kid" style="${at(-150, 12, 60, 28)}"><div data-flow-node="aside"`,
    ` data-flow-parent="head" data-flow-shape="Bus" style="${at(0, 12, 60, 16)}"></div></div></div></div>`
  ].join("");
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.setAttribute("style", `${at(0, 0, 400, 300)}; transform-origin: 0 0; transform: scale(2)`);
    container.innerHTML = markup;
    document.body.append(container);
  });

  afterEach(() => container.remove());

  it("reads each marked node's parent, box and line up to its parent in the container's own unzoomed pixels, along a stem, a report grid's bus or a department bus, which a report in no grid takes too", () => {
    const nodes = TreeFlowLines.nodesIn(container);
    const lines = (key: string): string[] => (nodes.get(key)?.uplink ?? []).map(t => `${t.x},${t.y}`);

    expect([...nodes.keys()]).toEqual(["you", "leader", "member", "report", "lonely", "loose", "outside", "kidless", "kidReport", "second", "nested", "under", "aside"]);
    expect([nodes.get("you")?.parentKey, nodes.get("member")?.parentKey, nodes.get("leader")?.box]).toEqual([null, "leader", new FlowBox(60, 30, 100, 40)]);
    expect(["leader", "member", "report"].map(lines)).toEqual([["101,30", "101,10"], ["100,100", "100,92", "95,92", "95,80"], ["250,50", "250,20", "290,20", "290,0"]]);
    expect(["you", "lonely", "loose", "outside", "kidless"].map(lines)).toEqual([[], [], [], [], []]);
    expect(lines("kidReport")).toEqual(["330,144", "330,132", "290,132", "290,120"]);
  });

  it("takes a report below a grid's first row and a department under a grid past one side, half the grid's column gap from the cards, then over the bus or, past a one-column grid, into its head", () => {
    const nodes = TreeFlowLines.nodesIn(container);
    const lines = (key: string): string[] => (nodes.get(key)?.uplink ?? []).map(t => `${t.x},${t.y}`);

    expect(["second", "nested", "under", "aside"].map(lines)).toEqual([["30,246", "55,246", "55,212", "60,212", "60,200"],
      ["30,283", "55,283", "55,212", "60,212", "60,200"], ["260,272", "288,272", "288,192", "250,192", "250,200"],
      ["80,264", "80,252", "212,252", "212,192", "250,192", "250,200"]]);
  });

  it("reads a hidden container at its own scale", () => {
    container.style.display = "none";

    expect(TreeFlowLines.nodesIn(container).get("leader")?.uplink).toEqual([new FlowPoint(0, 0), new FlowPoint(0, 0)]);
  });
});
