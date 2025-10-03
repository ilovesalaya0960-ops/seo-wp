import { GoogleGenAI, Modality } from "@google/genai";
import inquirer from "inquirer";
import * as fs from "node:fs";
import dotenv from "dotenv";
import { WordPressAPI } from "./wordpress-api.js";

dotenv.config();

class AIWordPressPostGenerator {
  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.wordpress = new WordPressAPI(
      process.env.WORDPRESS_URL,
      process.env.WORDPRESS_USERNAME,
      process.env.WORDPRESS_PASSWORD
    );
  }

  async generatePostContent(topic) {
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
    5. ใส่ internal linking placeholders เช่น [LINK: related-topic]
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
      });

      const text = response.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("Invalid JSON response");
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
          fs.writeFileSync(fileName, buffer);
          console.log(`✅ Featured image saved as ${fileName}`);
          return fileName;
        }
      }
    } catch (error) {
      console.error("Error generating image:", error);
      return null;
    }
  }

  async run() {
    console.log("🚀 WordPress AI Post Generator");
    console.log("================================\n");

    // Test WordPress connection first
    console.log("🔌 Testing WordPress connection...");
    const isConnected = await this.wordpress.testConnection();
    if (!isConnected) {
      console.log("\n❌ Cannot connect to WordPress. Please check:");
      console.log("1. WordPress URL is correct");
      console.log("2. You're using Application Password (not regular password)");
      console.log("3. REST API is enabled\n");
      console.log("📖 To create Application Password:");
      console.log("   1. Go to WordPress Admin > Users > Profile");
      console.log("   2. Scroll to 'Application Passwords'");
      console.log("   3. Enter a name and click 'Add New'");
      console.log("   4. Copy the password to .env file");
      return;
    }

    const questions = [
      {
        type: "input",
        name: "topic",
        message: "กรุณาใส่หัวข้อที่ต้องการสร้างบทความ:",
        validate: (input) => input.length > 0 || "กรุณาใส่หัวข้อ",
      },
      {
        type: "confirm",
        name: "generateImage",
        message: "ต้องการสร้าง Featured Image หรือไม่?",
        default: true,
      },
    ];

    const answers = await inquirer.prompt(questions);

    console.log("\n📝 กำลังสร้างเนื้อหา...");
    const postData = await this.generatePostContent(answers.topic);
    
    console.log("\n✅ สร้างเนื้อหาเสร็จสิ้น:");
    console.log(`📌 Title: ${postData.title}`);
    console.log(`🏷️  Tags: ${postData.tags.join(", ")}`);

    let featuredImagePath = null;
    if (answers.generateImage) {
      console.log("\n🖼️  กำลังสร้าง Featured Image...");
      featuredImagePath = await this.generateFeaturedImage(
        answers.topic,
        postData.title
      );
    }

    const publishQuestion = await inquirer.prompt([
      {
        type: "confirm",
        name: "publish",
        message: "ต้องการ publish ไปยัง WordPress ทันทีหรือไม่?",
        default: false,
      },
    ]);

    if (publishQuestion.publish) {
      console.log("\n📤 กำลัง publish ไปยัง WordPress...");
      
      try {
        let featuredImageId = null;
        if (featuredImagePath) {
          featuredImageId = await this.wordpress.uploadMedia(featuredImagePath);
        }

        const postId = await this.wordpress.createPost(
          postData.title,
          postData.content,
          postData.tags,
          featuredImageId
        );

        console.log(`\n✅ Publish สำเร็จ! Post ID: ${postId}`);
        console.log(`🔗 URL: ${process.env.WORDPRESS_URL}/?p=${postId}`);
      } catch (error) {
        console.error("❌ Error publishing to WordPress:", error.message);
      }
    } else {
      const fileName = `post-${Date.now()}.json`;
      fs.writeFileSync(fileName, JSON.stringify(postData, null, 2));
      console.log(`\n💾 บันทึกข้อมูลไว้ที่: ${fileName}`);
    }
  }
}

const generator = new AIWordPressPostGenerator();
generator.run().catch(console.error);