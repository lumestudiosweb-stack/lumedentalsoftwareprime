exports.up = function (knex) {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    table.enum('role', [
      'admin',
      'dentist',
      'hygienist',
      'assistant',
      'receptionist',
    ]).notNullable();
    table.string('license_number', 50);
    table.string('specialization', 100);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_login');
    table.timestamps(true, true);

    table.index('email');
    table.index('role');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('users');
};
