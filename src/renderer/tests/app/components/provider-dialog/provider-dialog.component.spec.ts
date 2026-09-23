/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { MatDialogRef } from "@angular/material/dialog";
import { ErrorCode, MethodName, ProviderAccountCreateParams } from "@noldova/teamrun-protocol";
import { SampleData } from "../../../fixtures/sample-data";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { ProviderDialogComponent } from "../../../../src/app/components/provider-dialog/provider-dialog.component";

describe("ProviderDialogComponent", () => {
  it("keeps the form and shows a save error, then closes only after a successful add", async () => {
    const bridge = SampleData.createBridge().fail(MethodName.ProviderAccountCreate, ErrorCode.InvalidParams, "Use an absolute profile path");
    bridge.pickedDirectory = "D:/profiles/personal";
    const close = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }, { provide: MatDialogRef, useValue: { close } }] });
    await TestBed.inject(ChatStore).initialize();
    const fixture = TestBed.createComponent(ProviderDialogComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(true);
    const label = root.querySelector<HTMLInputElement>('[name="label"]')!;
    label.value = "Personal";
    label.dispatchEvent(new Event("input"));
    root.querySelector<HTMLButtonElement>('[aria-label="Choose profile folder"]')!.click();
    await fixture.whenStable();
    root.querySelector("form")!.dispatchEvent(new Event("submit"));
    await fixture.whenStable();
    expect(close).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain("Use an absolute profile path");
    expect(label.value).toBe("Personal");
    bridge.answer(MethodName.ProviderAccountCreate, payload => {
      const params = ProviderAccountCreateParams.fromJson(payload);
      expect(params.provider).toBe("codex");
      expect(params.label).toBe("Personal");
      expect(params.profileDir).toBe("D:/profiles/personal");
      return SampleData.account.toJson();
    });
    root.querySelector("form")!.dispatchEvent(new Event("submit"));
    await fixture.whenStable();
    expect(close).toHaveBeenCalledWith(true);
  });
});
