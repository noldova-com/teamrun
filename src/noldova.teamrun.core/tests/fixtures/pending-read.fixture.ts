/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProviderKindVersions } from "@noldova/teamrun.core";

export class PendingRead {
  public readonly checksLatest: boolean;
  public readonly promise: Promise<ProviderKindVersions>;
  private resolve: (versions: ProviderKindVersions) => void = () => undefined;
  private reject: (error: unknown) => void = () => undefined;

  public constructor(checksLatest: boolean) {
    this.checksLatest = checksLatest;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  public answer(versions: ProviderKindVersions): Promise<ProviderKindVersions> {
    this.resolve(versions);
    return this.promise;
  }

  public async fail(error: unknown): Promise<void> {
    this.reject(error);
    await this.promise.catch(() => undefined);
  }
}
