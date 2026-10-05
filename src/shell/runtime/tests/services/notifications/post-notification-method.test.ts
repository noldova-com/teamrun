/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FailureCode, NotificationBroadcast, NotificationReference, NotificationState, NotificationsQuery, Request, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class PostNotificationMethodTests {
  @TestMethod
  public postsADeclaredNotificationAndPublishesItButRefusesAnUndeclaredAbsentOrMalformedOne(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createNotificationPart()]]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      const listed = await RuntimeHostFixture.callAsync(connection, "desktop:1", ShellMethods.notifications, new NotificationsQuery("laptop").toJson());
      const synced = NotificationState.fromJson(listed.payload).notifications[0]?.id ?? "";
      connection.sendMessages(new Request("desktop:2", ShellMethods.postNotification, RuntimeHostFixture.alarm("Posted").toJson()));
      const posted = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      const postedId = NotificationReference.fromJson(posted[1].payload).id;
      const undeclared = await RuntimeHostFixture.callAsync(connection, "desktop:3", ShellMethods.postNotification, RuntimeHostFixture.alarm("Other", "clock.other").toJson());
      const absent = await RuntimeHostFixture.callAsync(connection, "desktop:4", ShellMethods.postNotification, RuntimeHostFixture.alarm("Due", "calendar.due").toJson());
      const invalid = await RuntimeHostFixture.callAsync(connection, "desktop:5", ShellMethods.postNotification, { kind: "clock.alarm" });
      host.requestStop("test");
      await host.waitForStopAsync();

      const name = (id: string): string => id === synced ? "synced" : id === postedId ? "posted" : id;
      const titles = (payload: unknown): string => NotificationBroadcast.fromJson(payload).notifications.map(t => `${name(t.id)}:${t.post.title}`).join(",");
      Assert.isTrue([synced, postedId].every(t => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(t)) && synced !== postedId);
      Assert.areEqual("shell.notifications|posted:Posted,synced:Synced|2", `${posted[0].name.text}|${titles(posted[0].payload)}|${NotificationBroadcast.fromJson(posted[0].payload).sequence}`);
      Assert.areEqual(`${FailureCode.InvalidParams}|The module clock does not declare clock.other among its notifications.`, `${undeclared.failure?.code}|${undeclared.failure?.message}`);
      Assert.areEqual("The notification kind calendar.due belongs to calendar, which is not an active module.", absent.failure?.message);
      Assert.areEqual(FailureCode.InvalidParams, invalid.failure?.code);
    });
  }
}
