import * as path from 'path';
import { DataSource } from 'typeorm';

// Used only by the migration commands (npm run migration:*). The app itself keeps using
// TypeOrmModule in app.module.ts. Reads the same .env.<NODE_ENV> file and DB_* variables.
try {
  process.loadEnvFile(path.resolve(process.cwd(), `.env.${process.env.NODE_ENV}`));
} catch {
  // no env file: the variables must already be set in the environment
}

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: false,
  // migrations are plain SQL, they do not import the entities
  entities: [],
  migrations: [path.join(__dirname, 'migrations', '*.js')],
});
