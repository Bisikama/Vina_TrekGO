// Runs only against a disposable localhost database; never truncates the configured database.
const {Client}=require('pg');
const {randomUUID}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
require('dotenv').config({quiet:true});
(async()=>{
 const url=new URL(process.env.DATABASE_URL);
 if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('This runner requires localhost PostgreSQL');
 const database='trek_cancel_test_'+randomUUID().replaceAll('-','');
 if(!/^trek_cancel_test_[0-9a-f]{32}$/.test(database))throw new Error('Invalid disposable database');
 const adminUrl=new URL(url);adminUrl.pathname='/postgres';adminUrl.search='';
 const admin=new Client({connectionString:adminUrl.toString()});await admin.connect();
 let created=false;
 try{
  await admin.query(`CREATE DATABASE "${database}"`);created=true;
  const testUrl=new URL(url);testUrl.pathname='/'+database;
  const env={...process.env,DATABASE_URL:testUrl.toString(),DIRECT_URL:testUrl.toString(),TRIP_CANCELLATION_TEST_DATABASE_URL:testUrl.toString(),TRIP_CANCELLATION_WORKER_ENABLED:'true'};
  function run(script,args){const result=spawnSync(process.execPath,[require.resolve(script),...args],{cwd:path.resolve(__dirname,'..'),env,encoding:'utf8',stdio:script.startsWith('prisma')?'pipe':'inherit'});if(result.status!==0){if(result.stdout)console.error(result.stdout);if(result.stderr)console.error(result.stderr);throw new Error('Test command failed');}}
  run('prisma/build/index.js',['migrate','deploy']);
  run('jest/bin/jest',['--runInBand','--runTestsByPath','src/modules/bookings/trip-cancellation.integration.spec.ts','src/modules/bookings/booking-cancellation-rentals.spec.ts']);
 }finally{
  // database is generated locally above; never derived from the configured DB name or user input.
  if(created&&/^trek_cancel_test_[0-9a-f]{32}$/.test(database))await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
