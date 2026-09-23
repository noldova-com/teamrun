/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";

import { FontChoice } from "../../enums/font-choice";
import { Resources } from "../../resources";
import { PreferencesService } from "../../services/preferences.service";
import { ThemeService } from "../../services/theme.service";
import { SettingsRowComponent } from "../settings-row/settings-row.component";

@Component({
  selector: "tr-settings-appearance",
  imports: [MatButtonToggleModule, MatFormFieldModule, MatSelectModule, SettingsRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./settings-appearance.component.html"
})
export class SettingsAppearanceComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly preferences: PreferencesService = inject(PreferencesService);
  protected readonly themeService: ThemeService = inject(ThemeService);
  protected readonly fonts: readonly FontChoice[] = Object.values(FontChoice);
  protected readonly sizes: readonly number[] = Resources.textSizeOptions;
}
