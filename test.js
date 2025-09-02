require('dotenv').config();

console.log('🧪 Testing Configuration...');
console.log('✅ Shopify Shop:', process.env.SHOPIFY_SHOP);
console.log('✅ Access Token Length:', process.env.SHOPIFY_ACCESS_TOKEN ? process.env.SHOPIFY_ACCESS_TOKEN.length : 'MISSING');
console.log('✅ Base URL:', process.env.BASE_URL || 'http://localhost:3000');

// Test CSV exists
const fs = require('fs');
if (fs.existsSync('./data/kickstarter.csv')) {
  console.log('✅ CSV file found');
  
  // Check if CSV has content
  const stats = fs.statSync('./data/kickstarter.csv');
  if (stats.size > 0) {
    console.log('✅ CSV file has data');
  } else {
    console.log('⚠️  CSV file is empty');
  }
} else {
  console.log('❌ CSV file missing');
}

// Test Shopify connection
async function testShopifyConnection() {
  if (!process.env.SHOPIFY_SHOP || !process.env.SHOPIFY_ACCESS_TOKEN) {
    console.log('❌ Missing Shopify credentials');
    return;
  }

  try {
    const fetch = require('node-fetch');
    const response = await fetch(`https://${process.env.SHOPIFY_SHOP}.myshopify.com/admin/api/2023-10/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Shopify connection successful');
      console.log('🏪 Store:', data.shop.name);
    } else {
      console.log('❌ Shopify connection failed:', response.status);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }
  } catch (error) {
    console.log('❌ Shopify connection error:', error.message);
    console.log('💡 Tip: Make sure node-fetch is installed: npm install node-fetch');
  }
}

// Check if sample CSV exists
if (fs.existsSync('./data/kickstarter-sample.csv')) {
  console.log('✅ Sample CSV file found');
  console.log('💡 You can copy it to kickstarter.csv for testing:');
  console.log('   cp data/kickstarter-sample.csv data/kickstarter.csv');
} else {
  console.log('⚠️  No sample CSV file found');
}

// Run tests
testShopifyConnection().then(() => {
  console.log('\n🧪 Configuration test complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Copy sample data: cp data/kickstarter-sample.csv data/kickstarter.csv');
  console.log('2. Start server: npm run start-simple');
  console.log('3. Process customers: curl -X POST http://localhost:3000/process');
});