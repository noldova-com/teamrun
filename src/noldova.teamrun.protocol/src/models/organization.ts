/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader, type JsonObject } from "@noldova/context.json";

import { OrganizationNodeKind } from "../enums/organization-node-kind.js";
import { OrganizationTargetKind } from "../enums/organization-target-kind.js";
import { Resources } from "../resources.js";
import { Department } from "./department.js";
import { DepartmentMember } from "./department-member.js";
import { OrganizationParent } from "./organization-parent.js";
import type { OrganizationTarget } from "./organization-target.js";
import { TeammatePlacement } from "./teammate-placement.js";

export class Organization {
  public readonly id: string;
  public readonly name: string;
  public readonly folder: string | null;
  public readonly order: number;
  public readonly createdAt: string;
  public readonly updatedAt: string;
  public readonly departments: readonly Department[];
  public readonly placements: readonly TeammatePlacement[];

  public constructor(
    id: string,
    name: string,
    folder: string | null,
    order: number,
    createdAt: string,
    updatedAt: string,
    departments: readonly Department[],
    placements: readonly TeammatePlacement[]) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    Organization.validateName(name);
    Organization.validateFolder(folder);
    if (!Number.isSafeInteger(order) || order < 0)
      throw new ArgumentException(Resources.invalidOrganizationListOrder, Resources.orderField);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);
    ArgumentException.throwIfNullOrWhitespace(updatedAt, Resources.updatedAtField);
    const ids = new Set(departments.map(t => t.id));
    if (ids.size !== departments.length)
      throw new ArgumentException(Resources.duplicateDepartment, Resources.departmentsField);
    const placed = new Set(placements.map(t => t.teammateId));
    if (placed.size !== placements.length)
      throw new ArgumentException(Resources.teammatePlacedTwice, Resources.placementsField);

    this.id = id;
    this.name = name;
    this.folder = folder;
    this.order = order;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.departments = [...departments].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
    this.placements = [...placements].sort((a, b) => a.order - b.order || a.teammateId.localeCompare(b.teammateId));
    if ([...departments.map(t => t.parent), ...placements.map(t => t.parent)].some(t => !this.has(t)))
      throw new ArgumentException(Resources.unknownOrganizationParent, Resources.parentField);
    const nodes = [...departments.map(t => OrganizationParent.department(t.id)), ...placements.map(t => OrganizationParent.teammate(t.teammateId))];
    if (nodes.some(t => this.isUnder(this.parentOf(t), t)))
      throw new ArgumentException(Resources.organizationNodeUnderItself, Resources.parentField);
  }

  public get members(): readonly DepartmentMember[] {
    return this.placements.filter(t => t.parent.kind === OrganizationNodeKind.Department)
      .map(t => new DepartmentMember(t.teammateId, String(t.parent.id)));
  }

  public get leaders(): readonly string[] {
    const parents = [...this.departments.map(t => t.parent), ...this.placements.map(t => t.parent)]
      .filter(t => t.kind === OrganizationNodeKind.Teammate).map(t => String(t.id));
    const leaders = this.departments.map(t => t.leaderId).filter((t): t is string => !Object.isNull(t));
    return [...new Set([...leaders, ...this.placements.map(t => t.teammateId).filter(t => parents.includes(t))])];
  }

  public departmentsUnder(parent: OrganizationParent): readonly Department[] {
    return this.departments.filter(t => t.parent.equals(parent));
  }

  public placementsUnder(parent: OrganizationParent): readonly TeammatePlacement[] {
    return this.placements.filter(t => t.parent.equals(parent));
  }

  public childrenOf(parent: OrganizationParent): readonly OrganizationParent[] {
    return [...this.departmentsUnder(parent).map(t => OrganizationParent.department(t.id)),
      ...this.placementsUnder(parent).map(t => OrganizationParent.teammate(t.teammateId))];
  }

  public parentOf(node: OrganizationParent): OrganizationParent | null {
    switch (node.kind) {
      case OrganizationNodeKind.Department:
        return this.departments.find(t => t.id === node.id)?.parent ?? null;
      case OrganizationNodeKind.Teammate:
        return this.placements.find(t => t.teammateId === node.id)?.parent ?? null;
      default:
        return null;
    }
  }

  public pathOf(node: OrganizationParent): readonly OrganizationParent[] {
    const path: OrganizationParent[] = [];
    for (let current: OrganizationParent | null = node; !Object.isNull(current) && current.kind !== OrganizationNodeKind.Person; current = this.parentOf(current))
      path.unshift(current);
    return path;
  }

  public unplaced(teammateIds: readonly string[]): readonly string[] {
    return teammateIds.filter(t => !this.placements.some(u => u.teammateId === t));
  }

  public departmentOf(teammateId: string): string | null {
    return this.pathOf(OrganizationParent.teammate(teammateId)).findLast(t => t.kind === OrganizationNodeKind.Department)?.id ?? null;
  }

  public managerOf(teammateId: string): string | null {
    for (let current = this.parentOf(OrganizationParent.teammate(teammateId)); !Object.isNull(current); current = this.parentOf(current)) {
      if (current.kind === OrganizationNodeKind.Teammate)
        return current.id;
      const departmentId = current.id;
      const leaderId = this.departments.find(t => t.id === departmentId)?.leaderId ?? null;
      if (!Object.isNull(leaderId) && leaderId !== teammateId)
        return leaderId;
    }
    return null;
  }

  public moveError(node: OrganizationParent, parent: OrganizationParent): string | null {
    if (node.kind === OrganizationNodeKind.Person)
      return Resources.personCannotMove;
    if (!this.has(parent))
      return Resources.unknownOrganizationParent;
    return node.equals(parent) || this.isUnder(parent, node) ? Resources.organizationNodeUnderItself : null;
  }

  public recipientsOf(target: OrganizationTarget, teammateIds: readonly string[]): readonly string[] {
    const placed = new Set(this.placements.map(t => t.teammateId));
    const members = teammateIds.filter(t => placed.has(t));
    switch (target.kind) {
      case OrganizationTargetKind.Teammate:
        return members.filter(t => t === target.id);
      case OrganizationTargetKind.Department: {
        const leaderId = this.departments.find(t => t.id === target.id)?.leaderId ?? null;
        const inside = members.filter(t => this.departmentOf(t) === target.id);
        return [...inside.filter(t => t === leaderId), ...inside.filter(t => t !== leaderId)];
      }
      case OrganizationTargetKind.Leaders: {
        const leaders = this.leaders.filter(t => members.includes(t));
        const reports = this.placementsUnder(OrganizationParent.person).map(t => t.teammateId);
        return [...leaders, ...members.filter(t => reports.includes(t) && !leaders.includes(t))];
      }
      default:
        return members;
    }
  }

  public withTree(departments: readonly Department[], placements: readonly TeammatePlacement[]): Organization {
    return new Organization(this.id, this.name, this.folder, this.order, this.createdAt, this.updatedAt, departments, placements);
  }

  public static validateName(name: string): void {
    if (!Organization.allowsName(name))
      throw new ArgumentException(Resources.invalidOrganizationName, Resources.nameField);
  }

  public static readName(reader: JsonReader): string {
    const name = reader.readString(Resources.nameField);
    if (!Organization.allowsName(name))
      throw new JsonException(Resources.invalidOrganizationName, `${reader.path}.${Resources.nameField}`);
    return name;
  }

  public static validateFolder(folder: string | null): void {
    if (!Object.isNull(folder))
      ArgumentException.throwIfNullOrWhitespace(folder, Resources.folderField);
  }

  public static readFolder(reader: JsonReader): string | null {
    const folder = reader.readNullableString(Resources.folderField);
    if (!Object.isNull(folder) && folder.trim().length === 0)
      throw new JsonException(Resources.blankOrganizationFolder, `${reader.path}.${Resources.folderField}`);
    return folder;
  }

  public static fromJson(value: unknown, path?: string): Organization {
    const reader = JsonReader.fromValue(value, path);
    return new Organization(
      reader.readNonBlankString(Resources.idField),
      Organization.readName(reader),
      Organization.readFolder(reader),
      reader.readInteger(Resources.orderField),
      reader.readNonBlankString(Resources.createdAtField),
      reader.readNonBlankString(Resources.updatedAtField),
      reader.readObjectArray(Resources.departmentsField).map(t => Department.fromJson(t.toJson(), t.path)),
      reader.readObjectArray(Resources.placementsField).map(t => TeammatePlacement.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.nameField]: this.name,
      [Resources.folderField]: this.folder,
      [Resources.orderField]: this.order,
      [Resources.createdAtField]: this.createdAt,
      [Resources.updatedAtField]: this.updatedAt,
      [Resources.departmentsField]: this.departments.map(t => t.toJson()),
      [Resources.placementsField]: this.placements.map(t => t.toJson())
    };
  }

  private static allowsName(name: string): boolean {
    return Resources.departmentNamePattern.test(name) && name.trim().length > 0;
  }

  private has(parent: OrganizationParent): boolean {
    switch (parent.kind) {
      case OrganizationNodeKind.Department:
        return this.departments.some(t => t.id === parent.id);
      case OrganizationNodeKind.Teammate:
        return this.placements.some(t => t.teammateId === parent.id);
      default:
        return true;
    }
  }

  private isUnder(start: OrganizationParent | null, node: OrganizationParent): boolean {
    const seen: OrganizationParent[] = [];
    let current = start;
    while (!Object.isNull(current) && !current.equals(node)) {
      const step = current;
      if (seen.some(t => t.equals(step)))
        return false;
      seen.push(step);
      current = this.parentOf(step);
    }
    return !Object.isNull(current);
  }
}
