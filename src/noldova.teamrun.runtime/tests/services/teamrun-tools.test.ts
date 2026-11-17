/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TeamRunTools } from "@noldova/teamrun.runtime";

@TestClass
export class TeamRunToolsTests {
  @TestMethod
  public marksEveryToolButAProvidersCheckSoAnMcpClientCallsItWithoutAskingThePerson(): void {
    const reading = { isReadOnly: true, isDestructive: false, isOpenWorld: false };
    const panel = { isReadOnly: false, isDestructive: false, isOpenWorld: false };
    const tools = [...TeamRunTools.all.map(t => t.descriptor), TeamRunTools.openPanel, TeamRunTools.closePanel];

    Assert.areEqual(JSON.stringify([
      ["teamrun_list_projects", reading], ["teamrun_list_chats", reading], ["teamrun_list_messages", reading], ["teamrun_list_approvals", reading],
      ["teamrun_list_providers", reading], ["teamrun_check_provider", { isReadOnly: false, isDestructive: false, isOpenWorld: true }],
      ["teamrun_list_teammates", reading], ["teamrun_open_panel", panel], ["teamrun_close_panel", panel]
    ]), JSON.stringify(tools.map(t => [t.name, t.hints])));
    Assert.areEqual("teamrun_check_provider",
      tools.filter(t => t.hints!.isReadOnly !== true && (t.hints!.isDestructive !== false || t.hints!.isOpenWorld !== false)).map(t => t.name).join(","));
  }

  @TestMethod
  public offersThePagesAChatAndEveryViewWithoutInstancesAsPanelsAndSaysWhatClosingAViewDoes(): void {
    const panels = [TeamRunTools.openPanel, TeamRunTools.closePanel].map(t => (JSON.parse(JSON.stringify(t.inputSchema)) as { properties: { panel: { enum: string[] } } })
      .properties.panel.enum);

    Assert.areEqual(JSON.stringify(Array(2).fill(["Teammates", "Providers", "Chat", "Projects", "Activity", "Changes", "Plan", "SubAgents", "BackgroundTasks", "Page"])), JSON.stringify(panels));
    Assert.isTrue(TeamRunTools.closePanel.description.includes("for a view, it hides the dock that holds it, with the dock's other tabs"));
    Assert.isTrue(TeamRunTools.openPanel.description.includes("A view shows where the person keeps it, and its dock shows too"));
  }
}
