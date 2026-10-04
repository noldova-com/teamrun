/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import ProcessResult from "../../processes/process-result.ts";
import ProcessRunner from "../../processes/process-runner.ts";

export default class GitHubApiFixture extends ProcessRunner {
  public static readonly REPOSITORY: string = "noldova-com/teamrun";

  private static readonly PREFIX: string = `repos/${GitHubApiFixture.REPOSITORY}`;

  private readonly answers: Map<string, string[]> = new Map<string, string[]>();
  private readonly failures: Map<string, string> = new Map<string, string>();

  public readonly requests: string[] = [];
  public readonly bodies: string[] = [];

  public answer(resource: string, value: unknown): void {
    this.answers.set(resource, [JSON.stringify(value)]);
  }

  public answerInTurn(resource: string, values: readonly unknown[]): void {
    this.answers.set(resource, values.map(t => JSON.stringify(t)));
  }

  public answerText(resource: string, text: string): void {
    this.answers.set(resource, [text]);
  }

  public fail(resource: string, errorOutput: string): void {
    this.failures.set(resource, errorOutput);
  }

  public get writes(): readonly string[] {
    return this.requests.filter(t => !t.startsWith("GET "));
  }

  public override async captureAsync(command: string, commandArguments: readonly string[]): Promise<ProcessResult> {
    const endpoint = commandArguments.find(t => t.startsWith(GitHubApiFixture.PREFIX));
    if (path.parse(command).name !== "gh" || commandArguments[0] !== "api" || endpoint === undefined)
      throw new Error(`Unexpected command ${command} ${commandArguments.join(" ")}.`);
    const resource = endpoint.slice(GitHubApiFixture.PREFIX.length);
    const methodIndex = commandArguments.indexOf("--method");
    this.requests.push(`${methodIndex < 0 ? "GET" : commandArguments[methodIndex + 1]} ${resource}`);
    const bodyArgument = commandArguments.find(t => t.startsWith("body="));
    if (bodyArgument !== undefined)
      this.bodies.push(bodyArgument.slice("body=".length));
    const failure = this.failures.get(resource);
    if (failure !== undefined)
      return new ProcessResult(1, "", failure);
    const answers = this.answers.get(resource) ?? [];
    const answer = answers.length > 1 ? answers.shift() : answers[0];
    if (answer === undefined && methodIndex < 0)
      throw new Error(`No answer recorded for ${resource}.`);
    return new ProcessResult(0, commandArguments.includes("--slurp") ? `[${answer}]` : answer ?? "{}", "");
  }
}
