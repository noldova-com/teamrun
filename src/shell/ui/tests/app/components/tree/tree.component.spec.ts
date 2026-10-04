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

import { TreeComponent } from "../../../../src/app/components/tree/tree.component";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { TreeNode } from "../../../../src/app/models/tree-node";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [TreeComponent],
  template: `
    <tr-tree class="nested" label="Files" [nodes]="nodes()" [current]="current()" (activated)="activations.push($event.id)" />
    <tr-tree class="flat" label="Pages" [nodes]="pages" />
  `
})
class TreeHostComponent {
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
  const row = (id: string): HTMLElement => fixture.nativeElement.querySelector(`[data-tree-node="${id}"]`);
  const labels = (name: string = "nested"): string[] => rows(name).map(t => t.querySelector(".tr-tree-label")?.textContent ?? "");
  const focused = (): string | undefined => (document.activeElement as HTMLElement | null)?.dataset["treeNode"];

  async function pressAsync(keys: string): Promise<void> {
    await userEvent.keyboard(keys);
    await fixture.whenStable();
  }

  afterEach(() => AppearanceFixture.reset());

  it("is a named tree of items with their level, place and expanded state, the current one selected, and one Tab stop", async () => {
    await renderAsync();
    const project = row("project");

    expect([tree("nested").getAttribute("aria-label"), labels()]).toEqual(["Files", ["Project", "Notes", "Trash"]]);
    expect(["aria-level", "aria-posinset", "aria-setsize", "aria-expanded"].map(t => project.getAttribute(t))).toEqual(["1", "1", "3", "false"]);
    expect([row("notes").getAttribute("aria-expanded"), row("notes").getAttribute("aria-selected"), project.getAttribute("aria-selected")]).toEqual([null, "true", "false"]);
    expect(rows().map(t => t.tabIndex)).toEqual([0, -1, -1]);
  });

  it("shows and hides a branch's children when its row or its twistie is clicked, and reports every row chosen", async () => {
    await renderAsync();

    row("project").click();
    await fixture.whenStable();
    const expanded = [labels(), row("project").getAttribute("aria-expanded"), row("source").getAttribute("aria-level")];
    row("source").querySelector<HTMLElement>(".tr-tree-twistie")?.click();
    await fixture.whenStable();
    const deeper = labels();
    row("readme").click();
    row("project").click();
    await fixture.whenStable();

    expect(expanded).toEqual([["Project", "Source", "Readme", "Notes", "Trash"], "true", "2"]);
    expect(deeper).toEqual(["Project", "Source", "App", "Readme", "Notes", "Trash"]);
    expect([labels(), fixture.componentInstance.activations]).toEqual([["Project", "Notes", "Trash"], ["project", "source", "readme", "project"]]);
  });

  it("follows the tree keyboard pattern: arrows move, Right and Left expand, enter and leave a branch, Home and End jump, typing finds a row and Enter chooses", async () => {
    await renderAsync();
    row("project").focus();

    await pressAsync("{ArrowDown}");
    const down = focused();
    await pressAsync("{ArrowUp}{ArrowRight}");
    const opened = [focused(), row("project").getAttribute("aria-expanded")];
    await pressAsync("{ArrowRight}");
    const child = focused();
    await pressAsync("{ArrowLeft}");
    const parent = focused();
    await pressAsync("{ArrowLeft}");
    const closed = [focused(), row("project").getAttribute("aria-expanded")];
    await pressAsync("{End}");
    const end = focused();
    await pressAsync("{Home}");
    const home = focused();
    await pressAsync("n");
    await vi.waitFor(() => expect(focused()).toBe("notes"));
    await pressAsync("{Enter}");

    expect([down, opened, child, parent, closed, end, home]).toEqual(["notes", ["project", "true"], "source", "project", ["project", "false"], "trash", "project"]);
    expect([fixture.componentInstance.activations, rows().map(t => t.tabIndex)]).toEqual([["notes"], [-1, 0, -1]]);
  });

  it("opens and closes a branch with Enter, and follows a change of the current row", async () => {
    await renderAsync();
    row("project").focus();

    await pressAsync("{Enter}");
    const opened = labels().length;
    await pressAsync("{Enter}");
    fixture.componentInstance.current.set("trash");
    await fixture.whenStable();

    expect([opened, labels().length, fixture.componentInstance.activations]).toEqual([5, 3, ["project", "project"]]);
    expect([row("trash").classList.contains("tr-tree-row-current"), row("notes").getAttribute("aria-selected")]).toEqual([true, "false"]);
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
        row("project").click();
        await fixture.whenStable();
        const project = getComputedStyle(row("project"));
        const source = getComputedStyle(row("source"));
        const icon = row("project").querySelector(".tr-tree-icon") as HTMLElement;
        await userEvent.hover(row("trash"));

        AppearanceFixture.expectLook(`${row("notes").getBoundingClientRect().height}px`, theme, "tree-row-height", "height");
        AppearanceFixture.expectLook(project.paddingLeft, theme, "space-2", "padding-left");
        AppearanceFixture.expectLook(`${Number.parseFloat(source.paddingLeft) - Number.parseFloat(project.paddingLeft)}px`, theme, "tree-indent", "width");
        AppearanceFixture.expectLook(project.columnGap, theme, "space-2", "column-gap");
        AppearanceFixture.expectLook(`${icon.getBoundingClientRect().width}px`, theme, "icon", "width");
        AppearanceFixture.expectLook(project.borderTopLeftRadius, theme, "radius-small", "border-top-left-radius");
        AppearanceFixture.expectLook(getComputedStyle(tree("nested")).rowGap, theme, "space-1", "row-gap");
        expect(getComputedStyle(icon).color).toBe(AppearanceFixture.readColor(theme, mode, "icon.foreground"));
        expect(project.color).toBe(AppearanceFixture.readColor(theme, mode, "foreground"));
        expect(getComputedStyle(row("notes")).backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "list.inactiveSelectionBackground"));
        expect(getComputedStyle(row("trash")).backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "list.hoverBackground"));
        expect(project.backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(getComputedStyle(row("project").querySelector(".tr-tree-twistie") as Element).rotate).toBe("90deg");
      });

  it("shows a focus ring on the row reached by keyboard", async () => {
    await renderAsync();
    row("project").focus();

    await pressAsync("{ArrowDown}");

    expect(getComputedStyle(row("notes")).outlineStyle).toBe("solid");
  });
});
