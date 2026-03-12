/**
 * Database Initialization Script
 * Run this once to create all tables
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Create database file
const dbPath = path.join(__dirname, 'money-manager.db');
const db = new Database(dbPath);

console.log('Creating database...');

// Read and execute schema
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

// Execute schema (split by semicolons and run each statement)
db.exec(schema);

console.log('✓ All tables created successfully!\n');

// Insert default data
console.log('Adding default data...');

// Default workspace
db.exec(`
    INSERT INTO workspaces (name, description) VALUES
    ('Office', 'Office expenses and petty cash'),
    ('Personal', 'Personal and home expenses');
`);
console.log('✓ Workspaces added');

// Default categories (from your Excel)
db.exec(`
    INSERT INTO categories (name, type) VALUES
    ('Salary', 'income'),
    ('Business Income', 'income'),
    ('Other Income', 'income'),
    ('Utility Bills', 'expense'),
    ('Friday Lunch', 'expense'),
    ('Other Food Expense', 'expense'),
    ('Late Hours Food', 'expense'),
    ('Kitchen / Grocery', 'expense'),
    ('Office Equipment', 'expense'),
    ('Stationery Items', 'expense'),
    ('Janitorial Items', 'expense'),
    ('Repair & Maintenance', 'expense'),
    ('Travelling Expense', 'expense'),
    ('Fuel Expense', 'expense'),
    ('Birthday Celebration', 'expense'),
    ('Miscellaneous Expense', 'expense'),
    ('Usman Personal Expense', 'expense'),
    ('Reimbursement', 'both');
`);
console.log('✓ Categories added');

// Default bank accounts
db.exec(`
    INSERT INTO bank_accounts (name, bank_name, account_type, opening_balance, current_balance) VALUES
    ('Cash in Hand', 'Cash', 'cash', 0, 0),
    ('Main Bank Account', 'Bank', 'current', 0, 0);
`);
console.log('✓ Bank accounts added');

// Default funds (from your Excel)
db.exec(`
    INSERT INTO funds (workspace_id, name, description, opening_balance, current_balance) VALUES
    (1, 'Petty Cash', 'Office petty cash fund', 92100, 3410),
    (1, 'Treat Fund', 'Colleagues treat collection', 0, 4430),
    (1, 'CEO Account', 'Usman personal drawings', 0, 0);
`);
console.log('✓ Funds added');

// Default tags
db.exec(`
    INSERT INTO tags (name, color) VALUES
    ('Reimbursable', '#4CAF50'),
    ('Urgent', '#F44336'),
    ('Tax Deductible', '#2196F3'),
    ('Recurring', '#9C27B0');
`);
console.log('✓ Tags added');

// Default settings
db.exec(`
    INSERT INTO settings (key, value) VALUES
    ('currency', 'Rs'),
    ('date_format', 'DD/MM/YYYY'),
    ('fiscal_year_start', '07'),
    ('default_workspace', '1');
`);
console.log('✓ Settings added');

db.close();

console.log('\n========================================');
console.log('Database created successfully!');
console.log('Location:', dbPath);
console.log('========================================\n');
