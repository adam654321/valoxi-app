#!/bin/bash
set -e
npm install --prefer-offline --no-audit --no-fund
# db:push removed deliberately (SS3-H1, #188 drift).
# Drizzle's snapshot is frozen at journal index 7. A push would attempt
# destructive statements including DROP TABLE promo_codes CASCADE and
# twelve DROP COLUMN. Schema changes are applied by direct ALTER from a
# versioned file in migrations/, never by push. Do not re-add this line.
