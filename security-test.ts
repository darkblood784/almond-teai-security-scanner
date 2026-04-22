--- security-test.ts
+++ security-test.ts
@@ -1,3 +1,8 @@
 const token = "hardcoded-secret-here";
+const token = process.env.API_TOKEN;
+if (!token) {
+  throw new Error("API_TOKEN environment variable is not set. Please set it to your API token.");
+} 
+
 console.log(token);
