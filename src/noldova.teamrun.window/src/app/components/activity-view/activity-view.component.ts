/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";

import { ReplyPanel } from "@noldova/teamrun.protocol";

import { ReplyHistoryComponent } from "../reply-history/reply-history.component";

@Component({
  selector: "nol-teamrun-activity-view",
  imports: [ReplyHistoryComponent],
  templateUrl: "./activity-view.component.html",
  styleUrl: "../reply-view.css"
})
export class ActivityViewComponent {
  protected readonly panel: ReplyPanel = ReplyPanel.Activity;
}
