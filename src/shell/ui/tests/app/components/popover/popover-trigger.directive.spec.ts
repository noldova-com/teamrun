/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, viewChild } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { PopoverDirective } from "../../../../src/app/components/popover/popover.directive";
import { PopoverTriggerDirective } from "../../../../src/app/components/popover/popover-trigger.directive";
import { OverlayAlignment } from "../../../../src/app/enums/overlay-alignment";
import { OverlaySide } from "../../../../src/app/models/overlay-side";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [PopoverDirective, PopoverTriggerDirective],
  template: `
    <button type="button" class="before">Before</button>
    <div class="anchor" data-tr-chrome="bottom" style="position: fixed; right: 4rem; bottom: 0.25rem">
      <button type="button" class="trigger" [trPopoverTrigger]="popover" [trPopoverSide]="side" [trPopoverAlignment]="alignment" (opened)="opens = opens + 1">Open</button>
    </div>
    <ng-template #popover>
      <div trPopover label="Details">
        <h2 class="title">Details</h2>
        <button type="button" class="inside">Inside</button>
      </div>
    </ng-template>
  `
})
class PopoverHostComponent {
  public readonly trigger: Signal<PopoverTriggerDirective | undefined> = viewChild(PopoverTriggerDirective);
  public side: OverlaySide = OverlaySide.above;
  public alignment: OverlayAlignment = OverlayAlignment.End;
  public opens: number = 0;
}

describe("PopoverTriggerDirective", () => {
  let fixture: ComponentFixture<PopoverHostComponent>;

  async function renderAsync(side: OverlaySide = OverlaySide.above, alignment: OverlayAlignment = OverlayAlignment.End): Promise<void> {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(PopoverHostComponent);
    fixture.componentInstance.side = side;
    fixture.componentInstance.alignment = alignment;
    await fixture.whenStable();
  }

  const trigger = (): HTMLButtonElement => fixture.nativeElement.querySelector(".trigger");
  const surface = (): HTMLElement | null => document.querySelector(".cdk-overlay-container .tr-popover");

  async function openAsync(): Promise<HTMLElement> {
    trigger().click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(surface()).not.toBeNull());
    return surface() as HTMLElement;
  }

  async function press(target: Element): Promise<void> {
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await fixture.whenStable();
  }

  afterEach(async () => {
    await userEvent.keyboard("{Escape}");
    AppearanceFixture.reset();
  });

  it("offers its popover as a dialog it has not opened yet", async () => {
    await renderAsync();

    expect([trigger().getAttribute("aria-haspopup"), trigger().getAttribute("aria-expanded"), surface()]).toEqual(["dialog", "false", null]);
  });

  it("opens a named dialog on click, reports it expanded, says it opened and moves focus into it", async () => {
    await renderAsync();

    const popover = await openAsync();
    await vi.waitFor(() => expect(document.activeElement).toBe(popover));

    expect([popover.getAttribute("role"), popover.getAttribute("aria-label"), popover.tabIndex]).toEqual(["dialog", "Details", -1]);
    expect([trigger().getAttribute("aria-expanded"), fixture.componentInstance.opens, fixture.componentInstance.trigger()?.isOpen()]).toEqual(["true", 1, true]);
  });

  it("closes on a click on the trigger again and on a click outside, but not on a click inside", async () => {
    await renderAsync();
    const outside = document.body.appendChild(document.createElement("div"));
    const popover = await openAsync();

    await press(popover.querySelector(".inside") as Element);
    const isOpenAfterInside = surface() !== null;
    await press(outside);
    const isClosedByOutside = surface() === null;
    await openAsync();
    await press(trigger());
    outside.remove();

    expect([isOpenAfterInside, isClosedByOutside, surface(), trigger().getAttribute("aria-expanded")]).toEqual([true, true, null, "false"]);
  });

  it("leaves focus alone when it closes before its first render", async () => {
    await renderAsync();
    trigger().focus();

    trigger().click();
    trigger().click();
    await fixture.whenStable();

    expect([surface(), document.activeElement, fixture.componentInstance.opens]).toEqual([null, trigger(), 1]);
  });

  it("closes on Escape and returns focus to the trigger, but not on other keys", async () => {
    await renderAsync();
    const popover = await openAsync();
    await vi.waitFor(() => expect(document.activeElement).toBe(popover));

    popover.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    await fixture.whenStable();
    const isOpenAfterTab = surface() !== null;
    popover.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await fixture.whenStable();

    expect([isOpenAfterTab, surface(), document.activeElement]).toEqual([true, null, trigger()]);
  });

  it("keeps an Escape that something inside it already handled, and returns focus to the trigger when it is closed from inside", async () => {
    await renderAsync();
    const popover = await openAsync();
    await vi.waitFor(() => expect(document.activeElement).toBe(popover));

    const handled = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    handled.preventDefault();
    (popover.querySelector(".inside") as HTMLElement).dispatchEvent(handled);
    await fixture.whenStable();
    const isOpenAfterHandled = surface() !== null;
    fixture.componentInstance.trigger()?.close();

    expect([isOpenAfterHandled, surface(), document.activeElement]).toEqual([true, null, trigger()]);
  });

  it("closes when something around the trigger scrolls", async () => {
    await renderAsync();
    await openAsync();

    (fixture.nativeElement.querySelector(".anchor") as HTMLElement).style.bottom = "3rem";
    (fixture.nativeElement as HTMLElement).dispatchEvent(new Event("scroll"));
    await fixture.whenStable();

    expect(surface()).toBeNull();
  });

  it("closes through its close method, and again harmlessly, and when its trigger is destroyed", async () => {
    await renderAsync();
    await openAsync();
    const directive = fixture.componentInstance.trigger();

    directive?.close();
    directive?.close();
    const isClosed = surface() === null;
    await openAsync();
    fixture.destroy();

    expect([isClosed, surface(), directive?.isOpen()]).toEqual([true, null, false]);
  });

  it("places its popover above the trigger, a gap away and end-aligned, and below it on the other side", async () => {
    await renderAsync();
    const popover = await openAsync();
    const gap = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.5;

    await vi.waitFor(() => expect(trigger().getBoundingClientRect().top - popover.getBoundingClientRect().bottom).toBeCloseTo(gap, 1));
    expect(popover.getBoundingClientRect().right).toBeCloseTo(trigger().getBoundingClientRect().right, 1);
    fixture.destroy();

    await renderAsync(OverlaySide.below, OverlayAlignment.Start);
    const anchor = fixture.nativeElement.querySelector(".anchor") as HTMLElement;
    anchor.style.cssText = "position: fixed; left: 4rem; top: 0.25rem";
    anchor.setAttribute("data-tr-chrome", "top");
    const below = await openAsync();

    await vi.waitFor(() => expect(below.getBoundingClientRect().top - trigger().getBoundingClientRect().bottom).toBeCloseTo(gap, 1));
    expect(below.getBoundingClientRect().left).toBeCloseTo(trigger().getBoundingClientRect().left, 1);
  });

  it("keeps a popover with a tall content inside the window and lets it scroll", async () => {
    await renderAsync();
    const popover = await openAsync();
    popover.append(Object.assign(document.createElement("div"), { style: "height: 200vh; flex: none" }));

    await vi.waitFor(() => expect(popover.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight));

    expect([popover.getBoundingClientRect().top >= 0, getComputedStyle(popover).overflowY, popover.scrollHeight > popover.clientHeight]).toEqual([true, "auto", true]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its surface and geometry from the ${theme.id} theme in ${mode} mode`, async () => {
        await renderAsync();
        AppearanceFixture.apply(theme, mode);
        const style = getComputedStyle(await openAsync());

        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "menu.background"));
        expect(style.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "menu.border"));
        expect(style.boxShadow).not.toBe("none");
        AppearanceFixture.expectLook(style.width, theme, "popover-width", "width");
        AppearanceFixture.expectLook(style.borderTopLeftRadius, theme, "radius-large", "border-top-left-radius");
        AppearanceFixture.expectLook(style.paddingTop, theme, "space-3", "padding-top");
        AppearanceFixture.expectLook(style.rowGap, theme, "space-2", "row-gap");
        expect(getComputedStyle(surface()?.querySelector(".title") as Element).color).toBe(AppearanceFixture.readColor(theme, mode, "menu.foreground"));
      });
});
