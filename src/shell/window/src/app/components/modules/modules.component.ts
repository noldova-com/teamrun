/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ErrorHandler,
  Injector,
  PendingTasks,
  type Signal,
  type WritableSignal,
  afterNextRender,
  computed,
  inject,
  signal
} from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { ModuleState, type ModuleStatus } from "@noldova/teamrun-shell-protocol";
import { TooltipDirective } from "@noldova/teamrun-shell-ui";

import type { ContributionGroup } from "../../models/modules/contribution-group";
import { ModuleOverview } from "../../models/modules/module-overview";
import { CommandService } from "../../services/command.service";
import { DesktopBridgeService } from "../../services/desktop-bridge.service";
import { ModuleSelectionService } from "../../services/module-selection.service";
import { SettingsService } from "../../services/settings.service";
import { WindowPartHostService } from "../../services/window-part-host.service";
import { Resources } from "../../../resources";
import { ModuleActionsComponent } from "../module-actions/module-actions.component";

@Component({
  selector: "tr-modules",
  imports: [ModuleActionsComponent, NgTemplateOutlet, TooltipDirective],
  templateUrl: "./modules.component.html",
  styleUrl: "./modules.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-modules"
  }
})
export class ModulesComponent {
  private readonly commands: CommandService = inject(CommandService);
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector: Injector = inject(Injector);
  private readonly modules: Signal<readonly ModuleStatus[]> = inject(WindowPartHostService).modules;
  private readonly selection: ModuleSelectionService = inject(ModuleSelectionService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly active: ModuleState = ModuleState.Active;
  protected readonly version: WritableSignal<string | null> = signal(null);
  protected readonly overview: Signal<ModuleOverview> = computed(() => new ModuleOverview(this.modules()));
  protected readonly current: Signal<ModuleStatus | null> = computed(() => this.overview().select(this.selection.selected()));

  public constructor() {
    const errors = inject(ErrorHandler);
    const bridge = inject(DesktopBridgeService);
    void inject(PendingTasks).run(() =>
      bridge.readBuildAsync().then(t => this.version.set(Resources.formatProductVersion(t.productVersion)), (error: unknown) => errors.handleError(error)));
  }

  protected labelOf(state: ModuleState): string {
    return Resources.moduleStateLabels[state];
  }

  protected select(id: string): void {
    this.selection.select(id);
  }

  protected follow(id: string): void {
    this.selection.select(id);
    afterNextRender(() => [...this.element.querySelectorAll<HTMLElement>(Resources.moduleSelector)].find(t => t.dataset[Resources.moduleData] === id)?.focus(),
      { injector: this.injector });
  }

  protected contributionsOf(module: ModuleStatus): readonly ContributionGroup[] {
    return ModuleOverview.listContributions(module, (kind, name) => this.titleOf(kind, name));
  }

  private titleOf(kind: string, name: string): string | null {
    if (kind === Resources.commandsKind)
      return this.commands.commands().find(t => t.name === name)?.title ?? null;
    if (kind === Resources.settingsKind)
      return this.settings.definitions().find(t => t.name.text === name)?.title ?? null;
    return null;
  }
}
