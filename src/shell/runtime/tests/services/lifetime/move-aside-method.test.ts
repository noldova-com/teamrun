/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QualifiedName, Request, ShellMethods, WindowStateKey } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class MoveAsideMethodTests {
  @TestMethod
  public refusesUntilDataFromBeforeTheShellIsMovedAside(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const root = fixture.dataDirectory.root;
      await mkdir(root, { recursive: true });
      await writeFile(path.join(root, "teamrun.db"), "old data");
      await fixture.startAsync();
      const expected = `{"code":"PreShellData","message":"This data directory holds data from a TeamRun release that predates the shell; move it aside to continue.","details":{"location":${JSON.stringify(root)}}}`;

      const [refused, answer] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      refused.sendMessages(
        new Request("desktop:1", new QualifiedName("notes", "open"), null),
        new Request("desktop:2", ShellMethods.moveAside, null),
        new Request("desktop:3", ShellMethods.moveAside, null));
      const responses = [await refused.readResponseAsync(), await refused.readResponseAsync(), await refused.readResponseAsync()];
      await refused.waitForCloseAsync();
      const [admitted, admission] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      admitted.sendMessages(new Request("desktop:4", ShellMethods.moveAside, null));
      const again = await admitted.readResponseAsync();

      Assert.areEqual(expected, JSON.stringify(answer.failure?.toJson()));
      Assert.areEqual(expected, JSON.stringify(responses[0]?.failure?.toJson()));
      Assert.areEqual("desktop:2,desktop:3", responses.slice(1).map(t => t.id).sort().join(","));
      Assert.isFalse(responses.slice(1).some(t => t.hasFailed));
      Assert.isFalse(admission.hasFailed);
      Assert.isFalse(again.hasFailed);
      admitted.sendMessages(new Request("desktop:5", ShellMethods.readWindowBounds, new WindowStateKey("device-1", "main").toJson()));
      Assert.areEqual("{\"value\":null}", JSON.stringify((await admitted.readResponseAsync()).payload));
      Assert.isTrue(existsSync(path.join(root, "shell.sqlite")));
      Assert.isFalse(existsSync(path.join(root, "teamrun.db")));
      const moved = (await readdir(fixture.root)).filter(t => t.startsWith("data-before-shell-"));
      Assert.areEqual(1, moved.length);
      Assert.areEqual("teamrun.db", (await readdir(path.join(fixture.root, String(moved[0])))).join(","));
    });
  }
}
