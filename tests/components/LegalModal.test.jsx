// First component test, and the proof that the renderer works on a component
// that reads from contexts — which is what the large components need.
//
// LegalModal guards the paid boundary in the UI: activation is refused until
// the EULA is accepted. Nothing checked that before.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// `t(key, fallback)` falls back to the English string, so the tests can assert
// on readable text rather than on message keys.
vi.mock('../../src/contexts/I18nContext', () => ({
  useI18n: () => ({ t: (_key, fallback) => fallback }),
}));

const licenseContext = vi.hoisted(() => ({ value: null }));
vi.mock('../../src/contexts/LicenseContext', () => ({
  useLicenseContext: () => licenseContext.value,
}));

const { default: LegalModal } = await import('../../src/components/control-panel/LegalModal.jsx');

const context = (overrides = {}) => ({
  showLegalModal: true,
  handleCloseLegalModal: vi.fn(),
  licenseStatus: { isLicensed: false, hasAcceptedEula: false, summary: '' },
  licenseDeviceId: 'DEVICE-1234',
  licenseInput: '',
  setLicenseInput: vi.fn(),
  handleActivateLicense: vi.fn(),
  handleClearLicense: vi.fn(),
  handleAcceptEula: vi.fn(),
  licenseActionError: '',
  licenseActionMsg: '',
  eulaText: 'EULA body text',
  ...overrides,
});

const show = (overrides) => {
  licenseContext.value = context(overrides);
  return { ...render(<LegalModal />), ctx: licenseContext.value };
};

beforeEach(() => {
  licenseContext.value = context();
});

describe('visibility', () => {
  test('renders nothing while it is closed', () => {
    licenseContext.value = context({ showLegalModal: false });
    const { container } = render(<LegalModal />);
    expect(container.innerHTML).toBe('');
  });

  test('renders the dialog when open', () => {
    show();
    expect(screen.getByText('License')).toBeDefined();
  });
});

describe('the EULA gate on activation', () => {
  test('activation is refused until the EULA is accepted', () => {
    show({ licenseStatus: { isLicensed: false, hasAcceptedEula: false } });

    const activate = screen.getByRole('button', { name: 'Activate' });
    expect(activate.disabled).toBe(true);
    expect(activate.title).toMatch(/accept EULA before activation/i);
    expect(screen.getByText(/Please click "Accept EULA" before activation/)).toBeDefined();
  });

  test('activation is allowed once the EULA is accepted', () => {
    show({ licenseStatus: { isLicensed: false, hasAcceptedEula: true } });

    const activate = screen.getByRole('button', { name: 'Activate' });
    expect(activate.disabled).toBe(false);
    expect(screen.queryByText(/Please click "Accept EULA"/)).toBeNull();
  });

  test('clicking Activate once allowed reaches the handler', async () => {
    const { ctx } = show({ licenseStatus: { isLicensed: false, hasAcceptedEula: true } });

    await userEvent.click(screen.getByRole('button', { name: 'Activate' }));
    expect(ctx.handleActivateLicense).toHaveBeenCalledTimes(1);
  });
});

describe('status display', () => {
  test('an unlicensed install says so', () => {
    show({ licenseStatus: { isLicensed: false, hasAcceptedEula: false } });
    expect(screen.getByText(/Current Status/)).toBeDefined();
    expect(screen.getByText(/Not accepted/)).toBeDefined();
  });

  test('a licensed install shows its summary and acceptance date', () => {
    show({
      licenseStatus: {
        isLicensed: true,
        hasAcceptedEula: true,
        summary: 'Licensed to Living Stone',
        acceptedEulaAt: '2026-01-02',
      },
    });
    expect(screen.getByText(/Licensed to Living Stone/)).toBeDefined();
    expect(screen.getByText(/2026-01-02/)).toBeDefined();
  });

  test('an error and a message from the last action are both surfaced', () => {
    show({ licenseActionError: 'Key rejected', licenseActionMsg: 'Activated' });
    expect(screen.getByText('Key rejected')).toBeDefined();
    expect(screen.getByText('Activated')).toBeDefined();
  });
});

describe('closing', () => {
  test('clicking the backdrop closes the dialog', async () => {
    const { container, ctx } = show();

    await userEvent.click(container.querySelector('.cp-modal-overlay'));
    expect(ctx.handleCloseLegalModal).toHaveBeenCalledTimes(1);
  });

  test('clicking inside the card does not close it', async () => {
    // The card stops propagation; losing that would close the dialog whenever
    // someone clicked a field in it.
    const { container, ctx } = show();

    await userEvent.click(container.querySelector('.cp-modal-card'));
    expect(ctx.handleCloseLegalModal).not.toHaveBeenCalled();
  });

  test('the Close button closes it', async () => {
    const { ctx } = show();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(ctx.handleCloseLegalModal).toHaveBeenCalledTimes(1);
  });
});

describe('device id and licence key fields', () => {
  test('the device id is shown read-only and can be copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    show();

    const field = screen.getByDisplayValue('DEVICE-1234');
    expect(field.readOnly).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Copy Device ID' }));
    expect(writeText).toHaveBeenCalledWith('DEVICE-1234');
  });

  test('copying is disabled when there is no device id to copy', () => {
    show({ licenseDeviceId: '' });
    expect(screen.getByRole('button', { name: 'Copy Device ID' }).disabled).toBe(true);
  });

  test('typing a licence key is reported to the context', async () => {
    const { ctx } = show();

    await userEvent.type(screen.getByPlaceholderText(/Enter license key/), 'CDP1');
    expect(ctx.setLicenseInput).toHaveBeenCalled();
  });
});

describe('EULA body', () => {
  test('shows the text once it has loaded', () => {
    show({ eulaText: 'EULA body text' });
    expect(screen.getByText('EULA body text')).toBeDefined();
  });

  test('shows a placeholder while it is still loading', () => {
    show({ eulaText: '' });
    expect(screen.getByText('Loading EULA...')).toBeDefined();
  });
});
