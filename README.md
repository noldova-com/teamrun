# TeamRun

TeamRun is a desktop app for working with AI agents as a team.
People chat with agents from several AI providers, give them teammates' roles, and follow and approve their work in one place.
The product word is "chat": every text a person sees says "chat" or "chats", never "conversation", and new work uses it from the start.

It is built on [Noldova Desktop](https://github.com/noldova-com/desktop) and targets Windows and Linux on x64 and ARM64, and macOS on both Apple Silicon and Intel.
To report a bug or ask for a change, open an issue in this repository, as the organization's [contributing guide](https://github.com/noldova-com/.github/blob/main/CONTRIBUTING.md) says.
Report a security problem privately, as its [security policy](https://github.com/noldova-com/.github/blob/main/SECURITY.md) says.

TeamRun names the AI providers a person connects to, such as Claude, Codex, Grok, OpenCode, Cursor, fx, Antigravity, Pi, Muse Code and GitHub Copilot, in its code, documents and app.
Product names and trademarks belong to their owners.

## Building from source

```bash
npm ci
npm run build
npm test
```

`npm ci` installs the exact versions the root's `package-lock.json` records, for the root and for the Angular project in `src/`, the root's one npm workspace, where the window part compiles and its specs run; `npm run build` builds every package, and runs that `npm ci` itself first when the root has no `node_modules`, and `npm test` runs every check.

## Starting the app

After the build above, one command starts the TeamRun app on this checkout's packages:

```bash
npm start
```

It runs `npm run install:app`, then `npm run build:app`, then starts the app with `npm start` in `app/`, passing on the arguments that follow `npm start --`.
`app/` is a Noldova Desktop app in Desktop 0.0.2's layout: its `package.json` names its window app, `app/src/noldova.teamrun.window.app/`, among its `workspaces`, so the app has one lockfile, `app/package-lock.json`, and one `node_modules`.
`app/package.json` pins `@noldova/teamrun` at the root `package.json`'s version, as Noldova Desktop's build requires of a module's package, and Noldova Desktop's and other packages at exact versions; `app/package-lock.json` resolves each of this checkout's 8 TeamRun packages to its archive, such as `file:../_packages/noldova-teamrun.runtime-0.0.1.tgz`, the file `npm run build` packs, without a checksum.
`npm run install:app` requires the lockfile, a current build and that pin, then installs the app with `npm ci --legacy-peer-deps --ignore-scripts` in `app/`, taking the TeamRun packages from `_packages/` and every other package from npm at the versions `app/package-lock.json` locks.
It then fails when the install put a package in `app/node_modules` that `app/package-lock.json` doesn't lock at the version, source and checksum it installed, when a TeamRun archive's `package.json` depends on, or takes as a peer or optional dependency, anything its lockfile entry doesn't name at the same version or range, when a TeamRun package the lockfile locks wasn't installed, or when a lockfile entry still resolves to an archive under `_packages/` of a package the checkout no longer has; otherwise it runs `npm run install:window` there, Noldova Desktop's `install`, which runs its own `npm ci` only when the lockfile changed since its last install.
`app/.npmrc` sets `legacy-peer-deps`, so Noldova Desktop's `npm ci` installs as `lock:app` locked.
`npm run lock:app` writes `app/package-lock.json`: in a temporary copy of `app/`'s manifests, lockfile and `.npmrc`, it runs `npm install --package-lock-only --legacy-peer-deps` with the 8 archives, which keeps the versions already locked, and keeps all of npm's lockfile but the TeamRun archives' checksums, with each TeamRun package resolved to its archive under `_packages/` and `app/package.json`'s pins in its root entry, so a rebuild that changes an archive needs no new lockfile, and `npm ci` installs the archive the build just packed.
A change to the app's dependencies, or to the TeamRun packages' own dependencies, needs `npm run lock:app` and a commit of the lockfile.
`lock:app` needs a build of the checkout as it is, so after the pins move, `npm run relock:app` installs the root and `src/`, builds and then runs `lock:app`; the Relock workflow runs it for `app/package-lock.json` once the other lock files are relocked.
`@noldova/desktop.build` hashes `app/package-lock.json` into the app's build inputs, so the build id it writes changes with the app's registry packages, but not with TeamRun's code.
TeamRun's packages come from the checkout's build, never from a release, so the app always runs the code beside it, and `npm run install:app` and `npm run lock:app` refuse an `app/package.json` that pins `@noldova/teamrun` at anything but the root `package.json`'s version.
`npm run build:app` builds the app with `npm run build` in `app/`.
`npm run package:app` packages the built app with `npm run package` in `app/`, and `npm run package:smoke` installs, starts and quits that package with `npm run package:smoke` there, so the Flake proof can repeat the smoke: on Linux it needs a display, as the proof's `display` input gives it.
CI's package job runs the same two scripts of `app/` there through Noldova Desktop's package workflow, which also removes libfuse2 on Linux and runs the smoke a second time with the AppImage's extract-and-run; these scripts do neither.
`npm run seed:stress` installs the app the same way and writes a synthetic chat of 10,000 messages into its development data folder, as the app's [README](app/README.md#a-chat-at-size) says.
`app/` is the TeamRun app on Noldova Desktop, with this repository's module, and its [README](app/README.md) says what it holds.

## Profiling

`npm run profile` measures how the app responds, the same way each time, so a lag fix can show its numbers before and after:

```bash
npm run install:app
npm run build:app
npm run profile -- <label> --seed
```

It starts the built app as the end-to-end test does, Electron with Noldova Desktop's `main.js`, but with a remote debugging port on a free port that it attaches to over the Chrome DevTools Protocol, with `chromium.connectOverCDP` from the Angular project's `playwright`.
It uses the app's development data folder, `app/_build/data`, or the absolute folder `TEAMRUN_DATA_DIR` names, never a person's own data.
`--seed` first writes the 10,000-message stress chat there with `app/seed-stress.ts`, as `npm run seed:stress` does, `--pairs <count>` passes on a smaller one, and it then adds a generated image of 1.3 MB to a reply that wrote an image.
Before it starts the app it reads the data folder's TeamRun database: while the first launch is pending, with no provider and no finished `firstLaunch` preference, the app opens the Providers tab with its welcome line, and the harness waits for it and chooses Skip for now.
It lays the page out at 1920 by 1080 whatever the screen, so runs on different machines compare.
It then runs each scenario with a renderer CPU profile, in this order: `idle-start`, `open-stress`, `type-stress`, `scroll-stress` (60 wheel steps of -400 px, 25 ms apart), `idle-stress`, `new-chats`, `type-short`, `split-stress`, `type-all-open`, `scroll-all-open`, `switch-tabs`, `idle-all-open`, `open-image` and `open-written-image-again`.
`--scenarios <name>,...` runs only those, still in that order.
Each scenario waits for the state it needs, such as the context menu, a new tab group after the split or a history that has stopped moving, and fails with its reason and a screenshot when that state doesn't come, rather than measuring another layout; its fixed pauses only pace typing, scrolling and switching tabs.
A failed scenario stops the run: the results mark it FAILED with its reason and keep no profile of it, mark each scenario after it SKIPPED, since each builds on the layout the ones before it leave, and `npm run profile` exits with 1.
A start that fails closes the connection and stops the app and this data folder's runtime, as the end of a run does.
For each scenario it prints the key-to-frame delays, the frame times, the slow events and the long animation frames, with the median, the 95th percentile, the maximum and the count over 16.7 ms, then the functions with the most self time and the app's functions with the most inclusive time, named through the window build's source maps.
It writes each scenario's `<scenario>.cpuprofile` to `_build/profile/<label>/`, with the scripts' sources in `sources/` and a screenshot at the end.
`--node` also profiles the app's Node.js processes, into `node/` there, and prints their summaries after the app has quit.

`npm run profile:read -- <profile> [--groups <group>,...] [--top <count>]` reads a profile: its span and busy time, the inclusive time of each group, and the functions with the most self time, 8 unless `--top` says otherwise, each with its source line from `sources/` beside the profile, its callers and their source.
A group is `keep`, `overlay` or `highlight`, the function groups the chat's lag work measured, or `<name>=<function>+<function>`.

The profiles compare only from one machine, so run every profile you compare on the same computer, after `npm run install:app` and `npm run build:app`.
The profile scripts drive the app with Playwright, which only the Angular project in `src/` declares: they load it from the root's `node_modules`, where the root install hoists it from the `src/` workspace.

The harness runs on Windows only for now: on Linux the app doesn't stay up under it, since it crashes in Noldova Desktop's descriptor cleanup.

## Providers

Settings' page "What each provider can do" shows, for the provider the person picks, every ability TeamRun knows in groups: whether it works, and where from, or the reason it can't, isn't built yet or isn't checked yet; ARCHITECTURE.md's table shows the same answers for every provider at once.
TeamRun runs each provider's own command-line tool, which keeps its own sign-in; TeamRun doesn't open a provider's credentials file or ask for its token, and stores no provider's sign-in; the values a person types into a local ACP command's variables are kept in the system's secret store and passed only to that command.
To check a sign-in it asks the tool, and keeps the answer with the provider in its database: whether the provider is signed in, and the email or user name, plan, organization and sign-in method where the tool gives them.
For OpenCode, Antigravity, Pi, fx and Muse Code it keeps only whether the provider is signed in.
A reply keeps which provider, model, effort and speed served it and the tool's version, but none of the person's email, plan, organization or sign-in method, so signing out or removing the provider leaves none of them in a chat; updating TeamRun removes them from the replies it kept before, though earlier copies can stay in the database file's free space and in the last three backups Noldova Desktop takes before an update, until they are overwritten.
It looks at four sign-in files by name only, without opening them: whether Antigravity's token file is in the profile, for the sign-in check, and whether OpenCode's `opencode/auth.json`, Pi's `auth.json` or Copilot's `config.json`, where Copilot can save its token when there's no keychain, is in a folder, to find their profiles.
To list the person's own MCP servers, it reads Claude's `.claude.json` whole, Copilot's `mcp-config.json`, `settings.json` and the `.mcp.json` and `.github/mcp.json` files from a chat's folder up to its git root and in its plugins, and asks Codex's `config/read`.
These can hold secrets, such as a server's token, and `.claude.json` holds the person's account details and may hold Claude's own API key; TeamRun keeps only the servers' names.
With Claude's own MCP servers switched on, a chat also passes those servers' entries to Claude's program, with their variables filled in, and TeamRun still keeps only the names.
Noldova Desktop starts every program TeamRun runs for a provider, and the Modules page lists it under TeamRun's running programs for as long as it runs.
Codex's app-server stays running for each profile between turns until TeamRun stops; Claude Code, GitHub Copilot, Grok, OpenCode, Cursor, Antigravity, Pi and Muse Code run only while a turn, a model listing, a sign-in or a sign-in check needs them, so they show only then; an Antigravity model listing starts nothing.

When GitHub Copilot, Grok, OpenCode, Cursor or Antigravity doesn't offer the chosen model, the reply fails saying to open the teammate or the composer's model menu, refresh the models, and choose one.
The reply's "Choose a model" opens the teammate's dialog for a teammate's reply, and the composer's model and effort picker otherwise; Claude Code and Codex say it in their own words.
An OpenCode model listing also runs `opencode models --verbose`, and each model offers the `variants` it lists for that model, in its order, then OpenCode's `default`, with the first variant as its default effort, since OpenCode runs a newly chosen model at it; a model it doesn't list, or a run that can't start or fails, keeps the levels the session names.
TeamRun reads up to 16M characters of that list, far more than the 512K it keeps of other commands, since a signed-in list runs to about 1.3K characters a model.
A model with no levels, such as an OpenCode model with no variants or any Cursor model, offers no effort: unless one was chosen before, the composer shows no Effort menu and the teammate dialog's Effort field is disabled.
Over ACP each Cursor model is one fixed variant, and Cursor refuses any other.
The Teammates table marks a model missing from the provider's current list "Not in catalog" on a line under it, the teammate dialog marks it "(not in the current catalog)", and neither marks one while the provider lists no models.
Grok lists only its built-in models, `grok-4.6` and `grok-4.5`, until it loads the provider's catalog, which its start waits on for 5 seconds and then keeps loading; when its first answer lists only those, TeamRun asks it for its catalog with `x.ai/models/list`, which waits up to 10 seconds more, as Grok's own `grok models` does, and TeamRun waits up to 15 seconds for its answer.
A list still of only those is taken as not yet loaded, so TeamRun marks nothing, the composer says the list came back empty, and a turn on another model fails saying to try again.

### Codex

On Windows, Codex CLI before 0.163.0 can fail every command in its elevated sandbox with "setup refresh had errors" while the Codex app holds one of its runtime files open.
TeamRun stops such a turn at the first command that fails to start with that error, and says to close the Codex app, and to update Codex CLI when it is older than 0.163.0 or of an unknown version.
Before a turn, model listing, sign-in check, sign-in or fork on a profile's running app-server, TeamRun reads the Codex executable's path, size and modification time, which starts no program, and runs `codex --version` only when they changed since the app-server started or was last checked, or the last run failed at least the version timeout (20 seconds) ago.
When Codex CLI was updated since the app-server started, TeamRun starts a new app-server, and the old one stops once the turns and background commands running on it end.
When TeamRun runs Codex through a launcher on the PATH rather than the executable in Codex's npm package, such as a Volta, pnpm or bun shim, an update may leave the launcher unchanged, and TeamRun keeps its app-servers until it restarts.
An update made while Codex is in use can leave Codex CLI half-installed on Windows, its package of the new version and its executable of the old one; Codex then refuses to start with "the CLI package version does not match its executable", and TeamRun fails the work saying to quit TeamRun and every other app using Codex, reinstall Codex CLI, then retry.

### GitHub Copilot

TeamRun runs GitHub Copilot CLI over ACP, as `copilot --acp --stdio --no-auto-update`, and needs a GitHub Copilot subscription.

1. Install the CLI with `npm install -g @github/copilot`, or another way GitHub's documentation gives.
   TeamRun finds `copilot` on the PATH or in `~/.local/bin`, and on Windows `copilot.exe` on the PATH or behind npm's `copilot.cmd`.
2. Sign in from the provider's row: Sign in opens a TeamRun terminal with `COPILOT_HOME` set to the provider's profile folder and runs `copilot login` there.
   TeamRun starts Copilot with the same `COPILOT_HOME`, and without `COPILOT_GITHUB_TOKEN`, `GH_TOKEN` or `GITHUB_TOKEN`, so the provider works as the folder's own sign-in, not as the token's.
3. Refresh the provider or the model list in TeamRun.
   TeamRun checks the sign-in by opening a Copilot session and closing it again, so it says "isn't signed in" until `copilot login` succeeds.

Copilot doesn't list its models over ACP, so TeamRun lists them from `copilot --headless --no-auto-update --stdio`, the server GitHub's Copilot SDK speaks to, started for the listing with the same environment and `COPILOT_HOME` and stopped after it.
TeamRun asks it `connect` and `auth.getStatus`, within the 60 s an agent's start-up may take, then opens a session with `session.create` and asks `session.model.list`, the list Copilot's own model picker offers, within the 2 minutes any other request may take, and deletes the session again with `session.delete`; it leaves out a model whose policy is `disabled`, and a model's effort levels are the ones it lists, in `supportedReasoningEfforts` or in `capabilities.supports.reasoning_effort`, none when it lists none, and its default level is the one it names in `defaultReasoningEffort`.
When that list is empty, TeamRun asks `session.quota.get`; on Copilot Free, whose plan includes only Auto, the composer's menu and the teammate dialog show Auto with Copilot's note that the plan "currently includes only Auto, which automatically selects the best available model for each task."
TeamRun keeps a signed-in list for each Copilot profile while it runs, so a window or dialog that asks again starts no server; "Refresh models", in the composer's menu and in the teammate dialog, drops it and lists again with `skipCache`, so a model turned on or off in the provider's Copilot settings, or a new plan, shows without a restart.
A listing that was already running when the refresh began still answers the requests that joined it, but TeamRun keeps only the refresh's answer, so a sign-out shows at once.
When that server fails or doesn't answer, as a CLI without `--headless` does, TeamRun lists over ACP and writes one line to its log saying the listing failed or timed out, without anything the server said.
When ACP lists no models either, the listing fails, and the composer's menu and the teammate dialog say the models could not be refreshed, with "Refresh models".
When it answers signed in with no models on any other plan, TeamRun keeps nothing and lists over ACP the same way, logging that the list came back empty; when ACP offers none either, the composer's menu and the teammate dialog say Copilot's model list came back empty, with "Refresh models" at the end of the menu's Model label and under the dialog's Model field.
Both notes also say that a changed plan shows only after a fresh sign-in, by running `copilot login` in a terminal and then "Refresh models": Copilot keeps answering with the plan its GitHub sign-in carries, so a refresh alone lists the old plan's models.
The model picker shows Auto, Copilot's own name for running with no model chosen, and the listed models; with no list it can read, it shows Auto and a note saying Copilot doesn't list its models, as for every other provider.
The Teammates table, the member strip and a Copilot reply's header name Auto or the model.
When the chosen model is missing from the list TeamRun keeps for the profile, as every model but Auto is on Copilot Free, TeamRun takes it that Copilot ran Auto, so the reply's header and the composer's line say so, for example "Auto, kimi-k3 not available"; with no list kept, they name the chosen model.
TeamRun starts Copilot with `--model` set to the chosen model, whose id must start with a letter or digit and use only letters, digits, `.`, `_`, `:`, `/` and `-`.
A known limit: someone who set a default model in Copilot's own settings gets that model, not Auto, and Copilot doesn't say which over ACP.
The effort picker offers the chosen model's levels, and for Auto, which lists none of its own, whether chosen as Copilot's default or as the Auto row Copilot lists, every level a listed model offers, from lowest to highest; TeamRun starts Copilot with `--reasoning-effort` set to the chosen level, so a new choice applies from the next turn, and leaves it out while no level is chosen.
`minimal` needs Copilot CLI 1.0.69 or later.
A chat resumes its Copilot session with `session/load`; when Copilot can't load it, TeamRun starts a new session with the chat's history.

### Antigravity

Antigravity names its models only in a signed-in session, so TeamRun keeps the models each reply's new session names in the provider's profile, in `.teamrun-models.json`, and lists those, starting nothing.
Until the provider's first reply, the teammate dialog and the composer's menu say Antigravity's models aren't listed yet and use its own default; they list them at the next load after that reply, or on "Refresh models".
A model listing and a sign-in check never sign in: the check says the provider is signed in when Antigravity's token file exists in its profile, which TeamRun doesn't open, and Antigravity offers its Google sign-in, and a reply signs in, in the default browser when the token has expired.
Antigravity shows no sub-agents in TeamRun, since its ACP server reports none.

### Cursor

TeamRun runs Cursor's CLI as `cursor-agent acp`, and passes the chosen model when it starts it, with `--model`.
Install in Add provider's dialog puts a pinned build of Cursor's CLI, 2026.10.22-27dcf5f, in TeamRun's data folder, checked against the SHA-256 and size TeamRun recorded for it, since Cursor publishes none; a Cursor the person installed with Cursor's own install command comes first and updates by its own means.
Each Cursor provider has its own empty profile folder, which holds Cursor's configuration and data, apart from the person's own Cursor configuration.
Cursor in TeamRun also starts the MCP servers in your `~/.cursor/mcp.json`, `%USERPROFILE%\.cursor\mcp.json` on Windows, outside the profile: Cursor reads that file from the home folder whatever the profile, and has no setting to skip it; the add hint says so too.
Whether those servers' tools ask through TeamRun's approval card is not yet checked.
Cursor signs in in a terminal: the provider's Sign in runs `cursor-agent login` for its profile, and Sign out runs `cursor-agent logout` there.
On macOS, Cursor keeps its sign-in in the login keychain, which every Cursor profile on the Mac shares, the person's own Cursor CLI too, so TeamRun takes one Cursor provider per Mac and refuses a second with that reason; its Sign out also signs the person's own Cursor CLI out, and its Sign in replaces the account that CLI uses, as the add hint, the sign-in message and Sign out's confirmation say there.
On Linux and Windows each profile keeps its own sign-in, in a file under `XDG_CONFIG_HOME` on Linux and `APPDATA` on Windows, which TeamRun points into the profile; the commands Cursor runs inherit it, so tools that keep their settings there, such as git's `~/.config/git/config` and gh's settings and sign-in on Linux, or gh's and npm's folders under `%APPDATA%` on Windows, don't find the person's own in a Cursor turn.
On macOS TeamRun changes neither.
The provider shows the version, plan and account that `cursor-agent about` reports.
A chat resumes its Cursor session in the chat's folder, and when Cursor no longer has it, the reply starts a new session and says so.
On a plan that doesn't include the chosen model, Cursor answers each message by asking to upgrade, and TeamRun shows that answer as the reply.
TeamRun turns off Cursor's update check and background update in the profile, and the profile's allow list names only the TeamRun tools the person approved; whether a repository's own `.cursor/cli.json` allow list also lets Cursor run commands or tools without asking is not yet checked.
Cursor offers Agent and Ask; its Plan mode is off, since it waits on a plan approval TeamRun doesn't show.
An API key is off too: TeamRun signs Cursor in only with its browser sign-in, and never reads, stores or passes a Cursor credential.
Cursor can't fork, compact its context, report plan usage, show sub-agents or use a team's MCP servers in TeamRun, since its ACP server offers none of them.

### fx

TeamRun runs fx as the person installed it, with fx's own install command, as `fx acp`, and installs nothing for it. fx shows the same way on every platform; its releases have no Windows build yet, so on Windows it stays not found until the person has one.
TeamRun finds fx on the `PATH`, in the folder `FX_INSTALL_DIR` names, or in `~/.local/bin`, and doesn't install it.
fx in TeamRun uses the person's own fx: its sign-in, settings, saved sessions and MCP servers, which fx keeps in `.fx` in the home folder.
fx 0.0.16 has no setting or variable that moves them, so TeamRun makes no profile for fx, and the provider's folder is that `.fx`.
TeamRun takes one fx provider per computer, on every platform, and refuses a second with that reason.
It doesn't point `HOME` elsewhere for fx, since every command fx runs, such as git, gh, ssh and npm, would then lose the person's setup.
fx signs in in a terminal: the provider's Sign in runs `fx login`, which signs in the person's own fx.
Signed out, fx refuses to start a session, and TeamRun shows the provider signed out and asks for its Sign in.
fx reads the MCP servers in the person's `~/.fx/mcp.json`, and a project's `.mcp.json` once the person approves it with `fx mcp approve`.
fx offers Auto, its default, which checks each action with an automatic safety review instead of asking, Ask, which asks before each change, and Full access, which runs every action without asking.
The models are those of the provider the person's fx uses, such as Vercel AI Gateway; TeamRun leaves fx's provider choice as the person's fx has it.
An API key is off: TeamRun leaves `AI_GATEWAY_API_KEY`, `VERCEL_` and `FX_` variables out of fx's processes, and never reads, stores or passes an fx credential.
fx can't fork, compact its context on request, report plan usage, show sub-agents or stop a background command in TeamRun, since its ACP server offers none of them.

### Muse Code

TeamRun runs the person's own Muse Code as `muse acp`, setting `MUSE_EXPERIMENTAL_ACP=on` for its own runs only, since Muse Code's ACP server is experimental and stays closed without it.
TeamRun installs nothing for Muse Code: Add provider shows Muse Code's install command, which the Providers tab's add panel runs in a terminal from Add.
On macOS and Linux TeamRun runs Muse Code's launcher, `muse`, on the PATH or in `~/.local/bin`, since the launcher updates Muse Code and removes the binary it replaced.
On Windows, which can't start `muse.cmd` without a shell, TeamRun runs the binary that `.muse-version` names in `MUSE_INSTALL_DIR`, beside `muse.cmd` on the PATH or in `%LOCALAPPDATA%\Programs\muse`, reading `.muse-version` again at each start, and otherwise `muse.exe` on the PATH.
A Muse Code provider's profile is a config folder, `~/.config` by default; the person's own folder runs with their environment as it is, so Muse Code in TeamRun shares its settings and its sign-in with the person's own Muse Code.
TeamRun names any other folder to Muse Code with `XDG_CONFIG_HOME`, which moves the configuration of every program Muse Code runs that reads that variable too, such as `gh`.
On macOS, Muse Code keeps its sign-in in the login keychain, which every Muse Code profile on the Mac shares, the person's own Muse Code too, so TeamRun takes one Muse Code provider per Mac and refuses a second with that reason; its Sign out also signs the person's own Muse Code out.
The provider's Sign in runs `muse login` in a terminal, and Sign out runs `muse logout` there; TeamRun never reads what `muse login` keeps.
Muse Code's ACP server has no fork, sub-agents or background commands, as a live check found, and ACP carries no plan usage, so TeamRun offers none of them for it, and each shows off.
Muse Code's ACP guide also lists read-only and plan modes, closing or deleting a session from the editor, audio prompts and ACP versions other than 1 as missing.

### Pi

TeamRun runs the person's own Pi as `pi --mode rpc` and reads its records through its own reader, which ends a record only at a line feed.
TeamRun installs nothing for Pi: Add provider's dialog shows Pi's install command for the person to run, Pi's own installer, `curl -fsSL https://pi.dev/install.sh | sh`, on Linux and macOS, which installs under the home folder without administrator rights, and `npm i -g @earendil-works/pi-coding-agent` on Windows.
Where Node.js is missing, Pi's installer offers to install it, which can run `sudo apt-get`; it ends by asking whether to start Pi now, and a yes keeps Pi running in the install terminal, so TeamRun adds the provider once the person quits it.
TeamRun finds `pi` on the PATH, and on Windows the script behind npm's `pi.cmd`, run with the `node.exe` beside the shim or on the PATH.
Pi 1.1.0 or later is needed, since TeamRun waits for Pi's `agent_settled`; an older Pi fails the sign-in check and the turn, naming both versions.
A Pi provider's profile is a Pi folder, `~/.pi/agent` by default, named to Pi by `PI_CODING_AGENT_DIR`, so Pi in TeamRun shares its settings, sign-ins, sessions and extensions with the person's own Pi.
The sign-in check runs `pi auth check --provider <provider> --json` for the provider that `defaultProvider` in the profile's `settings.json` names, or else the provider of the model Pi starts with, as `get_state` reports it, so a key in the environment counts; with neither, the provider shows signed out, saying to choose a model in Pi.
A model listing and that `get_state` run Pi with `--no-session --no-mcp --no-skills --no-context-files --no-prompt-templates --no-themes`, and a fork runs it with the same switches except `--no-session`.
So Pi's own MCP connects none of the person's servers, and no skills, prompt templates, themes or `AGENTS.md` and `CLAUDE.md` files load.
The person's extensions still load, since an extension can register the models the list shows, and an extension that connects servers itself can still do so.
Pi signs in in a terminal: the provider's Sign in runs plain `pi` there, the person types `/login` and then `/quit`, and TeamRun checks the sign-in when Pi quits or the terminal closes, as the terminal's hint and notice say.
Chats keep their sessions in Pi's own session folder; a chat resumes its session with `--session`, a fork starts Pi's `fork` at the next message, or `clone` after the last one.
The models are the ones Pi's `get_available_models` lists, named `<provider>/<model>`, with Pi's thinking levels for a reasoning model, leaving out those its `thinkingLevelMap` marks unsupported and adding `xhigh` and `max` where it maps them; Pi's current model is the default.
Each reply reports Pi's tokens and cost, and the context Pi's `get_session_stats` reports; Compact runs Pi's `compact`, and images go to Pi with the message.
Approvals go through a small TeamRun extension, which TeamRun writes to its data folder and passes with `--extension`: in Ask first it asks before each tool but `read`, `grep`, `find` and `ls`, in Read only it refuses those other tools, and in Allow all it asks nothing.
Pi can't report plan usage, show sub-agents or run background commands in TeamRun, since Pi has none of them; each shows off with that reason.
Pi's own MCP servers run as the person set them up in Pi, and TeamRun can't switch them; Ask asks before each of their tools, and Read only refuses them.
A team's MCP servers stay off in Pi chats: a Pi extension could add one for a chat, and TeamRun doesn't offer that yet; each shows off with that reason.

### Context compaction

Claude Code, Codex, GitHub Copilot, Grok and OpenCode compact their own context when it fills, and a reply shows each compaction as one step, such as "Codex compacted its context.", after the text written before it.
TeamRun declares `session.compaction` to every ACP agent, so an agent that sends ACP's `compaction_update` shows its completed compactions too; each `compactionId` shows once, and one compaction reported both ways, as Grok can, shows once.
A turn whose context is full fails with a line that names the provider and asks for `/compact` and a retry.
A message whose text, without its mentions, is exactly `/compact`, with no files, asks each teammate it goes to, or the chat's default provider, to compact its resumed session instead of taking a prompt, so "@Codex /compact" compacts only Codex's.
When there is no session to resume, or the session can't be resumed, the reply says there's no session to compact, and nothing runs.

| Provider | Reports a compaction with | Reports a full context with | Gets `/compact` as | Known from |
|---|---|---|---|---|
| Claude Code | its `compact_boundary` message | `prompt_too_long` | the prompt | its documents and types |
| Codex | its `contextCompaction` item | `contextWindowExceeded` | `thread/compact/start` for the thread | its source |
| GitHub Copilot | nothing over ACP | nothing over ACP | the prompt's only text, without the role and the chat's context | its documents |
| Grok | its `auto_compact_completed` update | a `context_length` retry that failed | the prompt's only text, without the role and the chat's context | its source |
| OpenCode | nothing over ACP: its summary comes as the reply's text | not captured | the prompt's only text, which its ACP server runs as its own `compact` command | its source and a capture, 1.19.4 |
| Cursor | nothing over ACP | nothing over ACP | nothing: the reply says Cursor can't compact its context | its ACP documents |
| Antigravity | nothing documented | nothing documented | nothing: the reply says Antigravity can't compact its context | its documents |

Only OpenCode's was seen live, on its free models with no sign-in (OpenCode 1.19.4): no signed-in provider was at hand, so no other manual `/compact` was recorded.

## The command line

The app's command line runs TeamRun's commands as `<app command> teamrun <command>`, and `--json` prints each one's result as JSON:

| Command | What it does |
|---|---|
| `list-projects` | Lists the projects: id, name and folder. |
| `open-folder <folder>` | Opens a folder as a project, or gives the project already open there; a relative folder is read from the current folder, a leading `~` is the home folder, and a folder that isn't there is refused. |
| `forget-project <projectId>` | Forgets a project and deletes its chats and their messages; the folder's files stay. |
| `list-chats [--project <id>]` | Lists the chats of every project and those without one, or of one project: id, title, teammates, and whether a reply is running. |
| `new-chat [<projectId>] [--title <title>]` | Starts a chat in a project, or without a project in an empty folder of its own. |
| `rename-chat <chatId> <title…>` | Renames a chat. |
| `delete-chat <chatId>` | Deletes a chat and its messages. |
| `move-chat <chatId> <projectId>` | Moves a chat to another project. |
| `search <text…> [--limit <count>]` | Lists the chats whose title or messages hold the text, ignoring case, 20 at most by default and 100 at most, the latest active first, each with where the text is: in the title, or a message's number and the text around it. |
| `list-messages <chatId> [--before <sequence>] [--limit <count>]` | Lists a chat's latest messages, 20 by default, or those before a sequence number. Your own messages are by `User`; a message a teammate sent from another chat names the teammate and that chat. |
| `send <chatId> <text…> [--teammate <name>] [--kind <kind>] [--model <id>] [--effort <level>] [--provider <id>]` | Sends a message as the app does, with `@` mentions naming teammates, and prints the ids of the message and of the replies it started, without waiting for them. With no teammate named and no `--kind`, the default teammate set in Settings answers, not the responder chosen in the chat's composer, with `--model`, `--effort` and `--provider` in place of its own; with no default set, or a default with no provider and no `--provider`, it refuses. `--kind` needs a `--provider` of that kind, except in a teammate's own send. `--model` without `--effort` answers at the model's own default effort. `--effort` for a kind whose ability row says it can't choose an effort is refused with that row's reason, before anything is sent. A `--provider` of another kind answers with its own model and effort, and one of the default's kind keeps the default's model and effort only where that provider's models list them. With `-` alone for the text, it reads the message from standard input, and refuses when that is a terminal. Run by a teammate in a chat, it sends as that teammate, as the next section says. |
| `cancel <chatId>` | Stops the chat's working replies, a hand-off's among them, and names the ones it stopped. |
| `rewind <chatId> <messageId> [--restore-files]` | Removes a message and every message after it, and says whether the provider's session continues from there or the next reply starts a fresh one; with `--restore-files`, it also puts back the files the removed replies changed, where their checkpoints allow, and says why when it can't. |
| `list-approvals <chatId> [--pending]` | Lists the approvals of a chat that wait for an answer and every question it was asked, or only those that wait. |
| `list-providers` | Lists the providers and their sign-in. |
| `check-provider <providerId>` | Checks a provider's sign-in. |
| `add-provider <kind> <label> <profileFolder>` | Adds a provider signed in as its profile folder is, and prints its id; a relative folder is read from the current folder, a leading `~` is the home folder, and a folder that isn't there is refused. Some kinds take one provider at most, and no two providers share a folder. |
| `remove-provider <providerId>` | Removes a provider and leaves its profile folder as it is; a default teammate that answered with it has no provider until one is chosen. |
| `list-models <providerId>` | Lists a provider's models: id, name and efforts, and which is its default. |
| `live-check --provider <id> [--prompt <text>]` | Runs one reply of a provider end to end, at its default model, in a chat without a project that it deletes after, with its folder, and prints the reply; the prompt asks for the word PONG by default. It fails when the reply ends other than completed, and stops a reply that asks for an approval, which only the window answers. A chat it can't delete is named, for `delete-chat` to remove. Ctrl+C, `--timeout` or a runtime that goes away ends the command at once and leaves the reply running in the chat `Live check`: `list-chats` finds it, `cancel <chatId>` stops the reply and `delete-chat <chatId>` removes the chat. |
| `list-teammates` | Lists the teammates, with each one's provider and its signed-in account, model and effort, chats, whether it is answering now, and usage. |

No command answers an approval: only the person answers one, in the window.

### Teammates across chats

TeamRun starts each teammate's turn, and each turn of a chat's default teammate, with `TEAMRUN_SENDER_TOKEN`, a random token it issues for that turn alone and revokes when the reply ends, whatever the provider, and their instructions say in a few lines how to reach other chats' teammates.
The command they name, `<app command> teamrun`, runs in the turn's shell in a development app and an installed one alike, on Windows, macOS and Linux: the turn's `PATH` leads with a folder TeamRun writes as it starts, `modules/teamrun/command` in the data directory, whose command runs the app's own program on the running app's data.
It holds a `sh` script, which Bash and other POSIX shells run, and on Windows a `.cmd` beside it, which PowerShell and `cmd.exe` run; the `.cmd` reads the app's paths from the turn's environment, so a folder whose name goes outside ASCII works there too.
WSL's shells aren't covered.
The instructions have teammates pipe a message into `send <chatId> -` from a quoted here-document or here-string, so no shell reads its quotes, `$`, `%` or `!`.
When the folder can't be written, the runtime's log says so, and the instructions leave the lines on other chats out.
`send` run from that process during the turn sends as that teammate: TeamRun reads the teammate and its chat from the token, never from ids the caller gives, marks the message with them, never as the person's, and starts the target chat's teammate at once, or after the reply running there.
A token that TeamRun didn't issue, or whose turn has ended, is refused; without the variable, `send` sends as the person, as it always has.
A default teammate's message shows under its provider's name, such as "Codex", as its replies do, and reaches the other chat as `From the default teammate (Codex) in chat "<title>" (<id>):`, which a teammate named Codex can't be mistaken for; the instructions say to answer it with no `--teammate`.
In such a message, a name inside quotation marks or code names no one, and the teammate's own name starts no one.
When it names no one else, the teammate given with `--teammate` answers, or else the responder chosen in that chat's composer: a teammate, or in a chat with no teammates the default teammate, with its kind, provider, model and effort.
When that choice is the sender, or none is chosen, the message is posted and no one starts.
The composer keeps a chat's choice when it opens the chat, so a chat from an earlier version, not opened since, has none chosen.
The teammate reads such a message as from the sender in that chat, named by the chat's current title and its id, and its instructions say to name a chat to the person by its title and keep the id for the command.
The answer comes back the same way, and a chain of such messages, with the hand-offs between them, stops at the Teammate hand-offs limit in Settings › TeamRun, from 0 to 100 and 4 by default.

## Releases

Noldova builds, signs and publishes the official installers from this repository's source at one commit: it builds TeamRun's packages there, installs `app/` from those archives and packages the app, and publishes no package to a registry.
Anyone can build the app from the same source, as [Building from source](#building-from-source) and [Starting the app](#starting-the-app) say.
`npm run build` builds the packages, `@noldova/teamrun` and the TeamRun packages it depends on, `@noldova/teamrun.runtime`, `.core`, `.protocol`, `.providers`, `.services`, `.window` and `.cli`, and writes one archive per package under `src/` to `_packages/`, each holding `LICENSE`, the package's `license`, the version and the commit as its `gitHead`; it compares each archive with the files its package's own `scripts/build.ts` copies in, failing on any difference, and `npm run install:app` installs the app from those archives.
The version, which the root `version.json` holds, changes in a pull request before a release, in `version.json` and the root `package.json` together, since the build stamps the root `package.json`'s version on every package, and the Version file check fails while they differ.
`npm run build`, and with it `npm test`'s Packages check, refuses a package under `src/` that isn't marked `"private": true` or that has a `publishConfig`, so no package can be published to a registry by mistake.

`npm run build --silent -- --list-copies` builds nothing and prints one line per file the build copies into a package from outside its folder: the source's path from the repository's root, the package's name and the file's path in the package, separated by tabs and with `/` between folders, then a last line `end of copies`, which it prints even when nothing is copied.
It lists the root `LICENSE`, the package's `README.md`, the module files the TeamRun package ships, and every file a package's own `scripts/build.ts` names with `--inputs`.

[CHANGELOG.md](CHANGELOG.md) says what each version changed.

`desktop.supportedTargets` in `app/package.json`, the targets an official build calls supported, lists Linux x64 and arm64, Windows x64 and arm64, and macOS x64 and arm64.
The installed app checks `desktop.updateFeed` in `app/package.json`, `https://updates.teamrun.noldova.com/`, for updates.
Before an official release, a Windows x64 computer runs the end-to-end specs in its desktop session with `TEAMRUN_E2E_HIGH_CONTRAST=1`, which adds the real High Contrast check of `high-contrast.spec.ts`, after `install:app` and `build:app`.

## Checks

Every pull request into `main` must pass both checks before it merges.

| Check | What it verifies |
|---|---|
| Check / Linked issue | The organization's shared check, which `.github/workflows/require-linked-issue.yml` calls from its `check` job, named "Check": the PR description has a standalone `Issue: #N`, `Issue #N` or closing reference, such as `Closes #N`, that names an issue in this repository. |
| All targets | The shared build and test, with every target's job, the Linux x64 Angular tests and the end-to-end test, the Angular tests and app on every other target, and the unsigned package passed. |

The "Build and test" job calls the organization's shared `build-and-test.yml` workflow at the `.github` repository's v2.36.0, which runs each target in a job of its own, such as "Build and test / Windows x64": it builds and runs `npm test -- --skip-test-details --skip-coverage-details` with `NOLDOVA_SEPARATE_TEST=angular`, which leaves the Angular tests and coverage out.
Its "Separate test" job runs `npm run test:angular`, the Angular tests and coverage alone, on Linux x64, and its "End-to-end test" job runs the [end-to-end test](#end-to-end-test).
On every other target, "<target>, Angular tests and app" installs and builds, runs `npm run test:angular`, and then installs and builds the app; the end-to-end test and the unsigned package install and build the app on Linux x64.
The jobs run side by side, so the run takes about the longest of them, not their sum.
`NOLDOVA_SEPARATE_TEST` takes `angular` or nothing, and `npm test` refuses any other value before it runs a check.
Each job runs on the GitHub-hosted runner its target's `runs-on-*` output names, from the organization's shared `versions.yml` workflow, which the `.github` repository's README explains under "Shared settings".

Every pull request run, a draft's too, runs Linux x64, Windows x64 and macOS arm64, and every push to `main` adds macOS x64.
Each run's concurrency group is the workflow and the pull request's number or the ref, and a pull request's newer run cancels an older one.
Each long step of the Angular tests and app job has its own time limit, about twice its slowest time, so a step that runs out fails with its name, and the job's limit only backs them up; each of the shared workflow's jobs has one limit, 55 minutes, which its `timeout-minutes` input sets.
The unsigned package job never signs and gets no secret; only an official build signs.
The other ARM64 targets have no CI job yet.

A target's job in the shared workflow builds the packages with `npm run build`, which first installs the dependencies, the Angular project's among them, with `npm ci`, and runs every check but the Angular tests with `npm test`.
With the organization's `pipelines` tool, `@noldova/tools.pipelines.github` 0.0.21, it checks that the toolchain is the Node.js and npm `versions.yml` names, 26.13.1 with 11.20.0, that `.gitattributes` holds `* text=auto eol=lf`, that every tracked text file uses LF line endings and ends with exactly one newline, and, after the tests, that they left every tracked file unchanged.
The Angular tests and app job checks the toolchain itself and installs the dependencies with `npm ci`, which `npm run install:root` runs, before `npm run build`.
Every install takes its packages, Noldova Desktop's and the modules' among them, from npm's public registry; while the repository is private, `versions.yml` also points the `@noldova-com` scope at GitHub's registry with the run's token, which the shared jobs' `packages: read` permission allows and which no TeamRun package uses.
The shared jobs keep Playwright's Chromium headless shell between runs with `actions/cache`, keyed by the runner and the `playwright-core` versions the lockfiles lock, so the Angular tests' `playwright install --only-shell chromium` downloads it only on a miss; the Angular tests and app job downloads it on every run, as before.
Every npm the job runs, Noldova Desktop's `npm ci` of the app's Angular project among them, has `npm_config_ignore_scripts` set, so no package's install script runs.
None of the packages with install scripts needs one: esbuild, `@parcel/watcher`, lmdb and msgpackr-extract load the binary of their platform's optional package, fsevents and node-pty load the binaries their packages ship, and `@parcel/watcher`'s script builds only when asked to build from source.
The builds and the tests use what the two installs installed: `npm run build`, and `npm test`'s Angular tests, fail when the Angular project isn't installed, or was installed before the root's `package-lock.json` last changed.
The Node.js and npm versions the jobs check are the ones the root `package.json` pins in `engines` and `packageManager`.

`npm run build` first runs `npm ci --ignore-scripts --no-audit --no-fund` in the root when the root has no `node_modules`, as on a fresh checkout, which `scripts/installs/root-install.ts` does; it then builds and installs the packages, and nothing for the tests: it compiles each package under `src/` with `tsc`, after the packages it depends on, into `_build/packages/<folder name>`, packs it with `npm pack` into `_packages/` and installs it from there with `npm install --no-save`.
Each install at the root reifies the whole tree, the `src/` workspace's packages among them, so the build installs only before a package whose dependencies it has just packed, with every archive packed so far in one install, and once more at the end, rather than once per package.
That install passes `--legacy-peer-deps`, so npm doesn't resolve a package's peer dependencies, such as the runtime part's Noldova Desktop packages, again: the root `package.json`'s exact pins already give the one copy of each, and an app that installs a published package still gets npm's peer check.
Before it builds anything, when the Angular project in `src/` is installed, it runs the Angular cdk copies check: `npm ls @angular/cdk --all --json --long --workspace src`, run in the root, must list one installed folder, whether hoisted to the root's `node_modules`, nested under a package or under `src/node_modules`, and the build fails, naming every copy's version and folder, when it lists more, or none.
The UI kit pins `@angular/cdk` exactly, so a version of its own in `src/package.json` that differs from the kit's makes npm nest a second copy under the kit without any warning, and the kit's overlays and focus handling would run from one copy and the app's from the other.
`npm test`'s Angular cdk copy rules check, among the checks that build, runs that check on small trees of `package.json` files in a temporary folder, laid out as the root's install lays out its `src/` workspace and installing nothing: it passes one shared copy at the root, and fails a copy of another version under the kit, a second copy of the same version, a copy of the Angular project's own in `src/node_modules`, no copy, a root `package.json` npm can't read and an npm that prints no list, with the output it expects for each.
The checks that read syntax trees, such as Concept files, parse each file with TypeScript's parser, `ts.createSourceFile` in `scripts/structure/syntax-tree.reader.ts`, in their own process, reading its syntax only, with no types.
`npm test` runs the checks that read in a Node process of its own, `scripts/reading-stage.ts`, which writes one result for each to `_build/reading-checks.json` and exits before the checks that build start: Node keeps the memory the syntax trees took until its process exits, and `npm test` would otherwise carry it through the build, the package tests and the Angular tests.
Its output goes to `npm test`'s and to `_build/reading-checks.log`; `npm test` stops it after 5 minutes, and when it is stopped, ends with an exit code other than 0 or on a signal, or ends without a result for each check, every one of them fails, the line after its output says which, with its exit code or signal, and the checks that build don't run.
A filtered run, and `npm test -- documents`, still run them in `npm test`'s own process.
The Dependency pins check holds a shipped package's peer dependencies, as it holds its dependencies, at the root `package.json`'s pins and the root lockfile's versions, which the build's install no longer compares.
A peer on one of the packages Noldova Desktop shares with every module, its own, context's and the kit's, may instead take a range of the one form `>=<lowest> <first refused>`, ending at the next minor below 1.0, or the next major from 1.0, that includes the pin of the project that installs it, the root's, or `src/`'s for the window part, and that project's lockfile then locks that pin.
Angular stays at one exact version until Noldova Desktop takes a range on a window part's Angular peers.
A module declaration under `src/`, `module.json`, must name `noldovaDesktop` in that form, from a version to the next minor below 1.0, or the next major from 1.0, and every TeamRun package's peers on Noldova Desktop's packages must take that same range.
The OnPush strategies check, among the checks that read, fails on any `changeDetection` key whose value isn't `ChangeDetectionStrategy.Eager` in a `.ts` or `.mts` file the repository holds, naming its file and line, as ui-components' own check does: OnPush is every component's default since Angular 22, so a component leaves the strategy out, and writes one only to choose Eager, with the reason.
It fails, too, when it finds no such file.
The Version file check, among the checks that read, fails when the root `version.json`, which the release reads, holds another version than the root `package.json`, which the build stamps on every package, and fails, naming the file, when either is missing, isn't JSON or holds no version string.
It holds the TeamRun packages a package under `src/` names at `__VERSION__`, which the build stamps, and those `app/package.json` names at the root `package.json`'s version, which `npm run install:app` installs from the build.
It also fails when a shipped package lists one of the packages Noldova Desktop shares with every module, its own, context's and the kit's, among its dependencies rather than its peer dependencies, since Noldova Desktop's build refuses an app whose module brings a second copy of one.
A test imports what the package exports by the package's name, and the package's internal files by their path under `src/`; in the compiled tests that path leads to the installed package, so a test and the package share one copy of each file.
It stamps the root `package.json`'s version into each package's manifest, and its `teamrun.protocolVersion`, which it requires, into the `__PROTOCOL_VERSION__` placeholder of a package's compiled `resources.js`.
It copies the root `LICENSE` into each package, with the package's own `README.md` and `module.json` when it has them.
It rebuilds only what changed since the last build, counting both versions as inputs, and says which packages it built and which it reused.
A package that takes `@angular/core` as a peer dependency, the window part, is an Angular package: its own `scripts/build.ts` compiles it with the Angular compiler of the project in `src/`, in partial compilation mode, as Noldova Desktop's window build needs, and ships its `src/api` declarations.
The TeamRun packages it depends on are the ones the build installs at the root, which the Angular project, as the root's workspace, loads too, and it counts `src/package.json` and `src/tsconfig.json` among the package's inputs.
It counts those installed packages among the package's outputs, so an install that removed them, such as `npm ci` after a build, leaves the package stale and the next build installs them again.
`npm test` runs the same build as its Packages check, which reuses what is current.
Its Copy list check, after the Packages check, runs `npm run build --silent -- --list-copies` and fails unless the output ends with `end of copies` after at least one line, and every line before it holds three fields separated by tabs: a source that is in the repository, the name of a package under `src/`, and a path in the package, both paths relative with `/` between folders.
Each listed file must also be in that package's archive in `_packages/`, byte for byte the same as its source.
Its Package tests and coverage check fails when a package's build is missing or stale; otherwise it compiles each package's tests into `_build/tests/<folder name>`, reusing those that are current, and runs every package's tests through `scripts/checks/package-test-entry.ts`, which drives `@noldova/context.testing`'s test runner, in as many processes at once as the machine has cores, at most 4, or as `NOLDOVA_TEST_SHARDS` says.
Each process takes the next test file not yet taken, those with the most tests first, by creating its marker in `_build/test-claims/`, so every file runs once, in one process; the check then merges the processes' totals, skipped tests and failed tests into `_build/`.
The tests of a file run one at a time, each within 30 seconds, or 75 seconds for a test in the `ProcessListing` category, which waits on real process listings: two listings of up to 30 seconds each, as a stop on Windows runs, and its setup and grace.
When one exceeds its limit, its process stops there, counts the tests it took and didn't start as unreached and fails.
The entry gives a running test its limit in `NOLDOVA_TEST_BUDGET`, and a providers spec checks that the longer limit still covers two listings and the stop grace, so raising the listing timeout alone fails.
The run fails too when its process doesn't exit within a second of the last test, naming the resources the tests left open, and the check stops a run that doesn't end within 5 minutes, such as one a test blocks without awaiting.
When a test process ends before writing its result, or the check stops it at its limit, the check says how it ended, its exit code or its signal, and which test was running or last ended in which process, as each process writes each test it starts and ends to its own `_build/test-progress-<n>.txt`.
Its Angular tests and coverage check installs the browser the Angular tests run in, with Playwright, and runs the Angular project's specs with `ng test`, Vitest in a headless Chromium, and writes the full output to `_build/angular-tests.log`.
Before each run it clears `node_modules/.vite` and gives the run a key of its own in `NOLDOVA_PRE_BUNDLE_RUN`, and a plugin in the Vitest config sets the cache folder of the tests' project to `node_modules/.vite/<key>`, so Vitest pre-bundles under `node_modules/.vite/<key>/vitest/` and a process left from an earlier run that still writes its pre-bundle can't write into this run's.
It's a plugin because Angular's builder makes the tests' project from the config's plugins, `test`, `optimizeDeps` and `resolve` only, so a top-level `cacheDir` never reaches it.
`ng test` run by hand, without the key, keeps Vitest's own folder, `src/node_modules/.vite/vitest/`, under the Angular project's own `package.json`.
`src/vitest.config.mts` sets `test.api.port` to 24315, below the dynamic range, because Vitest's browser server otherwise takes 63315, which Windows can reserve; a reserved port is refused, not in use, so listening fails with `EACCES` and Vite doesn't move on to the next port, and Vitest ignores port 0, so it can't ask the system for a free port.
At the browser's first request for one of the dependencies Vite pre-bundled for it, under the Vitest cache's `deps/`, the run records each pre-bundled file's size and SHA-256 in `_build/angular-pre-bundle.json`, then parses each script; one with a parse error fails every request for a pre-bundled file at once, naming that file, so no spec runs on a broken pre-bundle.
Each check writes one line to the run's output, with the folder, its file count and the scripts parsed; a folder or a record it can't read or write is logged in one line and lets the requests through, so a file-system error never fails a run.
Each spec file's code is compared as Angular's builder served it and as Vite's transforms leave it: one whose transformed code imports a relative module the served code doesn't fails at once, naming both codes' size and SHA-256 and keeping both in `_build/angular-spec-transforms/`, and at the end of the run the check records each spec file's two digests in that folder's `record.json` and writes one line with their count; a file it can't write is logged and never fails a run.
When the Angular tests fail in the Angular tests and app job, it keeps the dependencies Vitest pre-bundled for the browser, `node_modules/.vite`, that record, `_build/angular-spec-transforms/` and the Angular tests' own output, `_build/angular-tests.log`, as its artifact `angular-pre-bundle-<target>-<attempt>` for 14 days, the run attempt making each attempt's name its own, so a pre-bundle the browser refused can be read and set beside what the run found at its first request; on Linux x64, the shared workflow's Separate test keeps the same files through its `separate-test-report` input, as its artifact `separate-test-report-<attempt>`, when the Angular tests fail or the job's time limit cancels them, for the days `versions.yml` keeps a run's artifacts.
Its Script tests check runs the specs in `scripts/profile/tests/`, `scripts/angular/tests/`, `scripts/checks/tests/`, `scripts/structure/tests/`, `scripts/packages/tests/` and `scripts/installs/tests/` with Node.js's own test runner, `node --test`: they cover the [profile readers](#profiling), whose output no run of the build or the tests shows, the app install's lockfile comparison, whose refusals no passing install shows, the pre-bundle and spec transform checks, the OnPush strategies check, the Version file check, the Copy list check, the Pages boundary check and the other checks that read syntax trees, whose refusals no passing run shows, the syntax tree reader they share, the process the checks that read run in, whose failure no passing run shows, and the pre-bundle run's own folder, which a single run can't tell from a shared one, while the repository's other scripts have no tests of their own, since the build and the test run prove them.
Its Script types check type-checks `scripts/profile/` as a project of its own, `scripts/profile/tsconfig.json`, which adds the browser's types that Playwright's types and the code the harness runs in the page need; the other scripts keep Node.js's types alone.
`npm test` runs the checks that only read the repository's files first, from Documents to Version file.
When one of them fails, it stops there, before the checks that build, compile or run tests, and names the ones it didn't run; the later checks run past each other's failures.

"All targets" also runs on every push to `main`.

`npm test -- documents` runs only the document checks, `npm test -- angular`, which `npm run test:angular` runs, only the Angular tests and coverage, and `npm run format:documents` puts each sentence of the Markdown documents on its own line.
`npm test -- --filter <text>` runs the checks that read whose titles hold the text, such as `--filter Concept` for Concept files and Concept folders, then the package tests that `@noldova/context.testing` selects by the text and the Angular specs whose paths hold it.
The Flake proof's `filter` splits on spaces, so there a title with a space is selected by one of its words.
A common word selects checks that read too: `names`, `files` or `values` runs Bucket names, Interface names, Concept files or Enum values beside the tests it selects.
`npm test`'s Reading check filters check, among the checks that read, checks that a filtered run selects from the same checks that read as the full run, and runs that selection over stand-in checks.
`--repeat <count>` runs the selection that many times and stops at the first failure, and `--rerun-failed` runs failed tests once more and records those that pass in `_build/flaky-tests.json`.
`--skip-test-details` leaves passing tests out of the package tests' report, and `--skip-coverage-details` leaves fully covered files out of their coverage table; failures, skips, incomplete files and the totals stay, and the shared build-and-test workflow passes both.

### End-to-end test

The shared workflow's "End-to-end test" job runs on Linux x64 beside the targets' jobs, so a pull request's checks take no longer.
It builds the packages as a target's job does, then runs `npm run install:app && npm run build:app`, which the `end-to-end-prepare` input names; `build:app` downloads Electron's binary.
It then runs `npm run test:e2e` under Xvfb with a session bus of its own and an unlocked keyring, and stops the test three minutes before the job's 55 minutes run out, so its report is still kept.
`npm run test:e2e` runs the specs in `src/noldova.teamrun/tests/e2e/` with Playwright's test runner, from the Angular project's `playwright`, and writes its report to `_build/e2e/`, which a failed job keeps as the artifact `end-to-end-report-<attempt>`, for the days `versions.yml` keeps a run's artifacts.
Each spec starts the built app from `app/` with Electron, with a data folder, a device folder and a home folder of its own, and quits it through the app's command line.
Each start maps every `.test` name to `127.0.0.1` with Chromium's `--host-resolver-rules`, so `browser-loopback-limits.spec.ts` can record what Browser does with a name that resolves to this computer; no other spec uses a `.test` name.
In a spec that sets `test.use({ isAppTraced: true })`, now `computer-use.spec.ts`, the fixture records a Playwright trace of each start of the app, with screenshots and DOM snapshots; after a failed test it keeps the running app's trace as `trace.zip` in the test's folder under `_build/e2e/results/`, so the artifact holds it, and after a passed test it drops it.
A trace ends with its app, so for a test that quit or restarted the app only the last start's trace is kept, and an app that crashed or exited on its own before the test ended keeps no trace.
`npx playwright show-trace trace.zip` opens it.
With every spec traced, the job's test step took 3:03 in one run, past the 1:25 to 2:49 of main's 10 runs before it, so a spec turns tracing on only while it needs a timeline.
The home folder is the app's `HOME`, and on Windows also its `USERPROFILE`, with `APPDATA` and `LOCALAPPDATA` in its `AppData` folder.
When the test ends, even at its timeout, the app fixture closes the app, killing its process group when it doesn't close within 30 seconds; after a failure it stops what the test's command started and still runs; then it removes those folders.
On Windows, where a file a process holds open keeps its folder from being removed, it first waits up to 10 seconds for every process whose command line names the test's folder, such as Noldova Desktop's runtime, which ends shortly after the app's main process, and then stops any still running that started when the first listing saw it, through the process handle whose start time it compared, so a process that took a finished one's ID is left alone, and waits up to 5 seconds on that handle for it to end.
A holder whose handle gives another start time while the listing still shows it with its own is written as not stopped, and its children are left alone with it.
Once a holder has ended, whether it stopped it or found it already ended, it lists the processes the holder started and stops each that started no earlier than the holder and before any process that took the holder's ID, and theirs in turn, since such a child can keep a file in the folder open without naming it; an ended process starts nothing more, so that listing misses none.
It writes to the test's output what it stopped, each started process with the ID that started it, what it couldn't stop and why, and a listing that failed or ran past 60 seconds, after which the removal goes on.
When the removal still fails, its error names the processes that still name the folder, or says that listing them failed.
A process that holds the folder only as its current folder, with no command line naming it, isn't waited for or named; the one holder measured, Noldova Desktop's runtime, names it.
The chat-terminal specs check that quitting ends the runtime and every process under it: on Linux from `/proc`, and on Windows from one CIM process list per check, which finds the runtime by its command line; both match a process by its ID and start time.

Playwright emulates `forced-colors: none`, a light colour scheme and no contrast preference on every page by default, the app's window included, so the views' forced-colour checks emulate forced colours rather than read the system's setting.
`high-contrast.spec.ts` checks the real Windows setting: it clears that emulation, turns High Contrast on through the system, finds `(forced-colors: active)` matching with the page in the system's `Canvas` and `CanvasText`, turns it off and finds it no longer matching, then puts the setting back as it found it.
It changes a setting of the whole machine, so it runs only on Windows with `TEAMRUN_E2E_HIGH_CONTRAST=1`, which neither CI nor a plain `npm run test:e2e` sets; it runs on a Windows x64 computer, in its desktop session, before each official release, as [Releases](#releases) says.

A provider double stands in for Codex: `tests/e2e/fixtures/codex-double.ts`, which a `codex` script, or `codex.cmd` on Windows, first on the app's `PATH` runs, answers Codex's app-server requests, and for a prompt that starts with `run: ` opens a terminal and runs the rest of the prompt in it through TeamRun's MCP server, as an agent does; for the prompt `tools` it lists the tools that server offers the teammate, in its answer and its log; and for `navigate: <url>` it calls `browser_navigate` and logs whether the page opened or why not.
The chat-terminal specs send an sh command, or on Windows, where an agent's terminal opens PowerShell, a PowerShell one whose program is a child Windows PowerShell; the computer use spec turns it on where it has a backend, Windows and macOS, and checks it offers the computer tools, and elsewhere that it says it didn't start.
The home folder holds an empty `.codex/config.toml`, so the first launch finds the double's profile folder and signs it in, and no credential is written.
A GitHub double stands in for GitHub's device flow in the GitHub sign-in spec: `tests/e2e/fixtures/github-double.cjs`, which the spec loads into Electron's main process with `-r`, since Playwright drops `NODE_OPTIONS` from the app's environment, and which adds itself to `NODE_OPTIONS` there so the runtime's processes load it too.
It writes a line to its log as it loads in each process, and the spec waits for the runtime's before it signs in.
It answers the GitHub module's requests to github.com and api.github.com: a device code the spec names, "authorization pending" until the spec approves the code, then a token and a signed-in user, and 401 for anything else; it logs each one, and refuses and logs a request to any other host but loopback, so the spec never reaches GitHub or needs an account; the spec also catches the links the app opens, so no browser opens.
An ACP registry double stands in for the live ACP registry in every spec: `tests/e2e/fixtures/acp-registry-double.cjs`, which the fixture loads with `-r` after a spec's own doubles on each start and which adds itself to `NODE_OPTIONS` the same way.
It answers the registry's address with `tests/e2e/fixtures/acp-registry.json` and each icon that file lists with `tests/e2e/fixtures/acp-registry-icon.svg`, and refuses and logs any other request to the registry's host, whether through `fetch` or a TLS connection such as `https.get` makes, so no spec waits on the network for the registry.
The fixture reads that log once the app has ended, and a spec that passed fails when the log holds a refused request; the log is attached to each spec's results as `acp-registry.log`.

### Flake proof

The "Flake proof" workflow, `.github/workflows/flake-proof.yml`, calls the organization's shared flake proof, which the `.github` repository's README describes under "Proving flakes", pinned to a full commit SHA; it runs an npm script, `npm test` by default, many times on the organization's runners, the ones the organization's shared `versions.yml` names, as "Build and test" does, to show that a fix holds a flaky test steady.
A member starts it by hand, and each job builds once and then runs the tests in a loop:

```bash
gh workflow run flake-proof.yml --ref <branch> -f "filter=--filter <text>" -f runs=10 -f jobs=2 -f "targets=linux-x64 windows-x64"
```

An end-to-end spec runs as the end-to-end job runs it: `npm run build`, then `install:app` and `build:app` once per job, then `test:e2e` under Xvfb on a 1920×1080 screen and `dbus-run-session` with an unlocked keyring, on Linux x64; its filter is the spec's file and line as Playwright takes it:

```bash
gh workflow run flake-proof.yml --ref <branch> -f script=test:e2e -f "prepare=install:app build:app" -f display=true -f "filter=<file>.spec.ts:<line>" -f runs=10 -f targets=linux-x64
```

| Input | What it takes | Default |
|---|---|---|
| `ref` | The branch, tag or commit to test. | The branch the run starts on. |
| `filter` | The arguments the script takes, separated by spaces, such as `--filter <text>` for `npm test`; empty runs the whole suite. | Empty. |
| `script` | The npm script each run runs, such as `test:e2e` for the end-to-end specs. | `test` |
| `prepare` | npm scripts each job runs once, after `npm run build` and before the runs, separated by spaces, such as `install:app build:app`, which `test:e2e` needs. | Empty. |
| `display` | On Linux, runs each run under `xvfb-run` on a 1920×1080 screen and `dbus-run-session`, with `gnome-keyring` unlocked on a new empty keyring, as the end-to-end job runs `test:e2e`, for a script that opens windows or keeps a secret. Windows and macOS runners have a display of their own. | `false` |
| `runs` | The runs per target, 1 to 200, shared among the jobs, each of which stops after 120 minutes. | 10 |
| `jobs` | The parallel jobs per target, 1 to 4, so that CI keeps runners free. | 2 |
| `targets` | The targets, separated by spaces, from `linux-x64`, `linux-arm64`, `windows-x64`, `windows-arm64`, `macos-x64` and `macos-arm64`. | `linux-x64 windows-x64` |

Each job's summary gives its runs, passes and failures, its log shows the last 60 lines of each failed run, and the failed runs' logs are kept as the job's artifact for the days the shared settings name, 1 for a private repository.

The flake-proof job's concurrency group is named by `ref` and the first 16 hex digits of the SHA-256 of `script`, `prepare`, `display` and `filter`, which a first job, "Concurrency group", works out, since GitHub refuses a run whose group is over 400 characters before it starts, as a filter that names several tests in full makes it.
Runs that differ in any of those go side by side, such as the whole `npm test` suite and the whole `test:e2e` suite on one `ref`; a second run of the same `ref` and the same four shows its first job done and waits at its flake-proof job until the first run ends.

### Coverage

`npm test` measures the coverage of every package, and fails below this requirement.

| Scope | Requirement |
|---|---|
| Every package under src/ but the Angular packages | 100% of executable production code, measured by the package tests through the coverage analysis of `@noldova/context.testing`. |
| The Angular packages, and the module package's `src/api/window.ts` | 100% of statements, branches, functions and lines, measured by the Angular tests, as `src/angular.json` requires. |

The module package's window entry re-exports the window part, which loads only in the Angular project, so the package tests' measure leaves that one file to the Angular tests.
No package excludes a file from coverage, and the check fails a package whose manifest lists coverage exclusions.

### Time per test file

As the organization's [testing standard](https://github.com/noldova-com/.github/blob/main/standards/TESTING.md) asks, measured on Linux x64, a unit test file finishes in under 1 second, and a component spec file's median test in under 100 milliseconds.
Only the maintainer accepts a unit test file over 1 second; these are the accepted ones and those awaiting acceptance:

| File | Time on Linux x64 | Why it takes longer |
|---|---|---|
| `src/noldova.teamrun.core/tests/services/engine/conversation-engine.test.ts` | 8-9 s | Its tests run replies on real Git repositories, about 150 Git calls, and every commit to the SQLite database waits for the disk. |
| `src/noldova.teamrun.core/tests/services/engine/kept-sessions.test.ts` | 2.0-2.7 s in 6 runs on Linux x64; 1.0 s summed on Linux CI, 0.2 s on macOS and 2.0 s on Windows | Awaiting the maintainer's acceptance. Nine of its 15 tests run replies through the engine before they delete or rewind a chat, and each reply stores its progress in the SQLite database, where every commit waits for the disk; its slowest, which deletes a chat after four replies of two kinds, takes 0.3-0.5 s, and its rewind, which restores a file from the chat's checkpoint, 0.2-0.3 s. |
| `src/noldova.teamrun.core/tests/services/engine/mcp-tool-calls.test.ts` | 6.1-7.6 s in 6 runs on Linux x64; 0.5 s summed on Linux CI, 0.4 s on macOS and 1.6 s on Windows | Awaiting the maintainer's acceptance. Its tests run replies through the engine with tool sessions open, and each reply stores its progress in the SQLite database, where every commit waits for the disk; its slowest, two plan-first tests and two token tests, take 0.4-0.7 s each. |
| `src/noldova.teamrun.core/tests/services/engine/outside-messages.test.ts` | 5.0-8.4 s in 6 runs on Linux x64; 0.4 s summed on Linux CI, 0.3 s on macOS and 8.4 s on Windows | Awaiting the maintainer's acceptance. Its tests send outside messages through the engine and run their replies, and each reply stores its progress in the SQLite database, where every commit waits for the disk; its list test runs 32 replies, one in each chat, to fill the list of 30 chats, about 1.7 s, and its closing-tag test 10, about 0.6 s. |
| `src/noldova.teamrun.core/tests/services/engine/permission-asks.test.ts` | 3.9-5.4 s in 6 runs on Linux x64; 0.7 s summed on Linux CI, 0.4 s on macOS and 1.9 s on Windows | Awaiting the maintainer's acceptance. Its 28 tests run replies through the engine, and each reply stores its progress in the SQLite database, where every commit waits for the disk; none is slow alone, its slowest, a wake that asks for a send, taking 0.3-0.4 s. |
| `src/noldova.teamrun.core/tests/services/engine/reply-run.test.ts` | 6.2-8.9 s in 6 runs on Linux x64; 0.4 s summed on Linux CI, 0.3 s on macOS and 2.9 s on Windows | Awaiting the maintainer's acceptance. Its tests run replies, through the engine or a reply's own run, that store their progress in the SQLite database, where every commit waits for the disk; all 39 take over 0.1 s there, the slowest 0.35-0.6 s. |
| `src/noldova.teamrun.core/tests/services/engine/teammate-chains.test.ts` | 5.7-7.8 s | Its chains run 26 turns, and each turn stores its progress in the SQLite database, where every commit waits for the disk. |
| `src/noldova.teamrun.core/tests/services/engine/teammate-turns.test.ts` | 1.3-2.4 s | Its turns store each reply's progress in the SQLite database, and every commit waits for the disk. |
| `src/noldova.teamrun.core/tests/services/engine/waiting-sends.test.ts` | 4.4-5.7 s in 6 runs on Linux x64; 0.4 s summed on Linux CI, 0.5 s on macOS and 2.8 s on Windows | Awaiting the maintainer's acceptance. Most of its 22 tests run replies through the engine while messages wait, and each reply stores its progress in the SQLite database, where every commit waits for the disk; its slowest, which queues 20 messages behind a reply and sends them one after another, takes 1.0-1.4 s, and the rest 0.1-0.4 s each. |
| `src/noldova.teamrun.core/tests/services/engine/working-tree.test.ts` | 3.5-5.2 s | Its tests run Git on real repositories, and the output-limit fallback test diffs more than the 64 MiB that one Git call may return. |
| `src/noldova.teamrun.core/tests/services/messages/messages.service.test.ts` | 1.7-1.9 s | Its paging test stores 180 replies, one commit each, and every commit to the SQLite database waits for the disk. |
| `src/noldova.teamrun.core/tests/services/tasks/background-tasks.service.test.ts` | 2.1-2.7 s in 6 runs on Linux x64; 0.5 s summed on Linux CI, 0.5 s on macOS and 2.4 s on Windows | Awaiting the maintainer's acceptance. Its cleared-ids test, 0.8 s, stores 4,097 tasks with 4 KiB ids, more than one 16 MiB frame holds, then clears them; each of the rest takes under 0.2 s. |
| `src/noldova.teamrun.providers/tests/services/acp/acp-adapter.test.ts` | 3.9-4.5 s | Each turn starts its own fake agent process, about 35 in all, one for each capability, config-option and stop-reason case. |
| `src/noldova.teamrun.providers/tests/services/acp/acp-sub-agents.test.ts` | 3.4-5.1 s in 6 runs on Linux x64; 2.1 s summed on Linux CI, 2.1 s on macOS and 4.6 s on Windows | Awaiting the maintainer's acceptance. Its kept-sub-agent cases run Grok turns on a fake agent process and start a real process tree for each sub-agent's task; 16 of its 48 cases take over 0.1 s, and the five that end what a kept sub-agent started, when it is stopped, its chat is deleted, the adapter shuts down, the provider signs out or Grok exits, take 0.3-0.45 s each while they wait for that tree to end. |
| `src/noldova.teamrun.providers/tests/services/acp/acp-tasks.test.ts` | 11.3-19.5 s in 6 runs on Linux x64; 7.0 s summed on Linux CI, 7.2 s on macOS and 28.0 s on Windows | Awaiting the maintainer's acceptance. Its cases run Grok turns with background tasks on fake agent processes, and each task starts a real process tree that a stop, a deleted chat or a shutdown ends; 32 of its 38 cases take over 0.1 s, and the slowest, which stop a task when the adapter shuts down or close a deleted chat's kept Grok processes, take 0.4-1.0 s while they wait for those processes to end. |
| `src/noldova.teamrun.providers/tests/services/antigravity/antigravity-adapter.test.ts` | 2.2-2.8 s in 6 runs | Each of its 23 cases but one starts its own fake agent process, 50-110 ms each, and its turn-and-resume and chosen-model cases start two; its listings start none. Its hanging-sign-in turn waits out a 0.5 s sign-in timeout, 0.6-0.7 s. |
| `src/noldova.teamrun.providers/tests/services/antigravity/antigravity-installer.test.ts` | 1.5 s | Each install runs a real unzip or tar and a fake codesign as processes, and its cancel and time-limit cases start a sleeping program and end it; on Windows x64, where starting and ending a process is slower, it takes 2.6-3.0 s. |
| `src/noldova.teamrun.providers/tests/services/codex/codex-adapter.test.ts` | 2.7-5.1 s in 6 runs on Linux x64, alternating with runs of main, measured with 41 cases | Each of its 59 cases starts its own fake app-server process. Its sign-in page test takes 128-203 ms, over 0.2 s in 1 of the 6 runs, and what remains in it is its fake app-server's start. Its listing test holds an account read for 250 ms, the request limit its model list shares, which keeps the model list from timing out first on a loaded Windows machine. |
| `src/noldova.teamrun.providers/tests/services/copilot/copilot-adapter.test.ts` | 8.5-14.6 s in 6 runs on Linux x64, alternating with runs of main | Awaiting the maintainer's acceptance. Each of its 72 cases starts its own fake agent process, and most start two or three, for Copilot's listing, sign-in check and turns; each listing first starts the fake headless server, and the fallback cases then list over ACP too. Its two hanging-listing tests take 194-311 ms, over 0.25 s in 2 of the 6 runs, and what remains in them is their fake processes' starts. |
| `src/noldova.teamrun.providers/tests/services/grok/grok-adapter.test.ts` | 3.4-4.9 s in 6 runs on Linux x64, alternating with runs of main | Each of its 37 cases starts its own fake agent process, and each start takes about twice as long while other runs load the machine. |
| `src/noldova.teamrun.providers/tests/services/process/powershell-session.test.ts` | 0.4-1.1 s in 3 runs on Linux CI; 2.3-6.0 s in 3 on Windows CI, whose runners were loaded | Awaiting the maintainer's acceptance. Each of its fake-shell tests starts one to three Node shells, 20-400 ms each, and on Windows its tests in the `ProcessListing` category each start a real PowerShell, which takes 1-2 s with its listing's C# type. |
| `src/noldova.teamrun.runtime/tests/services/runtime-part.test.ts` | 10.8-21.8 s in 6 runs on Linux x64; 7.1 s summed on Linux CI, 11.1 s on macOS and 49.8 s on Windows | Awaiting the maintainer's acceptance. 29 of its 82 cases take over 0.1 s, 9.0 s of the fastest run's 10.8 s: each provider kind's background-command case starts and ends a real process tree, 0.45-0.53 s each, its endpoint commands run in each mode, its teammate chains run to their hand-off limit, and its rewinds restore files with Git. |
| `src/noldova.teamrun.window/tests/app/services/chat-store.service.spec.ts` | 1.9-4.8 s in 6 runs; 1.1-3.2 s in 6 on Windows | Awaiting the maintainer's acceptance. Its 243 tests take about 5 ms each in the middle, 2.2 s together, and the rest is the file's import and setup while other files load the machine. |

These component spec files' median test is over 100 milliseconds; all of them await the maintainer's decision:

| File | Median test on Linux x64 | Why it takes longer |
|---|---|---|
| `src/noldova.teamrun.window/tests/app/components/history/history.component.spec.ts` | 137-320 ms in 6 runs on Linux x64 after the merge, where its other 63 tests alone took 133-289 ms, so the 4 tests over 10,000 messages add 4-18 ms; 182-522 ms and 175-487 ms in 6 runs earlier the same day. Before the merge, 100-125 ms in 6 runs on that machine idle and 135 ms on Windows x64, idle | Awaiting the maintainer's acceptance. Each of its tests opens a list of real messages and renders a 600px page of history rows, about 33 ms, then waits 1-6 frames, about 12 ms each, while the list measures its rows and settles; waiting for the store's load instead of a frame saved nothing measurable. Its 4 tests over 10,000 messages with files, edits and highlighted code test the history at that size. |
| `src/noldova.teamrun.window/tests/app/components/conversation/conversation.component.spec.ts` | 118 ms | Each test's new code highlighter compiles the languages it preloads again, about a quarter of the file's time, until the kit lets tests share one. |

These component tests take over 1 second:

| Test | Time on Linux x64 | Why it takes longer |
|---|---|---|
| `history.component.spec.ts`: "counts all 10,000 messages from its first page…" | 1.5 s | It opens over 10,000 messages and reads earlier pages. |
| `history.component.spec.ts`: "keeps the thumb where it is dragged…" | 2.4 s | It drags the scrollbar's thumb in 24 steps to the top and back, four frames each. |
| `history.component.spec.ts`: "scrolls 150 messages up under a wheel…" | 2.4 s | It scrolls 150 messages up frame by frame, reading at least two pages on the way. |
| `history-message.component.spec.ts`: "reveals a working reply's text at the streaming pace in the kit's bursts…", both cases | 1.3 s and 2.3 s | It reveals the text at the streaming pace, in the kit's bursts at least 48 ms apart, with batches six frames apart. |
| `conversation.component.spec.ts`: "loads the code languages replies use most once the window is idle…" | 1.1 s | It waits for the idle preload to compile the preloaded languages. |
| `conversation-members.component.spec.ts`: "shows each avatar's name, provider, model and effort in its tooltip…" | 1.3 s | It hovers each avatar with the real pointer and waits for its tooltip. |
| `providers-view.component.spec.ts`: "names each shown window's full figure and reset in its tooltip…" | 1.1 s | It hovers each usage window with the real pointer and waits for its tooltip. |
| `background-tasks-view.component.spec.ts`: "shows a cut command in full in its tooltip…" | 1.1 s | It hovers a cut command and Clear with the real pointer and waits for each tooltip. |

### Fixed pauses

Tests wait for an event or a promise that the code under test gives.
The Test waits check refuses a fixed pause in any test file this table doesn't list, and a listed file that no longer pauses.

| Test file | Why it pauses |
|---|---|
| `src/noldova.teamrun.providers/tests/fixtures/fake-claude.fixture.ts` | When a test tells it to hang, the fake Claude Code stays alive for at most a minute, so the test can time out against it. |
| `src/noldova.teamrun.providers/tests/fixtures/fake-codex-app-server.fixture.ts` | When a test tells it to, the fake app-server stays alive for at most a minute after its input closes, so the test reaches the stop grace; or it answers a turn's start late, so the test can interrupt first; or it holds a `--version` read until the test releases it, for at most a minute; or it holds `initialize` unanswered, for at most a minute, until the adapter stops it; or it ends a background command 20 ms after listing it, so the command outlives its turn. |
| `src/noldova.teamrun.providers/tests/fixtures/wait.fixture.ts` | Between bounded checks of a condition, and in `delay`, which the delta stream test uses to show that a flushed stream reports nothing more, and the Copilot adapter test to show that an unanswered session delete logs nothing before its grace elapses on its timer. |
| `src/noldova.teamrun.providers/tests/models/pending-request.test.ts` | Past a request's 5 ms timer, to show that completing or failing the request cleared it. |
| `src/noldova.teamrun.providers/tests/services/claude/agent-sdk-query-factory.test.ts` | Aborts the real query after 10 seconds if it hasn't failed by then. |
| `src/noldova.teamrun.providers/tests/services/process/abort-timer.test.ts` | Past the timers' 10 ms, to show that disposed timers never fire. |
| `src/noldova.teamrun.providers/tests/services/process/process-terminator.test.ts` | Gives a terminated process at most 5 seconds to exit. |
| `src/noldova.teamrun.runtime/tests/services/runtime-part.test.ts` | Between bounded checks, 50 ms apart for at most 15 seconds, of a background command's process tree: until it has written its pid file, and until its pids are gone after a Stop, a chat's delete or a shutdown, which no event reports. |
| `src/noldova.teamrun/tests/e2e/inline-terminal.spec.ts` | For one second after the inline screen shows a command and ends at the prompt, before the next Run. The Terminal module counts itself busy until the last key typed into it is a second old or its shell marks a new prompt, its echo settle, which no event reports; the screen can show the prompt before the terminal has read its mark, so only the second is sure, and a Run into a busy terminal asks the person instead of running. |

The check treats these as fixed pauses, outside strings:

- importing `setTimeout`, `scheduler` or the whole module from `timers/promises`;
- `scheduler.wait(`, `Atomics.wait(`, `Atomics.waitAsync(` and `waitForTimeout(`;
- `setTimeout(` with a named callback or a number as its delay, and a `new Promise` whose executor starts with `setTimeout(`.

The Window specs wait for a condition with `Wait.until`, from `src/noldova.teamrun.window/tests/fixtures/wait.fixture.ts`, which checks it every millisecond.
The check refuses `vi.waitFor` in any file under `src/noldova.teamrun.window/tests` but that fixture, naming its file and line, since `vi.waitFor` checks every 50 ms and so costs a whole 50 ms each time its first check fails.
It refuses the name `waitFor` itself, outside strings and comments, so that a `waitFor` taken from `vi` or reached through another name is refused too, and also `["waitFor"]`.
It fails when that fixture is missing or no test file is under that folder, since the rule would then check nothing.
On every run, the check also tries the rule on six samples of its own: a call in a Window spec, a `waitFor` taken from `vi`, and `vi["waitFor"]`, which it refuses; the call in `wait.fixture.ts`, a call inside a string and a call inside a comment, which it allows.
It fails when one doesn't hold.

Core's tests wait for a condition with `CoreHost.until`, from `src/noldova.teamrun.core/tests/fixtures/core-host.fixture.ts`, which checks it again each time a fixture records a change, and has no time limit of its own.
Given the work that should make the condition true, such as the engine's runs or a request's promise, it fails as soon as that work ends without it, naming both.
Every fixture that records a change tells the wait, so a new fixture that a test waits on tells it too, and `change-signal.test.ts`, beside it, shows each one does.

### Wait times from the environment

Only tests set these variables; unset, or set to anything but a positive whole number, the real wait stays.

| Variable | What it sets |
|---|---|
| `TEAMRUN_GIT_TIMEOUT_MS` | Milliseconds a reply's Git check of the ignored changes may run, 30,000 otherwise; `git-ignores.test.ts` sets it to show that a Git that never answers ignores nothing. |

### Global mocks

The package tests run at the same time in one process, so a test that mocks a global mocks it for every test running alongside it: a mocked `setTimeout` stops their timers, and the runner's own per-test timeout with them.
Tests get times and such functions through injected values instead, as `ProviderTimings` gives the providers' timings, and mock only those.
The Global mocks check refuses, outside strings, in every test file under `src/` and `scripts/`:

- `mock.timers`, or `timers` destructured from it as in `const { timers } = t.mock`, on `node:test`'s `mock`, a test context's `mock`, or a name `mock` is imported as, destructured as or assigned to, as in `import { mock as m }`, `const { mock: m } = t`, a parameter `({ mock: m }) =>`, `const m = t.mock`, `const m: MockTracker = t.mock` or `m = t.mock`; the forms below follow those names too;
- `mock.method`, `mock.property`, `mock.getter` and `mock.setter` on a global object, written as its first argument either alone or after `globalThis.`, as in `mock.method(globalThis, "fetch")`, `mock.method(process.stdout, "write")`, `mock.property(process, "platform", "win32")` or `mock.getter(Date, "now")`;
- `mock.method` on an export of one of Node's built-in modules, such as `node:fs`, `fs/promises` or `node:timers`, which each process loads once: on a name the file imports, requires or awaits from the module, or on the module's `require(...)` or `await import(...)` itself, alone or as in `(await import("node:fs")).promises`.

The global objects it names are `globalThis`, `global`, `window`, `self`, `process`, `console`, `Date`, `Math`, `JSON`, `Reflect`, `Intl`, `performance`, `crypto`, `navigator`, `Buffer`, `Promise`, `Object`, `Array`, `Number`, `String`, `Symbol`, `Error`, `URL`, `AbortController`, `AbortSignal`, `EventTarget` and `WebAssembly`.
The check reads names, not bindings, so a test's own variable named like a global, such as `const process = new FakeChildProcess()`, is refused too when the test mocks it; give it another name.
The check fails, too, when it finds no test file.

## License

TeamRun is licensed under the [MIT License](LICENSE).
Its third-party packages keep their own licenses, which their packages carry.

The app carries these third-party files, each under its own license:

- `app/assets/dictionaries/en-US-10-1.bdic`, the en-US Hunspell dictionary from SCOWL, under the terms in `en-US-SCOWL.txt` beside it, built in the form the Hunspell dictionaries' `HUNSPELL-DICTIONARIES-COPYING.txt` covers: GPL 2.0, LGPL 2.1, MPL 1.1 or LGPL 3.0.
- `app/assets/licenses/third-party`, the license texts of `@xterm/addon-serialize`, `@xterm/headless` (MIT, the xterm.js authors) and `standardwebhooks` (MIT, Svix), which the app ships and whose packages carry no license file of their own.

The AI providers, Angular, Electron, GitHub, Hunspell, Linux, macOS, npm, Vitest, Windows and the other product names used here are names of their owners.

## Trademarks

The code is under the MIT License, while the names "TeamRun" and "Noldova" and their logos are not: the MIT License grants no right to them.
A build from this code that is published by anyone but Noldova uses another name and its own logo.
