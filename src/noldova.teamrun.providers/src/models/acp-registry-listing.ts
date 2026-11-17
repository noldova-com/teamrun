/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AcpRegistry } from "./acp-registry.js";

export class AcpRegistryListing {
  public readonly registry: AcpRegistry;
  public readonly fetchedAt: Date;
  public readonly failure: string | null;

  public constructor(registry: AcpRegistry, fetchedAt: Date, failure: string | null = null) {
    this.registry = registry;
    this.fetchedAt = fetchedAt;
    this.failure = failure;
  }
}
