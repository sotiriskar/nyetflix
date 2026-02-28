import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryRefreshButton } from './LibraryRefreshButton';

describe('LibraryRefreshButton', () => {
  it('renders nothing when visible is false', () => {
    const { container } = render(
      <LibraryRefreshButton onRefresh={() => {}} loading={false} visible={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders button when visible', () => {
    render(<LibraryRefreshButton onRefresh={() => {}} loading={false} visible={true} />);
    expect(screen.getByRole('button', { name: /scan library/i })).toBeInTheDocument();
  });

  it('calls onRefresh when clicked', () => {
    const onRefresh = vi.fn();
    render(<LibraryRefreshButton onRefresh={onRefresh} loading={false} visible={true} />);
    fireEvent.click(screen.getByRole('button', { name: /scan library/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables button when loading', () => {
    render(<LibraryRefreshButton onRefresh={() => {}} loading={true} visible={true} />);
    expect(screen.getByRole('button', { name: /scan library/i })).toBeDisabled();
  });
});
