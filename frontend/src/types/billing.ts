export interface TimeEntry {
    id: number;
    project: number;
    project_name: string;
    client_name: string;
    date: string;
    hours: string;
    description: string;
    is_billed: boolean;
    created_at: string;
}

export interface TimeEntryTotals {
    total_hours: number;
    unbilled_hours: number;
    unbilled_amount: number;
}

export interface CreateTimeEntryPayload {
    project: number;
    date: string;
    hours: number;
    description?: string;
}
