import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordInput from '../components/ui/PasswordInput.jsx';

describe('PasswordInput Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with label', () => {
    render(<PasswordInput label="Password" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders with placeholder', () => {
    render(
      <PasswordInput
        placeholder="Enter your password"
        value=""
        onChange={() => {}}
      />
    );
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    render(<PasswordInput value="secret" onChange={() => {}} />);

    const input = screen.getByDisplayValue('secret');
    expect(input).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByRole('button', { name: /show password/i });
    await user.click(toggleButton);

    expect(input).toHaveAttribute('type', 'text');
  });

  it('shows error message when provided', () => {
    render(
      <PasswordInput
        value=""
        onChange={() => {}}
        error="Password must be at least 8 characters"
      />
    );
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
  });

  it('has aria-label on toggle button for accessibility', () => {
    render(<PasswordInput value="test" onChange={() => {}} />);
    const toggle = screen.getByRole('button', { name: /show password/i });
    expect(toggle).toHaveAttribute('aria-label');
  });
});
