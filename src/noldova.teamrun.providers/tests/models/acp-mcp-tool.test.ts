/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpMcpTool } from "@noldova/teamrun.providers";

@TestClass
export class AcpMcpToolTests {
  @TestMethod
  public keepsItsServerAndToolAndRefusesABlankOne(): void {
    const tool = new AcpMcpTool("teamrun", "teamrun_list_chats");

    Assert.areEqual("teamrun,teamrun_list_chats", [tool.server, tool.tool].join(","));
    Assert.areEqual("server", Assert.throws(() => new AcpMcpTool(" ", "t"), ArgumentException).parameterName);
    Assert.areEqual("tool", Assert.throws(() => new AcpMcpTool("s", ""), ArgumentException).parameterName);
  }

  @TestMethod
  public readsAServerAndToolOnlyWhenBothAreStringsThatArentBlank(): void {
    Assert.areEqual(JSON.stringify({ server: "teamrun", tool: "teamrun_list_chats" }), JSON.stringify(AcpMcpTool.of("teamrun", "teamrun_list_chats")));
    for (const [server, tool] of [[undefined, "t"], ["s", 42], [" ", "t"], ["s", ""], [null, null]] as const)
      Assert.isNull(AcpMcpTool.of(server, tool), `${server}:${tool}`);
  }

  @TestMethod
  public readsTheServerAndToolAtTheEndOfAPathOfObjectsAndNothingWhenAFieldOnTheWayIsMissingOrNotAnObject(): void {
    const read = (call: object): string => JSON.stringify(AcpMcpTool.read(JsonReader.fromValue(call), ["_meta", "mcp"], "server", "tool"));

    Assert.areEqual(JSON.stringify({ server: "teamrun", tool: "teamrun_list_chats" }), read({ _meta: { mcp: { server: "teamrun", tool: "teamrun_list_chats" } } }));
    for (const call of [{}, { _meta: null }, { _meta: [] }, { _meta: "mcp" }, { _meta: {} }, { _meta: { mcp: null } }, { _meta: { mcp: [] } }, { _meta: { mcp: 1 } },
      { _meta: { mcp: { server: "teamrun", tool: 1 } } }])
      Assert.areEqual("null", read(call), JSON.stringify(call));
  }
}
