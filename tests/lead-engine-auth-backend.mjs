// Synthetic Auth/Members transport for isolated L01 API checks. Never a shared server.
import { createServer } from 'node:http';
if (process.env.L01_SYNTHETIC_AUTH !== '1') throw Error('Explicit isolated fixture flag required');
const members = {
  admin: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'admin', status: 'active', email: 'operator@example.test' },
  student: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', role: 'student', status: 'active', email: 'student@example.test' },
  coach: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'coach', status: 'active', email: 'coach@example.test' },
  suspended: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', role: 'admin', status: 'suspended', email: 'operator@example.test' },
};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:3234');
  const reply = (status, data) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(data)); };
  if (url.pathname === '/auth/v1/user') {
    const role = request.headers.authorization?.replace('Bearer l01-', '');
    const member = members[role];
    if (!member) return reply(401, { message: 'Synthetic token rejected' });
    return reply(200, { id: member.id, email: member.email, email_confirmed_at: '2026-09-15T00:00:00Z', aud: 'authenticated', app_metadata: {}, user_metadata: {} });
  }
  if (url.pathname === '/rest/v1/nbc_members') {
    const member = Object.values(members).find(row => 'eq.' + row.id === url.searchParams.get('id'));
    return reply(200, member ? [{ id: member.id, role: member.role, status: member.status, display_name: 'Review fixture' }] : []);
  }
  return reply(404, { code: 'PGRST205', message: 'Synthetic storage pending' });
});
server.listen(3234, '127.0.0.1', () => console.log('Synthetic Auth/Members on 127.0.0.1:3234'));
process.on('SIGTERM', () => server.close());
