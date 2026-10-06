/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ComponentRef } from "@angular/core";

import type { TabContentComponent } from "../../../src/app/components/tab-content/tab-content.component";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { LiveView } from "../../../src/app/models/live-view";

describe("LiveView", () => {
  let element: HTMLElement;
  let slots: HTMLElement[];
  let outside: HTMLButtonElement;
  let view: LiveView;

  function createElement(): HTMLElement {
    const created = document.createElement("div");
    created.innerHTML = "<textarea></textarea><div class=\"list\"><div class=\"rows\"></div></div><div class=\"rows\"></div>";
    created.style.cssText = "display: block; height: 100px; overflow: auto";
    (created.querySelector(".list") as HTMLElement).style.cssText = "height: 50px; overflow: auto";
    for (const rows of created.querySelectorAll<HTMLElement>(".rows"))
      rows.style.cssText = "height: 400px";
    return created;
  }

  function createView(root: HTMLElement): LiveView {
    return new LiveView(new ViewTab("notes.list"), { instance: { element: root } } as ComponentRef<TabContentComponent>);
  }

  function scroll(target: Element, top: number): void {
    target.scrollTop = top;
    target.dispatchEvent(new Event("scroll"));
  }

  beforeEach(() => {
    element = createElement();
    slots = [document.createElement("div"), document.createElement("div")];
    outside = document.createElement("button");
    document.body.append(...slots, outside);
    view = createView(element);
  });

  afterEach(() => {
    for (const slot of slots)
      slot.remove();
    outside.remove();
  });

  it("moves into a slot and out of it, keeping the scroll positions of itself and the elements inside it and the focus inside it", () => {
    const [first, second] = slots as [HTMLElement, HTMLElement];
    const field = element.querySelector("textarea") as HTMLTextAreaElement;
    const list = element.querySelector(".list") as HTMLElement;
    view.enter(first);
    field.focus();
    scroll(element, 80);
    scroll(list, 120);
    const entered = view.slot;

    view.leave();
    const left = [view.slot, element.isConnected, document.activeElement];
    view.enter(second);
    view.restore();

    expect([entered, ...left]).toEqual([first, null, false, document.body]);
    expect([view.slot, element.parentElement, element.scrollTop, list.scrollTop, document.activeElement]).toEqual([second, second, 80, 120, field]);
  });

  it("keeps the scroll positions it had before the page took it out ahead of its slot", () => {
    view.enter(slots[0] as HTMLElement);
    scroll(element, 80);

    (slots[0] as HTMLElement).remove();
    view.leave();
    view.enter(slots[1] as HTMLElement);
    view.restore();

    expect(element.scrollTop).toBe(80);
  });

  it("ignores a scroll reported while it is out of the page or between moving to a slot and being restored there", () => {
    const [first, second] = slots as [HTMLElement, HTMLElement];
    const list = element.querySelector(".list") as HTMLElement;
    view.enter(first);
    scroll(element, 80);
    scroll(list, 120);

    view.leave();
    element.dispatchEvent(new Event("scroll"));
    view.enter(second);
    list.dispatchEvent(new Event("scroll", { bubbles: true }));
    view.restore();
    const restored = [element.scrollTop, list.scrollTop];
    second.remove();
    element.dispatchEvent(new Event("scroll"));
    view.leave();
    view.enter(first);
    view.restore();

    expect([...restored, element.scrollTop, list.scrollTop]).toEqual([80, 120, 80, 120]);
  });

  it("forgets the scroll position of an element that has left it and ignores a scroll that comes from no element", () => {
    const list = element.querySelector(".list") as HTMLElement;
    view.enter(slots[0] as HTMLElement);
    scroll(list, 120);
    element.append(document.createTextNode("end"));
    element.lastChild?.dispatchEvent(new Event("scroll", { bubbles: true }));
    list.remove();
    list.scrollTop = 0;

    view.restore();
    element.append(list);
    view.restore();

    expect(list.scrollTop).toBe(0);
  });

  it("leaves the focus where the person moved it while the view was out of its slot", () => {
    view.enter(slots[0] as HTMLElement);
    (element.querySelector("textarea") as HTMLTextAreaElement).focus();
    view.leave();
    outside.focus();

    view.enter(slots[0] as HTMLElement);
    view.restore();

    expect(document.activeElement).toBe(outside);
  });

  it("never focuses an element that is no longer in the page or no longer in the view", () => {
    const field = element.querySelector("textarea") as HTMLTextAreaElement;
    view.enter(slots[0] as HTMLElement);
    field.focus();
    view.leave();
    view.restore();
    const whileOut = document.activeElement;
    view.enter(slots[0] as HTMLElement);
    field.focus();
    view.leave();
    field.remove();
    view.enter(slots[0] as HTMLElement);

    view.restore();

    expect([whileOut, document.activeElement]).toEqual([document.body, document.body]);
  });

  it("moves no focus when none was inside it", () => {
    view.enter(slots[0] as HTMLElement);
    outside.focus();
    view.leave();
    outside.blur();

    view.enter(slots[0] as HTMLElement);
    view.restore();

    expect(document.activeElement).toBe(document.body);
  });

  it("listens for scrolls passively, on its own element only", () => {
    const root = createElement();
    const listen = vi.spyOn(EventTarget.prototype, "addEventListener");

    createView(root);
    const calls = listen.mock.calls.map(t => [t[0], t[1] instanceof Function, t[2]]);
    const contexts = [...listen.mock.contexts];
    listen.mockRestore();

    expect(calls).toEqual([["scroll", true, { capture: true, passive: true }]]);
    expect(contexts).toEqual([root]);
  });
});
