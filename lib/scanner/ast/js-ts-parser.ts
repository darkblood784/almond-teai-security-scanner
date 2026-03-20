import { parse } from '@babel/parser';
import type { File } from '@babel/types';

export function parseJsTsAst(source: string): File {
  return parse(source, {
    sourceType: 'unambiguous',
    errorRecovery: true,
    allowReturnOutsideFunction: true,
    plugins: [
      'typescript',
      'jsx',
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      'dynamicImport',
      'decorators-legacy',
      'objectRestSpread',
      'optionalChaining',
      'nullishCoalescingOperator',
      'topLevelAwait',
    ],
  });
}
