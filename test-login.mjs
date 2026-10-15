import { createHash } from 'node:crypto';
import { initDatabase, getUserByEmail } from './dist/db/database.js';

async function main() {
  await initDatabase();
  
  const user = getUserByEmail('admin@aade.local');
  console.log('User found:', JSON.stringify(user, null, 2));
  
  if (!user) {
    console.log('NO USER FOUND');
    process.exit(1);
  }
  
  const expectedHash = createHash('sha256').update('superadmin').digest('hex');
  console.log('Expected hash:', expectedHash);
  console.log('DB hash:      ', user.password_hash);
  console.log('Match:', user.password_hash === expectedHash);
  console.log('is_active:', user.is_active);
}

main().catch(console.error);
