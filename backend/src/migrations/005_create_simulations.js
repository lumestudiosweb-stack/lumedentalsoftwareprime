exports.up = function (knex) {
  return knex.schema.createTable('simulations', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.uuid('parent_scan_id').notNullable().references('id').inTable('scans').onDelete('CASCADE');
    table.text('clinician_prompt').notNullable().comment('e.g. "Simulate RCT + Crown on #36"');
    table.jsonb('parsed_intent').comment('LLM-parsed clinical intent parameters');
    table.enum('simulation_type', [
      'disease_progression',
      'treatment_outcome',
      'comparison',
    ]).notNullable();
    table.enum('module', [
      'caries_endo',
      'surgery_3rd_molar',
      'perio',
      'esthetics_whitening',
      'esthetics_veneers',
      'ortho_aligners',
      'implant',
      'general',
    ]).notNullable();
    table.specificType('target_teeth', 'integer[]').comment('FDI tooth numbers targeted');
    table.jsonb('parameters').comment('Module-specific simulation parameters');
    table.enum('status', [
      'queued',
      'parsing',
      'simulating',
      'texturing',
      'completed',
      'failed',
    ]).defaultTo('queued');
    table.integer('progress_percent').defaultTo(0);
    table.text('error_message');
    table.uuid('created_by').comment('Clinician user ID');
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.integer('processing_time_ms');
    table.timestamps(true, true);

    table.index('patient_id');
    table.index('parent_scan_id');
    table.index('simulation_type');
    table.index('status');
    table.index('module');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('simulations');
};
