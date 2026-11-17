/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimePart } from "@noldova/computer-use.runtime";
import { PermissionDecision, RememberedPermission } from "@noldova/desktop.runtime";
import type { RememberedAppGrant } from "@noldova/teamrun.core";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RuntimeRememberedAppGrants, RuntimeToolSession } from "@noldova/teamrun.runtime";

import { AnsweringAsker } from "../fixtures/answering-asker.fixture.js";
import { CenterPermissionsContext } from "../fixtures/center-permissions-context.fixture.js";
import { ComputerUseHarness } from "../fixtures/computer-use-harness.fixture.js";
import { ListedPermissionsContext } from "../fixtures/listed-permissions-context.fixture.js";

@TestClass
export class RuntimeRememberedAppGrantsTests {
  @TestMethod
  public listsOnlyComputerUsesScreenAndAppsAllowedInAChatAndAnAppOnlyWithItsSubject(): void {
    const at = new Date("2026-10-29T10:00:00.000Z");
    const remember = (id: string, module: string, action: string, subject: string | null, decision: PermissionDecision): RememberedPermission =>
      new RememberedPermission(id, module, action, subject, "c1/default", decision, at);
    const permissions = new ListedPermissionsContext([
      remember("screen", "computer-use", "computer-use.controlScreen", null, PermissionDecision.AllowedAlways),
      remember("app", "computer-use", "computer-use.controlApp", "com.example.notes", PermissionDecision.AllowedAlways),
      remember("no-app", "computer-use", "computer-use.controlApp", null, PermissionDecision.AllowedAlways),
      remember("denied", "computer-use", "computer-use.controlApp", "com.example.mail", PermissionDecision.DeniedAlways),
      remember("keys", "computer-use", "computer-use.sendSystemKeys", null, PermissionDecision.AllowedAlways),
      remember("other", "terminal", "computer-use.controlApp", "com.example.paint", PermissionDecision.AllowedAlways)
    ]);

    const listed = new RuntimeRememberedAppGrants(permissions).list();

    Assert.areEqual(JSON.stringify([["screen", null, "c1/default"], ["app", "com.example.notes", "c1/default"]]),
      JSON.stringify(listed.map(t => [t.id, t.app, t.scope])));
  }

  @TestMethod
  public async listsTheAppAllowedInThisChatBesideTheScreenAndRefusesTheChatsNextInputToItWithoutAskingOnceItIsRevoked(): Promise<void> {
    const part = new RuntimePart(() => ComputerUseHarness.backend(ComputerUseHarness.notesWindow()));
    const asker = new AnsweringAsker([]);
    const signal = new AbortController().signal;

    const { listed, isRevoked, asked, refused, left } = await ComputerUseHarness.runAsync(part, asker, async context => {
      await part.activateAsync(context);
      const session = new RuntimeToolSession(context.tools.openSession(ComputerUseHarness.SCOPE, {}));
      await session.callToolAsync("computer_request_apps", { apps: [ComputerUseHarness.NOTES.identity.id], reason: ComputerUseHarness.REASON }, signal);
      const grants = new RuntimeRememberedAppGrants(new CenterPermissionsContext(context.tools.center, "teamrun", context.log));
      const remembered = grants.list();
      const notes = remembered.find(t => t.app === ComputerUseHarness.NOTES.identity.id);
      const revoked = !Object.isUndefined(notes) && grants.revoke(notes.id);
      const before = asker.asks.length;
      return {
        listed: remembered, isRevoked: revoked, asked: before,
        refused: await session.callToolAsync("computer_key", { keys: "Enter", summary: "Saves the note." }, signal), left: grants.list()
      };
    });

    Assert.areEqual(JSON.stringify([[ComputerUseHarness.NOTES.identity.id, ComputerUseHarness.SCOPE], [null, ComputerUseHarness.SCOPE]]),
      JSON.stringify(listed.map(t => [t.app, t.scope]).toSorted((a, b) => String(a[0]).localeCompare(String(b[0])))));
    Assert.isTrue(isRevoked);
    Assert.areEqual(JSON.stringify([null]), JSON.stringify(left.map(t => t.app)));
    Assert.areEqual(asked, asker.asks.length);
    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "Denied: The person didn't allow this input. Nothing was sent." }], isError: true }),
      JSON.stringify(refused));
  }

  @TestMethod
  public async listsTheScreenAllowedInThisChatAndAsksForItAgainAtTheChatsNextSessionOnceItIsRevoked(): Promise<void> {
    const part = new RuntimePart(() => ComputerUseHarness.backend());
    const asker = new AnsweringAsker([]);

    const { listed, sessions, results } = await ComputerUseHarness.runAsync(part, asker, async context => {
      await part.activateAsync(context);
      const grants = new RuntimeRememberedAppGrants(new CenterPermissionsContext(context.tools.center, "teamrun", context.log));
      const called: JsonObject[] = [];
      let remembered: readonly RememberedAppGrant[] = [];
      for (const isFirst of [true, false]) {
        const session = context.tools.openSession(ComputerUseHarness.SCOPE, {});
        called.push(await new RuntimeToolSession(session).callToolAsync(ComputerUseHarness.LISTED_TOOL, {}, new AbortController().signal));
        session.end();
        if (isFirst) {
          remembered = grants.list();
          const first = remembered[0];
          if (!Object.isUndefined(first))
            grants.revoke(first.id);
        }
      }
      return { listed: remembered, sessions: context.tools.sessions.map(t => t.id), results: called };
    });

    Assert.isFalse(results.some(t => t["isError"] === true), JSON.stringify(results));
    Assert.areEqual(JSON.stringify([[null, ComputerUseHarness.SCOPE]]), JSON.stringify(listed.map(t => [t.app, t.scope])));
    Assert.areEqual(sessions.join(","), asker.sessions.join(","));
    Assert.areEqual(`${ComputerUseHarness.SCREEN_ACTION},${ComputerUseHarness.SCREEN_ACTION}`, asker.asks.map(t => t.action).join(","));
  }
}
