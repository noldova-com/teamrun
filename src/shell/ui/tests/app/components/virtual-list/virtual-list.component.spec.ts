/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal, viewChild } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { VirtualListComponent } from "../../../../src/app/components/virtual-list/virtual-list.component";
import { VirtualRowDirective } from "../../../../src/app/components/virtual-list/virtual-row.directive";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { ArrayVirtualListSource } from "../../../../src/app/models/array-virtual-list-source";
import { DefaultTheme } from "../../../../src/app/models/default-theme";
import type { VirtualListSource } from "../../../../src/app/models/virtual-list-source";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { VirtualListSourceFixture } from "../../../fixtures/virtual-list-source.fixture";

function numbered(count: number): ArrayVirtualListSource<string> {
  return new ArrayVirtualListSource(Array.from({ length: count }, (_, t) => `item ${t}`), t => t, 30);
}

@Component({
  imports: [VirtualListComponent, VirtualRowDirective],
  template: `
    <tr-virtual-list label="Items" [source]="source()" [selected]="selected()" (activated)="activations.push($event)" (failed)="errors.push($event)">
      <ng-template [trVirtualRow]="source()" let-item let-height="height"><span class="label" [attr.data-height]="height">{{ item }}</span></ng-template>
    </tr-virtual-list>
    <button type="button" class="outside">Outside</button>
  `,
  styles: "tr-virtual-list { width: 200px; height: 300px; }"
})
class VirtualListHostComponent {
  public readonly list = viewChild.required(VirtualListComponent);
  public readonly source = signal<VirtualListSource<string>>(numbered(1000));
  public readonly selected = signal<string | null>(null);
  public readonly activations: string[] = [];
  public readonly errors: unknown[] = [];
}

describe("VirtualListComponent", () => {
  let fixture: ComponentFixture<VirtualListHostComponent>;
  let host: VirtualListHostComponent;

  async function settleAsync(): Promise<void> {
    for (let pass = 0; pass < 3; pass++) {
      await fixture.whenStable();
      await new Promise<void>(t => requestAnimationFrame(() => requestAnimationFrame(() => t())));
    }
    await fixture.whenStable();
  }

  async function renderAsync(source: VirtualListSource<string> = numbered(1000), theme = DefaultTheme.theme, mode = ThemeMode.Light): Promise<void> {
    AppearanceFixture.apply(theme, mode);
    fixture = TestBed.createComponent(VirtualListHostComponent);
    host = fixture.componentInstance;
    host.source.set(source);
    await settleAsync();
  }

  async function scrollAsync(top: number): Promise<void> {
    viewport().scrollTop = top;
    viewport().dispatchEvent(new Event("scroll"));
    await settleAsync();
  }

  async function pressAsync(keys: string): Promise<void> {
    await userEvent.keyboard(keys);
    await settleAsync();
  }

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const viewport = (): HTMLElement => element().querySelector(".tr-virtual-list-viewport") as HTMLElement;
  const listbox = (): HTMLElement => element().querySelector("[role=listbox]") as HTMLElement;
  const options = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("[role=option]")];
  const option = (label: string): HTMLElement => {
    const found = options().find(t => t.querySelector(".label")?.textContent === label);
    if (Object.isUndefined(found))
      throw new Error(`No row labelled ${label}.`);
    return found;
  };
  const focused = (): string | null | undefined => document.activeElement?.querySelector(".label")?.textContent;
  const focusedPlace = (): string | null | undefined => document.activeElement?.getAttribute("aria-posinset");
  const offsetOf = (label: string): number => option(label).getBoundingClientRect().top - viewport().getBoundingClientRect().top;
  const status = (): HTMLElement => element().querySelector("[role=status]") as HTMLElement;
  const failure = (): HTMLElement | null => element().querySelector(".tr-virtual-list-failure");
  const stops = (): string[] => options().filter(t => t.tabIndex === 0).map(t => t.getAttribute("aria-posinset") ?? String.empty);

  afterEach(() => AppearanceFixture.reset());

  it("is a named listbox that renders only the rows around its view, as many for 100,000 items as for 1,000, each marked with its place in the whole list", async () => {
    await renderAsync();
    const thousand = options().length;
    const [first] = options();
    host.source.set(numbered(100_000));
    await settleAsync();

    expect([listbox().getAttribute("aria-label"), listbox().getAttribute("aria-busy"), viewport().scrollHeight]).toEqual(["Items", "false", 3_000_000]);
    expect([first?.getAttribute("aria-posinset"), first?.getAttribute("aria-setsize"), options()[0]?.getAttribute("aria-setsize")]).toEqual(["1", "1000", "100000"]);
    expect([options().length, thousand < 40]).toEqual([thousand, true]);
  });

  it("measures each row it renders, gives its template that height, and keeps the estimate for rows it never rendered", async () => {
    await renderAsync(new ArrayVirtualListSource([`${"long ".repeat(40)}item`, ...Array.from({ length: 999 }, (_, t) => `item ${t + 1}`)], t => t, 20));
    const slots = options().map(t => t.parentElement as HTMLElement);
    const tall = slots[0] as HTMLElement;
    const rendered = slots.reduce((sum, t) => sum + t.getBoundingClientRect().height, 0);

    expect(tall.getBoundingClientRect().height).toBeGreaterThan(100);
    expect(Number(tall.querySelector(".label")?.getAttribute("data-height"))).toBeCloseTo(tall.getBoundingClientRect().height);
    expect(slots.length).toBeLessThan(1000);
    expect(Math.abs(viewport().scrollHeight - rendered - (1000 - slots.length) * 20)).toBeLessThan(1);
  });

  it("keeps the row being read in place while rows above it are inserted, removed, replaced or measured", async () => {
    const source = numbered(1000);
    await renderAsync(source);
    await scrollAsync(3000);
    const before = offsetOf("item 100");

    source.insert(0, ["new 0", "new 1", "new 2"]);
    await settleAsync();
    const inserted = offsetOf("item 100");
    source.remove(0, 13);
    await settleAsync();
    const removed = offsetOf("item 100");
    source.replace(89, [`${"long ".repeat(40)}item`]);
    await settleAsync();

    expect([before, inserted, removed, offsetOf("item 100")].map(t => Math.round(t))).toEqual([0, 0, 0, 0]);
    expect(option("item 100").getAttribute("aria-posinset")).toBe("91");
  });

  it("follows the listbox keys: arrows move, Page Up and Page Down move by a view, Home and End jump, and Enter or Space chooses", async () => {
    await renderAsync();
    host.list().focus();
    await settleAsync();
    const start = focusedPlace();

    await pressAsync("{ArrowDown}");
    const down = focusedPlace();
    await pressAsync("{ArrowUp}{ArrowUp}");
    const up = focusedPlace();
    await pressAsync("{PageDown}");
    const pageDown = focusedPlace();
    await pressAsync("{PageUp}");
    const pageUp = focusedPlace();
    await pressAsync("{End}");
    const end = [focused(), viewport().scrollTop];
    await pressAsync("{Home}");
    const home = [focused(), viewport().scrollTop];
    await pressAsync("{Enter}{ArrowDown} ");

    expect([start, down, up, pageDown, pageUp, end, home]).toEqual(["1", "2", "1", "11", "1", ["item 999", 29_700], ["item 0", 0]]);
    expect(host.activations).toEqual(["item 0", "item 1"]);
  });

  it("leaves keys with a modifier, and other keys, to the shell and the page", async () => {
    await renderAsync();
    host.list().focus();
    await settleAsync();
    const press = (key: string, init: KeyboardEventInit = {}): boolean =>
      (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));

    const results = [press("ArrowDown", { altKey: true }), press("ArrowDown", { ctrlKey: true }), press("ArrowDown", { metaKey: true }), press("ArrowDown", { shiftKey: true }), press("x")];
    await settleAsync();

    expect([results, focusedPlace(), host.activations]).toEqual([[true, true, true, true, true], "1", []]);
  });

  it("puts its one Tab stop on the row last focused, or the selected row, or the first", async () => {
    await renderAsync();
    const first = stops();
    host.selected.set("item 3");
    await settleAsync();
    const selected = [stops(), option("item 3").getAttribute("aria-selected"), option("item 3").classList.contains("tr-virtual-list-option-selected")];
    await userEvent.click(option("item 5"));
    await settleAsync();
    const clicked = stops();
    (element().querySelector(".outside") as HTMLElement).focus();
    await userEvent.tab({ shift: true });

    expect([first, selected, clicked, focused(), host.activations]).toEqual([["1"], [["4"], "true", true], ["6"], "item 5", ["item 5"]]);
  });

  it("keeps the focused row rendered, at its place, while the view scrolls far from it", async () => {
    await renderAsync();
    host.list().focus();
    await settleAsync();

    await scrollAsync(15_000);
    const below = options().find(t => t.getAttribute("aria-posinset") === "1")?.parentElement as HTMLElement;
    const belowTop = below.style.top;
    await pressAsync("{End}");
    await scrollAsync(0);
    const above = options().find(t => t.getAttribute("aria-posinset") === "1000")?.parentElement as HTMLElement;

    expect([belowTop, below.classList.contains("tr-virtual-list-slot-outside"), above.style.top, document.activeElement === above.firstElementChild]).toEqual(["0px", true, "29970px", true]);
  });

  it("passes the focus to the row after a focused row that is removed, or before it at the end, and has no Tab stop once empty", async () => {
    const source = numbered(5);
    await renderAsync(source);
    option("item 2").focus();
    await settleAsync();

    source.remove(2, 1);
    await settleAsync();
    const after = focused();
    option("item 4").focus();
    source.remove(3, 1);
    await settleAsync();
    const before = focused();
    source.remove(0, 3);
    await settleAsync();
    host.list().focus();

    expect([after, before, options().length, stops()]).toEqual(["item 3", "item 3", 0, []]);
  });

  it("moves the focused row's place with rows inserted before it, and leaves it when rows come or go after it", async () => {
    const source = numbered(5);
    await renderAsync(source);
    option("item 2").focus();
    await settleAsync();

    source.insert(4, ["late"]);
    source.insert(0, ["early"]);
    source.remove(5, 1);
    await settleAsync();

    expect([focused(), focusedPlace()]).toEqual(["item 2", "4"]);
  });

  it("does not take the focus back once it has left the list", async () => {
    const source = numbered(5);
    await renderAsync(source);
    option("item 2").focus();
    await userEvent.click(element().querySelector(".outside") as HTMLElement);
    await settleAsync();

    source.insert(0, ["early"]);
    await settleAsync();

    expect(document.activeElement?.className).toBe("outside");
  });

  it("shows rows not yet loaded as blank space hidden from assistive technology, with the Tab stop kept, and says it is loading", async () => {
    const source = new VirtualListSourceFixture(200, 30);
    await renderAsync(source);
    const [first, second] = options();
    const loading = [status().textContent?.trim(), listbox().getAttribute("aria-busy"), status().classList.contains("tr-virtual-list-edge-end")];
    const blank = [first?.getAttribute("aria-hidden"), first?.tabIndex, second?.getAttribute("aria-hidden"), second?.hasAttribute("tabindex"), first?.parentElement?.style.height];

    await source.readAt(0).answerAsync();
    await settleAsync();

    expect([loading, blank]).toEqual([["Loading…", "true", false], [null, 0, "true", false, "30px"]]);
    expect([status().textContent?.trim(), listbox().getAttribute("aria-busy"), options()[1]?.getAttribute("aria-hidden"), options()[1]?.tabIndex]).toEqual([String.empty, "false", null, -1]);
  });

  it("shows where rows are missing at the end of the view when the rows before them have loaded", async () => {
    const source = new VirtualListSourceFixture(200, 30);
    await renderAsync(source);
    await source.readAt(0).answerAsync();
    await settleAsync();

    await scrollAsync(1400);

    expect([status().textContent?.trim(), status().classList.contains("tr-virtual-list-edge-end")]).toEqual(["Loading…", true]);
  });

  it("reports a read that fails, says the items couldn't load with a Retry button, and reads them again when it is chosen", async () => {
    const source = new VirtualListSourceFixture(200, 30);
    const refusal = new Error("The store went away.");
    await renderAsync(source);

    await source.readAt(0).refuseAsync(refusal);
    await settleAsync();
    const shown = [failure()?.querySelector("tr-field-message")?.textContent, failure()?.querySelector("button")?.textContent, status().textContent?.trim(), listbox().getAttribute("aria-busy")];
    const edge = failure()?.classList.contains("tr-virtual-list-edge-end");
    await userEvent.click(failure()?.querySelector("button") as HTMLElement);
    await settleAsync();
    await source.readAt(source.reads.length - 1).answerAsync();
    await settleAsync();

    expect([shown, edge, host.errors, failure(), option("item 0").textContent]).toEqual([["These items couldn't load.", "Retry", String.empty, "false"], false, [refusal], null, "item 0"]);
  });

  it("shows a failure at the end of the view when the rows before it have loaded", async () => {
    const source = new VirtualListSourceFixture(200, 30);
    await renderAsync(source);
    await source.readAt(0).answerAsync();
    await scrollAsync(1400);

    await source.readAt(source.reads.length - 1).refuseAsync(new Error("The store went away."));
    await settleAsync();

    expect(failure()?.classList.contains("tr-virtual-list-edge-end")).toBe(true);
  });

  it("holds the focus on a row not yet loaded that a key reaches, and keeps it there once the row loads", async () => {
    const source = new VirtualListSourceFixture(200, 30);
    await renderAsync(source);
    await source.readAt(0).answerAsync();
    await settleAsync();
    option("item 0").focus();

    await pressAsync("{End}");
    const waiting = [focusedPlace(), document.activeElement?.getAttribute("aria-hidden"), host.activations.length];
    await pressAsync("{Enter}");
    for (const read of source.reads.filter(t => !t.abort.aborted && t.start >= 150))
      await read.answerAsync();
    await settleAsync();

    expect([waiting, host.activations, focused(), focusedPlace()]).toEqual([["200", null, 0], [], "item 199", "200"]);
  });

  it("reads the rows its source changed again", async () => {
    const source = numbered(5);
    await renderAsync(source);

    source.replace(1, ["changed"]);
    await settleAsync();

    expect(options().map(t => t.textContent)).toEqual(["item 0", "changed", "item 2", "item 3", "item 4"]);
  });

  it("starts again at the top with a new source, and stops reading and following the one it had", async () => {
    const old = new VirtualListSourceFixture(200, 30);
    await renderAsync(old);
    await scrollAsync(300);

    host.source.set(numbered(5));
    await settleAsync();
    old.reportInserted(0, 1);
    await settleAsync();

    expect([viewport().scrollTop, options().map(t => t.textContent), old.reads.every(t => t.abort.aborted)]).toEqual([0, ["item 0", "item 1", "item 2", "item 3", "item 4"], true]);
  });

  it("stops reading and following its source once destroyed", async () => {
    const source = new VirtualListSourceFixture(200, 30);
    await renderAsync(source);

    fixture.destroy();
    source.reportInserted(0, 1);

    expect(source.reads.every(t => t.abort.aborted)).toBe(true);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes the tree row's geometry and colors from the ${theme.id} theme in ${mode} mode`, async () => {
        await renderAsync(numbered(5), theme, mode);
        host.selected.set("item 1");
        await settleAsync();
        await userEvent.hover(option("item 2"));
        const row = getComputedStyle(option("item 0"));

        AppearanceFixture.expectLook(`${option("item 0").getBoundingClientRect().height}px`, theme, "tree-row-height", "height");
        AppearanceFixture.expectLook(row.paddingLeft, theme, "space-2", "padding-left");
        AppearanceFixture.expectLook(row.borderTopLeftRadius, theme, "radius-small", "border-top-left-radius");
        AppearanceFixture.expectLook(getComputedStyle(option("item 0").parentElement as Element).paddingBottom, theme, "space-1", "padding-bottom");
        expect(row.color).toBe(AppearanceFixture.readColor(theme, mode, "foreground"));
        expect(getComputedStyle(option("item 1")).backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "list.inactiveSelectionBackground"));
        expect(getComputedStyle(option("item 2")).backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "list.hoverBackground"));
        expect(row.backgroundColor).toBe("rgba(0, 0, 0, 0)");
      });
});
