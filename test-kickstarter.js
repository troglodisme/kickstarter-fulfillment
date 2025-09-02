require('dotenv').config();

console.log('🧪 Testing Kickstarter Fulfillment Configuration...');
console.log('✅ Shopify Shop:', process.env.SHOPIFY_SHOP);
console.log('✅ Access Token Length:', process.env.SHOPIFY_ACCESS_TOKEN ? process.env.SHOPIFY_ACCESS_TOKEN.length : 'MISSING');
console.log('✅ Base URL:', process.env.BASE_URL || 'http://localhost:3000');

// Test CSV files exist
const fs = require('fs');
const csvFiles = [
  './data/kickstarter.csv',
  './data/kickstarter-real-sample.csv'
];

csvFiles.forEach(csvPath => {
  if (fs.existsSync(csvPath)) {
    const stats = fs.statSync(csvPath);
    console.log(`✅ ${csvPath} found (${stats.size} bytes)`);
    
    if (stats.size > 0) {
      // Read first few lines to validate structure
      const content = fs.readFileSync(csvPath, 'utf8');
      const lines = content.split('\n');
      
      if (lines.length > 0) {
        const headers = lines[0].split(',');
        console.log(`   📊 Headers: ${headers.length} columns`);
        
        // Check for expected Kickstarter columns
        const expectedColumns = ['Backer Name', 'Email', 'Pledge Amount', 'ambientone Count'];
        const hasExpectedColumns = expectedColumns.every(col => 
          headers.some(header => header.includes(col))
        );
        
        if (hasExpectedColumns) {
          console.log(`   ✅ Kickstarter format detected`);
        } else {
          console.log(`   ⚠️  Might not be Kickstarter format`);
        }
        
        if (lines.length > 1) {
          console.log(`   📋 Data rows: ${lines.length - 1}`);
        }
      }
    } else {
      console.log(`   ⚠️  ${csvPath} is empty`);
    }
  } else {
    console.log(`❌ ${csvPath} not found`);
  }
});

// Test Shopify connection
async function testShopifyConnection() {
  if (!process.env.SHOPIFY_SHOP || !process.env.SHOPIFY_ACCESS_TOKEN) {
    console.log('❌ Missing Shopify credentials');
    return;
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`https://${process.env.SHOPIFY_SHOP}.myshopify.com/admin/api/2023-10/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Shopify connection successful');
      console.log('🏪 Store:', data.shop.name);
      console.log('📧 Store email:', data.shop.email);
      console.log('🌍 Domain:', data.shop.domain);
      console.log('💰 Currency:', data.shop.currency);
    } else {
      console.log('❌ Shopify connection failed:', response.status, response.statusText);
      if (response.status === 401) {
        console.log('   Check your SHOPIFY_ACCESS_TOKEN');
      }
      if (response.status === 404) {
        console.log('   Check your SHOPIFY_SHOP name');
      }
    }
  } catch (error) {
    console.log('❌ Shopify connection error:', error.message);
  }
}

// Test SKU mapping
function testSKUMapping() {
  console.log('\n🔧 SKU Mapping Test:');
  console.log('The system will map these Kickstarter items to Shopify SKUs:');
  
  const SKU_MAPPING = {
    'ambientone': 'AMBIENT-ONE-001',
    'blackanodising': 'BLACK-ANODISE-001', 
    'accessoriespack': 'ACCESSORIES-001',
    'usbccable': 'USB-CABLE-001',
    'poweradaptor': 'POWER-ADAPTER-001',
    'chargingdock': 'CHARGING-DOCK-001',
    'SFA30formaldehydesensor': 'SFA30-SENSOR-001',
    'AmbientWorksPoster': 'POSTER-001',
    'ambientoneDIY': 'AMBIENT-DIY-001',
    '1xambientworks': 'AMBIENT-WORKS-001',
    'CustomEngraving': 'ENGRAVING-001'
  };
  
  Object.entries(SKU_MAPPING).forEach(([kickstarterItem, shopifySku]) => {
    console.log(`   ${kickstarterItem} → ${shopifySku}`);
  });
  
  console.log('\n⚠️  Make sure these SKUs match your actual Shopify product SKUs!');
  console.log('   Update the SKU_MAPPING in app-kickstarter.js if needed.');
}

// Run tests
console.log('\n🔌 Testing Shopify Connection...');
testShopifyConnection().then(() => {
  testSKUMapping();
  console.log('\n🧪 Configuration test complete!');
  console.log('\n🚀 Next steps:');
  console.log('1. Verify your SKU mapping above matches your Shopify products');
  console.log('2. Place your full Kickstarter CSV in ./data/kickstarter.csv');
  console.log('3. Run: node app-kickstarter.js');
  console.log('4. POST to: http://localhost:3000/process');
});
