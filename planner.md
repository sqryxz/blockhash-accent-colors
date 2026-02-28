# BLOCKHASH PLANNER RUN

You are executing a planning run for BlockHashAccentColorsSite.

## Context
- Working directory: /Users/atlas/.openclaw/workspace
- State file: blockhash/agent_state.json
- Lock file: blockhash/agent_lock.json

## Step 1: Acquire Lock
Read agent_lock.json. If run_id is NOT null within 900s: EXIT. Else proceed with type: "planner".

## Step 2: Check Triggers
Run if ANY:
- next_actions.length === 0
- >3 tasks blocked
- >2 tasks in_progress >3 days stale
- <5 ready tasks
- definition_of_done has unmet items

If NO trigger → 
- Output simple table with next 3 tasks (id, title, status)
- Release lock, exit

## Step 3: Constraint Audit
Compare last_run against constraints. If violations → generate remediation tasks.

## Step 4: Generate Tasks
For each trigger, create tasks with id, title, status, deps.

## Step 5: Write State
- Add tasks to backlog[]
- Update next_actions
- Update last_run
- Release lock

## Output
When trigger fires: Full report with triggered items and new tasks
When NO trigger: Simple table:
| ID | Title | Status |
|----|-------|--------|
| 1.1 | Initialize folders | ready |
| 1.2 | Write config | ready |

Report: Trigger fired, New tasks (id/title/status), Next actions
