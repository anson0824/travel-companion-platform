const express = require('express');
const { db } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { asyncRoute } = require('../utils');

const router = express.Router();

router.use(requireAdmin);

router.get('/', asyncRoute(async (req, res) => {
  const users = await db
    .prepare(
      `SELECT id, email, username, role, disabled, created_at
       FROM users ORDER BY created_at DESC`
    )
    .all();
  const posts = await db
    .prepare(
      `SELECT p.id, p.title, p.destination, p.created_at, u.username
       FROM posts p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`
    )
    .all();
  res.render('admin/index', {
    title: 'Admin',
    users,
    posts,
    stats: {
      users: users.length,
      posts: posts.length,
      disabled: users.filter((u) => Number(u.disabled)).length
    }
  });
}));

router.post('/users/:id/role', asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const role = req.body.role === 'admin' ? 'admin' : 'user';
  if (id === req.session.userId && role !== 'admin') {
    req.session.flash = { type: 'error', message: 'You cannot demote yourself.' };
    return res.redirect('/admin');
  }
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    req.session.flash = { type: 'error', message: 'User not found.' };
    return res.redirect('/admin');
  }
  await db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  req.session.flash = { type: 'success', message: `User role set to ${role}.` };
  res.redirect('/admin');
}));

router.post('/users/:id/toggle-disabled', asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.session.userId) {
    req.session.flash = { type: 'error', message: 'You cannot disable your own account.' };
    return res.redirect('/admin');
  }
  const user = await db.prepare('SELECT id, disabled FROM users WHERE id = ?').get(id);
  if (!user) {
    req.session.flash = { type: 'error', message: 'User not found.' };
    return res.redirect('/admin');
  }
  const next = Number(user.disabled) ? 0 : 1;
  await db.prepare('UPDATE users SET disabled = ? WHERE id = ?').run(next, id);
  req.session.flash = {
    type: 'success',
    message: next ? 'Account disabled.' : 'Account re-enabled.'
  };
  res.redirect('/admin');
}));

router.post('/posts/:id/delete', asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const post = await db.prepare('SELECT id FROM posts WHERE id = ?').get(id);
  if (!post) {
    req.session.flash = { type: 'error', message: 'Post not found.' };
    return res.redirect('/admin');
  }
  await db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  req.session.flash = { type: 'success', message: 'Post deleted by admin.' };
  res.redirect('/admin');
}));

module.exports = router;
