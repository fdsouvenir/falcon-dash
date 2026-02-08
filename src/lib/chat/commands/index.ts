export { commands, findCommands, registerCommand } from './registry';
export type { CommandContext, SlashCommand } from './registry';

// Register all commands (side-effect imports)
import './placeholders';
import './new';
import './stop';
import './status';
import './reasoning';
import './compact';
import './usage';
import './verbose';
import './context';
import './subagents';
import './send';
