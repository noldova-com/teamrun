/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { NotificationState, NotificationsQuery, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class NotificationsMethodTests {
  @TestMethod
  public listsTheNotificationsADeviceShowsWithItsQuietStateAndSequence(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createNotificationPart()]]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      const listed = await RuntimeHostFixture.callAsync(connection, "desktop:1", ShellMethods.notifications, new NotificationsQuery("laptop").toJson());
      host.requestStop("test");
      await host.waitForStopAsync();

      const state = NotificationState.fromJson(listed.payload);
      const synced = state.notifications[0]?.id ?? "";
      Assert.isTrue(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(synced));
      Assert.areEqual("synced:Synced|false|1", `${state.notifications.map(t => `${t.id === synced ? "synced" : t.id}:${t.post.title}`).join(",")}|${String(state.isDoNotDisturb)}|${state.sequence}`);
    });
  }
}
