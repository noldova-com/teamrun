/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AuthStatus, DetailKind, ObservedSettings, Provider } from "@noldova/teamrun.protocol";
import { AcpTurn, GrokHome, GrokImageReader, Resources } from "@noldova/teamrun.providers";

import { GrokFailedImageRecording } from "../../fixtures/grok-failed-image.recording.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class GrokImageReaderTests {
  private static readonly JPEG: Buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

  @TestMethod
  public readsTheImageAToolSavedInTheSessionsOwnImagesFolderOfTheTurnsProfile(): void {
    using directory = new TemporaryDirectory();
    const images = GrokImageReaderTests.images(directory.resolve("default"), "s-1");
    const saved = join(images, "1.jpg");
    writeFileSync(saved, GrokImageReaderTests.JPEG);
    const other = GrokImageReaderTests.images(directory.resolve("work"), "s-1");
    writeFileSync(join(other, "12.png"), Buffer.from("89504e470d0a1a0a", "hex"));
    const reader = new GrokImageReader(new GrokHome({ GROK_HOME: directory.resolve("default") }, "/former"));
    const provider = new Provider("a", "grok", "Dedicated", directory.resolve("work"), AuthStatus.Unknown, null, null, null, null, "t");

    const image = reader.read(GrokImageReaderTests.tool("ImageGen", saved), "s-1", null);
    const edited = reader.read(GrokImageReaderTests.tool("ImageEdit", join(other, "12.png")), "s-1", provider);

    Assert.areEqual(saved, image?.path);
    Assert.areEqual("image/jpeg", image?.mediaType);
    Assert.areEqual("/9j/4A==", image?.data);
    Assert.areEqual("image/png", edited?.mediaType);
    Assert.isNull(reader.read(GrokImageReaderTests.tool("ImageGen", saved), "s-1", provider));
  }

  @TestMethod
  public readsNothingFromAToolCallThatReportsNoSavedImage(): void {
    using directory = new TemporaryDirectory();
    const saved = join(GrokImageReaderTests.images(directory.path, "s-1"), "1.jpg");
    writeFileSync(saved, GrokImageReaderTests.JPEG);
    const reader = new GrokImageReader(new GrokHome({ GROK_HOME: directory.path }, "/former"));
    const read = (rawOutput: JsonValue | undefined): unknown =>
      reader.read(JsonReader.fromValue(rawOutput === undefined ? { toolCallId: "t" } : { toolCallId: "t", rawOutput }), "s-1", null);

    Assert.isNull(read(undefined));
    Assert.isNull(read("saved 1.jpg"));
    Assert.isNull(read([{ type: "ImageGen", path: saved }]));
    Assert.isNull(read({ type: "Bash", path: saved }));
    Assert.isNull(read({ path: saved }));
    Assert.isNull(read({ type: "ImageGen" }));
    Assert.isNull(read({ type: "ImageGen", path: 7 }));
    Assert.isNull(read({ type: "ImageGen", path: "images/1.jpg" }));
  }

  @TestMethod
  public refusesAnImageOutsideTheSessionsOwnImagesFolderEvenThroughDotsOrALink(): void {
    using directory = new TemporaryDirectory();
    const profile = directory.resolve("profile");
    const images = GrokImageReaderTests.images(profile, "s-1");
    writeFileSync(join(images, "1.jpg"), GrokImageReaderTests.JPEG);
    const outside = directory.resolve("outside", "images");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "1.jpg"), GrokImageReaderTests.JPEG);
    const otherSession = GrokImageReaderTests.images(profile, "s-2");
    writeFileSync(join(otherSession, "1.jpg"), GrokImageReaderTests.JPEG);
    const loose = join(profile, "sessions", "1.jpg");
    writeFileSync(loose, GrokImageReaderTests.JPEG);
    const linked = join(profile, "sessions", "%2Fwork", "s-3");
    mkdirSync(linked, { recursive: true });
    symlinkSync(outside, join(linked, "images"), "junction");
    const reader = new GrokImageReader(new GrokHome({ GROK_HOME: profile }, "/former"));
    const read = (path: string, sessionId: string = "s-1"): unknown => reader.read(GrokImageReaderTests.tool("ImageGen", path), sessionId, null);

    Assert.isNotNull(read(join(images, "1.jpg")));
    Assert.isNull(read(join(images, "1.jpg"), "s-2"));
    Assert.isNull(read(join(outside, "1.jpg")));
    Assert.isNull(read(`${images}/../../../../../outside/images/1.jpg`));
    Assert.isNull(read(`${images}/../images/1.jpg`));
    Assert.isNull(read(`${images}/./1.jpg`));
    Assert.isNull(read(join(otherSession, "1.jpg")));
    Assert.isNull(read(loose));
    Assert.isNull(read(join(linked, "images", "1.jpg"), "s-3"));
    Assert.isNull(read(join(images, "2.jpg")));
    Assert.isNull(new GrokImageReader(new GrokHome({ GROK_HOME: directory.resolve("empty") }, "/former")).read(GrokImageReaderTests.tool("ImageGen", join(images, "1.jpg")), "s-1", null));
  }

  @TestMethod
  public refusesAFileThatIsNotANamedImageWithinTheSizeLimit(): void {
    using directory = new TemporaryDirectory();
    const images = GrokImageReaderTests.images(directory.path, "s-1");
    const write = (name: string, bytes: Buffer): string => {
      writeFileSync(join(images, name), bytes);
      return join(images, name);
    };
    const reader = new GrokImageReader(new GrokHome({ GROK_HOME: directory.path }, "/former"));
    const read = (path: string): unknown => reader.read(GrokImageReaderTests.tool("ImageGen", path), "s-1", null);
    const largest = write("3.jpg", GrokImageReaderTests.JPEG);
    truncateSync(largest, Resources.maximumImageBytes);
    const larger = write("4.jpg", GrokImageReaderTests.JPEG);
    truncateSync(larger, Resources.maximumImageBytes + 1);
    mkdirSync(join(images, "5.jpg"));

    Assert.isNotNull(read(largest));
    Assert.isNull(read(larger));
    Assert.isNull(read(write("secret.txt", GrokImageReaderTests.JPEG)));
    Assert.isNull(read(write("1234567.jpg", GrokImageReaderTests.JPEG)));
    Assert.isNull(read(write("1.gif", Buffer.from("GIF89a"))));
    Assert.isNull(read(write("2.jpg", Buffer.from("not an image"))));
    Assert.isNull(read(write("6.jpg", Buffer.alloc(0))));
    Assert.isNull(read(join(images, "5.jpg")));
  }

  @TestMethod
  public readsWhyAFailedImageToolFailedAsItsErrorAndMessageCutToTheSummaryLengthAndNothingFromAnyOtherTool(): void {
    const reader = new GrokImageReader(new GrokHome({ GROK_HOME: "/profiles/default" }, "/former"));
    const message = "Image generation failed with HTTP 422 Unprocessable Entity";
    const failureOf = (fields: Record<string, JsonValue>): unknown =>
      reader.failureOf(JsonReader.fromValue({ toolCallId: "t", status: "failed", rawInput: { variant: "ImageGen", prompt: "a square" }, ...fields }));

    Assert.areEqual(JSON.stringify({ error: "tool_execution_failed", message }), JSON.stringify(failureOf({ rawOutput: { error: "tool_execution_failed", message } })));
    Assert.areEqual(JSON.stringify({ message }), JSON.stringify(failureOf({ rawInput: { variant: "ImageEdit" }, rawOutput: { message } })));
    Assert.areEqual("{}", JSON.stringify(failureOf({})));
    Assert.areEqual("{}", JSON.stringify(failureOf({ rawOutput: message })));
    Assert.areEqual("{}", JSON.stringify(failureOf({ rawOutput: [{ message }] })));
    Assert.areEqual(JSON.stringify({ error: "failed", message: `${"m".repeat(500)}…` }),
      JSON.stringify(failureOf({ rawOutput: { error: "failed", message: "m".repeat(501), code: 422, details: { body: "x".repeat(10000) } } })));
    Assert.areEqual(JSON.stringify({ message: "m".repeat(500) }), JSON.stringify(failureOf({ rawOutput: { error: 422, message: "m".repeat(500) } })));
    Assert.isNull(failureOf({ status: "completed", rawOutput: { message } }));
    Assert.isNull(failureOf({ status: "pending" }));
    Assert.isNull(failureOf({ rawInput: { variant: "Bash", command: "ls" } }));
    Assert.isNull(failureOf({ rawInput: { prompt: "a square" } }));
    Assert.isNull(failureOf({ rawInput: [{ variant: "ImageGen" }] }));
    Assert.isNull(failureOf({ rawInput: "ImageGen" }));
    Assert.isNull(reader.failureOf(JsonReader.fromValue({ toolCallId: "t", status: "failed" })));
  }

  @TestMethod
  public async reportsAFailedImageGenCallAsAFailedGeneratedImageWithGroksRawOutputInPlaceOfItsStep(): Promise<void> {
    const listener = new RecordingTurnListener();
    const reader = new GrokImageReader(new GrokHome({ GROK_HOME: "/profiles/default" }, "/former"));

    const replies = await GrokImageReaderTests.playAsync(listener, t => reader.failureOf(t));

    Assert.areEqual(JSON.stringify([GrokFailedImageRecording.reply]), JSON.stringify(replies));
    const tool = listener.details.filter(t => t.providerItemId === "grok-tool-call-1");
    Assert.areEqual("imagine: a small red square on a white background", tool.at(-2)?.text);
    Assert.areEqual(DetailKind.Note, tool.at(-1)?.kind);
    Assert.areEqual(Resources.formatGeneratedImage(null), tool.at(-1)?.text);
    Assert.areEqual(JSON.stringify({
      itemType: "imageGeneration", status: "failed", savedPath: null, revisedPrompt: null, failure: GrokImageReaderTests.rawOutput(), imageData: null, mediaType: null
    }), JSON.stringify(tool.at(-1)?.payload));
    Assert.areEqual(1, listener.details.filter(t => (t.payload as JsonObject | null)?.["itemType"] === "imageGeneration").length);
  }

  @TestMethod
  public async keepsTheFailedCallAsItsOwnFailedStepWhenTheTurnReadsNoImageFailure(): Promise<void> {
    const listener = new RecordingTurnListener();

    await GrokImageReaderTests.playAsync(listener);

    const failed = listener.details.filter(t => t.providerItemId === "grok-tool-call-1").at(-1);
    const payload = failed?.payload as JsonObject;
    Assert.areEqual("imagine: a small red square on a white background", failed?.text);
    Assert.areEqual("failed", payload["status"]);
    Assert.areEqual(JSON.stringify(GrokImageReaderTests.rawOutput()), JSON.stringify(payload["rawOutput"]));
    Assert.isFalse(listener.details.some(t => (t.payload as JsonObject | null)?.["itemType"] === "imageGeneration"));
  }

  private static images(profile: string, sessionId: string): string {
    const images = join(profile, Resources.grokSessionsDirectory, "%2Fwork", sessionId, Resources.grokImagesDirectory);
    mkdirSync(images, { recursive: true });
    return images;
  }

  private static async playAsync(listener: RecordingTurnListener, imageFailureOf?: (tool: JsonReader) => JsonObject | null): Promise<JsonValue[]> {
    const turn = new AcpTurn("grok", "Grok", "Grok tool", listener, new AbortController().signal, 1, undefined, null, undefined, undefined, imageFailureOf);
    await turn.beginAsync("grok-session", false, new ObservedSettings("grok", null, null, null));
    listener.defaultDecision = String((GrokFailedImageRecording.reply["outcome"] as JsonObject)["optionId"]);
    const replies: JsonValue[] = [];
    for (const message of GrokFailedImageRecording.messages) {
      const params = JsonReader.fromValue({ [Resources.sessionIdField]: "grok-session", ...(message["params"] as JsonObject) });
      if (Object.isString(message["id"]))
        replies.push(await turn.onRequest(message["id"], String(message["method"]), params));
      else
        await turn.onNotificationAsync(String(message["method"]), params);
    }
    await turn.onResponseAsync(Resources.acpSessionPrompt);
    return replies;
  }

  private static rawOutput(): JsonValue {
    const update = GrokFailedImageRecording.messages.map(t => (t["params"] as JsonObject)["update"] as JsonObject | undefined)
      .find(t => t?.["status"] === "failed");
    return update?.["rawOutput"] ?? null;
  }

  private static tool(type: string, path: string): JsonReader {
    return JsonReader.fromValue({ toolCallId: "t", status: "completed", rawOutput: { type, path, filename: "1.jpg" } });
  }
}
