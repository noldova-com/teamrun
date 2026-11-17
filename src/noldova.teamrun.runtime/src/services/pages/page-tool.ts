/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IToolHandler, type ToolCall, ToolContent, ToolFailure, ToolFailureCode, ToolFailureException, ToolResult } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import type { Page } from "@noldova/teamrun.protocol";

import { PageException } from "../../exceptions/pages/page.exception.js";
import type { IPagesHost } from "../../interfaces/pages/i-pages-host.js";
import { PageTextEdit } from "../../models/pages/page-text-edit.js";
import { PagesResources } from "./pages-resources.js";
import type { PagesStore } from "./pages-store.js";

export class PageTool implements IToolHandler {
  private readonly moduleId: string;
  private readonly name: string;
  private readonly store: PagesStore;
  private readonly host: IPagesHost;
  private readonly changed: (page: Page, isShown: boolean) => void;

  public constructor(moduleId: string, name: string, store: PagesStore, host: IPagesHost, changed: (page: Page, isShown: boolean) => void) {
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
      throw new ToolFailureException(PageTool.failureOf(error));
    }
  }

  private async runAsync(call: ToolCall): Promise<JsonObject> {
    const chatId = this.host.chatOf(call);
    const input = JsonReader.fromValue(call.arguments);
    switch (this.name) {
      case PagesResources.listPagesTool:
        return {
          [PagesResources.pagesField]: (await this.store.listAsync(chatId)).map(t => t.toJson()),
          [PagesResources.canvasesField]: (await this.store.canvasesAsync(chatId)).map(t => t.toJson())
        };
      case PagesResources.readPageTool: {
        const content = await this.store.readAsync(chatId, input.readNonBlankString(PagesResources.pageIdArgument),
          input.hasField(PagesResources.versionArgument) ? input.readInteger(PagesResources.versionArgument) : null);
        return {
          [PagesResources.pageField]: content.page.toJson(), [PagesResources.versionField]: content.version,
          [PagesResources.editedByField]: content.editedBy.toJson(), [PagesResources.htmlField]: content.html,
          [PagesResources.htmlTrustField]: PagesResources.untrustedValue
        };
      }
      case PagesResources.showPageTool:
        return this.changedTo(await this.store.showAsync(chatId, this.host.folderOf(call), this.host.authorOf(call), input.readNonBlankString(PagesResources.pathArgument),
          input.readNonBlankString(PagesResources.titleArgument), PageTool.optionalText(input, PagesResources.pageIdArgument),
          input.hasField(PagesResources.baseVersionArgument) ? input.readInteger(PagesResources.baseVersionArgument) : null,
          () => call.markSending()), true);
      default: {
        const edits = input.hasField(PagesResources.editsArgument)
          ? input.readObjectArray(PagesResources.editsArgument)
            .map(t => new PageTextEdit(t.readString(PagesResources.findArgument), t.readString(PagesResources.replaceArgument)))
          : [];
        return this.changedTo(await this.store.editAsync(chatId, this.host.authorOf(call), input.readNonBlankString(PagesResources.pageIdArgument),
          input.readInteger(PagesResources.baseVersionArgument), input.hasField(PagesResources.htmlArgument) ? input.readString(PagesResources.htmlArgument) : null,
          edits, PageTool.optionalText(input, PagesResources.titleArgument), () => call.markSending()), false);
      }
    }
  }

  private changedTo(page: Page, isShown: boolean): JsonObject {
    this.changed(page, isShown);
    return page.toJson();
  }

  private static optionalText(input: JsonReader, name: string): string | null {
    return input.hasField(name) ? input.readNonBlankString(name) : null;
  }

  private static failureOf(error: unknown): ToolFailure {
    if (error instanceof PageException)
      return new ToolFailure(error.code, error.message);
    return new ToolFailure(ToolFailureCode.OutcomeUncertain, error instanceof Error ? error.message : String(error));
  }
}
