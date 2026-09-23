/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

import { ConfirmRequest } from "../../../../src/app/models/confirm-request";
import { ConfirmDialogComponent } from "../../../../src/app/components/confirm-dialog/confirm-dialog.component";

describe("ConfirmDialogComponent", () => {
  it("shows the request and closes with true when confirmed", async () => {
    const closed: (boolean | undefined)[] = [];
    TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: new ConfirmRequest("Delete it", "It goes.", "Delete") },
        { provide: MatDialogRef, useValue: { close: (value?: boolean) => closed.push(value) } }
      ]
    });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector("h2")?.textContent?.trim()).toBe("Delete it");
    expect(element.querySelector("p")?.textContent?.trim()).toBe("It goes.");
    const buttons = element.querySelectorAll<HTMLButtonElement>("button");
    expect(buttons[1]?.textContent?.trim()).toBe("Delete");
    buttons[1]!.click();
    expect(closed).toEqual([true]);
  });
});
