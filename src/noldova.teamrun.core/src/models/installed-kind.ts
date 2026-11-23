/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IProviderKindInstallation } from "../interfaces/i-provider-kind-installation.js";

export class InstalledKind {
  public readonly kind: string;
  public readonly installation: IProviderKindInstallation;

  public constructor(kind: string, installation: IProviderKindInstallation) {
    this.kind = kind;
    this.installation = installation;
  }
}
