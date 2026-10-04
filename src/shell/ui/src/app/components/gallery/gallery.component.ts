/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, input } from "@angular/core";

import { ButtonVariant } from "../../enums/button-variant";
import { ThemeMode } from "../../enums/theme-mode";
import type { Theme } from "../../models/theme";
import { DefaultTheme } from "../../themes/default-theme";
import { ButtonComponent } from "../button/button.component";
import { GalleryFormsComponent } from "./gallery-forms.component";
import { GalleryNavigationComponent } from "./gallery-navigation.component";
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
  imports: [ButtonComponent, GalleryFormsComponent, GalleryNavigationComponent, GalleryOverlaysComponent, GalleryScopeDirective],
  templateUrl: "./gallery.component.html",
  styleUrl: "./gallery.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryComponent {
  protected readonly text: typeof GalleryResources.text = GalleryResources.text;
  protected readonly variants: typeof ButtonVariant = ButtonVariant;

  public readonly themes = input<readonly Theme[]>([DefaultTheme.theme]);
  public readonly scopes: Signal<readonly GalleryScope[]> = computed(() => this.themes().flatMap(theme => [ThemeMode.Light, ThemeMode.Dark].map(mode => ({
    id: `${theme.id}-${mode}`,
    label: GalleryResources.formatScope(theme.name, mode),
    theme,
    mode
  }))));

  protected focusFirst(scope: HTMLElement): void {
    (scope.querySelector(GalleryResources.focusableSelector) as HTMLElement).focus();
  }
}
