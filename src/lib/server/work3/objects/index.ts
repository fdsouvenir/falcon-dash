import { getCommand } from '../engine/registry.js';
import { registerAreaCommands } from './area.js';
import { registerTaskCommands } from './task.js';
import { registerBlockerCommands } from './blocker.js';
import { registerSliceReaders } from './readers.js';
import { registerQuestionCommands } from './question.js';
import { registerDecisionCommands } from './decision.js';
import { registerFindingCommands } from './finding.js';
import { registerKnowledgeReaders } from './knowledge-readers.js';
import { registerPlanCommands } from './plan.js';
import { registerReviewCommands } from './review.js';
import { registerChangeCommands } from './change.js';
import { registerGovernanceReaders } from './governance-readers.js';
import { registerProjectCommands } from './project.js';
import { registerPhaseCommands, registerMilestoneCommands } from './phase-milestone.js';
import { registerRelationshipCommands } from './relationships.js';
import { registerProjectReaders } from './project-readers.js';

export { loadArea, requireActiveArea } from './area.js';
export { loadTask, legalCommandsFor, TASK_STATUSES, TASK_PRIORITIES } from './task.js';
export type { TaskRow, TaskStatus } from './task.js';
export { loadBlocker, BLOCKER_SOURCE_KINDS } from './blocker.js';
export type { BlockerRow } from './blocker.js';
export { loadQuestion, currentAnswer, answerHistory, ANSWER_CONFIDENCES } from './question.js';
export type { QuestionRow, AnswerRow } from './question.js';
export { loadDecision, currentPackage, packageHistory } from './decision.js';
export type { DecisionRow, DecisionPackageRow } from './decision.js';
export { loadFinding, FINDING_CONFIDENCES } from './finding.js';
export type { FindingRow } from './finding.js';
export { loadPlan, currentPlanRevision, latestDraftRevision, planRevisions } from './plan.js';
export type { PlanRow, PlanRevisionRow } from './plan.js';
export { REVIEW_OUTCOMES } from './review.js';
export {
	loadChange,
	currentChangeRevision,
	changeSubjectState,
	effectiveAuthorization,
	EXECUTION_STATES,
	VERIFICATION_STATES
} from './change.js';
export type { ChangeRow, ChangeRevisionRow } from './change.js';
export { loadProject, projectCriteria, satisfiedCriteria } from './project.js';
export type { ProjectRow, CompletionCriterion } from './project.js';
export { loadPhase, loadMilestone } from './phase-milestone.js';
export type { PhaseRow, MilestoneRow } from './phase-milestone.js';
export { activeLinks, RELATIONSHIP_TYPES } from './relationships.js';
export type { RelationshipRow, RelationshipType } from './relationships.js';
export { reconcileTerminal, invalidateSatisfiesFrom } from './reconcile.js';

/**
 * Register all v3 object commands and readers. Idempotent per registry state —
 * safe to call from startWork3() and from tests after a registry reset.
 */
export function registerWork3Objects(): void {
	if (getCommand('create_area')) return;
	registerAreaCommands();
	registerTaskCommands();
	registerBlockerCommands();
	registerQuestionCommands();
	registerDecisionCommands();
	registerFindingCommands();
	registerPlanCommands();
	registerReviewCommands();
	registerChangeCommands();
	registerProjectCommands();
	registerPhaseCommands();
	registerMilestoneCommands();
	registerRelationshipCommands();
	registerSliceReaders();
	registerKnowledgeReaders();
	registerGovernanceReaders();
	registerProjectReaders();
}
