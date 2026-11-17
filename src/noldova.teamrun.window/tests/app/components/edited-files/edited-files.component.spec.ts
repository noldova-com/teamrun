/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { DetailKind, DiffLine, DiffLineKind, FileChangeReader, FileEdit, Message, MessageAuthor, MessageDetail, MessageStatus } from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { EditedFilesComponent } from "../../../../src/app/components/edited-files/edited-files.component";
import { ReplyExpansion } from "../../../../src/app/models/reply-expansion";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("EditedFilesComponent", () => {
  const edit = (path: string, lines: DiffLine[]): FileEdit => new FileEdit(path, "update", lines);
  const render = (edits: readonly FileEdit[], rootPath: string | null = null, expansion: ReplyExpansion = new ReplyExpansion()):
    ComponentFixture<EditedFilesComponent> => {
    TestBed.configureTestingModule({ imports: [EditedFilesComponent] });
    const fixture = TestBed.createComponent(EditedFilesComponent);
    fixture.componentRef.setInput("edits", edits);
    fixture.componentRef.setInput("rootPath", rootPath);
    fixture.componentRef.setInput("expansion", expansion);
    fixture.detectChanges();
    return fixture;
  };
  const click = async (fixture: ComponentFixture<EditedFilesComponent>, button: HTMLButtonElement | null | undefined): Promise<void> => {
    button?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const buttonNamed = (element: Element | undefined, label: string): HTMLButtonElement | null | undefined =>
    element?.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const tooltipOf = async (target: Element): Promise<string | null> => {
    await userEvent.hover(target);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).not.toBeNull());
    const shown = document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim() ?? null;
    await userEvent.unhover(target);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).toBeNull());
    return shown;
  };

  it("wraps each file on its own, keeps the choice while the diff is closed, and remembers it in the reply's expansion", async () => {
    const expansion = new ReplyExpansion();
    const fixture = render([
      edit("a.ts", [new DiffLine(DiffLineKind.Added, "    const value = 'a long line';")]),
      edit("b.ts", [new DiffLine(DiffLineKind.Added, "second")])
    ], null, expansion);
    const element = fixture.nativeElement as HTMLElement;
    const rows = element.querySelectorAll("li");

    await click(fixture, rows[0]?.querySelector<HTMLButtonElement>("button.name"));
    const wrap = buttonNamed(rows[0], "Enable word wrap");
    expect(wrap?.getAttribute("aria-pressed")).toBe("false");
    await click(fixture, wrap);

    expect(rows[0]?.querySelector(".diff")?.classList.contains("wrapped")).toBe(true);
    expect(rows[0]?.querySelector(".diff > div")?.textContent).toBe("+    const value = 'a long line';");
    expect(buttonNamed(rows[1], "Enable word wrap")?.getAttribute("aria-pressed")).toBe("false");
    expect([...expansion.wrappedFiles()]).toEqual(["a.ts"]);

    await click(fixture, rows[0]?.querySelector<HTMLButtonElement>("button.name"));
    expect(rows[0]?.querySelector(".diff")).toBeNull();
    await click(fixture, buttonNamed(rows[0], "Expand diff"));
    expect(rows[0]?.querySelector(".diff")?.classList.contains("wrapped")).toBe(true);

    await click(fixture, buttonNamed(rows[0], "Disable word wrap"));
    expect(rows[0]?.querySelector(".diff")?.classList.contains("wrapped")).toBe(false);
    await click(fixture, buttonNamed(rows[0], "Collapse diff"));
    expect(rows[0]?.querySelector(".diff")).toBeNull();
    expect(element.querySelector("button button")).toBeNull();
  });

  it("shows the wrap and expand buttons' current labels as their tooltips", async () => {
    const fixture = render([edit("a.ts", [new DiffLine(DiffLineKind.Added, "x")])]);
    const row = (fixture.nativeElement as HTMLElement).querySelector("li")!;
    const [wrap, expand] = [...row.querySelectorAll<HTMLButtonElement>(".file > button[nol-icon-button]")];

    expect([wrap, expand, row.querySelector("button.name")].map(t => t?.hasAttribute("data-nol-resizes-row"))).toEqual([true, true, true]);
    expect([await tooltipOf(wrap!), await tooltipOf(expand!)]).toEqual(["Enable word wrap", "Expand diff"]);
    await click(fixture, wrap);
    await click(fixture, expand);
    expect([await tooltipOf(wrap!), await tooltipOf(expand!)]).toEqual(["Disable word wrap", "Collapse diff"]);
  });

  it("says on the expand button whether its diff is open, as the file's name does, whichever of them opens or closes it", async () => {
    const fixture = render([edit("a.ts", [new DiffLine(DiffLineKind.Added, "x")])]);
    const row = (fixture.nativeElement as HTMLElement).querySelector("li")!;
    const name = row.querySelector<HTMLButtonElement>("button.name")!;
    const expand = (): HTMLButtonElement => row.querySelectorAll<HTMLButtonElement>(".file > button[nol-icon-button]")[1]!;
    const states = (): (string | null)[] => [name.getAttribute("aria-expanded"), expand().getAttribute("aria-expanded")];

    expect(states()).toEqual(["false", "false"]);
    await click(fixture, expand());
    expect(states()).toEqual(["true", "true"]);
    await click(fixture, name);
    expect(states()).toEqual(["false", "false"]);
    await click(fixture, name);
    expect(states()).toEqual(["true", "true"]);
    await click(fixture, expand());
    expect(states()).toEqual(["false", "false"]);
  });

  it("sums the files, shows the first three until asked for the rest, and opens a diff with its lines' marks", async () => {
    const fixture = render([
      edit("D:\\repo\\src\\a.ts", [
        new DiffLine(DiffLineKind.Meta, "@@"), new DiffLine(DiffLineKind.Removed, "old"), new DiffLine(DiffLineKind.Added, "new"),
        new DiffLine(DiffLineKind.Context, "same")
      ]),
      edit("b.ts", []),
      edit("D:\\repo/c.ts", [new DiffLine(DiffLineKind.Added, "x")]),
      edit("D:\\repository\\d.ts", [new DiffLine(DiffLineKind.Added, "y")]),
      edit("e.ts", []),
      edit("f.ts", [new DiffLine(DiffLineKind.Removed, "z")])
    ], "D:\\repo");
    const element = fixture.nativeElement as HTMLElement;
    const names = (): string[] => [...element.querySelectorAll(".path")].map(t => t.textContent ?? "");

    expect(element.querySelector(".header")?.textContent).toContain("Edited 6 files");
    expect(element.querySelector(".header")?.textContent).toContain("+3");
    expect(element.querySelector(".header")?.textContent).toContain("-2");
    expect(element.querySelectorAll("li")).toHaveLength(3);
    expect(names()).toEqual(["src\\a.ts", "b.ts", "c.ts"]);
    expect(element.querySelector(".directory")?.textContent).toBe("src\\");
    const empty = element.querySelectorAll<HTMLButtonElement>("button.name")[1];
    expect(empty?.disabled).toBe(true);
    expect(empty?.hasAttribute("aria-expanded")).toBe(false);

    await click(fixture, element.querySelector<HTMLButtonElement>("button.name"));
    const diff = element.querySelector(".diff");
    expect([...diff?.children ?? []].map(t => [t.textContent, t.className])).toEqual([
      ["@@", "meta-line"], ["-old", "removed-line"], ["+new", "added-line"], [" same", ""]
    ]);

    const more = [...element.querySelectorAll<HTMLButtonElement>("button")].find(t => t.textContent?.includes("Show 3 more files"));
    expect(more?.hasAttribute("data-nol-resizes-row")).toBe(true);
    await click(fixture, more);
    expect(names()).toEqual(["src\\a.ts", "b.ts", "c.ts", "D:\\repository\\d.ts", "e.ts", "f.ts"]);
    expect(element.textContent).not.toContain("more file");
  });

  it("names a reply's added, edited and deleted files in its title and each row, counting a new file's content as its added lines", () => {
    const codex = (changes: readonly object[]): readonly FileEdit[] => new FileChangeReader().editsOf(new Message("m", "c", 0, MessageAuthor.User, null,
      MessageStatus.Completed, [new MessageDetail(0, DetailKind.FileChange, "File changes", JSON.parse(JSON.stringify({ changes })), "t")], null, "t", null, "t"));
    const shown = (edits: readonly FileEdit[]): string[] => {
      const element = render(edits).nativeElement as HTMLElement;
      const parts = (row: Element, first: string): string => [first, ".added", ".removed"].map(t => row.querySelector(t)?.textContent?.trim()).join(" ");
      const rows = [element.querySelector(".header")!, ...element.querySelectorAll("button.name")].map((t, i) => i === 0 ? parts(t, ".glyph + span")
        : `${t.querySelector(".path")?.textContent} ${parts(t, ".kind")}`);
      TestBed.resetTestingModule();
      return rows;
    };

    expect(shown(codex([{ path: "a.ts", kind: { type: "add" }, diff: "one\ntwo\nthree\n" }, { path: "b.md", kind: "{\"type\":\"add\"}", diff: "# B\n" }])))
      .toEqual(["Added 2 files +4 -0", "a.ts Added +3 -0", "b.md Added +1 -0"]);
    expect(shown(codex([{ path: "a.ts", kind: { type: "add" }, diff: "x\n" }, { path: "b.ts", kind: { type: "update", move_path: null }, diff: "@@ -1 +1 @@\n-a\n+b" },
      { path: "c.ts", kind: { type: "delete" }, diff: "gone\nalso\n" }])))
      .toEqual(["Added 1 file, edited 1 file, deleted 1 file +2 -3", "a.ts Added +1 -0", "b.ts Edited +1 -1", "c.ts Deleted +0 -2"]);
    expect(shown(codex([{ path: "a.ts", kind: "update", diff: "@@ -1 +1 @@\n-a\n+b" }, { path: "b.ts", kind: { type: "update", move_path: "c.ts" }, diff: "@@ -1 +1 @@\n+c" }])))
      .toEqual(["Edited 2 files +2 -1", "a.ts Edited +1 -1", "b.ts Edited +1 -0"]);
  });

  it("names a single file and offers each hidden file in the plural", () => {
    const one = render([edit("a.ts", [])]);
    expect((one.nativeElement as HTMLElement).querySelector(".header")?.textContent).toContain("Edited 1 file");
    TestBed.resetTestingModule();

    const many = render(Array.from({ length: 8 }, (_, index) => edit(`${index}.ts`, [])), " ");
    expect((many.nativeElement as HTMLElement).textContent).toContain("Show 5 more files");
  });

  it("shows each file's folder in the chat before its name, from a macOS or a Windows path, and its whole path on hover, with or without a diff", async () => {
    const fixture = render([
      edit("/srv/repo/lib/range.ts", [new DiffLine(DiffLineKind.Added, "x")]),
      edit("D:\\repo\\src\\Range Set.cs", []),
      edit("/srv/repo/notes.md", [])
    ], "/srv/repo");
    const paths = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(".path")];

    expect(paths.map(t => [t.querySelector(".directory")?.textContent, t.textContent])).toEqual([
      ["lib/", "lib/range.ts"], ["D:\\repo\\src\\", "D:\\repo\\src\\Range Set.cs"], ["", "notes.md"]
    ]);
    expect(await tooltipOf(paths[0]!)).toBe("/srv/repo/lib/range.ts");
    expect(await tooltipOf(paths[1]!)).toBe("D:\\repo\\src\\Range Set.cs");
  });

  it("shows a file's whole path when its name takes focus from the keyboard, beside the name, and hides it on Escape", async () => {
    const fixture = render([edit("/srv/repo/lib/range.ts", [new DiffLine(DiffLineKind.Added, "x")])], "/srv/repo");
    const name = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>("button.name")!;
    const tooltip = (): HTMLElement | null => document.querySelector<HTMLElement>(".cdk-overlay-container nol-tooltip");
    document.body.tabIndex = -1;
    document.body.focus();
    await userEvent.tab();
    await Wait.until(() => expect(tooltip()).not.toBeNull());
    const shown = tooltip()!.getBoundingClientRect();
    const anchor = name.getBoundingClientRect();

    expect(document.activeElement).toBe(name);
    expect(tooltip()!.textContent?.trim()).toBe("/srv/repo/lib/range.ts");
    expect(shown.top >= anchor.bottom || shown.bottom <= anchor.top).toBe(true);

    await userEvent.keyboard("{Escape}");
    await Wait.until(() => expect(tooltip()).toBeNull());
    document.body.removeAttribute("tabindex");
  });

  it("shows paths relative to a chat folder that ends in a separator, as at a drive's root, and a sibling folder that shares its prefix in full", () => {
    const cases: readonly (readonly [string, readonly string[], readonly (readonly [string, string])[]])[] = [
      ["D:\\", ["D:\\src\\a.ts", "D:\\notes.md"], [["src\\", "src\\a.ts"], ["", "notes.md"]]],
      ["/", ["/srv/a.ts", "/notes.md"], [["srv/", "srv/a.ts"], ["", "notes.md"]]],
      ["D:\\repo\\", ["D:\\repo\\src\\a.ts", "D:\\repository\\b.ts"], [["src\\", "src\\a.ts"], ["D:\\repository\\", "D:\\repository\\b.ts"]]],
      ["/srv/repo/", ["/srv/repo/lib/a.ts", "/srv/repository/b.ts"], [["lib/", "lib/a.ts"], ["/srv/repository/", "/srv/repository/b.ts"]]]
    ];

    for (const [root, files, shown] of cases) {
      const fixture = render(files.map(t => edit(t, [])), root);
      const paths = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(".path")];
      expect(paths.map(t => [t.querySelector(".directory")?.textContent, t.textContent]), root).toEqual(shown);
      TestBed.resetTestingModule();
    }
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const space = (step: number): number => AppearanceFixture.measureLook(`space-${step}`);
    const box = (target: Element): DOMRect => target.getBoundingClientRect();
    const middle = (rect: DOMRect): number => rect.top + rect.height / 2;

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("paints each line across the whole scroll width of an unwrapped diff, and across its width when wrapped", async () => {
      const fixture = render([edit("a.ts", [
        new DiffLine(DiffLineKind.Added, `const long = "${"x".repeat(400)}";`),
        new DiffLine(DiffLineKind.Removed, "short"),
        new DiffLine(DiffLineKind.Added, "y")
      ])]);
      const element = fixture.nativeElement as HTMLElement;
      await click(fixture, element.querySelector<HTMLButtonElement>("button.name"));
      const diff = element.querySelector<HTMLElement>(".diff")!;
      const lines = [...diff.children] as HTMLElement[];

      expect(lines).toHaveLength(3);
      expect(diff.scrollWidth).toBeGreaterThan(diff.clientWidth * 2);
      diff.scrollLeft = diff.scrollWidth;
      for (const line of lines) {
        AppearanceFixture.expectPixels(box(line).left, box(diff).left - diff.scrollLeft);
        expect(Math.abs(box(line).width - diff.scrollWidth)).toBeLessThan(1);
        if (forcedColors === "none")
          expect(getComputedStyle(line).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      }
      await click(fixture, buttonNamed(element, "Enable word wrap"));
      expect(diff.scrollWidth).toBe(diff.clientWidth);
      for (const line of lines) {
        AppearanceFixture.expectPixels(box(line).left, box(diff).left);
        expect(Math.abs(box(line).width - diff.clientWidth)).toBeLessThan(1);
      }
    });

    it("runs its header, each file's row and an open diff across its full width, a divider between each, the header and rows half a rem by a rem inside", async () => {
      const fixture = render([edit("a.ts", [new DiffLine(DiffLineKind.Added, "x")]), edit("b.ts", [new DiffLine(DiffLineKind.Removed, "y")])]);
      const element = fixture.nativeElement as HTMLElement;
      await click(fixture, element.querySelector<HTMLButtonElement>("button.name"));
      const border = AppearanceFixture.measureLook("border-width");
      const card = box(element);
      const header = element.querySelector<HTMLElement>(".header")!;
      const [files, diff] = [element.querySelector<HTMLElement>(".files")!, element.querySelector<HTMLElement>(".diff")!];
      const rows = [...element.querySelectorAll<HTMLElement>(".files > li")];
      const names = [...element.querySelectorAll<HTMLElement>("button.name")];
      const expand = buttonNamed(rows[1], "Expand diff")!;

      expect(getComputedStyle(element).borderTopWidth).not.toBe("0px");
      for (const part of [header, ...rows, ...names, diff]) {
        AppearanceFixture.expectPixels(box(part).left, card.left + border);
        expect(box(part).right).toBeLessThanOrEqual(card.right - border + 0.5);
      }
      for (const part of [header, ...rows, diff])
        AppearanceFixture.expectPixels(box(part).right, card.right - border);
      AppearanceFixture.expectPixels(box(header).top, card.top + border);
      AppearanceFixture.expectPixels(box(header.querySelector(".glyph")!).left - box(header).left, space(4));
      AppearanceFixture.expectPixels(box(header).height, Math.max(box(header.querySelector(".glyph")!).height, box(header.children[1]!).height) + space(2) * 2);
      AppearanceFixture.expectPixels(box(files).top, box(header).bottom);
      for (const name of names) {
        const path = name.querySelector<HTMLElement>(".path")!;
        AppearanceFixture.expectPixels(box(name.querySelector("nol-file-badge")!).left - box(name).left, space(4));
        AppearanceFixture.expectPixels(box(path).top - box(name).top, space(2));
        AppearanceFixture.expectPixels(box(name).bottom - box(path).bottom, space(2));
      }
      AppearanceFixture.expectPixels(card.right - border - box(expand).right, space(4));
      AppearanceFixture.expectPixels(box(rows[1]!).bottom, card.bottom - border);
      const dividers = [files, rows[1]!, diff].map(t => getComputedStyle(t));
      for (const divider of dividers) {
        expect(divider.borderTopStyle).toBe("solid");
        AppearanceFixture.expectPixels(parseFloat(divider.borderTopWidth), border);
        expect(divider.borderTopColor).toBe(getComputedStyle(element).borderTopColor);
      }
      expect([getComputedStyle(rows[0]!).borderTopWidth, getComputedStyle(rows[1]!).borderBottomWidth]).toEqual(["0px", "0px"]);
      AppearanceFixture.expectPixels(box(diff).top, box(rows[0]!.querySelector(".file")!).bottom);
      const line = diff.firstElementChild!;
      const text = document.createRange();
      text.selectNodeContents(line);
      AppearanceFixture.expectPixels(box(line).left, box(diff).left);
      AppearanceFixture.expectPixels(text.getBoundingClientRect().left - box(diff).left, space(4));
    });

    it("puts Show more files a quarter rem inside the card's border, right under the last shown file, with no divider between them", async () => {
      const fixture = render(["a.ts", "b.ts", "c.ts", "d.ts"].map(t => edit(t, [])));
      const element = fixture.nativeElement as HTMLElement;
      const border = AppearanceFixture.measureLook("border-width");
      const card = box(element);
      const files = element.querySelector<HTMLElement>(".files")!;
      const last = [...files.querySelectorAll<HTMLElement>(":scope > li")].at(-1)!;
      const more = element.querySelector<HTMLButtonElement>(".more > button")!;

      expect([files.children.length, more.textContent?.trim()]).toEqual([3, "Show 1 more file"]);
      AppearanceFixture.expectPixels(box(more).left - card.left, border + space(1));
      AppearanceFixture.expectPixels(box(more).top - box(last).bottom, space(1));
      AppearanceFixture.expectPixels(card.bottom - box(more).bottom, border + space(1));
      expect([getComputedStyle(last).borderBottomWidth, getComputedStyle(files).borderBottomWidth, getComputedStyle(more.parentElement!).borderTopWidth])
        .toEqual(["0px", "0px", "0px"]);
    });

    it("leads the title with a file icon at the files' start edge, spaces each count pair, and leads each file's muted folder with its type mark, an icon-sized box on its line", async () => {
      const fixture = render([edit("D:\\repo\\src\\IntRange.cs", [new DiffLine(DiffLineKind.Added, "x"), new DiffLine(DiffLineKind.Added, "y")])], "D:\\repo");
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const header = element.querySelector<HTMLElement>(".header")!;
      const glyph = header.querySelector<HTMLElement>(".glyph")!;
      const title = glyph.nextElementSibling!;
      const name = element.querySelector<HTMLElement>("button.name")!;
      const path = name.querySelector<HTMLElement>(".path")!;

      expect(glyph.textContent).toBe("edit_document");
      expect(glyph.getAttribute("aria-hidden")).toBe("true");
      AppearanceFixture.expectPixels(box(glyph).left, box(name).left + space(4));
      AppearanceFixture.expectPixels(box(title).left - box(glyph).right, space(3));
      expect(Math.abs(middle(box(glyph)) - middle(box(title)))).toBeLessThanOrEqual(1);
      for (const counts of [header, name]) {
        const [added, removed] = [counts.querySelector(".added")!, counts.querySelector(".removed")!];
        AppearanceFixture.expectPixels(box(removed).left - box(added).right, space(1));
        AppearanceFixture.expectPixels(middle(box(removed)), middle(box(added)));
      }
      const directory = path.querySelector<HTMLElement>(".directory")!;
      const fileName = document.createRange();
      fileName.selectNodeContents(path.lastChild!);
      expect([directory.textContent, path.lastChild?.textContent]).toEqual(["src\\", "IntRange.cs"]);
      const badge = name.querySelector<HTMLElement>("nol-file-badge")!;
      expect([badge.getAttribute("aria-hidden"), name.getAttribute("aria-label"), name.textContent?.includes("IntRange.cs")]).toEqual(["true", null, true]);
      AppearanceFixture.expectPixels(box(badge).width, AppearanceFixture.measureLook("icon"));
      AppearanceFixture.expectPixels(box(badge).height, AppearanceFixture.measureLook("icon"));
      AppearanceFixture.expectPixels(box(badge).left, box(glyph).left);
      AppearanceFixture.expectPixels(middle(box(badge)), middle(box(path)));
      expect(getComputedStyle(path).whiteSpace).toBe("nowrap");
      AppearanceFixture.expectPixels(box(path).left - box(badge).right, space(2));
      AppearanceFixture.expectPixels(box(directory).left, box(path).left);
      AppearanceFixture.expectPixels(fileName.getBoundingClientRect().left, box(directory).right);
      AppearanceFixture.expectPixels(middle(fileName.getBoundingClientRect()), middle(box(directory)));
      expect(getComputedStyle(directory).color).toBe(getComputedStyle(glyph).color);
      if (forcedColors === "none")
        expect(getComputedStyle(directory).color).not.toBe(getComputedStyle(path).color);
      const kind = name.querySelector<HTMLElement>(".kind")!;
      expect(kind.textContent).toBe("Edited");
      AppearanceFixture.expectPixels(box(kind).left - box(path).right, space(3));
      AppearanceFixture.expectPixels(box(name.querySelector(".added")!).left - box(kind).right, space(3));
      AppearanceFixture.expectPixels(middle(box(kind)), middle(box(path)));
      expect([getComputedStyle(kind).fontSize, getComputedStyle(kind).color]).toEqual([getComputedStyle(path).fontSize, getComputedStyle(directory).color]);
      expect(box(path).right).toBeLessThanOrEqual(box(name.querySelector(".added")!).left - space(3) + 0.5);
    });
  });
});
