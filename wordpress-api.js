import axios from "axios";
import FormData from "form-data";
import fs from "fs";

export class WordPressAPI {
  constructor(siteUrl, username, password) {
    this.siteUrl = siteUrl.replace(/\/$/, "");
    this.username = username;
    this.password = password;
    this.authHeader = {
      Authorization: "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
    };
  }

  async createPost(title, content, tags, featuredMediaId = null, scheduleTime = null) {
    try {
      const tagIds = await this.createTags(tags);
      
      const postData = {
        title: title,
        content: content,
        status: scheduleTime ? "future" : "publish",
        tags: tagIds,
        format: "standard",
      };

      if (featuredMediaId) {
        postData.featured_media = featuredMediaId;
      }

      // Set scheduled publish time
      if (scheduleTime) {
        postData.date = new Date(scheduleTime).toISOString();
      }

      const response = await axios.post(
        `${this.siteUrl}/wp-json/wp/v2/posts`,
        postData,
        { headers: this.authHeader }
      );

      return response.data.id;
    } catch (error) {
      console.error("Error creating post:", error.response?.data || error.message);
      throw error;
    }
  }

  async createTags(tagNames) {
    const tagIds = [];

    for (const tagName of tagNames) {
      try {
        const searchResponse = await axios.get(
          `${this.siteUrl}/wp-json/wp/v2/tags`,
          {
            params: { search: tagName },
            headers: this.authHeader,
          }
        );

        let tagId;
        if (searchResponse.data.length > 0) {
          tagId = searchResponse.data[0].id;
        } else {
          const createResponse = await axios.post(
            `${this.siteUrl}/wp-json/wp/v2/tags`,
            { name: tagName },
            { headers: this.authHeader }
          );
          tagId = createResponse.data.id;
        }

        tagIds.push(tagId);
      } catch (error) {
        console.error(`Error creating tag "${tagName}":`, error.message);
      }
    }

    return tagIds;
  }

  async uploadMedia(filePath) {
    try {
      const form = new FormData();
      form.append("file", fs.createReadStream(filePath));
      
      const fileName = filePath.split("/").pop();
      
      const response = await axios.post(
        `${this.siteUrl}/wp-json/wp/v2/media`,
        form,
        {
          headers: {
            ...this.authHeader,
            ...form.getHeaders(),
            "Content-Disposition": `attachment; filename="${fileName}"`,
          },
        }
      );

      console.log('Media upload response:', response.data.id);
      return response.data.id;
    } catch (error) {
      console.error("Error uploading media:", error.response?.data || error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await axios.get(
        `${this.siteUrl}/wp-json/wp/v2/users/me`,
        { headers: this.authHeader }
      );
      console.log("✅ WordPress connection successful!");
      console.log(`👤 Logged in as: ${response.data.name}`);
      return true;
    } catch (error) {
      console.error("❌ WordPress connection failed:", error.message);
      return false;
    }
  }
}