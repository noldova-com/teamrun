/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { Resources } from "../../resources";
import { ThemeService } from "../../services/theme.service";

@Component({
  selector: "tr-brand-mark",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "inline-flex shrink-0" },
  templateUrl: "./brand-mark.component.html"
})
export class BrandMarkComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly theme: ThemeService = inject(ThemeService);
}
