/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ProductIdentity from "../../packages/product-identity.ts";

export default interface IPackageSigning {
  readonly builderEnvironment: NodeJS.ProcessEnv;
  prepareAsync(): Promise<void>;
  finishAsync(packages: readonly string[]): Promise<string>;
  verifyAsync(packages: readonly string[], product: ProductIdentity): Promise<string>;
  disposeAsync(): Promise<void>;
}
