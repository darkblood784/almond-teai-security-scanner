--- a/security-test.ts
+++ b/security-test.ts
@@ -3,4 +3,4 @@
 // Security test file
 
-import { config } from 'dotenv';
-config();
+const token = process.env.API_TOKEN;
+if (!token) { throw new Error('API_TOKEN environment variable is required'); }
-const token = "dsflslkhdsgsdgsdsgs43546546132134fsdjfhns";