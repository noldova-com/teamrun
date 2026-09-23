/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DiffLineKind } from "../../../../src/app/enums/diff-line-kind";
import { DiffLine } from "../../../../src/app/models/diff-line";
import { FileEdit } from "../../../../src/app/models/file-edit";
import { Resources } from "../../../../src/app/resources";
import { EditedFilesCardComponent } from "../../../../src/app/components/edited-files-card/edited-files-card.component";

describe("EditedFilesCardComponent", () => {
  const edit = (path: string, lines: DiffLine[]): FileEdit => new FileEdit(path, "update", lines);

  it("wraps each file independently without folding it and remembers wrapping when reopened", async () => {
    TestBed.configureTestingModule({ imports: [EditedFilesCardComponent] });
    const fixture = TestBed.createComponent(EditedFilesCardComponent);
    fixture.componentRef.setInput("edits", [
      edit("a.ts", [new DiffLine(DiffLineKind.Added, "    const value = 'a long line';")]),
      edit("b.ts", [new DiffLine(DiffLineKind.Added, "second")])
    ]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const rows = element.querySelectorAll("li");
    rows[0]!.querySelector<HTMLButtonElement>("button")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    const wrap = rows[0]!.querySelector<HTMLButtonElement>(Resources.wrapButtonSelector)!;
    expect(wrap.getAttribute("aria-pressed")).toBe("false");
    wrap.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows[0]!.querySelector(".tr-diff")?.classList.contains(Resources.wrappedClass)).toBe(true);
    expect(rows[0]!.querySelector(".tr-diff-line")?.textContent).toBe("+    const value = 'a long line';");
    expect(rows[1]!.querySelector(Resources.wrapButtonSelector)?.getAttribute("aria-pressed")).toBe("false");
    rows[0]!.querySelector<HTMLButtonElement>("button")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows[0]!.querySelector(".tr-diff")).toBeNull();
    rows[0]!.querySelector<HTMLButtonElement>("button")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows[0]!.querySelector(".tr-diff")?.classList.contains(Resources.wrappedClass)).toBe(true);
    wrap.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows[0]!.querySelector(".tr-diff")?.classList.contains(Resources.wrappedClass)).toBe(false);
    expect(element.querySelector("button button")).toBeNull();
  });

  it("summarises the files, folds the long tail, and opens a diff", async () => {
    TestBed.configureTestingModule({ imports: [EditedFilesCardComponent] });
    const fixture = TestBed.createComponent(EditedFilesCardComponent);
    const edits = [
      edit("D:\\repo\\src\\a.ts", [
        new DiffLine(DiffLineKind.Meta, "@@"), new DiffLine(DiffLineKind.Removed, "old"), new DiffLine(DiffLineKind.Added, "new"),
        new DiffLine(DiffLineKind.Context, "same")
      ]),
      edit("b.ts", []),
      edit("c.ts", [new DiffLine(DiffLineKind.Added, "x")]),
      edit("d.ts", [new DiffLine(DiffLineKind.Added, "y")]),
      edit("e.ts", [])
    ];
    fixture.componentRef.setInput("edits", edits);
    fixture.componentRef.setInput("rootPath", "D:\\repo");
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain(Resources.formatEditedFiles(5));
    expect(element.textContent).toContain("+3");
    expect(element.textContent).toContain("-1");
    expect(element.querySelectorAll("li")).toHaveLength(Resources.shownFileCount);
    expect(element.textContent).toContain(Resources.formatShowMoreFiles(2));
    expect(element.querySelector("li button")?.textContent).toContain("src\\a.ts");
    expect(element.querySelector("li button")?.textContent).not.toContain("repo");
    expect(element.querySelectorAll("li")[1]?.querySelector("button")?.disabled).toBe(true);

    element.querySelector<HTMLButtonElement>("li button")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    const diff = element.querySelector(".tr-diff");
    expect(diff?.textContent).toContain("-old");
    expect(diff?.textContent).toContain("+new");
    expect(diff?.textContent).toContain(" same");
    expect(diff?.querySelectorAll(".tr-diff-added")).toHaveLength(1);

    Array.from(element.querySelectorAll<HTMLButtonElement>("button")).find(t => t.textContent?.includes(Resources.formatShowMoreFiles(2)))!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelectorAll("li")).toHaveLength(5);
    element.querySelector<HTMLButtonElement>("li button")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector(".tr-diff")).toBeNull();
  });
});
