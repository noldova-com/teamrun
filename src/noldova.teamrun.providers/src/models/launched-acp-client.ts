/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AcpClient } from "../services/acp/acp-client.js";

export class LaunchedAcpClient {
  public readonly client: AcpClient;
  public readonly environment: NodeJS.ProcessEnv;

  public constructor(client: AcpClient, environment: NodeJS.ProcessEnv) {
    this.client = client;
    this.environment = environment;
  }
}
