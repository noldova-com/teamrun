/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Server } from "node:http";

export class LocalServer {
  public static closeAsync(server: Server): Promise<void> {
    const closed = new Promise<void>(resolve => server.close(() => resolve()));
    server.closeAllConnections();
    return closed;
  }
}
