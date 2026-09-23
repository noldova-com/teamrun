/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { ResizeHandleComponent } from "../../../../src/app/components/resize-handle/resize-handle.component";

describe("ResizeHandleComponent", () => {
  const pointer = (element: HTMLElement, type: string, x: number, y: number, button: number = 0): void => {
    element.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button, bubbles: true, cancelable: true }));
  };

  it("reports the size along a right edge as the pointer drags, and the reset on a double-click", () => {
    const fixture = TestBed.createComponent(ResizeHandleComponent);
    fixture.componentRef.setInput("edge", PanelEdge.Right);
    fixture.componentRef.setInput("size", 400);
    const sizes: number[] = [];
    let resets = 0;
    fixture.componentInstance.resized.subscribe(t => sizes.push(t));
    fixture.componentInstance.reset.subscribe(() => { resets += 1; });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.dataset["edge"]).toBe(PanelEdge.Right);

    pointer(element, "pointermove", 150, 0);
    pointer(element, "pointerdown", 100, 0, 1);
    pointer(element, "pointermove", 150, 0);
    expect(sizes).toEqual([]);

    pointer(element, "pointerdown", 100, 0);
    fixture.detectChanges();
    expect(element.classList.contains("tr-resizing")).toBe(true);
    pointer(element, "pointermove", 150, 0);
    pointer(element, "pointermove", 60, 0);
    pointer(element, "pointerup", 60, 0);
    fixture.detectChanges();
    expect(sizes).toEqual([450, 360]);
    expect(element.classList.contains("tr-resizing")).toBe(false);
    pointer(element, "pointermove", 500, 0);
    expect(sizes).toEqual([450, 360]);

    element.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(resets).toBe(1);
  });

  it("measures the panel when no size is given and grows a top edge upward", () => {
    const fixture = TestBed.createComponent(ResizeHandleComponent);
    fixture.componentRef.setInput("edge", PanelEdge.Top);
    const sizes: number[] = [];
    fixture.componentInstance.resized.subscribe(t => sizes.push(t));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.parentElement!.getBoundingClientRect = () => new DOMRect(0, 0, 800, 200);

    pointer(element, "pointerdown", 0, 500);
    pointer(element, "pointermove", 0, 440);
    pointer(element, "pointercancel", 0, 440);
    expect(sizes).toEqual([260]);
  });
});
