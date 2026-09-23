/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import type { Shortcut } from "../../models/shortcut";
import { Resources } from "../../resources";
import { ShortcutsService } from "../../services/shortcuts.service";
import { SettingsRowComponent } from "../settings-row/settings-row.component";

@Component({
  selector: "tr-settings-shortcuts",
  imports: [SettingsRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./settings-shortcuts.component.html"
})
export class SettingsShortcutsComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly shortcuts: ShortcutsService = inject(ShortcutsService);
  protected readonly global: readonly Shortcut[] = Resources.shortcuts.filter(t => t.global);
  protected readonly composer: readonly Shortcut[] = Resources.shortcuts.filter(t => !t.global);
}
