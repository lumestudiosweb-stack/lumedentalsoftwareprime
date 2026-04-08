exports.up = function (knex) {
  return knex.schema.createTable('simulation_states', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('simulation_id').notNullable().references('id').inTable('simulations').onDelete('CASCADE');
    table.integer('state_order').notNullable().comment('0=current, 1=progression, 2=outcome...');
    table.string('label', 100).comment('e.g. "Current State", "6 Months Untreated", "Post-Crown"');
    table.string('mesh_delta_path', 512).comment('Path to vertex displacement delta file');
    table.string('full_mesh_path', 512).comment('Path to complete resulting mesh');
    table.string('texture_map_path', 512).comment('Path to generated texture/material');
    table.string('thumbnail_path', 512).comment('Preview image of this state');
    table.jsonb('vertex_displacements').comment('Compact displacement vectors if small enough');
    table.jsonb('color_map').comment('Per-vertex or per-face color data');
    table.jsonb('annotations').comment('Clinician-facing labels on the mesh');
    table.jsonb('clinical_metrics').comment('e.g. {"bone_loss_mm": 2.3, "recession_mm": 1.5}');
    table.timestamps(true, true);

    table.unique(['simulation_id', 'state_order']);
    table.index('simulation_id');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('simulation_states');
};
