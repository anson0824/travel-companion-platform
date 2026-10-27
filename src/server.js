const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const SQLiteStore = require('connect-sqlite3')(session);

const { init } = require('./db/database');
const { attachUser } = require('./middleware/auth');
const { escapeHtml } = require('./utils');

const homeRoutes = require('./routes/home');
const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');
const adminRoutes = require('./routes/admin');
const matchmakingRoutes = require('./routes/matchmaking');
const itinerariesRoutes = require('./routes/itineraries');

init();

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-travel-companion-secret-change-me';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, '../public')));

app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: path.join(__dirname, '../data')
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.FORCE_SECURE_COOKIE === '1'
    }
  })
);

app.use(attachUser);
app.locals.escapeHtml = escapeHtml;
app.locals.formatDate = (d) => (d ? String(d).slice(0, 10) : '—');
app.locals.splitTags = (t) =>
  String(t || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

app.use(homeRoutes);
app.use(authRoutes);
app.use('/posts', postsRoutes);
app.use('/admin', adminRoutes);
app.use('/matchmaking', matchmakingRoutes);
app.use('/itineraries', itinerariesRoutes);

app.use((req, res) => {
  res.status(404).render('error', { title: 'Not found', status: 404, message: 'Page not found.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Error',
    status: 500,
    message: 'Something went wrong.'
  });
});

app.listen(PORT, () => {
  console.log(`Travel Companion Platform listening on http://localhost:${PORT}`);
});
