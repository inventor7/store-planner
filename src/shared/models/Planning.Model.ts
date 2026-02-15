export const PlanningSync = {
  modelName: "planning.planning",
};

export interface WorkflowActivity {
  _ruid: string;
  name: string;
}

export interface Workflow {
  _ruid: string;
  name: string;
  workflow_activity_ids: WorkflowActivity[];
}

export interface Planning {
  _ruid: string;
  name: string;
  workflow_id: Workflow;
}
