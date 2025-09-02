require('dotenv').config();
const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const nodemailer = require('nodemailer');
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
  email: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  baseUrl: process.env.BASE_URL || 'http://localhost:3000'
};

// Email transporter setup
const emailTransporter = nodemailer.createTransporter({
  host: CONFIG.email.host,
  port: CONFIG.email.port,
  secure: false,
  auth: {
    user: CONFIG.email.user,
    pass: CONFIG.email.pass
  }
});

class KickstarterFulfillment {
  constructor() {
    this.customers = new Map(); // Store processed customers
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
      console.log(`🎟️  Created discount: ${discountCode} for ${customer.email}`);
      return discountCode;

    } catch (error) {
      console.error(`❌ Discount creation failed for ${customer.email}:`, error.message);
      throw error;
    }
  }

  // Step 4: Generate landing page URL
  generateLandingPageUrl(customer, discountCode) {
    // Create unique token for landing page
    const token = Buffer.from(`${customer.backerId}_${discountCode}`).toString('base64');
    return `${CONFIG.baseUrl}/fulfillment/${token}`;
  }

  // Step 5: Send email
  async sendConfirmationEmail(customer, landingPageUrl, discountCode) {
    const pledgedItemsList = customer.pledgedItems.map(item => 
      `• ${item.name} (${item.sku}) - Quantity: ${item.quantity}`
    ).join('\n');

    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; }
          .pledged-items { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .credit { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .cta-button { display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { background: #6c757d; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Your Kickstarter Rewards Are Ready!</h1>
            <p>Thank you for backing our campaign, ${customer.name}!</p>
          </div>
          
          <div class="content">
            <h2>What's Included in Your Pledge:</h2>
            <div class="pledged-items">
              <pre>${pledgedItemsList}</pre>
            </div>
            
            <div class="credit">
              <strong>🎟️ Your Kickstarter Credit: $${customer.pledgeAmount.toFixed(2)}</strong><br>
              <small>This will be automatically applied at checkout</small><br>
              <strong>Discount Code: ${discountCode}</strong>
            </div>
            
            <p>Click below to:</p>
            <ul>
              <li>✅ Confirm your pledged items</li>
              <li>🛍️ Add additional products from our store</li>
              <li>📦 Complete shipping information</li>
              <li>💰 Pay only for shipping + any additional items</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${landingPageUrl}" class="cta-button">Complete Your Order</a>
            </div>
            
            <p><small>This link is unique to you and expires in 90 days. Your discount code will automatically zero out your pledge amount.</small></p>
          </div>
          
          <div class="footer">
            <p>Questions? Reply to this email or contact support.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: CONFIG.email.user,
      to: customer.email,
      subject: `🎁 Your Kickstarter Rewards Are Ready - ${customer.rewardTier}`,
      html: emailHTML
    };

    try {
      await emailTransporter.sendMail(mailOptions);
      console.log(`📧 Email sent to ${customer.email}`);
    } catch (error) {
      console.error(`❌ Email failed for ${customer.email}:`, error.message);
      throw error;
    }
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
          
          // Generate landing page URL
          const landingPageUrl = this.generateLandingPageUrl(customer, discountCode);
          
          // Store for landing page
          customer.discountCode = discountCode;
          customer.landingPageUrl = landingPageUrl;
          customer.shopifyCustomerId = shopifyCustomer.id;
          
          // Send email
          await this.sendConfirmationEmail(customer, landingPageUrl, discountCode);
          
          console.log(`✅ Completed ${customer.email}`);
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`❌ Failed processing ${customer.email}:`, error.message);
          continue; // Continue with next customer
        }
      }

      console.log('\n🎉 All customers processed!');
    } catch (error) {
      console.error('💥 Fatal error:', error);
    }
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

    // Serve landing page (we'll create this next)
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
      discountCode: customer.discountCode
    });
    
  } catch (error) {
    res.status(400).json({ error: 'Invalid token' });
  }
});

// Start processing endpoint
app.post('/process', async (req, res) => {
  try {
    await fulfillmentSystem.processAllCustomers('./data/kickstarter.csv');
    res.json({ success: true, message: 'Processing completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Kickstarter Fulfillment System Ready',
    customers: fulfillmentSystem.customers.size 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌟 Kickstarter Fulfillment System running on port ${PORT}`);
  console.log(`📧 Using email: ${CONFIG.email.user}`);
  console.log(`🏪 Using Shopify store: ${CONFIG.shopify.shop}`);
  console.log(`\n📋 Ready to process customers!`);
  console.log(`Visit: http://localhost:${PORT} to check status`);
});

// Export for testing
module.exports = { fulfillmentSystem, app };