/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { NotificationBroadcast, Request, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class ClearNotificationsMethodTests {
  @TestMethod
  public clearsEveryNotificationAndPublishesIt(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createNotificationPart()]]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      connection.sendMessages(new Request("desktop:1", ShellMethods.clearNotifications, null));
      const cleared = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual("0", String(NotificationBroadcast.fromJson(cleared[0].payload).notifications.length));
      Assert.isFalse(cleared[1].hasFailed);
    });
  }
}
