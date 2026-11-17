/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProtocolException } from "./protocol.exception.js";

export class McpRequestException extends ProtocolException {
  public override readonly name: string = "McpRequestException";
  public readonly code: number;

  public constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}
