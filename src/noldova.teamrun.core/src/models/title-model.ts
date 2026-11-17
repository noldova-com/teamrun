/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Provider } from "@noldova/teamrun.protocol";

export class TitleModel {
  public readonly provider: Provider | null;
  public readonly kind: string;
  public readonly model: string | null;

  public constructor(provider: Provider | null, kind: string, model: string | null) {
    this.provider = provider;
    this.kind = kind;
    this.model = model;
  }

  public isSameAs(other: TitleModel): boolean {
    return this.kind === other.kind && this.model === other.model && this.provider?.id === other.provider?.id;
  }
}
