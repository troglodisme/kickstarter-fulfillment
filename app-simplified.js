require('dotenv').config();
const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const fetch = require('node-fetch');
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

class KickstarterFulfillment {
  constructor() {
    this.customers = new Map(); // Store processed customers
    this.results = []; // Store processing results
  }

  // Step 1: Process CSV data
  async loadCustomerData(csvPath) {
    const customers = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const customer = {
            email: row.email,
            name: row.name,
            pledgeAmount: parseFloat(row.pledge_amount),
            rewardTier: row.reward_tier,
            pledgedItems: this.parsePledgedItems(row.pledged_items),
            kickstarterOrderId: row.kickstarter_order_id,
            backerId: row.backer_id,
            shippingAddress: {
              address1: row.address1,
              city: row.city,
              province: row.province,
              zip: row.zip,
              country: row.country
            }
          };
          customers.push(customer);
          this.customers.set(customer.backerId, customer);
        })
        .on('end', () => {
          console.log(`✅ Loaded ${customers.length} customers`);
          resolve(customers);
        })
        .on('error', reject);
    });
  }

  parsePledgedItems(itemString) {
    // Parse "Premium Widget (SKU001) x1, Stickers (SKU002) x2"
    return itemString.split(',').map(item => {
      const match = item.trim().match(/(.+?)\s*\((.+?)\)\s*x(\d+)/);
      if (match) {
        return {
          name: match[1].trim(),
          sku: match[2].trim(),
          quantity: parseInt(match[3])
        };
      }
    }).filter(Boolean);
  }

  // Step 2: Create/find Shopify customer
  async createShopifyCustomer(customerData) {
    try {
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
            first_name: customerData.name.split(' ')[0],
            last_name: customerData.name.split(' ').slice(1).join(' '),
            tags: 'kickstarter-backer',
            addresses: [customerData.shippingAddress]
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

  // Step 3: Create discount code
  async createDiscountCode(customer, shopifyCustomerId) {
    const discountCode = `KS_${customer.backerId}_${Date.now().toString().slice(-6)}`;
    
    try {
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
            title: `Kickstarter Credit - ${customer.name}`,
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
      
      console.log(`🎟️  Created discount: ${discountCode} for ${customer.email}`);
      return discountCode;

    } catch (error) {
      console.error(`❌ Discount creation failed for ${customer.email}:`, error.message);
      throw error;
    }
  }

  // Step 4: Generate cart links
  async generateCartLinks(customer) {
    try {
      // Get product variants for SKUs
      const cartItems = [];
      
      for (const item of customer.pledgedItems) {
        // Search for product by SKU
        const searchUrl = `https://${CONFIG.shopify.shop}.myshopify.com/admin/api/2023-10/products.json?limit=250`;
        const response = await fetch(searchUrl, {
          headers: {
            'X-Shopify-Access-Token': CONFIG.shopify.accessToken
          }
        });
        
        const result = await response.json();
        let variantId = null;
        
        // Find variant by SKU
        for (const product of result.products) {
          for (const variant of product.variants) {
            if (variant.sku === item.sku) {
              variantId = variant.id;
              break;
            }
          }
          if (variantId) break;
        }
        
        if (variantId) {
          cartItems.push(`${variantId}:${item.quantity}`);
          console.log(`✅ Found variant for ${item.sku}: ${variantId}`);
        } else {
          console.log(`⚠️  No variant found for SKU: ${item.sku}`);
        }
      }
      
      // Generate cart permalink
      const cartLink = cartItems.length > 0 
        ? `https://${CONFIG.shopify.shop}.myshopify.com/cart/${cartItems.join(',')}`
        : `https://${CONFIG.shopify.shop}.myshopify.com/cart`;
      
      // Generate checkout link with discount
      const checkoutLink = cartItems.length > 0
        ? `https://${CONFIG.shopify.shop}.myshopify.com/cart/${cartItems.join(',')}?discount=${customer.discountCode}`
        : `https://${CONFIG.shopify.shop}.myshopify.com/discount/${customer.discountCode}`;
      
      return {
        cartLink,
        checkoutLink,
        itemsFound: cartItems.length,
        totalItems: customer.pledgedItems.length
      };
      
    } catch (error) {
      console.error(`❌ Cart link generation failed for ${customer.email}:`, error.message);
      return {
        cartLink: `https://${CONFIG.shopify.shop}.myshopify.com/cart`,
        checkoutLink: `https://${CONFIG.shopify.shop}.myshopify.com/discount/${customer.discountCode}`,
        itemsFound: 0,
        totalItems: customer.pledgedItems.length
      };
    }
  }

  // Step 5: Generate landing page URL
  generateLandingPageUrl(customer, discountCode) {
    // Create unique token for landing page
    const token = Buffer.from(`${customer.backerId}_${discountCode}`).toString('base64');
    return `${CONFIG.baseUrl}/fulfillment/${token}`;
  }

  // Main processing function
  async processAllCustomers(csvPath) {
    try {
      console.log('🚀 Starting Kickstarter fulfillment process...');
      
      // Load customer data
      const customers = await this.loadCustomerData(csvPath);
      
      for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        console.log(`\n📋 Processing ${i + 1}/${customers.length}: ${customer.email}`);

        try {
          // Create Shopify customer
          const shopifyCustomer = await this.createShopifyCustomer(customer);
          
          // Create discount code
          const discountCode = await this.createDiscountCode(customer, shopifyCustomer.id);
          
          // Store discount code
          customer.discountCode = discountCode;
          customer.shopifyCustomerId = shopifyCustomer.id;
          
          // Generate cart links
          const cartLinks = await this.generateCartLinks(customer);
          
          // Generate landing page URL
          const landingPageUrl = this.generateLandingPageUrl(customer, discountCode);
          
          // Store results
          const result = {
            email: customer.email,
            name: customer.name,
            pledgeAmount: customer.pledgeAmount,
            discountCode: discountCode,
            landingPageUrl: landingPageUrl,
            cartLink: cartLinks.cartLink,
            checkoutLink: cartLinks.checkoutLink,
            itemsFoundInShopify: `${cartLinks.itemsFound}/${cartLinks.totalItems}`,
            status: 'success'
          };
          
          this.results.push(result);
          customer.landingPageUrl = landingPageUrl;
          customer.cartLinks = cartLinks;
          
          console.log(`✅ Completed ${customer.email}`);
          console.log(`🔗 Landing: ${landingPageUrl}`);
          console.log(`🛒 Checkout: ${cartLinks.checkoutLink}`);
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`❌ Failed processing ${customer.email}:`, error.message);
          
          // Store error result
          this.results.push({
            email: customer.email,
            name: customer.name,
            pledgeAmount: customer.pledgeAmount,
            status: 'error',
            error: error.message
          });
          
          continue; // Continue with next customer
        }
      }

      // Generate results CSV
      await this.exportResults();
      
      console.log('\n🎉 All customers processed!');
      console.log(`📊 Results saved to: ./results/fulfillment-results.csv`);
      
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

    const csvHeader = 'email,name,pledge_amount,discount_code,landing_page_url,cart_link,checkout_link,items_found,status,error\n';
    const csvRows = this.results.map(result => {
      return [
        result.email,
        result.name,
        result.pledgeAmount,
        result.discountCode || '',
        result.landingPageUrl || '',
        result.cartLink || '',
        result.checkoutLink || '',
        result.itemsFoundInShopify || '',
        result.status,
        result.error || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    }).join('\n');

    const csvContent = csvHeader + csvRows;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `./results/fulfillment-results-${timestamp}.csv`;
    
    fs.writeFileSync(filename, csvContent);
    fs.writeFileSync('./results/fulfillment-results.csv', csvContent); // Latest copy
    
    console.log(`📁 Results exported to: ${filename}`);
  }
}

// Initialize the system
const fulfillmentSystem = new KickstarterFulfillment();

// Web routes
app.get('/fulfillment/:token', (req, res) => {
  try {
    const tokenData = Buffer.from(req.params.token, 'base64').toString('utf8');
    const [backerId, discountCode] = tokenData.split('_');
    
    const customer = fulfillmentSystem.customers.get(backerId);
    if (!customer) {
      return res.status(404).send('Customer not found');
    }

    res.sendFile(path.join(__dirname, 'public', 'landing-page.html'));
    
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

    res.json({
      name: customer.name,
      pledgeAmount: customer.pledgeAmount,
      pledgedItems: customer.pledgedItems,
      discountCode: customer.discountCode,
      cartLinks: customer.cartLinks,
      shopDomain: CONFIG.shopify.shop
    });
    
  } catch (error) {
    res.status(400).json({ error: 'Invalid token' });
  }
});

// Results endpoint
app.get('/results', (req, res) => {
  res.json({
    totalProcessed: fulfillmentSystem.results.length,
    successful: fulfillmentSystem.results.filter(r => r.status === 'success').length,
    failed: fulfillmentSystem.results.filter(r => r.status === 'error').length,
    results: fulfillmentSystem.results
  });
});

// Start processing endpoint
app.post('/process', async (req, res) => {
  try {
    const csvPath = req.body.csvPath || './data/kickstarter.csv';
    console.log(`🚀 Starting processing with CSV: ${csvPath}`);
    
    if (!fs.existsSync(csvPath)) {
      return res.status(400).json({ error: `CSV file not found: ${csvPath}` });
    }
    
    // Run processing in background
    fulfillmentSystem.processAllCustomers(csvPath);
    
    res.json({ 
      success: true, 
      message: 'Processing started in background',
      csvPath: csvPath
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Kickstarter Fulfillment System Ready',
    customers: fulfillmentSystem.customers.size,
    processed: fulfillmentSystem.results.length,
    config: {
      shopifyShop: CONFIG.shopify.shop,
      hasAccessToken: !!CONFIG.shopify.accessToken,
      baseUrl: CONFIG.baseUrl
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌟 Kickstarter Fulfillment System running on port ${PORT}`);
  console.log(`🏪 Using Shopify store: ${CONFIG.shopify.shop}`);
  console.log(`\n📋 Ready to process customers!`);
  console.log(`Visit: http://localhost:${PORT} to check status`);
  console.log(`POST to: http://localhost:${PORT}/process to start processing`);
  console.log(`View results: http://localhost:${PORT}/results`);
});

// Export for testing
module.exports = { fulfillmentSystem, app };
