/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { CodeTokenKind } from "../../../src/app/enums/code-token-kind";
import { CodeToken } from "../../../src/app/models/code-token";
import { CodeHighlights } from "../../../src/app/services/code-highlights";

describe("CodeHighlights", () => {
  const names = Object.values(CodeTokenKind).map(t => `tr-code-${t.toLowerCase()}`);
  const ranges = (): readonly string[] => names.flatMap(name => [...CSS.highlights.get(name) ?? []].map(t => `${name} ${t.startContainer.textContent?.slice(t.startOffset, t.endOffset)}`));

  it("registers a highlight for each kind of token, and removes them all when it goes", () => {
    TestBed.inject(CodeHighlights);
    const registered = names.map(t => CSS.highlights.has(t));

    TestBed.resetTestingModule();

    expect(registered).toEqual(names.map(() => true));
    expect(names.some(t => CSS.highlights.has(t))).toBe(false);
  });

  it("highlights each token's range of a text in its kind's highlight with a static range, and takes them back when asked", () => {
    const highlights = TestBed.inject(CodeHighlights);
    const text = document.createTextNode("return 1;");
    const other = highlights.add(document.createTextNode("let a;"), [new CodeToken(0, "let", CodeTokenKind.Keyword)]);

    const remove = highlights.add(text, [new CodeToken(0, "return", CodeTokenKind.Control), new CodeToken(7, "1", CodeTokenKind.Number)]);
    const added = ranges();
    const isStatic = names.flatMap(name => [...CSS.highlights.get(name) ?? []]).every(t => t instanceof StaticRange);
    remove();
    const removed = ranges();
    other();

    expect(added).toEqual(["tr-code-keyword let", "tr-code-control return", "tr-code-number 1"]);
    expect(isStatic).toBe(true);
    expect(removed).toEqual(["tr-code-keyword let"]);
    expect(ranges()).toEqual([]);
  });

  it("names a kind's highlight", () => {
    expect(CodeHighlights.nameOf(CodeTokenKind.Regex)).toBe("tr-code-regex");
  });
});
