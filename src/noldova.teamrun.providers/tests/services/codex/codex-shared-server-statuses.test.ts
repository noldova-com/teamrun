/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SharedMcpFailureKind } from "@noldova/teamrun.core";
import { CodexSharedServerStatuses } from "@noldova/teamrun.providers";

import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class CodexSharedServerStatusesTests {
  @TestMethod
  public async holdsTheFailuresReportedBeforeItsThreadIsKnownAndReportsThoseOfItsThreadOrOfNoThread(): Promise<void> {
    const listener = new RecordingTurnListener();
    const statuses = new CodexSharedServerStatuses("p-1", "Work", ["docs", "search", "open"], listener);

    await statuses.handleNotificationAsync("mcpServer/startupStatus/updated", CodexSharedServerStatusesTests.status("docs", "failed", "t1"));
    await statuses.handleNotificationAsync("mcpServer/startupStatus/updated", CodexSharedServerStatusesTests.status("search", "failed", "t2"));
    await statuses.handleNotificationAsync("mcpServer/startupStatus/updated", CodexSharedServerStatusesTests.status("open", "failed", null, "reauthenticationRequired"));
    const held = listener.sharedFailures.length;
    await statuses.followAsync("t1");
    await statuses.handleNotificationAsync("mcpServer/startupStatus/updated", CodexSharedServerStatusesTests.status("search", "failed", "t1", "reauthenticationRequired"));
    await statuses.handleNotificationAsync("mcpServer/startupStatus/updated", CodexSharedServerStatusesTests.status("open", "failed", "t2"));
    await statuses.handleNotificationAsync("mcpServer/startupStatus/updated", CodexSharedServerStatusesTests.status("docs", "failed", null));

    Assert.areEqual(0, held);
    Assert.areEqual(JSON.stringify([["p-1", "Work", "docs", SharedMcpFailureKind.Connection], ["p-1", "Work", "open", SharedMcpFailureKind.SignIn],
      ["p-1", "Work", "search", SharedMcpFailureKind.SignIn], ["p-1", "Work", "docs", SharedMcpFailureKind.Connection]]),
      JSON.stringify(listener.sharedFailures.map(t => [t.providerId, t.providerLabel, t.server, t.kind])));
  }

  @TestMethod
  public async ignoresAServerThatStartsOrIsntTheTurnsAndEveryOtherNotification(): Promise<void> {
    const listener = new RecordingTurnListener();
    const statuses = new CodexSharedServerStatuses("p-1", "Work", ["docs"], listener);
    await statuses.followAsync("t1");

    for (const state of ["starting", "ready", "cancelled"])
      await statuses.handleNotificationAsync("mcpServer/startupStatus/updated", CodexSharedServerStatusesTests.status("docs", state, "t1"));
    await statuses.handleNotificationAsync("mcpServer/startupStatus/updated", CodexSharedServerStatusesTests.status("theirs", "failed", "t1"));
    await statuses.handleNotificationAsync("mcpServer/startupStatus/updated", JsonReader.fromValue({ status: "failed", threadId: "t1" }));
    await statuses.handleNotificationAsync("turn/started", CodexSharedServerStatusesTests.status("docs", "failed", "t1"));

    Assert.areEqual(0, listener.sharedFailures.length);
  }

  private static status(name: string, status: string, threadId: string | null, failureReason: string | null = null): JsonReader {
    return JsonReader.fromValue({ name, status, threadId, failureReason, error: "failed with token-value" });
  }
}
