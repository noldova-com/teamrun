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

import { TreeComponent } from "../../../../src/app/components/tree/tree.component";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { TreeNode } from "../../../../src/app/models/tree-node";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { MotionFixture } from "../../../fixtures/motion.fixture";
import { MovableTreeHostComponent } from "../../../fixtures/movable-tree-host.component";

@Component({
  imports: [TreeComponent],
  template: `
    <tr-tree class="nested" label="Files" [nodes]="nodes()" [current]="current()" (activated)="activations.push($event.id)" />
    <tr-tree class="flat" label="Pages" [nodes]="pages" />
    <tr-tree class="opened" label="Opened" [nodes]="opened()" />
  `
})
class TreeHostComponent {
  public readonly nested = viewChild.required(TreeComponent);
  public readonly opened = signal<readonly TreeNode[]>([TreeNode.open("open", "Open", "folder", [new TreeNode("inside", "Inside", "description")]), new TreeNode("closed", "Closed")]);
  public readonly nodes = signal<readonly TreeNode[]>([
    new TreeNode("project", "Project", "folder", [
      new TreeNode("source", "Source", "folder", [new TreeNode("app", "App", "description")]),
      new TreeNode("readme", "Readme", "description")
    ]),
    new TreeNode("notes", "Notes"),
    new TreeNode("trash", "Trash", "delete")
  ]);
  public readonly current = signal<string | null>("notes");
  public readonly pages: readonly TreeNode[] = [new TreeNode("appearance", "Appearance"), new TreeNode("shortcuts", "Keyboard shortcuts")];
  public readonly activations: string[] = [];
}

describe("TreeComponent", () => {
  let fixture: ComponentFixture<TreeHostComponent>;

  async function renderAsync(theme = DefaultTheme.theme, mode = ThemeMode.Light): Promise<void> {
    AppearanceFixture.apply(theme, mode);
    fixture = TestBed.createComponent(TreeHostComponent);
    await fixture.whenStable();
  }

  const tree = (name: string): HTMLElement => fixture.nativeElement.querySelector(`tr-tree.${name} [role=tree]`);
  const rows = (name: string = "nested"): HTMLElement[] => [...tree(name).querySelectorAll<HTMLElement>("[role=treeitem]")];
  const row = (label: string): HTMLElement => {
    const found = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>("[role=treeitem]")].find(t => t.querySelector(".tr-tree-label")?.textContent === label);
    if (Object.isUndefined(found))
      throw new Error(`No row labelled ${label}.`);
    return found;
  };
  const labels = (name: string = "nested"): string[] => rows(name).map(t => t.querySelector(".tr-tree-label")?.textContent ?? "");
  const focused = (): string | undefined => document.activeElement?.querySelector(".tr-tree-label")?.textContent ?? undefined;

  async function pressAsync(keys: string): Promise<void> {
    await userEvent.keyboard(keys);
    await fixture.whenStable();
  }

  afterEach(() => AppearanceFixture.reset());

  it("is a named tree of items with their level, place and expanded state, the current one selected, and one Tab stop", async () => {
    await renderAsync();
    const project = row("Project");

    expect([tree("nested").getAttribute("aria-label"), labels()]).toEqual(["Files", ["Project", "Notes", "Trash"]]);
    expect(["aria-level", "aria-posinset", "aria-setsize", "aria-expanded"].map(t => project.getAttribute(t))).toEqual(["1", "1", "3", "false"]);
    expect([row("Notes").getAttribute("aria-expanded"), row("Notes").getAttribute("aria-selected"), project.getAttribute("aria-selected")]).toEqual([null, "true", "false"]);
    expect(rows().map(t => t.tabIndex)).toEqual([-1, 0, -1]);
  });

  it("shows and hides a branch's children when its row or its twistie is clicked, and reports every row chosen", async () => {
    await renderAsync();

    row("Project").click();
    await fixture.whenStable();
    const expanded = [labels(), row("Project").getAttribute("aria-expanded"), row("Source").getAttribute("aria-level")];
    row("Source").querySelector<HTMLElement>(".tr-tree-twistie")?.click();
    await fixture.whenStable();
    const deeper = labels();
    row("Readme").click();
    row("Project").click();
    await fixture.whenStable();

    expect(expanded).toEqual([["Project", "Source", "Readme", "Notes", "Trash"], "true", "2"]);
    expect(deeper).toEqual(["Project", "Source", "App", "Readme", "Notes", "Trash"]);
    expect([labels(), fixture.componentInstance.activations]).toEqual([["Project", "Notes", "Trash"], ["project", "source", "readme", "project"]]);
  });

  it("follows the tree keyboard pattern: arrows move, Right and Left expand, enter and leave a branch, Home and End jump, typing finds a row and Enter chooses", async () => {
    await renderAsync();
    row("Project").focus();

    await pressAsync("{ArrowDown}");
    const down = focused();
    await pressAsync("{ArrowUp}{ArrowRight}");
    const opened = [focused(), row("Project").getAttribute("aria-expanded")];
    await pressAsync("{ArrowRight}");
    const child = focused();
    await pressAsync("{ArrowLeft}");
    const parent = focused();
    await pressAsync("{ArrowLeft}");
    const closed = [focused(), row("Project").getAttribute("aria-expanded")];
    await pressAsync("{End}");
    const end = focused();
    await pressAsync("{Home}");
    const home = focused();
    await pressAsync("n");
    await vi.waitFor(() => expect(focused()).toBe("Notes"));
    await pressAsync("{Enter}");

    expect([down, opened, child, parent, closed, end, home]).toEqual(["Notes", ["Project", "true"], "Source", "Project", ["Project", "false"], "Trash", "Project"]);
    expect([fixture.componentInstance.activations, rows().map(t => t.tabIndex)]).toEqual([["notes"], [-1, 0, -1]]);
  });

  it("opens and closes a branch with Enter, and follows a change of the current row", async () => {
    await renderAsync();
    row("Project").focus();

    await pressAsync("{Enter}");
    const opened = labels().length;
    await pressAsync("{Enter}");
    fixture.componentInstance.current.set("trash");
    await fixture.whenStable();

    expect([opened, labels().length, fixture.componentInstance.activations]).toEqual([5, 3, ["project", "project"]]);
    expect([row("Trash").classList.contains("tr-tree-row-current"), row("Notes").getAttribute("aria-selected")]).toEqual([true, "false"]);
  });

  it("leaves out the twistie in a tree without branches, so its text starts at the row's inset", async () => {
    await renderAsync();
    const [first] = rows("flat");

    expect([labels("flat"), first?.querySelector(".tr-tree-twistie"), first?.querySelector(".tr-tree-icon")]).toEqual([["Appearance", "Keyboard shortcuts"], null, null]);
    AppearanceFixture.expectLook(`${(first?.querySelector(".tr-tree-label") as HTMLElement).getBoundingClientRect().left - (first as HTMLElement).getBoundingClientRect().left}px`,
      DefaultTheme.theme, "space-2", "width");
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its geometry and colors from the ${theme.id} theme in ${mode} mode`, async () => {
        await renderAsync(theme, mode);
        row("Project").click();
        await fixture.whenStable();
        const project = getComputedStyle(row("Project"));
        const source = getComputedStyle(row("Source"));
        const icon = row("Project").querySelector(".tr-tree-icon") as HTMLElement;
        await userEvent.hover(row("Trash"));

        AppearanceFixture.expectLook(`${row("Notes").getBoundingClientRect().height}px`, theme, "tree-row-height", "height");
        AppearanceFixture.expectLook(project.paddingLeft, theme, "space-2", "padding-left");
        AppearanceFixture.expectLook(`${Number.parseFloat(source.paddingLeft) - Number.parseFloat(project.paddingLeft)}px`, theme, "tree-indent", "width");
        AppearanceFixture.expectLook(project.columnGap, theme, "space-2", "column-gap");
        AppearanceFixture.expectLook(`${icon.getBoundingClientRect().width}px`, theme, "icon", "width");
        AppearanceFixture.expectLook(project.borderTopLeftRadius, theme, "radius-small", "border-top-left-radius");
        AppearanceFixture.expectLook(getComputedStyle(tree("nested")).rowGap, theme, "space-1", "row-gap");
        expect(getComputedStyle(icon).color).toBe(AppearanceFixture.readColor(theme, mode, "icon.foreground"));
        expect(project.color).toBe(AppearanceFixture.readColor(theme, mode, "foreground"));
        expect(getComputedStyle(row("Notes")).backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "list.inactiveSelectionBackground"));
        expect(getComputedStyle(row("Trash")).backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "list.hoverBackground"));
        expect(project.backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(getComputedStyle(row("Project").querySelector(".tr-tree-twistie") as Element).rotate).toBe("90deg");
      });

  it("puts the Tab stop on the current row and focus() on it, or on the first row when none is current", async () => {
    await renderAsync();
    const component = fixture.componentInstance.nested();

    component.focus();
    const current = focused();
    fixture.componentInstance.current.set(null);
    await fixture.whenStable();
    (document.activeElement as HTMLElement).blur();
    component.focus();

    expect([current, focused()]).toEqual(["Notes", "Project"]);
  });

  it("makes the row clicked or focused the only Tab stop, also when it is not the current row", async () => {
    await renderAsync();
    const stops = (): string[] => rows().filter(t => t.tabIndex === 0).map(t => t.querySelector(".tr-tree-label")?.textContent ?? "");

    await userEvent.click(row("Trash"));
    await fixture.whenStable();
    const trash = stops();
    row("Project").focus();
    await fixture.whenStable();

    expect([trash, stops()]).toEqual([["Trash"], ["Project"]]);
  });

  it("follows the current row with its Tab stop until a row has been focused, then keeps the row last focused", async () => {
    await renderAsync();
    const stops = (): number[] => rows().map(t => t.tabIndex);

    fixture.componentInstance.current.set("trash");
    await fixture.whenStable();
    const before = stops();
    row("Notes").focus();
    (document.activeElement as HTMLElement).blur();
    fixture.componentInstance.current.set("project");
    await fixture.whenStable();

    expect([before, stops()]).toEqual([[-1, -1, 0], [-1, 0, -1]]);
  });

  it("moves the Tab stop to the current row, or else the first, when the row that held it leaves the tree", async () => {
    await renderAsync();
    const stops = (): number[] => rows().map(t => t.tabIndex);
    row("Trash").focus();
    (document.activeElement as HTMLElement).blur();
    await fixture.whenStable();
    const held = stops();

    fixture.componentInstance.nodes.update(t => t.filter(u => u.id !== "trash"));
    await fixture.whenStable();
    const toCurrent = stops();
    fixture.componentInstance.current.set(null);
    await fixture.whenStable();

    expect([held, toCurrent, stops()]).toEqual([[-1, -1, 0], [-1, 0], [0, -1]]);
  });

  it("gives the current row the selected surface, whose muted text is the row's own text color", async () => {
    await renderAsync();
    const property = (name: string, custom: string): string => getComputedStyle(row(name)).getPropertyValue(custom);

    expect(property("Notes", "--tr-text-muted")).toBe(property("Notes", "--tr-text"));
    expect(property("Trash", "--tr-text-muted")).not.toBe(property("Trash", "--tr-text"));
  });

  it("opens a branch that starts open once, so a branch the person closed stays closed when the nodes change", async () => {
    await renderAsync();
    row("Open").click();
    await fixture.whenStable();
    fixture.componentInstance.opened.set([...fixture.componentInstance.opened()]);
    await fixture.whenStable();

    expect(labels("opened")).toEqual(["Open", "Closed"]);
  });

  it("opens the branches that start open and keeps the others closed", async () => {
    await renderAsync();

    expect([labels("opened"), rows("opened").map(t => t.getAttribute("aria-expanded"))]).toEqual([["Open", "Inside", "Closed"], ["true", null, null]]);
  });

  it("turns a closed twistie to face the end of the row in a right-to-left layout", async () => {
    await renderAsync();
    const twistie = row("Project").querySelector(".tr-tree-twistie") as HTMLElement;
    const before = getComputedStyle(twistie).rotate;
    fixture.nativeElement.dir = "rtl";

    expect([before, getComputedStyle(twistie).rotate]).toEqual(["none", "180deg"]);
  });

  it("shows a focus ring on the row reached by keyboard", async () => {
    await renderAsync();
    row("Project").focus();

    await pressAsync("{ArrowDown}");

    expect(getComputedStyle(row("Notes")).outlineStyle).toBe("solid");
  });
});

describe("TreeComponent moving rows with the keys", () => {
  let fixture: ComponentFixture<MovableTreeHostComponent>;
  let host: MovableTreeHostComponent;

  async function renderAsync(): Promise<void> {
    AppearanceFixture.apply(AppearanceFixture.themes[0], ThemeMode.Light);
    fixture = TestBed.createComponent(MovableTreeHostComponent);
    host = fixture.componentInstance;
    host.applying.set(true);
    await fixture.whenStable();
  }

  const row = (label: string): HTMLElement => {
    const found = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>("[role=treeitem]")].find(t => t.querySelector(".tr-tree-label")?.textContent === label);
    if (Object.isUndefined(found))
      throw new Error(`No row labelled ${label}.`);
    return found;
  };
  const moves = (): (string | number | null)[][] => host.moves.map(t => [t.id, t.parentId, t.index]);

  function press(target: HTMLElement, key: string, modifiers: KeyboardEventInit = { altKey: true }): boolean {
    return target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers }));
  }

  afterEach(async () => {
    document.documentElement.dir = String.empty;
    AppearanceFixture.reset();
    await MotionFixture.resetAsync();
  });

  it("moves the focused row with Alt and the arrow keys, keeps its focus, announces where it went and leaves the edges alone", async () => {
    await renderAsync();
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), "announce");
    row("Notes").focus();

    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await fixture.whenStable();
    const up = document.activeElement?.querySelector(".tr-tree-label")?.textContent;
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await fixture.whenStable();
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    await fixture.whenStable();

    expect(moves()).toEqual([["notes", null, 0], ["notes", null, 1], ["notes", "project", 2], ["notes", null, 1]]);
    expect(announce.mock.calls).toEqual([
      ["Moved Notes to position 1 of 3", "polite"], ["Moved Notes to position 2 of 3", "polite"], ["Moved Notes into Project, position 3 of 3", "polite"], ["Moved Notes to position 2 of 3", "polite"]
    ]);
    expect([up, document.activeElement === row("Notes")]).toEqual(["Notes", true]);
    const edge = host.moves.length;
    expect([press(row("Project"), "ArrowUp"), press(row("Trash"), "ArrowDown"), press(row("Trash"), "ArrowLeft"), press(row("Project"), "ArrowRight")]).toEqual([false, false, false, false]);
    expect([host.moves.length, announce.mock.calls.length]).toEqual([edge, 4]);
  });

  it("opens a closed branch a row steps into, so the row stays visible and keeps its focus", async () => {
    await renderAsync();
    row("Readme").focus();

    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await fixture.whenStable();

    expect(moves()).toEqual([["readme", "source", 1]]);
    expect([row("Source").getAttribute("aria-expanded"), document.activeElement === row("Readme")]).toEqual(["true", true]);
  });

  it("tells assistive technology the keys that move a row while the tree is movable, and not otherwise", async () => {
    await renderAsync();
    const shown = row("Notes").getAttribute("aria-keyshortcuts");
    host.movable.set(false);
    await fixture.whenStable();

    expect([shown, row("Notes").getAttribute("aria-keyshortcuts")]).toEqual(["Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight", null]);
  });

  it("takes only Alt and an arrow key as a move, so other chords reach the shell and the tree", async () => {
    await renderAsync();

    for (const modifiers of [{ altKey: true, ctrlKey: true }, { altKey: true, metaKey: true }, { altKey: true, shiftKey: true }, {}])
      press(row("Notes"), "ArrowUp", modifiers);
    const other = press(row("Notes"), "x", { altKey: true });

    expect([moves(), other]).toEqual([[], true]);
  });

  it("mirrors Alt with Left and Right in a right-to-left layout", async () => {
    await renderAsync();
    (fixture.nativeElement as HTMLElement).dir = "rtl";

    const left = press(row("Notes"), "ArrowLeft");
    const right = press(row("Readme"), "ArrowRight");

    expect([left, right, moves()]).toEqual([false, false, [["notes", "project", 2], ["readme", null, 1]]]);
  });

  it("slides the rows a move displaced for 150 ms", async () => {
    await renderAsync();

    press(row("Notes"), "ArrowUp");
    await fixture.whenStable();

    expect([row("Notes"), row("Project"), row("Trash")].map(t => t.getAnimations().map(a => a.effect?.getTiming().duration))).toEqual([[150], [150], []]);
  });

  it("does not slide the rows when reduced motion is preferred", async () => {
    await renderAsync();
    await MotionFixture.reduceAsync();

    press(row("Notes"), "ArrowUp");
    await fixture.whenStable();

    expect([row("Notes"), row("Project")].map(t => t.getAnimations())).toEqual([[], []]);
  });

  it("forgets a move its owner did not apply, so a later render neither moves the focus nor slides the rows", async () => {
    await renderAsync();
    host.applying.set(false);
    row("Notes").focus();

    press(row("Notes"), "ArrowUp");
    await fixture.whenStable();
    await userEvent.click(row("Source"));
    await fixture.whenStable();

    expect([document.activeElement === row("Source"), row("Notes").getAnimations().length]).toEqual([true, 0]);
  });
});
