--- a/security-test.ts
+++ b/security-test.ts
@@ -1 +1,5 @@
-const token = "hardcoded-secret-here";
+const token = process.env.API_SECRET;
+if (!token) {
+  throw new Error('API_SECRET environment variable is not set. Please set it in production and update .env.example.');
+}