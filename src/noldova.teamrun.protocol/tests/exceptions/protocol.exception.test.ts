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
export class ProtocolExceptionTests {
  @TestMethod
  public isTheBaseOfTheProtocolExceptions(): void {
    const exception = new McpRequestException(-32601, "TeamRun's MCP server has no method resources/list.");

    Assert.isInstanceOf(exception, ProtocolException);
    Assert.isInstanceOf(exception, Exception);
    Assert.isFalse(Object.hasOwn(exception, "cause"));
  }
}
