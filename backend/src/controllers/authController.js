const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

async function register(req, res, next) {
  try {
    const { email, password, first_name, last_name, role, license_number, specialization } = req.body;

    const existing = await User.findByEmail(email);
    if (existing) throw new AppError('Email already registered', 409);

    const user = await User.create({ email, password, first_name, last_name, role, license_number, specialization });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user || !user.is_active) throw new AppError('Invalid credentials', 401);

    const valid = await User.validatePassword(password, user.password_hash);
    if (!valid) throw new AppError('Invalid credentials', 401);

    await User.updateLastLogin(user.id);
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

    delete user.password_hash;
    res.json({ user, token });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) throw new AppError('User not found', 404);
    delete user.password_hash;
    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me };
