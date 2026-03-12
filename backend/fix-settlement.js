const db = require('./db')
db.prepare("UPDATE categories SET allowed_types = 'settlement' WHERE type = 'settlement'").run()
console.log('Fixed settlement categories')
