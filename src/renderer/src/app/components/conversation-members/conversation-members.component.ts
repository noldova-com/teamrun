/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatTooltipModule } from "@angular/material/tooltip";
import "@noldova/teamrun-foundation-core";
import { type Teammate } from "@noldova/teamrun-protocol";
import { Resources } from "../../resources";
import { ChatStore } from "../../services/chat-store.service";
import { Formatter } from "../../services/formatter.service";
import { PreferencesService } from "../../services/preferences.service";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";

@Component({
  selector: "tr-conversation-members",
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, TeammateAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./conversation-members.component.html"
})
export class ConversationMembersComponent {
  protected readonly resources = Resources;
  protected readonly store = inject(ChatStore);
  private readonly formatter = inject(Formatter);
  private readonly preferences = inject(PreferencesService);
  protected readonly members = computed(() => this.store.membersOf(this.store.selectedConversationId())
    .map(t => this.store.teammate(t.teammateId)).filter((t): t is Teammate => !Object.isNull(t)));
  protected readonly others = computed(() => this.store.teammates().filter(t => !this.members().some(member => member.id === t.id)));
  protected readonly defaultDescription = computed(() => {
    const id = this.store.selectedConversationId();
    const settings = Object.isNull(id) ? null : this.preferences.composerFor(id) ?? this.preferences.defaultComposer();
    return [Resources.defaultTeammateLabel, this.formatter.providerName(settings?.provider ?? this.store.providers()[0]?.id ?? null, this.store.providers()),
      settings?.model ?? Resources.providerDefaultModel, settings?.effort ?? Resources.providerDefaultEffort].join(Resources.titleSeparator);
  });

  protected description(teammate: Teammate): string {
    return [teammate.name, this.formatter.teammateSummary(teammate, this.store.accounts(), this.store.providers()),
      ...(this.store.isTeammateUnavailable(teammate.id) ? [Resources.unavailableTeammateLabel] : [])].join(Resources.titleSeparator);
  }
}
