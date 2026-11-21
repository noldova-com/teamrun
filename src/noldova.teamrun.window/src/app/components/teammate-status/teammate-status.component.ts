/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, type InputSignal, input, type Signal } from "@angular/core";

import { Resources } from "../../../resources";
import type { TeammateStatus } from "../../enums/teammate-status";
import { TeammateStatusStoreService } from "../../services/teammate-status-store.service";

@Component({
  selector: "nol-teamrun-teammate-status",
  providers: [TeammateStatusStoreService.provider],
  host: { "class": "nol-teamrun-teammate-status", "[class.waiting]": "tone() === 'waiting'", "[class.stopped]": "tone() === 'stopped'" },
  templateUrl: "./teammate-status.component.html",
  styleUrl: "./teammate-status.component.css"
})
export class TeammateStatusComponent {
  private readonly statuses: TeammateStatusStoreService = inject(TeammateStatusStoreService);

  public readonly teammateId: InputSignal<string> = input<string>(String.empty);
  public readonly status: InputSignal<TeammateStatus | null> = input<TeammateStatus | null>(null);

  protected readonly shown: Signal<TeammateStatus> = computed(() => this.status() ?? this.statuses.statusOf(this.teammateId())());
  protected readonly label: Signal<string> = computed(() => Resources.teammateStatusLabels[this.shown()]);
  protected readonly tone: Signal<string> = computed(() => Resources.teammateStatusTones[this.shown()]);
  protected readonly dot: Signal<string> = computed(() => `dot ${this.tone()}`);
}
