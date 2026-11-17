/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgComponentOutlet } from "@angular/common";
import { Component, createEnvironmentInjector, DestroyRef, EnvironmentInjector, inject, type Type } from "@angular/core";

import { ReplyPanel } from "@noldova/teamrun.protocol";
import { provideCodeHighlighting } from "@noldova/ui.components.angular/code-highlighting";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";

import { Resources } from "../../../resources";
import { ReplyHistoryComponent } from "../reply-history/reply-history.component";

@Component({
  selector: "nol-teamrun-plan-view",
  imports: [NgComponentOutlet],
  templateUrl: "./plan-view.component.html",
  styleUrl: "../reply-view.css"
})
export class PlanViewComponent {
  protected readonly history: Type<ReplyHistoryComponent> = ReplyHistoryComponent;
  protected readonly inputs: Record<string, unknown> = { panel: ReplyPanel.Plan };
  protected readonly environment: EnvironmentInjector = createEnvironmentInjector([provideMarkdown(), provideCodeHighlighting({ preload: Resources.preloadedCodeLanguages })],
    inject(EnvironmentInjector));

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.environment.destroy());
  }
}
