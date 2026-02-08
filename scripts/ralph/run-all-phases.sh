#!/bin/bash
# Run remaining falcon-dash phases back-to-back
# Usage: ./run-all-phases.sh [--tool amp|claude] [--start-phase N] [--max-iterations N]
#
# Copies the appropriate PRD and CLAUDE.md for each phase,
# then runs ralph.sh. Continues to next phase on success.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Defaults
TOOL="claude"
START_PHASE=4
MAX_ITERATIONS=25

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)
      TOOL="$2"
      shift 2
      ;;
    --tool=*)
      TOOL="${1#*=}"
      shift
      ;;
    --start-phase)
      START_PHASE="$2"
      shift 2
      ;;
    --start-phase=*)
      START_PHASE="${1#*=}"
      shift
      ;;
    --max-iterations)
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    --max-iterations=*)
      MAX_ITERATIONS="${1#*=}"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Phase definitions: phase_number → prd file, claude file
declare -A PHASE_PRD
declare -A PHASE_CLAUDE
declare -A PHASE_NAME

PHASE_PRD[4]="prd-phase-4.json"
PHASE_CLAUDE[4]="CLAUDE-phase-4.md"
PHASE_NAME[4]="PM Module"

PHASE_PRD[5]="prd-phase-5.json"
PHASE_CLAUDE[5]="CLAUDE-phase-5.md"
PHASE_NAME[5]="Settings + Canvas"

PHASE_PRD[6]="prd-phase-6.json"
PHASE_CLAUDE[6]="CLAUDE-phase-6.md"
PHASE_NAME[6]="Mobile & Polish"

PHASES=(4 5 6)

echo "═══════════════════════════════════════════════════════════════"
echo "  falcon-dash — Automated Phase Runner"
echo "  Tool: $TOOL | Start: Phase $START_PHASE | Max iterations/phase: $MAX_ITERATIONS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

TOTAL_START=$(date +%s)

for phase in "${PHASES[@]}"; do
  # Skip phases before start
  if [ "$phase" -lt "$START_PHASE" ]; then
    continue
  fi

  PRD_FILE="${PHASE_PRD[$phase]}"
  CLAUDE_FILE="${PHASE_CLAUDE[$phase]}"
  NAME="${PHASE_NAME[$phase]}"

  echo ""
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║  Phase $phase: $NAME"
  echo "╠═══════════════════════════════════════════════════════════╣"
  echo ""

  # Verify files exist
  if [ ! -f "$SCRIPT_DIR/$PRD_FILE" ]; then
    echo "ERROR: $PRD_FILE not found in $SCRIPT_DIR"
    exit 1
  fi
  if [ ! -f "$SCRIPT_DIR/$CLAUDE_FILE" ]; then
    echo "ERROR: $CLAUDE_FILE not found in $SCRIPT_DIR"
    exit 1
  fi

  # Copy PRD and CLAUDE.md into place
  echo "  Setting up: $PRD_FILE → prd.json"
  cp "$SCRIPT_DIR/$PRD_FILE" "$SCRIPT_DIR/prd.json"

  echo "  Setting up: $CLAUDE_FILE → CLAUDE.md"
  cp "$SCRIPT_DIR/$CLAUDE_FILE" "$SCRIPT_DIR/CLAUDE.md"

  # Create and checkout the branch
  BRANCH=$(jq -r '.branchName' "$SCRIPT_DIR/prd.json")
  echo "  Branch: $BRANCH"

  cd "$PROJECT_DIR"
  if git show-ref --verify --quiet "refs/heads/$BRANCH" 2>/dev/null; then
    echo "  Branch exists, checking out..."
    git checkout "$BRANCH"
  else
    echo "  Creating branch from current HEAD..."
    git checkout -b "$BRANCH"
  fi

  PHASE_START=$(date +%s)

  # Run ralph
  echo ""
  "$SCRIPT_DIR/ralph.sh" --tool "$TOOL" "$MAX_ITERATIONS"
  RALPH_EXIT=$?

  PHASE_END=$(date +%s)
  PHASE_DURATION=$(( PHASE_END - PHASE_START ))
  PHASE_MINUTES=$(( PHASE_DURATION / 60 ))
  PHASE_SECONDS=$(( PHASE_DURATION % 60 ))

  if [ $RALPH_EXIT -ne 0 ]; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║  ❌ Phase $phase FAILED (exit code $RALPH_EXIT)"
    echo "║  Duration: ${PHASE_MINUTES}m ${PHASE_SECONDS}s"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    echo "Fix the issues and re-run with: ./run-all-phases.sh --start-phase $phase"
    exit 1
  fi

  echo ""
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║  ✅ Phase $phase: $NAME — COMPLETE"
  echo "║  Duration: ${PHASE_MINUTES}m ${PHASE_SECONDS}s"
  echo "╚═══════════════════════════════════════════════════════════╝"

  # Brief pause between phases
  sleep 3
done

TOTAL_END=$(date +%s)
TOTAL_DURATION=$(( TOTAL_END - TOTAL_START ))
TOTAL_MINUTES=$(( TOTAL_DURATION / 60 ))
TOTAL_SECONDS=$(( TOTAL_DURATION % 60 ))

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  🎉 ALL PHASES COMPLETE!"
echo "  Total duration: ${TOTAL_MINUTES}m ${TOTAL_SECONDS}s"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Branches created:"
for phase in "${PHASES[@]}"; do
  if [ "$phase" -ge "$START_PHASE" ]; then
    echo "  - ralph/phase-${phase}-*"
  fi
done
echo ""
echo "Next: merge branches to main and run a full integration test."
