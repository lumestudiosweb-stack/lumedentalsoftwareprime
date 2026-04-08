exports.up = function (knex) {
  return knex.schema.createTable('treatments', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.uuid('clinical_record_id').references('id').inTable('clinical_records').onDelete('SET NULL');
    table.uuid('simulation_id').references('id').inTable('simulations').onDelete('SET NULL');
    table.integer('tooth_number');
    table.enum('treatment_type', [
      'filling_composite',
      'filling_amalgam',
      'root_canal',
      'crown',
      'bridge',
      'extraction',
      'implant',
      'veneer',
      'whitening',
      'scaling_root_planing',
      'aligner_therapy',
      'surgery_3rd_molar',
      'bone_graft',
      'other',
    ]).notNullable();
    table.text('description');
    table.enum('status', [
      'proposed',
      'accepted',
      'scheduled',
      'in_progress',
      'completed',
      'cancelled',
    ]).defaultTo('proposed');
    table.timestamp('scheduled_date');
    table.timestamp('completed_date');
    table.uuid('treating_clinician_id');
    table.decimal('cost', 10, 2);
    table.string('currency', 3).defaultTo('USD');
    table.text('notes');
    table.timestamps(true, true);

    table.index('patient_id');
    table.index('status');
    table.index('treatment_type');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('treatments');
};
