/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { SplitAxis } from "../../../../src/app/enums/split-axis";
import { Bounds } from "../../../../src/app/models/layout/bounds";
import type { GroupFrame } from "../../../../src/app/models/layout/group-frame";
import type { SplitHandle } from "../../../../src/app/models/layout/split-handle";
import { SplitPart } from "../../../../src/app/models/layout/split-part";
import { SplitNode } from "../../../../src/app/models/layout/split.node";
import { TabGroup } from "../../../../src/app/models/layout/tab-group";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { ViewType } from "../../../../src/app/models/layout/view-type";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("SplitNode", () => {
  const { createSplit, weightsOf } = LayoutFixture;
  const files = new TabGroup(1, [LayoutFixture.files], LayoutFixture.files);
  const changes = new TabGroup(2, [LayoutFixture.changes], LayoutFixture.changes);
  const terminal = new TabGroup(3, [LayoutFixture.terminal], LayoutFixture.terminal);
  const stack = createSplit(5, SplitAxis.Vertical, [changes, terminal], [1, 3]);
  const node = createSplit(4, SplitAxis.Horizontal, [files, stack], [1, 3]);

  const arrange = (split: SplitNode, bounds: Bounds): { frames: GroupFrame[]; handles: SplitHandle[] } => {
    const frames: GroupFrame[] = [];
    const handles: SplitHandle[] = [];
    split.arrange(bounds, DockSide.Left, frames, handles);
    return { frames, handles };
  };

  it("needs two or more parts with weights that are finite, not negative and not all zero", () => {
    expect(() => new SplitNode(9, SplitAxis.Horizontal, [])).toThrow(ArgumentException);
    expect(() => createSplit(9, SplitAxis.Horizontal, [files], [1])).toThrow(ArgumentException);
    expect(() => createSplit(9, SplitAxis.Horizontal, [files, changes], [-1, 2])).toThrow(ArgumentException);
    expect(() => createSplit(9, SplitAxis.Horizontal, [files, changes], [Number.NaN, 2])).toThrow(ArgumentException);
    expect(() => createSplit(9, SplitAxis.Horizontal, [files, changes], [0, 0])).toThrow(ArgumentException);
  });

  it("normalizes the weights so they add up to one", () => {
    expect(weightsOf(node)).toEqual([0.25, 0.75]);
    expect(weightsOf(createSplit(9, SplitAxis.Horizontal, [files, changes], [0, 2]))).toEqual([0, 1]);
    expect(node.parts.map(t => t.node)).toEqual([files, stack]);
  });

  it("joins parts into a split, a single node or nothing", () => {
    expect(SplitNode.join(9, SplitAxis.Vertical, [])).toBeNull();
    expect(SplitNode.join(9, SplitAxis.Vertical, [new SplitPart(files, 0)])).toBe(files);
    expect(SplitNode.join(9, SplitAxis.Vertical, [new SplitPart(files, 1), new SplitPart(changes, 2)]))
      .toEqual(createSplit(9, SplitAxis.Vertical, [files, changes], [1, 2]));
    expect(SplitNode.join(9, SplitAxis.Vertical, [new SplitPart(files, 0), new SplitPart(changes, 0)]))
      .toEqual(createSplit(9, SplitAxis.Vertical, [files, changes], [1, 1]));
  });

  it("places an added node beside another along an edge", () => {
    expect(SplitNode.beside(files, changes, PanelEdge.Left, 9)).toEqual(createSplit(9, SplitAxis.Horizontal, [changes, files], [1, 1]));
    expect(SplitNode.beside(files, changes, PanelEdge.Right, 9)).toEqual(createSplit(9, SplitAxis.Horizontal, [files, changes], [1, 1]));
    expect(SplitNode.beside(files, changes, PanelEdge.Top, 9)).toEqual(createSplit(9, SplitAxis.Vertical, [changes, files], [1, 1]));
    expect(SplitNode.beside(files, changes, PanelEdge.Bottom, 9)).toEqual(createSplit(9, SplitAxis.Vertical, [files, changes], [1, 1]));
  });

  it("lists its groups and ids and finds the corner group", () => {
    expect(node.groups).toEqual([files, changes, terminal]);
    expect(node.nodeIds).toEqual([4, 1, 5, 2, 3]);
    expect(node.cornerGroup).toBe(changes);
    expect(stack.cornerGroup).toBe(changes);
  });

  it("adds minimums and gaps along its axis and takes the largest across it", () => {
    expect(node.minimumLength(SplitAxis.Horizontal)).toBe(20.25);
    expect(node.minimumLength(SplitAxis.Vertical)).toBe(12.75);
  });

  it("replaces, removes and splits groups, closing a split left with one part", () => {
    const renamed = new TabGroup(3, [LayoutFixture.secondTerminal], LayoutFixture.secondTerminal);
    const added = new TabGroup(8, [LayoutFixture.search], LayoutFixture.search);

    expect(node.withGroup(new TabGroup(7, [LayoutFixture.search], LayoutFixture.search))).toBe(node);
    expect(node.withGroup(renamed).groups).toEqual([files, changes, renamed]);
    expect(node.withoutGroup(7)).toBe(node);
    expect(node.withoutGroup(3)).toEqual(createSplit(4, SplitAxis.Horizontal, [files, changes], [1, 3]));
    expect(node.withoutGroup(1)).toBe(stack);
    expect(createSplit(6, SplitAxis.Vertical, [files, changes, terminal], [0, 0, 1]).withoutGroup(3))
      .toEqual(createSplit(6, SplitAxis.Vertical, [files, changes], [1, 1]));
    expect(node.splitGroup(1, added, PanelEdge.Top, 9).groups).toEqual([added, files, changes, terminal]);
    expect(node.splitGroup(7, added, PanelEdge.Top, 9)).toBe(node);
  });

  it("replaces the split with the same id", () => {
    const evenNode = createSplit(4, SplitAxis.Horizontal, [files, stack], [1, 1]);
    const evenStack = createSplit(5, SplitAxis.Vertical, [changes, terminal], [1, 1]);

    expect(node.withSplit(evenNode)).toBe(evenNode);
    expect(weightsOf((node.withSplit(evenStack) as SplitNode).parts[1]?.node ?? node)).toEqual([0.5, 0.5]);
    expect(node.withSplit(createSplit(9, SplitAxis.Vertical, [files, changes], [1, 1]))).toBe(node);
  });

  it("keeps the parts that have registered views", () => {
    const registry = new ViewRegistry([new ViewType("files.tree", DockSide.Left, true), new ViewType("git.changes", DockSide.Right, true)], []);

    expect(node.withVisibleTabs(LayoutFixture.createRegistry())).toBe(node);
    expect(node.withVisibleTabs(registry)).toEqual(createSplit(4, SplitAxis.Horizontal, [files, changes], [1, 3]));
    expect(node.withVisibleTabs(ViewRegistry.createEmpty())).toBeNull();
  });

  it("shares the space beyond the minimums by weight and places a handle in each gap", () => {
    const { frames, handles } = arrange(node, new Bounds(0, 0, 60.25, 40.25));

    expect(frames.map(t => t.bounds)).toEqual([new Bounds(0, 0, 20, 40.25), new Bounds(20.25, 0, 40, 13.125), new Bounds(20.25, 13.375, 40, 26.875)]);
    expect(frames.map(t => t.side)).toEqual([DockSide.Left, DockSide.Left, DockSide.Left]);
    expect(handles.map(t => [t.split.id, t.index, t.bounds, t.leadingLength])).toEqual([
      [4, 0, new Bounds(20, 0, 0.25, 40.25), 20],
      [5, 0, new Bounds(20.25, 13.125, 40, 0.25), 13.125]
    ]);
  });

  it("shrinks parts in proportion to their minimums when the minimums do not fit", () => {
    const { frames } = arrange(createSplit(4, SplitAxis.Horizontal, [files, changes], [1, 3]), new Bounds(0, 0, 10.25, 5));

    expect(frames.map(t => t.bounds)).toEqual([new Bounds(0, 0, 5, 5), new Bounds(5.25, 0, 5, 5)]);
    expect(arrange(node, new Bounds(0, 0, 0, 0)).frames.map(t => t.bounds.width)).toEqual([0, 0, 0]);
  });

  it("writes its axis and each part with its weight", () => {
    expect(createSplit(4, SplitAxis.Horizontal, [files, changes], [1, 3]).toJson()).toEqual({
      axis: "Horizontal",
      children: [{ tabs: [{ view: "files.tree" }], active: 0, weight: 0.25 }, { tabs: [{ view: "git.changes" }], active: 0, weight: 0.75 }]
    });
  });
});
