/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { NotificationReference, Request, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class DismissNotificationMethodTests {
  @TestMethod
  public dismissesAPostedNotificationAndAnswersAGoneOneWithoutAFailure(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createNotificationPart()]]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      const [synced, postedId] = await RuntimeHostFixture.listAndPostAsync(connection);
      connection.sendMessages(new Request("desktop:3", ShellMethods.dismissNotification, new NotificationReference(postedId).toJson()));
      const dismissed = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      const again = await RuntimeHostFixture.callAsync(connection, "desktop:4", ShellMethods.dismissNotification, new NotificationReference(postedId).toJson());
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual("synced:Synced|null|null", `${RuntimeHostFixture.formatTitles(dismissed[0].payload, synced, postedId)}|${JSON.stringify(dismissed[1].payload)}|${JSON.stringify(again.payload)}`);
    });
  }
}
