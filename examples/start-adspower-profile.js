import { startAdsPowerProfile } from '../src/launchers/adspower.js';

const userId = process.env.ADSPOWER_USER_ID;
if (!userId) {
  throw new Error('Set ADSPOWER_USER_ID to the AdsPower profile/user id to start');
}

const result = await startAdsPowerProfile({ userId });
console.log('AdsPower CDP endpoint:', result.endpoint);
console.log('Register it with:');
console.log(`curl -X POST http://127.0.0.1:3000/browsers -H 'content-type: application/json' -d '${JSON.stringify({ browserId: `adspower-${userId}`, type: 'adspower', endpoint: result.endpoint })}'`);
