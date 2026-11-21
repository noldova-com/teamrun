/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, inject, input, type InputSignal, type Signal } from "@angular/core";

import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";

import { Resources } from "../../../resources";
import { TeammateWorkReader } from "../../services/teammate-work-reader";

@Component({
  selector: "nol-teamrun-teammate-work-summary",
  template: "{{ text() }}"
})
export class TeammateWorkSummaryComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly reader: Signal<TeammateWorkReader> = computed(() => new TeammateWorkReader(this.context, this.teammateId()));

  public readonly teammateId: InputSignal<string> = input.required<string>();

  protected readonly text: Signal<string> = computed(() => {
    const reader = this.reader();
    return Resources.formatTeammateWorkSummary(reader.pullRequests().items.length, reader.work()?.documents.length ?? 0, reader.artifacts().length,
      reader.git().status?.branch ?? null);
  });

  public constructor() {
    effect(onCleanup => {
      const reader = this.reader();
      onCleanup(() => reader.stop());
    });
  }
}
