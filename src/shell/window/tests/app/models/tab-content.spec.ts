/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, Injector } from "@angular/core";

import { TabContent } from "../../../src/app/models/tab-content";

@Component({ template: "" })
class NoteComponent {
}

describe("TabContent", () => {
  it("holds the component a tab shows, the injector it is made with and its inputs", () => {
    const injector = Injector.create({ providers: [] });
    const content = new TabContent(NoteComponent, injector, { title: "Plan" });

    expect([content.type, content.injector, content.inputs]).toEqual([NoteComponent, injector, { title: "Plan" }]);
  });
});
