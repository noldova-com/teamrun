/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, Injector } from "@angular/core";

import { ContentPadding } from "../../../src/app/enums/content-padding";
import { ContentPaddingRef } from "../../../src/app/models/content-padding-ref";
import { TabContent } from "../../../src/app/models/tab-content";

@Component({ template: "" })
class NoteComponent {
}

describe("TabContent", () => {
  it("holds the component a tab shows, the injector it is made with, its inputs, its declared padding and its page's choice", () => {
    const injector = Injector.create({ providers: [] });
    const page = new ContentPaddingRef();
    const content = new TabContent(NoteComponent, injector, { title: "Plan" }, ContentPadding.None, page);

    expect([content.type, content.injector, content.inputs, content.padding, content.pagePadding]).toEqual([NoteComponent, injector, { title: "Plan" }, ContentPadding.None, page]);
  });
});
