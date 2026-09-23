/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import "@noldova/teamrun-foundation-core";
import type { Teammate } from "@noldova/teamrun-protocol";
import { AppView } from "../../enums/app-view";
import { Resources } from "../../resources";
import { ChatStore } from "../../services/chat-store.service";
import { Formatter } from "../../services/formatter.service";
import { NavigationService } from "../../services/navigation.service";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";

@Component({
  selector: "tr-teammates-panel",
  imports: [TeammateAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./teammates-panel.component.html"
})
export class TeammatesPanelComponent {
  protected readonly resources = Resources;
  protected readonly store = inject(ChatStore);
  protected readonly formatter = inject(Formatter);
  private readonly navigation = inject(NavigationService);
  protected readonly activeConversation = computed(() => this.navigation.view() === AppView.Chat ? this.store.selectedConversationId() : null);
  protected readonly members = computed(() => this.store.membersOf(this.activeConversation())
    .map(t => this.store.teammate(t.teammateId)).filter((t): t is Teammate => !Object.isNull(t)));

  protected summary(teammate: Teammate): string {
    return [teammate.name, this.formatter.teammateSummary(teammate, this.store.accounts(), this.store.providers())].join(Resources.titleSeparator);
  }
}
