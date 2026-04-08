exports.up = function (knex) {
  return knex.schema.createTable('meshes', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('scan_id').notNullable().references('id').inTable('scans').onDelete('CASCADE');
    table.integer('tooth_label').comment('FDI notation 11-48, null for gingiva/bone');
    table.enum('structure_type', [
      'tooth',
      'gingiva',
      'bone',
      'restoration',
      'implant',
      'full_arch',
    ]).notNullable();
    table.jsonb('vertex_indices').comment('Array of vertex indices belonging to this segment');
    table.jsonb('face_indices').comment('Array of face indices belonging to this segment');
    table.string('segmentation_mask_path', 512).comment('Path to stored segmentation mask file');
    table.jsonb('centroid').comment('[x, y, z] centroid of segment');
    table.jsonb('bounding_box');
    table.decimal('surface_area_mm2', 10, 2);
    table.decimal('volume_mm3', 10, 2);
    table.decimal('segmentation_confidence', 4, 3).comment('0.000-1.000 AI confidence');
    table.boolean('manually_verified').defaultTo(false);
    table.timestamps(true, true);

    table.index('scan_id');
    table.index('tooth_label');
    table.index('structure_type');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('meshes');
};
