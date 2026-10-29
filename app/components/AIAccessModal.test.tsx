import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AIAccessModal from './AIAccessModal';
import { getAccessKey } from '../../lib/ai/accessKey';
import { ACCESS_CONTACT_EMAIL } from '../../lib/ai/contact';

const fetchMock = jest.fn();
beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  (global as any).fetch = fetchMock;
});

const reply = (status: number, body: unknown = {}) =>
  fetchMock.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('AIAccessModal', () => {
  it('shows nothing when closed', () => {
    render(<AIAccessModal open={false} onClose={() => {}} onUnlocked={() => {}} />);
    expect(screen.queryByText(/AI research assistant/i)).toBeNull();
  });

  it('checks a typed key with the server, then stores it and unlocks', async () => {
    reply(200, { ok: true });
    const onUnlocked = jest.fn();
    render(<AIAccessModal open onClose={() => {}} onUnlocked={onUnlocked} />);
    fireEvent.change(screen.getByLabelText(/access key/i), { target: { value: 'my-shared-key' } });
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }));
    await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/api/llm/access', expect.objectContaining({
      headers: expect.objectContaining({ 'X-AI-Access-Key': 'my-shared-key' }),
    }));
    expect(getAccessKey()).toBe('my-shared-key');
  });

  it('keeps nothing and says so when the key is wrong', async () => {
    reply(401, { error: 'Invalid or missing access key' });
    const onUnlocked = jest.fn();
    render(<AIAccessModal open onClose={() => {}} onUnlocked={onUnlocked} />);
    fireEvent.change(screen.getByLabelText(/access key/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }));
    expect(await screen.findByText(/not accepted/i)).toBeInTheDocument();
    expect(onUnlocked).not.toHaveBeenCalled();
    expect(getAccessKey()).toBe('');
  });

  it('explains a lockout instead of a wrong key', async () => {
    reply(429, { error: 'Too many wrong keys, try again later' });
    render(<AIAccessModal open onClose={() => {}} onUnlocked={() => {}} />);
    fireEvent.change(screen.getByLabelText(/access key/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }));
    expect(await screen.findByText(/too many/i)).toBeInTheDocument();
  });

  it('tells people to email the contact address to request a key, with no form and no request sent', () => {
    render(<AIAccessModal open onClose={() => {}} onUnlocked={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: /request a key/i }));
    expect(screen.getByText(ACCESS_CONTACT_EMAIL)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^name/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /send request/i })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('offers a ready-made mail to the contact address', () => {
    render(<AIAccessModal open onClose={() => {}} onUnlocked={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: /request a key/i }));
    const link = screen.getByRole('link', { name: /write an email/i }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toMatch(new RegExp(`^mailto:${ACCESS_CONTACT_EMAIL}\\?subject=`));
    expect(decodeURIComponent(link.getAttribute('href')!)).toMatch(/access key/i);
  });
});
