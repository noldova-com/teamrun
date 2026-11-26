/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { InvalidOperationException } from "../exceptions/invalid-operation.exception.js";
import { Resources } from "../resources.js";
import type { AcpClient } from "../services/acp/acp-client.js";

export class CurrentAcpClient {
  private value: AcpClient | null = null;

  public get client(): AcpClient {
    if (Object.isNull(this.value))
      throw new InvalidOperationException(Resources.acpClientNotStarted);
    return this.value;
  }

  public set(client: AcpClient): AcpClient {
    this.value = client;
    return client;
  }
}
