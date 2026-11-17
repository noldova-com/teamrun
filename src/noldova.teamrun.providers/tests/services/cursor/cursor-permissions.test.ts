/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, truncateSync, writeFileSync } from "node:fs";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CursorPermissions, Resources } from "@noldova/teamrun.providers";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class CursorPermissionsTests {
  @TestMethod
  public readsThePersonsAllowAndDenyRulesAndNoneWhenTheFileOrItsPermissionsAreMissing(): void {
    using directory = new TemporaryDirectory();
    const file = directory.resolve("cli-config.json");
    const rules = (): string => { const read = CursorPermissions.read(file); return JSON.stringify([read.allow, read.deny]); };

    const missing = rules();
    writeFileSync(file, JSON.stringify({ version: 1, editor: { vimMode: false } }));
    const withoutPermissions = rules();
    writeFileSync(file, JSON.stringify({ permissions: { allow: ["Shell(ls)", "Read(src/**)"] } }));
    const allowOnly = rules();
    writeFileSync(file, JSON.stringify({ permissions: { allow: ["Shell(git)"], deny: ["Shell(rm)", "Write(.env)"] } }));

    Assert.areEqual("[[],[]]", missing);
    Assert.areEqual("[[],[]]", withoutPermissions);
    Assert.areEqual(JSON.stringify([["Shell(ls)", "Read(src/**)"], []]), allowOnly);
    Assert.areEqual(JSON.stringify([["Shell(git)"], ["Shell(rm)", "Write(.env)"]]), rules());
  }

  @TestMethod
  public leavesOutEachAllowRuleWhoseServerIsTeamRunOrAWildcardAndKeepsEveryDenyRule(): void {
    using directory = new TemporaryDirectory();
    const file = directory.resolve("cli-config.json");
    writeFileSync(file, JSON.stringify({ permissions: {
      allow: ["Mcp(*:*)", "Mcp(*:open_panel)", "Mcp(teamrun:*)", "Mcp( TeamRun :open_panel)", "Mcp(do*:search)", "Mcp(docs:*)", "Shell(ls)"],
      deny: ["Mcp(*:*)", "Mcp(teamrun:open_panel)", "Shell(rm)"] } }));

    const read = CursorPermissions.read(file);

    Assert.areEqual(JSON.stringify(["Mcp(docs:*)", "Shell(ls)"]), JSON.stringify(read.allow));
    Assert.areEqual(JSON.stringify(["Mcp(*:*)", "Mcp(teamrun:open_panel)", "Shell(rm)"]), JSON.stringify(read.deny));
  }

  @TestMethod
  public refusesNamingTheFileWhenItCantBeReadIsntJsonHoldsRulesThatArentStringsOrIsTooLarge(): void {
    using directory = new TemporaryDirectory();
    const file = directory.resolve("cli-config.json");
    const refusal = (): string => Assert.throws(() => CursorPermissions.read(file), Error).message;

    writeFileSync(file, "{ not json");
    const malformed = refusal();
    writeFileSync(file, JSON.stringify({ permissions: { deny: [1] } }));
    const notStrings = refusal();
    writeFileSync(file, JSON.stringify({ permissions: ["Shell(ls)"] }));
    const notAnObject = refusal();
    truncateSync(file, Resources.maximumConfigurationBytes + 1);
    const tooLarge = refusal();
    const folder = directory.resolve("folder", "cli-config.json");
    mkdirSync(folder, { recursive: true });
    const unreadable = Assert.throws(() => CursorPermissions.read(folder), Error).message;

    Assert.areEqual(Resources.formatCursorConfigUnreadable(file), malformed);
    Assert.areEqual(malformed, notStrings);
    Assert.areEqual(malformed, notAnObject);
    Assert.areEqual(Resources.formatCursorConfigTooLarge(file), tooLarge);
    Assert.areEqual(Resources.formatCursorConfigUnreadable(folder), unreadable);
  }
}
