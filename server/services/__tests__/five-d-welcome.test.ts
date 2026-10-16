import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const send = vi.hoisted(() => vi.fn());
vi.mock('../email.service', () => ({
  emailApiService: { sendFiveDNewMemberWelcome: send },
}));
import { sendFiveDWelcome } from '../../routes/admin-five-d-welcome';
import { pool } from '../../db';

afterEach(() => {
  vi.restoreAllMocks();
  send.mockReset();
});

async function request(body: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await sendFiveDWelcome({ body } as Request, res as unknown as Response);
  return res;
}

describe('5D welcome delivery reporting (no emails sent)', () => {
  it('validates the address before calling the provider', async () => {
    for (const body of [undefined, {}, { email: 'invalid@' }, { email: 5 }]) {
      expect((await request(body)).status).toHaveBeenCalledWith(400);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it('reports success only after provider acceptance and trims the recipient', async () => {
    send.mockResolvedValue({ success: true, message: '5D welcome email sent' });
    const res = await request({ email: ' member@example.test ' });
    expect(send).toHaveBeenCalledWith({ to: 'member@example.test' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('does not claim success when the provider returns a failure', async () => {
    send.mockResolvedValue({ success: false, message: 'Failed to send 5D welcome email' });
    const res = await request({ email: 'member@example.test' });
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'email_delivery_failed' }));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not auto-retry when delivery is uncertain', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    send.mockRejectedValue(new Error('connection interrupted'));
    const res = await request({ email: 'member@example.test' });
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'email_delivery_unconfirmed' }));
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('database pool disconnections', () => {
  it('handles an idle connection error without terminating the server', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => pool.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[DB_POOL]'));
  });
});
