/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type { DataDirectory } from "@noldova/desktop.runtime";
import type { TurnDetail } from "@noldova/teamrun.core";
import type { AttachmentInput, Message, MessageAttachment, MessageStatus, Project } from "@noldova/teamrun.protocol";

/**
 * One of the images the stress chat's project holds and its person's messages attach.
 */
export declare class StressChatImage {
  /**
   * The image's file name.
   */
  public readonly name: string;

  /**
   * Its width in pixels.
   */
  public readonly width: number;

  /**
   * Its height in pixels.
   */
  public readonly height: number;

  /**
   * Whether it has an alpha channel, which fades it from transparent at its left edge to opaque at its right.
   */
  public readonly isTransparent: boolean;

  /**
   * Initializes the image.
   * @param name The file name.
   * @param width The width in pixels.
   * @param height The height in pixels.
   * @param isTransparent Whether it fades from transparent to opaque.
   */
  public constructor(name: string, width: number, height: number, isTransparent: boolean);
}

/**
 * One of the stress chat's repeating scenarios: what its reply holds and how it ends.
 */
export declare class StressChatScenario {
  /**
   * The 25 scenarios, in the order the chat repeats them.
   */
  public static readonly all: readonly StressChatScenario[];

  /**
   * The scenario's name, which its person's message and its reply's heading show.
   */
  public readonly name: string;

  /**
   * How long its reply worked, in seconds, from its start to its end.
   */
  public readonly workSeconds: number;

  /**
   * How its reply ended: completed, failed or cancelled.
   */
  public readonly status: MessageStatus;

  /**
   * Whether its person's message attaches the chat's images.
   */
  public readonly hasAttachments: boolean;

  /**
   * Whether its person's message mentions the chat's two synthetic teammates.
   */
  public readonly hasMentions: boolean;

  /**
   * Initializes the scenario.
   * @param name The name.
   * @param workSeconds How long its reply worked, in seconds.
   * @param composeDetails Writes its reply's details after the heading, for a turn from 1 and the project's folder.
   * @param status How its reply ended; completed when left out.
   * @param hasAttachments Whether its person's message attaches the images; not when left out.
   * @param hasMentions Whether its person's message mentions the teammates; not when left out.
   */
  public constructor(
    name: string,
    workSeconds: number,
    composeDetails: (turn: number, root: string) => readonly TurnDetail[],
    status?: MessageStatus,
    hasAttachments?: boolean,
    hasMentions?: boolean);

  /**
   * Writes its reply's details after the heading.
   * @param turn The turn, from 1.
   * @param root The project's folder, which the details' paths are in.
   * @returns The details, in order.
   */
  public detailsOf(turn: number, root: string): readonly TurnDetail[];
}

/**
 * Encodes the stress chat's synthetic images as PNG: a gradient across, in eight bands down.
 */
export declare class PngEncoder {
  /**
   * Encodes an image.
   * @param image The image.
   * @returns The PNG file's bytes: 8-bit color, with alpha for a transparent image.
   */
  public encode(image: StressChatImage): Buffer;
}

/**
 * The development command that writes the stress chat into a development data folder.
 */
export declare class StressChatCommand {
  /**
   * Initializes the command.
   * @param appFolder The app's folder: its `package.json` names the data folder's variable and the installed app's data folder, and its
   * `_build/data` is the development data folder when the variable is not set.
   * @param environment The environment, which may name the data folder.
   * @param homeFolder The person's home folder, where the installed app keeps its data.
   * @param output Where the command writes what it did or why it refused.
   */
  public constructor(appFolder: string, environment: NodeJS.ProcessEnv, homeFolder: string, output: Writable);

  /**
   * Writes the stress chat, replacing the one an earlier run wrote.
   * @param commandArguments None, for 5,000 pairs, or `--pairs` and a count from 1 to 5,000.
   * @returns 0 when it wrote the chat; 1 when the variable names a relative folder or the installed app's, or TeamRun is running on the
   * folder; 2 for other arguments, after the usage.
   * @throws Error, as a rejection, when the folder, the app's `package.json` or the module's database can't be read or written.
   */
  public runAsync(commandArguments: readonly string[]): Promise<number>;
}

/**
 * Composes the stress chat's messages.
 */
export declare class StressChatComposer {
  /**
   * Initializes the composer.
   * @param conversationId The chat.
   * @param root The project's folder.
   * @param attachments The images that the attached-images scenario's messages attach.
   */
  public constructor(conversationId: string, root: string, attachments: readonly MessageAttachment[]);

  /**
   * Composes the chat's messages: for each pair, a person's message and its finished reply, from the scenarios in their order, again and
   * again; pairs are two minutes apart, and the last starts two minutes before the given moment.
   * @param pairs How many pairs.
   * @param end The moment the chat ends near.
   * @returns The messages, in order, as the caller reads them.
   */
  public compose(pairs: number, end: Date): Generator<Message>;
}

/**
 * The stress chat's project folder.
 */
export declare class StressChatProject {
  /**
   * The project's folder.
   */
  public readonly root: string;

  /**
   * Initializes the project.
   * @param root The project's folder.
   */
  public constructor(root: string);

  /**
   * Writes the project's source files and its images, replacing earlier ones.
   * @returns The images, as attachments to save.
   */
  public write(): readonly AttachmentInput[];
}

/**
 * Writes the stress chat through TeamRun's services into a data folder.
 */
export declare class StressChatSeeder {
  /**
   * Initializes the seeder.
   * @param directory The data folder.
   * @param output Where the module database's diagnostics and the drafts' log go.
   */
  public constructor(directory: DataDirectory, output: Writable);

  /**
   * Takes the folder as Noldova Desktop's runtime does and migrates the module's database as the app does. In one transaction, it forgets the
   * project an earlier run wrote, with its chats, and writes the project, its chat and the messages; then it removes the earlier run's
   * attachments.
   * @param pairs How many pairs.
   * @returns The project.
   * @throws RuntimePartException, as a rejection, when TeamRun is running on the folder.
   */
  public seedAsync(pairs: number): Promise<Project>;
}

/**
 * The stress chat's canonical values.
 */
export declare class StressChatResources {
  public static readonly moduleId: string;
  public static readonly defaultPairs: number;
  public static readonly maximumPairs: number;
  public static readonly pairsOption: string;
  public static readonly pairsPattern: RegExp;
  public static readonly usageExitCode: number;
  public static readonly failureExitCode: number;
  public static readonly usage: string;
  public static readonly manifestFileName: string;
  public static readonly desktopField: string;
  public static readonly productField: string;
  public static readonly dataDirectoryVariableField: string;
  public static readonly dataFolderField: string;
  public static readonly dataFolderSeparator: string;
  public static readonly developmentDataFolder: readonly string[];
  public static readonly projectFolderName: string;
  public static readonly sourceFolderName: string;
  public static readonly imagesFolderName: string;
  public static readonly pngMediaType: string;
  public static readonly utf8Encoding: BufferEncoding;
  public static readonly base64Encoding: BufferEncoding;
  public static readonly asciiEncoding: BufferEncoding;
  public static readonly pngSignature: readonly number[];
  public static readonly pngHeaderChunk: string;
  public static readonly pngDataChunk: string;
  public static readonly pngEndChunk: string;
  public static readonly pngHeaderLength: number;
  public static readonly pngBitDepth: number;
  public static readonly pngTruecolor: number;
  public static readonly pngTruecolorWithAlpha: number;
  public static readonly pngUpFilter: number;
  public static readonly colorChannels: number;
  public static readonly colorWithAlphaChannels: number;
  public static readonly channelMaximum: number;
  public static readonly imageBands: number;
  public static readonly images: readonly StressChatImage[];
  public static readonly exampleFileName: string;
  public static readonly addedFileName: string;
  public static readonly removedFileName: string;
  public static readonly renamedFileName: string;
  public static readonly exampleSource: string;
  public static readonly addedSource: string;
  public static readonly renamedSource: string;
  public static readonly extraSources: ReadonlyMap<string, string>;
  public static readonly projectFiles: ReadonlyMap<string, string>;
  public static readonly kind: string;
  public static readonly model: string;
  public static readonly pairIntervalMilliseconds: number;
  public static readonly replyDelayMilliseconds: number;
  public static readonly millisecondsPerSecond: number;
  public static readonly tokenDigits: number;
  public static readonly tokenPadding: string;
  public static readonly numberFormat: Intl.NumberFormat;
  public static readonly atlasId: string;
  public static readonly atlasName: string;
  public static readonly novaId: string;
  public static readonly novaName: string;
  public static readonly completedStatus: string;
  public static readonly workingTreeSource: string;
  public static readonly addKind: string;
  public static readonly updateKind: string;
  public static readonly deleteKind: string;
  public static readonly moveKind: string;
  public static readonly shortReplyScenario: string;
  public static readonly longProseScenario: string;
  public static readonly headingsScenario: string;
  public static readonly listsScenario: string;
  public static readonly tablesScenario: string;
  public static readonly typeScriptScenario: string;
  public static readonly pythonScenario: string;
  public static readonly csharpScenario: string;
  public static readonly jsonScenario: string;
  public static readonly sqlScenario: string;
  public static readonly longLinesScenario: string;
  public static readonly tallCodeScenario: string;
  public static readonly plainCodeScenario: string;
  public static readonly attachedImagesScenario: string;
  public static readonly writtenImagesScenario: string;
  public static readonly stepsScenario: string;
  public static readonly commandScenario: string;
  public static readonly diffScenario: string;
  public static readonly editScenario: string;
  public static readonly fileOperationsScenario: string;
  public static readonly failedScenario: string;
  public static readonly cancelledScenario: string;
  public static readonly mentionsScenario: string;
  public static readonly unicodeScenario: string;
  public static readonly showcaseScenario: string;
  public static readonly shortReply: string;
  public static readonly longProseParagraphs: number;
  public static readonly tallCodeLines: number;
  public static readonly headings: string;
  public static readonly lists: string;
  public static readonly table: string;
  public static readonly typeScriptCode: string;
  public static readonly pythonCode: string;
  public static readonly csharpCode: string;
  public static readonly sqlCode: string;
  public static readonly longLineWord: string;
  public static readonly longLineWords: number;
  public static readonly plainCode: string;
  public static readonly attachedImages: string;
  public static readonly writtenImages: string;
  public static readonly reasoning: string;
  public static readonly toolResult: string;
  public static readonly toolNames: readonly string[];
  public static readonly toolQuery: string;
  public static readonly commentary: string;
  public static readonly readTool: string;
  public static readonly commandTool: string;
  public static readonly command: string;
  public static readonly commandChecks: number;
  public static readonly commandExit: string;
  public static readonly diffChanges: string;
  public static readonly exampleDiff: string;
  public static readonly longDiffWords: string;
  public static readonly longDiffRepeats: number;
  public static readonly removedSource: string;
  public static readonly editTool: string;
  public static readonly multiEditTool: string;
  public static readonly writeTool: string;
  public static readonly editBefore: string;
  public static readonly editAfter: string;
  public static readonly multiEditPairs: readonly (readonly [before: string, after: string])[];
  public static readonly fileOperations: string;
  public static readonly failedCommand: string;
  public static readonly failedResult: string;
  public static readonly failedError: string;
  public static readonly cancelledText: string;
  public static readonly cancelledNote: string;
  public static readonly mentionsReply: string;
  public static readonly unicode: string;
  public static readonly closing: string;
  public static readonly showcaseScenarios: readonly string[];

  /**
   * Writes a person's message's search token, `TURN-` and the turn's number in five digits.
   * @param turn The turn, from 1.
   * @returns The token, such as `TURN-00001`.
   */
  public static formatToken(turn: number): string;

  /**
   * Names the chat by its number of messages.
   * @param pairs The number of pairs.
   * @returns The title, such as `10,000 messages`.
   */
  public static formatTitle(pairs: number): string;

  /**
   * Writes the chat's first message, which says what the chat holds, that it is synthetic, that no provider session or provider is attached and that the names it mentions are not live teammates.
   * @param pairs The number of pairs.
   * @param scenarios The number of scenarios.
   * @returns The message's text, with the first turn's token.
   */
  public static formatIntroduction(pairs: number, scenarios: number): string;

  /**
   * Writes a person's message.
   * @param turn The turn, from 1.
   * @param scenario The scenario's name.
   * @returns The text, with the turn's token.
   */
  public static formatRequest(turn: number, scenario: string): string;

  /**
   * Writes a person's message that mentions the two synthetic teammates.
   * @param turn The turn, from 1.
   * @param scenario The scenario's name.
   * @returns The text, with the turn's token and both mentions.
   */
  public static formatMentionRequest(turn: number, scenario: string): string;

  /**
   * Writes a reply's first text, the scenario's name in bold.
   * @param scenario The scenario's name.
   * @returns The heading.
   */
  public static formatHeading(scenario: string): string;

  /**
   * Writes one paragraph of synthetic prose.
   * @param turn The turn, from 1.
   * @param paragraph The paragraph's number, from 1.
   * @returns The paragraph.
   */
  public static formatParagraph(turn: number, paragraph: number): string;

  /**
   * Writes paragraphs of synthetic prose, a blank line apart.
   * @param turn The turn, from 1.
   * @param paragraphs How many.
   * @returns The prose.
   */
  public static formatProse(turn: number, paragraphs: number): string;

  /**
   * Writes a JSON block and a YAML block.
   * @param turn The turn, from 1, which the JSON holds.
   * @returns The Markdown.
   */
  public static formatJson(turn: number): string;

  /**
   * Writes a TypeScript block whose lines are far wider than a panel.
   * @param turn The turn, from 1.
   * @returns The Markdown.
   */
  public static formatLongLines(turn: number): string;

  /**
   * Writes a TypeScript block of `tallCodeLines` lines.
   * @param turn The turn, from 1.
   * @returns The Markdown.
   */
  public static formatTallCode(turn: number): string;

  /**
   * Writes a command and its synthetic output, `commandChecks` lines.
   * @returns The text.
   */
  public static formatCommandOutput(): string;

  /**
   * Writes the example's diff with one more line far wider than a panel.
   * @returns The unified diff.
   */
  public static formatLongDiff(): string;

  /**
   * Names a step that read a file.
   * @param path The file.
   * @returns The text.
   */
  public static formatReadStep(path: string): string;

  /**
   * Writes a synthetic step of a tool and its result.
   * @param tool The tool's name.
   * @returns The text.
   */
  public static formatToolStep(tool: string): string;

  /**
   * Names a step that changed a file.
   * @param tool The tool's name.
   * @param path The file.
   * @returns The text.
   */
  public static formatEditStep(tool: string, path: string): string;

  /**
   * Writes the id that ties a step to its result.
   * @param tool The tool's name.
   * @param turn The turn, from 1.
   * @returns The id.
   */
  public static formatToolUseId(tool: string, turn: number): string;

  /**
   * Locates one of the project's source files.
   * @param root The project's folder.
   * @param name The file's name.
   * @returns The file's absolute path.
   */
  public static formatSourcePath(root: string, name: string): string;

  /**
   * Locates one of the project's images.
   * @param root The project's folder.
   * @param name The image's name.
   * @returns The image's absolute path.
   */
  public static formatImagePath(root: string, name: string): string;

  /**
   * Says that the variable names a folder that is not absolute.
   * @param variable The variable's name.
   * @param folder Its value.
   * @returns The message.
   */
  public static formatRelativeFolder(variable: string, folder: string): string;

  /**
   * Says that the command refuses the installed app's data folder.
   * @param folder The installed app's data folder.
   * @param variable The variable that names a data folder.
   * @returns The message.
   */
  public static formatInstalledFolder(folder: string, variable: string): string;

  /**
   * Says that TeamRun is running on the folder.
   * @param folder The data folder.
   * @returns The message.
   */
  public static formatOwned(folder: string): string;

  /**
   * Says which chat the command wrote, into which project and how long it took.
   * @param pairs The number of pairs, which names the chat.
   * @param folder The project's folder.
   * @param milliseconds How long it took.
   * @returns The line, ending in a line break.
   */
  public static formatSeeded(pairs: number, folder: string, milliseconds: number): string;
}
