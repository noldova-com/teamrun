/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, computed, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { QuickInputComponent } from "../../../../src/app/components/quick-input/quick-input.component";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { QuickInputItem } from "../../../../src/app/models/quick-input-item";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

const many: readonly QuickInputItem[] = Array.from({ length: 30 }, (_, index) => new QuickInputItem(`notes.command${index}`, `Command ${index}`, null, null, null));

function press(target: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

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

@Component({
  imports: [QuickInputComponent],
  template: `
    <div class="page" style="height: 300px; overflow-y: auto;">
      <div style="height: 400px;"></div>
      <div style="display: flex; height: 200px;">
        <tr-quick-input [items]="items" label="Search commands" [isFocusing]="false" />
      </div>
      <div style="height: 400px;"></div>
    </div>
  `
})
class PageHostComponent {
  public readonly items: readonly QuickInputItem[] = many;
}

@Component({
  imports: [QuickInputComponent],
  template: `<tr-quick-input [items]="items()" label="Search commands" [(query)]="query" (chosen)="chosen.push($event.id)" />`
})
class FilteringHostComponent {
  public readonly query = signal("");
  public readonly items: Signal<readonly QuickInputItem[]> = computed(() => many.filter(t => t.title.includes(this.query())));
  public readonly chosen: string[] = [];
}

describe("QuickInputComponent", () => {
  let fixture: ComponentFixture<QuickInputHostComponent>;
  let host: QuickInputHostComponent;

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
    const event = press(field(), key);
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

  it("scrolls only its own list to show the active option, leaving the page around it where it is", async () => {
    const paged = TestBed.createComponent(PageHostComponent);
    paged.detectChanges();
    await paged.whenStable();
    const page = paged.nativeElement.querySelector(".page") as HTMLElement;
    const list = paged.nativeElement.querySelector(".tr-quick-input-list") as HTMLElement;
    const input = paged.nativeElement.querySelector(".tr-quick-input-field") as HTMLInputElement;
    const rows = [...list.querySelectorAll<HTMLElement>("[role=option]")];
    const within = (row: HTMLElement | undefined): boolean => {
      const box = (row ?? list).getBoundingClientRect();
      const frame = list.getBoundingClientRect();
      return box.top >= frame.top + list.clientTop - 0.5 && box.bottom <= frame.top + list.clientTop + list.clientHeight + 0.5;
    };
    const moveAsync = async (key: string): Promise<readonly [number, number, boolean]> => {
      press(input, key);
      paged.detectChanges();
      await paged.whenStable();
      return [page.scrollTop, list.scrollTop, within(rows.find(t => t.id === input.getAttribute("aria-activedescendant")))];
    };

    const opened = [page.scrollTop, list.scrollTop];
    const end = await moveAsync("End");
    const up = await moveAsync("ArrowUp");
    const home = await moveAsync("Home");

    expect(opened).toEqual([0, 0]);
    expect([end[0], end[1] > 0, end[2]]).toEqual([0, true, true]);
    expect(up).toEqual([0, end[1], true]);
    expect(home).toEqual([0, 0, true]);
    paged.destroy();
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

  async function filteringAsync(): Promise<ComponentFixture<FilteringHostComponent>> {
    const filtering = TestBed.createComponent(FilteringHostComponent);
    filtering.detectChanges();
    await filtering.whenStable();
    return filtering;
  }

  function fieldOf(filtering: ComponentFixture<FilteringHostComponent>): HTMLInputElement {
    return filtering.nativeElement.querySelector(".tr-quick-input-field");
  }

  function type(filtering: ComponentFixture<FilteringHostComponent>, text: string): void {
    fieldOf(filtering).value = text;
    fieldOf(filtering).dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("chooses from the options for the text just typed when Enter comes before they are shown, once however often Enter is pressed", async () => {
    const filtering = await filteringAsync();

    press(fieldOf(filtering), "ArrowDown");
    type(filtering, "Command 7");
    press(fieldOf(filtering), "Enter");
    press(fieldOf(filtering), "Enter");
    const before = [...filtering.componentInstance.chosen];
    filtering.detectChanges();
    await filtering.whenStable();

    expect(before).toEqual([]);
    expect(filtering.componentInstance.chosen).toEqual(["notes.command7"]);
    filtering.destroy();
  });

  it("chooses at once when Enter comes after the options for its text are shown", async () => {
    const filtering = await filteringAsync();

    type(filtering, "Command 2");
    filtering.detectChanges();
    await filtering.whenStable();
    press(fieldOf(filtering), "ArrowDown");
    press(fieldOf(filtering), "Enter");

    expect(filtering.componentInstance.chosen).toEqual(["notes.command20"]);
    filtering.destroy();
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

  it("opens with no options and no active one when it starts with none", async () => {
    const empty = TestBed.createComponent(QuickInputComponent);
    empty.componentRef.setInput("items", []);
    empty.componentRef.setInput("label", "Search commands");
    empty.componentRef.setInput("isFocusing", false);
    document.body.append(empty.nativeElement);

    empty.detectChanges();
    await empty.whenStable();

    const list = empty.nativeElement.querySelector(".tr-quick-input-list") as HTMLElement;
    expect([list.children.length, list.scrollTop]).toEqual([0, 0]);
    expect(empty.nativeElement.querySelector(".tr-quick-input-field")?.hasAttribute("aria-activedescendant")).toBe(false);
    empty.destroy();
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
