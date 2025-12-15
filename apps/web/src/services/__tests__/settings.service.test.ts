import { settingsService } from '../settings.service';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
  },
}));

describe('settingsService', () => {
  const mockSetting = {
    id: 'setting-1',
    key: 'app.theme',
    value: 'dark',
    category: 'appearance',
    description: 'Application theme',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  };

  const mockSettings = [mockSetting, { ...mockSetting, id: 'setting-2', key: 'app.language', value: 'fr' }];

  const mockSettingsResponse = {
    settings: { 'app.theme': 'dark', 'app.language': 'fr' },
    list: mockSettings,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should fetch all settings', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockSettingsResponse });

      const result = await settingsService.getAll();

      expect(api.get).toHaveBeenCalledWith('/settings');
      expect(result).toEqual(mockSettingsResponse);
    });
  });

  describe('getByCategory', () => {
    it('should fetch settings by category', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockSettings });

      const result = await settingsService.getByCategory('appearance');

      expect(api.get).toHaveBeenCalledWith('/settings/category/appearance');
      expect(result).toEqual(mockSettings);
    });
  });

  describe('getOne', () => {
    it('should fetch a single setting by key', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockSetting });

      const result = await settingsService.getOne('app.theme');

      expect(api.get).toHaveBeenCalledWith('/settings/app.theme');
      expect(result).toEqual(mockSetting);
    });
  });

  describe('update', () => {
    it('should update a setting', async () => {
      const updatedSetting = { ...mockSetting, value: 'light' };
      (api.put as jest.Mock).mockResolvedValue({ data: updatedSetting });

      const result = await settingsService.update('app.theme', 'light');

      expect(api.put).toHaveBeenCalledWith('/settings/app.theme', {
        value: JSON.stringify('light'),
        description: undefined,
      });
      expect(result).toEqual(updatedSetting);
    });

    it('should update a setting with description', async () => {
      const updatedSetting = { ...mockSetting, value: 'light', description: 'Updated theme' };
      (api.put as jest.Mock).mockResolvedValue({ data: updatedSetting });

      const result = await settingsService.update('app.theme', 'light', 'Updated theme');

      expect(api.put).toHaveBeenCalledWith('/settings/app.theme', {
        value: JSON.stringify('light'),
        description: 'Updated theme',
      });
      expect(result).toEqual(updatedSetting);
    });

    it('should handle object values', async () => {
      const objectValue = { primary: '#000', secondary: '#fff' };
      (api.put as jest.Mock).mockResolvedValue({ data: mockSetting });

      await settingsService.update('app.colors', objectValue);

      expect(api.put).toHaveBeenCalledWith('/settings/app.colors', {
        value: JSON.stringify(objectValue),
        description: undefined,
      });
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple settings', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockSettings });

      const settings = {
        'app.theme': 'dark',
        'app.language': 'en',
      };

      const result = await settingsService.bulkUpdate(settings);

      expect(api.post).toHaveBeenCalledWith('/settings/bulk', { settings });
      expect(result).toEqual(mockSettings);
    });
  });

  describe('resetToDefault', () => {
    it('should reset a setting to default', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockSetting });

      const result = await settingsService.resetToDefault('app.theme');

      expect(api.post).toHaveBeenCalledWith('/settings/app.theme/reset');
      expect(result).toEqual(mockSetting);
    });
  });

  describe('resetAllToDefaults', () => {
    it('should reset all settings to defaults', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockSettingsResponse });

      const result = await settingsService.resetAllToDefaults();

      expect(api.post).toHaveBeenCalledWith('/settings/reset-all');
      expect(result).toEqual(mockSettingsResponse);
    });
  });
});
