// PreToolUse hook: block shell commands that can wipe or rewrite the shared database.
// Exit code 2 blocks the tool call and sends stderr back to Claude.
let raw = ''
process.stdin.on('data', (c) => (raw += c))
process.stdin.on('end', () => {
  let command = ''
  try {
    command = JSON.parse(raw)?.tool_input?.command ?? ''
  } catch {
    process.exit(0)
  }

  const blocked = [
    { re: /prisma\s+migrate\s+reset/i, why: '`prisma migrate reset` xoá toàn bộ dữ liệu' },
    { re: /prisma\s+db\s+push/i, why: '`prisma db push` bỏ qua migration, chỉ dùng cho DB cục bộ tạm' },
    { re: /--force-reset|--accept-data-loss/i, why: 'cờ này có thể làm mất dữ liệu' },
  ]

  const hit = blocked.find((b) => b.re.test(command))
  if (hit) {
    process.stderr.write(
      `Bị chặn bởi .claude/hooks/guard-db.mjs: ${hit.why}. ` +
        'Hãy tạo migration bổ sung mới (`npx prisma migrate dev --create-only --name <name>`) ' +
        'hoặc hỏi người dùng nếu thật sự cần.\n',
    )
    process.exit(2)
  }
  process.exit(0)
})
