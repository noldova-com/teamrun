/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SharedMcpAccount, SharedMcpHeader, SharedMcpServerDefinition, SharedMcpTransport } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpServerDefinitionTests {
  private static readonly stdio = {
    name: "search", transport: "Stdio", command: "npx", arguments: ["-y", "search-server"], variables: ["SEARCH_KEY", "SEARCH_REGION"],
    url: null, headers: [], bearerVariable: null, signsIn: false, account: null
  };
  private static readonly http = {
    name: "docs_2", transport: "Http", command: null, arguments: [], variables: [], url: "https://docs.example.com/mcp",
    headers: [{ name: "X-Team", variable: "DOCS_TEAM" }], bearerVariable: "DOCS_TOKEN", signsIn: false, account: null
  };

  @TestMethod
  public keepsAStdioOrHttpServerWithTheVariablesThatHoldItsValues(): void {
    for (const json of [SharedMcpServerDefinitionTests.stdio, SharedMcpServerDefinitionTests.http])
      Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpServerDefinition.fromJson(json).toJson()));
    Assert.areEqual(JSON.stringify(["SEARCH_KEY", "SEARCH_REGION"]),
      JSON.stringify(SharedMcpServerDefinition.fromJson(SharedMcpServerDefinitionTests.stdio).referencedVariables));
    Assert.areEqual(JSON.stringify(["DOCS_TEAM", "DOCS_TOKEN"]),
      JSON.stringify(SharedMcpServerDefinition.fromJson(SharedMcpServerDefinitionTests.http).referencedVariables));
    Assert.areEqual(JSON.stringify([]), JSON.stringify(SharedMcpServerDefinitionTests.server({ url: "http://127.0.0.1:8080/mcp" }).referencedVariables));
  }

  @TestMethod
  public keepsAnHttpServerThatSignsInWithoutABearerVariableOrAuthorizationHeaderAndReadsAnOlderOneAsNotSigningIn(): void {
    const json = { ...SharedMcpServerDefinitionTests.http, headers: [], bearerVariable: null, signsIn: true };
    const older = Object.fromEntries(Object.entries(SharedMcpServerDefinitionTests.http).filter(([t]) => t !== "signsIn"));
    const stdio = (): SharedMcpServerDefinition => new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], [], null, [], null, true);
    const bearer = (): SharedMcpServerDefinition => new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example.com/mcp", [],
      "TOKEN", true);
    const header = (): SharedMcpServerDefinition => new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example.com/mcp",
      [new SharedMcpHeader("Authorization", "AUTH")], null, true);

    Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpServerDefinition.fromJson(json).toJson()));
    Assert.isFalse(SharedMcpServerDefinition.fromJson(older).signsIn);
    for (const refused of [stdio, bearer, header])
      Assert.areEqual("signsIn", Assert.throws(refused, ArgumentException).parameterName);
    Assert.areEqual("$.d.signsIn", Assert.throws(() => SharedMcpServerDefinition.fromJson({ ...json, signsIn: "yes" }, "$.d"), JsonException).path);
  }

  @TestMethod
  public keepsAnHttpServerThatSignsInWithAnAccountWithoutAnyOtherSignInAndReadsAnOlderOneAsHavingNone(): void {
    const json = { ...SharedMcpServerDefinitionTests.http, url: "https://api.githubcopilot.com/mcp/x/repos", headers: [], bearerVariable: null, account: "GitHub" };
    const older = Object.fromEntries(Object.entries(SharedMcpServerDefinitionTests.http).filter(([t]) => t !== "account"));
    const withAccount = (transport: SharedMcpTransport, address: string | null, headers: readonly SharedMcpHeader[], bearer: string | null, signsIn: boolean)
      : (() => SharedMcpServerDefinition) => () => SharedMcpServerDefinition.fromJson({ ...json, transport, command: Object.isNull(address) ? "npx" : null, url: address,
      headers: headers.map(t => t.toJson()), bearerVariable: bearer, signsIn });
    const url = "https://api.githubcopilot.com/mcp/";

    Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpServerDefinition.fromJson(json).toJson()));
    Assert.isNull(SharedMcpServerDefinition.fromJson(older).account);
    Assert.isNull(SharedMcpServerDefinition.fromJson({ ...json, account: null }).account);
    for (const refused of [withAccount(SharedMcpTransport.Stdio, null, [], null, false), withAccount(SharedMcpTransport.Http, url, [], "TOKEN", false),
      withAccount(SharedMcpTransport.Http, url, [new SharedMcpHeader("authorization", "AUTH")], null, false),
      withAccount(SharedMcpTransport.Http, url, [], null, true)])
      Assert.areEqual("account", Assert.throws(refused, ArgumentException).parameterName);
    Assert.areEqual("$.d.account", Assert.throws(() => SharedMcpServerDefinition.fromJson({ ...json, account: "GitLab" }, "$.d"), JsonException).path);
  }

  @TestMethod
  public refusesAServerThatSignsInWithGitHubAtAnyOtherOriginSoItsTokenGoesNowhereElse(): void {
    const json = { ...SharedMcpServerDefinitionTests.http, headers: [], bearerVariable: null, account: "GitHub" };

    for (const url of ["https://docs.example.com/mcp", "https://api.githubcopilot.com.example.com/mcp/", "https://api.githubcopilot.com@example.com/mcp/",
      "http://api.githubcopilot.com/mcp/", "https://api.githubcopilot.com:8443/mcp/", "https://githubcopilot.com/mcp/"]) {
      const refused = Assert.throws(() => SharedMcpServerDefinition.fromJson({ ...json, url }), ArgumentException);
      Assert.areEqual("url", refused.parameterName);
      Assert.areEqual("A shared MCP server that signs in with GitHub is at https://api.githubcopilot.com, so its token goes to no other address. (Parameter 'url')", refused.message);
    }
    Assert.areEqual("https://docs.example.com/mcp", SharedMcpServerDefinition.fromJson({ ...json, account: null }).url);
  }

  @TestMethod
  public offersGitHubsOwnServerSigningInWithTheGitHubAccount(): void {
    const { gitHub } = SharedMcpServerDefinition;

    Assert.areEqual(JSON.stringify({ name: "github", transport: "Http", command: null, arguments: [], variables: [], url: "https://api.githubcopilot.com/mcp/",
      headers: [], bearerVariable: null, signsIn: false, account: SharedMcpAccount.GitHub }), JSON.stringify(gitHub.toJson()));
    Assert.areEqual(JSON.stringify([]), JSON.stringify(gitHub.referencedVariables));
  }

  @TestMethod
  public readsMalformedFieldsAtTheirPath(): void {
    const { stdio } = SharedMcpServerDefinitionTests;

    Assert.areEqual("$.d.transport", Assert.throws(() => SharedMcpServerDefinition.fromJson({ ...stdio, transport: "Sse" }, "$.d"), JsonException).path);
    Assert.areEqual("$.d.variables", Assert.throws(() => SharedMcpServerDefinition.fromJson({ ...stdio, variables: "KEY" }, "$.d"), JsonException).path);
    Assert.areEqual("$.d.headers.0.variable", Assert.throws(() => SharedMcpServerDefinition.fromJson(
      { ...SharedMcpServerDefinitionTests.http, headers: [{ name: "X-Team" }] }, "$.d"), JsonException).path);
  }

  @TestMethod
  public refusesANameThatIsNoServerNameOrCouldBeReadAsAnotherServersInAToolsName(): void {
    for (const name of ["Search", "1search", "-search", "search server", "teamrun", "s".repeat(65), "teamrun__search", "docs__x", "search_", "a_"])
      Assert.areEqual("name", Assert.throws(() => SharedMcpServerDefinitionTests.stdioServer({ name }), ArgumentException).parameterName, name);
    for (const name of ["s".repeat(64), "teamrun_search", "a_b-c", "a-", "x"])
      Assert.areEqual(name, SharedMcpServerDefinitionTests.stdioServer({ name }).name);
  }

  @TestMethod
  public refusesAnAddressHoldingAUserNameAPasswordOrAQueryNamedLikeASecret(): void {
    for (const url of ["https://bot:pass@docs.example.com/mcp", "https://bot@docs.example.com/mcp", "https://:pass@docs.example.com/mcp",
      "https://docs.example.com/mcp?api_key=1", "https://docs.example.com/mcp?team=a&access_token=1", "https://docs.example.com/mcp?Password=x",
      "http://docs.example.com/mcp?auth=x", "https://docs.example.com/mcp?client_secret=x", "https://docs.example.com/mcp?X-Amz-Credential=x"]) {
      const refused = Assert.throws(() => SharedMcpServerDefinitionTests.server({ url }), ArgumentException);
      Assert.areEqual("url", refused.parameterName, url);
      Assert.isTrue(refused.message.startsWith("A shared MCP server's address holds no user name, password, key or token"), url);
    }
    Assert.areEqual("https://docs.example.com/mcp?team=a&region=eu", SharedMcpServerDefinitionTests.server({ url: "https://docs.example.com/mcp?team=a&region=eu" }).url);
  }

  @TestMethod
  public refusesAnAuthorizationHeaderBesideABearerTokensVariable(): void {
    for (const name of ["Authorization", "authorization"]) {
      const refused = Assert.throws(() => SharedMcpServerDefinitionTests.server({ headers: [new SharedMcpHeader(name, "AUTH")], bearerVariable: "TOKEN" }),
        ArgumentException);
      Assert.areEqual("headers", refused.parameterName, name);
      Assert.isTrue(refused.message.startsWith("A shared MCP server with a bearer token's variable names no Authorization header."), name);
    }
    Assert.areEqual(1, SharedMcpServerDefinitionTests.server({ headers: [new SharedMcpHeader("Authorization", "AUTH")] }).headers.length);
  }

  @TestMethod
  public refusesAVariableThatIsNoNameOrIsNamedTwice(): void {
    Assert.areEqual("transport", Assert.throws(() => SharedMcpServerDefinitionTests.stdioServer({ transport: "Sse" as SharedMcpTransport }),
      ArgumentException).parameterName);
    for (const variables of [["SEARCH-KEY"], ["$SEARCH_KEY"], [""]])
      Assert.areEqual("variables", Assert.throws(() => SharedMcpServerDefinitionTests.stdioServer({ variables }), ArgumentException).parameterName);
    Assert.areEqual("variables", Assert.throws(() => SharedMcpServerDefinitionTests.server({ bearerVariable: "DOCS TOKEN" }), ArgumentException).parameterName);
    const twice = Assert.throws(() => SharedMcpServerDefinitionTests.stdioServer({ variables: ["KEY", "KEY"] }), ArgumentException);
    Assert.isTrue(twice.message.startsWith("A shared MCP server names each variable once."));
    const headers = [new SharedMcpHeader("X-Team", "A"), new SharedMcpHeader("x-team", "B")];
    Assert.areEqual("headers", Assert.throws(() => SharedMcpServerDefinitionTests.server({ headers }), ArgumentException).parameterName);
  }

  @TestMethod
  public refusesAStdioServerWithoutACommandOrWithAnHttpServersFields(): void {
    for (const change of [{ command: null }, { command: " " }, { url: "https://docs.example.com/mcp" }, { headers: [new SharedMcpHeader("X-Team", "A")] },
      { bearerVariable: "TOKEN" }]) {
      const refused = Assert.throws(() => SharedMcpServerDefinitionTests.stdioServer(change), ArgumentException);
      Assert.isTrue(refused.message.startsWith("A stdio server has a command"), JSON.stringify(change));
    }
  }

  @TestMethod
  public refusesAnHttpServerWithoutAnHttpAddressOrWithAStdioServersFields(): void {
    for (const change of [{ url: null }, { url: "docs.example.com/mcp" }, { url: "ftp://docs.example.com" }, { url: "file:///tmp/mcp" },
      { command: "npx" }, { args: ["-y"] }, { variables: ["KEY"] }]) {
      const refused = Assert.throws(() => SharedMcpServerDefinitionTests.server(change), ArgumentException);
      Assert.isTrue(refused.message.startsWith("An HTTP server has an http or https address"), JSON.stringify(change));
    }
  }

  private static stdioServer(change: Partial<{ name: string; transport: SharedMcpTransport; command: string | null; variables: string[]; url: string;
    headers: SharedMcpHeader[]; bearerVariable: string }>): SharedMcpServerDefinition {
    return new SharedMcpServerDefinition(change.name ?? "search", change.transport ?? SharedMcpTransport.Stdio,
      change.command === undefined ? "npx" : change.command, ["-y"], change.variables ?? [], change.url ?? null, change.headers ?? [],
      change.bearerVariable ?? null);
  }

  private static server(change: Partial<{ url: string | null; command: string; args: string[]; variables: string[]; headers: SharedMcpHeader[];
    bearerVariable: string }>): SharedMcpServerDefinition {
    return new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, change.command ?? null, change.args ?? [], change.variables ?? [],
      change.url === undefined ? "https://docs.example.com/mcp" : change.url, change.headers ?? [], change.bearerVariable ?? null);
  }
}
