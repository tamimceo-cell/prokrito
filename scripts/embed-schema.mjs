// db/schema.sql → src/lib/schema.generated.ts
// বিল্ডের আগে নিজে চলে (npm "prebuild")। কেন: প্রথম অ্যাডমিন বানানোর সময়
// অ্যাপ নিজেই টেবিলগুলো বানিয়ে নেয় — phpMyAdmin-এ আলাদা করে ফাইল চালাতে হয় না।
import { readFileSync, writeFileSync } from 'fs';
const sql = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
writeFileSync(
  new URL('../src/lib/schema.generated.ts', import.meta.url),
  `// স্বয়ংক্রিয় — হাতে বদলাবেন না। উৎস: db/schema.sql\nexport const SCHEMA_SQL = ${JSON.stringify(sql)};\n`,
);
