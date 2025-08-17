// Required modules
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

// Global variable to hold the server instance
let serverInstance = null;

/**
 * Starts the Express server and sets up the database and API endpoints.
 * @param {string} dbPath - The absolute path to the SQLite database file.
 * @returns {Promise<http.Server>} - A promise that resolves with the server instance.
 */
function startServer(dbPath) {
  return new Promise((resolve, reject) => {
    // Initialize Express app
    const app = express();
    const PORT = 3000;

    // Apply middleware
    app.use(cors()); // Enable Cross-Origin Resource Sharing
    app.use(express.json()); // Parse JSON request bodies

    // --- Database Setup ---
    // The 'better-sqlite3' constructor will create the file if it doesn't exist.
    const db = new Database(dbPath, { verbose: console.log });

    // Create the 'todos' table if it doesn't already exist.
    // This is idempotent and safe to run on every startup.
    db.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0, 1))
      )
    `);

    // --- API Endpoints (CRUD for Todos) ---

    // GET /todos: Retrieve all todos
    app.get('/todos', (req, res) => {
      try {
        const stmt = db.prepare('SELECT * FROM todos ORDER BY id DESC');
        const todos = stmt.all();
        res.json(todos);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // POST /todos: Create a new todo
    app.post('/todos', (req, res) => {
      const { title } = req.body;

      // Validation: Title must not be empty
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Title cannot be empty.' });
      }

      try {
        const stmt = db.prepare('INSERT INTO todos (title) VALUES (?)');
        const info = stmt.run(title.trim());

        // Fetch the newly created todo to return it in the response
        const newTodo = db.prepare('SELECT * FROM todos WHERE id = ?').get(info.lastInsertRowid);
        res.status(201).json(newTodo);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // PUT /todos/:id: Update an existing todo (title and/or done status)
    app.put('/todos/:id', (req, res) => {
      const { id } = req.params;
      const { title, done } = req.body;

      // Check if the todo exists first
      const existingTodo = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
      if (!existingTodo) {
        return res.status(404).json({ error: 'Todo not found.' });
      }

      // Build the update query dynamically based on provided fields
      const updates = [];
      const params = [];

      if (title !== undefined) {
        if (typeof title !== 'string' || title.trim().length === 0) {
          return res.status(400).json({ error: 'Title cannot be empty.' });
        }
        updates.push('title = ?');
        params.push(title.trim());
      }
      if (done !== undefined) {
        if (typeof done !== 'boolean' && done !== 0 && done !== 1) {
            return res.status(400).json({ error: '`done` must be a boolean or 0/1.' });
        }
        updates.push('done = ?');
        params.push(done ? 1 : 0); // Ensure value is 0 or 1
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update were provided.' });
      }

      params.push(id); // Add id to the end for the WHERE clause

      try {
        const stmt = db.prepare(`UPDATE todos SET ${updates.join(', ')} WHERE id = ?`);
        stmt.run(...params);

        // Fetch and return the updated todo
        const updatedTodo = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
        res.json(updatedTodo);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // DELETE /todos/:id: Delete a todo
    app.delete('/todos/:id', (req, res) => {
      const { id } = req.params;
      try {
        const stmt = db.prepare('DELETE FROM todos WHERE id = ?');
        const info = stmt.run(id);

        // Check if a row was actually deleted
        if (info.changes === 0) {
          return res.status(404).json({ error: 'Todo not found.' });
        }

        res.status(204).send(); // 204 No Content for successful deletion
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- Server Lifecycle ---
    serverInstance = app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      resolve(serverInstance); // Resolve the promise with the server instance
    });

    serverInstance.on('error', (err) => {
      console.error('Server failed to start:', err);
      reject(err);
    });
  });
}

/**
 * Stops the currently running server.
 * @returns {Promise<void>}
 */
function stopServer() {
    return new Promise((resolve, reject) => {
        if (serverInstance) {
            serverInstance.close((err) => {
                if (err) {
                    return reject(err);
                }
                console.log('Server stopped.');
                serverInstance = null;
                resolve();
            });
        } else {
            resolve(); // No server was running
        }
    });
}


module.exports = { startServer, stopServer };
