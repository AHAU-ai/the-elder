import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
console.log(rows);
