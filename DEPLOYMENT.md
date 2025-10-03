# Deployment Guide - WordPress AI SEO Automation

This guide will help you deploy the WordPress AI SEO Automation system to Netlify with Supabase as the database.

## Prerequisites

1. A GitHub account
2. A Netlify account (free tier works)
3. A Supabase account (free tier works)
4. A Gemini API key from Google AI Studio

## Step 1: Set Up Supabase Database

1. Go to [Supabase](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to be ready (1-2 minutes)
4. Go to the **SQL Editor** in the left sidebar
5. Copy the entire contents of `supabase-schema.sql` from this project
6. Paste it into the SQL Editor and click **Run**
7. Go to **Project Settings** > **API**
8. Copy these two values (you'll need them later):
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **service_role key** (NOT the anon key - click "Reveal" to see it)

## Step 2: Push Code to GitHub

1. Initialize git in your project directory:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - WordPress AI SEO Automation"
   ```

2. Create a new repository on GitHub (don't initialize with README)

3. Push your code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

## Step 3: Deploy to Netlify

1. Go to [Netlify](https://netlify.com) and sign in
2. Click **Add new site** > **Import an existing project**
3. Choose **GitHub** and authorize Netlify to access your repositories
4. Select your repository
5. Configure build settings:
   - **Build command**: `npm install`
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`

6. Click **Show advanced** and add environment variables:
   - `SUPABASE_URL`: Your Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service_role key
   - `PORT`: `3004` (optional, defaults to 3004)

7. Click **Deploy site**

## Step 4: Configure Your Domain

1. Once deployed, Netlify will give you a URL like: `https://random-name-123456.netlify.app`
2. (Optional) You can:
   - Change the subdomain: Go to **Site settings** > **Domain management** > **Options** > **Edit site name**
   - Add a custom domain: Go to **Domain management** > **Add custom domain**

## Step 5: Use Your Application

1. Visit your Netlify URL
2. Go to the **Settings** page
3. Add your **Gemini API Key** (get it from [Google AI Studio](https://aistudio.google.com/apikey))
4. Add your WordPress sites:
   - Site Name (e.g., "My Blog")
   - WordPress URL (e.g., "https://myblog.com")
   - Username
   - Application Password (create in WordPress Admin > Users > Profile > Application Passwords)

5. Start generating content!

## Updating Your Deployment

To update your deployed application:

```bash
git add .
git commit -m "Description of changes"
git push
```

Netlify will automatically rebuild and deploy your site.

## Troubleshooting

### Database Connection Issues
- Verify your Supabase environment variables are correct
- Make sure you ran the SQL schema in Supabase
- Check that you're using the service_role key, not the anon key

### Build Failures
- Check the Netlify deploy logs
- Ensure all dependencies are in package.json
- Verify Node.js version compatibility

### WordPress Connection Issues
- Verify you're using WordPress Application Passwords, not regular passwords
- Check that the WordPress REST API is enabled
- Ensure the WordPress URL is correct (with https://)

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (NOT anon key) | Yes |
| `PORT` | Server port (default: 3004) | No |

## Security Notes

- Never commit `.env` files to GitHub
- Use environment variables for all sensitive data
- The service_role key should only be used server-side
- WordPress Application Passwords are stored encrypted in Supabase
- Always use HTTPS in production

## Support

For issues or questions:
- Check the main README.md
- Review Netlify deploy logs
- Check Supabase dashboard for database errors
- Ensure all environment variables are set correctly
