/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PointerDrag } from "../../../src/app/services/pointer-drag";

describe("PointerDrag", () => {
  let element: HTMLElement;
  let calls: string[];
  let drag: PointerDrag | null;

  beforeEach(() => {
    element = document.createElement("div");
    document.body.append(element);
    calls = [];
    drag = null;
  });

  afterEach(() => {
    drag?.stop();
    element.remove();
  });

  function begin(): PointerDrag {
    drag = new PointerDrag(element, new PointerEvent("pointerdown", { pointerId: 1, buttons: 1 }), t => calls.push(`move ${t.clientX}`), () => calls.push("end"), () => calls.push("cancel"));
    return drag;
  }

  function pointer(type: string, pointerId: number = 1, buttons: number = 1, clientX: number = 0): void {
    document.dispatchEvent(new PointerEvent(type, { pointerId, buttons, clientX }));
  }

  function key(name: string): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    return event;
  }

  function holdCapture(): { readonly capture: ReturnType<typeof vi.spyOn>; readonly release: ReturnType<typeof vi.spyOn> } {
    const held = new Set<number>();
    const capture = vi.spyOn(element, "setPointerCapture").mockImplementation(t => void held.add(t));
    const release = vi.spyOn(element, "releasePointerCapture").mockImplementation(t => void held.delete(t));
    vi.spyOn(element, "hasPointerCapture").mockImplementation(t => held.has(t));
    return { capture, release };
  }

  it("passes each move of its pointer while the primary button is pressed and ends on that pointer's release", () => {
    begin();

    pointer("pointermove", 1, 1, 5);
    pointer("pointermove", 2, 1, 6);
    pointer("pointermove", 1, 3, 7);
    pointer("pointerup", 2, 0);
    pointer("pointerup", 1, 0);

    expect(calls).toEqual(["move 5", "move 7", "end"]);
  });

  it("cancels on a cancelled pointer, a lost capture, a lost window focus or a move without the primary button, and ignores other pointers", () => {
    const endings: readonly (readonly [string, () => void])[] = [
      ["cancelled", () => pointer("pointercancel")],
      ["lost capture", () => element.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 1 }))],
      ["blur", () => window.dispatchEvent(new FocusEvent("blur"))],
      ["no button", () => pointer("pointermove", 1, 0)],
      ["secondary only", () => pointer("pointermove", 1, 2)]
    ];
    const ended: string[] = [];

    for (const [name, end] of endings) {
      calls = [];
      drag?.stop();
      begin();
      pointer("pointercancel", 2);
      element.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 2 }));
      pointer("pointermove", 2, 0);
      end();
      ended.push(`${name}: ${calls.join(",")}`);
    }

    expect(ended).toEqual(["cancelled: cancel", "lost capture: cancel", "blur: cancel", "no button: cancel", "secondary only: cancel"]);
  });

  it("captures the pointer once the drag starts, lets Escape cancel only then, and releases the capture it holds when stopped", () => {
    const { capture, release } = holdCapture();
    const outside: string[] = [];
    const listen = (event: KeyboardEvent): void => void outside.push(event.key);
    document.body.addEventListener("keydown", listen);
    const started = begin();

    const early = key("Escape");
    started.start();
    const other = key("Enter");
    const late = key("Escape");
    started.stop();
    started.stop();
    pointer("pointermove", 1, 1, 9);
    pointer("pointerup", 1, 0);
    document.body.removeEventListener("keydown", listen);

    expect(calls).toEqual(["cancel"]);
    expect([early.defaultPrevented, other.defaultPrevented, late.defaultPrevented]).toEqual([false, false, true]);
    expect(outside).toEqual(["Escape", "Enter"]);
    expect(capture).toHaveBeenCalledExactlyOnceWith(1);
    expect(release).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("releases nothing when it holds no capture", () => {
    const { release } = holdCapture();

    begin().stop();

    expect(release).not.toHaveBeenCalled();
  });
});
