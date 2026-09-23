/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

import { RenameDialogComponent } from "../../../../src/app/components/rename-dialog/rename-dialog.component";

describe("RenameDialogComponent", () => {
  it("closes with the trimmed title and refuses a blank one", async () => {
    const closed: (string | undefined)[] = [];
    TestBed.configureTestingModule({
      imports: [RenameDialogComponent],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: "Old title" }, { provide: MatDialogRef, useValue: { close: (value?: string) => closed.push(value) } }]
    });
    const fixture = TestBed.createComponent(RenameDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>("input")!;
    expect(input.value).toBe("Old title");

    input.value = "   ";
    input.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    fixture.detectChanges();
    element.querySelector("form")!.dispatchEvent(new Event("submit"));
    expect(closed).toEqual([]);

    input.value = "  New title  ";
    input.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    fixture.detectChanges();
    element.querySelector("form")!.dispatchEvent(new Event("submit"));
    expect(closed).toEqual(["New title"]);
  });
});
