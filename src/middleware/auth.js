function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.flash = { type: 'error', message: 'Please log in to continue.' };
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    req.session.flash = { type: 'error', message: 'Please log in to continue.' };
    return res.redirect('/login');
  }
  if (req.session.role !== 'admin') {
    req.session.flash = { type: 'error', message: 'Admin access required.' };
    return res.redirect('/dashboard');
  }
  next();
}

function guestOnly(req, res, next) {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
}

function attachUser(req, res, next) {
  res.locals.currentUser = req.session.userId
    ? {
        id: req.session.userId,
        email: req.session.email,
        username: req.session.username,
        role: req.session.role
      }
    : null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
}

module.exports = { requireAuth, requireAdmin, guestOnly, attachUser };
