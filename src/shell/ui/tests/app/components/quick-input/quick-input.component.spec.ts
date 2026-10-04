/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { QuickInputComponent } from "../../../../src/app/components/quick-input/quick-input.component";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { QuickInputItem } from "../../../../src/app/models/quick-input-item";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [QuickInputComponent],
  template: `
    <div style="display: flex; height: 200px;">
      <tr-quick-input [items]="items()" label="Search commands" [(query)]="query" (chosen)="chosen.push($event.id)" (dismissed)="dismissals = dismissals + 1" />
    </div>
  `
})
class QuickInputHostComponent {
  public readonly items = signal<readonly QuickInputItem[]>([]);
  public readonly query = signal("");
  public readonly chosen: string[] = [];
  public dismissals: number = 0;
}

describe("QuickInputComponent", () => {
  let fixture: ComponentFixture<QuickInputHostComponent>;
  let host: QuickInputHostComponent;
  const many = Array.from({ length: 30 }, (_, index) => new QuickInputItem(`notes.command${index}`, `Command ${index}`, null, null, null));

  beforeEach(async () => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(QuickInputHostComponent);
    host = fixture.componentInstance;
    host.items.set(many);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    AppearanceFixture.reset();
  });

  function root(): HTMLElement {
    return fixture.nativeElement;
  }

  function field(): HTMLInputElement {
    return fixture.nativeElement.querySelector(".tr-quick-input-field");
  }

  function options(): HTMLElement[] {
    return [...root().querySelectorAll<HTMLElement>("[role=option]")];
  }

  function activeIndex(): number {
    return options().findIndex(t => t.id === field().getAttribute("aria-activedescendant"));
  }

  async function pressAsync(key: string): Promise<KeyboardEvent> {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    field().dispatchEvent(event);
    fixture.detectChanges();
    await fixture.whenStable();
    return event;
  }

  it("is a combobox over a listbox of options with the first one active, and focuses its field", async () => {
    const list = fixture.nativeElement.querySelector("[role=listbox]") as HTMLElement;

    await vi.waitFor(() => expect(document.activeElement).toBe(field()));
    expect([field().getAttribute("role"), field().getAttribute("aria-autocomplete"), field().getAttribute("aria-expanded")]).toEqual(["combobox", "list", "true"]);
    expect(field().getAttribute("aria-controls")).toBe(list.id);
    expect([field().getAttribute("aria-label"), field().placeholder, list.getAttribute("aria-label")]).toEqual(["Search commands", "Search commands", "Search commands"]);
    expect(options().length).toBe(30);
    expect(activeIndex()).toBe(0);
    expect(options().map(t => t.getAttribute("aria-selected")).filter(t => t === "true").length).toBe(1);
  });

  it("leaves the focus where it is when it is not asked to take it", async () => {
    const quiet = TestBed.createComponent(QuickInputComponent);
    quiet.componentRef.setInput("items", many);
    quiet.componentRef.setInput("label", "Search commands");
    quiet.componentRef.setInput("isFocusing", false);
    document.body.append(quiet.nativeElement);
    const other = document.createElement("button");
    document.body.append(other);

    other.focus();
    quiet.detectChanges();
    await quiet.whenStable();

    expect(document.activeElement).toBe(other);
    quiet.destroy();
    other.remove();
  });

  it("moves through its options with the arrow keys, Home, End and the page keys, stopping at either end, and leaves other keys alone", async () => {
    const visited: number[] = [];
    for (const key of ["ArrowDown", "ArrowDown", "ArrowUp", "End", "ArrowDown", "Home", "ArrowUp", "PageDown"]) {
      expect((await pressAsync(key)).defaultPrevented).toBe(true);
      visited.push(activeIndex());
    }
    const page = visited.at(-1) ?? 0;
    await pressAsync("PageUp");

    expect(visited.slice(0, -1)).toEqual([1, 2, 1, 29, 29, 0, 0]);
    expect(page).toBeGreaterThan(1);
    expect(activeIndex()).toBe(0);
    expect((await pressAsync("a")).defaultPrevented).toBe(false);
    expect(options()[29]?.getBoundingClientRect().bottom).toBeGreaterThan(0);
  });

  it("chooses the active option with Enter or a clicked one, is dismissed with Escape, and passes typed text on as its query", async () => {
    await pressAsync("ArrowDown");
    await pressAsync("Enter");
    options()[3]?.click();
    await pressAsync("Escape");
    await userEvent.type(field(), "clo");

    expect(host.chosen).toEqual(["notes.command1", "notes.command3"]);
    expect(host.dismissals).toBe(1);
    expect(host.query()).toBe("clo");
  });

  it("starts at the first option again when its options change, and chooses nothing and announces no results when it has none", async () => {
    await pressAsync("End");
    host.items.set(many.slice(0, 2));
    fixture.detectChanges();
    await fixture.whenStable();
    const status = fixture.nativeElement.querySelector("[role=status]") as HTMLElement;
    const twoResults = status.textContent;
    expect(activeIndex()).toBe(0);

    host.items.set([]);
    fixture.detectChanges();
    await pressAsync("PageDown");
    await pressAsync("Enter");

    expect(twoResults?.trim()).toBe("2 results");
    expect(status.textContent?.trim()).toBe("No results");
    expect(field().hasAttribute("aria-activedescendant")).toBe(false);
    expect(host.chosen).toEqual([]);
    host.items.set(many.slice(0, 1));
    fixture.detectChanges();
    expect(status.textContent?.trim()).toBe("1 result");
  });

  it("shows an option's icon, its title and detail with the matched characters marked in the list highlight and no added space, and its key", async () => {
    host.items.set([new QuickInputItem("shell.closeTab", "Close the tab", "close", "TeamRun", "Ctrl+W", [6, 7, 8], [4, 5, 6]), new QuickInputItem("notes.sync", "Sync", null, null, null)]);
    fixture.detectChanges();
    await fixture.whenStable();
    const [full, bare] = options();

    expect(full?.querySelector(".tr-quick-input-icon")?.textContent).toBe("close");
    const mark = getComputedStyle(full?.querySelector("mark") as Element);
    expect([...full?.querySelectorAll("mark") ?? []].map(t => t.textContent)).toEqual(["the", "Run"]);
    expect([mark.color, mark.fontWeight, mark.backgroundColor]).toEqual([AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "list.highlightForeground"), "600", "rgba(0, 0, 0, 0)"]);
    expect([full?.querySelector(".tr-quick-input-title")?.textContent, full?.querySelector(".tr-quick-input-detail")?.textContent, full?.querySelector(".tr-quick-input-key")?.textContent])
      .toEqual(["Close the tab", "TeamRun", "Ctrl+W"]);
    expect([bare?.querySelector(".tr-quick-input-icon")?.textContent, bare?.querySelector(".tr-quick-input-detail"), bare?.querySelector(".tr-quick-input-key")]).toEqual(["", null, null]);
    expect(bare?.querySelector(".tr-quick-input-icon")?.getBoundingClientRect().width).toBe(full?.querySelector(".tr-quick-input-icon")?.getBoundingClientRect().width);
    expect(bare?.querySelector(".tr-quick-input-title")?.getBoundingClientRect().left).toBe(full?.querySelector(".tr-quick-input-title")?.getBoundingClientRect().left);
  });

  it("takes its outline, margin, padding and gap from the theme and fits its options in its height", () => {
    const style = getComputedStyle(fixture.nativeElement.querySelector("tr-quick-input"));
    const list = fixture.nativeElement.querySelector("[role=listbox]") as HTMLElement;
    const probe = document.body.appendChild(document.createElement("div"));
    probe.style.border = "1px solid var(--tr-widget-border)";
    const outline = getComputedStyle(probe).borderTopColor;
    probe.style.border = "1px solid var(--tr-menu-border)";
    const menuBorder = getComputedStyle(probe).borderTopColor;
    probe.remove();

    expect([style.borderTopColor, outline === menuBorder]).toEqual([outline, false]);

    const theme = DefaultTheme.theme;

    AppearanceFixture.expectLook(style.marginTop, theme, "quick-input-margin", "margin-top");
    AppearanceFixture.expectLook(style.paddingTop, theme, "quick-input-padding", "padding-top", "padding");
    AppearanceFixture.expectLook(style.paddingBottom, theme, "quick-input-padding", "padding-bottom", "padding");
    AppearanceFixture.expectLook(style.rowGap, theme, "quick-input-gap", "row-gap", "gap");
    AppearanceFixture.expectLook(getComputedStyle(field()).minHeight, theme, "field-height", "min-height");
    AppearanceFixture.expectLook(getComputedStyle(field()).paddingLeft, theme, "field-padding", "padding-left");
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
  });
});
