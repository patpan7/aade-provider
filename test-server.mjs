import { initDatabase } from './dist/db/database.js';
import express from 'express';
import cors from 'cors';
import { createHash } from 'node:crypto';
import { getUserByEmail, updateUserLastLogin } from './dist/db/database.js';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/users/login', (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email });
    if (!email || !password) {
      return res.status(400).json({ success: false, errors: ['email and password are required'] });
    }
    const user = getUserByEmail(email);
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ success: false, errors: ['Invalid credentials'] });
    }
    console.log('User found:', { id: user.id, is_active: user.is_active, role: user.role });
    if (!user.is_active) {
      return res.status(401).json({ success: false, errors: ['Account inactive'] });
    }
    const expectedHash = createHash('sha256').update(password).digest('hex');
    console.log('Password match:', user.password_hash === expectedHash);
    if (user.password_hash !== expectedHash) {
      return res.status(401).json({ success: false, errors: ['Invalid credentials'] });
    }
    updateUserLastLogin(user.id);
    const { password_hash, ...safe } = user;
    res.json({ success: true, user: safe, token: 'test' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

async function main() {
  await initDatabase();
  app.listen(8765, () => {
    console.log('Test server on :8765');
  });
}
main();
