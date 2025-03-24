import Database from "better-sqlite3";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

// Create db directory if it doesn't exist
const dbDir = path.join(process.cwd(), "src", "db");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database connections with absolute paths
export const db = new Database(path.join(dbDir, `${process.env.BOT_NAME}.db`));

// Enable WAL (Write-Ahead Logging) mode for better performance
db.pragma("journal_mode = WAL");

// Create 'users' table if it doesn't exist
db.prepare(
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 0
  )
  `
).run();

db.prepare(
  `CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    count INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`
).run();
