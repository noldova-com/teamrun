/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ToolbarDropTarget } from "../../../src/app/models/toolbar-drop-target";
import { ToolbarDragService } from "../../../src/app/services/toolbar-drag.service";
import { ToolbarService } from "../../../src/app/services/toolbar.service";
import { Resources } from "../../../src/resources";

describe("ToolbarDragService", () => {
  const toolbars = { rows: vi.fn(), move: vi.fn(), moveToNewRow: vi.fn() };
  let drag: ToolbarDragService;
  let root: HTMLElement;

  beforeEach(() => {
    toolbars.rows.mockReturnValue([[{ name: "a" }, { name: "b" }], [{ name: "c" }]]);
    TestBed.configureTestingModule({ providers: [{ provide: ToolbarService, useValue: toolbars }] });
    drag = TestBed.inject(ToolbarDragService);
    root = document.createElement("div");
    root.innerHTML = [
      "<div class=\"tr-toolbar-band\" style=\"position:fixed;left:0;top:0;width:400px\">",
      "<div class=\"tr-toolbar-row\" data-toolbar-row=\"0\" style=\"display:flex;align-items:center;height:40px\">",
      "<div class=\"tr-toolbar\" data-toolbar=\"a\" data-toolbar-index=\"0\" style=\"flex:none;width:100px;height:24px\"></div>",
      "<div class=\"tr-toolbar\" data-toolbar=\"b\" data-toolbar-index=\"1\" style=\"flex:none;width:100px;height:24px\"></div></div>",
      "<div class=\"tr-toolbar-row\" data-toolbar-row=\"1\" style=\"display:flex;align-items:center;height:40px\">",
      "<div class=\"tr-toolbar\" data-toolbar=\"c\" data-toolbar-index=\"0\" style=\"flex:none;width:100px;height:24px\"></div></div></div>"
    ].join("");
    document.body.append(root);
  });

  afterEach(() => {
    document.dispatchEvent(new PointerEvent("pointercancel"));
    root.remove();
    vi.clearAllMocks();
  });

  function start(name: string, button: number = 0): void {
    drag.begin(name, new PointerEvent("pointerdown", { button, clientX: 10, clientY: 20 }));
  }

  function moveTo(x: number, y: number): void {
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y }));
  }

  it("starts only with the primary button and past the threshold", () => {
    start("a", 2);
    moveTo(150, 20);
    expect(drag.dragging()).toBeNull();

    start("a");
    moveTo(11, 21);
    expect(drag.dragging()).toBeNull();
    moveTo(150, 20);
    expect(drag.dragging()).toBe("a");
  });

  it("targets a position in a row, counting the others without the dragged toolbar", () => {
    start("a");
    moveTo(120, 20);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 0, false, 100, 8, 24));
    moveTo(150, 20);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 1, false, 200, 8, 24));
    moveTo(151, 20);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 1, false, 200, 8, 24));

    start("c");
    moveTo(10, 60);
    expect(drag.target()).toEqual(new ToolbarDropTarget(1, 0, false, 0, 48, 24));
    start("c");
    moveTo(20, 20);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 0, false, 0, 8, 24));
    moveTo(190, 20);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 2, false, 200, 8, 24));
  });

  it("targets a new row at the top and bottom quarter of a row", () => {
    start("a");
    moveTo(50, 2);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 0, true, 0, 0, 400));
    moveTo(50, 38);
    expect(drag.target()).toEqual(new ToolbarDropTarget(1, 0, true, 0, 40, 400));
    moveTo(50, 78);
    expect(drag.target()).toEqual(new ToolbarDropTarget(2, 0, true, 0, 80, 400));
  });

  it("falls back to the last row below every row, and to an empty row for a row the arrangement does not list", () => {
    const band = root.querySelector<HTMLElement>(Resources.toolbarBandSelector) as HTMLElement;
    band.style.height = "100px";
    start("a");
    moveTo(50, 90);
    expect(drag.target()).toEqual(new ToolbarDropTarget(2, 0, true, 0, 80, 400));

    band.style.height = "";
    band.insertAdjacentHTML("beforeend", "<div class=\"tr-toolbar-row\" data-toolbar-row=\"5\" style=\"height:40px\"></div>");
    moveTo(50, 100);
    expect(drag.target()).toEqual(new ToolbarDropTarget(5, 0, false, 0, 80, 40));
  });

  it("has no target outside the band or without any row", () => {
    start("a");
    moveTo(150, 20);
    moveTo(450, 20);
    expect(drag.target()).toBeNull();
    moveTo(460, 20);
    expect(drag.target()).toBeNull();
    moveTo(150, 90);
    expect(drag.target()).toBeNull();
    for (const row of root.querySelectorAll(Resources.toolbarRowSelector))
      row.remove();
    moveTo(150, 20);
    expect(drag.target()).toBeNull();
    root.querySelector(Resources.toolbarBandSelector)?.remove();
    moveTo(150, 20);
    expect(drag.target()).toBeNull();
  });

  it("moves the toolbar to the target it was released over", () => {
    start("a");
    moveTo(150, 20);
    document.dispatchEvent(new PointerEvent("pointerup"));
    expect(toolbars.move).toHaveBeenCalledWith("a", 0, 1);
    expect([drag.dragging(), drag.target()]).toEqual([null, null]);

    start("c");
    moveTo(50, 2);
    document.dispatchEvent(new PointerEvent("pointerup"));
    expect(toolbars.moveToNewRow).toHaveBeenCalledWith("c", 0);
  });

  it("does nothing on release without a drag or a target", () => {
    start("a");
    document.dispatchEvent(new PointerEvent("pointerup"));
    start("a");
    moveTo(450, 20);
    document.dispatchEvent(new PointerEvent("pointerup"));

    expect([toolbars.move, toolbars.moveToNewRow].map(t => t.mock.calls.length)).toEqual([0, 0]);
  });

  it("cancels on Escape, a canceled pointer and a lost focus, and ignores Escape when nothing is dragged", () => {
    const escape = (): KeyboardEvent => new KeyboardEvent("keydown", { key: "Escape", cancelable: true });

    start("a");
    const early = escape();
    document.dispatchEvent(early);
    expect(early.defaultPrevented).toBe(false);
    moveTo(150, 20);
    const handled = escape();
    document.dispatchEvent(handled);
    expect([handled.defaultPrevented, drag.dragging()]).toEqual([true, null]);

    start("a");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    moveTo(150, 20);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(drag.dragging()).toBe("a");
    document.dispatchEvent(new PointerEvent("pointercancel"));
    expect(drag.dragging()).toBeNull();

    start("a");
    moveTo(150, 20);
    window.dispatchEvent(new Event("blur"));
    expect([drag.dragging(), drag.target()]).toEqual([null, null]);
  });
});
