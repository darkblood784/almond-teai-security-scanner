--- a/security-test.ts
+++ b/security-test.ts
@@ -4,4 +4,4 @@
 // Security test file
 
-import { config } from 'dotenv';
-config();
+const token = process.env.SECRET_TOKEN;
+if (!token) { throw new Error('SECRET_TOKEN environment variable is required'); }
-export const getToken = () => token;
+export const getToken = () => token;