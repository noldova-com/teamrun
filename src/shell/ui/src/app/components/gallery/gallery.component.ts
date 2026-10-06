/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { OverlayContainer } from "@angular/cdk/overlay";
import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, Injector, type Signal, computed, inject, input } from "@angular/core";

import { ThemeMode } from "../../enums/theme-mode";
import type { Theme } from "../../models/theme";
import { DefaultTheme } from "../../themes/default-theme";
import { GalleryContentComponent } from "./gallery-content.component";
import { GalleryFormsComponent } from "./gallery-forms.component";
import { GalleryNavigationComponent } from "./gallery-navigation.component";
import { GalleryOverlayContainer } from "./gallery-overlay-container";
import { GalleryOverlaysComponent } from "./gallery-overlays.component";
import { GalleryResources } from "./gallery-resources";
import { GalleryScopeDirective } from "./gallery-scope.directive";

interface GalleryScope {
  readonly id: string;
  readonly label: string;
  readonly theme: Theme;
  readonly mode: ThemeMode;
}

@Component({
  selector: "tr-gallery",
  imports: [GalleryContentComponent, GalleryFormsComponent, GalleryNavigationComponent, GalleryOverlaysComponent, GalleryScopeDirective, NgTemplateOutlet],
  templateUrl: "./gallery.component.html",
  styleUrl: "./gallery.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryComponent {
  private readonly parent: Injector = inject(Injector);
  private readonly injectors: WeakMap<HTMLElement, Injector> = new WeakMap<HTMLElement, Injector>();

  public readonly themes = input<readonly Theme[]>([DefaultTheme.theme]);
  public readonly scopes: Signal<readonly GalleryScope[]> = computed(() => this.themes().flatMap(theme => [ThemeMode.Light, ThemeMode.Dark].map(mode => ({
    id: `${theme.id}-${mode}`,
    label: GalleryResources.formatScope(theme.name, mode),
    theme,
    mode
  }))));

  protected injectorOf(frame: HTMLElement): Injector {
    let injector = this.injectors.get(frame);
    if (Object.isUndefined(injector)) {
      injector = Injector.create({ providers: [{ provide: OverlayContainer, useFactory: () => new GalleryOverlayContainer(frame) }], parent: this.parent });
      this.injectors.set(frame, injector);
    }
    return injector;
  }
}
