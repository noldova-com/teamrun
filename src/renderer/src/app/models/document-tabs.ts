/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources";

export class DocumentTabs {
  public readonly open: readonly string[];
  public readonly active: string | null;
  public readonly preview: string | null;

  public constructor(open: readonly string[], active: string | null, preview: string | null = null) {
    const unique = [...new Set(open.filter(t => !String.isNullOrWhitespace(t)))];
    this.open = unique;
    this.active = !Object.isNull(active) && unique.includes(active) ? active : unique[0] ?? null;
    this.preview = !Object.isNull(preview) && unique.includes(preview) ? preview : null;
  }

  public static createEmpty(): DocumentTabs {
    return new DocumentTabs([], null);
  }

  public static fromJson(value: unknown): DocumentTabs {
    if (!Object.isObject(value) || Array.isArray(value))
      return DocumentTabs.createEmpty();
    const record: Record<string, unknown> = { ...value };
    const listed = record[Resources.openField];
    const active = record[Resources.activeField];
    const preview = record[Resources.previewField];

    return new DocumentTabs(Array.isArray(listed) ? listed.filter((t): t is string => Object.isString(t)) : [], Object.isString(active) ? active : null,
      Object.isString(preview) ? preview : null);
  }

  public toJson(): Record<string, unknown> {
    return { [Resources.openField]: [...this.open], [Resources.activeField]: this.active, [Resources.previewField]: this.preview };
  }

  public show(conversationId: string, preview: boolean = false): DocumentTabs {
    if (this.open.includes(conversationId))
      return new DocumentTabs(this.open, conversationId, this.preview);
    if (!preview)
      return new DocumentTabs([...this.open, conversationId], conversationId, this.preview);
    const open = Object.isNull(this.preview) ? [...this.open, conversationId] : this.open.map(t => (t === this.preview ? conversationId : t));
    return new DocumentTabs(open, conversationId, conversationId);
  }

  public keepOpen(conversationId: string): DocumentTabs {
    return this.preview === conversationId ? new DocumentTabs(this.open, this.active, null) : this;
  }

  public close(conversationId: string): DocumentTabs {
    const index = this.open.indexOf(conversationId);
    if (index < 0)
      return this;
    const rest = this.open.filter(t => t !== conversationId);
    return new DocumentTabs(rest, this.active === conversationId ? rest[Math.min(index, rest.length - 1)] ?? null : this.active, this.preview);
  }

  public keep(existing: readonly string[]): DocumentTabs {
    const rest = this.open.filter(t => existing.includes(t));
    return rest.length === this.open.length ? this : new DocumentTabs(rest, this.active, this.preview);
  }
}
