/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component } from "@angular/core";

import { ReplyPanel } from "@noldova/teamrun-protocol";

import { ReplyHistoryComponent } from "../reply-history/reply-history.component";

@Component({
  selector: "tr-activity-panel",
  imports: [ReplyHistoryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./activity-panel.component.html"
})
export class ActivityPanelComponent {
  protected readonly panel = ReplyPanel.Activity;
}
