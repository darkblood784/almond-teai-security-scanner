// Test fixture for SQL injection detection
import Database from 'better-sqlite3';

const db = new Database(':memory:');

export function vulnerableSqlQuery(userId: string) {
  // SHOULD FIND: Potential SQL Injection
  // Dynamic SQL construction with user input
  const result = db.prepare(`SELECT * FROM users WHERE id = ${userId}`).all();
  return result;
}

export function vulnerableSqlExecute(email: string) {
  // SHOULD FIND: Potential SQL Injection
  const query = `UPDATE users SET active = 1 WHERE email = ${email}`;
  db.exec(query);
}

export function safeSqlWithParameters(userId: string) {
  // SHOULD NOT FIND: Parameterized query
  const result = db.prepare('SELECT * FROM users WHERE id = ?').all(userId);
  return result;
}

export function safeSqlWithNamedParameters(email: string) {
  // SHOULD NOT FIND: Named parameters (ORM safe pattern)
  const result = db.prepare('SELECT * FROM users WHERE email = :email').all({ email });
  return result;
}

// Prisma example (ORM - should not flag)
export async function prismaExample(userId: string) {
  // Using proper query interface (if we had prisma imported)
  // This is more of a documentation example
  // const user = await prisma.user.findUnique({
  //   where: { id: userId }
  // });
}
