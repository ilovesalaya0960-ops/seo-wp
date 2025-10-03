# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm start` - Run the CLI tool for single post generation (index.js)
- `npm run server` - Start the web server on port 3004 (server.js)
- `npm run server:dev` - Start the web server with auto-reload on file changes
- `npm run dev` - Run the CLI tool with auto-reload

### Testing
- `node test-connection.js` - Test WordPress API connection using environment variables

### Dependencies
- `npm install` - Install all dependencies

## Architecture Overview

This is a WordPress content automation system that uses Google's Gemini AI to generate SEO-optimized content. The system has two main interfaces:

1. **CLI Interface** (index.js) - Interactive command-line tool for single post generation
2. **Web Interface** (server.js) - Express server with web UI for managing settings and generating posts

### Core Components

- **wordpress-api.js**: WordPress REST API wrapper for creating posts, tags, and uploading media
- **settings-manager.js**: Manages application settings (API keys, WordPress sites) with file-based storage
- **server.js**: Express server providing REST API endpoints and serving the web interface
- **index.js**: CLI tool for interactive post generation

### Key Features

- Multi-site WordPress management
- Bulk post generation with configurable delays
- Scheduled post publishing
- Featured image generation using Gemini's image model
- Internal and external link insertion (Money Site support)
- Settings backup/restore functionality

### API Endpoints (server.js)

- `GET /api/settings` - Get current settings (sanitized)
- `POST /api/settings/gemini` - Update Gemini API key
- `POST /api/settings/sites` - Add new WordPress site
- `DELETE /api/settings/sites/:id` - Remove WordPress site
- `POST /api/test-site` - Test WordPress connection
- `POST /api/generate` - Generate and optionally publish content
- `POST /api/settings/backup` - Create settings backup
- `POST /api/settings/restore` - Restore from backup

### Data Flow

1. User configures Gemini API key and WordPress sites via web interface
2. Settings are stored in `settings.json` (gitignored)
3. Content generation uses Gemini AI with SEO-focused prompts
4. Generated content can include internal/external links
5. Posts are published via WordPress REST API with optional scheduling

### WordPress Authentication

Uses WordPress Application Passwords (not regular passwords) for REST API authentication. Application Passwords can be generated in WordPress Admin > Users > Profile > Application Passwords.