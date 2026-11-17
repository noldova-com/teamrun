/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Provider, ProviderModel } from "@noldova/teamrun.protocol";

import type { IAcpModelStore } from "../../interfaces/i-acp-model-store.js";
import { AntigravityProfile } from "./antigravity-profile.js";

export class AntigravityModelStore implements IAcpModelStore {
  private readonly defaultProfileDirectory: string;
  private readonly tempRoot: string;

  public constructor(defaultProfileDirectory: string, tempRoot: string) {
    this.defaultProfileDirectory = defaultProfileDirectory;
    this.tempRoot = tempRoot;
  }

  public keep(provider: Provider | null, models: readonly ProviderModel[]): void {
    this.profile(provider).keepModels(models);
  }

  public read(provider: Provider | null): readonly ProviderModel[] | null {
    return this.profile(provider).readModels();
  }

  private profile(provider: Provider | null): AntigravityProfile {
    return new AntigravityProfile(provider?.profileDir ?? this.defaultProfileDirectory, this.tempRoot);
  }
}
