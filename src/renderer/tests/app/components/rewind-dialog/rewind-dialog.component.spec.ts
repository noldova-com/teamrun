/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { MatDialogRef } from "@angular/material/dialog";

import { RewindDialogComponent } from "../../../../src/app/components/rewind-dialog/rewind-dialog.component";

describe("RewindDialogComponent", () => {
  it("closes with the file-restore choice", async () => {
    const closed: (boolean | undefined)[] = [];
    TestBed.configureTestingModule({
      imports: [RewindDialogComponent],
      providers: [{ provide: MatDialogRef, useValue: { close: (value?: boolean) => closed.push(value) } }]
    });
    const fixture = TestBed.createComponent(RewindDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = element.querySelectorAll<HTMLButtonElement>("mat-dialog-actions button");

    buttons[1]!.click();
    element.querySelector<HTMLInputElement>("mat-checkbox input")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    buttons[1]!.click();

    expect(closed).toEqual([true, false]);
  });
});
