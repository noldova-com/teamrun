/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import ScrollAreaFixture from "./fixtures/scroll-area.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";

function scope(window: Page, mode: "Light" | "Dark"): Locator {
  return window.locator(`tr-gallery .tr-gallery-scope-frame[data-mode="${mode}"]`);
}

async function truncationAsync(control: Locator): Promise<{ isInside: boolean; isCut: boolean; overflow: string }> {
  return control.evaluate(t => {
    const box = t.getBoundingClientRect();
    const label = t.querySelector("[data-truncates]") as HTMLElement;
    const text = label.getBoundingClientRect();
    return {
      isInside: text.left >= box.left - 0.5 && text.right <= box.right + 0.5,
      isCut: label.scrollWidth > label.clientWidth,
      overflow: getComputedStyle(label).textOverflow
    };
  });
}

test.describe("gallery", () => {
  test("a development build shows the kit's controls on a Settings page in every theme, in light and in dark", async ({ desktop }) => {
    const window = desktop.window;

    await SettingsFixture.openGalleryAsync(window);

    await expect(window.locator("tr-gallery .tr-gallery-scope-frame")).toHaveCount(2);
    await expect(window.locator("tr-gallery .tr-gallery-scope-title")).toHaveText(["Default, light mode", "Default, dark mode"]);
    await expect(scope(window, "Light").locator("tr-gallery-forms, tr-gallery-navigation, tr-gallery-overlays")).toHaveCount(3);
    const panels = await window.locator("tr-gallery .tr-gallery-scope-frame").evaluateAll(frames => frames.map(t => getComputedStyle(t).backgroundColor));
    expect(new Set(panels).size).toBe(2);
    await desktop.checkpointAsync("gallery-light");

    await scope(window, "Dark").scrollIntoViewIfNeeded();
    await scope(window, "Dark").locator(".tr-gallery-scope-title").scrollIntoViewIfNeeded();
    await desktop.checkpointAsync("gallery-dark");
  });

  test("the Gallery opens at its top, and moving a quick input's active option scrolls only its own list", async ({ desktop }) => {
    const window = desktop.window;
    const page = window.locator(".tr-settings-content");
    const quick = scope(window, "Dark").locator("tr-quick-input");
    const list = quick.locator(".tr-quick-input-list");
    const scrollTopAsync = (area: Locator): Promise<number> => area.evaluate(t => t.scrollTop);

    await SettingsFixture.openGalleryAsync(window);
    await expect(quick.getByRole("option").first()).toBeAttached();
    await window.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await scrollTopAsync(page)).toBe(0);

    await quick.scrollIntoViewIfNeeded();
    await list.evaluate(t => t.style.setProperty("max-height", `${(t.querySelector("[role=option]") as HTMLElement).offsetHeight * 1.5}px`));
    const top = await scrollTopAsync(page);
    await quick.locator(".tr-quick-input-field").focus();
    await window.keyboard.press("End");
    await expect.poll(() => scrollTopAsync(list)).toBeGreaterThan(0);
    expect(await scrollTopAsync(page)).toBe(top);
    await window.keyboard.press("Home");
    await expect.poll(() => scrollTopAsync(list)).toBe(0);
    expect(await scrollTopAsync(page)).toBe(top);
  });

  test("each specimen with a control shows the keyboard focus on it from the keyboard, and each scope keeps its own colors", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openGalleryAsync(window);
    const dark = scope(window, "Dark");

    for (const name of ["Button", "Icon button", "Checkbox", "Text field", "Select", "Tab", "Tree", "Toolbar", "Toolbar button", "Menu"]) {
      await dark.getByRole("button", { name: `Show the keyboard focus on the ${name}`, exact: true }).focus();
      await window.keyboard.press("Enter");
      await expect(dark.locator(`.tr-gallery-specimen[aria-label="${name}"] :focus-visible`)).toHaveCount(1);
    }
    await desktop.checkpointAsync("gallery-focus");
    const colors = await window.locator("tr-gallery .tr-gallery-scope-frame").evaluateAll(frames => frames.map(t => getComputedStyle(t).color));
    expect(new Set(colors).size).toBe(2);
  });

  test("the tree is moved through, opened, closed and chosen from by keyboard alone", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openGalleryAsync(window);
    const tree = scope(window, "Light").getByRole("tree", { name: "Gallery files" });
    const item = (name: string): Locator => tree.getByRole("treeitem", { name, exact: true });
    await scope(window, "Light").getByRole("button", { name: "Show the keyboard focus on the Tree", exact: true }).focus();
    await window.keyboard.press("Enter");
    await expect(item("Notes")).toBeFocused();

    await window.keyboard.press("Home");
    await expect(item("Project")).toBeFocused();
    await expect(item("Project")).toHaveAttribute("aria-expanded", "true");
    await window.keyboard.press("ArrowRight");
    await expect(item("Source")).toBeFocused();
    await window.keyboard.press("ArrowRight");
    await window.keyboard.press("ArrowDown");
    await expect(item("App")).toBeFocused();
    await expect(item("App")).toHaveAttribute("aria-level", "3");
    await window.keyboard.press("End");
    await expect(item("A file name that is far too long to fit the width of its tree")).toBeFocused();
    await window.keyboard.press("Home");
    await window.keyboard.press("r");
    await expect(item("Readme")).toBeFocused();
    await window.keyboard.press("Enter");
    await expect(item("Readme")).toHaveAttribute("aria-selected", "true");
    await expect(item("Notes")).toHaveAttribute("aria-selected", "false");
    await desktop.checkpointAsync("gallery-tree");
    await window.keyboard.press("ArrowLeft");
    await expect(item("Project")).toBeFocused();
    await window.keyboard.press("ArrowLeft");
    await expect(item("Project")).toHaveAttribute("aria-expanded", "false");
    await expect(tree.getByRole("treeitem")).toHaveCount(3);
  });

  for (const mode of ["Light", "Dark"] as const)
    test(`a tree row is dragged with a ghost and a drop line and dropped into place, and moved by Alt and the arrow keys, in ${mode.toLowerCase()} mode`, async ({ desktop }) => {
      const window = desktop.window;
      await SettingsFixture.openGalleryAsync(window);
      const tree = scope(window, mode).getByRole("tree", { name: "Gallery files" });
      const host = scope(window, mode).locator("tr-tree.tr-gallery-tree");
      const item = (name: string): Locator => tree.getByRole("treeitem", { name, exact: true });
      const order = (): Promise<(string | null)[]> => tree.locator(".tr-tree-label").evaluateAll(t => t.map(u => u.textContent));
      const centreOf = async (name: string, fraction: number): Promise<{ x: number; y: number }> => {
        const box = await item(name).boundingBox() as { x: number; y: number; width: number; height: number };
        return { x: box.x + box.width / 2, y: box.y + box.height * fraction };
      };
      await item("Notes").scrollIntoViewIfNeeded();

      const from = await centreOf("Notes", 0.5);
      await window.mouse.move(from.x, from.y);
      await window.mouse.down();
      await window.mouse.move(from.x + 8, from.y - 8, { steps: 3 });
      const branch = await centreOf("Project", 0.5);
      await window.mouse.move(branch.x, branch.y, { steps: 6 });
      await expect(item("Project")).toHaveClass(/tr-tree-row-drop/u);
      await desktop.checkpointAsync(`gallery-tree-drag-branch-${mode.toLowerCase()}`);
      const target = await centreOf("Readme", 0.1);
      await window.mouse.move(target.x, target.y, { steps: 6 });
      await expect(host.locator(".tr-tree-ghost")).toHaveText(/Notes/u);
      await expect(host.locator(".tr-tree-drop-line")).toBeVisible();
      await desktop.checkpointAsync(`gallery-tree-drag-${mode.toLowerCase()}`);
      await window.mouse.up();

      await expect(host.locator(".tr-tree-ghost")).toHaveCount(0);
      await expect.poll(order).toEqual(["Project", "Source", "Notes", "Readme", "A file name that is far too long to fit the width of its tree"]);
      await expect(item("Readme")).toHaveAttribute("aria-selected", "false");
      await expect(item("Notes")).toBeFocused();
      await item("Notes").focus();
      await window.keyboard.press("Alt+ArrowLeft");
      await expect.poll(order).toEqual(["Project", "Source", "Readme", "Notes", "A file name that is far too long to fit the width of its tree"]);
      await expect(item("Notes")).toBeFocused();
      await window.keyboard.press("Alt+ArrowUp");
      await expect.poll(order).toEqual(["Notes", "Project", "Source", "Readme", "A file name that is far too long to fit the width of its tree"]);
      await expect(item("Notes")).toBeFocused();
    });

  test("toolbar buttons never overlap, and a label too long for its button ends with an ellipsis inside it and shows in full in its tooltip, in light and in dark", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openGalleryAsync(window);

    for (const mode of ["Light", "Dark"] as const) {
      const specimen = scope(window, mode).locator(".tr-gallery-specimen[aria-label=\"Toolbar button\"]");
      await specimen.scrollIntoViewIfNeeded();
      const overlaps = await specimen.evaluate(t => {
        const boxes = [...t.querySelectorAll(".tr-toolbar-button")].map(u => u.getBoundingClientRect());
        return boxes.flatMap((box, i) => boxes.slice(i + 1).filter(other => Math.min(box.right, other.right) - Math.max(box.left, other.left) > 0.5 &&
          Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 0.5).map(() => i));
      });
      expect(overlaps).toEqual([]);
      const long = specimen.locator(".tr-toolbar-button.tr-gallery-narrow");
      expect(await truncationAsync(long)).toEqual({ isInside: true, isCut: true, overflow: "ellipsis" });
      await long.hover();
      await expect(scope(window, mode).locator(".cdk-overlay-container tr-tooltip")).toHaveText((await long.getAttribute("aria-label")) ?? "");
      await desktop.checkpointAsync(`toolbar-button-long-label-${mode.toLowerCase()}`);
      await window.mouse.move(0, 0);
    }
  });

  test("the text field and the select write in the panel text size, and an open select's list shows its thumb while hovered, in light and in dark", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openGalleryAsync(window);

    for (const mode of ["Light", "Dark"] as const) {
      const specimen = scope(window, mode).locator(".tr-gallery-specimen[aria-label=\"Select\"]");
      await specimen.scrollIntoViewIfNeeded();
      const sizes = await scope(window, mode).evaluate(t => {
        const probe = t.appendChild(document.createElement("div"));
        probe.style.fontSize = "var(--tr-text-panel)";
        const panel = getComputedStyle(probe).fontSize;
        probe.style.fontSize = "var(--tr-text-label)";
        const label = getComputedStyle(probe).fontSize;
        probe.remove();
        const field = t.querySelector(".tr-gallery-specimen[aria-label=\"Text field\"] input") as Element;
        const select = t.querySelector(".tr-gallery-specimen[aria-label=\"Select\"] .tr-select-button") as Element;
        return { panel, label, field: getComputedStyle(field).fontSize, select: getComputedStyle(select).fontSize };
      });
      expect(sizes.panel).not.toBe(sizes.label);
      expect([sizes.field, sizes.select]).toEqual([sizes.panel, sizes.panel]);

      await specimen.locator(".tr-select-button").first().click();
      const list = scope(window, mode).locator(".cdk-overlay-container .tr-select-list");
      await expect(list).toBeVisible();
      await list.evaluate(t => t.style.setProperty("max-height", `${(t.querySelector(".tr-select-option") as HTMLElement).offsetHeight * 1.5}px`));
      expect(await list.evaluate(t => t.scrollHeight > t.clientHeight)).toBe(true);
      expect(await ScrollAreaFixture.thumbChangesOnHoverAsync(window, list, "vertical")).toBe(true);
      await desktop.checkpointAsync(`select-list-thumb-${mode.toLowerCase()}`);
      await window.keyboard.press("Escape");
      await expect(list).toHaveCount(0);
    }
  });

  test("a button's label too long for it starts at its start padding, ends with an ellipsis and shows in full in its tooltip, in light and in dark", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openGalleryAsync(window);

    for (const mode of ["Light", "Dark"] as const) {
      const button = scope(window, mode).locator(".tr-gallery-specimen[aria-label=\"Button\"] button.tr-gallery-narrow");
      await button.scrollIntoViewIfNeeded();
      const start = await button.evaluate(t => {
        const style = getComputedStyle(t);
        const label = t.querySelector("[data-truncates]") as HTMLElement;
        return Math.round(label.getBoundingClientRect().left - t.getBoundingClientRect().left - Number.parseFloat(style.borderLeftWidth) - Number.parseFloat(style.paddingLeft));
      });
      expect(start).toBe(0);
      expect(await truncationAsync(button)).toEqual({ isInside: true, isCut: true, overflow: "ellipsis" });
      await button.hover();
      await expect(scope(window, mode).locator(".cdk-overlay-container tr-tooltip")).toHaveText(await button.innerText());
      await desktop.checkpointAsync(`button-long-label-${mode.toLowerCase()}`);
      await window.mouse.move(0, 0);
    }
  });

  test("a configuration table shows its heading and Add above its explanation and separated rows, grows a row for long text and scrolls sideways only when narrow, in light and in dark", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openGalleryAsync(window);

    for (const mode of ["Light", "Dark"] as const) {
      const specimen = scope(window, mode).locator(".tr-gallery-specimen[aria-label=\"Configuration table\"]");
      const table = specimen.getByRole("table", { name: "Environment variables", exact: true });
      const narrow = specimen.getByRole("table", { name: "Narrow environment variables" });
      await specimen.scrollIntoViewIfNeeded();

      await expect(specimen.getByRole("heading", { name: "Environment variables" })).toBeVisible();
      await expect(table.getByRole("columnheader")).toHaveText(["Name", "Value", "Scope", ""]);
      await expect(table.getByRole("columnheader").last()).toHaveAttribute("aria-label", "Actions");
      await expect(table.getByRole("button", { name: "Remove NOTES_HOME" })).toBeVisible();
      const layout = await specimen.evaluate(t => {
        const [wide, small] = [...t.querySelectorAll<HTMLElement>(".tr-configuration-table-scroll")];
        const heading = (t.querySelector(".tr-configuration-table-heading") as HTMLElement).getBoundingClientRect();
        const add = (t.querySelector(".tr-configuration-table-actions button") as HTMLElement).getBoundingClientRect();
        const explanation = (t.querySelector(".tr-configuration-table-explanation") as HTMLElement).getBoundingClientRect();
        const rows = [...(wide as HTMLElement).querySelectorAll("tbody tr")].map(r => r.getBoundingClientRect().height);
        const separators = [...(wide as HTMLElement).querySelectorAll("th, td")].map(c => getComputedStyle(c).borderBottomStyle);
        const grid = ((wide as HTMLElement).querySelector("table") as HTMLElement).getBoundingClientRect();
        const first = document.createRange();
        first.selectNodeContents((wide as HTMLElement).querySelector("tbody td") as Element);
        const remove = ((wide as HTMLElement).querySelector("tbody tr td:last-child button:last-child") as HTMLElement).getBoundingClientRect();
        const baseline = (host: Element): number => {
          const probe = document.createElement("span");
          probe.style.display = "inline-block";
          host.prepend(probe);
          const bottom = probe.getBoundingClientRect().bottom;
          probe.remove();
          return bottom;
        };
        const row = (wide as HTMLElement).querySelector("tbody tr") as HTMLElement;
        const label = baseline(row.querySelector("td:last-child button [data-truncates]") as Element);
        const scope = document.createRange();
        scope.selectNodeContents(row.children[2] as Element);
        const token = document.createRange();
        token.selectNodeContents((small as HTMLElement).querySelectorAll("tbody tr")[1]?.children[1] as Element);
        return {
          edges: [Math.round(first.getBoundingClientRect().left - grid.left), Math.round(grid.right - remove.right), Math.round(heading.left - grid.left), Math.round(grid.right - add.right)],
          baselines: [...row.querySelectorAll("td:not(:last-child)")].map(c => Math.round(baseline(c) - label)),
          scopeLines: scope.getClientRects().length,
          tokenLines: token.getClientRects().length,
          isAddOnHeadingRow: add.top < heading.bottom && add.bottom > heading.top && add.left > heading.left,
          isExplanationBetween: explanation.top >= Math.max(heading.bottom, add.bottom) && (wide as HTMLElement).getBoundingClientRect().top >= explanation.bottom,
          isLongRowTaller: (rows.at(-1) ?? 0) > Math.max(...rows.slice(0, -1)),
          separators: [...new Set(separators)],
          isWideScrolling: (wide as HTMLElement).scrollWidth > (wide as HTMLElement).clientWidth,
          isNarrowScrolling: (small as HTMLElement).scrollWidth > (small as HTMLElement).clientWidth
        };
      });
      expect(layout).toEqual({ edges: [0, 0, 0, 0], baselines: [0, 0, 0], scopeLines: 1, tokenLines: 1, isAddOnHeadingRow: true, isExplanationBetween: true, isLongRowTaller: true, separators: ["solid"], isWideScrolling: false, isNarrowScrolling: true });
      await expect(narrow.getByRole("row")).toHaveCount(3);
      const area = specimen.locator(".tr-configuration-table-scroll").last();
      await area.evaluate(t => {
        t.scrollTo({ left: t.scrollWidth });
        t.scrollIntoView({ block: "end" });
      });
      await area.hover({ position: { x: 8, y: 8 } });
      await expect(narrow.getByRole("button", { name: "Remove LANG" })).toBeInViewport();
      await desktop.checkpointAsync(`configuration-table-${mode.toLowerCase()}`);
      await window.mouse.move(0, 0);
    }
  });
});
