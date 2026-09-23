/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DetailKind, MessageDetail, MessageStatus, MethodName } from "@noldova/teamrun-protocol";

import { SampleData } from "../../../fixtures/sample-data";
import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { ActivityPanelComponent } from "../../../../src/app/components/activity-panel/activity-panel.component";
import { ChangesPanelComponent } from "../../../../src/app/components/changes-panel/changes-panel.component";

describe("ActivityPanelComponent and ChangesPanelComponent", () => {
  it("list what the replies did and edited, or say there is nothing", async () => {
    const reply = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      new MessageDetail(0, DetailKind.Note, "Read: a.ts", { tool: "Read", toolUseId: "t1" }, SampleData.timestamp),
      new MessageDetail(1, DetailKind.FileChange, "Edited b.ts", { changes: [{ path: "D:\\repo\\b.ts", kind: "update", diff: "--- a\n+++ b\n@@ -1 +1 @@\n-x\n+y" }] }, SampleData.timestamp),
      new MessageDetail(2, DetailKind.Text, "Done.", null, SampleData.timestamp)
    ]);
    const bridge = SampleData.createBridge().answer(MethodName.MessageList, () => [SampleData.userMessage.toJson(), reply.toJson()]);
    TestBed.configureTestingModule({ imports: [ActivityPanelComponent, ChangesPanelComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const activity = TestBed.createComponent(ActivityPanelComponent);
    const changes = TestBed.createComponent(ChangesPanelComponent);
    activity.detectChanges();
    changes.detectChanges();
    expect(activity.nativeElement.textContent).toContain(Resources.noActivityText);
    expect(changes.nativeElement.textContent).toContain(Resources.noChangesText);

    await store.initialize();
    await store.selectConversation("c1");
    await activity.whenStable();
    await changes.whenStable();
    activity.detectChanges();
    changes.detectChanges();
    expect(activity.nativeElement.querySelectorAll("tr-activity-block")).toHaveLength(1);
    expect(activity.nativeElement.textContent).toContain("Codex");
    expect(changes.nativeElement.querySelectorAll("tr-edited-files-card")).toHaveLength(1);
    expect(changes.nativeElement.textContent).toContain("b.ts");
    store.dispose();
  });
});
