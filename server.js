import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "node:fs";
import { WordPressAPI } from "./wordpress-api.js";
import { SettingsManager } from "./settings-manager.js";
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize settings manager
const settingsManager = new SettingsManager();

// Validate environment variables on startup
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ CRITICAL: Missing environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize settings on startup
settingsManager.initializeSettings().catch(err => {
  console.error('❌ Error initializing settings:', err);
  process.exit(1);
});

class PostGenerator {
  constructor() {
    // AI will be initialized with provided key
    this.ai = null;
  }
  
  initializeAI(apiKey) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generatePostContent(topic, linkUrl = null, isInternal = false, moneySiteKeyword = null) {
    console.log('generatePostContent called with:', { topic, linkUrl, isInternal, moneySiteKeyword });
    const linkInstruction = linkUrl ? `
    6. ใส่ลิงค์ไปยัง ${isInternal ? 'หน้าภายในเว็บ' : 'Money Site'}: ${linkUrl} 
       ${moneySiteKeyword ? 
       `- ใช้ anchor text ที่เกี่ยวข้องกับ: "${moneySiteKeyword}"
       - หาคำหรือวลีในเนื้อหาที่เกี่ยวข้องกับ "${moneySiteKeyword}" เพื่อใช้เป็น anchor text
       - ตัวอย่าง: ถ้า keyword คือ "การทำ SEO" ให้หาคำว่า "เทคนิค SEO", "วิธีทำ SEO", "การปรับปรุง SEO" ฯลฯ` :
       `- สำคัญมาก: เลือก anchor text จากคำหรือวลีในเนื้อหาที่เกี่ยวข้องกับหัวข้อของบทความ
       - ใช้คำที่เหมาะสมกับบริบท เช่น ถ้าบทความเกี่ยวกับการตลาด ให้ใช้คำที่เกี่ยวกับการตลาด`}
       - ใช้คำที่ปรากฏในเนื้อหาจริง อย่าใส่คำที่ไม่เกี่ยวข้อง
       - รูปแบบ: <a href="${linkUrl}"${isInternal ? '' : ' target="_blank"'}>anchor text ที่เกี่ยวข้อง</a>
       - ห้ามใช้คำทั่วไปเช่น "คลิกที่นี่", "อ่านเพิ่มเติม" 
       - ใส่เพียง 1 ลิงค์ในตำแหน่งที่เนื้อหาเชื่อมโยงกันอย่างเป็นธรรมชาติ
    ` : '';

    const prompt = `
    คุณคือผู้เชี่ยวชาญด้าน SEO และ Content Marketing 
    สร้างบทความ WordPress ในหัวข้อ: "${topic}"
    
    กรุณาสร้างเนื้อหาในรูปแบบ JSON ดังนี้:
    {
      "title": "หัวข้อที่ดึงดูดและ SEO friendly",
      "content": "เนื้อหา HTML ที่มีการจัดรูปแบบ พร้อม **ตัวหนา** สำหรับคีย์เวิร์ดสำคัญ ใช้ <strong> tag",
      "tags": ["tag1", "tag2", "tag3"],
      "meta_description": "คำอธิบายสั้นๆ สำหรับ SEO"
    }
    
    ข้อกำหนด:
    1. เนื้อหาต้องยาวอย่างน้อย 800 คำ
    2. ใช้หัวข้อย่อย H2, H3 อย่างเหมาะสม
    3. เน้นคีย์เวิร์ดที่เกี่ยวข้องด้วย <strong> tag
    4. เขียนให้อ่านง่าย น่าสนใจ และให้ข้อมูลที่มีประโยชน์
    5. ใส่ลิงค์ภายในเว็บโดยใช้ <a> tag แบบ HTML ปกติ${linkInstruction}
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
      });

      const text = response.candidates[0].content.parts[0].text;
      
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          // Clean up common JSON issues
          let cleanJson = jsonMatch[0]
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
            .replace(/\n/g, '\\n') // Escape newlines properly
            .replace(/\r/g, '\\r'); // Escape carriage returns
          
          return JSON.parse(cleanJson);
        } catch (parseError) {
          console.error("JSON Parse Error:", parseError);
          console.error("Raw text:", text);
          console.error("Extracted JSON:", jsonMatch[0]);
          
          // Fallback: Try to create a valid response manually
          const titleMatch = text.match(/"title"\s*:\s*"([^"]+)"/);
          const contentMatch = text.match(/"content"\s*:\s*"([\s\S]+?)"\s*,\s*"tags"/);
          const tagsMatch = text.match(/"tags"\s*:\s*\[(.*?)\]/);
          
          if (titleMatch && contentMatch) {
            return {
              title: titleMatch[1],
              content: contentMatch[1].replace(/\\n/g, '\n'),
              tags: tagsMatch ? JSON.parse(`[${tagsMatch[1]}]`) : ["SEO", "WordPress", topic],
              meta_description: `บทความเกี่ยวกับ ${topic}`
            };
          }
        }
      }
      throw new Error("Invalid JSON response from AI");
    } catch (error) {
      console.error("Error generating content:", error);
      throw error;
    }
  }

  async generateFeaturedImage(topic, postTitle) {
    const imagePrompt = `
    Create a professional, high-quality featured image for a blog post titled: "${postTitle}"
    Topic: ${topic}
    Style: Modern, clean, professional blog header image
    Include subtle visual elements related to the topic
    Optimized for web display, 16:9 aspect ratio
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation",
        contents: imagePrompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageData = part.inlineData.data;
          const buffer = Buffer.from(imageData, "base64");
          const fileName = `featured-image-${Date.now()}.png`;
          const filePath = path.join(__dirname, 'public', 'images', fileName);
          
          // Create images directory if it doesn't exist
          if (!fs.existsSync(path.join(__dirname, 'public', 'images'))) {
            fs.mkdirSync(path.join(__dirname, 'public', 'images'), { recursive: true });
          }
          
          fs.writeFileSync(filePath, buffer);
          return { fileName, filePath };
        }
      }
    } catch (error) {
      console.error("Error generating image:", error);
      return null;
    }
  }
}

const generator = new PostGenerator();

// Health check endpoint for Render deployment
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Settings endpoints
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await settingsManager.loadSettings();
    // Don't send passwords to frontend for security
    const safeSites = settings.sites.map(site => ({
      id: site.id,
      name: site.name,
      url: site.url,
      username: site.username
      // password excluded
    }));

    res.json({
      geminiKey: settings.geminiKey ? '***SET***' : '', // Don't send actual key
      sites: safeSites,
      siteCount: safeSites.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings/gemini', async (req, res) => {
  try {
    const { geminiKey } = req.body;
    const success = await settingsManager.setGeminiKey(geminiKey);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings/sites', async (req, res) => {
  try {
    const { name, url, username, password } = req.body;
    const site = await settingsManager.addSite({ name, url, username, password });

    if (site) {
      res.json({
        success: true,
        site: {
          id: site.id,
          name: site.name,
          url: site.url,
          username: site.username
        }
      });
    } else {
      res.status(500).json({ error: 'Failed to save site' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/settings/sites/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await settingsManager.removeSite(id);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Backup and restore endpoints
app.post('/api/settings/backup', async (req, res) => {
  try {
    const backupJson = await settingsManager.backupSettings();
    if (backupJson) {
      res.json({ success: true, backup: backupJson });
    } else {
      res.status(500).json({ error: 'Failed to create backup' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings/restore', async (req, res) => {
  try {
    const { backupJson } = req.body;
    const success = await settingsManager.restoreSettings(backupJson);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings/clear', async (req, res) => {
  try {
    // Clear all settings
    await settingsManager.clearSettings();

    res.json({ success: true, message: 'Settings cleared successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/test-site', async (req, res) => {
  try {
    const { url, username, password } = req.body;
    
    const wordpress = new WordPressAPI(url, username, password);
    const isConnected = await wordpress.testConnection();
    
    res.json({ success: isConnected });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { topic, generateImage, autoPublish, siteId, scheduleTime, includeMoneySite, isInternalLink, moneySiteUrl, moneySiteKeyword, internalPath, multisitePost, selectedMultisites, bulkPost, bulkTopics, bulkDelay } = req.body;

    if (!topic && !bulkPost) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    if (bulkPost && (!bulkTopics || bulkTopics.length === 0)) {
      return res.status(400).json({ error: 'Bulk topics are required for bulk posting' });
    }

    // Get Gemini key from settings
    const geminiKey = await settingsManager.getGeminiKey();
    if (!geminiKey) {
      return res.status(400).json({ error: 'Gemini API Key not configured. Please set it in settings.' });
    }

    // Get sites from settings
    const sites = await settingsManager.getSites();
    
    // Initialize AI with provided key
    generator.initializeAI(geminiKey);

    // Handle bulk posting with multisite
    if (bulkPost && bulkTopics && multisitePost && selectedMultisites && selectedMultisites.length > 0) {
      const selectedSites = sites.filter(site => selectedMultisites.includes(site.id));
      const results = [];
      const delay = bulkDelay || 10;
      
      for (let topicIndex = 0; topicIndex < bulkTopics.length; topicIndex++) {
        const currentTopic = bulkTopics[topicIndex].trim();
        if (!currentTopic) continue;
        
        for (let siteIndex = 0; siteIndex < selectedSites.length; siteIndex++) {
          const site = selectedSites[siteIndex];
          
          try {
            let linkUrl = null;
            if (includeMoneySite) {
              if (isInternalLink) {
                linkUrl = internalPath ? `${site.url}${internalPath}` : site.url;
              } else {
                linkUrl = moneySiteUrl;
              }
            }
            
            const postData = await generator.generatePostContent(currentTopic, linkUrl, isInternalLink, moneySiteKeyword);
            
            let imageInfo = null;
            if (generateImage) {
              imageInfo = await generator.generateFeaturedImage(currentTopic, postData.title);
            }

            let publishResult = null;
            if (autoPublish || scheduleTime) {
              try {
                const wordpress = new WordPressAPI(site.url, site.username, site.password);
                
                let featuredImageId = null;
                if (imageInfo) {
                  featuredImageId = await wordpress.uploadMedia(imageInfo.filePath);
                }

                const postId = await wordpress.createPost(
                  postData.title,
                  postData.content,
                  postData.tags,
                  featuredImageId,
                  scheduleTime
                );

                publishResult = {
                  success: true,
                  postId,
                  url: `${site.url}/?p=${postId}`,
                  siteName: site.name,
                  scheduled: !!scheduleTime,
                  scheduledTime: scheduleTime
                };
              } catch (error) {
                publishResult = {
                  success: false,
                  error: error.message,
                  siteName: site.name
                };
              }
            }
            
            results.push({
              topic: currentTopic,
              site: site.name,
              postData,
              imageUrl: imageInfo ? `/images/${imageInfo.fileName}` : null,
              publishResult,
              topicIndex: topicIndex + 1,
              siteIndex: siteIndex + 1
            });
            
            // Add delay between posts
            if (topicIndex < bulkTopics.length - 1 || siteIndex < selectedSites.length - 1) {
              await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }
            
          } catch (error) {
            results.push({
              topic: currentTopic,
              site: site.name,
              error: error.message,
              topicIndex: topicIndex + 1,
              siteIndex: siteIndex + 1
            });
          }
        }
      }
      
      return res.json({
        bulk: true,
        multisite: true,
        results,
        totalTopics: bulkTopics.length,
        totalSites: selectedSites.length,
        totalProcessed: results.length,
        delayUsed: delay
      });
    }
    
    // Handle bulk posting (single site)
    if (bulkPost && bulkTopics) {
      const selectedSite = sites.find(s => s.id === siteId);
      
      if (!selectedSite) {
        return res.status(400).json({ error: 'Selected site not found' });
      }
      
      const results = [];
      const delay = bulkDelay || 10; // Default 10 seconds
      
      for (let i = 0; i < bulkTopics.length; i++) {
        const currentTopic = bulkTopics[i].trim();
        
        if (!currentTopic) continue;
        
        try {
          // Generate unique content for each topic
          let linkUrl = null;
          if (includeMoneySite) {
            if (isInternalLink) {
              linkUrl = internalPath ? `${selectedSite.url}${internalPath}` : selectedSite.url;
            } else {
              linkUrl = moneySiteUrl;
            }
          }
          
          const postData = await generator.generatePostContent(currentTopic, linkUrl, isInternalLink, moneySiteKeyword);
          
          let imageInfo = null;
          if (generateImage) {
            imageInfo = await generator.generateFeaturedImage(currentTopic, postData.title);
          }

          let publishResult = null;
          
          // Publish to the selected site
          if (autoPublish) {
            try {
              const wordpress = new WordPressAPI(selectedSite.url, selectedSite.username, selectedSite.password);
              
              let featuredImageId = null;
              if (imageInfo) {
                featuredImageId = await wordpress.uploadMedia(imageInfo.filePath);
              }

              const postId = await wordpress.createPost(
                postData.title,
                postData.content,
                postData.tags,
                featuredImageId,
                null
              );

              publishResult = {
                success: true,
                postId,
                url: `${selectedSite.url}/?p=${postId}`,
                siteName: selectedSite.name
              };
            } catch (error) {
              publishResult = {
                success: false,
                error: error.message,
                siteName: selectedSite.name
              };
            }
          }
          
          results.push({
            topic: currentTopic,
            postData,
            imageUrl: imageInfo ? `/images/${imageInfo.fileName}` : null,
            publishResult,
            index: i + 1
          });
          
          // Add delay between posts (except for the last one)
          if (i < bulkTopics.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay * 1000));
          }
          
        } catch (error) {
          results.push({
            topic: currentTopic,
            error: error.message,
            index: i + 1
          });
        }
      }
      
      return res.json({
        bulk: true,
        results,
        totalProcessed: results.length,
        delayUsed: delay
      });
    }

    // Handle multisite posting
    if (multisitePost && selectedMultisites && selectedMultisites.length > 0) {
      const selectedSites = sites.filter(site => selectedMultisites.includes(site.id));
      
      const results = [];
      
      for (let i = 0; i < selectedSites.length; i++) {
        const site = selectedSites[i];
        
        // Generate unique content for each site
        let linkUrl = null;
        if (includeMoneySite) {
          if (isInternalLink) {
            // If internalPath is empty, link to main domain
            linkUrl = internalPath ? `${site.url}${internalPath}` : site.url;
          } else {
            linkUrl = moneySiteUrl;
          }
        }
        
        const postData = await generator.generatePostContent(topic, linkUrl, isInternalLink, moneySiteKeyword);
        
        let imageInfo = null;
        if (generateImage) {
          imageInfo = await generator.generateFeaturedImage(topic, postData.title);
        }

        let publishResult = null;
        
        // Publish to this site
        if (autoPublish || scheduleTime) {
          try {
            const wordpress = new WordPressAPI(site.url, site.username, site.password);
            
            let featuredImageId = null;
            if (imageInfo) {
              featuredImageId = await wordpress.uploadMedia(imageInfo.filePath);
              console.log(`Uploaded image for ${site.name}, featuredImageId: ${featuredImageId}`);
            }

            const postId = await wordpress.createPost(
              postData.title,
              postData.content,
              postData.tags,
              featuredImageId,
              scheduleTime // Support scheduling for multisite
            );
            console.log(`Created post for ${site.name}, postId: ${postId}, with image: ${featuredImageId}`);

            publishResult = {
              success: true,
              postId,
              url: `${site.url}/?p=${postId}`,
              siteName: site.name,
              scheduled: !!scheduleTime,
              scheduledTime: scheduleTime
            };
          } catch (error) {
            publishResult = {
              success: false,
              error: error.message,
              siteName: site.name
            };
          }
        }
        
        results.push({
          site: site.name,
          postData,
          imageUrl: imageInfo ? `/images/${imageInfo.fileName}` : null,
          publishResult
        });
      }
      
      return res.json({
        multisite: true,
        results
      });
    }

    // Single site posting (original logic)
    // Generate content
    let linkUrl = null;
    if (includeMoneySite) {
      if (isInternalLink) {
        // Get the selected site's URL for internal linking
        const site = sites.find(s => s.id === siteId);
        if (site) {
          // If internalPath is empty, link to main domain
          linkUrl = internalPath ? `${site.url}${internalPath}` : site.url;
        }
      } else {
        linkUrl = moneySiteUrl;
      }
    }
    
    const postData = await generator.generatePostContent(topic, linkUrl, isInternalLink, moneySiteKeyword);
    
    let imageInfo = null;
    if (generateImage) {
      imageInfo = await generator.generateFeaturedImage(topic, postData.title);
    }

    let publishResult = null;
    
    // Handle immediate or scheduled publishing
    if ((autoPublish || scheduleTime) && siteId) {
      try {
        const site = sites.find(s => s.id === siteId);
        
        if (!site) {
          throw new Error('Selected site not found');
        }
        
        const wordpress = new WordPressAPI(site.url, site.username, site.password);
        
        let featuredImageId = null;
        if (imageInfo) {
          featuredImageId = await wordpress.uploadMedia(imageInfo.filePath);
        }

        const postId = await wordpress.createPost(
          postData.title,
          postData.content,
          postData.tags,
          featuredImageId,
          scheduleTime
        );

        publishResult = {
          success: true,
          postId,
          url: `${site.url}/?p=${postId}`,
          scheduled: !!scheduleTime,
          scheduledTime: scheduleTime
        };
      } catch (error) {
        publishResult = {
          success: false,
          error: error.message
        };
      }
    }

    res.json({
      postData,
      imageUrl: imageInfo ? `/images/${imageInfo.fileName}` : null,
      publishResult
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log('📝 Please configure your settings in the web interface');
});