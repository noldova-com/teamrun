/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { DialogService } from "../../../src/app/services/dialog.service";

@Component({
  template: `<button type="button" class="inside">Keep working</button><button type="button" class="other">Look elsewhere</button>`
})
class OpenDialogComponent {
}

describe("DialogService", () => {
  let opener: HTMLButtonElement;
  let live: HTMLElement;
  let inert: HTMLElement;
  let popover: HTMLElement;
  let references: DialogRef<unknown, OpenDialogComponent>[];

  beforeEach(() => {
    references = [];
    opener = document.createElement("button");
    live = document.createElement("div");
    live.setAttribute("aria-live", "polite");
    inert = document.createElement("div");
    inert.inert = true;
    popover = document.createElement("div");
    popover.popover = "manual";
    document.body.append(opener, live, inert, popover);
    opener.focus();
  });

  afterEach(async () => {
    for (const reference of references.reverse())
      reference.close();
    await vi.waitFor(() => expect(document.querySelector(".inside")).toBeNull());
    for (const element of [opener, live, inert, popover])
      element.remove();
  });

  async function openAsync(): Promise<DialogRef<unknown, OpenDialogComponent>> {
    const reference = TestBed.inject(DialogService).open(OpenDialogComponent, ".inside");
    references.push(reference);
    await vi.waitFor(() => expect(document.activeElement).toBe(insideOf(references.length - 1)));
    return reference;
  }

  function insideOf(index: number, name: string = "inside"): HTMLElement {
    return document.querySelectorAll<HTMLElement>(`.${name}`)[index] as HTMLElement;
  }

  it("makes the window behind the first dialog inert and hidden from assistive technology until the last one closes, leaving live regions, popovers and the dialogs alone", async () => {
    await openAsync();
    const whileOne = [opener.inert, opener.getAttribute("aria-hidden"), live.inert, popover.inert, inert.inert, (document.querySelector(".cdk-overlay-container") as HTMLElement).inert];
    const second = await openAsync();
    second.close();
    const afterSecond = opener.inert;
    references[0]?.close();
    references = [];

    expect(whileOne).toEqual([true, "true", false, false, true, false]);
    expect(afterSecond).toBe(true);
    expect([opener.inert, opener.hasAttribute("aria-hidden"), inert.inert]).toEqual([false, false, true]);
  });

  it("returns the focus to the control focused before a dialog opened once the window behind it is live again", async () => {
    const first = await openAsync();
    const inside = insideOf(0);
    const second = await openAsync();
    second.close();
    const afterSecond = document.activeElement;
    first.close();
    references = [];

    expect(afterSecond).toBe(inside);
    expect(document.activeElement).toBe(opener);
  });

  it("leaves the focus where it is when it has already moved on as a dialog closes", async () => {
    await openAsync();
    const second = await openAsync();
    insideOf(0, "other").focus();
    second.close();

    expect(document.activeElement).toBe(insideOf(0, "other"));
  });
});
