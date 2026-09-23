/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type OnInit, type WritableSignal, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";

import "@noldova/teamrun-foundation-core";

import { ClockChoice } from "../../enums/clock-choice";
import { OpenMode } from "../../enums/open-mode";
import { ImageOpenMode } from "../../enums/image-open-mode";
import type { DesktopInfo } from "../../models/desktop-info";
import { Resources } from "../../resources";
import { BridgeService } from "../../services/bridge.service";
import { ChatStore } from "../../services/chat-store.service";
import { DateFormatter } from "../../services/date-formatter.service";
import { PreferencesService } from "../../services/preferences.service";
import { SettingsRowComponent } from "../settings-row/settings-row.component";
import { SettingsConversationDefaultsComponent } from "../settings-conversation-defaults/settings-conversation-defaults.component";

@Component({
  selector: "tr-settings-general",
  imports: [FormsModule, MatButtonToggleModule, MatFormFieldModule, MatInputModule, SettingsRowComponent, SettingsConversationDefaultsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./settings-general.component.html"
})
export class SettingsGeneralComponent implements OnInit {
  protected readonly resources: typeof Resources = Resources;
  protected readonly store: ChatStore = inject(ChatStore);
  protected readonly preferences: PreferencesService = inject(PreferencesService);
  protected readonly dates: DateFormatter = inject(DateFormatter);
  protected readonly clocks: readonly ClockChoice[] = Object.values(ClockChoice);
  protected readonly openModes: readonly OpenMode[] = Object.values(OpenMode);
  protected readonly imageOpenModes: readonly ImageOpenMode[] = Object.values(ImageOpenMode);
  protected readonly now: string = new Date().toISOString();
  protected readonly info: WritableSignal<DesktopInfo | null> = signal(null);
  private readonly bridge: BridgeService = inject(BridgeService);

  public ngOnInit(): void {
    void this.bridge.describe().then(info => this.info.set(info));
  }
}
