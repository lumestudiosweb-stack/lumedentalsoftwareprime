exports.up = function (knex) {
  return knex.schema.createTable('clinical_records', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.integer('tooth_number').notNullable().comment('FDI/ISO notation: 11-48');
    table.string('quadrant', 2).comment('UL, UR, LL, LR');
    table.enum('diagnosis', [
      'healthy',
      'caries_enamel',
      'caries_dentin',
      'caries_pulp',
      'pulpitis_reversible',
      'pulpitis_irreversible',
      'periapical_abscess',
      'periodontal_disease',
      'gingivitis',
      'impaction_mesioangular',
      'impaction_distoangular',
      'impaction_vertical',
      'impaction_horizontal',
      'fracture',
      'erosion',
      'attrition',
      'missing',
      'other',
    ]).notNullable();
    table.text('diagnosis_notes');
    table.decimal('plaque_index', 3, 1).comment('0.0 - 3.0 scale');
    table.decimal('bone_level_mm', 5, 2).comment('mm from CEJ to bone crest');
    table.decimal('pocket_depth_mm', 4, 1).comment('Periodontal pocket depth');
    table.decimal('mobility_grade', 2, 1).comment('0-3 Miller classification');
    table.decimal('recession_mm', 4, 1);
    table.boolean('bleeding_on_probing').defaultTo(false);
    table.enum('vitality', ['vital', 'non_vital', 'unknown']).defaultTo('unknown');
    table.string('radiograph_url', 512);
    table.uuid('treating_clinician_id');
    table.timestamps(true, true);

    table.index('patient_id');
    table.index('tooth_number');
    table.index('diagnosis');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('clinical_records');
};
