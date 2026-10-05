/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FailureCode, NotificationBroadcast, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class PostNotificationMethodTests {
  @TestMethod
  public postsADeclaredNotificationAndPublishesItButRefusesAnUndeclaredAbsentOrMalformedOne(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createNotificationPart()]]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      const [synced, postedId, posted] = await RuntimeHostFixture.listAndPostAsync(connection);
      const undeclared = await RuntimeHostFixture.callAsync(connection, "desktop:3", ShellMethods.postNotification, RuntimeHostFixture.createAlarm("Other", "clock.other").toJson());
      const absent = await RuntimeHostFixture.callAsync(connection, "desktop:4", ShellMethods.postNotification, RuntimeHostFixture.createAlarm("Due", "calendar.due").toJson());
      const invalid = await RuntimeHostFixture.callAsync(connection, "desktop:5", ShellMethods.postNotification, { kind: "clock.alarm" });
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.isTrue([synced, postedId].every(t => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(t)) && synced !== postedId);
      Assert.areEqual("shell.notifications|posted:Posted,synced:Synced|2", `${posted.name.text}|${RuntimeHostFixture.formatTitles(posted.payload, synced, postedId)}|${NotificationBroadcast.fromJson(posted.payload).sequence}`);
      Assert.areEqual(`${FailureCode.InvalidParams}|The module clock does not declare clock.other among its notifications.`, `${undeclared.failure?.code}|${undeclared.failure?.message}`);
      Assert.areEqual("The notification kind calendar.due belongs to calendar, which is not an active module.", absent.failure?.message);
      Assert.areEqual(FailureCode.InvalidParams, invalid.failure?.code);
    });
  }
}
