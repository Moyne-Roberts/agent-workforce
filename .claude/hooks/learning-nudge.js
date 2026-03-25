#!/usr/bin/env node

/**
 * Learning Nudge Hook — PostToolUse
 *
 * Tracks error->fix cycles during a session. After 3+ errors followed by
 * a successful fix, nudges the user to run /mr-automations:learn.
 *
 * State persisted in temp file keyed by parent PID.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const SESSION_ID = process.ppid || "default";
const STATE_FILE = path.join(os.tmpdir(), `mr-auto-learn-${SESSION_ID}.json`);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    processHook(JSON.parse(input));
  } catch {
    // Silent fail — hooks should never break the session
  }
});

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { errorCount: 0, fixCount: 0, nudged: false };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

function processHook(data) {
  const state = loadState();
  if (data.tool_name !== "Bash") return saveState(state);

  const response = data.tool_response || {};
  const output = (response.stdout || "") + (response.stderr || "");
  const isError =
    response.exitCode !== 0 ||
    /Error|ERR!|FAILED|TypeError|ReferenceError|SyntaxError|Cannot find|ENOENT|ECONNREFUSED/i.test(output);

  if (isError) {
    state.errorCount++;
  } else if (state.errorCount > 0) {
    state.fixCount++;
  }

  if (state.errorCount >= 3 && state.fixCount >= 1 && !state.nudged) {
    state.nudged = true;
    saveState(state);
    console.log(
      "\nLooks like you just debugged something non-trivial. " +
      "Run /mr-automations:learn to capture this for the team.\n"
    );
    return;
  }

  saveState(state);
}
