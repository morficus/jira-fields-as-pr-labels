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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const lodash_es_1 = require("lodash-es");
const jira_client_1 = __importDefault(require("jira-client"));
var IssueKeyLocation;
(function (IssueKeyLocation) {
    IssueKeyLocation["BRANCH_NAME"] = "branch";
    IssueKeyLocation["TITLE"] = "title";
    IssueKeyLocation["BOTH"] = "both";
})(IssueKeyLocation || (IssueKeyLocation = {}));
// reference: https://confluence.atlassian.com/adminjiraserver/changing-the-project-key-format-938847081.html
const JIRA_ISSUE_KEY_REGEX_MATCHER = /([A-Z]+[A-Z0-9_]*-\d+)/g;
function main() {
    var _a, _b, _c, _d, _e;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const githubToken = core.getInput('github-token', { required: true });
            const jiraUsername = core.getInput('jira-username', { required: true });
            const jiraApiKey = core.getInput('jira-api-token', { required: true });
            const jiraBaseUrl = core.getInput('jira-base-url', { required: true });
            const issueKeyLocation = core.getInput('issue-key-location', { required: false });
            const context = github.context;
            const jiraBaseUrlParts = new URL(jiraBaseUrl);
            const jira = new jira_client_1.default({
                protocol: jiraBaseUrlParts.protocol,
                host: jiraBaseUrlParts.host,
                username: jiraUsername,
                password: jiraApiKey,
                apiVersion: '2',
                strictSSL: true
            });
            const title = (_a = context.payload.pull_request) === null || _a === void 0 ? void 0 : _a.title;
            const branchName = context.ref;
            const prIssueNumber = (_b = context.payload.pull_request) === null || _b === void 0 ? void 0 : _b.number;
            if (!prIssueNumber) {
                const msg = `No PR number was found in the GitHub context`;
                core.setFailed(msg);
                throw new Error(msg);
            }
            let jiraIssueKey;
            const matcher = new RegExp(JIRA_ISSUE_KEY_REGEX_MATCHER);
            if (issueKeyLocation === IssueKeyLocation.BRANCH_NAME) {
                jiraIssueKey = matcher.exec(title);
            }
            else if (issueKeyLocation === IssueKeyLocation.TITLE) {
                jiraIssueKey = matcher.exec(branchName);
            }
            else if (issueKeyLocation === IssueKeyLocation.BOTH) {
                jiraIssueKey = matcher.exec(title) || matcher.exec(branchName);
            }
            jiraIssueKey = (0, lodash_es_1.last)(jiraIssueKey);
            if (!jiraIssueKey) {
                const msg = `No Jira issue key was found in: ${issueKeyLocation}`;
                core.setFailed(msg);
                throw new Error(msg);
            }
            // fetch issue details with only the specified fields
            // the 2nd parameter (`names`) returns a property that has the "display name" of each property
            const jiraIssueDetails = yield jira.findIssue(jiraIssueKey, 'names', 'project,summary,issuetype,priority,fixVersions');
            console.log(jiraIssueDetails);
            const issueType = (_c = jiraIssueDetails.issuetype) === null || _c === void 0 ? void 0 : _c.name;
            const issuePriority = (_d = jiraIssueDetails.priority) === null || _d === void 0 ? void 0 : _d.name;
            const issueFixVersion = (_e = jiraIssueDetails.fixVersions) === null || _e === void 0 ? void 0 : _e.name;
            const octokit = github.getOctokit(githubToken);
            octokit.rest.issues.addLabels(Object.assign(Object.assign({}, context.repo), { issue_number: prIssueNumber, labels: [
                    {
                        name: 'test 01'
                    },
                    {
                        name: `issue type: ${issueType}`
                    }
                ] }));
            core.setOutput('issue-key', jiraIssueKey);
            core.setOutput('issue-type', issueType);
            core.setOutput('issue-priority', issuePriority);
            core.setOutput('issue-fix-version', issueFixVersion);
            // `who-to-greet` input defined in action metadata file
            // const nameToGreet = core.getInput('who-to-greet');
            // console.log(`Hello ${nameToGreet}!`);
            // const time = (new Date()).toTimeString();
            // core.setOutput("time", time);
            // // Get the JSON webhook payload for the event that triggered the workflow
            // const payload = JSON.stringify(github.context.payload, undefined, 2)
            // console.log(`The event payload: ${payload}`);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
// this is a work-around to allow top-level await
main();
