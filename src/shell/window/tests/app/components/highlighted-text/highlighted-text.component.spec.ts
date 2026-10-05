/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DefaultTheme, ThemeMode } from "@noldova/teamrun-shell-ui";

import { HighlightedTextComponent } from "../../../../src/app/components/highlighted-text/highlighted-text.component";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";

describe("HighlightedTextComponent", () => {
  afterEach(() => AppearanceFixture.reset());

  it("marks each match of the query in the highlight color with an underline, and shows plain text without one", () => {
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light);
    const fixture = TestBed.createComponent(HighlightedTextComponent);
    fixture.componentRef.setInput("text", "Code text size");
    fixture.componentRef.setInput("query", "TEXT");
    fixture.detectChanges();
    const marks = [...(fixture.nativeElement as HTMLElement).querySelectorAll("mark")];
    const style = getComputedStyle(marks[0] as Element);
    const look = [style.color, style.textDecorationLine];
    fixture.componentRef.setInput("query", "");
    fixture.detectChanges();

    expect(marks.map(t => t.textContent)).toEqual(["text"]);
    expect(look).toEqual([AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "list.highlightForeground"), "underline"]);
    expect([(fixture.nativeElement as HTMLElement).textContent, (fixture.nativeElement as HTMLElement).querySelectorAll("mark").length]).toEqual(["Code text size", 0]);
  });

  it("gives an id break opportunities at its word boundaries without adding characters, inside a match too, and only when asked", () => {
    const fixture = TestBed.createComponent(HighlightedTextComponent);
    const element = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput("text", "shell.splitTabUp");
    fixture.componentRef.setInput("query", "bu");
    fixture.detectChanges();
    const plain = [element.querySelectorAll("wbr").length, element.textContent];
    fixture.componentRef.setInput("breaksWords", true);
    fixture.detectChanges();
    document.getSelection()?.selectAllChildren(element);
    const copied = document.getSelection()?.toString();
    document.getSelection()?.removeAllRanges();

    expect(plain).toEqual([0, "shell.splitTabUp"]);
    expect([element.querySelectorAll("wbr").length, element.textContent, copied]).toEqual([3, "shell.splitTabUp", "shell.splitTabUp"]);
    expect([...element.querySelectorAll("mark")].map(t => [t.textContent, t.querySelectorAll("wbr").length])).toEqual([["bU", 1]]);
  });

  it("puts a break opportunity just before a match that starts at a word boundary", () => {
    const fixture = TestBed.createComponent(HighlightedTextComponent);
    const element = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput("text", "shell.moveTabToNextGroup");
    fixture.componentRef.setInput("query", "Group");
    fixture.componentRef.setInput("breaksWords", true);
    fixture.detectChanges();
    const mark = element.querySelector("mark") as HTMLElement;

    expect([mark.textContent, mark.querySelectorAll("wbr").length, mark.previousElementSibling?.tagName, element.querySelectorAll("wbr").length, element.textContent])
      .toEqual(["Group", 0, "WBR", 5, "shell.moveTabToNextGroup"]);
  });
});
