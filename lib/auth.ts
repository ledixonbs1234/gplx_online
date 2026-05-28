import { getAdminDb } from './firebase-admin';

export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (!password) return false;

  try {
    const db = getAdminDb();
    const snapshot = await db.ref('settings/adminPassword').once('value');
    const dbPassword = snapshot.val();

    if (dbPassword) {
      return password === dbPassword;
    }

    return password === process.env.ADMIN_PASSWORD;
  } catch (error) {
    console.error('Error verifying admin password:', error);
    return password === process.env.ADMIN_PASSWORD;
  }
}