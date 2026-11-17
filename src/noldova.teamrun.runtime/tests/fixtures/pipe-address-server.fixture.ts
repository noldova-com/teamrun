/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Server } from "node:http";

export class PipeAddressServer extends Server {
  public override address(): string {
    return "teamrun.sock";
  }
}
