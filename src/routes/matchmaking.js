const express = require('express');
const { db } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { parseTags, tagsToString, overlapDates, destinationsOverlap } = require('../utils');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  let profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.session.userId);
  if (!profile) {
    db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(req.session.userId);
    profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.session.userId);
  }

  const others = db
    .prepare(
      `SELECT u.id, u.username, p.destinations, p.travel_start, p.travel_end, p.travel_styles, p.bio
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id != ? AND u.disabled = 0`
    )
    .all(req.session.userId);

  const matches = others
    .map((o) => {
      const destHit = destinationsOverlap(profile.destinations, o.destinations);
      const dateHit = overlapDates(
        profile.travel_start,
        profile.travel_end,
        o.travel_start,
        o.travel_end
      );
      return { ...o, destHit, dateHit, score: (destHit ? 2 : 0) + (dateHit ? 1 : 0) };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);

  const requests = db
    .prepare(
      `SELECT r.*,
              fu.username AS from_username,
              tu.username AS to_username
       FROM companion_requests r
       JOIN users fu ON fu.id = r.from_user_id
       JOIN users tu ON tu.id = r.to_user_id
       WHERE r.from_user_id = ? OR r.to_user_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(req.session.userId, req.session.userId);

  res.render('matchmaking/index', {
    title: 'Find companions',
    profile,
    matches,
    requests
  });
});

router.post('/profile', requireAuth, (req, res) => {
  const destinations = String(req.body.destinations || '').trim();
  const travel_start = String(req.body.travel_start || '').trim() || null;
  const travel_end = String(req.body.travel_end || '').trim() || null;
  const travel_styles = tagsToString(parseTags(req.body.travel_styles));
  const bio = String(req.body.bio || '').trim().slice(0, 500);

  db.prepare(
    `INSERT INTO profiles (user_id, destinations, travel_start, travel_end, travel_styles, bio, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       destinations=excluded.destinations,
       travel_start=excluded.travel_start,
       travel_end=excluded.travel_end,
       travel_styles=excluded.travel_styles,
       bio=excluded.bio,
       updated_at=datetime('now')`
  ).run(req.session.userId, destinations, travel_start, travel_end, travel_styles, bio);

  req.session.flash = { type: 'success', message: 'Travel preferences saved.' };
  res.redirect('/matchmaking');
});

router.post('/request', requireAuth, (req, res) => {
  const toUserId = Number(req.body.to_user_id);
  const message = String(req.body.message || '').trim().slice(0, 300);
  if (!toUserId || toUserId === req.session.userId) {
    req.session.flash = { type: 'error', message: 'Invalid companion request.' };
    return res.redirect('/matchmaking');
  }
  const target = db.prepare('SELECT id FROM users WHERE id = ? AND disabled = 0').get(toUserId);
  if (!target) {
    req.session.flash = { type: 'error', message: 'User not found.' };
    return res.redirect('/matchmaking');
  }
  try {
    db.prepare(
      `INSERT INTO companion_requests (from_user_id, to_user_id, message)
       VALUES (?, ?, ?)`
    ).run(req.session.userId, toUserId, message);
    req.session.flash = { type: 'success', message: 'Companion request sent.' };
  } catch (e) {
    req.session.flash = { type: 'error', message: 'You already sent a request to this traveler.' };
  }
  res.redirect('/matchmaking');
});

router.post('/request/:id/respond', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const status = req.body.status === 'accepted' ? 'accepted' : 'declined';
  const row = db.prepare('SELECT * FROM companion_requests WHERE id = ?').get(id);
  if (!row || row.to_user_id !== req.session.userId) {
    req.session.flash = { type: 'error', message: 'Request not found.' };
    return res.redirect('/matchmaking');
  }
  db.prepare(`UPDATE companion_requests SET status = ? WHERE id = ?`).run(status, id);
  req.session.flash = { type: 'success', message: `Request ${status}.` };
  res.redirect('/matchmaking');
});

module.exports = router;
