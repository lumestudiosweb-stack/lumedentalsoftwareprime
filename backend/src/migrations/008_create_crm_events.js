exports.up = function (knex) {
  return knex.schema
    .createTable('crm_events', (table) => {
      table.uuid('id').primary().defaultTo(knex.fn.uuid());
      table.uuid('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
      table.uuid('treatment_id').references('id').inTable('treatments').onDelete('SET NULL');
      table.enum('event_type', [
        'post_op_day1_check',
        'post_op_day3_audit',
        'hygiene_recall_6m',
        'aligner_tray_change',
        'aligner_fit_check',
        'appointment_reminder',
        'follow_up',
        'escalation',
        'custom',
      ]).notNullable();
      table.enum('channel', ['sms', 'voice', 'email', 'in_app', 'whatsapp']).defaultTo('sms');
      table.enum('status', [
        'scheduled',
        'sent',
        'delivered',
        'responded',
        'escalated',
        'completed',
        'failed',
      ]).defaultTo('scheduled');
      table.timestamp('scheduled_at').notNullable();
      table.timestamp('sent_at');
      table.timestamp('responded_at');
      table.text('message_template');
      table.text('message_sent');
      table.text('patient_response');
      table.jsonb('response_analysis').comment('AI-parsed sentiment and keywords from response');
      table.boolean('requires_escalation').defaultTo(false);
      table.text('escalation_reason');
      table.uuid('escalated_to').comment('Staff member ID who received escalation');
      table.integer('retry_count').defaultTo(0);
      table.timestamps(true, true);

      table.index('patient_id');
      table.index('event_type');
      table.index('status');
      table.index('scheduled_at');
    })
    .createTable('aligner_tracking', (table) => {
      table.uuid('id').primary().defaultTo(knex.fn.uuid());
      table.uuid('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
      table.uuid('treatment_id').references('id').inTable('treatments').onDelete('SET NULL');
      table.integer('current_tray_number').notNullable();
      table.integer('total_trays').notNullable();
      table.timestamp('tray_start_date').notNullable();
      table.timestamp('next_change_date');
      table.integer('wear_hours_per_day').defaultTo(22);
      table.string('fit_photo_url', 512);
      table.decimal('gap_measurement_mm', 4, 2).comment('CV-measured gap from photo');
      table.enum('fit_status', ['good', 'acceptable', 'poor', 'needs_rescan']).defaultTo('good');
      table.text('ai_recommendation').comment('e.g. "Advance to tray 5" or "Extend wear 3 days"');
      table.boolean('clinician_override').defaultTo(false);
      table.text('clinician_notes');
      table.timestamps(true, true);

      table.index('patient_id');
      table.index('treatment_id');
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('aligner_tracking')
    .dropTableIfExists('crm_events');
};
