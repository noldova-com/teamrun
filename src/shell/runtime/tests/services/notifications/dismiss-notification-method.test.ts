/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { NotificationBroadcast, NotificationReference, NotificationState, NotificationsQuery, Request, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class DismissNotificationMethodTests {
  @TestMethod
  public dismissesAPostedNotificationAndAnswersAGoneOneWithoutAFailure(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createNotificationPart()]]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      const listed = await RuntimeHostFixture.callAsync(connection, "desktop:1", ShellMethods.notifications, new NotificationsQuery("laptop").toJson());
      const synced = NotificationState.fromJson(listed.payload).notifications[0]?.id ?? "";
      connection.sendMessages(new Request("desktop:2", ShellMethods.postNotification, RuntimeHostFixture.alarm("Posted").toJson()));
      await connection.readEventAsync();
      const postedId = NotificationReference.fromJson((await connection.readResponseAsync()).payload).id;
      connection.sendMessages(new Request("desktop:3", ShellMethods.dismissNotification, new NotificationReference(postedId).toJson()));
      const dismissed = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      const again = await RuntimeHostFixture.callAsync(connection, "desktop:4", ShellMethods.dismissNotification, new NotificationReference(postedId).toJson());
      host.requestStop("test");
      await host.waitForStopAsync();

      const name = (id: string): string => id === synced ? "synced" : id === postedId ? "posted" : id;
      const titles = (payload: unknown): string => NotificationBroadcast.fromJson(payload).notifications.map(t => `${name(t.id)}:${t.post.title}`).join(",");
      Assert.areEqual("synced:Synced|null|null", `${titles(dismissed[0].payload)}|${JSON.stringify(dismissed[1].payload)}|${JSON.stringify(again.payload)}`);
    });
  }
}
