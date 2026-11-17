/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Provider, ProviderKind } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class ProviderChoice {
  public readonly key: string;
  public readonly kind: string;
  public readonly providerId: string;
  public readonly label: string;
  public readonly fullLabel: string;
  public readonly menuLabel: string;

  public constructor(kind: string, providerId: string, label: string, providerName: string) {
    this.key = JSON.stringify([kind, providerId]);
    this.kind = kind;
    this.providerId = providerId;
    this.label = Resources.formatLocalProvider(label);
    this.fullLabel = Resources.formatLocalProvider(Resources.formatProviderChoice(providerName, label));
    this.menuLabel = Resources.formatProviderChoice(label, providerName);
  }

  public static saved(providers: readonly Provider[], kinds: readonly ProviderKind[]): readonly ProviderChoice[] {
    return providers.map(t => ProviderChoice.ofProvider(t, kinds));
  }

  public static ofProvider(provider: Provider, kinds: readonly ProviderKind[]): ProviderChoice {
    return new ProviderChoice(provider.kind, provider.id, provider.label, kinds.find(t => t.id === provider.kind)?.displayName ?? provider.kind);
  }
}
