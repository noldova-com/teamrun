/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, inject } from "@angular/core";

import { ButtonComponent, ButtonVariant } from "@noldova/teamrun-shell-ui";

import { StartupStateKind } from "../../enums/startup-state-kind";
import type { StartupState } from "../../models/startup-state";
import { StartupService } from "../../services/startup.service";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-startup",
  imports: [ButtonComponent],
  templateUrl: "./startup.component.html",
  styleUrl: "./startup.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StartupComponent {
  private readonly startup: StartupService = inject(StartupService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly kinds: typeof StartupStateKind = StartupStateKind;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly state: Signal<StartupState> = this.startup.state;
  protected readonly isActing: Signal<boolean> = this.startup.isActing;

  protected act(action: string): void {
    void this.startup.actAsync(action);
  }
}
