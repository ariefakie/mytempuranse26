#!/usr/bin/env node
/**
 * Auto Import Excel to Supabase
 * Usage: node auto-import.js <service_key> [file1.xlsx] [file2.xlsx] ...
 *
 * Example:
 *   node auto-import.js sb_secret_xxxxx Biodata\ Petugas.xlsx Alokasi_Petugas.xlsx
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ============== CONFIG ==============
const SUPABASE_URL = 'https://ebyzqfvfursatmeqdlwc.supabase.co';
const PROJECT_REF = 'ebyzqfvfursatmeqdlwc';
// ====================================

// Default files to import
const DEFAULT_FILES = [
  'Biodata Petugas.xlsx',
  'Alokasi_Petugas.xlsx',
  'Progres_Lapangan.csv'
];

// HTTP request helper for Supabase
function supabaseRequest(method, endpoint, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'apikey': apiKey,
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Execute raw SQL via Supabase Management API
async function executeSQL(apiKey, sql) {
  console.log('  Creating table via Management API...');

  try {
    // Management API endpoint for running SQL
    const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });

    const body = await res.text();

    if (res.ok) {
      console.log('  ✓ Table created successfully');
      return true;
    } else {
      console.log('  ✗ API Error:', body.substring(0, 300));
      return false;
    }
  } catch (e) {
    console.log('  ✗ Exception:', e.message);
    return false;
  }
}

// Detect column type based on values
function detectColumnType(values) {
  // Force all columns to TEXT for consistency
  return 'TEXT';
}

// Generate CREATE TABLE SQL
function generateCreateTableSQL(tableName, data) {
  if (!data || data.length === 0) {
    throw new Error('No data to analyze');
  }

  const columns = Object.keys(data[0]);
  const columnDefs = [];

  for (const col of columns) {
    const values = data.map(row => row[col]);
    const type = detectColumnType(values);
    const safeName = `"${col.replace(/"/g, '""')}"`;
    columnDefs.push(`${safeName} ${type}`);
  }

  return `
DROP TABLE IF EXISTS ${tableName} CASCADE;
CREATE TABLE ${tableName} (
  ${columnDefs.join(',\n  ')}
);
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;
CREATE POLICY "r" ON ${tableName} FOR SELECT USING (true);
CREATE POLICY "i" ON ${tableName} FOR INSERT WITH CHECK (true);
CREATE POLICY "u" ON ${tableName} FOR UPDATE USING (true);
  `.trim();
}

// Insert data via Supabase Management API (SQL)
async function insertData(apiKey, tableName, data) {
  const batchSize = 100;
  let totalInserted = 0;

  console.log(`  Inserting ${data.length} rows in batches of ${batchSize}...`);

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    // Build INSERT SQL
    const columns = Object.keys(batch[0]);
    const values = batch.map(row => {
      return '(' + columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined || val === '') return 'NULL';
        return "'" + String(val).replace(/'/g, "''") + "'";
      }).join(', ') + ')';
    }).join(', ');

    const sql = `INSERT INTO ${tableName} (${columns.map(c => `"${c}"`).join(', ')}) VALUES ${values}`;

    try {
      const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
      });

      if (res.ok) {
        totalInserted += batch.length;
        process.stdout.write(`\r    Progress: ${totalInserted}/${data.length} rows`);
      } else {
        const err = await res.text();
        console.log(`\n  ✗ Error inserting batch ${i}:`, err.substring(0, 100));
      }
    } catch (e) {
      console.log(`\n  ✗ Exception batch ${i}:`, e.message);
    }
  }

  console.log(`\n  ✓ Inserted ${totalInserted}/${data.length} rows`);
  return totalInserted;
}

// Import single Excel/CSV file
async function importFile(apiKey, filePath) {
  const fileName = path.basename(filePath);
  const tableName = fileName.replace(/\.(xlsx|xls|csv)$/i, '').replace(/\s+/g, '_').toLowerCase();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📁 File: ${fileName}`);
  console.log(`📊 Table: ${tableName}`);
  console.log('='.repeat(50));

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`  ✗ File not found: ${filePath}`);
    return false;
  }

  try {
    // 1. Read Excel/CSV
    console.log('  Reading file...');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!data || data.length === 0) {
      console.log('  ✗ No data found in file');
      return false;
    }

    console.log(`  ✓ Read ${data.length} rows, ${Object.keys(data[0]).length} columns`);

    // 2. Generate SQL
    console.log('  Generating CREATE TABLE SQL...');
    const columns = Object.keys(data[0]);
    for (let i = 0; i < columns.length; i++) {
      const values = data.map(row => row[columns[i]]);
      const type = detectColumnType(values);
      console.log(`    ${i + 1}. "${columns[i]}" → ${type}`);
    }

    const sql = generateCreateTableSQL(tableName, data);

    // 3. Execute SQL (create table)
    console.log('  Creating table...');
    const success = await executeSQL(apiKey, sql);

    if (!success) {
      // Try alternative: create table using REST API workaround
      console.log('  ✗ RPC method failed');
      console.log('  Note: Please ensure pg_execute function exists in Supabase');
      console.log('  Or manually run this SQL in Supabase SQL Editor:\n');
      console.log(sql);
      return false;
    }

    // 4. Insert data
    console.log('  Inserting data...');
    const inserted = await insertData(apiKey, tableName, data);

    console.log(`\n  ✅ SUCCESS! Table "${tableName}" created with ${inserted} rows`);
    return true;

  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log('\n🚀 Supabase Excel Auto-Import Tool');
  console.log('='.repeat(50));

  // Parse arguments
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('\n📖 Usage:');
    console.log('  node auto-import.js <personal_access_token> [file1.xlsx] [file2.xlsx] ...');
    console.log('\n📋 Example:');
    console.log('  node auto-import.js sbp_xxxxx "Biodata Petugas.xlsx"');
    console.log('  node auto-import.js sbp_xxxxx');
    console.log('\n📦 Default files (if none specified):');
    DEFAULT_FILES.forEach(f => console.log(`    - ${f}`));
    console.log('\n💡 Get your Personal Access Token at:');
    console.log('   https://supabase.com/dashboard/account/tokens');
    console.log('');
    return;
  }

  const apiKey = args[0];
  const files = args.slice(1).length > 0 ? args.slice(1) : DEFAULT_FILES;

  // Validate API key format
  if (!apiKey.startsWith('sbp_')) {
    console.log('\n⚠️  Warning: Personal Access Token should start with "sbp_"');
  }

  console.log(`\n🔑 Using Personal Access Token: ${apiKey.substring(0, 15)}...`);
  console.log(`📁 Files to import: ${files.length}`);

  // Import each file
  const results = [];
  for (const file of files) {
    const success = await importFile(apiKey, file);
    results.push({ file, success });
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.file}`);
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`\nTotal: ${successCount}/${results.length} files imported successfully`);

  if (successCount < results.length) {
    console.log('\n⚠️  Some imports failed. Check the errors above.');
  }
}

// Run
main().catch(console.error);
