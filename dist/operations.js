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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addJiraInfoToPrDescription = exports.syncFixVersionAsLabel = exports.syncPriority = exports.syncLabels = exports.syncIssueType = void 0;
const core = __importStar(require("@actions/core"));
const lodash_es_1 = require("lodash-es");
const MARKER_WARNING = `<!-- ⚠️ please DO NOT remove this marker nor any of the ones below it, they needed to replace info when ticket title is updated  -->`;
const MARKER_START = `<!-- jira-field-sync -- START -->`;
const MARKER_END = `<!-- jira-field-sync -- END -->`;
/**
 * Takes care of syncing labels of a certain type (aka: prefix).
 * Will also remove labels of a certain type from the PR that are no longer needed.
 *
 * @param SyncLabelInput
 * @returns Promise<SyncLabelOutput>
 */
function _syncLabel({ prefix, labels, githubPrNumber, githubClient, githubContext }) {
    return __awaiter(this, void 0, void 0, function* () {
        core.debug(`----- [processing labels of type "${prefix}"] -----`);
        const ghRestApi = githubClient.rest;
        const labelsProposed = labels.map(label => `${prefix}: ${label}`);
        const prDetails = yield ghRestApi.issues.get(Object.assign(Object.assign({}, githubContext.repo), { issue_number: githubPrNumber }));
        const existingLabels = prDetails.data.labels;
        // using _.compact to remove any empty values (aka: labels with no `name` property)
        const existingLabelsOfType = (0, lodash_es_1.compact)(existingLabels
            .filter(label => { var _a; return (_a = label.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().startsWith(prefix.toLowerCase()); })
            .map(label => label.name));
        const labelsToRemove = (0, lodash_es_1.difference)(existingLabelsOfType, labelsProposed);
        const labelsToAdd = (0, lodash_es_1.difference)(labelsProposed, existingLabelsOfType);
        core.debug(`Labels of type "${prefix}" currently on the PR: [${existingLabelsOfType.join(',')}]`);
        core.debug(`Labels of type "${prefix}" that will be removed: [${labelsToRemove.join(',')}]`);
        core.debug(`Labels of type "${prefix}" that will be added: [${labelsToAdd.join(',')}]`);
        if (labelsToRemove.length) {
            core.debug(`Attempting to remove labels of type "${prefix}`);
            // I wish the GH API has support to remove multiple labels at once 😢
            const requests = labelsToRemove.map(label => {
                return ghRestApi.issues.removeLabel(Object.assign(Object.assign({}, githubContext.repo), { issue_number: githubPrNumber, name: label }));
            });
            const results = yield Promise.allSettled(requests);
            const failures = results.filter(res => res.status === 'rejected');
            if (failures.length) {
                core.warning(`At least one request when trying to remove existing Github labels`);
                core.warning(JSON.stringify(failures, null, 2));
            }
        }
        if (labelsToAdd.length) {
            core.debug(`Attempting to add labels of type "${prefix}`);
            yield ghRestApi.issues.addLabels(Object.assign(Object.assign({}, githubContext.repo), { issue_number: githubPrNumber, labels: labelsToAdd }));
        }
        core.debug(`----- [done with type "${prefix}"] -----`);
        return {
            additions: labelsToAdd,
            removals: labelsToRemove,
        };
    });
}
function _getCleanPrDescription({ githubPrNumber, githubClient, githubContext }) {
    return __awaiter(this, void 0, void 0, function* () {
        const rg = new RegExp(`${MARKER_START}([\\s\\S]+)${MARKER_END}`, 'igm');
        const prDetails = yield githubClient.rest.issues.get(Object.assign(Object.assign({}, githubContext.repo), { issue_number: githubPrNumber }));
        const currentBody = prDetails.data.body;
        const cleanBody = (currentBody !== null && currentBody !== void 0 ? currentBody : '').replace(rg, '');
        return cleanBody;
    });
}
/**
 * Adds a PR label indicating the issue type from Jira.
 *
 * @param OperationInput
 */
function syncIssueType({ jiraIssueDetails, githubPrNumber, githubClient, githubContext }) {
    return __awaiter(this, void 0, void 0, function* () {
        const prefix = 'Issue Type';
        const issueType = jiraIssueDetails.fields.issuetype.name;
        if (!issueType) {
            throw new Error('Jira issue did not have an issue type');
        }
        yield _syncLabel({
            githubClient,
            githubContext,
            githubPrNumber,
            prefix,
            labels: [issueType]
        });
    });
}
exports.syncIssueType = syncIssueType;
/**
 * Adds a PR label for each label present in Jira
 *
 * @param OperationInput
 */
function syncLabels({ jiraIssueDetails, githubPrNumber, githubClient, githubContext }) {
    return __awaiter(this, void 0, void 0, function* () {
        const prefix = 'Jira Label';
        const jiraLabels = jiraIssueDetails.fields.labels || [];
        yield _syncLabel({
            githubClient,
            githubContext,
            githubPrNumber,
            prefix,
            labels: jiraLabels
        });
    });
}
exports.syncLabels = syncLabels;
/**
 * Adds a PR label indicating the issue priority from Jira.
 *
 * @param OperationInput
 */
function syncPriority({ jiraIssueDetails, githubPrNumber, githubClient, githubContext }) {
    return __awaiter(this, void 0, void 0, function* () {
        const prefix = 'Priority';
        const priority = jiraIssueDetails.fields.priority.name;
        if (!priority) {
            throw new Error('Jira issue did not have a priority');
        }
        yield _syncLabel({
            githubClient,
            githubContext,
            githubPrNumber,
            prefix,
            labels: [priority]
        });
    });
}
exports.syncPriority = syncPriority;
/**
 * Adds a PR label indicating what "fix version" this PR is in. It could add multiple labels if there is more than one fix version in Jira
 *
 * @param OperationInput
 */
function syncFixVersionAsLabel({ jiraIssueDetails, githubPrNumber, githubClient, githubContext }) {
    return __awaiter(this, void 0, void 0, function* () {
        const fixVersions = jiraIssueDetails.fields.fixVersions || [];
        const prefix = 'Release';
        yield _syncLabel({
            githubClient,
            githubContext,
            githubPrNumber,
            prefix,
            labels: fixVersions.map(fv => fv.name) || []
        });
    });
}
exports.syncFixVersionAsLabel = syncFixVersionAsLabel;
function addJiraInfoToPrDescription({ jiraBaseUrl, jiraIssueDetails, githubPrNumber, githubClient, githubContext }) {
    return __awaiter(this, void 0, void 0, function* () {
        const jiraInfoTable = `<table align="center">
        <tr>
            <th colspan="2">
                Jira Information
            </th>
        <tr>
        <tr>
            <th>Title</th>
            <td>${jiraIssueDetails.fields.summary}</td>
        </tr>
        <tr>
            <th>Link</th>
            <td>
                <a href="${jiraBaseUrl}/browse/${jiraIssueDetails.key}" target="_blank">
                    ${jiraIssueDetails.key}
                </a>
            </td>
        </tr>
        <tr>
            <th>Type</th>
            <td>
                <img src="${jiraIssueDetails.fields.issuetype.iconUrl}" alt="${jiraIssueDetails.fields.issuetype.description}" />
                ${jiraIssueDetails.fields.issuetype.name}
            </td>
        </tr>
        <tr>
            <th>Priority</th>
            <td>
                <img src="${jiraIssueDetails.fields.priority.iconUrl}" height="16px" alt="${jiraIssueDetails.fields.priority.name}" />
                ${jiraIssueDetails.fields.priority.name}
            </td>
        </tr>
    </table>
    <hr />
    `;
        const prDetails = yield githubClient.rest.issues.get(Object.assign(Object.assign({}, githubContext.repo), { issue_number: githubPrNumber }));
        const cleanBody = yield _getCleanPrDescription({ jiraIssueDetails, githubPrNumber, githubClient, githubContext });
        let newBody = MARKER_START;
        newBody += `\n${MARKER_WARNING}`;
        newBody += `\n${jiraInfoTable}`;
        newBody += `\n${MARKER_WARNING}`;
        newBody += `\n${MARKER_END}`;
        newBody += `\n${cleanBody}`;
        core.debug("CLEAN BODY");
        core.debug(cleanBody);
        const prDetailsUpdated = yield githubClient.rest.issues.update(Object.assign(Object.assign({}, githubContext.repo), { issue_number: githubPrNumber, body: newBody }));
    });
}
exports.addJiraInfoToPrDescription = addJiraInfoToPrDescription;
