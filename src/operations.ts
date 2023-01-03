import * as github from '@actions/github'
import * as core from '@actions/core'
import { difference, compact } from 'lodash-es'

type GithubContext = typeof github.context
type GithubClient = ReturnType<typeof github.getOctokit>

type OperationInput = {
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

        // TODO: change this to Promise.allSettled to better support partial failures (and print a warning)
        await Promise.all(requests)
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

export async function syncFixVersion(): Promise<void> {}

export async function syncLabels({ jiraIssueDetails, githubPrNumber, githubClient, githubContext }: OperationInput): Promise<void> {
    const prefix = 'Jira Label'
    const jiraLabels = jiraIssueDetails.fields.labels
    
    // if (jiraLabels === undefined) {
    //     throw new Error('Jira issue did not have a priority')
    // }

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