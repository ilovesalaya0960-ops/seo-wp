import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

class SettingsManager {
  constructor() {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️  Supabase credentials not found in environment variables');
      console.warn('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      this.supabase = null;
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    this.defaultSettings = {
      geminiKey: '',
      sites: []
    };
  }

  async initializeSettings() {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return;
    }

    // Check if gemini_api_key exists, if not create it
    const { data, error } = await this.supabase
      .from('settings')
      .select('*')
      .eq('key', 'gemini_api_key')
      .single();

    if (error && error.code === 'PGRST116') {
      // Record not found, create it
      await this.supabase
        .from('settings')
        .insert({ key: 'gemini_api_key', value: '' });
    }
  }

  async loadSettings() {
    if (!this.supabase) {
      return this.defaultSettings;
    }

    try {
      // Get Gemini API key
      const { data: geminiData } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', 'gemini_api_key')
        .single();

      // Get all sites
      const { data: sitesData } = await this.supabase
        .from('wordpress_sites')
        .select('*')
        .order('created_at', { ascending: false });

      return {
        geminiKey: geminiData?.value || '',
        sites: sitesData?.map(site => ({
          id: site.id,
          name: site.name,
          url: site.url,
          username: site.username,
          password: site.password
        })) || []
      };
    } catch (error) {
      console.error('Error loading settings from Supabase:', error);
      return this.defaultSettings;
    }
  }

  async saveSettings(settings) {
    if (!this.supabase) {
      return false;
    }

    try {
      // Update Gemini API key
      if (settings.geminiKey !== undefined) {
        await this.supabase
          .from('settings')
          .upsert({ key: 'gemini_api_key', value: settings.geminiKey });
      }

      return true;
    } catch (error) {
      console.error('Error saving settings to Supabase:', error);
      return false;
    }
  }

  async getGeminiKey() {
    if (!this.supabase) {
      return '';
    }

    try {
      const { data } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', 'gemini_api_key')
        .single();

      return data?.value || '';
    } catch (error) {
      console.error('Error getting Gemini key:', error);
      return '';
    }
  }

  async setGeminiKey(key) {
    if (!this.supabase) {
      return false;
    }

    try {
      const { error } = await this.supabase
        .from('settings')
        .upsert({ key: 'gemini_api_key', value: key });

      return !error;
    } catch (error) {
      console.error('Error setting Gemini key:', error);
      return false;
    }
  }

  async getSites() {
    if (!this.supabase) {
      return [];
    }

    try {
      const { data } = await this.supabase
        .from('wordpress_sites')
        .select('*')
        .order('created_at', { ascending: false });

      return data?.map(site => ({
        id: site.id,
        name: site.name,
        url: site.url,
        username: site.username,
        password: site.password
      })) || [];
    } catch (error) {
      console.error('Error getting sites:', error);
      return [];
    }
  }

  async addSite(site) {
    if (!this.supabase) {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('wordpress_sites')
        .insert({
          name: site.name,
          url: site.url,
          username: site.username,
          password: site.password
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding site:', error);
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        url: data.url,
        username: data.username,
        password: data.password
      };
    } catch (error) {
      console.error('Error adding site:', error);
      return null;
    }
  }

  async updateSite(siteId, updatedSite) {
    if (!this.supabase) {
      return false;
    }

    try {
      const { error } = await this.supabase
        .from('wordpress_sites')
        .update({
          name: updatedSite.name,
          url: updatedSite.url,
          username: updatedSite.username,
          password: updatedSite.password
        })
        .eq('id', siteId);

      return !error;
    } catch (error) {
      console.error('Error updating site:', error);
      return false;
    }
  }

  async removeSite(siteId) {
    if (!this.supabase) {
      return false;
    }

    try {
      const { error } = await this.supabase
        .from('wordpress_sites')
        .delete()
        .eq('id', siteId);

      return !error;
    } catch (error) {
      console.error('Error removing site:', error);
      return false;
    }
  }

  async getSiteById(siteId) {
    if (!this.supabase) {
      return null;
    }

    try {
      const { data } = await this.supabase
        .from('wordpress_sites')
        .select('*')
        .eq('id', siteId)
        .single();

      if (!data) return null;

      return {
        id: data.id,
        name: data.name,
        url: data.url,
        username: data.username,
        password: data.password
      };
    } catch (error) {
      console.error('Error getting site by ID:', error);
      return null;
    }
  }

  // Backup and restore functions (export/import JSON)
  async backupSettings() {
    try {
      const settings = await this.loadSettings();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backup = {
        timestamp,
        settings
      };
      return JSON.stringify(backup, null, 2);
    } catch (error) {
      console.error('Error creating backup:', error);
      return null;
    }
  }

  async restoreSettings(backupJson) {
    if (!this.supabase) {
      return false;
    }

    try {
      const backup = JSON.parse(backupJson);
      const { settings } = backup;

      // Restore Gemini key
      if (settings.geminiKey) {
        await this.setGeminiKey(settings.geminiKey);
      }

      // Restore sites
      if (settings.sites && Array.isArray(settings.sites)) {
        // Clear existing sites
        await this.supabase.from('wordpress_sites').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // Add all sites from backup
        for (const site of settings.sites) {
          await this.addSite(site);
        }
      }

      return true;
    } catch (error) {
      console.error('Error restoring backup:', error);
      return false;
    }
  }

  async clearSettings() {
    if (!this.supabase) {
      return false;
    }

    try {
      // Clear Gemini key
      await this.setGeminiKey('');

      // Clear all sites
      await this.supabase.from('wordpress_sites').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      return true;
    } catch (error) {
      console.error('Error clearing settings:', error);
      return false;
    }
  }
}

export { SettingsManager };
