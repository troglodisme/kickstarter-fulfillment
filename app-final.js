require('dotenv').config();
const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.static('public'));
app.use(express.json());

// Configuration from environment variables
const CONFIG = {
  shopify: {
    shop: process.env.SHOPIFY_SHOP,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN
  },
  baseUrl: process.env.BASE_URL || 'http://localhost:3000'
};

// Smart variant mapping - combines base products with addons
const VARIANT_MAPPING = {
  // Ambient One variants
  'ambientone_black': {
    variantId: '52337643290957', // Black variant
    name: 'Ambient One (Black)',
    price: 139.00,
    requiresItems: ['ambientone', 'blackanodising']
  },
  'ambientone_gray': {
    variantId: '52337643323725', // Gray variant  
    name: 'Ambient One (Gray)',
    price: 139.00,
    requiresItems: ['ambientone']
  },
  
  // Combined products
  'charging_dock_sensor': {
    variantId: '52321245593933',
    name: 'Charging Dock + Formaldehyde Sensor',
    price: 72.00,
    requiresItems: ['chargingdock', 'SFA30formaldehydesensor']
  },
  
  // Standalone products
  'accessories': {
    variantId: '52321243267405',
    name: 'Accessories Pack',
    price: 22.00,
    requiresItems: ['accessoriespack']
  },
  'diy': {
    variantId: '52321244381517',
    name: 'Ambient One - DIY Version',
    price: 99.00,
    requiresItems: ['ambientoneDIY']
  },
  'poster': {
    variantId: '52321260994893',
    name: 'Ambient One Poster',
    price: 12.00,
    requiresItems: ['AmbientWorksPoster']
  },
  'charging_dock': {
    variantId: '52321269776717',
    name: 'Charging Dock',
    price: 45.00,
    requiresItems: ['chargingdock']
  },
  'power_adaptor': {
    variantId: '52321270792525',
    name: 'USB-C Power Adaptor',
    price: 10.00,
    requiresItems: ['poweradaptor']
  },
  'diy_kit': {
    variantId: '52321270235469',
    name: 'DIY Kit',
    price: 99.00,
    requiresItems: ['DIYKit']
  }
};

class KickstarterFulfillment {
  constructor() {
    this.customers = new Map();
    this.results = [];
  }

  // Load and parse Kickstarter CSV
  async loadKickstarterData(csvPath) {
    const customers = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          try {
            const customer = this.parseKickstarterRow(row);
            if (customer) {
              customers.push(customer);
              this.customers.set(customer.backerId, customer);
            }
          } catch (error) {
            console.error(`Error parsing row for ${row.Email}:`, error.message);
          }
        })
        .on('end', () => {
          console.log(`✅ Loaded ${customers.length} customers from Kickstarter export`);
          resolve(customers);
        })
        .on('error', reject);
    });
  }

  parseKickstarterRow(row) {
    // Skip if missing essential data
    if (!row.Email || !row['Backer Name'] || !row['Pledge Amount']) {
      return null;
    }

    // Parse pledge amount (remove currency symbols)
    const pledgeAmount = parseFloat(row['Pledge Amount'].replace(/[£$€,]/g, ''));
    
    // Extract items using smart mapping
    const pledgedItems = this.extractPledgedItemsSmart(row);
    
    const customer = {
      email: row.Email.trim(),
      name: row['Backer Name'].trim(),
      pledgeAmount: pledgeAmount,
      rewardTitle: row['Reward Title'] || '',
      pledgedItems: pledgedItems,
      kickstarterOrderId: row['Backer Number'],
      backerId: row['Backer UID'],
      shippingAddress: {
        name: row['Shipping Name'] || row['Backer Name'],
        address1: row['Shipping Address 1'] || '',
        address2: row['Shipping Address 2'] || '',
        city: row['Shipping City'] || '',
        province: row['Shipping State'] || '',
        zip: row['Shipping Postal Code'] || '',
        country: row['Shipping Country Name'] || row['Shipping Country'] || '',
        countryCode: row['Shipping Country Code'] || '',
        phone: row['Shipping Phone Number'] || ''
      },
      fulfillmentStatus: row['Fulfillment Status'] || '',
      pledgedAt: row['Pledged At (UTC)'] || '',
      customEngraving: row['ambientone ambient one engraving: We\'re exploring ways to personalise each unit.  Respond to this by 7th of August to potentially personalise your unit.  Provide a maximum of 14 characters inclusive of spacing.'] || ''
    };

    return customer;
  }

  extractPledgedItemsSmart(row) {
    const items = [];
    const counts = {};
    
    // Extract all count data from ACTUAL column names
    const countColumns = [
      'ambient one',
      'black anodising', 
      'accessories pack',
      'charging dock',
      'SFA30 formaldehyde sensor',
      'Ambient Works Poster',
      'ambient one - DIY version',
      'power adaptor'
    ];
    
    countColumns.forEach(col => {
      const quantity = parseInt(row[col]) || 0;
      if (quantity > 0) {
        // Normalize the key names for consistent mapping
        let key = col;
        if (col === 'ambient one') key = 'ambientone';
        if (col === 'black anodising') key = 'blackanodising';
        if (col === 'accessories pack') key = 'accessoriespack';
        if (col === 'charging dock') key = 'chargingdock';
        if (col === 'SFA30 formaldehyde sensor') key = 'SFA30formaldehydesensor';
        if (col === 'Ambient Works Poster') key = 'AmbientWorksPoster';
        if (col === 'ambient one - DIY version') key = 'ambientoneDIY';
        if (col === 'power adaptor') key = 'poweradaptor';
        
        counts[key] = quantity;
      }
    });

    console.log(`🔍 Processing ${row['Backer Name']}: counts =`, counts);

    // Smart mapping: Check for combinations first
    
    // 1. Ambient One + Black Anodising = Black Variant
    if (counts.ambientone && counts.blackanodising) {
      const used = Math.min(counts.ambientone, counts.blackanodising);
      items.push({
        name: 'Ambient One (Black)',
        variantId: '52337643290957',
        quantity: used,
        mappingType: 'variant_combination'
      });
      counts.ambientone -= used;
      counts.blackanodising -= used;
    }
    
    // 2. Charging Dock + Sensor = Combined Product
    if (counts.chargingdock && counts.SFA30formaldehydesensor) {
      const used = Math.min(counts.chargingdock, counts.SFA30formaldehydesensor);
      items.push({
        name: 'Charging Dock + Formaldehyde Sensor',
        variantId: '52321245593933',
        quantity: used,
        mappingType: 'product_combination'
      });
      counts.chargingdock -= used;
      counts.SFA30formaldehydesensor -= used;
    }
    
    // 3. Remaining Ambient One = Gray Variant
    if (counts.ambientone > 0) {
      items.push({
        name: 'Ambient One (Gray)',
        variantId: '52337643323725', 
        quantity: counts.ambientone,
        mappingType: 'variant_default'
      });
      counts.ambientone = 0;
    }

    // 4. Map remaining standalone items
    const standaloneMapping = {
      'accessoriespack': { variantId: '52321243267405', name: 'Accessories Pack' },
      'ambientoneDIY': { variantId: '52321244381517', name: 'Ambient One - DIY Version' },
      'AmbientWorksPoster': { variantId: '52321260994893', name: 'Ambient One Poster' },
      'chargingdock': { variantId: '52321269776717', name: 'Charging Dock' },
      'poweradaptor': { variantId: '52321270792525', name: 'USB-C Power Adaptor' }
    };

    Object.keys(counts).forEach(key => {
      if (counts[key] > 0 && standaloneMapping[key]) {
        items.push({
          name: standaloneMapping[key].name,
          variantId: standaloneMapping[key].variantId,
          quantity: counts[key],
          mappingType: 'standalone',
          originalKey: key
        });
      } else if (counts[key] > 0) {
        // Unmapped items - still include for reference
        items.push({
          name: this.formatProductName(key),
          variantId: null,
          quantity: counts[key],
          mappingType: 'unmapped',
          originalKey: key
        });
      }
    });

    return items;
  }

  formatProductName(key) {
    const nameMap = {
      'usbccable': 'USB-C Cable',
      'poweradaptor': 'Power Adaptor', 
      'chargingdock': 'Charging Dock',
      'SFA30formaldehydesensor': 'SFA30 Formaldehyde Sensor',
      'AmbientWorksPoster': 'Ambient Works Poster',
      '1xambientworks': '1x Ambient Works',
      'CustomEngraving': 'Custom Engraving'
    };
    
    return nameMap[key] || key;
  }

  // Create/find Shopify customer
  async createShopifyCustomer(customerData) {
    try {
      const fetch = (await import('node-fetch')).default;
      
      // Check if customer exists
      const searchUrl = `https://${CONFIG.shopify.shop}.myshopify.com/admin/api/2023-10/customers/search.json?query=email:${customerData.email}`;
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'X-Shopify-Access-Token': CONFIG.shopify.accessToken
        }
      });
      
      const searchResult = await searchResponse.json();
      if (searchResult.customers && searchResult.customers.length > 0) {
        console.log(`📧 Customer exists: ${customerData.email}`);
        return searchResult.customers[0];
      }

      // Create new customer
      const nameParts = customerData.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      const createUrl = `https://${CONFIG.shopify.shop}.myshopify.com/admin/api/2023-10/customers.json`;
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': CONFIG.shopify.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer: {
            email: customerData.email,
            first_name: firstName,
            last_name: lastName,
            tags: `kickstarter-backer,${customerData.rewardTitle.replace(/\s+/g, '-').toLowerCase()}`,
            note: `Kickstarter Backer - Order #${customerData.kickstarterOrderId} - ${customerData.rewardTitle}`,
            addresses: [{
              first_name: firstName,
              last_name: lastName,
              address1: customerData.shippingAddress.address1,
              address2: customerData.shippingAddress.address2,
              city: customerData.shippingAddress.city,
              province: customerData.shippingAddress.province,
              zip: customerData.shippingAddress.zip,
              country: customerData.shippingAddress.country,
              phone: customerData.shippingAddress.phone
            }]
          }
        })
      });

      const createResult = await createResponse.json();
      if (createResult.errors) {
        throw new Error(`Customer creation error: ${JSON.stringify(createResult.errors)}`);
      }
      
      console.log(`➕ Created customer: ${customerData.email}`);
      return createResult.customer;

    } catch (error) {
      console.error(`❌ Error with customer ${customerData.email}:`, error.message);
      throw error;
    }
  }

  // Create discount code
  async createDiscountCode(customer, shopifyCustomerId) {
    const discountCode = `KS${customer.kickstarterOrderId}_${Date.now().toString().slice(-6)}`;
    
    try {
      const fetch = (await import('node-fetch')).default;
      
      // Create price rule
      const priceRuleUrl = `https://${CONFIG.shopify.shop}.myshopify.com/admin/api/2023-10/price_rules.json`;
      const priceRuleResponse = await fetch(priceRuleUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': CONFIG.shopify.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          price_rule: {
            title: `Kickstarter Credit - ${customer.name} (Order #${customer.kickstarterOrderId})`,
            target_type: 'line_item',
            target_selection: 'all',
            allocation_method: 'across',
            value_type: 'fixed_amount',
            value: `-${customer.pledgeAmount.toFixed(2)}`,
            customer_selection: 'prerequisite',
            prerequisite_customer_ids: [shopifyCustomerId],
            usage_limit: 1,
            starts_at: new Date().toISOString(),
            ends_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
          }
        })
      });

      const priceRuleResult = await priceRuleResponse.json();
      
      if (priceRuleResult.errors) {
        throw new Error(`Price rule error: ${JSON.stringify(priceRuleResult.errors)}`);
      }

      // Create discount code
      const discountUrl = `https://${CONFIG.shopify.shop}.myshopify.com/admin/api/2023-10/price_rules/${priceRuleResult.price_rule.id}/discount_codes.json`;
      const discountResponse = await fetch(discountUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': CONFIG.shopify.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          discount_code: {
            code: discountCode
          }
        })
      });

      const discountResult = await discountResponse.json();
      if (discountResult.errors) {
        throw new Error(`Discount code error: ${JSON.stringify(discountResult.errors)}`);
      }
      
      console.log(`🎟️  Created discount: ${discountCode} for ${customer.email} (£${customer.pledgeAmount})`);
      return discountCode;

    } catch (error) {
      console.error(`❌ Discount creation failed for ${customer.email}:`, error.message);
      throw error;
    }
  }

  // Generate cart links with smart variant mapping
  generateCartLinks(customer) {
    try {
      const cartItems = [];
      const itemsNotFound = [];
      
      for (const item of customer.pledgedItems) {
        if (item.variantId) {
          cartItems.push(`${item.variantId}:${item.quantity}`);
          console.log(`✅ Mapped: ${item.name} → Variant ${item.variantId}`);
        } else {
          itemsNotFound.push(item);
          console.log(`⚠️  Unmapped: ${item.name} (${item.originalKey || 'unknown'})`);
        }
      }
      
      // Generate cart permalink
      const cartLink = cartItems.length > 0 
        ? `https://shop.ambientworks.io/cart/${cartItems.join(',')}`
        : `https://shop.ambientworks.io/cart`;
      
      // Generate checkout link with discount
      const checkoutLink = cartItems.length > 0
        ? `https://shop.ambientworks.io/cart/${cartItems.join(',')}?discount=${customer.discountCode}`
        : `https://shop.ambientworks.io/discount/${customer.discountCode}`;
      
      return {
        cartLink,
        checkoutLink,
        itemsFound: cartItems.length,
        totalItems: customer.pledgedItems.length,
        itemsNotFound: itemsNotFound
      };
      
    } catch (error) {
      console.error(`❌ Cart link generation failed for ${customer.email}:`, error.message);
      return {
        cartLink: `https://shop.ambientworks.io/cart`,
        checkoutLink: `https://shop.ambientworks.io/discount/${customer.discountCode}`,
        itemsFound: 0,
        totalItems: customer.pledgedItems.length,
        itemsNotFound: customer.pledgedItems
      };
    }
  }

  // Generate landing page URL
  generateLandingPageUrl(customer, discountCode) {
    const token = Buffer.from(`${customer.backerId}_${discountCode}`).toString('base64');
    return `${CONFIG.baseUrl}/fulfillment/${token}`;
  }

  // Main processing function
  async processAllCustomers(csvPath) {
    try {
      console.log('🚀 Starting Kickstarter fulfillment process...');
      console.log(`📄 Processing CSV: ${csvPath}`);
      
      // Load customer data
      const customers = await this.loadKickstarterData(csvPath);
      
      console.log(`\n📊 Summary:`);
      console.log(`- Total customers: ${customers.length}`);
      console.log(`- Unique reward tiers: ${[...new Set(customers.map(c => c.rewardTitle))].length}`);
      console.log(`- Total pledge amount: £${customers.reduce((sum, c) => sum + c.pledgeAmount, 0).toFixed(2)}`);
      
      for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        console.log(`\n📋 Processing ${i + 1}/${customers.length}: ${customer.email}`);
        console.log(`   Reward: ${customer.rewardTitle} (£${customer.pledgeAmount})`);
        console.log(`   Items: ${customer.pledgedItems.map(item => `${item.name} x${item.quantity}`).join(', ')}`);

        try {
          // Create Shopify customer
          const shopifyCustomer = await this.createShopifyCustomer(customer);
          
          // Create discount code
          const discountCode = await this.createDiscountCode(customer, shopifyCustomer.id);
          
          // Store discount code
          customer.discountCode = discountCode;
          customer.shopifyCustomerId = shopifyCustomer.id;
          
          // Generate cart links (no API calls needed)
          const cartLinks = this.generateCartLinks(customer);
          
          // Generate landing page URL
          const landingPageUrl = this.generateLandingPageUrl(customer, discountCode);
          
          // Store results
          const result = {
            email: customer.email,
            name: customer.name,
            pledgeAmount: customer.pledgeAmount,
            rewardTitle: customer.rewardTitle,
            discountCode: discountCode,
            landingPageUrl: landingPageUrl,
            cartLink: cartLinks.cartLink,
            checkoutLink: cartLinks.checkoutLink,
            itemsFoundInShopify: `${cartLinks.itemsFound}/${cartLinks.totalItems}`,
            itemsNotFound: cartLinks.itemsNotFound.map(item => `${item.name} (${item.originalKey || 'unmapped'})`).join(', '),
            kickstarterOrderId: customer.kickstarterOrderId,
            backerId: customer.backerId,
            customEngraving: customer.customEngraving,
            status: 'success'
          };
          
          this.results.push(result);
          customer.landingPageUrl = landingPageUrl;
          customer.cartLinks = cartLinks;
          
          console.log(`✅ Completed ${customer.email}`);
          console.log(`🔗 Landing: ${landingPageUrl}`);
          console.log(`🛒 Checkout: ${cartLinks.checkoutLink}`);
          if (cartLinks.itemsNotFound.length > 0) {
            console.log(`⚠️  Unmapped items: ${cartLinks.itemsNotFound.map(item => item.name).join(', ')}`);
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          console.error(`❌ Failed processing ${customer.email}:`, error.message);
          
          // Store error result
          this.results.push({
            email: customer.email,
            name: customer.name,
            pledgeAmount: customer.pledgeAmount,
            rewardTitle: customer.rewardTitle,
            kickstarterOrderId: customer.kickstarterOrderId,
            backerId: customer.backerId,
            status: 'error',
            error: error.message
          });
          
          continue;
        }
      }

      // Generate results CSV
      await this.exportResults();
      
      console.log('\n🎉 All customers processed!');
      console.log(`📊 Results saved to: ./results/kickstarter-fulfillment-results.csv`);
      
    } catch (error) {
      console.error('💥 Fatal error:', error);
    }
  }

  // Export results to CSV
  async exportResults() {
    const resultsDir = './results';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir);
    }

    const csvHeader = 'email,name,pledge_amount,reward_title,discount_code,landing_page_url,cart_link,checkout_link,items_found,items_not_found,kickstarter_order_id,backer_id,custom_engraving,status,error\n';
    const csvRows = this.results.map(result => {
      return [
        result.email,
        result.name,
        result.pledgeAmount,
        result.rewardTitle || '',
        result.discountCode || '',
        result.landingPageUrl || '',
        result.cartLink || '',
        result.checkoutLink || '',
        result.itemsFoundInShopify || '',
        result.itemsNotFound || '',
        result.kickstarterOrderId || '',
        result.backerId || '',
        result.customEngraving || '',
        result.status,
        result.error || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    }).join('\n');

    const csvContent = csvHeader + csvRows;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `./results/kickstarter-fulfillment-results-${timestamp}.csv`;
    
    fs.writeFileSync(filename, csvContent);
    fs.writeFileSync('./results/kickstarter-fulfillment-results.csv', csvContent);
    
    console.log(`📁 Results exported to: ${filename}`);
  }
}

// Initialize the system
const fulfillmentSystem = new KickstarterFulfillment();

// Web routes
app.get('/fulfillment/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'integrated-checkout.html'));
});

// Basket confirmation (alternative page)
app.get('/basket/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'basket-confirmation.html'));
});

// Legacy route (old landing page)
app.get('/legacy/:token', (req, res) => {
  try {
    const tokenData = Buffer.from(req.params.token, 'base64').toString('utf8');
    const [backerId, discountCode] = tokenData.split('_');
    
    const customer = fulfillmentSystem.customers.get(backerId);
    if (!customer) {
      return res.status(404).send('Customer not found');
    }

    res.sendFile(path.join(__dirname, 'public', 'landing-page-updated.html'));
    
  } catch (error) {
    res.status(400).send('Invalid token');
  }
});

// API endpoint to get customer data for landing page
app.get('/api/customer/:token', (req, res) => {
  try {
    const tokenData = Buffer.from(req.params.token, 'base64').toString('utf8');
    const [backerId, discountCode] = tokenData.split('_');
    
    const customer = fulfillmentSystem.customers.get(backerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Add price information to pledged items for frontend calculations
    const pledgedItemsWithPrices = customer.pledgedItems.map(item => {
      // Map variant IDs to prices
      const priceMap = {
        '52337643290957': 139.00, // Ambient One (Black)
        '52337643323725': 139.00, // Ambient One (Gray)
        '52321245593933': 72.00,  // Charging Dock + Formaldehyde Sensor
        '52321243267405': 22.00,  // Accessories Pack
        '52321244381517': 99.00,  // Ambient One - DIY Version
        '52321260994893': 12.00,  // Ambient One Poster
        '52321269776717': 45.00,  // Charging Dock
        '52321270792525': 10.00,  // USB-C Power Adaptor
        '52321270235469': 99.00   // DIY Kit
      };
      
      return {
        ...item,
        price: priceMap[item.variantId] || 0
      };
    });

    res.json({
      name: customer.name,
      pledgeAmount: customer.pledgeAmount,
      rewardTitle: customer.rewardTitle,
      pledgedItems: pledgedItemsWithPrices,
      discountCode: customer.discountCode,
      cartLinks: customer.cartLinks,
      shopDomain: 'shop.ambientworks.io',
      customEngraving: customer.customEngraving,
      kickstarterOrderId: customer.kickstarterOrderId
    });
    
  } catch (error) {
    res.status(400).json({ error: 'Invalid token' });
  }
});

// Store products endpoint for integrated checkout
app.get('/api/store-products', async (req, res) => {
  try {
    const fetch = (await import('node-fetch')).default;
    
    const url = `https://${CONFIG.shopify.shop}.myshopify.com/admin/api/2023-10/products.json?limit=50`;
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': CONFIG.shopify.accessToken
      }
    });
    
    const data = await response.json();
    
    // Transform to simplified format for frontend
    const products = [];
    data.products.forEach(product => {
      product.variants.forEach(variant => {
        products.push({
          name: variant.title === 'Default Title' ? product.title : `${product.title} (${variant.title})`,
          price: parseFloat(variant.price),
          variantId: variant.id.toString(),
          description: product.body_html ? product.body_html.replace(/<[^>]*>/g, '').substring(0, 100) + '...' : 'No description available',
          handle: product.handle,
          image: product.images[0]?.src || null
        });
      });
    });
    
    res.json(products);
    
  } catch (error) {
    console.error('Error fetching store products:', error);
    res.status(500).json({ error: 'Failed to load store products' });
  }
});

// Results endpoint
app.get('/results', (req, res) => {
  const summary = {
    totalProcessed: fulfillmentSystem.results.length,
    successful: fulfillmentSystem.results.filter(r => r.status === 'success').length,
    failed: fulfillmentSystem.results.filter(r => r.status === 'error').length,
    totalPledgeAmount: fulfillmentSystem.results.reduce((sum, r) => sum + (r.pledgeAmount || 0), 0),
    rewardTiers: [...new Set(fulfillmentSystem.results.map(r => r.rewardTitle).filter(Boolean))],
    itemsMissing: fulfillmentSystem.results.filter(r => r.itemsNotFound && r.itemsNotFound.length > 0).length
  };

  res.json({
    summary,
    results: fulfillmentSystem.results
  });
});

// Start processing endpoint
app.post('/process', async (req, res) => {
  try {
    const csvPath = req.body.csvPath || './data/kickstarter.csv';
    console.log(`🚀 Starting processing with Kickstarter CSV: ${csvPath}`);
    
    if (!fs.existsSync(csvPath)) {
      return res.status(400).json({ error: `CSV file not found: ${csvPath}` });
    }
    
    // Run processing in background
    fulfillmentSystem.processAllCustomers(csvPath);
    
    res.json({ 
      success: true, 
      message: 'Kickstarter fulfillment processing started in background',
      csvPath: csvPath,
      note: 'This may take several minutes due to Shopify API rate limits'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Variant mapping info endpoint
app.get('/variant-mapping', (req, res) => {
  res.json({
    variantMapping: VARIANT_MAPPING,
    note: 'Shows how Kickstarter items map to Shopify variants'
  });
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Kickstarter Fulfillment System Ready (Smart Variant Mapping)',
    customers: fulfillmentSystem.customers.size,
    processed: fulfillmentSystem.results.length,
    config: {
      shopifyShop: CONFIG.shopify.shop,
      hasAccessToken: !!CONFIG.shopify.accessToken,
      baseUrl: CONFIG.baseUrl
    },
    variantMapping: Object.keys(VARIANT_MAPPING).length + ' variants mapped'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌟 Kickstarter Fulfillment System running on port ${PORT}`);
  console.log(`🏪 Using Shopify store: ${CONFIG.shopify.shop}`);
  console.log(`🎯 Smart variant mapping: ${Object.keys(VARIANT_MAPPING).length} combinations`);
  console.log(`\n📋 Ready to process Kickstarter customers!`);
  console.log(`Visit: http://localhost:${PORT} to check status`);
  console.log(`POST to: http://localhost:${PORT}/process to start processing`);
  console.log(`View results: http://localhost:${PORT}/results`);
  console.log(`View variant mapping: http://localhost:${PORT}/variant-mapping`);
});

// Export for testing
module.exports = { fulfillmentSystem, app };
