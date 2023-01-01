import * as core from '@actions/core'
import * as  github from '@actions/github'
import { last } from 'lodash-es'
import JiraApi from 'jira-client'

enum IssueKeyLocation {
  BRANCH_NAME = 'branch',
  TITLE = 'title',
  BOTH = 'both'
}

// reference: https://confluence.atlassian.com/adminjiraserver/changing-the-project-key-format-938847081.html
const JIRA_ISSUE_KEY_REGEX_MATCHER = /([A-Z]+[A-Z0-9_]*-\d+)/g

async function main() {
  try {

    const githubToken = core.getInput('github-token', { required: true })
    const jiraUsername = core.getInput('jira-username', { required: true })
    const jiraApiKey = core.getInput('jira-api-token', { required: true })
    const jiraBaseUrl = core.getInput('jira-base-url', { required: true })
    const issueKeyLocation = core.getInput('issue-key-location', { required: false }) as IssueKeyLocation

    const context = github.context

    const jiraBaseUrlParts = new URL(jiraBaseUrl)

    const jira = new JiraApi({
      protocol: jiraBaseUrlParts.protocol,
      host: jiraBaseUrlParts.host,
      username: jiraUsername,
      password: jiraApiKey,
      apiVersion: '2',
      strictSSL: true
    });

    const title = context.payload.pull_request?.title
    const branchName = context.ref
    const prIssueNumber = context.payload.pull_request?.number

    if (!prIssueNumber) {
      const msg = `No PR number was found in the GitHub context`
      core.setFailed(msg)
      throw new Error(msg)
    }

    let jiraIssueKey
    const matcher = new RegExp(JIRA_ISSUE_KEY_REGEX_MATCHER)
    if (issueKeyLocation === IssueKeyLocation.BRANCH_NAME) {
      jiraIssueKey = matcher.exec(branchName)
    } else if (issueKeyLocation === IssueKeyLocation.TITLE) {
      jiraIssueKey = matcher.exec(title)
    } else if (issueKeyLocation === IssueKeyLocation.BOTH) {
      jiraIssueKey = matcher.exec(title) || matcher.exec(branchName)
    }

    console.log(`PR title: ${title}`)
    console.log(`issue key: ${jiraIssueKey}`)

    jiraIssueKey = last(jiraIssueKey)

    if (!jiraIssueKey) {
      const msg = `No Jira issue key was found in: ${issueKeyLocation}`
      core.setFailed(msg)
      throw new Error(msg)
    }

    // fetch issue details with only the specified fields
    // the 2nd parameter (`names`) returns a property that has the "display name" of each property
    const jiraIssueDetails = await jira.findIssue(jiraIssueKey, 'names', 'project,summary,issuetype,priority,fixVersions')
    console.log(jiraIssueDetails)
    const issueType = jiraIssueDetails.issuetype?.name
    const issuePriority = jiraIssueDetails.priority?.name
    const issueFixVersion = jiraIssueDetails.fixVersions?.name

    const octokit = github.getOctokit(githubToken)
    octokit.rest.issues.addLabels({
      ...context.repo,
      issue_number: prIssueNumber,
      labels: [
        {
          name: 'test 01'
        },
        {
          name: `issue type: ${issueType}`
        }
      ]
    })

    core.setOutput('issue-key', jiraIssueKey)
    core.setOutput('issue-type', issueType)
    core.setOutput('issue-priority', issuePriority)
    core.setOutput('issue-fix-version', issueFixVersion)


    // `who-to-greet` input defined in action metadata file
    // const nameToGreet = core.getInput('who-to-greet');
    // console.log(`Hello ${nameToGreet}!`);
    // const time = (new Date()).toTimeString();
    // core.setOutput("time", time);
    // // Get the JSON webhook payload for the event that triggered the workflow
    // const payload = JSON.stringify(github.context.payload, undefined, 2)
    // console.log(`The event payload: ${payload}`);
  } catch (error: any) {
    core.setFailed(error.message);
  }

}

// this is a work-around to allow top-level await
main()