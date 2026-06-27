/** Frontend view of an indexed Jira issue. */
export interface JiraDoc {
  readonly id: string;
  readonly key: string;
  readonly type: string | null;
  readonly summary: string | null;
  readonly description: string | null;
  readonly status: string | null;
  readonly priority: string | null;
  readonly assignee: {readonly displayName: string | null} | null;
  readonly project: {readonly key: string; readonly name: string | null} | null;
  readonly updated: string;
}
