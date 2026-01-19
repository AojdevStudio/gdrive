#!/usr/bin/env bash
# emit-event.sh - RBP Event Emitter for PAI Observability Integration
# Usage: ./emit-event.sh <event_type> <rbp_data_json>
#        source emit-event.sh; emit_rbp_event "RBP:TaskStart" '{"task_id":"test-001"}'
#
# Emits structured JSONL events compatible with PAI Observability Dashboard.
# Events are written to ~/.claude/history/raw-outputs/YYYY-MM/YYYY-MM-DD_all-events.jsonl

# Get script directory for standalone execution
EMIT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Session ID (set by caller or generate new)
: "${RBP_SESSION_ID:=$(uuidgen 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo "rbp-$$-$(date +%s)")}"
export RBP_SESSION_ID

# Observability enabled flag (can be disabled via config)
: "${RBP_OBSERVABILITY_ENABLED:=true}"

# Source app identifier
: "${RBP_SOURCE_APP:=RBP}"

# Sanitize output to redact sensitive data
sanitize_output() {
  local output="$1"

  # Use a pluggable sanitizer if available (allows custom policy)
  if [ -n "$RBP_SANITIZER_HOOK" ] && [ -x "$RBP_SANITIZER_HOOK" ]; then
    echo "$output" | "$RBP_SANITIZER_HOOK"
    return
  fi

  # Comprehensive secret patterns (case-insensitive)
  echo "$output" | \
    # API keys in various formats
    sed -E 's/(api[_-]?key|apikey)[=:]["'"'"']?[^"'"'"' ]{8,}["'"'"']?/\1=[REDACTED]/gi' | \
    # Passwords and secrets
    sed -E 's/(password|passwd|pwd|secret)[=:]["'"'"']?[^"'"'"' ]{4,}["'"'"']?/\1=[REDACTED]/gi' | \
    # Tokens (JWT, bearer, auth)
    sed -E 's/(token|bearer|auth)[=:]["'"'"']?[A-Za-z0-9_.-]{20,}["'"'"']?/\1=[REDACTED]/gi' | \
    # AWS-style keys
    sed -E 's/(AKIA|ASIA)[A-Z0-9]{16}/[AWS_KEY_REDACTED]/g' | \
    # Generic secrets in JSON
    sed -E 's/"(api_key|secret_key|access_token|private_key|client_secret)"[[:space:]]*:[[:space:]]*"[^"]+"/"\1":"[REDACTED]"/gi' | \
    # URLs with credentials
    sed -E 's#(https?://)[^:]+:[^@]+@#\1[CREDENTIALS_REDACTED]@#gi' | \
    # SSH private keys (simplified - full multiline would need different approach)
    sed -E 's/-----BEGIN[^-]+PRIVATE KEY-----/[PRIVATE_KEY_REDACTED]/g' | \
    # Hex-encoded secrets (32+ chars)
    sed -E 's/[a-fA-F0-9]{32,}/[HEX_REDACTED]/g'
}

# Get current timestamp in milliseconds
get_timestamp_ms() {
  if command -v gdate &>/dev/null; then
    gdate +%s%3N
  elif date --version 2>/dev/null | grep -q GNU; then
    date +%s%3N
  else
    # macOS fallback - seconds * 1000
    echo "$(($(date +%s) * 1000))"
  fi
}

# Get PST timestamp string
get_timestamp_pst() {
  TZ="America/Los_Angeles" date '+%Y-%m-%d %H:%M:%S %Z'
}

# Get event file path
get_event_file() {
  local year_month=$(date +%Y-%m)
  local date_str=$(date +%Y-%m-%d)
  echo "$HOME/.claude/history/raw-outputs/${year_month}/${date_str}_all-events.jsonl"
}

# Build event JSON using jq if available, fallback to printf
build_event_json() {
  local event_type="$1"
  local rbp_data="$2"
  local timestamp_ms=$(get_timestamp_ms)
  local timestamp_pst=$(get_timestamp_pst)
  local cwd="${PWD:-$(pwd)}"

  if command -v jq &>/dev/null; then
    # Use jq for safe JSON construction
    jq -n -c \
      --arg source_app "$RBP_SOURCE_APP" \
      --arg session_id "$RBP_SESSION_ID" \
      --arg hook_event_type "$event_type" \
      --arg cwd "$cwd" \
      --arg hook_event_name "$event_type" \
      --argjson rbp_data "$rbp_data" \
      --argjson timestamp "$timestamp_ms" \
      --arg timestamp_pst "$timestamp_pst" \
      '{
        source_app: $source_app,
        session_id: $session_id,
        hook_event_type: $hook_event_type,
        payload: {
          session_id: $session_id,
          cwd: $cwd,
          hook_event_name: $hook_event_name,
          rbp_data: $rbp_data
        },
        timestamp: $timestamp,
        timestamp_pst: $timestamp_pst
      }' 2>/dev/null
  else
    # Fallback: simple printf-based JSON (less safe with special chars)
    printf '{"source_app":"%s","session_id":"%s","hook_event_type":"%s","payload":{"session_id":"%s","cwd":"%s","hook_event_name":"%s","rbp_data":%s},"timestamp":%s,"timestamp_pst":"%s"}' \
      "$RBP_SOURCE_APP" \
      "$RBP_SESSION_ID" \
      "$event_type" \
      "$RBP_SESSION_ID" \
      "$cwd" \
      "$event_type" \
      "$rbp_data" \
      "$timestamp_ms" \
      "$timestamp_pst"
  fi
}

# Main event emission function
emit_rbp_event() {
  local event_type="$1"
  local rbp_data="$2"
  # Default to empty object if not provided
  if [ -z "$rbp_data" ]; then
    rbp_data='{}'
  fi

  # Skip if observability disabled
  if [ "$RBP_OBSERVABILITY_ENABLED" != "true" ]; then
    return 0
  fi

  # Get event file path
  local event_file=$(get_event_file)

  # Ensure directory exists
  mkdir -p "$(dirname "$event_file")" 2>/dev/null || return 1

  # Build event JSON
  local event_json
  event_json=$(build_event_json "$event_type" "$rbp_data")

  if [ -z "$event_json" ]; then
    # JSON build failed - skip silently
    return 1
  fi

  # Validate JSON with jq if available
  if command -v jq &>/dev/null; then
    echo "$event_json" | jq -e '.' >/dev/null 2>&1 || {
      echo "Invalid RBP event JSON (skipped)" >&2
      return 1
    }
  fi

  # Use flock for concurrent write safety (multiple RBP sessions)
  # Exclusive lock prevents interleaved writes
  if command -v flock &>/dev/null; then
    (
      flock -x 200 || return 1
      echo "$event_json" >> "$event_file"
    ) 200>>"$event_file" 2>/dev/null || {
      # Silently fail if flock unavailable or write fails
      return 1
    }
  else
    # No flock available (macOS without coreutils) - direct write
    echo "$event_json" >> "$event_file" 2>/dev/null || return 1
  fi

  # Set file permissions (user only)
  chmod 600 "$event_file" 2>/dev/null || true

  return 0
}

# Convenience functions for common event types
emit_loop_start() {
  local iteration="${1:-1}"
  local max_iterations="${2:-50}"

  if command -v jq &>/dev/null; then
    emit_rbp_event "RBP:LoopStart" "$(jq -n -c \
      --argjson iteration "$iteration" \
      --argjson max_iterations "$max_iterations" \
      '{iteration: $iteration, max_iterations: $max_iterations}')"
  else
    emit_rbp_event "RBP:LoopStart" "{\"iteration\":$iteration,\"max_iterations\":$max_iterations}"
  fi
}

emit_loop_end() {
  local iteration="${1:-1}"
  local status="${2:-completed}"

  if command -v jq &>/dev/null; then
    emit_rbp_event "RBP:LoopEnd" "$(jq -n -c \
      --argjson iteration "$iteration" \
      --arg status "$status" \
      '{iteration: $iteration, status: $status}')"
  else
    emit_rbp_event "RBP:LoopEnd" "{\"iteration\":$iteration,\"status\":\"$status\"}"
  fi
}

emit_task_start() {
  local iteration="$1"
  local task_id="$2"
  local task_title="$3"

  if command -v jq &>/dev/null; then
    emit_rbp_event "RBP:TaskStart" "$(jq -n -c \
      --argjson iteration "$iteration" \
      --arg task_id "$task_id" \
      --arg task_title "$task_title" \
      '{iteration: $iteration, task_id: $task_id, task_title: $task_title}')"
  else
    emit_rbp_event "RBP:TaskStart" "{\"iteration\":$iteration,\"task_id\":\"$task_id\",\"task_title\":\"$task_title\"}"
  fi
}

emit_task_progress() {
  local iteration="$1"
  local task_id="$2"
  local status="$3"

  if command -v jq &>/dev/null; then
    emit_rbp_event "RBP:TaskProgress" "$(jq -n -c \
      --argjson iteration "$iteration" \
      --arg task_id "$task_id" \
      --arg status "$status" \
      '{iteration: $iteration, task_id: $task_id, status: $status}')"
  else
    emit_rbp_event "RBP:TaskProgress" "{\"iteration\":$iteration,\"task_id\":\"$task_id\",\"status\":\"$status\"}"
  fi
}

emit_task_complete() {
  local iteration="$1"
  local task_id="$2"
  local bead_status="${3:-closed}"

  if command -v jq &>/dev/null; then
    emit_rbp_event "RBP:TaskComplete" "$(jq -n -c \
      --argjson iteration "$iteration" \
      --arg task_id "$task_id" \
      --arg bead_status "$bead_status" \
      '{iteration: $iteration, task_id: $task_id, bead_status: $bead_status}')"
  else
    emit_rbp_event "RBP:TaskComplete" "{\"iteration\":$iteration,\"task_id\":\"$task_id\",\"bead_status\":\"$bead_status\"}"
  fi
}

emit_test_run() {
  local iteration="$1"
  local task_id="$2"
  local test_command="$3"

  if command -v jq &>/dev/null; then
    emit_rbp_event "RBP:TestRun" "$(jq -n -c \
      --argjson iteration "${iteration:-0}" \
      --arg task_id "$task_id" \
      --arg test_command "$test_command" \
      '{iteration: $iteration, task_id: $task_id, test_command: $test_command}')"
  else
    emit_rbp_event "RBP:TestRun" "{\"iteration\":${iteration:-0},\"task_id\":\"$task_id\",\"test_command\":\"$test_command\"}"
  fi
}

emit_test_result() {
  local iteration="$1"
  local task_id="$2"
  local exit_code="$3"
  local test_output="$4"

  # Sanitize test output
  local sanitized_output=$(sanitize_output "$test_output")

  if command -v jq &>/dev/null; then
    emit_rbp_event "RBP:TestResult" "$(jq -n -c \
      --argjson iteration "${iteration:-0}" \
      --arg task_id "$task_id" \
      --argjson test_exit_code "$exit_code" \
      --arg test_output "$sanitized_output" \
      '{iteration: $iteration, task_id: $task_id, test_exit_code: $test_exit_code, test_output: $test_output}')"
  else
    # Escape quotes in output for non-jq fallback
    local escaped_output=$(echo "$sanitized_output" | sed 's/"/\\"/g' | tr '\n' ' ')
    emit_rbp_event "RBP:TestResult" "{\"iteration\":${iteration:-0},\"task_id\":\"$task_id\",\"test_exit_code\":$exit_code,\"test_output\":\"$escaped_output\"}"
  fi
}

emit_error() {
  local iteration="$1"
  local task_id="$2"
  local error_message="$3"

  if command -v jq &>/dev/null; then
    emit_rbp_event "RBP:Error" "$(jq -n -c \
      --argjson iteration "${iteration:-0}" \
      --arg task_id "$task_id" \
      --arg error_message "$error_message" \
      '{iteration: $iteration, task_id: $task_id, error_message: $error_message}')"
  else
    local escaped_msg=$(echo "$error_message" | sed 's/"/\\"/g')
    emit_rbp_event "RBP:Error" "{\"iteration\":${iteration:-0},\"task_id\":\"$task_id\",\"error_message\":\"$escaped_msg\"}"
  fi
}

emit_codex_review() {
  local status="$1"  # "start" or "complete"
  local spec_file="$2"
  local findings="${3:-}"

  if command -v jq &>/dev/null; then
    emit_rbp_event "RBP:CodexReview" "$(jq -n -c \
      --arg status "$status" \
      --arg spec_file "$spec_file" \
      --arg findings "$findings" \
      '{status: $status, spec_file: $spec_file, findings: $findings}')"
  else
    emit_rbp_event "RBP:CodexReview" "{\"status\":\"$status\",\"spec_file\":\"$spec_file\",\"findings\":\"$findings\"}"
  fi
}

emit_spec_parsed() {
  local spec_file="$1"
  local task_count="$2"

  if command -v jq &>/dev/null; then
    emit_rbp_event "RBP:SpecParsed" "$(jq -n -c \
      --arg spec_file "$spec_file" \
      --argjson task_count "$task_count" \
      '{spec_file: $spec_file, task_count: $task_count}')"
  else
    emit_rbp_event "RBP:SpecParsed" "{\"spec_file\":\"$spec_file\",\"task_count\":$task_count}"
  fi
}

# Standalone execution mode
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if [ $# -lt 2 ]; then
    echo "Usage: ./emit-event.sh <event_type> <rbp_data_json>"
    echo ""
    echo "Event types:"
    echo "  RBP:LoopStart, RBP:LoopEnd"
    echo "  RBP:TaskStart, RBP:TaskProgress, RBP:TaskComplete"
    echo "  RBP:TestRun, RBP:TestResult"
    echo "  RBP:Error"
    echo "  RBP:CodexReview, RBP:SpecParsed"
    echo ""
    echo "Example:"
    echo "  ./emit-event.sh 'RBP:TaskStart' '{\"iteration\":1,\"task_id\":\"test-001\",\"task_title\":\"Test Task\"}'"
    exit 1
  fi

  emit_rbp_event "$1" "$2"
  exit $?
fi
