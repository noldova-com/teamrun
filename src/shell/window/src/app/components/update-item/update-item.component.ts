/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, inject } from "@angular/core";

import { UpdateAction } from "../../enums/update-action";
import { UpdateStateKind } from "../../enums/update-state-kind";
import type { UpdateState } from "../../models/update-state";
import { UpdateService } from "../../services/update.service";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-update-item",
  templateUrl: "./update-item.component.html",
  styleUrl: "./update-item.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdateItemComponent {
  private readonly updates: UpdateService = inject(UpdateService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly kinds: typeof UpdateStateKind = UpdateStateKind;
  protected readonly state: Signal<UpdateState> = this.updates.state;

  protected download(): void {
    this.updates.act(UpdateAction.Download);
  }

  protected restart(): void {
    this.updates.act(UpdateAction.Restart);
  }

  protected openAbout(): void {
    this.updates.openAbout();
  }
}
