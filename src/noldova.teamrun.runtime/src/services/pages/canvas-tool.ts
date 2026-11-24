/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";

import { type IToolHandler, type ToolCall, ToolContent, ToolFailure, ToolFailureCode, ToolFailureException, ToolResult } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { CanvasPage, type Page } from "@noldova/teamrun.protocol";

import { PageException } from "../../exceptions/pages/page.exception.js";
import type { IPagesHost } from "../../interfaces/pages/i-pages-host.js";
import { ArtboardPlace } from "../../models/pages/artboard-place.js";
import { CanvasArtboardChange } from "../../models/pages/canvas-artboard-change.js";
import type { CanvasContent } from "../../models/pages/canvas-content.js";
import type { CanvasRevision } from "../../models/pages/canvas-revision.js";
import { PageTextEdit } from "../../models/pages/page-text-edit.js";
import type { CanvasStore } from "./canvas-store.js";
import { PagesResources } from "./pages-resources.js";

export class CanvasTool implements IToolHandler {
  private readonly moduleId: string;
  private readonly name: string;
  private readonly store: CanvasStore;
  private readonly host: IPagesHost;
  private readonly changed: (canvas: Page, isShown: boolean) => void;

  public constructor(moduleId: string, name: string, store: CanvasStore, host: IPagesHost, changed: (canvas: Page, isShown: boolean) => void) {
    this.moduleId = moduleId;
    this.name = name;
    this.store = store;
    this.host = host;
    this.changed = changed;
  }

  public async handleAsync(call: ToolCall): Promise<ToolResult> {
    try {
      return new ToolResult([ToolContent.fromText(JSON.stringify(await this.runAsync(call)), PagesResources.formatToolOrigin(this.moduleId, this.name))]);
    }
    catch (error) {
      throw new ToolFailureException(CanvasTool.failureOf(error));
    }
  }

  private async runAsync(call: ToolCall): Promise<JsonObject> {
    const chatId = this.host.chatOf(call);
    const input = JsonReader.fromValue(call.arguments);
    const writing = (): void => call.markSending();
    switch (this.name) {
      case PagesResources.createCanvasTool:
        return this.changedTo(await this.store.createAsync(chatId, this.host.folderOf(call), this.host.authorOf(call), input.readNonBlankString(PagesResources.titleArgument),
          input.hasField(PagesResources.pageNamesArgument) ? input.readStringArray(PagesResources.pageNamesArgument) : [], writing), true);
      case PagesResources.readCanvasTool:
        return CanvasTool.contentJson(await this.store.readAsync(chatId, input.readNonBlankString(PagesResources.canvasIdArgument),
          CanvasTool.optionalInteger(input, PagesResources.versionArgument)));
      case PagesResources.addArtboardTool:
        return this.revisedTo(await this.store.addArtboardAsync(chatId, this.host.folderOf(call), this.host.authorOf(call),
          input.readNonBlankString(PagesResources.canvasIdArgument), input.readInteger(PagesResources.baseVersionArgument),
          input.readNonBlankString(PagesResources.pathArgument), input.readNonBlankString(PagesResources.titleArgument),
          CanvasTool.optionalText(input, PagesResources.canvasPageArgument), new ArtboardPlace(CanvasTool.optionalNumber(input, PagesResources.xArgument),
            CanvasTool.optionalNumber(input, PagesResources.yArgument), CanvasTool.optionalNumber(input, PagesResources.widthArgument),
            CanvasTool.optionalNumber(input, PagesResources.heightArgument)), writing));
      case PagesResources.reviseArtboardTool: {
        const edits = input.hasField(PagesResources.editsArgument)
          ? input.readObjectArray(PagesResources.editsArgument)
            .map(t => new PageTextEdit(t.readString(PagesResources.findArgument), t.readString(PagesResources.replaceArgument)))
          : [];
        return this.revisedTo(await this.store.reviseArtboardAsync(chatId, this.host.folderOf(call), this.host.authorOf(call),
          input.readNonBlankString(PagesResources.canvasIdArgument), input.readInteger(PagesResources.baseVersionArgument),
          input.readNonBlankString(PagesResources.artboardIdArgument), CanvasTool.optionalText(input, PagesResources.pathArgument),
          input.hasField(PagesResources.htmlArgument) ? input.readString(PagesResources.htmlArgument) : null, edits,
          CanvasTool.optionalText(input, PagesResources.titleArgument), writing));
      }
      default: {
        const changes = input.hasField(PagesResources.artboardsArgument)
          ? input.readObjectArray(PagesResources.artboardsArgument).map(t => CanvasTool.changeOf(t))
          : [];
        const pages = input.hasField(PagesResources.pageNamesArgument)
          ? input.readObjectArray(PagesResources.pageNamesArgument)
            .map(t => new CanvasPage(CanvasTool.optionalText(t, PagesResources.idArgument) ?? randomUUID(), t.readNonBlankString(PagesResources.nameArgument)))
          : null;
        const arrangement = await this.store.arrangeAsync(chatId, this.host.authorOf(call), input.readNonBlankString(PagesResources.canvasIdArgument),
          input.readInteger(PagesResources.baseVersionArgument), changes, pages, writing);
        for (const page of arrangement.released)
          this.changed(page, false);
        return this.changedTo(arrangement.content, false);
      }
    }
  }

  private changedTo(content: CanvasContent, isShown: boolean): JsonObject {
    this.changed(content.canvas, isShown);
    return CanvasTool.contentJson(content);
  }

  private revisedTo(revision: CanvasRevision): JsonObject {
    this.changed(revision.content.canvas, false);
    return {
      [PagesResources.canvasField]: revision.content.canvas.toJson(),
      [PagesResources.artboardField]: revision.artboard.toJson(),
      [PagesResources.pageField]: revision.page.toJson()
    };
  }

  private static contentJson(content: CanvasContent): JsonObject {
    return {
      [PagesResources.canvasField]: content.canvas.toJson(),
      [PagesResources.versionField]: content.version,
      [PagesResources.manifestField]: content.manifest.toJson()
    };
  }

  private static changeOf(input: JsonReader): CanvasArtboardChange {
    return new CanvasArtboardChange(input.readNonBlankString(PagesResources.idArgument), CanvasTool.optionalNumber(input, PagesResources.xArgument),
      CanvasTool.optionalNumber(input, PagesResources.yArgument), CanvasTool.optionalNumber(input, PagesResources.widthArgument),
      CanvasTool.optionalNumber(input, PagesResources.heightArgument), CanvasTool.optionalText(input, PagesResources.canvasPageArgument),
      CanvasTool.optionalText(input, PagesResources.titleArgument), CanvasTool.optionalBoolean(input, PagesResources.lockedArgument),
      CanvasTool.optionalBoolean(input, PagesResources.hiddenArgument),
      input.hasField(PagesResources.groupArgument) ? input.readNullableString(PagesResources.groupArgument) : undefined,
      CanvasTool.optionalBoolean(input, PagesResources.removeArgument) ?? false);
  }

  private static optionalText(input: JsonReader, name: string): string | null {
    return input.hasField(name) ? input.readNonBlankString(name) : null;
  }

  private static optionalNumber(input: JsonReader, name: string): number | null {
    return input.hasField(name) ? input.readNumber(name) : null;
  }

  private static optionalInteger(input: JsonReader, name: string): number | null {
    return input.hasField(name) ? input.readInteger(name) : null;
  }

  private static optionalBoolean(input: JsonReader, name: string): boolean | null {
    return input.hasField(name) ? input.readBoolean(name) : null;
  }

  private static failureOf(error: unknown): ToolFailure {
    if (error instanceof PageException)
      return new ToolFailure(error.code, error.message);
    if (error instanceof ArgumentException)
      return new ToolFailure(ToolFailureCode.Refused, error.message);
    return new ToolFailure(ToolFailureCode.OutcomeUncertain, error instanceof Error ? error.message : String(error));
  }
}
