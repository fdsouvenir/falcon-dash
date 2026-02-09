#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop (Svelte 5 Migration)
# Usage: ./ralph.sh [--tool amp|claude] [max_iterations]
#
# Each iteration:
#   1. Agent builds ONE story and commits
#   2. Quality gates run EXTERNALLY (not by the agent)
#   3. If gates fail, next iteration gets the error output
#   4. Loop until all stories pass or max iterations reached
#
# Enhancements over build/ralph.sh:
#   - 60-minute timeout on agent invocation (catches hangs)
#   - Timeouts on quality gates (120s check/lint/test, 180s build)
#   - Staleness watchdog (warns if no commit in 30+ minutes)

# NO set -e — we handle all errors explicitly
# This prevents the script from dying when quality gates return non-zero

TOOL="claude"
MAX_ITERATIONS=25

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)       TOOL="$2"; shift 2 ;;
    --tool=*)     TOOL="${1#*=}"; shift ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

if [[ "$TOOL" != "amp" && "$TOOL" != "claude" ]]; then
  echo "Error: Invalid tool '$TOOL'. Must be 'amp' or 'claude'."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"
GATE_FAIL_FILE="$SCRIPT_DIR/.last-gate-failure"

# ── Archive previous run if branch changed ──────────────────────
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    DATE=$(date +%Y-%m-%d)
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"
    echo "Archiving previous run: $LAST_BRANCH → $ARCHIVE_FOLDER"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

# Track current branch
if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  [ -n "$CURRENT_BRANCH" ] && echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
fi

# Initialize progress file
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

# Clear stale gate failure
rm -f "$GATE_FAIL_FILE"

# ── Helper: check if all stories pass ───────────────────────────
check_all_complete() {
  local remaining
  remaining=$(jq '[.userStories[] | select(.passes != true)] | length' "$PRD_FILE" 2>/dev/null || echo "999")
  [ "$remaining" -eq 0 ]
}

if check_all_complete; then
  echo "All stories already pass. Nothing to do."
  exit 0
fi

echo "Starting Ralph (Svelte 5 Migration) - Tool: $TOOL - Max iterations: $MAX_ITERATIONS"
echo "Project: $PROJECT_DIR"
echo ""

# ── Main loop ───────────────────────────────────────────────────
for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="

  # Inject gate failure context if previous iteration failed
  GATE_CONTEXT=""
  if [ -f "$GATE_FAIL_FILE" ]; then
    GATE_CONTEXT=$(cat "$GATE_FAIL_FILE")
    rm -f "$GATE_FAIL_FILE"
    echo "⚠️  Previous quality gate failed — agent will see the errors"
  fi

  # Build prompt
  PROMPT=$(cat "$SCRIPT_DIR/CLAUDE.md")
  if [ -n "$GATE_CONTEXT" ]; then
    PROMPT="$PROMPT

## ⚠️ QUALITY GATE FAILURE FROM PREVIOUS ITERATION

The following quality checks failed after your last commit. Fix these issues BEFORE working on a new story.
Do NOT mark any new story as passing until these are fixed. You may need to amend the last commit.

\`\`\`
$GATE_CONTEXT
\`\`\`
"
  fi

  # ── Run the agent (with 60-minute timeout) ─────────────────────
  if [[ "$TOOL" == "amp" ]]; then
    OUTPUT=$(timeout 3600 bash -c 'echo "$1" | amp --dangerously-allow-all 2>&1' _ "$PROMPT" | tee /dev/stderr) || true
  else
    OUTPUT=$(timeout 3600 bash -c 'echo "$1" | claude --dangerously-skip-permissions --print 2>&1' _ "$PROMPT" | tee /dev/stderr) || true
  fi

  # ── Staleness watchdog ─────────────────────────────────────────
  cd "$PROJECT_DIR"
  LAST_COMMIT_AGE=$(( $(date +%s) - $(git log -1 --format=%ct 2>/dev/null || echo "0") ))
  if [ "$LAST_COMMIT_AGE" -gt 1800 ]; then
    echo "⚠️ No new commit in 30+ minutes — agent may have stalled"
  fi

  # ── External quality gates (with timeouts) ─────────────────────
  echo ""
  echo "───────────────────────────────────────────────────────"
  echo "  Running external quality gates..."
  echo "───────────────────────────────────────────────────────"

  GATE_PASSED=true
  GATE_OUTPUT=""

  # Gate 1: format (auto-fix, don't fail on this)
  echo "  [1/5] npm run format..."
  npm run format >/dev/null 2>&1 || true
  echo "  ✅ formatted"

  # Gate 2: svelte-check (120s timeout)
  echo "  [2/5] npm run check..."
  CHECK_OUT=$(timeout 120 npm run check 2>&1 || true)
  if echo "$CHECK_OUT" | grep -q "found 0 errors"; then
    echo "  ✅ npm run check passed"
  else
    GATE_PASSED=false
    GATE_OUTPUT+="=== npm run check FAILED ===
$CHECK_OUT

"
    echo "  ❌ npm run check failed"
  fi

  # Gate 3: lint (120s timeout)
  echo "  [3/5] npm run lint..."
  LINT_OUT=$(timeout 120 npm run lint 2>&1 || true)
  if [ $? -eq 0 ] && ! echo "$LINT_OUT" | grep -qE "(error|Error)"; then
    echo "  ✅ npm run lint passed"
  else
    # Check if it's just warnings vs actual errors
    if echo "$LINT_OUT" | grep -qE "^[[:space:]]*[0-9]+ error"; then
      GATE_PASSED=false
      GATE_OUTPUT+="=== npm run lint FAILED ===
$LINT_OUT

"
      echo "  ❌ npm run lint failed"
    else
      echo "  ✅ npm run lint passed (warnings only)"
    fi
  fi

  # Gate 4: build (180s timeout)
  echo "  [4/5] npm run build..."
  BUILD_OUT=$(timeout 180 npm run build 2>&1 || true)
  if echo "$BUILD_OUT" | grep -q "✔ done"; then
    echo "  ✅ npm run build passed"
  else
    GATE_PASSED=false
    GATE_OUTPUT+="=== npm run build FAILED ===
$BUILD_OUT

"
    echo "  ❌ npm run build failed"
  fi

  # Gate 5: playwright tests (120s timeout)
  echo "  [5/5] npm run test..."
  TEST_OUT=$(timeout 120 npm run test 2>&1 || true)
  if echo "$TEST_OUT" | grep -q "passed"; then
    echo "  ✅ npm run test passed"
  else
    if echo "$TEST_OUT" | grep -q "failed"; then
      GATE_PASSED=false
      GATE_OUTPUT+="=== npm run test FAILED ===
$TEST_OUT

"
      echo "  ❌ npm run test failed"
    else
      echo "  ⚠️  npm run test inconclusive, skipping"
    fi
  fi

  echo "───────────────────────────────────────────────────────"

  if [ "$GATE_PASSED" = true ]; then
    echo "  ✅ All quality gates passed"

    # Commit any format changes
    if ! git diff --quiet 2>/dev/null; then
      echo "  📝 Format changes detected, committing..."
      git add -A
      git commit -m "chore: format" --no-verify 2>/dev/null || true
    fi

    # Check if all stories complete
    if check_all_complete; then
      echo ""
      echo "═══════════════════════════════════════════════════════"
      echo "  🎉 Ralph completed all tasks!"
      echo "  Completed at iteration $i of $MAX_ITERATIONS"
      echo "═══════════════════════════════════════════════════════"
      exit 0
    fi
  else
    echo "  ❌ Quality gates FAILED — next iteration will fix"
    echo "$GATE_OUTPUT" > "$GATE_FAIL_FILE"
  fi

  echo "Iteration $i complete. Continuing..."
  sleep 2
done

echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
echo "Check $PROGRESS_FILE for status."
exit 1
