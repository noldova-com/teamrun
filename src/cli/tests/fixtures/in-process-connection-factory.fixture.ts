/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CliSettings, IConnectionFactory, IConnectionFactoryBuilder } from "@noldova/teamrun-cli";
import { ConnectionException, type IRuntimeClientListener, RuntimeClient, type RuntimeLock, type RuntimeService, RuntimeTimings } from "@noldova/teamrun-runtime";

export class InProcessConnectionFactory implements IConnectionFactory, IConnectionFactoryBuilder {
  private readonly service: RuntimeService;
  private readonly timings: RuntimeTimings = new RuntimeTimings(1000, 5000, 5000, 50);
  public readonly settings: CliSettings[] = [];
  public connectFailure: unknown = null;

  public constructor(service: RuntimeService) {
    this.service = service;
  }

  public build(settings: CliSettings): IConnectionFactory {
    this.settings.push(settings);
    return this;
  }

  public readLiveLock(): RuntimeLock | null {
    return this.service.lock;
  }

  public connect(listener: IRuntimeClientListener): Promise<RuntimeClient> {
    if (this.connectFailure !== null)
      return Promise.reject(this.connectFailure);
    const lock = this.service.lock;
    if (lock === null)
      return Promise.reject(new ConnectionException("The test runtime is not running.", null));

    return RuntimeClient.connect(lock.endpoint, lock.token, "test", listener, this.timings);
  }
}
