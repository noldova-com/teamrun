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
  private static readonly READ: string = "GET";
  private static readonly FIELD_OPTIONS: readonly string[] = ["--raw-field", "--field"];

  private readonly answers: Map<string, string[]> = new Map<string, string[]>();
  private readonly failures: Map<string, string> = new Map<string, string>();

  public readonly requests: string[] = [];
  public readonly bodies: string[] = [];
  public readonly fields: string[] = [];

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
    const method = methodIndex < 0 ? GitHubApiFixture.READ : String(commandArguments[methodIndex + 1]);
    this.requests.push(`${method} ${resource}`);
    const fields = commandArguments.filter((_, index) => GitHubApiFixture.FIELD_OPTIONS.includes(String(commandArguments[index - 1])));
    this.fields.push(...fields);
    const bodyArgument = commandArguments.find(t => t.startsWith("body="));
    if (bodyArgument !== undefined)
      this.bodies.push(bodyArgument.slice("body=".length));
    return this.respondAsync(method, resource, new Map(fields.map(t => [t.slice(0, t.indexOf("=")), t.slice(t.indexOf("=") + 1)])), commandArguments.includes("--slurp"));
  }

  protected async respondAsync(method: string, resource: string, _fields: ReadonlyMap<string, string>, isPaged: boolean): Promise<ProcessResult> {
    const failure = this.failures.get(resource);
    if (failure !== undefined)
      return new ProcessResult(1, "", failure);
    const answers = this.answers.get(resource) ?? [];
    const answer = answers.length > 1 ? answers.shift() : answers[0];
    if (answer === undefined && method === GitHubApiFixture.READ)
      throw new Error(`No answer recorded for ${resource}.`);
    return new ProcessResult(0, isPaged ? `[${answer}]` : answer ?? "{}", "");
  }
}
