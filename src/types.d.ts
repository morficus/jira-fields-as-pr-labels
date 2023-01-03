type JiraIssue = {
    id: string
    self: string
    key: string
    names: {
        [key: string]: string
    }
    fields: {
        summary: string
        issuetype: {
            self: string
			id: string
			description: string
			iconUrl: string
			name: string
			subtask: boolean
			avatarId: number
			hierarchyLevel: number
        }
        fixVersions: Array<{
            self: string
			id: string
			description: string
			name: string
			archived: boolean
			released: boolean
        }>
        priority: {
            self: string
			iconUrl: string
			name: string
			id: string
        }
        labels: Array<string>
    }
}