/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, ViewEncapsulation, computed, contentChildren, input } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../../resources";
import { ConfigurationTableActionDirective } from "./configuration-table-action.directive";

@Component({
  selector: "tr-configuration-table",
  templateUrl: "./configuration-table.component.html",
  styleUrl: "./configuration-table.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    "class": "tr-configuration-table"
  }
})
export class ConfigurationTableComponent {
  private readonly actions: Signal<readonly ConfigurationTableActionDirective[]> = contentChildren(ConfigurationTableActionDirective);

  protected readonly hasHeader: Signal<boolean> = computed(() => !String.isNullOrEmpty(this.heading()) || this.actions().length > 0);
  protected readonly isExplanationLeading: Signal<boolean> = computed(() => String.isNullOrEmpty(this.heading()) && this.actions().length > 0 && !String.isNullOrEmpty(this.explanation()));

  public readonly heading = input<string>(String.empty);
  public readonly label = input<string>(String.empty);
  public readonly level = input<number>(Resources.configurationTableHeadingLevel);
  public readonly explanation = input<string>(String.empty);
}
