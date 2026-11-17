/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ITurnListener } from "@noldova/teamrun.core";
import type { Provider } from "@noldova/teamrun.protocol";
import { AcpAdapter, type AcpClient } from "@noldova/teamrun.providers";

export class FailureKeepingAcpAdapter extends AcpAdapter {
  public readonly failures: unknown[] = [];

  protected override reportPlanAfterFailure(_client: AcpClient, _provider: Provider | null, _listener: ITurnListener, error: unknown): Promise<void> {
    this.failures.push(error);
    return Promise.resolve();
  }
}
