/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LiveAnnouncer } from "@angular/cdk/a11y";
import { Component, signal, viewChild } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { VirtualListComponent } from "../../../../src/app/components/virtual-list/virtual-list.component";
import { VirtualRowDirective } from "../../../../src/app/components/virtual-list/virtual-row.directive";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { VirtualListAlign } from "../../../../src/app/enums/virtual-list-align";
import { VirtualListKind } from "../../../../src/app/enums/virtual-list-kind";
import { ArrayVirtualListSource } from "../../../../src/app/models/array-virtual-list-source";
import { DefaultTheme } from "../../../../src/app/models/default-theme";
import { VirtualListPosition } from "../../../../src/app/models/virtual-list-position";
import type { VirtualListSource } from "../../../../src/app/models/virtual-list-source";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { VirtualListSourceFixture } from "../../../fixtures/virtual-list-source.fixture";

function numbered(count: number): ArrayVirtualListSource<string> {
  return new ArrayVirtualListSource(Array.from({ length: count }, (_, t) => `item ${t}`), t => t, 30);
}

@Component({
  imports: [VirtualListComponent, VirtualRowDirective],
  template: `
    <tr-virtual-list label="Items" [source]="source()" [selected]="selected()" (activated)="activations.push($event.index); chosen.push($event.item)" (failed)="errors.push($event)">
      <ng-template [trVirtualRow]="source()" let-item let-height="height"><span class="label" [attr.data-height]="height">{{ item }}</span></ng-template>
    </tr-virtual-list>
    <button type="button" class="outside">Outside</button>
  `,
  styles: "tr-virtual-list { width: 200px; height: 300px; }"
})
class VirtualListHostComponent {
  public readonly list = viewChild.required(VirtualListComponent);
  public readonly source = signal<VirtualListSource<string>>(numbered(1000));
  public readonly selected = signal<number | null>(null);
  public readonly activations: number[] = [];
  public readonly chosen: string[] = [];
  public readonly errors: unknown[] = [];
}

@Component({
  imports: [VirtualListComponent, VirtualRowDirective],
  template: `
    <button type="button" class="before">Before</button>
    <button type="button" class="off" disabled>Off</button>
    <tr-virtual-list label="Messages" [kind]="kind" [source]="source()" [position]="position()" (activated)="activations.push($event.index)" (positionChange)="positions.push($event)">
      <ng-template [trVirtualRow]="source()" [trVirtualRowDescribed]="true" let-item let-labelId="labelId" let-descriptionId="descriptionId">
        <div class="message" [class.long]="item.startsWith('long')"><span class="label" [id]="labelId">{{ item }}</span> <span [id]="descriptionId">sent</span> <button type="button" class="reply">Reply</button>@if (item.startsWith('picture')) {<img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">}</div>
      </ng-template>
    </tr-virtual-list>
    <button type="button" class="outside">Outside</button>
  `,
  styles: "tr-virtual-list { width: 200px; height: 300px; } .message { box-sizing: border-box; height: 26px; overflow: hidden; } .long { height: 200px; }"
})
class FeedHostComponent {
  public readonly list = viewChild.required(VirtualListComponent);
  public readonly kind: VirtualListKind = VirtualListKind.Feed;
  public readonly source = signal<VirtualListSource<string>>(numbered(1000));
  public readonly position = signal<VirtualListPosition | null>(null);
  public readonly activations: number[] = [];
  public readonly positions: VirtualListPosition[] = [];
}

describe("VirtualListComponent", () => {
  let fixture: ComponentFixture<unknown>;
  let host: VirtualListHostComponent;
  let feed: FeedHostComponent;

  async function settleAsync(): Promise<void> {
    let last = String.empty;
    for (let pass = 0; pass < 10; pass++) {
      await fixture.whenStable();
      await new Promise<void>(t => requestAnimationFrame(() => requestAnimationFrame(() => t())));
      const shape = `${element().querySelectorAll("[data-tr-row]").length} ${viewport().scrollHeight} ${viewport().scrollTop}`;
      if (shape === last)
        return;
      last = shape;
    }
  }

  async function renderAsync(source: VirtualListSource<string> = numbered(1000), theme = DefaultTheme.theme, mode = ThemeMode.Light): Promise<void> {
    AppearanceFixture.apply(theme, mode);
    const created = TestBed.createComponent(VirtualListHostComponent);
    fixture = created;
    host = created.componentInstance;
    host.source.set(source);
    await settleAsync();
  }

  async function renderFeedAsync(source: VirtualListSource<string> = numbered(1000), position: VirtualListPosition | null = null): Promise<void> {
    const created = TestBed.createComponent(FeedHostComponent);
    fixture = created;
    feed = created.componentInstance;
    feed.source.set(source);
    feed.position.set(position);
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
  const offsetOfArticle = (label: string): number => article(label).getBoundingClientRect().top - viewport().getBoundingClientRect().top;
  const status = (): HTMLElement => element().querySelector(".tr-virtual-list-status") as HTMLElement;
  const failure = (): HTMLElement | null => element().querySelector(".tr-virtual-list-failure");
  const stops = (): string[] => options().filter(t => t.tabIndex === 0).map(t => t.getAttribute("aria-posinset") ?? String.empty);
  const articles = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("[role=article]")];
  const article = (label: string): HTMLElement => {
    const found = articles().find(t => t.querySelector(".label")?.textContent === label);
    if (Object.isUndefined(found))
      throw new Error(`No article labelled ${label}.`);
    return found;
  };
  const articleStops = (): string[] => articles().filter(t => t.tabIndex === 0).map(t => t.getAttribute("aria-posinset") ?? String.empty);
  const jump = (): HTMLElement => element().querySelector(".tr-virtual-list-jump") as HTMLElement;
  const isJumpShown = (): boolean => jump().classList.contains("tr-virtual-list-jump-shown");
  const fromEnd = (): number => viewport().scrollHeight - viewport().clientHeight - viewport().scrollTop;
  const focusedClass = (): string | undefined => document.activeElement?.className;

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
    await renderAsync(new ArrayVirtualListSource([`${"long ".repeat(40)}item`, ...Array.from({ length: 999 }, (_, t) => `item ${t + 1}`)], t => t, 100));
    const slots = options().map(t => t.parentElement as HTMLElement);
    const tall = slots[0] as HTMLElement;
    const rendered = slots.reduce((sum, t) => sum + t.getBoundingClientRect().height, 0);

    expect(tall.getBoundingClientRect().height).toBeGreaterThan(100);
    expect(Number(tall.querySelector(".label")?.getAttribute("data-height"))).toBeCloseTo(tall.getBoundingClientRect().height);
    expect(slots.length).toBeLessThan(1000);
    expect(Math.abs(viewport().scrollHeight - rendered - (1000 - slots.length) * 100)).toBeLessThan(1);
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
    expect([host.activations, host.chosen]).toEqual([[0, 1], ["item 0", "item 1"]]);
  });

  it("takes keys pressed before it renders from the row they moved to, and from the focused row once its source changes", async () => {
    await renderAsync();
    host.list().focus();
    await settleAsync();

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await settleAsync();
    const quick = [focusedPlace(), [...host.activations]];
    host.source.set(new VirtualListSourceFixture(200, 30));
    await settleAsync();
    host.list().focus();
    await settleAsync();
    host.source.set(new VirtualListSourceFixture(200, 30));
    await settleAsync();
    await pressAsync("{ArrowDown}");

    expect([quick, focusedPlace()]).toEqual([["3", [2]], "2"]);
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
    host.selected.set(3);
    await settleAsync();
    const selected = [stops(), option("item 3").getAttribute("aria-selected"), option("item 3").classList.contains("tr-virtual-list-option-selected")];
    await userEvent.click(option("item 5"));
    await settleAsync();
    const clicked = stops();
    (element().querySelector(".outside") as HTMLElement).focus();
    await userEvent.tab({ shift: true });

    expect([first, selected, clicked, focused(), host.activations]).toEqual([["1"], [["4"], "true", true], ["6"], "item 5", [5]]);
  });

  it("counts a selected position outside the list as no selection", async () => {
    await renderAsync(numbered(5));
    host.selected.set(-1);
    await settleAsync();
    const before = stops();
    host.selected.set(5);
    await settleAsync();

    expect([before, stops()]).toEqual([["1"], ["1"]]);
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

    expect([belowTop, below.classList.contains("tr-virtual-list-slot-outside"), below.textContent, above.style.top, above.textContent, document.activeElement === above.firstElementChild])
      .toEqual(["0px", true, "item 0", "29970px", "item 999", true]);
  });

  it("keeps the heights it measured while it is hidden, so a row comes back at its place", async () => {
    await renderAsync(new ArrayVirtualListSource([`${"long ".repeat(40)}item`, ...Array.from({ length: 999 }, (_, t) => `item ${t + 1}`)], t => t, 100));
    await scrollAsync(200);
    const before = offsetOf("item 5");
    const list = element().querySelector("tr-virtual-list") as HTMLElement;

    list.style.display = "none";
    await settleAsync();
    list.style.display = String.empty;
    await settleAsync();

    expect(Math.round(offsetOf("item 5") - before)).toBe(0);
  });

  it("keeps the focus on a row not yet loaded when rows are inserted before it", async () => {
    const source = new VirtualListSourceFixture(200, 30);
    await renderAsync(source);
    await source.readAt(0).answerAsync();
    await settleAsync();
    option("item 0").focus();
    await pressAsync("{End}");

    source.reportInserted(0, 3);
    await settleAsync();

    expect([focusedPlace(), document.activeElement?.getAttribute("aria-hidden"), (document.activeElement as HTMLElement).tabIndex]).toEqual(["203", null, 0]);
  });

  it("reveals a row at the start, the middle or the end of its view, or the row at an end for a place beyond it, without moving the focus", async () => {
    await renderAsync();
    const tops: number[] = [];

    for (const [index, align] of [[500, VirtualListAlign.Start], [500, VirtualListAlign.Center], [500, VirtualListAlign.End], [5000, VirtualListAlign.End], [-3, VirtualListAlign.Start]] as const) {
      host.list().reveal(index, align);
      await settleAsync();
      tops.push(viewport().scrollTop);
    }
    host.source.set(numbered(0));
    await settleAsync();
    host.list().reveal(3, VirtualListAlign.Start);
    await settleAsync();

    expect([tops, viewport().scrollTop, focusedPlace()]).toEqual([[15_000, 14_865, 14_730, 29_700, 0], 0, null]);
  });

  it("keeps a waiting correction when a scroll event that moved nothing arrives before the next frame", async () => {
    const source = numbered(1000);
    await renderAsync(source);
    await scrollAsync(3000);

    source.insert(0, ["new 0", "new 1", "new 2"]);
    viewport().dispatchEvent(new Event("scroll"));
    await settleAsync();

    expect([Math.round(offsetOf("item 100")), viewport().scrollTop]).toEqual([0, 3090]);
  });

  it("keeps a row at the height it had while its images load and decode, and lets it take its own height after", async () => {
    const source = new ArrayVirtualListSource(["item 0", "long 1", "item 2"], t => t, 26);
    await renderFeedAsync(source, new VirtualListPosition(0, null, 0));
    let finish = (): void => undefined;
    const decoded = new Promise<void>(t => {
      finish = t;
    });
    const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(false);
    const decode = vi.spyOn(HTMLImageElement.prototype, "decode").mockReturnValue(decoded);
    const heightOf = (label: string): number => Math.round((article(label).parentElement as HTMLElement).getBoundingClientRect().height);

    source.replace(1, ["picture 1"]);
    await settleAsync();
    const decoding = [heightOf("picture 1"), Math.round(offsetOfArticle("item 2")), decode.mock.calls.length];
    complete.mockReturnValue(true);
    finish();
    await settleAsync();
    complete.mockRestore();
    decode.mockRestore();

    expect([decoding, heightOf("picture 1"), Math.round(offsetOfArticle("item 2"))]).toEqual([[200, 226, 1], 26, 52]);
  });

  it("follows a scroll made while a correction waits for the next frame", async () => {
    const source = numbered(1000);
    await renderAsync(source);
    await scrollAsync(3000);

    source.insert(0, ["new 0", "new 1", "new 2"]);
    viewport().scrollTop = 3100;
    viewport().dispatchEvent(new Event("scroll"));
    await settleAsync();

    expect([Math.round(offsetOf("item 100")), viewport().scrollTop]).toEqual([-100, 3190]);
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
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), "announce");

    await source.readAt(0).answerAsync();
    await settleAsync();

    expect([loading, blank]).toEqual([["Loading…", "true", false], [null, 0, "true", false, "30px"]]);
    expect([status().textContent?.trim(), listbox().getAttribute("aria-busy"), options()[1]?.getAttribute("aria-hidden"), options()[1]?.tabIndex]).toEqual([String.empty, "false", null, -1]);
    expect(announce).not.toHaveBeenCalled();
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
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), "announce");

    await source.readAt(0).refuseAsync(refusal);
    await settleAsync();
    const announced = [...announce.mock.calls];
    const shown = [failure()?.querySelector("tr-field-message")?.textContent, failure()?.querySelector("button")?.textContent, status().textContent?.trim(), listbox().getAttribute("aria-busy")];
    const edge = failure()?.classList.contains("tr-virtual-list-edge-end");
    await userEvent.click(failure()?.querySelector("button") as HTMLElement);
    await fixture.whenStable();
    const retried = [failure(), status().textContent?.trim()];
    await source.readAt(source.reads.length - 1).answerAsync();
    await settleAsync();

    expect([shown, edge, host.errors, retried, failure(), option("item 0").textContent])
      .toEqual([["These items couldn't load.", "Retry", String.empty, "false"], false, [refusal], [null, "Loading…"], null, "item 0"]);
    expect(announced).toEqual([["These items couldn't load.", "assertive"]]);
  });

  it("lets the focus leave a row that waits for its items for Retry once its read fails, announcing the wait and then the failure", async () => {
    const source = new VirtualListSourceFixture(200, 30);
    await renderAsync(source);
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), "announce");
    host.list().focus();
    await settleAsync();

    await source.readAt(0).refuseAsync(new Error("The store went away."));
    await settleAsync();
    await userEvent.tab();
    await settleAsync();
    const onRetry = document.activeElement?.textContent;
    const reads = source.reads.length;
    await pressAsync("{Enter}");

    expect([onRetry, source.reads.length, announce.mock.calls]).toEqual(["Retry", reads + 1, [["Loading…", "polite"], ["These items couldn't load.", "assertive"]]]);
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
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), "announce");

    await pressAsync("{End}");
    const waiting = [focusedPlace(), document.activeElement?.getAttribute("aria-hidden"), host.activations.length, [...announce.mock.calls]];
    await pressAsync("{Enter}");
    for (const read of source.reads.filter(t => !t.abort.aborted && t.start >= 150))
      await read.answerAsync();
    await settleAsync();

    expect([waiting, host.activations, focused(), focusedPlace()]).toEqual([["200", null, 0, [["Loading…", "polite"]]], [], "item 199", "200"]);
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

  it("is a named feed of articles, each labelled and described by elements its template names, that opens at its end with its last article as the Tab stop", async () => {
    await renderFeedAsync();
    const last = article("item 999");

    expect([listbox(), element().querySelector("[role=feed]")?.getAttribute("aria-label"), options().length]).toEqual([null, "Messages", 0]);
    expect([document.getElementById(last.getAttribute("aria-labelledby") ?? String.empty)?.textContent, document.getElementById(last.getAttribute("aria-describedby") ?? String.empty)?.textContent]).toEqual(["item 999", "sent"]);
    expect([last.getAttribute("aria-posinset"), last.getAttribute("aria-setsize"), last.hasAttribute("aria-selected"), Math.round(fromEnd()), articleStops(), isJumpShown()]).toEqual(["1000", "1000", false, 0, ["1000"], false]);
  });

  it("follows its end while rows are added or grow, keeping the distance it was scrolled to within the last 120px", async () => {
    const source = numbered(1000);
    await renderFeedAsync(source);

    await scrollAsync(viewport().scrollTop - 50);
    source.insert(1000, ["new 0", "new 1", "new 2"]);
    await settleAsync();
    const added = fromEnd();
    source.replace(1002, [`${"long ".repeat(60)}new`]);
    await settleAsync();

    expect([Math.round(added), Math.round(fromEnd()), isJumpShown(), article("item 999").getAttribute("aria-setsize")]).toEqual([50, 50, false, "1003"]);
  });

  it("stops following a step towards the start beyond the last 120px, showing Jump to latest, and follows again within 120px of the end", async () => {
    const source = numbered(1000);
    await renderFeedAsync(source);

    await scrollAsync(viewport().scrollTop - 300);
    const reading = viewport().scrollTop;
    source.insert(1000, ["new 0", "new 1"]);
    await settleAsync();
    const stopped = [Math.round(viewport().scrollTop) === Math.round(reading), isJumpShown()];
    await scrollAsync(viewport().scrollHeight - viewport().clientHeight - 100);
    source.insert(1002, ["new 2"]);
    await settleAsync();

    expect([stopped, Math.round(fromEnd()), isJumpShown()]).toEqual([[true, true], 100, false]);
  });

  it("follows again only once its newest rows have loaded", async () => {
    const source = new VirtualListSourceFixture(200, 30);
    await renderFeedAsync(source, new VirtualListPosition(150, null, 0));
    const opened = isJumpShown();

    await scrollAsync(viewport().scrollHeight);
    const unloaded = isJumpShown();
    for (const read of source.reads.filter(t => !t.abort.aborted && !t.isSettled))
      await read.answerAsync();
    await settleAsync();
    await scrollAsync(viewport().scrollTop - 10);

    expect([opened, unloaded, isJumpShown()]).toEqual([true, true, false]);
  });

  it("scrolls to its end, follows it and focuses the last article when Jump to latest is chosen", async () => {
    await renderFeedAsync();
    await scrollAsync(1000);

    await userEvent.click(jump());
    await settleAsync();

    expect([Math.round(fromEnd()), isJumpShown(), document.activeElement === article("item 999")]).toEqual([0, false, true]);
  });

  it("opens at a saved position, finding its row by key once rows were added before it, or by its index when the key is gone", async () => {
    const shifted = new ArrayVirtualListSource(["new 0", "new 1", "new 2", ...Array.from({ length: 1000 }, (_, t) => `item ${t}`)], t => t, 30);
    await renderFeedAsync(shifted, new VirtualListPosition(497, "item 497", 10));
    const byKey = [Math.round(offsetOfArticle("item 497")), isJumpShown(), articleStops()];

    await renderFeedAsync(numbered(1000), new VirtualListPosition(300, "gone", 0));
    const byIndex = Math.round(offsetOfArticle("item 300"));

    expect([byKey, byIndex]).toEqual([[-10, true, ["1"]], 0]);
  });

  it("emits where the person reads as they scroll, with the key of the row at the top when it has loaded", async () => {
    const source = new VirtualListSourceFixture(200, 30);
    await renderFeedAsync(source, new VirtualListPosition(0, null, 0));
    await source.readAt(0).answerAsync();
    await settleAsync();

    await scrollAsync(45);
    await scrollAsync(3000);

    const [first, second] = feed.positions;

    expect([feed.positions.length, first?.index, first?.key, Math.round(first?.distance ?? 0), (second?.index ?? 0) > 90, second?.key]).toEqual([2, 1, "item 1", 19, true, null]);
  });

  it("moves between articles with Page Up and Page Down from anywhere in one, and with the arrows, Home and End on the article itself", async () => {
    await renderFeedAsync(numbered(50));
    feed.list().focus();
    await settleAsync();
    const start = focusedPlace();

    await pressAsync("{PageUp}");
    await pressAsync("{ArrowUp}");
    const up = focusedPlace();
    await pressAsync("{ArrowDown}");
    const down = focusedPlace();
    (document.activeElement?.querySelector(".reply") as HTMLElement).focus();
    await pressAsync("{ArrowUp}{Home}{Enter}");
    const inside = [focusedClass(), focusedPlace()];
    await pressAsync("{PageUp}");
    const paged = focusedPlace();
    await pressAsync("{PageDown}{Home}");
    const home = [focusedPlace(), isJumpShown()];
    await pressAsync("{End}");

    expect([start, up, down, inside, paged, home, focusedPlace(), isJumpShown(), feed.activations]).toEqual(["50", "48", "49", ["reply", null], "48", ["1", true], "50", false, []]);
  });

  it("moves the focus before and after the feed with Ctrl+Home and Ctrl+End, past what can't take it, and leaves other keys with a modifier", async () => {
    await renderFeedAsync(numbered(50));
    feed.list().focus();
    await settleAsync();
    const press = (key: string, init: KeyboardEventInit = {}): boolean =>
      (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));

    const ignored = [press("PageUp", { altKey: true }), press("PageUp", { metaKey: true }), press("PageUp", { shiftKey: true }), press("a", { ctrlKey: true }), focusedPlace()];
    press("Home", { ctrlKey: true });
    const before = focusedClass();
    feed.list().focus();
    await settleAsync();
    press("End", { ctrlKey: true });
    const after = focusedClass();
    feed.list().focus();
    await settleAsync();
    (element().querySelector(".before") as HTMLElement).hidden = true;
    press("Home", { ctrlKey: true });

    expect([ignored, before, after, focusedPlace()]).toEqual([[true, true, true, true, "50"], "before", "outside", "50"]);
  });

  it("chooses nothing when an article is clicked", async () => {
    await renderFeedAsync(numbered(5));

    await userEvent.click(article("item 4"));

    expect(feed.activations).toEqual([]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes the tree row's geometry and colors from the ${theme.id} theme in ${mode} mode`, async () => {
        await renderAsync(numbered(5), theme, mode);
        host.selected.set(1);
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
