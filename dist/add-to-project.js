"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToProject = addToProject;
exports.mustGetOwnerTypeQuery = mustGetOwnerTypeQuery;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const urlParse = /\/(?<ownerType>orgs|users)\/(?<ownerName>[^/]+)\/projects\/(?<projectNumber>\d+)/;
async function addToProject() {
    const projectUrl = core.getInput('project-url', { required: true });
    const ghToken = core.getInput('github-token', { required: true });
    const labeled = core
        .getInput('labeled')
        .split(',')
        .map((l) => l.trim().toLowerCase())
        .filter((l) => l.length > 0) ?? [];
    const labelOperator = core
        .getInput('label-operator')
        .trim()
        .toLocaleLowerCase();
    const targetOwner = core.getInput('owner').trim();
    // NEW: Read the dry-run boolean input parameter (defaults to false if not passed or invalid)
    const dryRun = core.getInput('dry-run') === 'true';
    const octokit = github.getOctokit(ghToken);
    const urlMatch = projectUrl.match(urlParse);
    if (!urlMatch) {
        throw new Error(`Invalid project URL: ${projectUrl}. Project URL should match the format <GitHub server domain name>/<orgs-or-users>/<ownerName>/projects/<projectNumber>`);
    }
    const projectOwnerName = urlMatch.groups?.ownerName;
    const projectNumber = parseInt(urlMatch.groups?.projectNumber ?? '', 10);
    const ownerType = urlMatch.groups?.ownerType;
    const ownerTypeQuery = mustGetOwnerTypeQuery(ownerType);
    const contextOwner = targetOwner || projectOwnerName || github.context.repo.owner;
    core.info(`Searching for open items owned by: ${contextOwner}`);
    let searchQuery = `${ownerType === 'orgs' ? 'org' : 'user'}:${contextOwner} is:open archived:false`;
    if (labeled.length > 0) {
        if (labelOperator === 'and') {
            searchQuery += ` ${labeled.map((l) => `label:"${l}"`).join(' ')}`;
        }
        else if (labelOperator === 'not') {
            searchQuery += ` ${labeled.map((l) => `-label:"${l}"`).join(' ')}`;
        }
        else {
            searchQuery += ` label:${labeled.map((l) => `"${l}"`).join(',')}`;
        }
    }
    core.info(`Executing global search query: "${searchQuery}"`);
    const discoveredItems = (await octokit.paginate(octokit.rest.search.issuesAndPullRequests, {
        q: searchQuery,
        per_page: 100,
    }));
    core.info(`Found ${discoveredItems.length} matching items across the environment.`);
    const metrics = { added: [], skipped: [], failed: [] };
    if (discoveredItems.length === 0) {
        await writeJobSummary(metrics, searchQuery, projectUrl, dryRun);
        return;
    }
    const idResp = await octokit.graphql(`query getProject($projectOwnerName: String!, $projectNumber: Int!) {
      ${ownerTypeQuery}(login: $projectOwnerName) {
        projectV2(number: $number) {
          id
        }
      }
    }`, {
        projectOwnerName,
        projectNumber,
    });
    const projectId = idResp[ownerTypeQuery]?.projectV2.id;
    const processedItemIds = [];
    for (const issue of discoveredItems) {
        const issueLabels = (issue?.labels ?? []).map((l) => l.name.toLowerCase());
        const issueOwnerName = issue.repository?.owner.login;
        const repoName = issue.repository?.name || 'unknown-repo';
        const itemData = { title: issue.title, url: issue.html_url, repo: repoName };
        if (labelOperator === 'and') {
            if (!labeled.every((l) => issueLabels.includes(l))) {
                metrics.skipped.push({
                    ...itemData,
                    title: `${itemData.title} (Failed Local Label Validation)`,
                });
                continue;
            }
        }
        else if (labelOperator === 'not') {
            if (labeled.length > 0 && issueLabels.some((l) => labeled.includes(l))) {
                metrics.skipped.push({
                    ...itemData,
                    title: `${itemData.title} (Failed Local Label Validation)`,
                });
                continue;
            }
        }
        else {
            if (labeled.length > 0 && !issueLabels.some((l) => labeled.includes(l))) {
                metrics.skipped.push({
                    ...itemData,
                    title: `${itemData.title} (Failed Local Label Validation)`,
                });
                continue;
            }
        }
        const contentId = issue?.node_id;
        // NEW: If dry-run mode is enabled, skip the actual API writes and log the prospective item
        if (dryRun) {
            core.info(`[Dry Run] Would process item: ${issue.html_url}`);
            metrics.added.push(itemData);
            continue;
        }
        if (issueOwnerName === projectOwnerName) {
            try {
                const addResp = await octokit.graphql(`mutation addIssueToProject($input: AddProjectV2ItemByIdInput!) {
            addProjectV2ItemById(input: $input) {
              item {
                id
              }
            }
          }`, { input: { projectId, contentId } });
                processedItemIds.push(addResp.addProjectV2ItemById.item.id);
                metrics.added.push(itemData);
            }
            catch (error) {
                if (isAlreadyInProjectError(error)) {
                    metrics.skipped.push(itemData);
                    continue;
                }
                metrics.failed.push({
                    ...itemData,
                    reason: error instanceof Error ? error.message : String(error),
                });
            }
        }
        else {
            try {
                const addResp = await octokit.graphql(`mutation addDraftIssueToProject($projectId: ID!, $title: String!) {
            addProjectV2DraftIssue(input: { projectId: $projectId, title: $title }) {
              projectItem {
                id
              }
            }
          }`, { projectId, title: issue?.html_url });
                processedItemIds.push(addResp.addProjectV2DraftIssue.projectItem.id);
                metrics.added.push(itemData);
            }
            catch (error) {
                if (isAlreadyInProjectError(error)) {
                    metrics.skipped.push(itemData);
                    continue;
                }
                metrics.failed.push({
                    ...itemData,
                    reason: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    core.setOutput('itemId', processedItemIds.join(','));
    await writeJobSummary(metrics, searchQuery, projectUrl, dryRun);
}
async function writeJobSummary(metrics, query, projectUrl, dryRun) {
    // NEW: Append a clear visual indicator if the run was a simulated Dry Run
    const headingText = dryRun
        ? '🔍 Organization Project Automation Summary (DRY RUN)'
        : '📋 Organization Project Automation Summary';
    const addedLabel = dryRun
        ? '🔮 Items That Would Be Added'
        : '✅ Items Newly Added';
    core.summary
        .addHeading(headingText)
        .addRaw(`<p>Target Project Board: <a href="${projectUrl}">${projectUrl}</a></p>`)
        .addRaw(`<p>Search filter query executed: <code>${query}</code></p>`);
    if (dryRun) {
        core.summary.addRaw('<blockquote style="border-left: .25em solid #dfb317; padding: 0 1em; color: #6a737d;">⚠️ <strong>Notice:</strong> This workflow was executed in dry-run mode. No mutations or project board alterations were written to production.</blockquote>');
    }
    core.summary.addHeading('Execution Performance Metrics', 3).addTable([
        [
            { data: 'Status Metric Type', header: true },
            { data: 'Total Quantity Count', header: true },
        ],
        [addedLabel, metrics.added.length.toString()],
        ['🟡 Items Skipped / Already Exist', metrics.skipped.length.toString()],
        ['❌ Ingestion Failure Operations', metrics.failed.length.toString()],
    ]);
    if (metrics.added.length > 0) {
        const sectionTitle = dryRun
            ? '🔮 Prospective Additions'
            : '🚀 Newly Added Items';
        core.summary.addHeading(sectionTitle, 4);
        const addedRows = metrics.added.map((item) => [
            item.repo,
            `<a href="${item.url}">${item.title}</a>`,
        ]);
        core.summary.addTable([
            [
                { data: 'Repository', header: true },
                { data: 'Issue / Pull Request Title', header: true },
            ],
            ...addedRows,
        ]);
    }
    if (metrics.failed.length > 0) {
        core.summary.addHeading('⚠️ Ingestion Failure Details', 4);
        const failedRows = metrics.failed.map((item) => [
            item.repo,
            `<a href="${item.url}">${item.title}</a>`,
            `<code>${item.reason}</code>`,
        ]);
        core.summary.addTable([
            [
                { data: 'Repository', header: true },
                { data: 'Item Name', header: true },
                { data: 'Failure Reason Error Log', header: true },
            ],
            ...failedRows,
        ]);
    }
    await core.summary.write();
}
function isAlreadyInProjectError(error) {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return (msg.includes('content already exists in this project') ||
            msg.includes('project already contains the provided content'));
    }
    return false;
}
function mustGetOwnerTypeQuery(ownerType) {
    const ownerTypeQuery = ownerType === 'orgs'
        ? 'organization'
        : ownerType === 'users'
            ? 'user'
            : null;
    if (!ownerTypeQuery) {
        throw new Error(`Unsupported ownerType: ${ownerType}. Must be one of 'orgs' or 'users'`);
    }
    return ownerTypeQuery;
}
