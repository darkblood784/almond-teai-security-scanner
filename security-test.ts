--- a/security-test.ts
+++ b/security-test.ts
@@ -1 +1,4 @@
-const token = "dsflslkhdsgsdgsdsgs43546546132134fsdjfhns";
+const token = process.env.AUTH_TOKEN || '';
+if (!token) {
+  throw new Error('AUTH_TOKEN environment variable is not set');
+}
