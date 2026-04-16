--- a/security-test.ts
+++ b/security-test.ts
@@ -1 +1,3 @@
-const token = "dsflslkhdsgsdgsdsgs43546546132134fsdjfhns";
+import { config } from 'dotenv';
+config();
+const token = process.env.API_TOKEN;