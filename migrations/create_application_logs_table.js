exports.up = function(knex) {
  return knex.schema.createTable('application_logs', function(table) {
    table.increments('id').primary();
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    table.string('level', 20).notNullable();
    table.text('message').notNullable();
    table.text('url').notNullable();
    table.text('user_agent');
    table.integer('load_time');
    table.integer('dom_ready_time');
  }).then(function() {
    return knex.raw('CREATE INDEX idx_application_logs_timestamp ON application_logs (timestamp)');
  }).then(function() {
    return knex.raw('CREATE INDEX idx_application_logs_level ON application_logs (level)');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('application_logs');
};