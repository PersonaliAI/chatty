'use strict';

const { readFileSync, writeFileSync } = require('node:fs');
const file = process.argv[2];
if (!file) throw new Error('Auth file required');
const source = readFileSync(file, 'utf8');
const original = /const jwtDecode = jsonwebtoken_1\.decode \|\| \(jsonwebtoken_1\.default && jsonwebtoken_1\.default\.decode\);\s*const decoded = jwtDecode \? jwtDecode\(sbToken\) : null;/;
const replacement = 'const decoded = await require("./verify-supabase-token.cjs").verifySupabaseToken(sbToken);';
if (source.includes(replacement)) process.exit(0);
if (!original.test(source)) throw new Error('Supported auth source required');
writeFileSync(file, source.replace(original, replacement));
