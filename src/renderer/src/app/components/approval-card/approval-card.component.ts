/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";

import type { Approval } from "@noldova/teamrun-protocol";

import { Resources } from "../../resources";
import { ChatStore } from "../../services/chat-store.service";

@Component({
  selector: "tr-approval-card",
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./approval-card.component.html"
})
export class ApprovalCardComponent {
  public readonly approval = input.required<Approval>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly store: ChatStore = inject(ChatStore);
}
