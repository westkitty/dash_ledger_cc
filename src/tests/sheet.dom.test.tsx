/**
 * Phase 2 — Sheet primitive accessibility.
 *
 * The field flows (Start / End Dash) open in this sheet, so its keyboard and
 * focus behaviour is load-bearing: focus enters on open, Escape and a backdrop
 * click dismiss, and focus returns to the opener on close.
 */

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Sheet } from '../components/Sheet';

afterEach(cleanup);

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        open sheet
      </button>
      {open && (
        <Sheet
          title="Test sheet"
          onClose={() => {
            setOpen(false);
            onClose();
          }}
        >
          <button type="button">inside action</button>
        </Sheet>
      )}
    </div>
  );
}

describe('Sheet', () => {
  it('is a labelled modal dialog and moves focus inside on open', () => {
    render(<Harness onClose={() => {}} />);
    fireEvent.click(screen.getByText('open sheet'));

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('locks background scroll while open and restores it on close', () => {
    render(<Harness onClose={() => {}} />);
    fireEvent.click(screen.getByText('open sheet'));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('dismisses on Escape', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByText('open sheet'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('dismisses on a backdrop click but not on a click inside the panel', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByText('open sheet'));

    fireEvent.mouseDown(screen.getByRole('button', { name: 'inside action' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(document.querySelector('.sheet-backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the opener when it closes', () => {
    render(<Harness onClose={() => {}} />);
    const opener = screen.getByText('open sheet');
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(opener);
  });
});
