/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LiveAnnouncer } from "@angular/cdk/a11y";
import { Component, ErrorHandler, type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { CodeBlockComponent } from "../../../../src/app/components/code-block/code-block.component";
import { ClipboardWriter } from "../../../../src/app/services/clipboard-writer";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../../../src/app/models/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import type { ClipboardWriterFixture } from "../../../fixtures/clipboard-writer.fixture";
import { GalleryFixture } from "../../../fixtures/gallery.fixture";

@Component({
  imports: [CodeBlockComponent],
  template: `
    <div class="frame" [style.width]="width()">
      @if (isShown()) {
        <tr-code-block [code]="code()" [language]="language()" [(wrapped)]="wrapped" />
      }
    </div>
  `
})
class CodeBlockHostComponent {
  public readonly code: WritableSignal<string> = signal("const a = 1;\n\tconst message = \"This line runs well past the right edge of the block, so it has to scroll sideways inside it.\";\nconst b = 2;");
  public readonly language: WritableSignal<string | null> = signal("TypeScript");
  public readonly wrapped: WritableSignal<boolean> = signal(false);
  public readonly width: WritableSignal<string> = signal("20rem");
  public readonly isShown: WritableSignal<boolean> = signal(true);
}

describe("CodeBlockComponent", () => {
  let fixture: ComponentFixture<CodeBlockHostComponent>;
  let host: CodeBlockHostComponent;
  let clipboard: ClipboardWriterFixture;
  let announcements: string[];

  async function renderAsync(): Promise<void> {
    announcements = [];
    fixture = TestBed.createComponent(CodeBlockHostComponent);
    host = fixture.componentInstance;
    clipboard = TestBed.inject(ClipboardWriter) as ClipboardWriterFixture;
    const announcer = TestBed.inject(LiveAnnouncer);
    vi.spyOn(announcer, "announce").mockImplementation(message => {
      announcements.push(String(message));
      return Promise.resolve();
    });
    await fixture.whenStable();
  }

  async function changeAsync(change: () => void): Promise<void> {
    change();
    await fixture.whenStable();
  }

  const find = (selector: string): HTMLElement => fixture.nativeElement.querySelector(selector);
  const box = (selector: string): DOMRect => find(selector).getBoundingClientRect();
  const wrap = (): HTMLElement => find(".tr-code-block-wrap");
  const copy = (): HTMLElement => find(".tr-code-block-copy");
  const body = (): HTMLElement => find(".tr-code-block-body");
  const framesAsync = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const resolve = (property: string, value: string): string => GalleryFixture.colorOf(document.body, property, value);
  const glyph = (button: HTMLElement): string | null | undefined => button.querySelector(".tr-icon-button-glyph")?.textContent;

  async function copyAsync(): Promise<void> {
    copy().click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  }

  afterEach(() => {
    vi.useRealTimers();
    AppearanceFixture.reset();
  });

  it("shows its language at the start of its header, then a toolbar named Code block actions with Word wrap and then Copy, whose glyph ends as far from the block's end as the language starts from its start", async () => {
    AppearanceFixture.apply();
    await renderAsync();
    const header = box(".tr-code-block-header");
    const toolbar = find("[role=toolbar]");

    expect(find(".tr-code-block-language").textContent).toBe("TypeScript");
    AppearanceFixture.expectPixels(box(".tr-code-block-language").left - header.left, AppearanceFixture.measureLook("space-3"));
    expect([toolbar.getAttribute("aria-label"), ...[...toolbar.querySelectorAll("button")].map(t => [t.getAttribute("aria-label"), t.getAttribute("aria-pressed")])])
      .toEqual(["Code block actions", ["Word wrap", "false"], ["Copy", null]]);
    expect([glyph(wrap()), glyph(copy())]).toEqual(["wrap_text", "content_copy"]);
    AppearanceFixture.expectPixels(box("tr-code-block").right - (copy().querySelector(".tr-icon-button-glyph") as Element).getBoundingClientRect().right, box(".tr-code-block-language").left - box("tr-code-block").left);
    expect(Math.abs((wrap().getBoundingClientRect().top + wrap().getBoundingClientRect().bottom) / 2 - (header.top + header.bottom) / 2)).toBeLessThanOrEqual(0.5);
  });

  it("leaves out the language when it has none, keeping its actions at the end of the header", async () => {
    await renderAsync();
    await changeAsync(() => host.language.set(null));

    expect(find(".tr-code-block-language")).toBeNull();
    expect(box(".tr-code-block-header").right - copy().getBoundingClientRect().right).toBeLessThan(box(".tr-code-block-header").width / 2);
  });

  it("cuts a language too long for its header with an ellipsis, keeping both actions", async () => {
    await renderAsync();
    await changeAsync(() => host.language.set("A language name far too long to fit the header of a narrow code block"));

    AppearanceFixture.expectTruncates(find(".tr-code-block-language"));
    expect(copy().getBoundingClientRect().right).toBeLessThanOrEqual(box(".tr-code-block-header").right);
  });

  it("shows its code exactly, tabs and line breaks included, and is as tall as its lines", async () => {
    AppearanceFixture.apply();
    await renderAsync();
    const style = getComputedStyle(body());
    const code = getComputedStyle(find(".tr-code-block-body > code"));

    expect(body().querySelector("code")?.textContent).toBe(host.code());
    expect(body().getBoundingClientRect().height).toBeGreaterThanOrEqual(3 * Number.parseFloat(style.lineHeight) + Number.parseFloat(code.paddingTop) + Number.parseFloat(code.paddingBottom));
    expect([style.overflowY === "auto" || style.overflowY === "hidden", body().scrollHeight]).toEqual([true, body().clientHeight]);
  });

  it("scrolls a long line sideways inside its body, never widening the block or what holds it", async () => {
    await renderAsync();

    expect([getComputedStyle(body()).whiteSpace, getComputedStyle(body()).overflowX]).toEqual(["pre", "auto"]);
    expect(body().scrollWidth).toBeGreaterThan(body().clientWidth);
    expect(box("tr-code-block").width).toBe(box(".frame").width);
    expect(find(".frame").scrollWidth).toBe(find(".frame").clientWidth);
  });

  it("takes a sideways scrollbar's height from its bottom padding only while its lines scroll, and keeps its end padding once scrolled to the end", async () => {
    AppearanceFixture.apply();
    await renderAsync();
    const bottom = (): number => Number.parseFloat(getComputedStyle(find(".tr-code-block-body > code")).paddingBottom);
    const lines = (): DOMRect[] => {
      const range = document.createRange();
      range.selectNodeContents(find(".tr-code-block-body > code"));
      return [...range.getClientRects()];
    };
    const start = (lines()[0] as DOMRect).left - body().getBoundingClientRect().left;
    await framesAsync();

    expect(body().scrollWidth).toBeGreaterThan(body().clientWidth);
    AppearanceFixture.expectPixels(bottom(), AppearanceFixture.measureLook("space-2") - AppearanceFixture.measureLook("scrollbar-size"));

    body().scrollLeft = body().scrollWidth;

    AppearanceFixture.expectPixels(body().getBoundingClientRect().right - Math.max(...lines().map(t => t.right)), start);

    await changeAsync(() => host.wrapped.set(true));
    await framesAsync();

    expect(body().scrollWidth).toBe(body().clientWidth);
    AppearanceFixture.expectPixels(bottom(), AppearanceFixture.measureLook("space-2"));
  });

  it("wraps its lines anywhere while Word wrap is pressed, by pointer, Enter or Space, and scrolls again once it is released", async () => {
    await renderAsync();
    const height = body().getBoundingClientRect().height;

    wrap().click();
    await fixture.whenStable();

    expect([wrap().getAttribute("aria-pressed"), host.wrapped(), getComputedStyle(body()).whiteSpace, getComputedStyle(body()).overflowWrap]).toEqual(["true", true, "pre-wrap", "anywhere"]);
    expect(body().scrollWidth).toBe(body().clientWidth);
    expect(body().getBoundingClientRect().height).toBeGreaterThan(height);

    wrap().focus();
    await userEvent.keyboard("{Enter}");
    await fixture.whenStable();

    expect([wrap().getAttribute("aria-pressed"), getComputedStyle(body()).whiteSpace]).toEqual(["false", "pre"]);

    await userEvent.keyboard(" ");
    await fixture.whenStable();

    expect(wrap().getAttribute("aria-pressed")).toBe("true");
  });

  it("starts wrapped when its owner binds it so", async () => {
    await renderAsync();
    await changeAsync(() => host.wrapped.set(true));

    expect([wrap().getAttribute("aria-pressed"), getComputedStyle(body()).whiteSpace]).toEqual(["true", "pre-wrap"]);
  });

  it("is one tab stop whose arrow keys move between Word wrap and Copy", async () => {
    await renderAsync();

    expect([wrap().tabIndex, copy().tabIndex]).toEqual([0, -1]);

    wrap().focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(document.activeElement).toBe(copy());
  });

  it("copies its code exactly, then shows the check glyph in the added color, is named and announced Copied, and returns to Copy after two seconds", async () => {
    AppearanceFixture.apply();
    await renderAsync();
    vi.useFakeTimers();

    await copyAsync();

    expect(clipboard.texts).toEqual([host.code()]);
    expect([glyph(copy()), copy().getAttribute("aria-label"), announcements]).toEqual(["check", "Copied", ["Copied"]]);
    expect(getComputedStyle(copy().querySelector(".tr-icon-button-glyph") as Element).color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "teamrun.addedForeground"));

    await vi.advanceTimersByTimeAsync(1999);
    fixture.detectChanges();

    expect(copy().getAttribute("aria-label")).toBe("Copied");

    await vi.advanceTimersByTimeAsync(1);
    fixture.detectChanges();

    expect([glyph(copy()), copy().getAttribute("aria-label")]).toEqual(["content_copy", "Copy"]);
    expect(getComputedStyle(copy().querySelector(".tr-icon-button-glyph") as Element).color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "icon.foreground"));
  });

  it("starts its two seconds again when copied again before they end", async () => {
    await renderAsync();
    vi.useFakeTimers();

    await copyAsync();
    await vi.advanceTimersByTimeAsync(1500);
    await copyAsync();
    await vi.advanceTimersByTimeAsync(1500);
    fixture.detectChanges();

    expect([clipboard.texts.length, copy().getAttribute("aria-label")]).toEqual([2, "Copied"]);
  });

  it("keeps the copy glyph and is named and announced Couldn't copy when the clipboard refuses the text", async () => {
    await renderAsync();
    clipboard.answer = (): Promise<boolean> => Promise.resolve(false);
    vi.useFakeTimers();

    await copyAsync();

    expect([glyph(copy()), copy().getAttribute("aria-label"), announcements, copy().classList.contains("tr-code-block-copied")]).toEqual(["content_copy", "Couldn't copy", ["Couldn't copy"], false]);

    await vi.advanceTimersByTimeAsync(2000);
    fixture.detectChanges();

    expect(copy().getAttribute("aria-label")).toBe("Copy");
  });

  it("says Couldn't copy and reports the error when writing to the clipboard fails", async () => {
    const errors: unknown[] = [];
    TestBed.overrideProvider(ErrorHandler, { useValue: { handleError: (error: unknown) => errors.push(error) } });
    await renderAsync();
    const failure = new Error("The clipboard is unavailable.");
    clipboard.answer = (): Promise<boolean> => Promise.reject(failure);

    await copyAsync();

    expect([copy().getAttribute("aria-label"), errors]).toEqual(["Couldn't copy", [failure]]);
  });

  it("stops its feedback timer when it is removed", async () => {
    await renderAsync();
    const timers = vi.spyOn(globalThis, "setTimeout");
    await copyAsync();
    const feedback = timers.mock.results[timers.mock.calls.findIndex(t => t[1] === 2000)]?.value;
    const cleared = vi.spyOn(globalThis, "clearTimeout");

    await changeAsync(() => host.isShown.set(false));

    expect(feedback).toBeDefined();
    expect(cleared).toHaveBeenCalledWith(feedback);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its surfaces, border, divider, radius, header height and text roles from the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        await renderAsync();
        const block = getComputedStyle(find("tr-code-block"));
        const header = getComputedStyle(find(".tr-code-block-header"));
        const code = getComputedStyle(body());
        const language = getComputedStyle(find(".tr-code-block-language"));
        const root = getComputedStyle(document.documentElement);
        const border = AppearanceFixture.readColor(theme, mode, "surface.border");

        expect([block.backgroundColor, block.borderTopColor, block.borderTopStyle, block.overflowX, block.overflowY]).toEqual([AppearanceFixture.readColor(theme, mode, "teamrun.codeBackground"), border, "solid", "hidden", "hidden"]);
        AppearanceFixture.expectLook(block.borderTopWidth, theme, "border-width", "border-top-width");
        AppearanceFixture.expectLook(block.borderTopLeftRadius, theme, "radius-medium", "border-top-left-radius");
        expect([header.backgroundColor, header.borderBottomColor, header.borderBottomStyle]).toEqual([AppearanceFixture.readColor(theme, mode, "teamrun.codeHeaderBackground"), border, "solid"]);
        AppearanceFixture.expectLook(header.borderBottomWidth, theme, "border-width", "border-bottom-width");
        AppearanceFixture.expectLook(header.minHeight, theme, "code-header-height", "min-height");
        expect(find(".tr-code-block-header").getBoundingClientRect().height).toBeGreaterThanOrEqual(AppearanceFixture.measureLook("code-header-height") - 0.5);
        expect([language.color, language.fontSize, language.lineHeight])
          .toEqual([AppearanceFixture.readColor(theme, mode, "teamrun.mutedForeground"), resolve("font-size", "var(--tr-text-label)"), resolve("line-height", "var(--tr-line-label)")]);
        expect([code.color, code.fontFamily, code.fontSize]).toEqual([AppearanceFixture.readColor(theme, mode, "foreground"), root.getPropertyValue("--tr-font-mono"), resolve("font-size", "var(--tr-text-code)")]);
        expect(Number.parseFloat(code.lineHeight) / Number.parseFloat(code.fontSize)).toBeCloseTo(1.5);
        const inner = getComputedStyle(find(".tr-code-block-body > code"));
        AppearanceFixture.expectLook(inner.paddingTop, theme, "space-2", "padding-top");
        AppearanceFixture.expectLook(inner.paddingLeft, theme, "space-3", "padding-left");
        AppearanceFixture.expectLook(inner.paddingRight, theme, "space-3", "padding-right");
        expect(getComputedStyle(body().querySelector("code") as Element).fontFamily).toBe(code.fontFamily);
      });

  for (const mode of AppearanceFixture.modes)
    it(`keeps its code at least 4.5:1 and its language at least 4.5:1 against their surfaces in ${mode} mode`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      await renderAsync();
      const code = getComputedStyle(body());
      const header = getComputedStyle(find(".tr-code-block-header"));

      expect(AppearanceFixture.contrast(code.color, getComputedStyle(find("tr-code-block")).backgroundColor)).toBeGreaterThanOrEqual(4.5);
      expect(AppearanceFixture.contrast(getComputedStyle(find(".tr-code-block-language")).color, header.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    });
});
