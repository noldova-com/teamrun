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
import { TreeNode } from "../../../src/app/models/tree-node";
import { AppearanceFixture } from "../../fixtures/appearance.fixture";
import { MotionFixture } from "../../fixtures/motion.fixture";
import { MovableTreeHostComponent } from "../../fixtures/movable-tree-host.component";

describe("TreeDragSession", () => {
  let fixture: ComponentFixture<MovableTreeHostComponent>;
  let host: MovableTreeHostComponent;

  async function renderAsync(theme = AppearanceFixture.themes[0], mode = ThemeMode.Light): Promise<void> {
    AppearanceFixture.apply(theme, mode);
    fixture = TestBed.createComponent(MovableTreeHostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  }

  const root = (): HTMLElement => fixture.nativeElement;
  const items = (): HTMLElement[] => [...root().querySelectorAll<HTMLElement>("[role=treeitem]")];
  const row = (label: string): HTMLElement => {
    const found = items().find(t => t.querySelector(".tr-tree-label")?.textContent === label);
    if (Object.isUndefined(found))
      throw new Error(`No row labelled ${label}.`);
    return found;
  };
  const line = (): HTMLElement | null => root().querySelector(".tr-tree-drop-line");
  const ghost = (): HTMLElement | null => root().querySelector(".tr-tree-ghost");
  const moves = (): (string | number | null)[][] => host.moves.map(t => [t.id, t.parentId, t.index]);
  const gap = (): number => Number.parseFloat(getComputedStyle(root().querySelector(".tr-tree") as HTMLElement).rowGap);
  const yAt = (label: string, fraction: number): number => row(label).getBoundingClientRect().top + row(label).getBoundingClientRect().height * fraction;

  function pointer(type: string, target: EventTarget, y: number, button: number = 0): void {
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, button, clientX: root().getBoundingClientRect().left + 24, clientY: y }));
  }

  async function dragAsync(from: string, to: string, fraction: number, release: boolean = true): Promise<void> {
    pointer("pointerdown", row(from), yAt(from, 0.5));
    pointer("pointermove", row(from), yAt(from, 0.5) + DragGesture.threshold + 1);
    pointer("pointermove", row(to), yAt(to, fraction));
    await fixture.whenStable();
    if (release) {
      pointer("pointerup", row(to), yAt(to, fraction));
      await fixture.whenStable();
    }
  }

  function press(target: HTMLElement, key: string, modifiers: KeyboardEventInit = { altKey: true }): boolean {
    return target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers }));
  }

  afterEach(async () => {
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
    const lineY = (line() as HTMLElement).getBoundingClientRect();
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
    expect(lineY.top + lineY.height / 2).toBeCloseTo(row("Trash").getBoundingClientRect().bottom + gap() / 2, 0);
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

  it("ends a drag with Escape, a lost window focus, a cancelled pointer or one released outside the rows, and leaves other keys and other buttons alone", async () => {
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
    document.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true }));
    const afterCancel = await shown();
    await dragAsync("Notes", "Trash", 0.9, false);
    pointer("pointermove", document.body, -50);
    const outside = await shown();
    pointer("pointerup", document.body, -50);
    const afterRelease = await shown();
    const idleEscape = escape();
    pointer("pointerdown", row("Notes"), yAt("Notes", 0.5), 2);
    pointer("pointermove", row("Trash"), yAt("Trash", 0.9));

    expect([other, stillDragging, escaped, afterEscape, afterBlur, afterCancel, outside[1], afterRelease, idleEscape, ghost(), moves()])
      .toEqual([true, true, false, [null, null], [null, null], [null, null], null, [null, null], true, null, []]);
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
    pointer("pointerup", row("Source"), yAt("Source", 0.95));
    await fixture.whenStable();
    vi.advanceTimersByTime(1);
    await userEvent.click(row("Source"));
    await fixture.whenStable();
    await dragAsync("Notes", "Source", 0.5, false);
    pointer("pointermove", row("Trash"), yAt("Trash", 0.9));
    vi.advanceTimersByTime(600);
    await fixture.whenStable();

    expect([early, opened, row("Source").getAttribute("aria-expanded")]).toEqual(["false", "true", "false"]);
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

  it("draws the line for the bottom of an open branch above its first child, at the child's indent, and drops the row there", async () => {
    await renderAsync();
    host.applying.set(true);

    await dragAsync("Notes", "Project", 0.9, false);
    const drawn = (line() as HTMLElement).getBoundingClientRect();
    const project = row("Project").getBoundingClientRect();
    const source = row("Source").getBoundingClientRect();
    const indent = Number.parseFloat(getComputedStyle(row("Source")).paddingInlineStart);
    pointer("pointerup", row("Project"), yAt("Project", 0.9));
    await fixture.whenStable();

    expect(drawn.top + drawn.height / 2).toBeCloseTo(project.bottom + gap() / 2, 0);
    expect(drawn.left).toBeCloseTo(source.left + indent, 0);
    expect(moves()).toEqual([["notes", "project", 0]]);
    expect(items().map(t => t.querySelector(".tr-tree-label")?.textContent).slice(0, 3)).toEqual(["Project", "Notes", "Source"]);
  });

  it("keeps the target and the line while the pointer is in the gap between two rows", async () => {
    await renderAsync();
    const gapY = row("Notes").getBoundingClientRect().top - gap() / 2;

    pointer("pointerdown", row("Trash"), yAt("Trash", 0.5));
    pointer("pointermove", row("Trash"), yAt("Trash", 0.5) - DragGesture.threshold - 1);
    pointer("pointermove", row("Trash"), gapY);
    await fixture.whenStable();
    const inGap = line() !== null;
    pointer("pointerup", row("Trash"), gapY);
    await fixture.whenStable();

    expect([inGap, moves()]).toEqual([true, [["trash", "project", 2]]]);
  });

  it("moves the dragged row where it is released and keeps its focus, opening a closed branch the row went into", async () => {
    await renderAsync();
    host.applying.set(true);

    await dragAsync("Notes", "Source", 0.5);

    expect(moves()).toEqual([["notes", "source", 1]]);
    expect([row("Source").getAttribute("aria-expanded"), document.activeElement === row("Notes")]).toEqual(["true", true]);
  });

  it("puts the ghost on the pointer's other side in a right-to-left layout", async () => {
    await renderAsync();
    root().dir = "rtl";

    await dragAsync("Notes", "Trash", 0.9, false);
    const dragged = ghost() as HTMLElement;
    const pointerX = root().getBoundingClientRect().left + 24;
    const inline = (line() as HTMLElement).getBoundingClientRect();
    const trash = row("Trash").getBoundingClientRect();

    expect([dragged.style.left, dragged.style.right !== String.empty]).toEqual([String.empty, true]);
    expect(dragged.getBoundingClientRect().right).toBeLessThan(pointerX);
    expect(inline.right).toBeCloseTo(trash.right - Number.parseFloat(getComputedStyle(row("Trash")).paddingInlineStart), 0);
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
    const lineTop = (line() as HTMLElement).getBoundingClientRect().top;
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
        const lineLook = [getComputedStyle(line() as HTMLElement).backgroundColor, Number.parseFloat(getComputedStyle(line() as HTMLElement).height)];
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
