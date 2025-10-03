import dotenv from "dotenv";
import { WordPressAPI } from "./wordpress-api.js";

dotenv.config();

async function testConnection() {
  console.log("🔍 Testing WordPress Connection");
  console.log("================================\n");
  
  console.log("Configuration:");
  console.log(`URL: ${process.env.WORDPRESS_URL}`);
  console.log(`Username: ${process.env.WORDPRESS_USERNAME}`);
  console.log(`Password: ${process.env.WORDPRESS_PASSWORD ? '***' : 'NOT SET'}\n`);

  const wordpress = new WordPressAPI(
    process.env.WORDPRESS_URL,
    process.env.WORDPRESS_USERNAME,
    process.env.WORDPRESS_PASSWORD
  );

  await wordpress.testConnection();
}

testConnection();