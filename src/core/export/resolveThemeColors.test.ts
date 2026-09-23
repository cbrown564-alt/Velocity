import { describe, expect, it } from 'vitest';
import { velocity } from '../../theme/themes';
import { resolveExportBranding } from './resolveThemeColors';

describe('resolveExportBranding', () => {
  it('uses the neutral brand colors and a portable presentation font', () => {
    expect(resolveExportBranding(velocity)).toMatchObject({
      primaryColor: '17212B',
      headerColor: '245FA7',
      fontFamily: 'Arial',
    });
  });
});
