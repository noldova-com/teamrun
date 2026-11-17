/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import {
  DetailKind, Message, MessageAuthor, MessageDetail, MessageStatus, ObservedSettings, Provenance, RequestedSettings
} from "@noldova/teamrun.protocol";

import { Resources } from "../../../resources";
import { HistoryMessageComponent } from "../history-message/history-message.component";

@Component({
  selector: "nol-teamrun-history-warm-up",
  imports: [HistoryMessageComponent],
  host: { "aria-hidden": "true", "inert": "" },
  templateUrl: "./history-warm-up.component.html",
  styleUrl: "./history-warm-up.component.css"
})
export class HistoryWarmUpComponent {
  protected readonly messages: readonly Message[] = HistoryWarmUpComponent.create();

  private static create(): readonly Message[] {
    const id = Resources.historyWarmUpTag;
    const at = new Date(0).toISOString();
    const provenance = new Provenance(null, new RequestedSettings(id, null, null), new ObservedSettings(null, null, null, null), null, false);
    return [
      new Message(`${id}-0`, id, 0, MessageAuthor.User, null, MessageStatus.Completed, [new MessageDetail(0, DetailKind.Text, Resources.historyWarmUpQuestion, null, at)], null,
        at, null, at),
      new Message(`${id}-1`, id, 1, MessageAuthor.Provider, `${id}-0`, MessageStatus.Completed, [new MessageDetail(0, DetailKind.Text, Resources.historyWarmUpReply, null, at)],
        provenance, at, at, at)
    ];
  }
}
