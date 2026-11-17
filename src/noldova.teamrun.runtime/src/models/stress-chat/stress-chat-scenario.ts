/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { TurnDetail } from "@noldova/teamrun.core";
import { DetailKind, MessageStatus } from "@noldova/teamrun.protocol";

import { StressChatResources } from "../../services/stress-chat/stress-chat-resources.js";

export class StressChatScenario {
  public static readonly all: readonly StressChatScenario[] = [
    new StressChatScenario(StressChatResources.shortReplyScenario, 3, () => [StressChatScenario.text(StressChatResources.shortReply)]),
    new StressChatScenario(StressChatResources.longProseScenario, 14,
      t => [StressChatScenario.text(StressChatResources.formatProse(t, StressChatResources.longProseParagraphs))]),
    new StressChatScenario(StressChatResources.headingsScenario, 6,
      t => [StressChatScenario.text(StressChatResources.headings), StressChatScenario.text(StressChatResources.formatParagraph(t, 1))]),
    new StressChatScenario(StressChatResources.listsScenario, 4, () => [StressChatScenario.text(StressChatResources.lists)]),
    new StressChatScenario(StressChatResources.tablesScenario, 5, () => [StressChatScenario.text(StressChatResources.table)]),
    new StressChatScenario(StressChatResources.typeScriptScenario, 9, () => [StressChatScenario.text(StressChatResources.typeScriptCode)]),
    new StressChatScenario(StressChatResources.pythonScenario, 8, () => [StressChatScenario.text(StressChatResources.pythonCode)]),
    new StressChatScenario(StressChatResources.csharpScenario, 8, () => [StressChatScenario.text(StressChatResources.csharpCode)]),
    new StressChatScenario(StressChatResources.jsonScenario, 7, t => [StressChatScenario.text(StressChatResources.formatJson(t))]),
    new StressChatScenario(StressChatResources.sqlScenario, 6, () => [StressChatScenario.text(StressChatResources.sqlCode)]),
    new StressChatScenario(StressChatResources.longLinesScenario, 5, t => [StressChatScenario.text(StressChatResources.formatLongLines(t))]),
    new StressChatScenario(StressChatResources.tallCodeScenario, 21, t => [StressChatScenario.text(StressChatResources.formatTallCode(t))]),
    new StressChatScenario(StressChatResources.plainCodeScenario, 4, () => [StressChatScenario.text(StressChatResources.plainCode)]),
    new StressChatScenario(StressChatResources.attachedImagesScenario, 11, () => [StressChatScenario.text(StressChatResources.attachedImages)],
      MessageStatus.Completed, true),
    new StressChatScenario(StressChatResources.writtenImagesScenario, 33, (_, root) => StressChatScenario.writtenImages(root)),
    new StressChatScenario(StressChatResources.stepsScenario, 47, (turn, root) => StressChatScenario.steps(turn, root)),
    new StressChatScenario(StressChatResources.commandScenario, 62, t => StressChatScenario.command(t)),
    new StressChatScenario(StressChatResources.diffScenario, 38, (_, root) => StressChatScenario.diff(root)),
    new StressChatScenario(StressChatResources.editScenario, 29, (turn, root) => StressChatScenario.edits(turn, root)),
    new StressChatScenario(StressChatResources.fileOperationsScenario, 17, (_, root) => StressChatScenario.fileOperations(root)),
    new StressChatScenario(StressChatResources.failedScenario, 7, t => StressChatScenario.failure(t), MessageStatus.Failed),
    new StressChatScenario(StressChatResources.cancelledScenario, 4, () => StressChatScenario.cancellation(), MessageStatus.Cancelled),
    new StressChatScenario(StressChatResources.mentionsScenario, 3, () => [StressChatScenario.text(StressChatResources.mentionsReply)],
      MessageStatus.Completed, false, true),
    new StressChatScenario(StressChatResources.unicodeScenario, 5,
      t => [StressChatScenario.text(StressChatResources.unicode), StressChatScenario.text(StressChatResources.formatParagraph(t, 1))]),
    new StressChatScenario(StressChatResources.showcaseScenario, 95, (turn, root) => StressChatScenario.showcase(turn, root))
  ];

  private readonly composeDetails: (turn: number, root: string) => readonly TurnDetail[];

  public readonly name: string;
  public readonly workSeconds: number;
  public readonly status: MessageStatus;
  public readonly hasAttachments: boolean;
  public readonly hasMentions: boolean;

  public constructor(
    name: string,
    workSeconds: number,
    composeDetails: (turn: number, root: string) => readonly TurnDetail[],
    status: MessageStatus = MessageStatus.Completed,
    hasAttachments: boolean = false,
    hasMentions: boolean = false) {
    this.composeDetails = composeDetails;
    this.name = name;
    this.workSeconds = workSeconds;
    this.status = status;
    this.hasAttachments = hasAttachments;
    this.hasMentions = hasMentions;
  }

  public detailsOf(turn: number, root: string): readonly TurnDetail[] {
    return this.composeDetails(turn, root);
  }

  private static text(text: string): TurnDetail {
    return new TurnDetail(DetailKind.Text, text, null, null);
  }

  private static detail(kind: DetailKind, text: string, payload: JsonValue): TurnDetail {
    return new TurnDetail(kind, text, payload, null);
  }

  private static writtenImages(root: string): readonly TurnDetail[] {
    const paths = StressChatResources.images.map(t => StressChatResources.formatImagePath(root, t.name));
    const changes = paths.map(t => ({ path: t, kind: StressChatResources.addKind, diff: null }));
    return [
      StressChatScenario.detail(DetailKind.FileChange, StressChatResources.writtenImages, { files: paths, status: StressChatResources.completedStatus, changes }),
      StressChatScenario.text(StressChatResources.closing)
    ];
  }

  private static steps(turn: number, root: string): readonly TurnDetail[] {
    const path = StressChatResources.formatSourcePath(root, StressChatResources.exampleFileName);
    const readId = StressChatResources.formatToolUseId(StressChatResources.readTool, turn);
    return [
      StressChatScenario.detail(DetailKind.Reasoning, StressChatResources.reasoning, null),
      StressChatScenario.detail(DetailKind.Note, StressChatResources.formatReadStep(path),
        { tool: StressChatResources.readTool, toolUseId: readId, input: { file_path: path } }),
      StressChatScenario.detail(DetailKind.Note, StressChatResources.exampleSource, { toolUseId: readId, isError: false }),
      ...StressChatResources.toolNames.map(t => StressChatScenario.detail(DetailKind.Note, StressChatResources.formatToolStep(t),
        { tool: t, toolUseId: StressChatResources.formatToolUseId(t, turn), input: { query: StressChatResources.toolQuery } })),
      StressChatScenario.text(StressChatResources.commentary),
      StressChatScenario.text(StressChatResources.closing)
    ];
  }

  private static command(turn: number): readonly TurnDetail[] {
    const id = StressChatResources.formatToolUseId(StressChatResources.commandTool, turn);
    return [
      StressChatScenario.detail(DetailKind.Command, StressChatResources.formatCommandOutput(),
        { tool: StressChatResources.commandTool, toolUseId: id, input: { command: StressChatResources.command } }),
      StressChatScenario.detail(DetailKind.Note, StressChatResources.commandExit, { toolUseId: id, isError: false }),
      StressChatScenario.text(StressChatResources.closing)
    ];
  }

  private static diff(root: string): readonly TurnDetail[] {
    const changes = [
      { path: StressChatResources.formatSourcePath(root, StressChatResources.exampleFileName), kind: StressChatResources.updateKind, diff: StressChatResources.exampleDiff },
      {
        path: StressChatResources.formatSourcePath(root, StressChatResources.addedFileName), kind: StressChatResources.addKind,
        diff: StressChatResources.addedSource
      },
      { path: StressChatResources.formatSourcePath(root, StressChatResources.removedFileName), kind: StressChatResources.deleteKind, diff: StressChatResources.removedSource },
      ...[...StressChatResources.extraSources].map(([name, source]) =>
        ({ path: StressChatResources.formatSourcePath(root, name), kind: StressChatResources.addKind, diff: source }))
    ];
    return [
      StressChatScenario.detail(DetailKind.FileChange, StressChatResources.diffChanges,
        { files: changes.map(t => t.path), status: StressChatResources.completedStatus, changes }),
      StressChatScenario.text(StressChatResources.closing)
    ];
  }

  private static edits(turn: number, root: string): readonly TurnDetail[] {
    const example = StressChatResources.formatSourcePath(root, StressChatResources.exampleFileName);
    const added = StressChatResources.formatSourcePath(root, StressChatResources.addedFileName);
    const edits = StressChatResources.multiEditPairs.map(([before, after]) => ({ old_string: before, new_string: after }));
    return [
      StressChatScenario.detail(DetailKind.FileChange, StressChatResources.formatEditStep(StressChatResources.editTool, example), {
        tool: StressChatResources.editTool, toolUseId: StressChatResources.formatToolUseId(StressChatResources.editTool, turn),
        input: { file_path: example, old_string: StressChatResources.editBefore, new_string: StressChatResources.editAfter }
      }),
      StressChatScenario.detail(DetailKind.FileChange, StressChatResources.formatEditStep(StressChatResources.multiEditTool, example),
        { tool: StressChatResources.multiEditTool, input: { file_path: example, edits } }),
      StressChatScenario.detail(DetailKind.FileChange, StressChatResources.formatEditStep(StressChatResources.writeTool, added),
        { tool: StressChatResources.writeTool, input: { file_path: added, content: StressChatResources.addedSource } }),
      StressChatScenario.text(StressChatResources.closing)
    ];
  }

  private static fileOperations(root: string): readonly TurnDetail[] {
    const renamed = StressChatResources.formatSourcePath(root, StressChatResources.renamedFileName);
    const example = StressChatResources.formatSourcePath(root, StressChatResources.exampleFileName);
    const changes = [
      { path: renamed, kind: StressChatResources.moveKind, diff: null },
      { path: example, kind: StressChatResources.updateKind, diff: StressChatResources.formatLongDiff() }
    ];
    return [
      StressChatScenario.detail(DetailKind.FileChange, StressChatResources.fileOperations,
        { files: [renamed, example], status: StressChatResources.completedStatus, changes, source: StressChatResources.workingTreeSource }),
      StressChatScenario.text(StressChatResources.closing)
    ];
  }

  private static failure(turn: number): readonly TurnDetail[] {
    const id = StressChatResources.formatToolUseId(StressChatResources.commandTool, turn);
    return [
      StressChatScenario.detail(DetailKind.Command, StressChatResources.failedCommand, { tool: StressChatResources.commandTool, toolUseId: id }),
      StressChatScenario.detail(DetailKind.Note, StressChatResources.failedResult, { toolUseId: id, isError: true }),
      StressChatScenario.detail(DetailKind.Error, StressChatResources.failedError, null)
    ];
  }

  private static cancellation(): readonly TurnDetail[] {
    return [StressChatScenario.text(StressChatResources.cancelledText), StressChatScenario.detail(DetailKind.Note, StressChatResources.cancelledNote, null)];
  }

  private static showcase(turn: number, root: string): readonly TurnDetail[] {
    const parts = StressChatResources.showcaseScenarios.flatMap(t => StressChatScenario.all.filter(u => u.name === t).flatMap(u => u.detailsOf(turn, root)));
    return [...parts.filter(t => t.text !== StressChatResources.closing), StressChatScenario.text(StressChatResources.closing)];
  }
}
