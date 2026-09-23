/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { AuthStatus, ErrorCode, MethodName, ProviderAccount, ProviderListModelsParams, ProviderModel, TeammateCreateParams, TeammateUpdateParams } from "@noldova/teamrun-protocol";
import { SampleData } from "../../../fixtures/sample-data";
import { TeammateFixture } from "../../../fixtures/teammate-fixture";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { TeammateDialogComponent } from "../../../../src/app/components/teammate-dialog/teammate-dialog.component";

describe("TeammateDialogComponent", () => {
  it("uses the chosen account's provider and clears its incompatible model and effort before saving", async () => {
    const data = new TeammateFixture();
    const second = new ProviderAccount("a2", "claude", "Home", "D:/home", AuthStatus.LoggedIn, null, null, null, null, "t");
    data.bridge.answer(MethodName.ProviderAccountList, () => [SampleData.account.toJson(), second.toJson()])
      .answer(MethodName.ProviderModelCatalog, payload => {
        const params = ProviderListModelsParams.fromJson(payload);
        return params.providerAccountId === "a2"
          ? [new ProviderModel("other", "Other model", "", [], true, null, true).toJson()]
          : [new ProviderModel("gpt-5", "GPT5", "", ["high"], true, null, true).toJson()];
      });
    const close = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: data.bridge },
      { provide: MAT_DIALOG_DATA, useValue: data.alice }, { provide: MatDialogRef, useValue: { close } }] });
    await TestBed.inject(ChatStore).initialize();
    const fixture = TestBed.createComponent(TeammateDialogComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLElement>('mat-select[name="account"]')!.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLElement>("mat-option")).find(t => t.textContent?.trim() === "Claude Code · Home · This computer")!.click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(root.querySelector('mat-select[name="model"]')?.textContent).toContain("Default model"));
    expect(root.querySelector('mat-select[name="effort"]')?.getAttribute("aria-disabled")).toBe("true");
    root.querySelector("form")!.dispatchEvent(new Event("submit"));
    await fixture.whenStable();
    const params = TeammateUpdateParams.fromJson(data.bridge.requests.find(t => t.method === MethodName.TeammateUpdate)!.payload);
    expect(params.providerAccountId).toBe("a2");
    expect(params.model).toBeNull();
    expect(params.effort).toBeNull();
    expect(close).toHaveBeenCalledWith(true);
  });

  it("validates names and creates a teammate using account-backed choices and role text", async () => {
    const data = new TeammateFixture();
    const close = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: data.bridge },
      { provide: MAT_DIALOG_DATA, useValue: null }, { provide: MatDialogRef, useValue: { close } }] });
    await TestBed.inject(ChatStore).initialize();
    const fixture = TestBed.createComponent(TeammateDialogComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const name = root.querySelector<HTMLInputElement>('input[name="name"]')!;
    name.value = "invalid name";
    name.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    expect(root.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(true);
    name.value = "Carol";
    name.dispatchEvent(new Event("input"));
    const role = root.querySelector<HTMLTextAreaElement>("textarea")!;
    role.value = "Review **carefully**";
    role.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    root.querySelector("form")!.dispatchEvent(new Event("submit"));
    await fixture.whenStable();
    const params = TeammateCreateParams.fromJson(data.bridge.requests.find(t => t.method === MethodName.TeammateCreate)!.payload);
    expect(params.name).toBe("Carol");
    expect(params.providerAccountId).toBe("a1");
    expect(params.role).toBe("Review **carefully**");
    expect(close).toHaveBeenCalledWith(true);
  });

  it("keeps edited input on a busy refusal and names the teammate in the error", async () => {
    const data = new TeammateFixture();
    data.bridge.fail(MethodName.TeammateUpdate, ErrorCode.Conflict, "A conversation has a reply in progress");
    const close = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: data.bridge },
      { provide: MAT_DIALOG_DATA, useValue: data.alice }, { provide: MatDialogRef, useValue: { close } }] });
    await TestBed.inject(ChatStore).initialize();
    const fixture = TestBed.createComponent(TeammateDialogComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector("form")!.dispatchEvent(new Event("submit"));
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain("@Alice:");
    expect(root.querySelector<HTMLInputElement>("input")!.value).toBe("Alice");
    expect(close).not.toHaveBeenCalled();
  });
});
