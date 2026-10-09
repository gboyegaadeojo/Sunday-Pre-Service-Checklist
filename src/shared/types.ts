// API request/response shapes shared by the Worker and the browser.

export interface ChecklistTask {
  id: number;
  text: string;
}

export interface ChecklistSection {
  id: number;
  name: string;
  tasks: ChecklistTask[];
}

export interface ChecklistCategory {
  id: number;
  name: string;
  sections: ChecklistSection[];
}

export interface ChecklistResponse {
  list: { id: number; name: string };
  categories: ChecklistCategory[];
}

export interface ApiErrorBody {
  error: string;
}
