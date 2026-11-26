const express = require('express');
const { db } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { asyncRoute } = require('../utils');

const router = express.Router();
const MAX_BODY = 1000;

async function acceptedChat(requestId, userId) {
  const row = await db
    .prepare(
      `SELECT r.id, r.status, r.from_user_id, r.to_user_id,
              fu.username AS from_username, fu.disabled AS from_disabled,
              tu.username AS to_username, tu.disabled AS to_disabled
       FROM companion_requests r
       JOIN users fu ON fu.id = r.from_user_id
       JOIN users tu ON tu.id = r.to_user_id
       WHERE r.id = ?`
    )
    .get(requestId);
  if (!row || row.status !== 'accepted') return null;
  const uid = Number(userId);
  const fromId = Number(row.from_user_id);
  const toId = Number(row.to_user_id);
  if (uid !== fromId && uid !== toId) return null;
  if (Number(row.from_disabled) || Number(row.to_disabled)) return null;
  return {
    id: Number(row.id),
    companion: uid === fromId ? row.to_username : row.from_username,
    companionId: uid === fromId ? toId : fromId
  };
}

function shapeMessage(row, userId) {
  return {
    id: Number(row.id),
    body: row.body,
    fromUsername: row.from_username,
    mine: Number(row.from_user_id) === Number(userId),
    createdAt: row.created_at
  };
}

router.get('/', requireAuth, asyncRoute(async (req, res) => {
  const chats = await db
    .prepare(
      `SELECT r.id,
              CASE WHEN r.from_user_id = ? THEN tu.username ELSE fu.username END AS companion,
              (
                SELECT m.body FROM companion_messages m
                WHERE m.request_id = r.id
                ORDER BY m.id DESC
                LIMIT 1
              ) AS last_body
       FROM companion_requests r
       JOIN users fu ON fu.id = r.from_user_id
       JOIN users tu ON tu.id = r.to_user_id
       WHERE r.status = 'accepted'
         AND (r.from_user_id = ? OR r.to_user_id = ?)
         AND fu.disabled = 0
         AND tu.disabled = 0
       ORDER BY r.id DESC`
    )
    .all(req.session.userId, req.session.userId, req.session.userId);

  res.render('chats/index', { title: 'Companion chats', chats });
}));

router.get('/:id/messages', requireAuth, asyncRoute(async (req, res) => {
  const chat = await acceptedChat(req.params.id, req.session.userId);
  if (!chat) return res.status(404).json({ error: 'Chat not found.' });
  const after = Number(req.query.after) || 0;
  const rows = await db
    .prepare(
      `SELECT m.id, m.body, m.from_user_id, m.created_at, u.username AS from_username
       FROM companion_messages m
       JOIN users u ON u.id = m.from_user_id
       WHERE m.request_id = ? AND m.id > ?
       ORDER BY m.id ASC`
    )
    .all(chat.id, after);
  res.json({ messages: rows.map((row) => shapeMessage(row, req.session.userId)) });
}));

router.get('/:id', requireAuth, asyncRoute(async (req, res) => {
  const chat = await acceptedChat(req.params.id, req.session.userId);
  if (!chat) {
    req.session.flash = { type: 'error', message: 'That chat is available after the companion request is accepted.' };
    return res.redirect('/chats');
  }
  const rows = await db
    .prepare(
      `SELECT m.id, m.body, m.from_user_id, m.created_at, u.username AS from_username
       FROM companion_messages m
       JOIN users u ON u.id = m.from_user_id
       WHERE m.request_id = ?
       ORDER BY m.id ASC`
    )
    .all(chat.id);
  const messages = rows.map((row) => shapeMessage(row, req.session.userId));
  res.render('chats/show', {
    title: `Chat with @${chat.companion}`,
    chat,
    messages
  });
}));

router.post('/:id/messages', requireAuth, asyncRoute(async (req, res) => {
  const chat = await acceptedChat(req.params.id, req.session.userId);
  const wantsJson = String(req.get('accept') || '').includes('application/json');
  if (!chat) {
    if (wantsJson) return res.status(404).json({ error: 'Chat not found.' });
    req.session.flash = { type: 'error', message: 'That chat is available after the companion request is accepted.' };
    return res.redirect('/chats');
  }

  const body = String(req.body.body || '').trim().slice(0, MAX_BODY);
  if (!body) {
    if (wantsJson) return res.status(400).json({ error: 'Write a message first.' });
    req.session.flash = { type: 'error', message: 'Write a message first.' };
    return res.redirect(`/chats/${chat.id}`);
  }

  const inserted = await db
    .prepare(
      `INSERT INTO companion_messages (request_id, from_user_id, body)
       VALUES (?, ?, ?)`
    )
    .run(chat.id, req.session.userId, body);
  const saved = await db
    .prepare(
      `SELECT m.id, m.body, m.from_user_id, m.created_at, u.username AS from_username
       FROM companion_messages m
       JOIN users u ON u.id = m.from_user_id
       WHERE m.id = ?`
    )
    .get(inserted.lastInsertRowid);

  if (wantsJson) return res.status(201).json({ message: shapeMessage(saved, req.session.userId) });
  res.redirect(`/chats/${chat.id}`);
}));

module.exports = router;
