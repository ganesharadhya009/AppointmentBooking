import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the admin console heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /AppointmentBooking Admin/i })).toBeInTheDocument();
  });
});
