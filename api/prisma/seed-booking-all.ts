import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { demoConfigSchema } from './seeds/booking-demo.config'

// Run children sequentially and stop immediately on failure.
function run(script: string, args: string[] = []) {
  console.log(`Running ${script}`)
  const child = spawnSync(process.execPath, ['-r', 'ts-node/register', script, ...args], {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  })
  if (child.error) throw child.error
  if (child.status !== 0) throw new Error(`${script} failed; remaining seed steps were not run`)
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('npm run seed:booking-all -- --config=prisma/seeds/data/booking-demo.local.json')
    return
  }
  if (args.length !== 1 || !args[0].startsWith('--config='))
    throw new Error('Pass exactly --config=<booking demo JSON>. This command does not reset the database.')
  const configPath = resolve(args[0].slice('--config='.length))
  const config = demoConfigSchema.parse(JSON.parse(readFileSync(configPath, 'utf8')))
  const users = JSON.parse(readFileSync(resolve(__dirname, 'seeds/data/users.seed.json'), 'utf8')) as
    { id: string; role: string; status: string }[]
  for (const [actor, id] of Object.entries(config.actors)) {
    const role = actor === 'admin' ? 'ADMIN' : actor === 'leader' ? 'LEADER' : 'USER'
    if (!users.some((u) => u.id === id && u.role === role && u.status === 'ACTIVE'))
      throw new Error(`${actor}: configured ID must match an ACTIVE ${role} in users.seed.json`)
  }
  if (!process.env.DATABASE_URL || !process.env.MONGODB_URI)
    throw new Error('DATABASE_URL and MONGODB_URI are required')
  // All child scripts must use the same configured PostgreSQL target.
  process.env.DIRECT_URL = process.env.DATABASE_URL
  run('prisma/seed-users.ts')
  run('prisma/seed-nui-dinh.ts')
  run('prisma/seed-demo-prereqs.ts')
  run('prisma/seeds/booking-policy.seed.ts')
  run('prisma/seeds/coreflows-happy.seed.ts', [`--config=${configPath}`])
  run('prisma/seeds/coreflows-happy.seed.ts', [`--config=${configPath}`, '--verify-only'])
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Ordered seed failed')
  process.exitCode = 1
}
