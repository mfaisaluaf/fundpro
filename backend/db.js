/**
 * Database Connection
 * Connects to the SQLite database
 */

const Database = require('better-sqlite3')
const path = require('path')

// Connect to database
const dbPath = path.join(__dirname, '..', 'database', 'money-manager.db')
const db = new Database(dbPath)

// Enable foreign keys
db.pragma('foreign_keys = ON')

module.exports = db
