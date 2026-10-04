/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DockSide } from "../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { Layout } from "../../../src/app/models/layout/layout";
import { SideDropTarget } from "../../../src/app/models/layout/side-drop-target";
import { SplitDropTarget } from "../../../src/app/models/layout/split-drop-target";
import type { Tab } from "../../../src/app/models/layout/tab";
import { GroupDropTarget } from "../../../src/app/models/layout/group-drop-target";
import { TabDropTarget } from "../../../src/app/models/layout/tab-drop-target";
import { LayoutStoreService } from "../../../src/app/services/layout-store.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { TabDragService } from "../../../src/app/services/tab-drag.service";
import { Resources } from "../../../src/resources";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";

describe("TabDragService", () => {
  beforeEach(() => {
    DesktopBridgeFixture.install();
  });

  afterEach(() => {
    DesktopBridgeFixture.remove();
  });

  const registry = LayoutFixture.createRegistry();
  let layout: LayoutService;
  let drag: TabDragService;
  let root: HTMLElement;
  let under: Element | null;

  beforeEach(async () => {
    layout = TestBed.inject(LayoutService);
    drag = TestBed.inject(TabDragService);
    layout.setRegistry(registry);
    const prepared = Layout.createDefault(registry).openView(LayoutFixture.search, registry).openDocument(LayoutFixture.plan).openDocument(LayoutFixture.todo);
    await TestBed.inject(LayoutStoreService).writeAsync(prepared.toJson());
    await layout.loadAsync();
    root = document.createElement("div");
    root.innerHTML = [
      "<div data-drop-group=\"1\"><div data-drop-tabs><span class=\"files\" data-tab-index=\"0\"></span><span class=\"search\" data-tab-index=\"1\"></span>",
      "<span class=\"close tr-tab-close\"></span></div><div class=\"body\"></div></div>",
      "<div data-drop-group=\"0\"><div data-drop-tabs><span class=\"plan\" data-tab-index=\"0\"></span><span class=\"todo\" data-tab-index=\"1\"></span>",
      "<span class=\"rest\"></span></div></div>",
      "<div data-drop-group=\"2\"><div data-drop-tabs><span class=\"changes\" data-tab-index=\"0\"></span></div></div>",
      "<div data-drop-plate data-drop-group=\"2\"><span class=\"arrow\" data-direction=\"Top\"></span><span class=\"center\" data-direction=\"Center\"></span>",
      "<span class=\"gap\"></span></div>",
      "<div data-drop-plate data-drop-group=\"0\"><span class=\"documents-arrow\" data-direction=\"Left\"></span><span class=\"documents-center\" data-direction=\"Center\"></span></div>",
      "<div data-drop-plate data-drop-group=\"9\"><span class=\"stale\" data-direction=\"Left\"></span></div>",
      "<span class=\"side\" data-drop-side=\"Bottom\"></span><span class=\"unknown\" data-drop-side=\"Top\"></span>",
      "<span class=\"outside\"></span>",
      "<div data-drop-group=\"1\" data-drop-tabs><span class=\"vertical\" data-drop-before=\"1:0\" data-drop-after=\"1:1\" data-drop-axis=\"vertical\"></span>",
      "<span class=\"horizontal\" data-drop-before=\"2:0\" data-drop-after=\"2:1\" data-drop-axis=\"horizontal\"></span>",
      "<span class=\"gone\" data-drop-before=\"9:0\" data-drop-after=\"9:1\" data-drop-axis=\"vertical\"></span></div>"
    ].join("");
    document.body.append(root);
    for (const marker of root.querySelectorAll<HTMLElement>("[data-tab-index], [data-drop-before]")) {
      marker.style.display = "inline-block";
      marker.style.width = "100px";
      marker.style.height = "20px";
    }
    under = null;
    vi.spyOn(document, "elementFromPoint").mockImplementation(() => under);
  });

  afterEach(() => {
    root.remove();
    vi.restoreAllMocks();
  });

  function element(name: string): HTMLElement {
    const found = root.querySelector<HTMLElement>(`.${name}`);
    if (Object.isNull(found))
      throw new Error(`No .${name} element.`);
    return found;
  }

  function start(tab: Tab, from: Element = element("files"), button: number = 0): void {
    const event = new PointerEvent("pointerdown", { button, clientX: 10, clientY: 10, bubbles: true });
    from.addEventListener("pointerdown", () => drag.begin(tab, event), { once: true });
    from.dispatchEvent(event);
  }

  function moveWithin(name: string, x: number, y: number): void {
    under = element(name);
    const bounds = under.getBoundingClientRect();
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: bounds.left + x, clientY: bounds.top + y }));
  }

  function moveOver(name: string | null, x: number = 50): void {
    under = Object.isNull(name) ? null : element(name);
    const left = Object.isNull(under) ? 0 : under.getBoundingClientRect().left;
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: left + x, clientY: 40 }));
  }

  it("starts dragging past the threshold with the primary button and not from a close button or another button", () => {
    start(LayoutFixture.files, element("close"));
    moveOver("side");
    expect(drag.dragging()).toBeNull();

    start(LayoutFixture.files, element("files"), 2);
    moveOver("side");
    expect(drag.dragging()).toBeNull();

    start(LayoutFixture.files);
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 11, clientY: 11 }));
    expect(drag.dragging()).toBeNull();
    moveOver("side");
    expect(drag.dragging()).toEqual(LayoutFixture.files);
    expect(document.body.classList.contains(Resources.draggingClass)).toBe(true);
    expect(drag.pointerY()).toBe(40);

    start(LayoutFixture.search, document.body);
    expect(drag.dragging()).toBeNull();
    expect(document.body.classList.contains(Resources.draggingClass)).toBe(false);
  });

  it("targets a side guide, a plate's arrows and center and the tab strip for a view", () => {
    start(LayoutFixture.files);
    moveOver("side");
    expect(drag.target()).toEqual(new SideDropTarget(DockSide.Bottom));
    moveOver("unknown");
    expect(drag.target()).toBeNull();
    moveOver("arrow");
    expect(drag.target()).toEqual(new SplitDropTarget(2, PanelEdge.Top));
    expect(drag.hoveredGroup()).toBe(2);
    moveOver("center");
    expect(drag.target()).toEqual(new GroupDropTarget(2));
    moveOver("gap");
    expect(drag.target()).toBeNull();
    moveOver("stale");
    expect(drag.target()).toBeNull();
    expect(drag.hoveredGroup()).toBeNull();
    moveOver("search", 10);
    expect(drag.target()).toEqual(new TabDropTarget(1, 1));
    expect(drag.isDropBefore(1, 1)).toBe(true);
    expect(drag.hoveredGroup()).toBeNull();
    moveOver("search", 90);
    expect(drag.target()).toEqual(new TabDropTarget(1, 2));
    moveOver("rest");
    expect(drag.target()).toEqual(new TabDropTarget(0, 2));
    moveOver("rest");
    expect(drag.target()).toEqual(new TabDropTarget(0, 2));
    moveOver("body");
    expect(drag.target()).toBeNull();
    expect(drag.hoveredGroup()).toBe(1);
    moveOver("outside");
    expect(drag.target()).toBeNull();
    moveOver("search", 10);
    moveOver(null);
    expect([drag.target(), drag.hoveredGroup(), drag.dragging()]).toEqual([null, null, LayoutFixture.files]);
  });

  it("takes the after half of a tab or a horizontal strip icon from the left in a right-to-left row", () => {
    root.dir = "rtl";
    start(LayoutFixture.files);
    const targets: unknown[] = [];
    for (const [name, x] of [["files", 10], ["files", 90], ["search", 10], ["search", 90]] as const) {
      moveOver(name, x);
      targets.push(drag.target());
    }
    for (const x of [30, 70]) {
      moveWithin("horizontal", x, 5);
      targets.push(drag.target());
    }

    expect(targets).toEqual([new TabDropTarget(1, 1), new TabDropTarget(1, 0), new TabDropTarget(1, 2), new TabDropTarget(1, 1), new TabDropTarget(2, 1), new TabDropTarget(2, 0)]);
  });

  it("targets the place before or after a strip icon along the strip's axis, for a group that takes the tab", () => {
    start(LayoutFixture.changes);
    const targets: (unknown)[] = [];
    for (const [name, x, y] of [["vertical", 90, 5], ["vertical", 10, 15], ["horizontal", 30, 15], ["horizontal", 70, 5], ["gone", 50, 5]] as const) {
      moveWithin(name, x, y);
      targets.push(drag.target());
    }
    document.dispatchEvent(new PointerEvent("pointerup"));
    start(LayoutFixture.plan, element("plan"));
    moveWithin("vertical", 50, 5);

    expect(targets).toEqual([new TabDropTarget(1, 0), new TabDropTarget(1, 1), new TabDropTarget(2, 0), new TabDropTarget(2, 1), null]);
    expect(drag.target()).toBeNull();
  });

  it("places the tab where it is dropped and changes nothing without a target", () => {
    start(LayoutFixture.files);
    moveOver("side");
    document.dispatchEvent(new PointerEvent("pointerup"));
    expect(layout.layout().sideOf(layout.layout().groupOf(LayoutFixture.files)?.id ?? -1)).toBe(DockSide.Bottom);
    expect(drag.dragging()).toBeNull();
    expect(drag.target()).toBeNull();

    const before = layout.layout();
    start(LayoutFixture.search);
    moveOver("outside");
    document.dispatchEvent(new PointerEvent("pointerup"));
    expect(layout.layout()).toBe(before);

    start(LayoutFixture.search);
    document.dispatchEvent(new PointerEvent("pointerup"));
    expect(layout.layout()).toBe(before);
  });

  it("moves a tab into another group's row at the place before the tab under the pointer", () => {
    start(LayoutFixture.files);
    moveOver("changes", 10);
    document.dispatchEvent(new PointerEvent("pointerup"));

    expect(layout.layout().group(2)?.tabs).toEqual([LayoutFixture.files, LayoutFixture.changes]);
  });

  it("cancels on Escape, a cancelled pointer and a lost window focus, and ignores other keys", () => {
    const before = layout.layout();
    const cancels: (() => void)[] = [
      () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })),
      () => document.dispatchEvent(new PointerEvent("pointercancel")),
      () => window.dispatchEvent(new FocusEvent("blur"))
    ];
    for (const cancel of cancels) {
      start(LayoutFixture.files);
      moveOver("side");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
      expect(drag.dragging()).toEqual(LayoutFixture.files);
      cancel();
      expect(drag.dragging()).toBeNull();
      expect(drag.target()).toBeNull();
      document.dispatchEvent(new PointerEvent("pointerup"));
      expect(layout.layout()).toBe(before);
    }

    start(LayoutFixture.files);
    const early = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    document.dispatchEvent(early);
    expect(early.defaultPrevented).toBe(false);
  });

  it("targets a document group's plate and tab strip for a document, and never a side guide or a views group", () => {
    start(LayoutFixture.plan, element("plan"));
    moveOver("side");
    expect(drag.dragging()).toEqual(LayoutFixture.plan);
    expect(drag.target()).toBeNull();
    moveOver("center");
    expect(drag.target()).toBeNull();
    moveOver("arrow");
    expect(drag.target()).toBeNull();
    moveOver("files");
    expect(drag.target()).toBeNull();
    moveOver("documents-arrow");
    expect(drag.target()).toEqual(new SplitDropTarget(0, PanelEdge.Left));
    moveOver("documents-center");
    expect(drag.target()).toEqual(new GroupDropTarget(0));
    moveOver("todo", 90);
    expect(drag.target()).toEqual(new TabDropTarget(0, 2));
    document.dispatchEvent(new PointerEvent("pointerup"));

    expect(layout.layout().documents.tabs).toEqual([LayoutFixture.todo, LayoutFixture.plan]);
  });
});
