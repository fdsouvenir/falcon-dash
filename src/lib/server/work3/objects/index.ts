import { getCommand } from '../engine/registry.js';
import { registerAreaCommands } from './area.js';
import { registerTaskCommands } from './task.js';
import { registerBlockerCommands } from './blocker.js';
import { registerSliceReaders } from './readers.js';
import { registerQuestionCommands } from './question.js';
import { registerDecisionCommands } from './decision.js';
import { registerFindingCommands } from './finding.js';
import { registerKnowledgeReaders } from './knowledge-readers.js';

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
	registerSliceReaders();
	registerKnowledgeReaders();
}
