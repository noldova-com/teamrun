/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { JsonException, JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../../resources";
import { DockSide } from "../../enums/dock-side";
import { SplitAxis } from "../../enums/split-axis";
import { Dock } from "./dock";
import { DocumentGroup } from "./document-group";
import { DocumentTab } from "./document-tab";
import { Layout } from "./layout";
import type { LayoutNode } from "./layout.node";
import { SplitPart } from "./split-part";
import { SplitNode } from "./split.node";
import type { Tab } from "./tab";
import { TabGroup } from "./tab-group";
import { ViewTab } from "./view-tab";

export class LayoutReader {
  private nextId: number = Resources.documentsGroupId + 1;

  private constructor() {
  }

  public static read(value: unknown): Layout {
    return new LayoutReader().readLayout(JsonReader.fromValue(value));
  }

  private static construct<T>(json: JsonReader, create: () => T): T {
    try {
      return create();
    }
    catch (error) {
      throw new JsonException(Resources.invalidLayoutPart, json.path, new ExceptionOptions(error));
    }
  }

  private readLayout(json: JsonReader): Layout {
    const version = json.readInteger(Resources.versionField);
    if (version !== Resources.layoutFormatVersion)
      throw new JsonException(Resources.formatUnsupportedVersion(version), json.path);
    const docks = json.readObject(Resources.docksField);
    const read = Object.values(DockSide).map(t => this.readDock(t, docks.readObject(t)));
    const middle = this.readNode(json.readObject(Resources.middleField));
    return LayoutReader.construct(json, () => new Layout(read, middle));
  }

  private readDock(side: DockSide, json: JsonReader): Dock {
    const root = json.readNullableObject(Resources.rootField);
    const node = Object.isNull(root) ? null : this.readNode(root);
    const size = Object.isNull(json.readValue(Resources.sizeField)) ? null : json.readNumber(Resources.sizeField);
    const collapsed = json.readBoolean(Resources.collapsedField);
    return LayoutReader.construct(json, () => new Dock(side, node, size, collapsed));
  }

  private readNode(json: JsonReader): LayoutNode {
    if (json.hasField(Resources.childrenField))
      return this.readSplit(json);
    if (json.hasField(Resources.tabsField))
      return this.readGroup(json);
    throw new JsonException(Resources.unknownNode, json.path);
  }

  private readSplit(json: JsonReader): LayoutNode {
    const id = this.nextId++;
    const axis = json.readOneOf(Resources.axisField, Object.values(SplitAxis));
    const parts = json.readObjectArray(Resources.childrenField).map(t => new SplitPart(this.readNode(t), t.readNumber(Resources.weightField)));
    return LayoutReader.construct(json, () => new SplitNode(id, axis, parts));
  }

  private readGroup(json: JsonReader): TabGroup {
    const tabs = json.readObjectArray(Resources.tabsField).map(t => this.readTab(t));
    const index = json.readNullableInteger(Resources.activeField);
    const active = Object.isNull(index) ? null : tabs[index];
    if (Object.isUndefined(active))
      throw new JsonException(Resources.inactiveTab, json.path);
    const previewIndex = json.hasField(Resources.previewField) ? json.readNullableInteger(Resources.previewField) : null;
    const preview = Object.isNull(previewIndex) ? null : tabs[previewIndex];
    if (Object.isUndefined(preview))
      throw new JsonException(Resources.previewOutsideGroup, json.path);
    const isDocuments = json.hasField(Resources.documentsField) && json.readBoolean(Resources.documentsField);
    if (isDocuments)
      return LayoutReader.construct(json, () => new DocumentGroup(tabs, active, preview));
    const id = this.nextId++;
    return LayoutReader.construct(json, () => new TabGroup(id, tabs, active, preview));
  }

  private readTab(json: JsonReader): Tab {
    const instance = json.readOptionalString(Resources.instanceField);
    if (json.hasField(Resources.viewField)) {
      const name = json.readString(Resources.viewField);
      return LayoutReader.construct(json, () => new ViewTab(name, instance));
    }
    if (json.hasField(Resources.documentField)) {
      const name = json.readString(Resources.documentField);
      return LayoutReader.construct(json, () => new DocumentTab(name, instance));
    }
    throw new JsonException(Resources.unknownTab, json.path);
  }
}
