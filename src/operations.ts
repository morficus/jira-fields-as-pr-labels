import * as github from '@actions/github'
import * as core from '@actions/core'
import { difference, compact } from 'lodash-es'

type GithubContext = typeof github.context
type GithubClient = ReturnType<typeof github.getOctokit>

type OperationInput = {
    jiraBaseUrl?: string
    jiraIssueDetails: JiraIssue
    githubPrNumber: number
    githubClient: GithubClient
    githubContext: GithubContext
}

type SyncLabelInput = {
    prefix: string,
    labels: Array<string>
    githubPrNumber: number
    githubClient: GithubClient
    githubContext: GithubContext
}

type SyncLabelOutput = {
    additions: Array<string>
    removals: Array<string>
}

// for some reason, the Octokit REST client defines "labels" as either an array of strings OR objects.
// doing doing `labels[0]?.name` always resulted in a TS error... so to get around that, I'm redefining the type 🤷🏽‍♂️
type ghLabel = {
    id?: number | undefined
    node_id?: string | undefined
    url?: string | undefined
    name?: string | undefined
    description?: string | null | undefined
    color?: string | null | undefined
    default?: boolean | undefined
}

const MARKER_WARNING = `<!-- ⚠️ please DO NOT remove this marker nor any of the ones below it, they needed to replace info when ticket title is updated  -->`
const MARKER_START = `<!-- jira-field-sync -- START -->`
const MARKER_END = `<!-- jira-field-sync -- END -->`

/**
 * Takes care of syncing labels of a certain type (aka: prefix).
 * Will also remove labels of a certain type from the PR that are no longer needed.
 * 
 * @param SyncLabelInput 
 * @returns Promise<SyncLabelOutput>
 */
async function _syncLabel({ prefix, labels, githubPrNumber, githubClient, githubContext }: SyncLabelInput): Promise<SyncLabelOutput> {
    core.debug(`----- [processing labels of type "${prefix}"] -----`)
    const ghRestApi = githubClient.rest
    const labelsProposed = labels.map(label => `${prefix}: ${label}`)

    const prDetails = await ghRestApi.issues.get({
        ...githubContext.repo,
        issue_number: githubPrNumber,
    })

    const existingLabels = prDetails.data.labels as ghLabel[]

    // using _.compact to remove any empty values (aka: labels with no `name` property)
    const existingLabelsOfType = compact(existingLabels
        .filter(label => label.name?.toLowerCase().startsWith(prefix.toLowerCase()))
        .map(label => label.name))
    
    const labelsToRemove = difference(existingLabelsOfType, labelsProposed)
    const labelsToAdd = difference(labelsProposed, existingLabelsOfType)

    core.debug(`Labels of type "${prefix}" currently on the PR: [${existingLabelsOfType.join(',')}]`)
    core.debug(`Labels of type "${prefix}" that will be removed: [${labelsToRemove.join(',')}]`)
    core.debug(`Labels of type "${prefix}" that will be added: [${labelsToAdd.join(',')}]`)

    if (labelsToRemove.length) {
        core.debug(`Attempting to remove labels of type "${prefix}`)
        // I wish the GH API has support to remove multiple labels at once 😢
        const requests = labelsToRemove.map(label => {
            return ghRestApi.issues.removeLabel({
                ...githubContext.repo,
                issue_number: githubPrNumber,
                name: label
            })
        })

        const results = await Promise.allSettled(requests)
        const failures = results.filter(res => res.status === 'rejected')
        if (failures.length) {
            core.warning(`At least one request when trying to remove existing Github labels`)
            core.warning(JSON.stringify(failures, null, 2))
            
        }
    }

    if (labelsToAdd.length) {
        core.debug(`Attempting to add labels of type "${prefix}`)
        await ghRestApi.issues.addLabels({
            ...githubContext.repo,
            issue_number: githubPrNumber,
            labels: labelsToAdd
        })
    }

    core.debug(`----- [done with type "${prefix}"] -----`)
    
    return {
        additions: labelsToAdd,
        removals: labelsToRemove,
    }
}

async function _getCleanPrDescription({ githubPrNumber, githubClient, githubContext }: OperationInput): Promise<string> {
    const rg = new RegExp(`${MARKER_START}([\\s\\S]+)${MARKER_END}`, 'igm');

    const prDetails = await githubClient.rest.issues.get({
        ...githubContext.repo,
        issue_number: githubPrNumber,
    })

    const currentBody = prDetails.data.body
    const cleanBody = (currentBody ?? '').replace(rg, '');

    return cleanBody
}

/**
 * Adds a PR label indicating the issue type from Jira.
 * 
 * @param OperationInput 
 */
export async function syncIssueType({ jiraIssueDetails, githubPrNumber, githubClient, githubContext }: OperationInput): Promise<void> {
    const prefix = 'Issue Type'
    const issueType = jiraIssueDetails.fields.issuetype.name
    
    if (!issueType) {
        throw new Error('Jira issue did not have an issue type')
    }

    await _syncLabel({
        githubClient,
        githubContext,
        githubPrNumber,
        prefix,
        labels: [issueType]
    })
}

/**
 * Adds a PR label for each label present in Jira
 * 
 * @param OperationInput 
 */
export async function syncLabels({ jiraIssueDetails, githubPrNumber, githubClient, githubContext }: OperationInput): Promise<void> {
    const prefix = 'Jira Label'
    const jiraLabels = jiraIssueDetails.fields.labels || []

    await _syncLabel({
        githubClient,
        githubContext,
        githubPrNumber,
        prefix,
        labels: jiraLabels
    })
}

/**
 * Adds a PR label indicating the issue priority from Jira.
 * 
 * @param OperationInput 
 */
export async function syncPriority({ jiraIssueDetails, githubPrNumber, githubClient, githubContext }: OperationInput): Promise<void> {
    const prefix = 'Priority'
    const priority = jiraIssueDetails.fields.priority.name
    
    if (!priority) {
        throw new Error('Jira issue did not have a priority')
    }

    await _syncLabel({
        githubClient,
        githubContext,
        githubPrNumber,
        prefix,
        labels: [priority]
    })
}

/**
 * Adds a PR label indicating what "fix version" this PR is in. It could add multiple labels if there is more than one fix version in Jira
 * 
 * @param OperationInput 
 */
export async function syncFixVersionAsLabel({ jiraIssueDetails, githubPrNumber, githubClient, githubContext }: OperationInput): Promise<void> {
    const fixVersions = jiraIssueDetails.fields.fixVersions || []
    const prefix = 'Release'

    await _syncLabel({
        githubClient,
        githubContext,
        githubPrNumber,
        prefix,
        labels: fixVersions.map(fv => fv.name) || []
    })
}

export async function addJiraInfoToPrDescription({ jiraBaseUrl, jiraIssueDetails, githubPrNumber, githubClient, githubContext }: OperationInput): Promise<void> {

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
    `

    const prDetails = await githubClient.rest.issues.get({
        ...githubContext.repo,
        issue_number: githubPrNumber,
    })

    const cleanBody = await _getCleanPrDescription({ jiraIssueDetails, githubPrNumber, githubClient, githubContext })


    let newBody = MARKER_START
    newBody += `\n${MARKER_WARNING}`
    newBody += `\n${jiraInfoTable}`
    newBody += `\n${MARKER_WARNING}`
    newBody += `\n${MARKER_END}`
    newBody += `\n${cleanBody}`

    core.debug("CLEAN BODY")
    core.debug(cleanBody)

    const prDetailsUpdated = await githubClient.rest.issues.update({
        ...githubContext.repo,
        issue_number: githubPrNumber,
        body: newBody
    })
}