const express = require('express');
const { db } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  const recentPosts = db
    .prepare(
      `SELECT p.id, p.title, p.destination, p.created_at, u.username
       FROM posts p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC LIMIT 5`
    )
    .all();
  res.render('home', { title: 'Travel Companion Platform', recentPosts });
});

router.get('/dashboard', requireAuth, (req, res) => {
  const myPosts = db
    .prepare(
      `SELECT id, title, destination, created_at FROM posts
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`
    )
    .all(req.session.userId);
  const myTrips = db
    .prepare(
      `SELECT t.id, t.name, t.destination
       FROM trips t JOIN trip_members m ON m.trip_id = t.id
       WHERE m.user_id = ? ORDER BY t.created_at DESC LIMIT 5`
    )
    .all(req.session.userId);
  const pendingRequests = db
    .prepare(
      `SELECT COUNT(*) AS c FROM companion_requests
       WHERE to_user_id = ? AND status = 'pending'`
    )
    .get(req.session.userId).c;

  res.render('dashboard', {
    title: 'Dashboard',
    myPosts,
    myTrips,
    pendingRequests
  });
});

module.exports = router;
