# Jira Fields as PR Labels

This action adds the Jira issue type as a label on the pull request.  

This action will cause the job to fail if a Jira issue key is not found as part of the pull request or if the issue key does not exist in Jira. To prevent this from failing the workflow, you can use the [`continue-on-error`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstepscontinue-on-error) property offered by GitHub.
## Usage

Basic example
```yaml
name: My Pull Request Workflow

on:
  pull_request:
    types: [opened, edited, synchronize]

jobs:
  some_job_name:
    runs-on: ubuntu-latest
    steps:

      - uses: @morficus/jira-issue-type-label
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
          jira-username: ${{ secrets.JIRA_USERNAME }}
          jira-base-url: ${{ secrets.JIRA_BASE_URL }}
```

As a convenience, this action exposes a few properties on the Jira issue as outputs.  
For a full list of outputs, see the "Output Options" section.
```yaml
name: My Pull Request Workflow

on:
  pull_request:
    types: [opened, edited, synchronize]

jobs:
  some_job_name:
    runs-on: ubuntu-latest
    steps:

      - id: addLabel
        uses: @morficus/jira-issue-type-label
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
          jira-username: ${{ secrets.JIRA_USERNAME }}
          jira-base-url: ${{ secrets.JIRA_BASE_URL }}

      - name: Print the issue key
        run: echo "${{ steps.addLabel.outputs.issue-key }}"
```

## Input Options

| Key      | Description | Required | Default Value
| ----------- | ----------- | ----------- | ----------- |
| `github-token` | Token used to add labels to the PR. Can be passed in using `${{ secrets.GITHUB_TOKEN }}`       | true | undefined
| `jira-api-token` | API Token used to access the Jira REST API. Must have read access to your Jira projects & issues. For details, see Atlassian's official documentation: https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/       | true | undefined
| `jira-username` | Username that can use the Jira API token. Must have read access to your Jira projects & issues. For details, see Atlassian's official documentation: https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/       | true | undefined
| `jira-base-url` | Your Jira subdomain. i.e.: https://your-domain.atlassian.net       | true | undefined
| `issue-key-location` | Where in the PR to look for issue key. Values can be: `branch`, `title` or `both`       | false | `title`

## Output Options

| Key   | Description   
| ----------- | ----------- |
| `issue-key` | The Jira issue key that was found
| `issue-type` | The Jira issue type for the corresponding Jira issue 
| `issue-priority` | The priority set in Jira for the corresponding Jira issue
| `issue-fix-version` | The fix version on the corresponding Jira issue


## Frequently Asked Questions

<details>
  <summary>How do I create a Jira API token?</summary>
  See Atlassian's official documentation: https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/
</details>

<details>
  <summary>How do I create a GitHub API token?</summary>
  There is no need to do this manually. GitHub automatically provides/injects a token in every job that can be used for GitHub Actions. The default environment variable name is `secrets.GITHUB_TOKEN`.  
You can check out the official GitHub documentation for more information about it: https://docs.github.com/en/actions/security-guides/automatic-token-authentication
</details>

<details>
  <summary>Can I change the label colors?</summary>
  Sure you can! Once this action adds the label to the PR, you can change its color (or add a description) like you would any other label. You can check out the official GitHub documentation on how to do that: https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels#editing-a-label
</details>

<details>
  <summary>Does this work with Jira Server (aka: on-prem)?</summary>
  Honestly, no clue. I don't have access to a Jira Server instance so I'm not able to test it.  
But seeing how Atlassian is [ending support for it](https://www.atlassian.com/migration/assess/journey-to-cloud), there are no plans to support it.
</details>

<details>
  <summary>Does this work with Jira Data Center edition?</summary>
  Honestly, no clue. I don't have access to a Jira Data Center instance so I'm not able to test it.  
But if you do have access to one, I would not mind working together to get things working
</details>

## Future Functionality / Road Map
Here are a few things I want to add to this project over time

- [ ] Option to sync labels from Jira to PR labels
- [ ] Option to sync the issue priority from Jira to PR labels
- [ ] Option to add the Jira "fix version" as a "[Milestone](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/about-milestones)" on the PR
- [ ] Option to add the Jira "sprint" as a "[Milestone](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/about-milestones)" on the PR
- [ ] Ability to manage labels via a configuration file (this might end up being a different action)

## Inspiration
Inspiration for this action came from the following existing projects:
- [jira-description](https://github.com/marketplace/actions/jira-description)
- [jira-lint](https://github.com/marketplace/actions/jira-lint)