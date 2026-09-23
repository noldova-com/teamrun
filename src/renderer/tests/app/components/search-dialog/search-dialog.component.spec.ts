/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { MatDialogRef } from "@angular/material/dialog";

import { ConversationSearchHit, ConversationSearchResult, MethodName } from "@noldova/teamrun-protocol";

import { SampleData } from "../../../fixtures/sample-data";
import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { SearchDialogComponent } from "../../../../src/app/components/search-dialog/search-dialog.component";

describe("SearchDialogComponent", () => {
  it("searches as the user types and closes with the chosen hit", async () => {
    const closed: (ConversationSearchHit | undefined)[] = [];
    const hit = new ConversationSearchHit("c1", "p1", "First", "m2", "…the login page…", SampleData.timestamp);
    const titled = new ConversationSearchHit("c2", "p1", "Login flow", null, "Login flow", SampleData.timestamp);
    const bridge = SampleData.createBridge().answer(MethodName.ConversationSearch, payload =>
      new ConversationSearchResult(String((payload as { query: string }).query).includes("flow") ? [titled, hit] : [hit]).toJson());
    TestBed.configureTestingModule({
      imports: [SearchDialogComponent],
      providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }, { provide: MatDialogRef, useValue: { close: (value?: ConversationSearchHit) => closed.push(value) } }]
    });
    await TestBed.inject(ChatStore).initialize();
    const fixture = TestBed.createComponent(SearchDialogComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain(Resources.searchHint);

    await fixture.whenStable();
    const input = element.querySelector<HTMLInputElement>("input")!;
    input.value = "login flow";
    input.dispatchEvent(new Event("input"));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelectorAll("li").length).toBe(2);
    });
    expect(element.textContent).toContain("Login flow");
    expect(element.textContent).toContain(SampleData.project.name);
    expect(element.textContent).toContain("the login page");

    element.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    element.querySelectorAll<HTMLButtonElement>("li button")[1]!.click();
    expect(closed.map(t => t?.conversationId)).toEqual(["c2", "c1"]);

    const asked = bridge.methods.filter(t => t === MethodName.ConversationSearch).length;
    input.value = " ";
    input.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.textContent).toContain(Resources.searchHint);
    expect(bridge.methods.filter(t => t === MethodName.ConversationSearch).length).toBe(asked);
  });
});
