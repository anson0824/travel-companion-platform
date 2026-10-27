const express = require('express');
const { db } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { parseTags, tagsToString } = require('../utils');

const router = express.Router();

router.get('/', (req, res) => {
  const posts = db
    .prepare(
      `SELECT p.*, u.username
       FROM posts p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`
    )
    .all();
  res.render('posts/index', { title: 'Travel experiences', posts });
});

router.get('/new', requireAuth, (req, res) => {
  res.render('posts/form', {
    title: 'Share an experience',
    post: null,
    form: {},
    action: '/posts',
    method: 'POST'
  });
});

router.post('/', requireAuth, (req, res) => {
  const title = String(req.body.title || '').trim();
  const destination = String(req.body.destination || '').trim();
  const start_date = String(req.body.start_date || '').trim() || null;
  const end_date = String(req.body.end_date || '').trim() || null;
  const content = String(req.body.content || '').trim();
  const tags = tagsToString(parseTags(req.body.tags));

  const form = { title, destination, start_date, end_date, content, tags };

  if (!title || title.length < 3) {
    req.session.flash = { type: 'error', message: 'Title must be at least 3 characters.' };
    return res.render('posts/form', {
      title: 'Share an experience',
      post: null,
      form,
      action: '/posts',
      method: 'POST'
    });
  }
  if (!destination) {
    req.session.flash = { type: 'error', message: 'Destination is required.' };
    return res.render('posts/form', {
      title: 'Share an experience',
      post: null,
      form,
      action: '/posts',
      method: 'POST'
    });
  }
  if (!content || content.length < 10) {
    req.session.flash = { type: 'error', message: 'Content must be at least 10 characters.' };
    return res.render('posts/form', {
      title: 'Share an experience',
      post: null,
      form,
      action: '/posts',
      method: 'POST'
    });
  }

  const result = db
    .prepare(
      `INSERT INTO posts (user_id, title, destination, start_date, end_date, content, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.session.userId, title, destination, start_date, end_date, content, tags);

  req.session.flash = { type: 'success', message: 'Experience shared!' };
  res.redirect(`/posts/${result.lastInsertRowid}`);
});

router.get('/:id', (req, res) => {
  const post = db
    .prepare(
      `SELECT p.*, u.username
       FROM posts p JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`
    )
    .get(req.params.id);
  if (!post) {
    req.session.flash = { type: 'error', message: 'Post not found.' };
    return res.redirect('/posts');
  }
  res.render('posts/show', { title: post.title, post });
});

router.get('/:id/edit', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) {
    req.session.flash = { type: 'error', message: 'Post not found.' };
    return res.redirect('/posts');
  }
  if (post.user_id !== req.session.userId && req.session.role !== 'admin') {
    req.session.flash = { type: 'error', message: 'You can only edit your own posts.' };
    return res.redirect(`/posts/${post.id}`);
  }
  res.render('posts/form', {
    title: 'Edit experience',
    post,
    form: post,
    action: `/posts/${post.id}?_method=PUT`,
    method: 'POST'
  });
});

router.put('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) {
    req.session.flash = { type: 'error', message: 'Post not found.' };
    return res.redirect('/posts');
  }
  if (post.user_id !== req.session.userId && req.session.role !== 'admin') {
    req.session.flash = { type: 'error', message: 'You can only edit your own posts.' };
    return res.redirect(`/posts/${post.id}`);
  }

  const title = String(req.body.title || '').trim();
  const destination = String(req.body.destination || '').trim();
  const start_date = String(req.body.start_date || '').trim() || null;
  const end_date = String(req.body.end_date || '').trim() || null;
  const content = String(req.body.content || '').trim();
  const tags = tagsToString(parseTags(req.body.tags));
  const form = { ...post, title, destination, start_date, end_date, content, tags };

  if (!title || title.length < 3 || !destination || !content || content.length < 10) {
    req.session.flash = { type: 'error', message: 'Please fill title, destination, and content (min lengths).' };
    return res.render('posts/form', {
      title: 'Edit experience',
      post,
      form,
      action: `/posts/${post.id}?_method=PUT`,
      method: 'POST'
    });
  }

  db.prepare(
    `UPDATE posts SET title=?, destination=?, start_date=?, end_date=?, content=?, tags=?,
     updated_at=datetime('now') WHERE id=?`
  ).run(title, destination, start_date, end_date, content, tags, post.id);

  req.session.flash = { type: 'success', message: 'Experience updated.' };
  res.redirect(`/posts/${post.id}`);
});

router.delete('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) {
    req.session.flash = { type: 'error', message: 'Post not found.' };
    return res.redirect('/posts');
  }
  if (post.user_id !== req.session.userId && req.session.role !== 'admin') {
    req.session.flash = { type: 'error', message: 'You can only delete your own posts.' };
    return res.redirect(`/posts/${post.id}`);
  }
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  req.session.flash = { type: 'success', message: 'Post deleted.' };
  res.redirect('/posts');
});

module.exports = router;
