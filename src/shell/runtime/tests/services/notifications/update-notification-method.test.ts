/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandRun, FailureCode, NotificationPost, NotificationSeverity, NotificationUpdate, QualifiedName, Request, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class UpdateNotificationMethodTests {
  @TestMethod
  public updatesAPostedNotificationButRefusesAGoneOneAnotherKindOrAnotherModulesCommand(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createNotificationPart()]]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      const [synced, postedId] = await RuntimeHostFixture.listAndPostAsync(connection);
      connection.sendMessages(new Request("desktop:3", ShellMethods.updateNotification, new NotificationUpdate(postedId, RuntimeHostFixture.createAlarm("Updated")).toJson()));
      const updated = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      const missing = await RuntimeHostFixture.callAsync(connection, "desktop:4", ShellMethods.updateNotification, new NotificationUpdate("9", RuntimeHostFixture.createAlarm("Gone")).toJson());
      const otherKind = await RuntimeHostFixture.callAsync(
        connection, "desktop:5", ShellMethods.updateNotification, new NotificationUpdate(synced, RuntimeHostFixture.createAlarm("Other", "clock.other")).toJson());
      const foreign = new NotificationPost(
        QualifiedName.parse("clock.alarm"), "window", "Foreign", null, NotificationSeverity.Info, new CommandRun(QualifiedName.parse("calendar.show"), null), [], null);
      const foreignUpdate = await RuntimeHostFixture.callAsync(connection, "desktop:6", ShellMethods.updateNotification, new NotificationUpdate(synced, foreign).toJson());
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual("posted:Updated,synced:Synced|null", `${RuntimeHostFixture.formatTitles(updated[0].payload, synced, postedId)}|${JSON.stringify(updated[1].payload)}`);
      Assert.areEqual(`${FailureCode.NotFound}|Notification 9 is gone; it was dismissed or its module stopped.`, `${missing.failure?.code}|${missing.failure?.message}`);
      Assert.areEqual(`${FailureCode.InvalidParams}|Notification ${synced} is of the kind clock.alarm, which an update keeps.`, `${otherKind.failure?.code}|${otherKind.failure?.message}`);
      Assert.areEqual(
        `${FailureCode.InvalidParams}|The module clock may not offer the command calendar.show in a notification; it must be its own or a dependency's.`,
        `${foreignUpdate.failure?.code}|${foreignUpdate.failure?.message}`);
    });
  }
}
