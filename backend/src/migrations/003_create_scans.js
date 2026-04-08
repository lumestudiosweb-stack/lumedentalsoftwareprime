exports.up = function (knex) {
  return knex.schema.createTable('scans', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.enum('scan_type', [
      'intraoral',
      'facial_3d',
      'cbct',
      'panoramic',
      'periapical',
      'cephalometric',
    ]).notNullable();
    table.enum('file_format', ['stl', 'obj', 'ply', 'dcm', 'png', 'jpg']).notNullable();
    table.string('storage_path', 512).notNullable().comment('S3 key or cloud storage path');
    table.string('original_filename', 255);
    table.bigInteger('file_size_bytes');
    table.string('checksum_sha256', 64);
    table.enum('arch', ['upper', 'lower', 'both']).comment('For intraoral scans');
    table.integer('vertex_count').comment('Number of vertices in mesh');
    table.integer('face_count').comment('Number of faces in mesh');
    table.jsonb('bounding_box').comment('{"min": [x,y,z], "max": [x,y,z]}');
    table.enum('quality_score', ['low', 'medium', 'high']).defaultTo('medium');
    table.enum('status', ['uploading', 'processing', 'ready', 'failed']).defaultTo('uploading');
    table.text('processing_error');
    table.uuid('uploaded_by');
    table.timestamp('scan_date').defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.index('patient_id');
    table.index('scan_type');
    table.index('status');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('scans');
};
