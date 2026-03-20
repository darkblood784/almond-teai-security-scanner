// Test fixture for unsafe code execution detection
import { exec } from 'child_process';

export function dangerousExec(command: string) {
  // SHOULD FIND: Unsafe Code Execution
  // Dynamic command execution with user input
  exec(command);
}

export function dangerousEval(code: string) {
  // SHOULD FIND: Unsafe Code Execution
  // Dynamic code evaluation
  eval(code);
}

export function dangerousFunction(source: string) {
  // SHOULD FIND: Unsafe Code Execution
  // Function constructor with dynamic code
  const fn = new Function(source);
  return fn();
}

export function safeExecWithLiteral() {
  // SHOULD NOT FIND: command is a string literal
  exec('ls -la');
}

export function safeExecWithAllowlist(command: string) {
  // SHOULD NOT FIND: Using allowlist pattern (not pattern-detected, but safe pattern)
  const allowedCommands = ['ls', 'pwd', 'whoami'];
  if (allowedCommands.includes(command)) {
    exec(command);
  }
}
