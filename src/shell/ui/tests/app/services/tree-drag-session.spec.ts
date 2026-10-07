/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { ThemeMode } from "../../../src/app/enums/theme-mode";
import { DragGesture } from "../../../src/app/models/drag-gesture";
import { TreeNode } from "../../../src/app/models/tree.node";
import { AppearanceFixture } from "../../fixtures/appearance.fixture";
import { MotionFixture } from "../../fixtures/motion.fixture";
import { MovableTreeHostComponent } from "../../fixtures/movable-tree-host.component";
import { TreeHarness } from "../../fixtures/tree-harness.fixture";

describe("TreeDragSession", () => {
  let fixture: ComponentFixture<MovableTreeHostComponent>;
  let host: MovableTreeHostComponent;
  let tree: TreeHarness;

  async function renderAsync(theme = AppearanceFixture.themes[0], mode = ThemeMode.Light): Promise<void> {
    AppearanceFixture.apply(theme, mode);
    fixture = TestBed.createComponent(MovableTreeHostComponent);
    host = fixture.componentInstance;
    tree = new TreeHarness(fixture);
    await fixture.whenStable();
  }

  const root = (): HTMLElement => tree.root;
  const items = (): HTMLElement[] => tree.items();
  const row = (label: string): HTMLElement => tree.row(label);
  const line = (): HTMLElement | null => tree.line;
  const ghost = (): HTMLElement | null => tree.ghost;
  const gap = (): number => tree.gap;
  const moves = (): (string | number | null)[][] => tree.moves;
  const yAt = (label: string, fraction: number): number => tree.yAt(label, fraction);
  const pointer = (type: string, target: EventTarget, y: number, button: number = 0): void => tree.pointer(type, target, y, button);
  const dragAsync = (from: string, to: string, fraction: number, release: boolean = true): Promise<void> => tree.dragAsync(from, to, fraction, release);
  const press = (target: HTMLElement, key: string, modifiers?: KeyboardEventInit): boolean => tree.press(target, key, modifiers);

  afterEach(async () => {
    if (vi.isFakeTimers())
      vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.documentElement.dir = String.empty;
    AppearanceFixture.reset();
    await MotionFixture.resetAsync();
  });

  it("drags a row by its ghost, dims the row, draws a drop line before or after the row under the pointer or outlines a branch to drop into, and moves it on release", async () => {
    await renderAsync();
    pointer("pointerdown", row("Notes"), yAt("Notes", 0.5));
    pointer("pointermove", row("Notes"), yAt("Notes", 0.5) + DragGesture.threshold - 1);
    await fixture.whenStable();
    const beforeThreshold = [ghost(), row("Notes").classList.contains("tr-tree-row-dragging")];

    await dragAsync("Notes", "Trash", 0.9, false);
    const after = [ghost()?.querySelector(".tr-tree-label")?.textContent, line() !== null, row("Notes").classList.contains("tr-tree-row-dragging")];
    pointer("pointermove", row("Readme"), yAt("Readme", 0.5));
    await fixture.whenStable();
    const into = [line(), row("Readme").classList.contains("tr-tree-row-drop")];
    pointer("pointermove", row("Source"), yAt("Source", 0.5));
    await fixture.whenStable();
    const intoBranch = [line(), row("Source").classList.contains("tr-tree-row-drop")];
    pointer("pointermove", row("Readme"), yAt("Readme", 0.1));
    await fixture.whenStable();
    pointer("pointerup", row("Readme"), yAt("Readme", 0.1));
    await fixture.whenStable();

    expect(beforeThreshold).toEqual([null, false]);
    expect(after).toEqual(["Notes", true, true]);
    expect([into[0] !== null, into[1]]).toEqual([true, false]);
    expect([intoBranch[0], intoBranch[1]]).toEqual([null, true]);
    expect([moves(), ghost(), line(), row("Notes").classList.contains("tr-tree-row-dragging")]).toEqual([[["notes", "project", 1]], null, null, false]);
  });

  it("shows no line or outline where a row would land on itself or its own descendants, and drops nothing there", async () => {
    await renderAsync();

    await dragAsync("Project", "Source", 0.5, false);
    const insideBranch = [line(), row("Source").classList.contains("tr-tree-row-drop")];
    pointer("pointermove", row("Readme"), yAt("Readme", 0.9));
    pointer("pointermove", row("Project"), yAt("Project", 0.5));
    await fixture.whenStable();
    const onItself = [line(), row("Project").classList.contains("tr-tree-row-drop")];
    pointer("pointerup", row("Project"), yAt("Project", 0.5));
    await fixture.whenStable();
    await dragAsync("Notes", "Notes", 0.9);

    expect([insideBranch, onItself, moves()]).toEqual([[null, false], [null, false], []]);
  });

  it("ends a drag with Escape, a lost window focus, a cancelled pointer, a lost capture, a move with no button pressed or a release outside the rows, and leaves other keys and other buttons alone", async () => {
    await renderAsync();
    const escape = (): boolean => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    const shown = async (): Promise<(HTMLElement | null)[]> => {
      await fixture.whenStable();
      return [ghost(), line()];
    };

    await dragAsync("Notes", "Trash", 0.9, false);
    const other = document.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }));
    const stillDragging = ghost() !== null;
    const escaped = escape();
    const afterEscape = await shown();
    await dragAsync("Notes", "Trash", 0.9, false);
    window.dispatchEvent(new Event("blur"));
    const afterBlur = await shown();
    await dragAsync("Notes", "Trash", 0.9, false);
    document.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1, bubbles: true }));
    const afterCancel = await shown();
    await dragAsync("Notes", "Trash", 0.9, false);
    document.documentElement.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 1 }));
    const afterLostCapture = await shown();
    await dragAsync("Notes", "Trash", 0.9, false);
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, buttons: 0, bubbles: true }));
    const afterUnpressedMove = await shown();
    await dragAsync("Notes", "Trash", 0.9, false);
    pointer("pointermove", document.body, -50);
    const outside = await shown();
    pointer("pointerup", document.body, -50);
    const afterRelease = await shown();
    const idleEscape = escape();
    pointer("pointerdown", row("Notes"), yAt("Notes", 0.5), 2);
    pointer("pointermove", row("Trash"), yAt("Trash", 0.9));

    expect([other, stillDragging, escaped, afterEscape, afterBlur, afterCancel, afterLostCapture, afterUnpressedMove, outside[1], afterRelease, idleEscape, ghost(), moves()])
      .toEqual([true, true, false, [null, null], [null, null], [null, null], [null, null], [null, null], null, [null, null], true, null, []]);
  });

  it("ends a drag when the tree goes away, so the keys and the pointer are the page's again", async () => {
    await renderAsync();
    await dragAsync("Notes", "Trash", 0.9, false);

    fixture.destroy();
    const escape = document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    expect(escape).toBe(true);
  });

  it("moves nothing while the tree is not movable", async () => {
    await renderAsync();
    host.movable.set(false);
    await fixture.whenStable();

    await dragAsync("Notes", "Trash", 0.9);
    const pressed = press(row("Notes"), "ArrowUp");
    await userEvent.click(row("Notes"));

    expect([ghost(), line(), moves(), pressed, host.activations, root().querySelector(".tr-tree-movable")]).toEqual([null, null, [], false, ["notes"], null]);
  });

  it("chooses a row clicked without dragging, and swallows the click that ends a drag on the same row", async () => {
    await renderAsync();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await userEvent.click(row("Notes"));
    await dragAsync("Notes", "Notes", 0.5);
    row("Notes").click();
    vi.advanceTimersByTime(1);
    row("Notes").click();

    expect(host.activations).toEqual(["notes", "notes"]);
  });

  it("leaves no click swallowed when the tree goes away right after a drag ended on a fake clock that never advanced", async () => {
    await renderAsync();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const outside = document.createElement("button");
    const clicks: number[] = [];
    outside.addEventListener("click", () => clicks.push(1));
    document.body.append(outside);

    await dragAsync("Notes", "Notes", 0.5);
    fixture.destroy();
    outside.click();
    outside.remove();

    expect(clicks).toEqual([1]);
  });

  it("opens a closed branch the pointer rests on after half a second, and not when the pointer moves on first", async () => {
    await renderAsync();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    await dragAsync("Notes", "Source", 0.5, false);
    vi.advanceTimersByTime(499);
    const early = row("Source").getAttribute("aria-expanded");
    pointer("pointermove", row("Source"), yAt("Source", 0.95));
    vi.advanceTimersByTime(1);
    await fixture.whenStable();
    const opened = row("Source").getAttribute("aria-expanded");
    const landing = tree.shownLine().getBoundingClientRect();
    pointer("pointerup", row("Source"), yAt("Source", 0.95));
    await fixture.whenStable();
    vi.advanceTimersByTime(1);
    const dropped = moves();
    await userEvent.click(row("Source"));
    await fixture.whenStable();
    await dragAsync("Notes", "Source", 0.5, false);
    pointer("pointermove", row("Trash"), yAt("Trash", 0.9));
    vi.advanceTimersByTime(600);
    await fixture.whenStable();

    expect([early, opened, row("Source").getAttribute("aria-expanded")]).toEqual(["false", "true", "false"]);
    expect(dropped).toEqual([["notes", "source", 0]]);
    expect(landing.top + landing.height / 2).toBeCloseTo(row("Source").getBoundingClientRect().bottom + gap() / 2, 0);
  });

  it("does nothing when the drag ended before the branch the pointer rested on had opened", async () => {
    await renderAsync();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    await dragAsync("Notes", "Source", 0.5, false);
    vi.advanceTimersByTime(500);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect([row("Source").getAttribute("aria-expanded"), line(), ghost(), moves()]).toEqual(["true", null, null, []]);
  });

  it("scrolls the tree's scrolling area while the pointer is near its top or bottom edge, and stops when it leaves the edge or the drag ends", async () => {
    await renderAsync();
    host.nodes.set(Array.from({ length: 20 }, (_, index) => new TreeNode(`row${index}`, `Row ${index}`)));
    host.height.set("6rem");
    await fixture.whenStable();
    const frame = root().querySelector(".frame") as HTMLElement;
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    const edge = frame.getBoundingClientRect().bottom - 1;
    const rowUnder = (y: number): HTMLElement => items().find(t => t.getBoundingClientRect().top <= y && t.getBoundingClientRect().bottom >= y) as HTMLElement;

    pointer("pointerdown", row("Row 0"), yAt("Row 0", 0.5));
    pointer("pointermove", row("Row 0"), yAt("Row 0", 0.5) + DragGesture.threshold + 1);
    pointer("pointermove", rowUnder(edge), edge);
    vi.advanceTimersByTime(64);
    const down = frame.scrollTop;
    pointer("pointermove", rowUnder(edge), edge - 1);
    vi.advanceTimersByTime(64);
    const sameEdge = frame.scrollTop;
    const middle = frame.getBoundingClientRect().top + frame.getBoundingClientRect().height / 2;
    pointer("pointermove", rowUnder(middle), middle);
    vi.advanceTimersByTime(64);
    const stopped = frame.scrollTop;
    const top = frame.getBoundingClientRect().top + 1;
    pointer("pointermove", rowUnder(top), top);
    vi.advanceTimersByTime(64);
    const up = frame.scrollTop;
    pointer("pointerup", rowUnder(top), top);
    vi.advanceTimersByTime(64);

    expect([down > 0, sameEdge > down, stopped === sameEdge, up < stopped, frame.scrollTop === up]).toEqual([true, true, true, true, true]);
  });

  it("moves the dragged row where it is released and keeps its focus, opening a closed branch the row went into", async () => {
    await renderAsync();
    host.applying.set(true);

    await dragAsync("Notes", "Source", 0.5);

    expect(moves()).toEqual([["notes", "source", 1]]);
    expect([row("Source").getAttribute("aria-expanded"), document.activeElement === row("Notes")]).toEqual(["true", true]);
  });

  it("follows the pointer with its target while the area scrolls under a pointer that does not move", async () => {
    await renderAsync();
    host.nodes.set(Array.from({ length: 20 }, (_, index) => new TreeNode(`row${index}`, `Row ${index}`)));
    host.height.set("6rem");
    host.applying.set(true);
    await fixture.whenStable();
    const frame = root().querySelector(".frame") as HTMLElement;
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    const edge = frame.getBoundingClientRect().bottom - 1;
    const rowUnder = (): HTMLElement => document.elementsFromPoint(root().getBoundingClientRect().left + 24, edge).find(t => t.matches("[role=treeitem]")) as HTMLElement;

    pointer("pointerdown", row("Row 0"), yAt("Row 0", 0.5));
    pointer("pointermove", row("Row 0"), yAt("Row 0", 0.5) + DragGesture.threshold + 1);
    pointer("pointermove", rowUnder(), edge);
    vi.advanceTimersByTime(400);
    const under = Number(rowUnder().querySelector(".tr-tree-label")?.textContent?.replace("Row ", String.empty));
    const lineTop = tree.shownLine().getBoundingClientRect().top;
    pointer("pointerup", rowUnder(), edge);
    vi.advanceTimersByTime(1);

    expect(frame.scrollTop).toBeGreaterThan(0);
    expect(lineTop).toBeLessThanOrEqual(frame.getBoundingClientRect().bottom);
    expect(host.moves.map(t => t.index)).toEqual([expect.toSatisfy((index: number) => index >= under - 1 && index <= under)]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`draws the ghost, the dimmed row, the drop line and the outline from the ${theme.id} theme in ${mode} mode`, async () => {
        await renderAsync(theme, mode);
        await dragAsync("Notes", "Trash", 0.9, false);
        const dragged = ghost() as HTMLElement;
        const ghostStyle = getComputedStyle(dragged);
        const lineStyle = getComputedStyle(tree.shownLine());
        const lineLook = [lineStyle.backgroundColor, Number.parseFloat(lineStyle.height)];
        const borderWidth = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tr-border-width"));
        pointer("pointermove", row("Readme"), yAt("Readme", 0.5));
        pointer("pointermove", row("Source"), yAt("Source", 0.5));
        await fixture.whenStable();
        const outline = getComputedStyle(row("Source"));

        expect(getComputedStyle(row("Notes")).opacity).toBe("0.5");
        expect([ghostStyle.backgroundColor, ghostStyle.borderTopColor, ghostStyle.borderTopStyle, ghostStyle.position, ghostStyle.pointerEvents]).toEqual([AppearanceFixture.readColor(theme, mode, "sideBar.background"),
          AppearanceFixture.readColor(theme, mode, "surface.border"), "solid", "fixed", "none"]);
        AppearanceFixture.expectLook(ghostStyle.boxShadow, theme, "shadow-large", "box-shadow");
        AppearanceFixture.expectLook(ghostStyle.borderTopLeftRadius, theme, "radius-small", "border-top-left-radius");
        AppearanceFixture.expectLook(`${dragged.getBoundingClientRect().height}px`, theme, "tree-row-height", "height");
        expect(lineLook).toEqual([AppearanceFixture.readColor(theme, mode, "focusBorder"), 2 * borderWidth]);
        expect([outline.outlineColor, outline.outlineStyle, Number.parseFloat(outline.outlineWidth)]).toEqual([AppearanceFixture.readColor(theme, mode, "focusBorder"), "solid", borderWidth]);
      });
});
