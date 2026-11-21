/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources";
import { OrganizationCardField } from "../enums/organization-card-field";
import { OrganizationViewMode } from "../enums/organization-view-mode";

export class OrganizationLayout {
  public static readonly defaultCardsShow: ReadonlySet<OrganizationCardField> = new Set([OrganizationCardField.Status, OrganizationCardField.Now]);

  public readonly collapsedDepartments: readonly string[];
  public readonly cardsShow: ReadonlySet<OrganizationCardField>;
  public readonly cards: ReadonlyMap<string, ReadonlySet<OrganizationCardField>>;
  public readonly view: OrganizationViewMode;
  public readonly focus: string | null;

  public constructor(collapsedDepartments: readonly string[] = [], cardsShow: ReadonlySet<OrganizationCardField> = OrganizationLayout.defaultCardsShow,
    cards: ReadonlyMap<string, ReadonlySet<OrganizationCardField>> = new Map(), view: OrganizationViewMode = OrganizationViewMode.Tree, focus: string | null = null) {
    this.collapsedDepartments = [...new Set(collapsedDepartments.filter(t => !String.isNullOrWhitespace(t)))];
    this.cardsShow = new Set(cardsShow);
    this.cards = new Map([...cards].filter(([teammateId]) => !String.isNullOrWhitespace(teammateId)).map(([teammateId, fields]) => [teammateId, new Set(fields)]));
    this.view = view;
    this.focus = focus === null || String.isNullOrWhitespace(focus) ? null : focus;
  }

  public static fromJson(value: unknown): OrganizationLayout {
    if (!Object.isObject(value) || Array.isArray(value))
      return new OrganizationLayout();
    const record: Record<string, unknown> = { ...value };
    const cards = OrganizationLayout.readRecord(record[Resources.organizationCardsField]);
    return new OrganizationLayout(OrganizationLayout.readIds(record[Resources.collapsedDepartmentsField]),
      Resources.organizationCardsShowField in record ? OrganizationLayout.readFields(record[Resources.organizationCardsShowField]) : OrganizationLayout.defaultCardsShow,
      new Map(Object.entries(cards).map(([teammateId, fields]) => [teammateId, OrganizationLayout.readFields(fields)])),
      OrganizationLayout.viewOf(record[Resources.organizationViewField]), OrganizationLayout.readFocus(record[Resources.organizationFocusField]));
  }

  public static viewOf(value: unknown): OrganizationViewMode {
    return Object.values(OrganizationViewMode).find(t => t === value) ?? OrganizationViewMode.Tree;
  }

  private static readFocus(value: unknown): string | null {
    return Object.isString(value) ? value : null;
  }

  private static readRecord(value: unknown): Record<string, unknown> {
    return Object.isObject(value) && !Array.isArray(value) ? { ...value } : {};
  }

  private static readFields(value: unknown): ReadonlySet<OrganizationCardField> {
    const fields: readonly string[] = Object.values(OrganizationCardField);
    return new Set(Object.entries(OrganizationLayout.readRecord(value)).filter(([, on]) => on === true).map(([name]) => name)
      .filter((t): t is OrganizationCardField => fields.includes(t)));
  }

  private static readIds(value: unknown): readonly string[] {
    return Array.isArray(value) ? value.filter(t => Object.isString(t)) : [];
  }

  private static writeFields(fields: ReadonlySet<OrganizationCardField>): JsonObject {
    return Object.fromEntries(Object.values(OrganizationCardField).map(t => [t, fields.has(t)]));
  }

  public toJson(): JsonObject {
    return {
      [Resources.collapsedDepartmentsField]: [...this.collapsedDepartments],
      [Resources.organizationCardsShowField]: OrganizationLayout.writeFields(this.cardsShow),
      [Resources.organizationCardsField]: Object.fromEntries([...this.cards].map(([teammateId, fields]) => [teammateId, OrganizationLayout.writeFields(fields)])),
      [Resources.organizationViewField]: this.view,
      [Resources.organizationFocusField]: this.focus
    };
  }

  public isCollapsed(departmentId: string): boolean {
    return this.collapsedDepartments.includes(departmentId);
  }

  public toggleDepartment(departmentId: string): OrganizationLayout {
    const others = this.collapsedDepartments.filter(t => t !== departmentId);
    return new OrganizationLayout(this.isCollapsed(departmentId) ? others : [...others, departmentId], this.cardsShow, this.cards, this.view, this.focus);
  }

  public withView(view: OrganizationViewMode): OrganizationLayout {
    return new OrganizationLayout(this.collapsedDepartments, this.cardsShow, this.cards, view, this.focus);
  }

  public withFocus(focus: string | null): OrganizationLayout {
    return new OrganizationLayout(this.collapsedDepartments, this.cardsShow, this.cards, this.view, focus);
  }

  public fieldsOf(teammateId: string): ReadonlySet<OrganizationCardField> {
    return this.cards.get(teammateId) ?? this.cardsShow;
  }

  public hasOwnFields(teammateId: string): boolean {
    return this.cards.has(teammateId);
  }

  public withCardsShow(field: OrganizationCardField, shown: boolean): OrganizationLayout {
    return new OrganizationLayout(this.collapsedDepartments, OrganizationLayout.switched(this.cardsShow, field, shown), this.cards, this.view, this.focus);
  }

  public withCardField(teammateId: string, field: OrganizationCardField, shown: boolean): OrganizationLayout {
    return new OrganizationLayout(this.collapsedDepartments, this.cardsShow,
      new Map([...this.cards, [teammateId, OrganizationLayout.switched(this.fieldsOf(teammateId), field, shown)]]), this.view, this.focus);
  }

  public withoutCardFields(teammateId: string): OrganizationLayout {
    return new OrganizationLayout(this.collapsedDepartments, this.cardsShow, new Map([...this.cards].filter(([id]) => id !== teammateId)), this.view, this.focus);
  }

  public withoutAnyCardFields(): OrganizationLayout {
    return new OrganizationLayout(this.collapsedDepartments, this.cardsShow, new Map(), this.view, this.focus);
  }

  private static switched(fields: ReadonlySet<OrganizationCardField>, field: OrganizationCardField, shown: boolean): ReadonlySet<OrganizationCardField> {
    const next = new Set(fields);
    if (shown)
      next.add(field);
    else
      next.delete(field);
    return next;
  }
}
