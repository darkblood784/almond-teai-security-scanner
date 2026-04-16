--- a/security-test.ts
+++ b/security-test.ts
@@ -7,7 +7,7 @@
 import { SomeModule } from './some-module';
 
 // Token should be loaded from environment or secrets manager
-const token = "dsflslkhdsgsdgsdsgs43546546132134fsdjfhns";
+const token = process.env.SECRET_TOKEN || process.env.NODE_ENV === 'test' ? 'test-token-placeholder' : undefined;
 
 export function authenticate() {
   if (!token) {