/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, type Signal, computed, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatDividerModule } from "@angular/material/divider";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSelectModule } from "@angular/material/select";
import { MatTooltipModule } from "@angular/material/tooltip";

import "@noldova/teamrun-foundation-core";

import { ThemeScopeDirective } from "../../directives/theme-scope.directive";
import { InlineCodeDirective } from "../../directives/inline-code.directive";
import { Theme } from "../../models/theme";
import { ImageSource } from "../../models/image-source";
import { ImageOpenMode } from "../../enums/image-open-mode";
import { ImagePreviewComponent } from "../image-preview/image-preview.component";
import { ImageActionsComponent } from "../image-actions/image-actions.component";
import { Resources } from "../../resources";
import { SearchLauncher } from "../../services/search-launcher.service";
import { ThemeService } from "../../services/theme.service";
import { MarkdownComponent } from "../markdown/markdown.component";
import { RenameDialogComponent } from "../rename-dialog/rename-dialog.component";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";
import { TeammateDialogComponent } from "../teammate-dialog/teammate-dialog.component";
import { SettingsRowComponent } from "../settings-row/settings-row.component";
import { AppUpdatesComponent } from "../app-updates/app-updates.component";

@Component({
  selector: "tr-settings-gallery",
  imports: [
    ImageActionsComponent, AppUpdatesComponent,
    MatButtonModule, MatButtonToggleModule, MatCheckboxModule, MatDialogModule, MatDividerModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatMenuModule, MatProgressBarModule, MatProgressSpinnerModule, MatSelectModule, MatTooltipModule, NgTemplateOutlet,
    InlineCodeDirective, ImagePreviewComponent, MarkdownComponent, SettingsRowComponent, ThemeScopeDirective, TeammateAvatarComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./settings-gallery.component.html"
})
export class SettingsGalleryComponent {
  protected readonly imageOpenModes: readonly ImageOpenMode[] = Object.values(ImageOpenMode);
  protected readonly attachmentImage: ImageSource = new ImageSource(Resources.galleryAttachmentImage, Resources.galleryAttachmentImage,
    null, Resources.galleryAttachmentPreview);
  protected readonly resources: typeof Resources = Resources;
  protected readonly themes: ThemeService = inject(ThemeService);
  protected readonly search: SearchLauncher = inject(SearchLauncher);
  private readonly dialog: MatDialog = inject(MatDialog);

  protected readonly other: Signal<Theme> = computed(() => this.otherThan(this.themes.active()));

  private otherThan(active: Theme): Theme {
    const other = this.themes.themes.find(t => t.id !== active.id);
    return Object.isUndefined(other) ? active : other;
  }

  protected openDialog(): void {
    this.dialog.open<RenameDialogComponent, string, string>(RenameDialogComponent, { data: Resources.galleryDialogTitle, width: Resources.dialogWidth });
  }

  protected openTeammateDialog(): void {
    this.dialog.open(TeammateDialogComponent, { data: null, width: Resources.dialogWidth });
  }
}
