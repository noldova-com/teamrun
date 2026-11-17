/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ContentPadding } from "@noldova/desktop.window";

import { PageDocumentComponent } from "../../../../src/app/components/pages/page-document/page-document.component";
import { PageDocuments } from "../../../../src/app/services/pages/page-documents";
import { PagesWindow, PagesWindowContext } from "../../../fixtures/pages-window.fixture";

describe("PageDocuments", () => {
  it("registers the page document without the window's padding, loading its component when the window opens one", async () => {
    const context = new PagesWindowContext();

    PageDocuments.register(context);

    expect(context.documents.map(t => [t.name, t.padding])).toEqual([["teamrun.page", ContentPadding.None]]);
    expect(await context.documents[0]?.loadComponent()).toBe(PageDocumentComponent);
  });

  it("opens a page a teammate shows as a document named by the page, once however often it registers, and ignores a canvas and what isn't a page", () => {
    const context = new PagesWindowContext();
    PageDocuments.register(context);
    PageDocuments.register(context);

    context.emitModule("teamrun.pageShown", PagesWindow.page().toJson());
    context.emitModule("teamrun.pageShown", { ...PagesWindow.page().toJson(), id: "k1", kind: "Canvas" });
    context.emitModule("teamrun.pageShown", { id: PagesWindow.pageId });
    context.emitModule("teamrun.pageShown", null);

    expect(context.openedDocuments.map(t => [t.name, t.instance, t.title])).toEqual([["teamrun.page", PagesWindow.pageId, "Onboarding options"]]);
  });

  it("stops opening shown pages once released, and a second release does nothing", () => {
    const context = new PagesWindowContext();
    PageDocuments.register(context);

    PageDocuments.release(context);
    PageDocuments.release(context);
    context.emitModule("teamrun.pageShown", PagesWindow.page().toJson());

    expect([context.openedDocuments, context.events]).toEqual([[], []]);
  });

  it("opens a page by its id and title for a card that shows it", () => {
    const context = new PagesWindowContext();

    PageDocuments.open(context, PagesWindow.page(2, PagesWindow.sol));

    expect(context.openedDocuments.map(t => [t.name, t.instance, t.title, t.options])).toEqual([["teamrun.page", PagesWindow.pageId, "Onboarding options", { imageGlyph: "web_asset" }]]);
  });
});
