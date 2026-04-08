const db = require('../config/database');
const bcrypt = require('bcryptjs');

const TABLE = 'users';

const User = {
  async findByEmail(email) {
    return db(TABLE).where({ email }).first();
  },

  async findById(id) {
    return db(TABLE).where({ id }).first();
  },

  async create(data) {
    const salt = await bcrypt.genSalt(12);
    data.password_hash = await bcrypt.hash(data.password, salt);
    delete data.password;
    const [user] = await db(TABLE).insert(data).returning('*');
    delete user.password_hash;
    return user;
  },

  async validatePassword(plaintext, hash) {
    return bcrypt.compare(plaintext, hash);
  },

  async updateLastLogin(id) {
    return db(TABLE).where({ id }).update({ last_login: db.fn.now() });
  },
};

module.exports = User;
