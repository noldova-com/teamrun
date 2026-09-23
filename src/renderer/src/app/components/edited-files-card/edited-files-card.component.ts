/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, input } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";

import "@noldova/teamrun-foundation-core";
import type { FileChangeSummary } from "@noldova/teamrun-protocol";

import { DiffLineKind } from "../../enums/diff-line-kind";
import type { FileEdit } from "../../models/file-edit";
import type { DiffLine } from "../../models/diff-line";
import { ReplyExpansion } from "../../models/reply-expansion";
import { Resources } from "../../resources";

@Component({
  selector: "tr-edited-files-card",
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./edited-files-card.component.html"
})
export class EditedFilesCardComponent {
  public readonly edits = input.required<readonly (FileEdit | FileChangeSummary)[]>();
  public readonly fullEdits = input<readonly FileEdit[] | null>(null);
  public readonly expansion = input(new ReplyExpansion());
  public readonly beforeExpand = input<(() => Promise<boolean>) | null>(null);
  public readonly rootPath = input<string | null>(null);

  protected readonly resources: typeof Resources = Resources;
  protected readonly added: DiffLineKind = DiffLineKind.Added;
  protected readonly removed: DiffLineKind = DiffLineKind.Removed;
  protected readonly meta: DiffLineKind = DiffLineKind.Meta;

  protected readonly title: Signal<string> = computed(() => Resources.formatEditedFiles(this.edits().length));
  protected readonly additions: Signal<number> = computed(() => this.edits().reduce((sum, t) => sum + t.additions, 0));
  protected readonly deletions: Signal<number> = computed(() => this.edits().reduce((sum, t) => sum + t.deletions, 0));
  protected readonly shown: Signal<readonly (FileEdit | FileChangeSummary)[]> = computed(() => this.expansion().allFiles() ? this.edits() : this.edits().slice(0, Resources.shownFileCount));
  protected readonly hidden: Signal<number> = computed(() => this.edits().length - this.shown().length);

  protected isOpen(path: string): boolean {
    return this.expansion().files().has(path);
  }

  protected async toggle(path: string): Promise<void> {
    const load = this.beforeExpand();
    if (!this.isOpen(path) && !Object.isNull(load) && !await load())
      return;
    this.expansion().files.update(current => {
      const next = new Set(current);
      if (!next.delete(path))
        next.add(path);
      return next;
    });
  }

  protected isWrapped(path: string): boolean {
    return this.expansion().wrappedFiles().has(path);
  }

  protected toggleWrap(path: string): void {
    this.expansion().wrappedFiles.update(current => {
      const next = new Set(current);
      if (!next.delete(path))
        next.add(path);
      return next;
    });
  }

  protected directoryOf(path: string): string {
    const relative = this.relativeOf(path);
    const index = Math.max(relative.lastIndexOf(Resources.slash), relative.lastIndexOf(Resources.backslash));
    return index < 0 ? String.empty : relative.slice(0, index + 1);
  }

  protected linesOf(path: string): readonly DiffLine[] {
    const edit = this.fullEdits()?.find(t => t.path === path) ?? this.edits().find(t => t.path === path);
    return !Object.isUndefined(edit) && "lines" in edit ? edit.lines : [];
  }

  protected fileNameOf(path: string): string {
    return this.relativeOf(path).slice(this.directoryOf(path).length);
  }

  private relativeOf(path: string): string {
    const root = this.rootPath();
    if (Object.isNull(root) || String.isNullOrWhitespace(root) || !path.startsWith(root))
      return path;

    const rest = path.slice(root.length);
    return rest.startsWith(Resources.slash) || rest.startsWith(Resources.backslash) ? rest.slice(1) : rest;
  }

  protected prefixOf(kind: DiffLineKind): string {
    switch (kind) {
      case DiffLineKind.Added:
        return Resources.diffAddedPrefix;
      case DiffLineKind.Removed:
        return Resources.diffRemovedPrefix;
      case DiffLineKind.Context:
        return Resources.diffContextPrefix;
      default:
        return String.empty;
    }
  }
}
