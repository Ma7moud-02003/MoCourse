import * as path from 'path';
import { DataSource } from 'typeorm';
import base from './data-source';

// npm run migration:drift
// Compares the real database with the entities and prints what would have to change.
// Run it after the migrations: it must print "no drift". It only reads, it never changes the database.
async function main() {
  const ds = new DataSource({
    ...(base.options as any),
    entities: [path.join(__dirname, '..', '**', '*{entity,enity}.js')],
    migrations: [],
  });
  await ds.initialize();
  try {
    const log = await ds.driver.createSchemaBuilder().log();
    if (!log.upQueries.length) {
      console.log('no drift');
      return;
    }
    console.log(`${log.upQueries.length} difference(s) between the database and the entities:`);
    for (const q of log.upQueries) console.log('  ' + q.query);
    process.exitCode = 1;
  } finally {
    await ds.destroy();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
