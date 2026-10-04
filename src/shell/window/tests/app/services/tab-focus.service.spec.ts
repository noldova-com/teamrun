/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { TabFocusService } from "../../../src/app/services/tab-focus.service";

describe("TabFocusService", () => {
  const plan = new DocumentTab("notes.note", "plan");
  let elements: HTMLButtonElement[];

  beforeEach(() => {
    elements = [new ViewTab("notes.list"), plan].map(tab => {
      const element = document.createElement("button");
      element.dataset["tabKey"] = tab.key;
      return document.body.appendChild(element);
    });
  });

  afterEach(() => elements.forEach(t => t.remove()));

  it("focuses a tab after the next render", () => {
    const focus = TestBed.inject(TabFocusService);

    focus.focus(plan);
    const before = document.activeElement;
    TestBed.tick();

    expect([before, document.activeElement]).toEqual([document.body, elements[1]]);
  });

  it("focuses a tab after the next render only when focus was lost, and nothing for a tab that isn't shown", () => {
    const focus = TestBed.inject(TabFocusService);
    elements[0]?.focus();

    focus.focusIfLost(plan);
    TestBed.tick();
    const kept = document.activeElement;
    elements[0]?.blur();
    focus.focusIfLost(new ViewTab("files.tree"));
    TestBed.tick();
    const missing = document.activeElement;
    focus.focusIfLost(plan);
    TestBed.tick();

    expect([kept, missing, document.activeElement]).toEqual([elements[0], document.body, elements[1]]);
  });
});
