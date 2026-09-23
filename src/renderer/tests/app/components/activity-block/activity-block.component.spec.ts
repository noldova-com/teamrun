/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DetailKind, MessageDetail } from "@noldova/teamrun-protocol";

import { SampleData } from "../../../fixtures/sample-data";
import { ActivityEntry } from "../../../../src/app/models/activity-entry";
import { Resources } from "../../../../src/app/resources";
import { ActivityBlockComponent } from "../../../../src/app/components/activity-block/activity-block.component";

describe("ActivityBlockComponent", () => {
  const detail = (sequence: number, kind: DetailKind, text: string): MessageDetail => new MessageDetail(sequence, kind, text, null, SampleData.timestamp);
  const longBody = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join(Resources.lineSeparator);

  it("lists the steps one line each, opens a step to its output, and expands long outputs", async () => {
    TestBed.configureTestingModule({ imports: [ActivityBlockComponent] });
    const fixture = TestBed.createComponent(ActivityBlockComponent);
    fixture.componentRef.setInput("entries", [
      new ActivityEntry(detail(0, DetailKind.Note, "Read: D:\\repo\\README.md"), detail(1, DetailKind.Note, longBody)),
      new ActivityEntry(detail(2, DetailKind.Command, `> ls${Resources.lineSeparator}file.txt`), null),
      new ActivityEntry(detail(3, DetailKind.Note, "Session tools: Read"), null)
    ]);
    fixture.componentRef.setInput("label", "Ran 1 command, read 1 file, 1 more step");
    fixture.componentRef.setInput("rootPath", "D:\\repo");
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const items = element.querySelectorAll("li");
    expect(element.textContent).toContain("Ran 1 command, read 1 file, 1 more step");
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toContain("Read: .\\README.md");
    expect(element.querySelector("pre")).toBeNull();
    expect(items[0]?.querySelector("button span")?.classList.contains("truncate")).toBe(true);

    items[0]!.querySelector<HTMLButtonElement>("button")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(items[0]?.querySelector("button span")?.classList.contains("tr-wrap")).toBe(true);
    expect(items[0]?.querySelector("pre")?.textContent?.split(Resources.lineSeparator)).toHaveLength(Resources.previewLineCount);
    items[0]!.querySelectorAll<HTMLButtonElement>("button")[1]!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(items[0]?.querySelector("pre")?.textContent?.split(Resources.lineSeparator)).toHaveLength(10);
    expect(items[0]?.querySelectorAll("button")[1]?.textContent).toContain(Resources.showLessLabel);

    items[1]!.querySelector<HTMLButtonElement>("button")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(items[1]?.querySelector("pre")?.textContent).toBe("file.txt");
    expect(items[1]?.querySelectorAll("button")).toHaveLength(1);
    items[2]!.querySelector<HTMLButtonElement>("button")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(items[2]?.querySelector("pre")).toBeNull();

    items[0]!.querySelector<HTMLButtonElement>("button")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(items[0]?.querySelector("pre")).toBeNull();
  });
});
