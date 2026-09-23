/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { TeammateMention } from "@noldova/teamrun-protocol";

import { Resources } from "../../../../src/app/resources";
import { MarkdownComponent } from "../../../../src/app/components/markdown/markdown.component";

describe("MarkdownComponent", () => {
  it("highlights historical mentions outside code without making markup executable", () => {
    const fixture = TestBed.createComponent(MarkdownComponent);
    fixture.componentRef.setInput("mentions", [new TeammateMention("a", "Alice")]);
    fixture.componentRef.setInput("unavailableMentions", ["a"]);
    fixture.componentRef.setInput("text", "Ask @Alice and **@Alice**; \\@Alice is escaped, `@Alice` is code. <script>bad()</script>\n\n```\n@Alice\n```");
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll(".tr-mention")).toHaveLength(2);
    expect(root.querySelectorAll(".tr-mention-unavailable")).toHaveLength(0);
    expect(root.querySelectorAll(".tr-mention.tr-teammate-unavailable")).toHaveLength(2);
    expect(root.querySelector("code .tr-mention")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
  });
  it("wraps blocks independently, keeps wrapping through text updates, and copies the original lines", async () => {
    TestBed.configureTestingModule({ imports: [MarkdownComponent] });
    const fixture = TestBed.createComponent(MarkdownComponent);
    const original = "    const value = 'a long line with spaces';\n";
    const text = "```ts\n" + original + "```\n\n```text\nsecond\n```";
    fixture.componentRef.setInput("text", text);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = element.querySelectorAll<HTMLElement>(Resources.wrapButtonSelector);
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("false");
    buttons[0]!.click();
    expect(element.querySelector("pre")?.classList.contains(Resources.wrappedClass)).toBe(true);
    expect(buttons[0]!.title).toBe(Resources.disableWordWrapLabel);
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("false");

    const space = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    buttons[1]!.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");
    buttons[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("false");

    fixture.componentRef.setInput("text", text + "\n\nStreaming more text.");
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.querySelector("pre")?.classList.contains(Resources.wrappedClass)).toBe(true);
    expect(element.querySelectorAll(Resources.wrapButtonSelector)[1]?.getAttribute("aria-pressed")).toBe("false");
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text: string) => { written.push(text); } }, configurable: true });
    element.querySelector<HTMLElement>(Resources.copyButtonSelector)!.click();
    expect(written).toEqual([original]);
    element.querySelector<HTMLElement>(Resources.wrapButtonSelector)!.click();
    expect(element.querySelector("pre")?.classList.contains(Resources.wrappedClass)).toBe(false);
  });

  it("renders code blocks with a language header and copies their text", async () => {
    TestBed.configureTestingModule({ imports: [MarkdownComponent] });
    const fixture = TestBed.createComponent(MarkdownComponent);
    fixture.componentRef.setInput("text", "Intro\n\n```typescript title\nconst a = 1;\n```\n\n```\nplain\n```\n\nDone `x`");
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const blocks = element.querySelectorAll(".tr-code");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.querySelector(".tr-code-header span")?.textContent).toBe("typescript");
    expect(blocks[1]?.querySelector(".tr-code-header span")?.textContent).toBe(Resources.codeLabel);
    expect(blocks[0]?.querySelector("pre code")?.textContent).toContain("const a = 1;");
    expect(blocks[0]?.querySelector("pre code .hljs-keyword")?.textContent).toBe("const");
    expect(blocks[1]?.querySelector("pre code .hljs-keyword")).toBeNull();

    const written: string[] = [];
    const clipboard = { writeText: (text: string): Promise<void> => { written.push(text); return Promise.resolve(); } };
    Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
    vi.useFakeTimers();
    const copy = blocks[0]!.querySelector<HTMLElement>(".tr-copy")!;
    expect(copy.textContent).toBe(Resources.copyIcon);
    expect(copy.title).toBe(Resources.copyLabel);
    expect(copy.ariaLabel).toBe(Resources.copyLabel);
    copy.click();
    expect(copy.classList.contains(Resources.copiedClass)).toBe(true);
    expect(copy.textContent).toBe(Resources.copiedIcon);
    expect(copy.title).toBe(Resources.copiedLabel);
    expect(copy.ariaLabel).toBe(Resources.copiedLabel);
    vi.advanceTimersByTime(Resources.copiedDuration);
    expect(copy.classList.contains(Resources.copiedClass)).toBe(false);
    expect(copy.textContent).toBe(Resources.copyIcon);
    expect(copy.title).toBe(Resources.copyLabel);
    expect(copy.ariaLabel).toBe(Resources.copyLabel);
    vi.useRealTimers();
    element.querySelector<HTMLElement>("p")!.click();
    await fixture.whenStable();

    expect(written).toEqual(["const a = 1;\n"]);
  });
});
