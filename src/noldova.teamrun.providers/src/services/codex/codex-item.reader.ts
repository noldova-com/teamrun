/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonReader, JsonValue } from "@noldova/context.json";
import { TurnDetail } from "@noldova/teamrun.core";
import { ApprovalQuestion, DetailKind, QuestionOption, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { TerminalToolResult } from "../../models/terminal-tool-result.js";
import { Resources } from "../../resources.js";
import { CommandOutputDecoder } from "../command-output-decoder.js";
import { ImageDataReader } from "../image-data.reader.js";
import { CommandTitleReader } from "../command-title.reader.js";
import { PlanDetails } from "../plan-details.js";
import { ShellCommandReader } from "../shell-command.reader.js";
import { TerminalToolReader } from "../terminal-tool.reader.js";
import { WriteTargetReader } from "../write-target.reader.js";

export class CodexItemReader {
  public readStarted(item: JsonReader): TurnDetail | null {
    const type = item.readNonBlankString(Resources.typeField);
    if (type === Resources.mcpToolCallItemType && CodexItemReader.isTerminalStep(item))
      return CodexItemReader.readMcpToolCall(item, item.readNonBlankString(Resources.idField), false);
    if (type !== Resources.commandExecutionItemType)
      return null;

    return CodexItemReader.readCommand(item, item.readNonBlankString(Resources.idField), false);
  }

  public readCompleted(item: JsonReader, denied: boolean = false): TurnDetail | null {
    const id = item.readNonBlankString(Resources.idField);
    switch (item.readNonBlankString(Resources.typeField)) {
      case Resources.agentMessageItemType:
        return CodexItemReader.readText(DetailKind.Text, item.readString(Resources.textField), id);
      case Resources.reasoningItemType:
        return CodexItemReader.readReasoning(item, id);
      case Resources.planItemType:
        return PlanDetails.text(item.readString(Resources.textField));
      case Resources.commandExecutionItemType:
        return CodexItemReader.readCommand(item, id, denied);
      case Resources.fileChangeItemType:
        return CodexItemReader.readFileChange(item, id, denied);
      case Resources.mcpToolCallItemType:
        return CodexItemReader.readMcpToolCall(item, id, denied);
      case Resources.dynamicToolCallItemType:
        return CodexItemReader.readToolCall(item, id);
      case Resources.webSearchItemType:
        return new TurnDetail(DetailKind.Note, Resources.formatWebSearch(item.readString(Resources.queryField)),
          { [Resources.toolField]: Resources.webSearchItemType, [Resources.readOnlyField]: true }, id);
      case Resources.contextCompactionItemType:
        return new TurnDetail(DetailKind.Note, Resources.formatContextCompacted(Resources.codexDisplayName), Resources.compactionPayload, id);
      case Resources.enteredReviewModeItemType:
        return CodexItemReader.readReviewStart(item.readString(Resources.reviewField), id);
      case Resources.userMessageItemType:
      case Resources.exitedReviewModeItemType:
      case Resources.collabAgentToolCallItemType:
      case Resources.subAgentActivityItemType:
        return null;
      case Resources.imageGenerationItemType:
        return CodexItemReader.readImageGeneration(item, id);
      default:
        return CodexItemReader.readUnknown(item, id);
    }
  }

  public readQuestion(question: JsonReader): ApprovalQuestion {
    const options = Object.isNull(question.toJson()[Resources.optionsField] ?? null) ? []
      : question.readObjectArray(Resources.optionsField).map(t => new QuestionOption(t.readNonBlankString(Resources.labelField), t.readString(Resources.descriptionField)));

    return new ApprovalQuestion(question.readNonBlankString(Resources.idField), question.readString(Resources.headerField),
      question.readNonBlankString(Resources.questionField), options, false,
      options.length === 0 || (question.hasField(Resources.isOtherField) && question.readBoolean(Resources.isOtherField)),
      question.hasField(Resources.isSecretField) && question.readBoolean(Resources.isSecretField));
  }

  public readPostedQuestion(question: JsonReader, index: number): ApprovalQuestion {
    const options: readonly string[] = Object.isNull(question.toJson()[Resources.optionsField] ?? null) ? [] : question.readStringArray(Resources.optionsField);

    return new ApprovalQuestion(String(index), String.empty, question.readNonBlankString(Resources.titleField),
      options.filter(t => t.trim().length > 0).map(t => new QuestionOption(t, String.empty)), false, true, false);
  }

  private static readImageGeneration(item: JsonReader, id: string): TurnDetail {
    const status = item.readString(Resources.statusField);
    const savedPath = item.hasField(Resources.savedPathField) ? item.readNullableString(Resources.savedPathField) : null;
    const revisedPrompt = item.hasField(Resources.revisedPromptField) ? item.readNullableString(Resources.revisedPromptField) : null;
    const failure = item.hasField(Resources.failureField) ? item.readValue(Resources.failureField) : null;
    const result = item.hasField(Resources.resultField) ? item.readNullableString(Resources.resultField) : null;
    const mediaType = ImageDataReader.mediaTypeOf(result);
    const payload = {
      itemType: Resources.imageGenerationItemType, status, savedPath, revisedPrompt, failure,
      imageData: Object.isNull(mediaType) ? null : result, mediaType
    };

    return new TurnDetail(DetailKind.Note, Resources.formatGeneratedImage(savedPath), payload, id);
  }

  private static readUnknown(item: JsonReader, id: string): TurnDetail {
    const type = item.readNonBlankString(Resources.typeField);
    const json = item.toJson();
    const isKept = type !== Resources.functionCallOutputItemType && JSON.stringify(json).length <= Resources.maximumItemJsonLength;
    const payload = isKept ? { itemType: type, item: json } : { itemType: type };

    return new TurnDetail(DetailKind.Note, Resources.formatUnknownItem(type), payload, id);
  }

  private static readReviewStart(hint: string, id: string): TurnDetail | null {
    return String.isNullOrWhitespace(hint) ? null : new TurnDetail(DetailKind.Note, Resources.formatCodexReviewStarted(hint.trim()), null, id);
  }

  private static readText(kind: DetailKind, text: string, id: string): TurnDetail | null {
    return String.isNullOrWhitespace(text) ? null : new TurnDetail(kind, text, null, id);
  }

  private static readReasoning(item: JsonReader, id: string): TurnDetail | null {
    const summary = item.hasField(Resources.summaryField) ? item.readStringArray(Resources.summaryField) : [];
    return CodexItemReader.readText(DetailKind.Reasoning, summary.join(Resources.lineSeparator).slice(0, Resources.maximumReasoningLength), id);
  }

  private static readCommand(item: JsonReader, id: string, denied: boolean): TurnDetail {
    const command = item.readString(Resources.commandField);
    const exitCode = item.hasField(Resources.exitCodeField) ? item.readNullableInteger(Resources.exitCodeField) : null;
    const status = item.readString(Resources.statusField);
    const cwd = item.hasField(Resources.cwdField) ? item.readValue(Resources.cwdField) : null;
    const output = CommandOutputDecoder.decode(item.hasField(Resources.aggregatedOutputField) ? item.readNullableString(Resources.aggregatedOutputField) ?? String.empty : String.empty);
    const shownOutput = output.length > Resources.maximumCommandOutputLength
      ? `${Resources.ellipsis}${output.slice(-Resources.maximumCommandOutputLength)}`
      : output;

    const inner = ShellCommandReader.innerCommand(command);
    const text = Object.isNull(inner)
      ? Resources.formatCommandStatus(command, null, shownOutput, exitCode)
      : Resources.formatCommandStatus(Resources.formatInnerCommand(inner), command, shownOutput, exitCode);
    const actions = item.hasField(Resources.commandActionsField) ? item.readObjectArray(Resources.commandActionsField) : [];
    const mayWrite = CodexItemReader.mayWrite(command);
    const readOnly = actions.length > 0 && actions.every(t => Resources.readingCommandActions.includes(t.readOptionalString(Resources.typeField) ?? String.empty))
      && !mayWrite;
    const title = mayWrite ? null : CodexItemReader.titleOf(actions) ?? CommandTitleReader.titleOfCall(command);
    const writes = WriteTargetReader.targetsOfCall(command);
    return new TurnDetail(DetailKind.Command, text, {
      command, cwd, exitCode, status, ...(denied ? { [Resources.deniedField]: true } : {}), ...(Object.isNull(writes) ? {} : writes.toJson()),
      ...(readOnly ? { [Resources.readOnlyField]: true } : {}), ...(Object.isNull(title) ? {} : { [Resources.titleField]: title })
    }, id);
  }

  private static titleOf(actions: readonly JsonReader[]): string | null {
    const action = actions[0];
    if (actions.length !== 1 || Object.isUndefined(action))
      return null;
    const path = action.hasField(Resources.pathField) ? action.readNullableString(Resources.pathField) : null;
    switch (action.readOptionalString(Resources.typeField)) {
      case Resources.readCommandAction:
        return Object.isNull(path) ? null : Resources.formatReadTitle([path]);
      case Resources.listFilesCommandAction:
        return Object.isNull(path) ? Resources.listedFolderTitle : Resources.formatListedTitle(path);
      case Resources.searchCommandAction: {
        const query = action.hasField(Resources.queryField) ? action.readNullableString(Resources.queryField) : null;
        return Object.isNull(query) ? null : Resources.formatSearchedTitle(query, Object.isNull(path) ? [] : [path]);
      }
      default:
        return null;
    }
  }

  private static mayWrite(command: string): boolean {
    return command.toLowerCase().split(Resources.commandWordBreakPattern).map(t => t.replace(Resources.commandPathPrefixPattern, String.empty))
      .some(t => Resources.writingCommandWords.includes(t) || t.startsWith(Resources.findPrintOptionPrefix));
  }

  private static readFileChange(item: JsonReader, id: string, denied: boolean): TurnDetail {
    const status = item.readString(Resources.statusField);
    const changes = item.readObjectArray(Resources.changesField).map(t => CodexItemReader.readChange(t));
    const groups = new Map<string, string[]>();
    for (const change of changes) {
      const verb = Resources.changeVerbs.get(change.kind) ?? Resources.otherChangeVerb;
      const name = Object.isNull(change.movePath) ? change.path : Resources.formatMovedFile(change.path, change.movePath);
      groups.set(verb, [...groups.get(verb) ?? [], name]);
    }

    const text = groups.size === 0
      ? Resources.noFileChangesTitle
      : [...groups].map(([verb, names]) => Resources.formatFileChanges(verb, names.join(Resources.listSeparator))).join(Resources.changeGroupSeparator);
    const described = changes.map(t => ({ path: t.path, kind: t.kind, diff: t.diff }));
    return new TurnDetail(DetailKind.FileChange, text, { files: changes.map(t => t.path), status,
      ...(denied ? { [Resources.deniedField]: true } : {}), changes: described }, id);
  }

  private static readChange(change: JsonReader): { path: string; kind: string; movePath: string | null; diff: string | null } {
    const value = change.hasField(Resources.kindField) ? change.readValue(Resources.kindField) : null;
    const kind = Object.isObject(value) && !Array.isArray(value) ? value as JsonObject : null;
    const type = Object.isString(value) ? value : kind?.[Resources.typeField];
    const target = kind?.[Resources.movePathField];
    const movePath = Object.isString(target) && type === Resources.updateChangeKind ? target : null;
    const named = Object.isString(type) ? type : Resources.updateChangeKind;
    return {
      path: change.readString(Resources.pathField),
      kind: Object.isNull(movePath) ? named : Resources.moveChangeKind,
      movePath,
      diff: change.hasField(Resources.diffField) ? change.readNullableString(Resources.diffField) : null
    };
  }

  private static readMcpToolCall(item: JsonReader, id: string, denied: boolean): TurnDetail {
    const server = item.readString(Resources.serverField);
    const tool = item.readString(Resources.toolField);
    const status = item.readString(Resources.statusField);
    const args = item.hasField(Resources.argumentsField) ? item.readValue(Resources.argumentsField) : null;
    const result = item.hasField(Resources.resultField) ? CodexItemReader.objectOf(item.readValue(Resources.resultField)) : null;
    const error = item.hasField(Resources.errorField) ? CodexItemReader.objectOf(item.readValue(Resources.errorField)) : null;
    const text = CodexItemReader.mcpTextOf(result, error);
    const deniedPayload = denied ? { [Resources.deniedField]: true } : {};
    if (CodexItemReader.isTerminalStep(item)) {
      const ended = status === Resources.inProgressItemStatus ? null
        : new TerminalToolResult(CodexItemReader.objectOf(result?.[Resources.structuredContentField]), text, status === Resources.failedItemStatus);
      return TerminalToolReader.read(tool, args, ended, { server, ...deniedPayload }, id);
    }

    const shown = text.slice(0, Resources.maximumToolResultLength);
    const isKept = !Object.isNull(args) && JSON.stringify(args).length <= Resources.maximumItemJsonLength;
    const call = Resources.formatMcpToolCall(server, tool);
    const served = server !== ProtocolResources.mcpServerName ? {}
      : { [ProtocolResources.servedToolField]: tool, ...(isKept ? { [ProtocolResources.servedInputField]: args } : {}) };
    return new TurnDetail(DetailKind.Note, String.isNullOrWhitespace(shown) ? call : `${call}${Resources.lineSeparator}${shown}`,
      { server, tool, status, ...(isKept ? { [Resources.argumentsField]: args } : {}), ...deniedPayload, ...served }, id);
  }

  private static isTerminalStep(item: JsonReader): boolean {
    return item.readString(Resources.serverField) === ProtocolResources.mcpServerName && TerminalToolReader.isStepTool(item.readString(Resources.toolField));
  }

  private static mcpTextOf(result: JsonObject | null, error: JsonObject | null): string {
    const message = error?.[Resources.messageField];
    if (Object.isString(message))
      return message;
    const content = result?.[Resources.contentField];
    if (!Array.isArray(content))
      return String.empty;
    return content.flatMap(t => {
      const block = CodexItemReader.objectOf(t);
      const text = block?.[Resources.textField];
      return block?.[Resources.typeField] === Resources.textBlockType && Object.isString(text) ? [text] : [];
    }).join(Resources.lineSeparator);
  }

  private static objectOf(value: JsonValue | undefined): JsonObject | null {
    return Object.isObject(value) && !Array.isArray(value) ? value as JsonObject : null;
  }

  private static readToolCall(item: JsonReader, id: string): TurnDetail {
    const tool = item.readString(Resources.toolField);
    const status = item.readString(Resources.statusField);

    return new TurnDetail(DetailKind.Note, Resources.formatToolCall(tool), { tool, status }, id);
  }
}
