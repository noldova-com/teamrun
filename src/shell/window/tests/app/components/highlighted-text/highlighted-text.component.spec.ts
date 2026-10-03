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
});
