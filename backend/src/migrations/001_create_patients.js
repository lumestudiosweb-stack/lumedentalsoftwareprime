exports.up = function (knex) {
  return knex.schema.createTable('patients', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    table.date('date_of_birth').notNullable();
    table.string('gender', 20);
    table.string('email', 255).unique();
    table.string('phone', 30);
    table.text('address');
    table.string('facial_photo_url', 512);
    table.string('insurance_provider', 255);
    table.string('insurance_id', 100);
    table.text('medical_history_notes');
    table.text('allergies');
    table.timestamps(true, true);
    table.timestamp('deleted_at');

    table.index(['last_name', 'first_name']);
    table.index('email');
    table.index('phone');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('patients');
};
