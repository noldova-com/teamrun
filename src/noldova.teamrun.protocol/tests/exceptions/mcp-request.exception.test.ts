/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { McpRequestException, ProtocolException } from "@noldova/teamrun.protocol";

@TestClass
export class McpRequestExceptionTests {
  @TestMethod
  public carriesItsNameCodeAndMessageUnderTheProtocolBase(): void {
    const exception = new McpRequestException(-32601, "TeamRun's MCP server has no method resources/list.");

    Assert.isInstanceOf(exception, ProtocolException);
    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual("McpRequestException", exception.name);
    Assert.areEqual(-32601, exception.code);
    Assert.areEqual("TeamRun's MCP server has no method resources/list.", exception.message);
  }
}
