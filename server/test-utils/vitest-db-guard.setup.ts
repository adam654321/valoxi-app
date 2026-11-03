// Runs before every test file (vitest.config.ts setupFiles).
import { assertTestDbHost } from './db-host-guard';

assertTestDbHost();
