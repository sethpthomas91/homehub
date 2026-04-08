import os
import sqlite3
from datetime import datetime, date, timedelta
from flask import Flask, g, jsonify, request

app = Flask(__name__)

DB_PATH = os.environ.get("DB_PATH", "/data/homehub.db")


# ── DB connection ──────────────────────────────────────────────────────────────

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
        _init_schema(g.db)
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def _init_schema(db):
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            active     BOOLEAN NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS chores (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            name           TEXT NOT NULL,
            frequency_days INTEGER NOT NULL,
            created_at     DATETIME NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS completions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            chore_id     INTEGER NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
            user_id      INTEGER NOT NULL REFERENCES users(id),
            completed_at DATETIME NOT NULL DEFAULT (datetime('now'))
        );
    """)
    db.commit()


# ── CORS ───────────────────────────────────────────────────────────────────────

@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response



# ── Helpers ────────────────────────────────────────────────────────────────────

def _chore_status(chore, last_completion):
    created_at = datetime.fromisoformat(chore["created_at"])
    if last_completion:
        baseline = datetime.fromisoformat(last_completion["completed_at"])
    else:
        baseline = created_at

    due_date = (baseline + timedelta(days=chore["frequency_days"])).date()
    days_remaining = (due_date - date.today()).days

    if days_remaining > 0:
        status = "normal"
    elif days_remaining == 0:
        status = "warning"
    else:
        status = "danger"

    return due_date.isoformat(), days_remaining, status


def _serialize_chore(chore, last_completion):
    due_date, days_remaining, status = _chore_status(chore, last_completion)
    return {
        "id": chore["id"],
        "name": chore["name"],
        "frequency_days": chore["frequency_days"],
        "created_at": chore["created_at"],
        "due_date": due_date,
        "days_remaining": days_remaining,
        "status": status,
        "last_completed_at": last_completion["completed_at"] if last_completion else None,
        "last_completed_by": last_completion["user_name"] if last_completion else None,
    }


def _get_last_completion(db, chore_id):
    return db.execute("""
        SELECT c.completed_at, u.name AS user_name
        FROM completions c
        JOIN users u ON u.id = c.user_id
        WHERE c.chore_id = ?
        ORDER BY c.completed_at DESC
        LIMIT 1
    """, (chore_id,)).fetchone()


# ── Chore endpoints ────────────────────────────────────────────────────────────

@app.get("/api/chores")
def list_chores():
    db = get_db()
    rows = db.execute("""
        SELECT c.*,
               last_comp.completed_at AS last_completed_at,
               last_comp.user_name    AS last_user_name
        FROM chores c
        LEFT JOIN (
            SELECT comp.chore_id,
                   comp.completed_at,
                   u.name AS user_name,
                   ROW_NUMBER() OVER (
                       PARTITION BY comp.chore_id
                       ORDER BY comp.completed_at DESC
                   ) AS rn
            FROM completions comp
            JOIN users u ON u.id = comp.user_id
        ) last_comp ON last_comp.chore_id = c.id AND last_comp.rn = 1
        ORDER BY c.id
    """).fetchall()
    result = []
    for row in rows:
        last = {"completed_at": row["last_completed_at"], "user_name": row["last_user_name"]} \
               if row["last_completed_at"] else None
        result.append(_serialize_chore(row, last))
    order = {"danger": 0, "warning": 1, "normal": 2}
    result.sort(key=lambda c: (order[c["status"]], c["days_remaining"]))
    return jsonify(result)


@app.post("/api/chores")
def create_chore():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    freq = data.get("frequency_days")
    if not name or freq is None:
        return jsonify({"error": "name and frequency_days are required"}), 400
    try:
        freq = int(freq)
        if freq < 1:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "frequency_days must be a positive integer"}), 400

    db = get_db()
    cur = db.execute(
        "INSERT INTO chores (name, frequency_days) VALUES (?, ?)", (name, freq)
    )
    db.commit()
    chore = db.execute("SELECT * FROM chores WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(_serialize_chore(chore, None)), 201


@app.put("/api/chores/<int:chore_id>")
def update_chore(chore_id):
    db = get_db()
    chore = db.execute("SELECT * FROM chores WHERE id = ?", (chore_id,)).fetchone()
    if not chore:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or chore["name"]).strip()
    freq = data.get("frequency_days", chore["frequency_days"])
    try:
        freq = int(freq)
        if freq < 1:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "frequency_days must be a positive integer"}), 400

    db.execute(
        "UPDATE chores SET name = ?, frequency_days = ? WHERE id = ?",
        (name, freq, chore_id),
    )
    db.commit()
    chore = db.execute("SELECT * FROM chores WHERE id = ?", (chore_id,)).fetchone()
    last = _get_last_completion(db, chore_id)
    return jsonify(_serialize_chore(chore, last))


@app.delete("/api/chores/<int:chore_id>")
def delete_chore(chore_id):
    db = get_db()
    chore = db.execute("SELECT id FROM chores WHERE id = ?", (chore_id,)).fetchone()
    if not chore:
        return jsonify({"error": "not found"}), 404
    db.execute("DELETE FROM chores WHERE id = ?", (chore_id,))
    db.commit()
    return "", 204


@app.post("/api/chores/<int:chore_id>/complete")
def complete_chore(chore_id):
    db = get_db()
    chore = db.execute("SELECT * FROM chores WHERE id = ?", (chore_id,)).fetchone()
    if not chore:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    user = db.execute("SELECT id FROM users WHERE id = ? AND active = 1", (user_id,)).fetchone()
    if not user:
        return jsonify({"error": "user not found or inactive"}), 400

    db.execute(
        "INSERT INTO completions (chore_id, user_id) VALUES (?, ?)", (chore_id, user_id)
    )
    db.commit()
    chore = db.execute("SELECT * FROM chores WHERE id = ?", (chore_id,)).fetchone()
    last = _get_last_completion(db, chore_id)
    return jsonify(_serialize_chore(chore, last)), 201


@app.get("/api/chores/<int:chore_id>/history")
def chore_history(chore_id):
    db = get_db()
    chore = db.execute("SELECT id FROM chores WHERE id = ?", (chore_id,)).fetchone()
    if not chore:
        return jsonify({"error": "not found"}), 404

    rows = db.execute("""
        SELECT c.completed_at, u.name AS user_name
        FROM completions c
        JOIN users u ON u.id = c.user_id
        WHERE c.chore_id = ?
        ORDER BY c.completed_at DESC
    """, (chore_id,)).fetchall()

    return jsonify([{"completed_at": r["completed_at"], "user_name": r["user_name"]} for r in rows])


# ── User endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/users")
def list_users():
    db = get_db()
    rows = db.execute("SELECT * FROM users WHERE active = 1 ORDER BY name").fetchall()
    return jsonify([{"id": r["id"], "name": r["name"], "active": bool(r["active"])} for r in rows])


@app.post("/api/users")
def create_user():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    db = get_db()
    cur = db.execute("INSERT INTO users (name) VALUES (?)", (name,))
    db.commit()
    row = db.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify({"id": row["id"], "name": row["name"], "active": bool(row["active"])}), 201


@app.put("/api/users/<int:user_id>")
def update_user(user_id):
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or user["name"]).strip()
    active = data.get("active", bool(user["active"]))

    db.execute(
        "UPDATE users SET name = ?, active = ? WHERE id = ?",
        (name, 1 if active else 0, user_id),
    )
    db.commit()
    row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return jsonify({"id": row["id"], "name": row["name"], "active": bool(row["active"])})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
