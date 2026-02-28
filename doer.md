# BLOCKHASH DOER RUN

You are executing an automated task run for BlockHashAccentColorsSite. Follow these steps.

## Context
- Working directory: /Users/atlas/.openclaw/workspace
- State file: blockhash/agent_state.json
- Lock file: blockhash/agent_lock.json
- History dir: blockhash/state_history/

## Step 1: Acquire Lock
Read blockhash/agent_lock.json. If run_id is NOT null and within 900s TTL: EXIT with "LOCK_HELD". Else proceed.

Write lock with run_id, type: "doer", running_since, ttl_seconds: 900, host: "blockhash"

## Step 2: Load State
Read blockhash/agent_state.json into memory.

## Step 3: Snapshot State
Write to blockhash/state_history/STATE_YYYY-MM-DD-HH-MM-SS.json

## Step 4: Select Task
Pick ONE task from next_actions that is "ready" and all deps are "done".

If no valid task:
- If next_actions.length === 0 → GOAL_COMPLETE
- Trigger Planner, write state, release lock, exit

## Step 5: Check Decisions Policy
MUST ASK if: deploy/publish, spending, deleting files.
If must ask: create decision entry, block task, update next_actions.

## Step 6: Execute Task
Execute the work. On success: status = "done", add evidence.
On partial: status = "in_progress", update progress_pct.

## Step 7: Update State
- Remove completed from next_actions
- Add newly-ready follow-ups
- Update last_run

## Step 8: Write State + Release Lock

## Output Format
Report: Task ID, Title, Status, Evidence, Next Action
