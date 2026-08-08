// Usage:  node generateAdminHash.js YourNewPassword
// Copy the printed hash into ADMIN_PASSWORD_HASH in your .env file.
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.log('Usage: node generateAdminHash.js YourNewPassword');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log('\nAdd this line to your .env file:\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
