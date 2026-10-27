const express = require('express');
const { db } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function isMember(tripId, userId) {
  return db
    .prepare('SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?')
    .get(tripId, userId);
}

router.get('/', requireAuth, (req, res) => {
  const trips = db
    .prepare(
      `SELECT t.*, u.username AS owner_name
       FROM trips t
       JOIN trip_members m ON m.trip_id = t.id
       JOIN users u ON u.id = t.owner_id
       WHERE m.user_id = ?
       ORDER BY t.created_at DESC`
    )
    .all(req.session.userId);
  res.render('itineraries/index', { title: 'My trips', trips });
});

router.get('/new', requireAuth, (req, res) => {
  res.render('itineraries/form', { title: 'Create trip', form: {} });
});

router.post('/', requireAuth, (req, res) => {
  const name = String(req.body.name || '').trim();
  const destination = String(req.body.destination || '').trim();
  const start_date = String(req.body.start_date || '').trim() || null;
  const end_date = String(req.body.end_date || '').trim() || null;

  if (!name || !destination) {
    req.session.flash = { type: 'error', message: 'Trip name and destination are required.' };
    return res.render('itineraries/form', {
      title: 'Create trip',
      form: { name, destination, start_date, end_date }
    });
  }

  const result = db
    .prepare(
      `INSERT INTO trips (owner_id, name, destination, start_date, end_date)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(req.session.userId, name, destination, start_date, end_date);

  db.prepare(
    `INSERT INTO trip_members (trip_id, user_id, role) VALUES (?, ?, 'owner')`
  ).run(result.lastInsertRowid, req.session.userId);

  req.session.flash = { type: 'success', message: 'Trip created.' };
  res.redirect(`/itineraries/${result.lastInsertRowid}`);
});

router.get('/:id', requireAuth, (req, res) => {
  const trip = db
    .prepare(
      `SELECT t.*, u.username AS owner_name
       FROM trips t JOIN users u ON u.id = t.owner_id WHERE t.id = ?`
    )
    .get(req.params.id);
  if (!trip || !isMember(trip.id, req.session.userId)) {
    req.session.flash = { type: 'error', message: 'Trip not found or access denied.' };
    return res.redirect('/itineraries');
  }
  const members = db
    .prepare(
      `SELECT u.id, u.username, u.email, m.role
       FROM trip_members m JOIN users u ON u.id = m.user_id
       WHERE m.trip_id = ?`
    )
    .all(trip.id);
  const items = db
    .prepare(
      `SELECT i.*, u.username AS author
       FROM trip_items i JOIN users u ON u.id = i.created_by
       WHERE i.trip_id = ?
       ORDER BY i.day_number ASC, i.time ASC, i.id ASC`
    )
    .all(trip.id);
  res.render('itineraries/show', { title: trip.name, trip, members, items });
});

router.post('/:id/invite', requireAuth, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!trip || trip.owner_id !== req.session.userId) {
    req.session.flash = { type: 'error', message: 'Only the trip owner can invite.' };
    return res.redirect('/itineraries');
  }
  const ident = String(req.body.identifier || '').trim();
  const user = db
    .prepare(
      `SELECT id FROM users WHERE (email = ? COLLATE NOCASE OR username = ? COLLATE NOCASE) AND disabled = 0`
    )
    .get(ident, ident);
  if (!user) {
    req.session.flash = { type: 'error', message: 'No registered user with that email/username.' };
    return res.redirect(`/itineraries/${trip.id}`);
  }
  try {
    db.prepare(
      `INSERT INTO trip_members (trip_id, user_id, role) VALUES (?, ?, 'member')`
    ).run(trip.id, user.id);
    req.session.flash = { type: 'success', message: 'Traveler invited.' };
  } catch (e) {
    req.session.flash = { type: 'error', message: 'User is already on this trip.' };
  }
  res.redirect(`/itineraries/${trip.id}`);
});

router.post('/:id/items', requireAuth, (req, res) => {
  const tripId = Number(req.params.id);
  if (!isMember(tripId, req.session.userId)) {
    req.session.flash = { type: 'error', message: 'Access denied.' };
    return res.redirect('/itineraries');
  }
  const place = String(req.body.place || '').trim();
  const day_number = Math.max(1, parseInt(req.body.day_number, 10) || 1);
  const time = String(req.body.time || '').trim() || null;
  const notes = String(req.body.notes || '').trim().slice(0, 500);
  if (!place) {
    req.session.flash = { type: 'error', message: 'Place is required.' };
    return res.redirect(`/itineraries/${tripId}`);
  }
  db.prepare(
    `INSERT INTO trip_items (trip_id, day_number, place, time, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(tripId, day_number, place, time, notes, req.session.userId);
  req.session.flash = { type: 'success', message: 'Itinerary item added.' };
  res.redirect(`/itineraries/${tripId}`);
});

router.post('/:id/items/:itemId/delete', requireAuth, (req, res) => {
  const tripId = Number(req.params.id);
  if (!isMember(tripId, req.session.userId)) {
    req.session.flash = { type: 'error', message: 'Access denied.' };
    return res.redirect('/itineraries');
  }
  db.prepare('DELETE FROM trip_items WHERE id = ? AND trip_id = ?').run(
    req.params.itemId,
    tripId
  );
  req.session.flash = { type: 'success', message: 'Item removed.' };
  res.redirect(`/itineraries/${tripId}`);
});

module.exports = router;
