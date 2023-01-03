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
exports.syncPriority = exports.syncLabels = exports.syncFixVersion = exports.syncIssueType = void 0;
const core = __importStar(require("@actions/core"));
const lodash_es_1 = require("lodash-es");
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
            // TODO: change this to Promise.allSettled to better support partial failures (and print a warning)
            yield Promise.all(requests);
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
function syncFixVersion() {
    return __awaiter(this, void 0, void 0, function* () { });
}
exports.syncFixVersion = syncFixVersion;
function syncLabels({ jiraIssueDetails, githubPrNumber, githubClient, githubContext }) {
    return __awaiter(this, void 0, void 0, function* () {
        const prefix = 'Jira Label';
        const jiraLabels = jiraIssueDetails.fields.labels;
        // if (jiraLabels === undefined) {
        //     throw new Error('Jira issue did not have a priority')
        // }
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
