import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type { File } from '@babel/types';
import type { AstScanFinding } from './types';
import { getLineSnippet, looksLikeHardcodedSecret } from './utils';

interface RuleContext {
  source: string;
  findings: AstScanFinding[];
  childProcessAliases: Set<string>;
  childProcessMethodAliases: Set<string>;
  jwtAliases: Set<string>;
  cryptoAliases: Set<string>;
}

function pushFinding(context: RuleContext, finding: AstScanFinding) {
  context.findings.push(finding);
}

function getNodeLine(node: t.Node): number | null {
  return node.loc?.start.line ?? null;
}

function memberName(node: t.MemberExpression): string | null {
  if (!node.computed && t.isIdentifier(node.property)) return node.property.name;
  if (node.computed && t.isStringLiteral(node.property)) return node.property.value;
  return null;
}

function literalText(node: t.Node | null | undefined): string | null {
  if (!node) return null;
  if (t.isStringLiteral(node)) return node.value;
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return node.quasis.map(quasi => quasi.value.cooked ?? '').join('');
  }
  return null;
}

function isDynamicValue(node: t.Node | null | undefined): boolean {
  if (!node) return false;
  if (t.isStringLiteral(node)) return false;
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) return false;
  if (t.isArrayExpression(node)) {
    return node.elements.some(element => !!element && !t.isStringLiteral(element) && !(t.isTemplateLiteral(element) && element.expressions.length === 0));
  }
  return true;
}

function detectUnsafeExecution(path: NodePath<t.CallExpression | t.NewExpression>, context: RuleContext) {
  const node = path.node;
  const callee = node.callee;
  const args = 'arguments' in node ? node.arguments : [];
  const firstArg = args[0];
  let matched = false;
  let description = 'Dynamic code execution was detected in a JS/TS code path.';

  if (t.isIdentifier(callee)) {
    if (callee.name === 'eval' || callee.name === 'Function' || context.childProcessMethodAliases.has(callee.name)) {
      matched = true;
      description = callee.name === 'eval' || callee.name === 'Function'
        ? 'Dynamic code evaluation was detected. This can lead to code injection if untrusted input reaches this path.'
        : 'A child_process execution sink was detected. If untrusted input reaches this path, it can enable command injection.';
    }
  } else if (t.isMemberExpression(callee)) {
    const property = memberName(callee);
    if (
      property &&
      ['exec', 'execSync', 'spawn', 'spawnSync'].includes(property) &&
      t.isIdentifier(callee.object) &&
      context.childProcessAliases.has(callee.object.name)
    ) {
      matched = true;
      description = 'A child_process execution sink was detected. If untrusted input reaches this path, it can enable command injection.';
    }
  }

  if (!matched || !isDynamicValue(firstArg)) return;
  const line = getNodeLine(node);
  pushFinding(context, {
    type: 'Unsafe Code Execution',
    category: 'code',
    severity: 'high',
    confidence: 'likely',
    exploitability: 'possible',
    line,
    code: getLineSnippet(context.source, line),
    description,
    suggestion: 'Avoid dynamic code or command execution with untrusted input. Prefer strict allowlists, parameterization, and safer APIs.',
  });
}

function detectSqlPattern(path: NodePath<t.CallExpression>, context: RuleContext) {
  const { node } = path;
  let sinkMatched = false;

  if (t.isIdentifier(node.callee) && /query|execute|queryraw|executeraw/i.test(node.callee.name)) {
    sinkMatched = true;
  } else if (t.isMemberExpression(node.callee)) {
    const property = memberName(node.callee);
    if (property && /query|execute|queryraw|executeraw/i.test(property)) {
      sinkMatched = true;
    }
  }

  if (!sinkMatched || node.arguments.length === 0) return;
  const firstArg = node.arguments[0];
  if (!firstArg || t.isSpreadElement(firstArg) || !isDynamicValue(firstArg)) return;

  const line = getNodeLine(node);
  pushFinding(context, {
    type: 'Potential SQL Injection',
    category: 'code',
    severity: 'high',
    confidence: 'likely',
    exploitability: 'possible',
    line,
    code: getLineSnippet(context.source, line),
    description: 'A query execution sink appears to use dynamically constructed SQL. If user-controlled input reaches this path, it may enable SQL injection.',
    suggestion: 'Use parameterized queries or safe ORM APIs. Avoid building SQL strings dynamically from untrusted input.',
  });
}

function detectInsecureCrypto(path: NodePath<t.CallExpression>, context: RuleContext) {
  const { node } = path;
  let property: string | null = null;
  let cryptoMatched = false;

  if (t.isIdentifier(node.callee) && context.cryptoAliases.has(node.callee.name)) {
    cryptoMatched = true;
  } else if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.object) && context.cryptoAliases.has(node.callee.object.name)) {
    cryptoMatched = true;
    property = memberName(node.callee);
  }

  if (!cryptoMatched) return;
  const firstArg = node.arguments[0];
  if (!firstArg || t.isSpreadElement(firstArg)) return;
  const firstLiteral = literalText(firstArg);

  if (property === 'createHash' && firstLiteral && /^(md5|sha1)$/i.test(firstLiteral)) {
    const line = getNodeLine(node);
    pushFinding(context, {
      type: 'Insecure Cryptographic Usage',
      category: 'code',
      severity: 'medium',
      confidence: 'verified',
      exploitability: 'possible',
      line,
      code: getLineSnippet(context.source, line),
      description: `The code uses ${firstLiteral.toUpperCase()} in a security-relevant hashing path. Weak hash algorithms should not be used for modern security controls.`,
      suggestion: 'Replace weak hashing with stronger primitives such as SHA-256 or a dedicated password hashing function like bcrypt, scrypt, or Argon2.',
    });
  }

  if ((property === 'createCipher' || property === 'createCipheriv') && firstLiteral && /(ecb|des|rc4)/i.test(firstLiteral)) {
    const line = getNodeLine(node);
    pushFinding(context, {
      type: 'Insecure Cryptographic Usage',
      category: 'code',
      severity: 'high',
      confidence: 'likely',
      exploitability: 'possible',
      line,
      code: getLineSnippet(context.source, line),
      description: `The code appears to use an insecure cipher or mode (${firstLiteral}). This may materially weaken confidentiality guarantees.`,
      suggestion: 'Use modern authenticated encryption modes such as AES-GCM and avoid legacy ciphers or ECB mode.',
    });
  }
}

function detectAuthLogic(path: NodePath<t.CallExpression | t.BinaryExpression | t.VariableDeclarator | t.AssignmentExpression>, context: RuleContext) {
  const node = path.node;

  if (t.isCallExpression(node)) {
    let property: string | null = null;
    let jwtMatched = false;

    if (t.isIdentifier(node.callee) && context.jwtAliases.has(node.callee.name)) {
      jwtMatched = true;
    } else if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.object) && context.jwtAliases.has(node.callee.object.name)) {
      jwtMatched = true;
      property = memberName(node.callee);
    }

    if (jwtMatched && property && ['sign', 'verify'].includes(property)) {
      const secretArg = node.arguments[1];
      if (secretArg && !t.isSpreadElement(secretArg)) {
        const secret = literalText(secretArg);
        if (secret && looksLikeHardcodedSecret(secret)) {
          const line = getNodeLine(node);
          pushFinding(context, {
            type: 'Insecure Authentication',
            category: 'code',
            severity: 'high',
            confidence: 'verified',
            exploitability: 'possible',
            line,
            code: getLineSnippet(context.source, line),
            description: 'JWT signing or verification appears to use a hardcoded secret in application code.',
            suggestion: 'Move JWT secrets to secure environment variables or a secret manager and rotate any exposed values.',
          });
        }
      }
    }
    return;
  }

  if (t.isBinaryExpression(node) && ['==', '==='].includes(node.operator)) {
    const literal = t.isStringLiteral(node.left) ? node.left : t.isStringLiteral(node.right) ? node.right : null;
    const otherSide = literal === node.left ? node.right : node.left;
    if (literal && t.isIdentifier(otherSide) && /password|token|secret|auth/i.test(otherSide.name) && looksLikeHardcodedSecret(literal.value)) {
      const line = getNodeLine(node);
      pushFinding(context, {
        type: 'Insecure Authentication',
        category: 'code',
        severity: 'high',
        confidence: 'likely',
        exploitability: 'possible',
        line,
        code: getLineSnippet(context.source, line),
        description: 'Authentication logic appears to compare a credential-like value directly against a hardcoded string in code.',
        suggestion: 'Remove hardcoded credentials from code and move authentication policy decisions to secure backend-controlled logic.',
      });
    }
    return;
  }

  const id = t.isVariableDeclarator(node)
    ? node.id
    : t.isAssignmentExpression(node) && t.isIdentifier(node.left)
    ? node.left
    : null;
  const init = t.isVariableDeclarator(node)
    ? node.init
    : t.isAssignmentExpression(node)
    ? node.right
    : null;

  if (!id || !t.isIdentifier(id) || !init) return;
  const assigned = literalText(init);
  if (!assigned || !looksLikeHardcodedSecret(assigned) || !/secret|token|password|passwd|key|jwt/i.test(id.name)) return;

  const line = getNodeLine(node);
  pushFinding(context, {
    type: /password|passwd/i.test(id.name) ? 'Hardcoded Secret' : 'Insecure Authentication',
    category: /password|passwd|secret|token|key/i.test(id.name) ? 'secret' : 'code',
    severity: 'high',
    confidence: 'likely',
    exploitability: 'possible',
    line,
    code: getLineSnippet(context.source, line),
    description: 'Credential-like material appears to be hardcoded in executable JS/TS code, increasing the risk of compromise and misuse.',
    suggestion: 'Remove hardcoded credentials from code and use secure configuration or a secret manager instead.',
  });
}

export function runJsTsRules(ast: File, source: string, _relPath: string): AstScanFinding[] {
  const context: RuleContext = {
    source,
    findings: [],
    childProcessAliases: new Set<string>(),
    childProcessMethodAliases: new Set<string>(),
    jwtAliases: new Set<string>(),
    cryptoAliases: new Set<string>(),
  };

  traverse(ast, {
    ImportDeclaration(path) {
      const sourceValue = path.node.source.value;
      if (sourceValue === 'child_process') {
        for (const specifier of path.node.specifiers) {
          if (t.isImportNamespaceSpecifier(specifier) || t.isImportDefaultSpecifier(specifier)) {
            context.childProcessAliases.add(specifier.local.name);
          } else if (t.isImportSpecifier(specifier)) {
            const importedName = t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value;
            if (['exec', 'execSync', 'spawn', 'spawnSync'].includes(importedName)) {
              context.childProcessMethodAliases.add(specifier.local.name);
            }
          }
        }
      }

      if (sourceValue === 'jsonwebtoken') {
        for (const specifier of path.node.specifiers) context.jwtAliases.add(specifier.local.name);
      }

      if (sourceValue === 'crypto') {
        for (const specifier of path.node.specifiers) context.cryptoAliases.add(specifier.local.name);
      }
    },
    VariableDeclarator(path) {
      const { node } = path;
      if (t.isIdentifier(node.id) && t.isCallExpression(node.init) && t.isIdentifier(node.init.callee) && node.init.callee.name === 'require' && node.init.arguments.length === 1) {
        const arg = node.init.arguments[0];
        if (t.isStringLiteral(arg) && arg.value === 'child_process') context.childProcessAliases.add(node.id.name);
        if (t.isStringLiteral(arg) && arg.value === 'jsonwebtoken') context.jwtAliases.add(node.id.name);
        if (t.isStringLiteral(arg) && arg.value === 'crypto') context.cryptoAliases.add(node.id.name);
      }
      detectAuthLogic(path as NodePath<t.VariableDeclarator>, context);
    },
    AssignmentExpression(path) {
      detectAuthLogic(path as NodePath<t.AssignmentExpression>, context);
    },
    CallExpression(path) {
      detectUnsafeExecution(path as NodePath<t.CallExpression>, context);
      detectSqlPattern(path as NodePath<t.CallExpression>, context);
      detectInsecureCrypto(path as NodePath<t.CallExpression>, context);
      detectAuthLogic(path as NodePath<t.CallExpression>, context);
    },
    NewExpression(path) {
      detectUnsafeExecution(path as NodePath<t.NewExpression>, context);
    },
    BinaryExpression(path) {
      detectAuthLogic(path as NodePath<t.BinaryExpression>, context);
    },
  });

  return context.findings;
}
