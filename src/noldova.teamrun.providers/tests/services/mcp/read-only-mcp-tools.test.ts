/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TurnTools } from "@noldova/teamrun.core";
import { ReadOnlyMcpTools } from "@noldova/teamrun.providers";

@TestClass
export class ReadOnlyMcpToolsTests {
  @TestMethod
  public async listsOnlyTheToolsWhoseListingMarksThemReadOnlyAndCountsAnOutOfShapeHintAsOneThatChangesThings(): Promise<void> {
    const tools = new TurnTools({
      listToolsAsync: () => Promise.resolve([{ name: "teamrun_list_chats", annotations: { readOnlyHint: true } },
        { name: "teamrun_check_provider", annotations: { readOnlyHint: false } }, { name: "teamrun_list_projects", annotations: {} }, { name: "teamrun_rename_chat" },
        { name: "teamrun_list_files", annotations: [] }, { name: "teamrun_read_note", annotations: { readOnlyHint: "true" } }]),
      callToolAsync: () => Promise.resolve({})
    }, []);

    const listed = await ReadOnlyMcpTools.listAsync(tools, new AbortController().signal);

    Assert.areEqual("teamrun_list_chats", listed.join(","));
  }
}
