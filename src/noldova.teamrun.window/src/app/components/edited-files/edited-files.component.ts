/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, input, type InputSignal, type Signal } from "@angular/core";
import "@noldova/context.core";
import { type DiffLine, DiffLineKind, type FileChangeSummary, type FileEdit } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, FileBadgeComponent, IconButtonComponent, TooltipDirective } from "@noldova/ui.components.angular";

import { ReplyExpansion } from "../../models/reply-expansion";
import { FormatterService } from "../../services/formatter.service";
import { Resources } from "../../../resources";

@Component({
  selector: "nol-teamrun-edited-files",
  imports: [ButtonComponent, FileBadgeComponent, IconButtonComponent, TooltipDirective],
  templateUrl: "./edited-files.component.html",
  styleUrl: "./edited-files.component.css"
})
export class EditedFilesComponent {
  public readonly edits: InputSignal<readonly (FileEdit | FileChangeSummary)[]> =
    input.required<readonly (FileEdit | FileChangeSummary)[]>();
  public readonly fullEdits: InputSignal<readonly FileEdit[] | null> = input<readonly FileEdit[] | null>(null);
  public readonly expansion: InputSignal<ReplyExpansion> = input(new ReplyExpansion());
  public readonly beforeExpand: InputSignal<(() => Promise<boolean>) | null> = input<(() => Promise<boolean>) | null>(null);
  public readonly rootPath: InputSignal<string | null> = input<string | null>(null);

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly added: DiffLineKind = DiffLineKind.Added;
  protected readonly removed: DiffLineKind = DiffLineKind.Removed;
  protected readonly meta: DiffLineKind = DiffLineKind.Meta;
  protected readonly formatter: FormatterService = inject(FormatterService);
  protected readonly title: Signal<string> = computed(() => Resources.formatActivitySummary(this.formatter.fileChangeParts(this.edits().map(t => t.kind))));
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
    this.expansion().files.update(t => EditedFilesComponent.toggled(t, path));
  }

  protected isWrapped(path: string): boolean {
    return this.expansion().wrappedFiles().has(path);
  }

  protected toggleWrap(path: string): void {
    this.expansion().wrappedFiles.update(t => EditedFilesComponent.toggled(t, path));
  }

  protected showAll(): void {
    this.expansion().allFiles.set(true);
  }

  protected directoryOf(path: string): string {
    const relative = this.relativeOf(path);
    const index = Math.max(relative.lastIndexOf(Resources.slash), relative.lastIndexOf(Resources.backslash));
    return index < 0 ? String.empty : relative.slice(0, index + 1);
  }

  protected fileNameOf(path: string): string {
    return this.relativeOf(path).slice(this.directoryOf(path).length);
  }

  protected linesOf(path: string): readonly DiffLine[] {
    const edit = this.fullEdits()?.find(t => t.path === path) ?? this.edits().find(t => t.path === path);
    return !Object.isUndefined(edit) && "lines" in edit ? edit.lines : [];
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

  private relativeOf(path: string): string {
    const root = this.rootPath();
    if (Object.isNull(root) || String.isNullOrWhitespace(root) || !path.startsWith(root))
      return path;
    const rest = path.slice(root.length);
    if (EditedFilesComponent.endsInSeparator(root))
      return rest;
    return rest.startsWith(Resources.slash) || rest.startsWith(Resources.backslash) ? rest.slice(1) : path;
  }

  private static endsInSeparator(path: string): boolean {
    return path.endsWith(Resources.slash) || path.endsWith(Resources.backslash);
  }

  private static toggled(current: ReadonlySet<string>, path: string): ReadonlySet<string> {
    const next = new Set(current);
    if (!next.delete(path))
      next.add(path);
    return next;
  }
}
