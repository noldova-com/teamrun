/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive, type Signal, computed, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { ConfigurationTableComponent } from "./configuration-table.component";

@Directive({
  selector: "table[trConfigurationTable]",
  host: {
    "class": "tr-configuration-table-grid",
    "[attr.aria-label]": "name()"
  }
})
export class ConfigurationTableDirective {
  private readonly owner: ConfigurationTableComponent = inject(ConfigurationTableComponent);

  protected readonly name: Signal<string | null> = computed(() => [this.owner.heading(), this.owner.label()].find(t => !String.isNullOrEmpty(t)) ?? null);
}
