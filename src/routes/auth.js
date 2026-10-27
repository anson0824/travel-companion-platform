const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../db/database');
const { guestOnly, requireAuth } = require('../middleware/auth');
const { validateEmail, validateUsername } = require('../utils');

const router = express.Router();

router.get('/login', guestOnly, (req, res) => {
  res.render('auth/login', { title: 'Login', form: {} });
});

router.post('/login', guestOnly, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    req.session.flash = { type: 'error', message: 'Email and password are required.' };
    return res.redirect('/login');
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    req.session.flash = { type: 'error', message: 'Invalid email or password.' };
    return res.redirect('/login');
  }
  if (user.disabled) {
    req.session.flash = { type: 'error', message: 'This account has been disabled.' };
    return res.redirect('/login');
  }

  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.username = user.username;
  req.session.role = user.role;
  req.session.flash = { type: 'success', message: `Welcome back, ${user.username}!` };
  res.redirect('/dashboard');
});

router.get('/register', guestOnly, (req, res) => {
  res.render('auth/register', { title: 'Create account', form: {} });
});

router.post('/register', guestOnly, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const confirm = String(req.body.confirm || '');

  const form = { email, username };

  if (!validateEmail(email)) {
    req.session.flash = { type: 'error', message: 'Enter a valid email address.' };
    return res.render('auth/register', { title: 'Create account', form });
  }
  if (!validateUsername(username)) {
    req.session.flash = { type: 'error', message: 'Username must be 3–24 characters (letters, numbers, underscore).' };
    return res.render('auth/register', { title: 'Create account', form });
  }
  if (password.length < 6) {
    req.session.flash = { type: 'error', message: 'Password must be at least 6 characters.' };
    return res.render('auth/register', { title: 'Create account', form });
  }
  if (password !== confirm) {
    req.session.flash = { type: 'error', message: 'Passwords do not match.' };
    return res.render('auth/register', { title: 'Create account', form });
  }

  const exists = db
    .prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE OR username = ? COLLATE NOCASE')
    .get(email, username);
  if (exists) {
    req.session.flash = { type: 'error', message: 'Email or username already taken.' };
    return res.render('auth/register', { title: 'Create account', form });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (email, username, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(email, username, hash, 'user');

  db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(result.lastInsertRowid);

  req.session.userId = result.lastInsertRowid;
  req.session.email = email;
  req.session.username = username;
  req.session.role = 'user';
  req.session.flash = { type: 'success', message: 'Account created. Welcome aboard!' };
  res.redirect('/dashboard');
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
