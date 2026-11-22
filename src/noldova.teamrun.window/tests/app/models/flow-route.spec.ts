/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FlowBox } from "../../../src/app/models/flow-box";
import { FlowNode } from "../../../src/app/models/flow.node";
import { FlowPoint } from "../../../src/app/models/flow-point";
import { FlowRoute } from "../../../src/app/models/flow-route";

describe("FlowRoute", () => {
  const at = (x: number, y: number): FlowPoint => new FlowPoint(x, y);
  const nodeOf = (key: string, parentKey: string | null, ...points: readonly FlowPoint[]): FlowNode =>
    new FlowNode(key, parentKey, new FlowBox(key.length, 0, 10, 5), points);
  const nodes = new Map([nodeOf("you", null), nodeOf("a", "you", at(1, 1), at(1, 0)), nodeOf("b", "a", at(2, 3), at(2.004, 2)),
    nodeOf("c", "you", at(5, 1), at(5, 0)), nodeOf("lost", "gone", at(7, 7)), nodeOf("x", "y", at(8, 8)), nodeOf("y", "x", at(9, 9)),
    nodeOf("alone", null, at(6, 6)), nodeOf("u", "you", at(3, 5), at(3, 2), at(0, 2), at(0, 0)), nodeOf("v", "you", at(1, 4), at(1, 2), at(0, 2), at(0, 0)),
    nodeOf("w", "you", at(6, 3), at(6, 2), at(6, 0))].map(t => [t.key, t]));

  it("goes up from its sender to the first node they share, then down to its receiver, and ends on the receiver's box", () => {
    const across = FlowRoute.between(nodes, "b", "c");
    const down = FlowRoute.between(nodes, "you", "b");
    const up = FlowRoute.between(nodes, "b", "a");

    expect([across?.path, down?.path, up?.path]).toEqual(["M 2 3 L 2 2 L 1 1 L 1 0 L 5 0 L 5 1", "M 1 0 L 1 1 L 2 2 L 2 3", "M 2 3 L 2 2"]);
    expect([across?.target, down?.target]).toEqual([new FlowBox(1, 0, 10, 5), new FlowBox(1, 0, 10, 5)]);
  });

  it("leaves out a stretch the route would go back along, where its two sides meet or run along the same line, and keeps a straight run", () => {
    const met = FlowRoute.between(nodes, "u", "v");
    const straight = FlowRoute.between(nodes, "w", "you");

    expect([met?.path, straight?.path]).toEqual(["M 3 5 L 3 2 L 1 2 L 1 4", "M 6 3 L 6 2 L 6 0"]);
  });

  it("finds no route to or from a node it doesn't hold, through a missing parent or a loop, between two roots or from a node to itself", () => {
    const senders = ["nobody", "a", "lost", "a", "x", "a", "alone", "a"];
    const receivers = ["a", "nobody", "a", "lost", "a", "x", "a", "a"];

    expect(senders.map((t, i) => FlowRoute.between(nodes, t, receivers.at(i) ?? t))).toEqual(new Array<null>(senders.length).fill(null));
  });
});
