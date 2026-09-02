# :shopping_cart: GitHub Action: Add to GitHub Project

![CI](https://github.com/stairwaytowonderland/add-to-project/actions/workflows/ci.yaml/badge.svg)
![Linter](https://github.com/stairwaytowonderland/add-to-project/actions/workflows/linter.yaml/badge.svg)
![CodeQL](https://github.com/stairwaytowonderland/add-to-project/actions/workflows/codeql-analysis.yml/badge.svg)
![Coverage](./badges/coverage.svg)

[![GitHub latest release](https://img.shields.io/github/v/release/stairwaytowonderland/add-to-project?include_prereleases&logo=rocket)](https://github.com/stairwaytowonderland/add-to-project/releases)
[![GitHub last commit](https://img.shields.io/github/last-commit/stairwaytowonderland/add-to-project?logo=git)](https://github.com/stairwaytowonderland/add-to-project/commits/main)
[![GitHub license](https://img.shields.io/github/license/stairwaytowonderland/add-to-project?logo=opensourceinitiative&logoColor=white)](https://github.com/stairwaytowonderland/add-to-project/tree/main/LICENSE)
[![semantic-release: conventionalcommits](https://img.shields.io/badge/semantic--release-cc-FE5196?logo=semantic-release)](https://github.com/semantic-release/semantic-release)
[![pre-commit](https://img.shields.io/badge/pre--commit-FAB040?logo=pre-commit&logoColor=black)](https://github.com/pre-commit/pre-commit)

## :pushpin: Overview

Use this action to automatically add specified repo or owner issues or pull requests to a [GitHub project](https://docs.github.com/en/issues/trying-out-the-new-projects-experience/about-projects).

Note that this action does **not** support [GitHub projects (classic)](https://docs.github.com/en/issues/organizing-your-work-with-project-boards).

## :cactus: Project structure

> [!TIP]
>
> For the complete `.github` folder file structure, see its [`index.md`](./.github/index.md).

<details>
<summary><b>Project file structure</b> <i>(Click to expand) ...</i></summary><br>

> :seedling: `tree -a -F -L 2 -I '.git|.vscode|.devcontainer' --gitignore --dirsfirst .`

```none
./
├── __fixtures__/
│   ├── core.ts
│   └── github.ts
├── __tests__/
│   └── main.test.ts
├── .github/
│   ├── codeql/
│   ├── workflows/
│   ├── CODEOWNERS
│   ├── dependabot.yml
│   └── index.md
├── badges/
│   └── coverage.svg
├── dist/
│   ├── index.js
│   ├── index.js.map
│   └── licenses.txt
├── script/
│   └── release*
├── src/
│   ├── add-to-project.ts
│   └── main.ts
├── .checkov.yml
├── .editorconfig
├── .env.example
├── .gitattributes
├── .gitignore
├── .licensed.yml
├── .markdownlint-cli2.json
├── .markdownlint.json
├── .node-version
├── .npmrc
├── .pre-commit-config.yaml
├── .prettierignore
├── .prettierrc
├── .releaserc
├── .yaml-lint.yml
├── action.yaml
├── actionlint.yml
├── CHANGELOG.md
├── eslint.config.mjs
├── fix-regex.cjs
├── jest.config.cjs
├── LICENSE
├── package-lock.json
├── package.json
├── README.md
├── rollup.config.ts
├── tsconfig.json
└── tsconfig.test.json
```

</details>

## :rocket: Key Features

- :white_check_mark: Create a workflow that runs when Issues or Pull Requests are opened or labeled in your repository.
- :white_check_mark: Filter by label(s) with `AND`, `OR`, or `NOT` operators.
- :white_check_mark: Configure in a central repository to add all issues or Pull Requests by owner.

## :video_game: Usage

_See [action.yaml](action.yaml) for [metadata](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions) that defines the inputs, outputs, and runs configuration for this action._

_For more information about workflows, see [Using workflows](https://docs.github.com/en/actions/using-workflows)._

Create a workflow that runs when Issues or Pull Requests are opened or labeled in your repository; this workflow also
supports adding Issues to your project which are transferred into your repository. Optionally configure any filters you
may want to add, such as only adding issues with certain labels. You may match labels with an `AND` or an `OR`
operator, or exclude labels with a `NOT` operator.

Once you've configured your workflow, save it as a `.yaml` file in your target Repository's `.github/workflows` directory.

### :gear: Inputs

| Input                                                     | Description                                                                                                                                                                                                                        | Required | Default |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| <a name="dry-run">`dry-run`</a>                           | Run the action in dry-run mode. When set to `true`, the action will not add issues or pull requests to the project, but will log what would have been done.                                                                        | false    | `''`    |
| <a name="all-by-project-owner">`all-by-project-owner`</a> | Use the project owner as a filter for issues or pull requests to add to the project. If not provided, the issue or PR's repository owner will be used.                                                                             | false    | `''`    |
| <a name="project-url">`project-url`</a>                   | The URL of the GitHub project to add issues to. _eg: `https://github.com/orgs/<orgName>/projects/<projectNumber>`_                                                                                                                 | true     | `''`    |
| <a name="github-token">`github-token`</a>                 | A [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) with access to the repository and project.                                              | true     | `''`    |
| <a name="labeled">`labeled`</a>                           | A comma-separated list of labels used to filter applicable issues. When this key is provided, an issue must have _one_ of the labels in the list to be added to the project. Omitting this key means that any issue will be added. | false    | `''`    |
| <a name="label-operator">`label-operator`</a>             | The behavior of the labels filter, either `AND`, `OR` or `NOT` that controls if the issue should be matched with `all` `labeled` input or any of them, default is `OR`.                                                            | false    | `OR`    |

### :computer: Example

#### Example Usage: Adds all dependency PRs in an organization to a project board

```yaml
name: Add all dependency PRs to project board

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  add-to-project:
    name: Add pull requests to project
    runs-on: ubuntu-latest
    steps:
      - uses: stairwaytowonderland/add-to-project@RELEASE_VERSION
        with:
          all-by-project-owner: true
          project-url: https://github.com/orgs/<orgName>/projects/<projectNumber>
          github-token: ${{ secrets.ADD_TO_PROJECT_PAT }}
          labeled: dependencies
```

#### Example Usage: Issue opened with labels `bug` OR `needs-triage`

```yaml
name: Add bugs to bugs project

on:
  issues:
    types:
      - opened

jobs:
  add-to-project:
    name: Add issue to project
    runs-on: ubuntu-latest
    steps:
      - uses: stairwaytowonderland/add-to-project@RELEASE_VERSION
        with:
          # You can target a project in a different organization
          # to the issue
          project-url: https://github.com/orgs/<orgName>/projects/<projectNumber>
          github-token: ${{ secrets.ADD_TO_PROJECT_PAT }}
          labeled: bug, needs-triage
          label-operator: OR
```

#### Example Usage: Adds all issues opened that do not include the label `bug` OR `needs-triage`

```yaml
name: Adds all issues that don't include the 'bug' or 'needs-triage' labels to project board

on:
  issues:
    types:
      - opened

jobs:
  add-to-project:
    name: Add issue to project
    runs-on: ubuntu-latest
    steps:
      - uses: stairwaytowonderland/add-to-project@RELEASE_VERSION
        with:
          project-url: https://github.com/orgs/<orgName>/projects/<projectNumber>
          github-token: ${{ secrets.ADD_TO_PROJECT_PAT }}
          labeled: bug, needs-triage
          label-operator: NOT
```

#### Example Usage: Pull Requests labeled with `needs-review` and `size/XL`

```yaml
name: Add needs-review and size/XL pull requests to projects

on:
  pull_request:
    types:
      - labeled

jobs:
  add-to-project:
    name: Add pull request to project
    runs-on: ubuntu-latest
    steps:
      - uses: stairwaytowonderland/add-to-project@RELEASE_VERSION
        with:
          project-url: https://github.com/orgs/<orgName>/projects/<projectNumber>
          github-token: ${{ secrets.ADD_TO_PROJECT_PAT }}
          labeled: needs-review, size/XL
          label-operator: AND
```

## :satellite: Supported Events

Currently this action supports the following [`issues` events](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issues):

- `opened`
- `reopened`
- `transferred`
- `labeled`

and the following [`pull_request` events](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request):

- `opened`
- `reopened`
- `labeled`

Using these events ensure that a given issue or pull request, in the workflow's repo, is added to the
[specified project](#project-url). If [labeled input(s)](#labeled) are defined, then issues will only be added if they
contain at least _one_ of the labels in the list.

### :building_construction: Building `dist/`

This action's compiled output is committed to `dist/`, and the `check-dist` workflow
fails if `dist/` doesn't match a fresh build. Rebuild and commit `dist/` as part of your
pull request whenever you change anything the bundle is built from — most commonly
`src/`, but also `fix-regex.js`, `tsconfig.json`, or dependencies in `package.json` /
`package-lock.json`:

```shell
npm ci
npm run build
git add dist/
```

`npm run build` formats, runs the type/format/lint checks, compiles, and packages, so it
catches problems before CI does. If you only want the bundle, run `npm run build:compile`
and `npm run build:package` — that pair is exactly what `check-dist` runs.

A few things worth knowing:

- **Run `npm ci`, not `npm install`, before rebuilding.** `npm ci` installs exactly what
  `package-lock.json` specifies. If `node_modules` has drifted from the lockfile — most
  commonly after a dependency bump lands on `main` — the bundle you commit will differ
  from the one CI builds, and `check-dist` will fail with a diff in code you never
  touched.
- **`check-dist` ignores Markdown-only pull requests**, so a green run on a docs change
  doesn't mean `dist/` is current.
- **If `check-dist` fails, read the diff it prints.** It also uploads the expected
  `dist/` as a workflow artifact, which you can download and compare against your local
  build.

---

## :ocean: Essential tools

- :white_check_mark: [Visual Studio Code](https://code.visualstudio.com/) (a.k.a. _VS Code_)
- :white_check_mark: [EditorConfig](https://editorconfig.org/)
- :white_check_mark: [pre-commit](https://pre-commit.com/)
- :white_check_mark: [Prettier](https://prettier.io/)
  > :memo: **Note:** For a more customized experience, some files might need to be excluded from _Prettier_.
  >
  > _(See the [official docs](https://prettier.io/docs/ignore) for details on ignoring code)_

## :sparkles: Contributing

### :speech_balloon: Commit Message Guidelines

- Write clear, concise commit messages that follow the
  [![conventional-commit](https://img.shields.io/badge/conventional--commit-FE5196?logo=conventionalcommits&logoColor=white)](https://www.conventionalcommits.org/)&nbsp;standard.
- The allowed _prefixes_ for this project are the following:

  ```json
  [
    "build",
    "chore",
    "ci",
    "docs",
    "feat",
    "fix",
    "perf",
    "refactor",
    "revert",
    "style",
    "test"
  ]
  ```

> [!NOTE]
>
> See
> [Contributing Guidelines](https://github.com/stairwaytowonderland/add-to-project?tab=contributing-ov-file#contributing-guidelines)
> for more information.

## :credit_card: License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
