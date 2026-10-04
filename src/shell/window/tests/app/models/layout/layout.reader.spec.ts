/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";

import { BottomDockSpan } from "../../../../src/app/enums/bottom-dock-span";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { SplitAxis } from "../../../../src/app/enums/split-axis";
import { Dock } from "../../../../src/app/models/layout/dock";
import { DocumentGroup } from "../../../../src/app/models/layout/document-group";
import { Layout } from "../../../../src/app/models/layout/layout";
import { LayoutReader } from "../../../../src/app/models/layout/layout.reader";
import { TabGroup } from "../../../../src/app/models/layout/tab-group";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("LayoutReader", () => {
  const { files, search, changes, terminal, secondTerminal, plan, createSplit } = LayoutFixture;
  const gone = new ViewTab("gone.view");
  const documents = { tabs: [], active: null, documents: true };
  const dock = (root: unknown = null, size: unknown = null, collapsed: unknown = false): Record<string, unknown> => ({ root, size, collapsed });
  const saved = (docks: Record<string, unknown> = {}, middle: unknown = documents, version: unknown = 1, bottomSpan: unknown = "Full"): Record<string, unknown> => ({
    version,
    docks: { Left: dock(), Right: dock(), Bottom: dock(), ...docks },
    middle,
    bottomSpan,
    activeDocuments: 0
  });
  const group = (...tabs: readonly unknown[]): Record<string, unknown> => ({ tabs, active: 0 });
  const failure = (value: unknown): JsonException => {
    try {
      LayoutReader.read(value);
    }
    catch (error) {
      if (error instanceof JsonException)
        return error;
      throw error;
    }
    throw new Error("The layout was read without a failure.");
  };
  const full = saved({
    Left: dock({
      axis: "Vertical",
      children: [
        { tabs: [{ view: "files.tree" }, { view: "files.search" }], active: 1, weight: 0.25 },
        { tabs: [{ view: "gone.view" }], active: 0, weight: 0.75 }
      ]
    }, 30),
    Right: dock(null, null, true),
    Bottom: dock(group({ view: "terminal.shell", instance: "1" }), 12.5)
  }, {
    axis: "Horizontal",
    children: [
      { tabs: [{ document: "notes.note", instance: "plan" }, { view: "git.changes" }], active: 0, documents: true, weight: 0.5 },
      { tabs: [{ view: "terminal.shell", instance: "2" }], active: 0, weight: 0.5 }
    ]
  }, 1, "Between");

  it("reads every dock and the middle, numbering groups and splits in reading order", () => {
    expect(LayoutReader.read(full)).toEqual(new Layout([
      new Dock(DockSide.Left, createSplit(1, SplitAxis.Vertical, [new TabGroup(2, [files, search], search), new TabGroup(3, [gone], gone)], [1, 3]), 30, false),
      new Dock(DockSide.Right, null, null, true),
      new Dock(DockSide.Bottom, new TabGroup(4, [terminal], terminal), 12.5, false)
    ], createSplit(5, SplitAxis.Horizontal, [new DocumentGroup([plan, changes], plan), new TabGroup(6, [secondTerminal], secondTerminal)], [1, 1]), BottomDockSpan.Between));
  });

  it("reads a layout saved without a bottom dock span as full width, and refuses an unknown span", () => {
    const { bottomSpan, ...older } = saved();

    expect([bottomSpan, LayoutReader.read(older).bottomSpan]).toEqual(["Full", BottomDockSpan.Full]);
    expect(failure(saved({}, documents, 1, "Wide")).path).toBe("$.bottomSpan");
  });

  it("writes back what it read, including views whose modules are absent", () => {
    expect(LayoutReader.read(full).toJson()).toEqual(full);
    expect(LayoutReader.read(JSON.parse(JSON.stringify(LayoutReader.read(full).toJson())))).toEqual(LayoutReader.read(full));
  });

  it("reads a group marked as not the documents group as a view group", () => {
    expect(LayoutReader.read(saved({ Left: dock({ ...group({ view: "files.tree" }), documents: false }) })).dock(DockSide.Left).root)
      .toEqual(new TabGroup(1, [files], files));
  });

  it("refuses a value that is not a layout object", () => {
    expect(failure("layout").path).toBe("$");
    expect(failure([]).path).toBe("$");
  });

  it("refuses older and newer format versions and a missing version", () => {
    expect(failure(saved({}, documents, 2)).message).toBe("$: Layout format version 2 is not supported; this build reads version 1.");
    expect(failure(saved({}, documents, 0)).path).toBe("$");
    expect(failure(saved({}, documents, 1.5)).path).toBe("$.version");
    expect(failure({ docks: saved()["docks"], middle: documents }).path).toBe("$.version");
  });

  it("names the dock that is missing or has invalid fields", () => {
    expect(failure({ version: 1, docks: { Left: dock(), Right: dock() }, middle: documents }).path).toBe("$.docks.Bottom");
    expect(failure(saved({ Left: dock(null, "wide") })).path).toBe("$.docks.Left.size");
    expect(failure(saved({ Left: { root: null, size: null } })).path).toBe("$.docks.Left.collapsed");
    expect(failure(saved({ Left: dock(null, 5) })).path).toBe("$.docks.Left");
    expect(failure(saved({ Left: dock(null, 5) })).cause).toBeInstanceOf(ArgumentOutOfRangeException);
  });

  it("names a node that is neither a split nor a group and a split that is not valid", () => {
    expect(failure(saved({ Left: dock({ size: 3 }) })).path).toBe("$.docks.Left.root");
    expect(failure(saved({}, { axis: "Diagonal", children: [] })).path).toBe("$.middle.axis");
    expect(failure(saved({}, { axis: "Vertical", children: [{ ...documents }] })).path).toBe("$.middle.children.0.weight");
    expect(failure(saved({}, { axis: "Vertical", children: [{ ...documents, weight: 1 }] })).path).toBe("$.middle");
    expect(failure(saved({}, { axis: "Vertical", children: [{ ...documents, weight: 1 }] })).cause).toBeInstanceOf(ArgumentException);
  });

  it("names a group whose active tab is missing or whose tabs are not valid", () => {
    expect(failure(saved({ Left: dock({ tabs: [{ view: "files.tree" }], active: 1 }) })).path).toBe("$.docks.Left.root");
    expect(failure(saved({ Left: dock({ tabs: [{ view: "files.tree" }], active: null }) })).path).toBe("$.docks.Left.root");
    expect(failure(saved({ Left: dock(group({ view: "files.tree" }, { view: "files.tree" })) })).path).toBe("$.docks.Left.root");
    expect(failure(saved({ Left: dock(group({ document: "notes.note" })) })).path).toBe("$.docks.Left.root");
    expect(failure(saved({ Left: dock(group({ tool: "files.tree" })) })).path).toBe("$.docks.Left.root.tabs.0");
    expect(failure(saved({ Left: dock(group({ view: "tree" })) })).path).toBe("$.docks.Left.root.tabs.0");
    expect(failure(saved({ Left: dock(group({ document: "Notes" })) })).path).toBe("$.docks.Left.root.tabs.0");
    expect(failure(saved({ Left: dock(group({ view: "terminal.shell", instance: 1 })) })).path).toBe("$.docks.Left.root.tabs.0.instance");
  });

  it("reads and writes a group's preview, reads a missing or empty one as none, and names a preview outside its group", () => {
    const read = LayoutReader.read(saved({ Left: dock({ tabs: [{ view: "files.tree" }, { view: "files.search" }], active: 0, preview: 1 }) }, { ...documents, preview: null }));

    expect(read.dock(DockSide.Left).root?.groups[0]?.preview).toEqual(search);
    expect(read.documents.preview).toBeNull();
    expect(read.toJson()).toEqual(saved({ Left: dock({ tabs: [{ view: "files.tree" }, { view: "files.search" }], active: 0, preview: 1 }) }));
    expect(failure(saved({ Left: dock({ tabs: [{ view: "files.tree" }], active: 0, preview: 1 }) })).path).toBe("$.docks.Left.root");
  });

  it("refuses a layout without one documents group in the middle", () => {
    expect(failure(saved({ Left: dock(documents) })).path).toBe("$");
    expect(failure(saved({}, group({ view: "files.tree" }))).path).toBe("$");
    expect(failure(saved({}, group({ view: "files.tree" }))).message).toBe("$: The value does not describe a valid part of a layout.");
  });
});
