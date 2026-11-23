/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DocsOutline } from "../../../src/app/models/docs-outline";
import { DocsFixture } from "../../fixtures/docs.fixture";

describe("DocsOutline", () => {
  const roots: HTMLElement[] = [];

  const heading = (level: number, title: string, id: string = String()): string =>
    `<p class="nol-markdown-heading" role="heading" aria-level="${level}"${id === String() ? String() : ` id="${id}"`}>${title}</p>`;

  const render = (html: string): HTMLElement => {
    const root = document.createElement("main");
    root.innerHTML = `<h1>Page</h1><div class="nol-docs-page-body">${html}</div>`;
    document.body.append(root);
    roots.push(root);
    return root;
  };

  const topOf = (root: HTMLElement, title: string): number => DocsFixture.byText(root, "p", title).getBoundingClientRect().top;

  afterEach(() => {
    for (const root of roots.splice(0))
      root.remove();
  });

  it("lists the page's second- and third-level headings in order, as sections and their subsections, and leaves out the rest", () => {
    const root = render(`${heading(2, "First")}${heading(3, "Inner part")}${heading(4, "Too deep")}<p class="nol-markdown-heading">Not a heading</p>${heading(2, "Second")}`);

    expect(DocsOutline.read(root).map(t => [t.title, t.id, t.depth])).toEqual([["First", "first", 0], ["Inner part", "inner-part", 1], ["Second", "second", 0]]);
    expect(DocsFixture.byText(root, "p", "Inner part").id).toBe("inner-part");
  });

  it("leaves out headings outside the page's text", () => {
    const root = render(heading(2, "Inside"));
    root.insertAdjacentHTML("beforeend", heading(2, "Outside"));

    expect(DocsOutline.read(root).map(t => t.title)).toEqual(["Inside"]);
  });

  it("gives each heading without an id one that no other element in the document holds, and names a heading with no letters", () => {
    render("<p id=\"usage\">Elsewhere</p>");
    const root = render(`${heading(2, "Usage")}${heading(2, "Usage")}${heading(2, "Notes", "notes")}${heading(2, "Notes")}${heading(2, "— ✓ —")}`);

    expect(DocsOutline.read(root).map(t => t.id)).toEqual(["usage-2", "usage-3", "notes", "notes-2", "section"]);
  });

  it("keeps the ids it gave when it reads the page again", () => {
    const root = render(`${heading(2, "Usage")}${heading(3, "Usage")}`);
    const first = DocsOutline.read(root).map(t => t.id);

    expect(DocsOutline.read(root).map(t => t.id)).toEqual(first);
  });

  it("marks the last heading at or above the reading edge, and at the page's end the last one in view", () => {
    const root = render(`${heading(2, "One")}<p>Text</p>${heading(2, "Two")}<p>Text</p>${heading(2, "Three")}`);
    const entries = DocsOutline.read(root);
    const view = topOf(root, "Three") + 1;

    expect(DocsOutline.currentOf(entries, topOf(root, "One") - 1, false, view)).toBeNull();
    expect(DocsOutline.currentOf(entries, topOf(root, "Two"), false, view)?.title).toBe("Two");
    expect(DocsOutline.currentOf(entries, topOf(root, "One") - 1, true, view)?.title).toBe("Three");
    expect(DocsOutline.currentOf(entries, topOf(root, "One") - 1, true, topOf(root, "One"))).toBeNull();
  });
});
