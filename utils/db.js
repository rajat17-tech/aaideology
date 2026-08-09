const mongoose = require('mongoose');
const dns = require('dns');

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Mask the password in a MongoDB URI for safe logging.
 * mongodb+srv://user:SECRET@host/db  →  mongodb+srv://user:****@host/db
 */
function maskUri(uri) {
  return uri.replace(/:([^@/:]+)@/, ':****@');
}

/**
 * Sanitise the URI value read from .env:
 *  - strip leading/trailing whitespace
 *  - strip surrounding quotes that some editors/CI systems inject
 *  - strip a trailing carriage-return (Windows line-ending in .env)
 */
function sanitiseUri(raw) {
  let uri = raw.trim();
  // Remove surrounding single or double quotes
  if ((uri.startsWith('"') && uri.endsWith('"')) ||
      (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.slice(1, -1);
  }
  return uri;
}

/**
 * Try resolving SRV records using the system DNS resolver.
 * Returns true if the lookup succeeds, false otherwise.
 */
function testSrvLookup(hostname) {
  return new Promise((resolve) => {
    dns.resolveSrv(`_mongodb._tcp.${hostname}`, (err) => {
      resolve(!err);
    });
  });
}

/**
 * Resolve SRV records using a specific DNS server list and return the
 * individual shard hostnames + ports.  Returns null on failure.
 */
function resolveSrvWith(hostname, servers) {
  return new Promise((resolve) => {
    // dns.setServers() is process-global, so we save/restore.
    const original = dns.getServers();
    dns.setServers(servers);
    dns.resolveSrv(`_mongodb._tcp.${hostname}`, (err, records) => {
      dns.setServers(original);
      if (err || !records || records.length === 0) return resolve(null);
      resolve(records);
    });
  });
}

/**
 * Convert a mongodb+srv:// URI into a standard mongodb:// URI using
 * manually resolved SRV records.
 *
 *   mongodb+srv://user:pass@cluster0.xyz.mongodb.net/db?opts
 *     →
 *   mongodb://user:pass@shard0:27017,shard1:27017,shard2:27017/db?ssl=true&authSource=admin&opts
 */
function buildStandardUri(srvUri, srvRecords) {
  // Parse the SRV URI
  const url = new URL(srvUri);
  const credentials = url.username
    ? `${url.username}:${url.password}@`
    : '';
  const hosts = srvRecords.map(r => `${r.name}:${r.port}`).join(',');
  const dbPath = url.pathname || '/';

  // SRV URIs imply ssl=true and authSource=admin; preserve any user params
  const params = new URLSearchParams(url.search);
  if (!params.has('ssl') && !params.has('tls')) params.set('tls', 'true');
  if (!params.has('authSource')) params.set('authSource', 'admin');

  return `mongodb://${credentials}${hosts}${dbPath}?${params.toString()}`;
}

// ────────────────────────────────────────────────────────────────────
// Main connection function
// ────────────────────────────────────────────────────────────────────

/**
 * Connect to MongoDB once at startup.
 * Mongoose internally manages a connection pool and re-uses it for every
 * subsequent query, so this only needs to be called once (from server.js).
 *
 * Flow:
 *  1. Read & sanitise MONGODB_URI from process.env
 *  2. Log the masked URI so you can verify dotenv loaded it correctly
 *  3. If the URI uses mongodb+srv://, test the SRV DNS lookup with the
 *     system resolver; if it fails, retry with Google Public DNS and
 *     automatically fall back to a standard mongodb:// connection string
 *     built from the resolved SRV records.
 *  4. Connect via Mongoose with recommended options.
 *  5. On failure, log the full error stack and exit with a clear message.
 */
async function connectDB() {
  // ── 1. Read & validate ───────────────────────────────────────────
  const raw = process.env.MONGODB_URI;
  if (!raw) {
    console.error('');
    console.error('╔══════════════════════════════════════════════════════════╗');
    console.error('║  FATAL: MONGODB_URI is not set in .env                  ║');
    console.error('║  The server cannot start without a database connection.  ║');
    console.error('╚══════════════════════════════════════════════════════════╝');
    console.error('');
    process.exit(1);
  }

  const uri = sanitiseUri(raw);

  // ── 2. Log the masked URI ────────────────────────────────────────
  console.log('');
  console.log('🔌 MongoDB connection starting …');
  console.log(`   URI loaded: ${maskUri(uri)}`);

  if (uri !== raw) {
    console.log('   ⚠️  URI was sanitised (stripped whitespace/quotes from .env value)');
  }

  // Quick format validation
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    console.error('   ❌ URI does not start with mongodb:// or mongodb+srv://');
    console.error('   Please check MONGODB_URI in your .env file.');
    process.exit(1);
  }

  // ── 3. SRV DNS fallback ──────────────────────────────────────────
  let connectUri = uri;

  if (uri.startsWith('mongodb+srv://')) {
    const hostname = new URL(uri).hostname;
    console.log(`   🔍 Testing SRV DNS lookup for ${hostname} …`);

    const systemOk = await testSrvLookup(hostname);

    if (systemOk) {
      console.log('   ✅ SRV lookup succeeded with system DNS');
    } else {
      console.warn('   ⚠️  SRV lookup FAILED with system DNS (ECONNREFUSED)');
      console.log('   🔄 Retrying with Google Public DNS (8.8.8.8 / 8.8.4.4) …');

      const records = await resolveSrvWith(hostname, ['8.8.8.8', '8.8.4.4']);

      if (records && records.length > 0) {
        console.log(`   ✅ Resolved ${records.length} shard host(s) via Google DNS:`);
        records.forEach(r => console.log(`      • ${r.name}:${r.port}`));

        connectUri = buildStandardUri(uri, records);
        console.log(`   🔀 Falling back to standard connection string`);
        console.log(`   URI: ${maskUri(connectUri)}`);

        // Keep Google DNS active for this process so Mongoose's own
        // hostname resolution (for the individual shard hosts) also works.
        dns.setServers(['8.8.8.8', '8.8.4.4']);
        console.log('   📡 DNS servers set to Google Public DNS for this process');
      } else {
        console.error('');
        console.error('   ❌ SRV lookup also failed with Google DNS.');
        console.error('   Possible causes:');
        console.error('     • No internet connectivity');
        console.error('     • MongoDB Atlas cluster hostname is incorrect');
        console.error('     • Corporate firewall blocking DNS on port 53');
        console.error('');
        console.error('   Your URI:', maskUri(uri));
        console.error('');
        process.exit(1);
      }
    }
  }

  // ── 4. Connect ───────────────────────────────────────────────────
  try {
    console.log('   ⏳ Connecting to MongoDB …');

    await mongoose.connect(connectUri, {
      serverSelectionTimeoutMS: 15000,  // fail fast if unreachable (default 30s)
      socketTimeoutMS: 45000,
    });

    console.log('   ✅ Connected to MongoDB');
    console.log(`   Database: ${mongoose.connection.db.databaseName}`);
    console.log('');
  } catch (err) {
    // ── 5. Detailed error logging ──────────────────────────────────
    console.error('');
    console.error('╔══════════════════════════════════════════════════════════╗');
    console.error('║  ❌ MongoDB connection FAILED                           ║');
    console.error('╚══════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('Error name   :', err.name);
    console.error('Error message:', err.message);
    if (err.reason) console.error('Reason       :', err.reason);
    console.error('');
    console.error('Full stack trace:');
    console.error(err.stack);
    console.error('');
    console.error('Troubleshooting:');
    console.error(' 1. Verify MONGODB_URI in .env matches the Atlas connection string');
    console.error(' 2. Confirm your IP is in the Atlas "Network Access" allow-list');
    console.error(' 3. Confirm the database user and password are correct');
    console.error(' 4. Check internet connectivity');
    console.error(' 5. If behind a corporate firewall/VPN, try a different network');
    console.error('');
    process.exit(1);
  }

  // ── Post-connection event handlers ───────────────────────────────
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
  });
}

module.exports = { connectDB };
