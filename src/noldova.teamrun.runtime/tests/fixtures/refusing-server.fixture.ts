/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Server } from "node:http";

export class RefusingServer extends Server {
  public readonly failure: Error = new Error("Listening isn't allowed here.");

  public override listen(): this {
    queueMicrotask(() => this.emit("error", this.failure));
    return this;
  }
}
