# Kickstarter Fulfillment System

An automated system that processes Kickstarter backer data and creates personalized Shopify checkout experiences with discount codes that zero out pledge amounts.

## 🚀 Current Status: FULLY FUNCTIONAL

✅ **Complete Implementation** - System processes customers, creates Shopify accounts, generates discount codes, provides unique URLs  
✅ **CSV Parsing Fixed** - Handles real Kickstarter export format with 63 columns  
✅ **Smart Variant Mapping** - Combines base products with add-ons (e.g., Ambient One + Black Anodising → Ambient One Black)  
✅ **Shopify Integration** - Full API permissions for automated discount code creation  
✅ **Integrated UX** - Single-page experience with pledged items + store browsing  
✅ **Cart Pre-filling** - Direct redirect to Shopify cart with all items loaded  

**Last tested:** September 2, 2025  
**Processing status:** 1/1 customers successfully processed  
**Current landing page:** http://localhost:3000/fulfillment/MTQzODM5NzMzNV9LUzFfOTUwNjAy

## 🎯 System Overview

This system automates the entire Kickstarter fulfillment workflow:

1. **CSV Processing** → Reads real Kickstarter export data (63 columns)
2. **Smart Product Mapping** → Maps pledge items to Shopify product variants
3. **Customer Creation** → Creates/updates Shopify customer accounts
4. **Discount Generation** → Creates personalized discount codes that zero out pledge amounts
5. **Landing Page Creation** → Generates unique URLs for each backer
6. **Integrated Checkout** → Single-page experience for pledged + extra items

## 📋 Key Features

### Smart Variant Mapping
- **Ambient One + Black Anodising** → Ambient One (Black) - £139
- **Charging Dock + Sensor** → Combined Product - £72
- **Standalone items** → Individual products
- **Unmapped items** → Tracked but flagged for manual review

### Automated Discount System
- Creates Shopify price rules with exact pledge amount as credit
- Generates unique discount codes (format: `KS{OrderId}_{timestamp}`)
- 90-day expiration with single-use limitation
- Customer-specific restrictions

### Landing Page Experience
- Displays pledged items with prices
- Browse additional store products
- Live order summary with discount calculation
- One-click checkout with cart pre-filling
- **Discount Management**: Creates customer-specific discount codes with 90-day expiration
- **Results Export**: Outputs comprehensive CSV reports of all processed customers
- **Rate Limiting**: Respects Shopify API limits with built-in delays
- **Error Handling**: Comprehensive error reporting and recovery

## 📁 Project Structure

```
kickstarter-fulfillment/
├── .env                     # Environment variables (Shopify credentials)
├── app.js                   # Original full-featured application
├── app-simplified.js        # Simplified version (recommended)
├── package.json             # Dependencies and scripts
├── test.js                  # Configuration and connection testing
├── data/
│   ├── kickstarter.csv      # Your backer data (empty by default)
│   └── kickstarter-sample.csv # Sample data for testing
├── public/
│   ├── landing-page.html        # Original landing page
│   └── landing-page-updated.html # Updated landing page
└── results/                     # Generated results (created automatically)
    └── fulfillment-results.csv # Processing results
```

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy your Shopify credentials to `.env`:

```bash
# Shopify Configuration
SHOPIFY_SHOP=your-shop-name
SHOPIFY_ACCESS_TOKEN=shpat_your_access_token_here

# Server Configuration  
BASE_URL=http://localhost:3000
PORT=3000
```

**Getting Shopify Credentials:**
1. Go to your Shopify Admin → Apps → "Manage private apps"
2. Create a private app with Admin API permissions
3. Enable: `Read and write customers`, `Read and write discounts`, `Read products`
4. Copy the Admin API access token

### 3. Prepare Your CSV Data

Your CSV file should have these columns:
```
email,name,pledge_amount,reward_tier,pledged_items,kickstarter_order_id,backer_id,address1,city,province,zip,country
```

**Example format for `pledged_items`:**
```
"Premium Widget (WIDGET001) x1, Stickers Pack (STICKER001) x2"
```

### 4. Test Configuration

```bash
npm run test
```

This will verify:
- ✅ Environment variables are set
- ✅ CSV file exists and has data  
- ✅ Shopify API connection works
- ✅ Store information is accessible

## 🚀 Usage

### Option 1: Use Simplified Version (Recommended)

```bash
npm run start-simple
```

This version:
- ❌ No email functionality (simpler setup)
- ✅ Generates discount codes and checkout links
- ✅ Creates landing pages with customer data
- ✅ Exports comprehensive results to CSV
- ✅ Includes cart pre-filling with SKU matching

### Option 2: Use Full Version

```bash
npm start
```

This version includes email functionality but requires SMTP configuration.

### Processing Customers

1. **Start the server:**
   ```bash
   npm run start-simple
   ```

2. **Check status:**
   Visit `http://localhost:3000` to verify the system is ready

3. **Start processing:**
   ```bash
   curl -X POST http://localhost:3000/process \
     -H "Content-Type: application/json" \
     -d '{"csvPath": "./data/kickstarter.csv"}'
   ```

4. **Check results:**
   Visit `http://localhost:3000/results` or check `./results/fulfillment-results.csv`

## 📊 What Gets Generated

For each customer, the system creates:

1. **Shopify Customer** (or finds existing one)
2. **Discount Code** (`KS_BACKERID_TIMESTAMP`)
   - Reduces cart by exact pledge amount
   - Customer-specific (only they can use it)
   - 90-day expiration
   - Single-use only

3. **Landing Page** (`/fulfillment/TOKEN`)
   - Shows their pledged items
   - Displays discount code
   - Provides checkout button

4. **Checkout Links**
   - Pre-filled cart with their items
   - Discount automatically applied
   - Direct link to complete purchase

## 📄 Results CSV Format

The system exports detailed results including:

```csv
email,name,pledge_amount,discount_code,landing_page_url,cart_link,checkout_link,items_found,status,error
john@example.com,John Smith,50.00,KS_BACKER001_123456,http://localhost:3000/fulfillment/xyz,https://shop.myshopify.com/cart/123:1,https://shop.myshopify.com/cart/123:1?discount=KS_BACKER001_123456,1/1,success,
```

## 🔧 API Endpoints

- `GET /` - System status and health check
- `POST /process` - Start processing customers
- `GET /results` - View processing results  
- `GET /fulfillment/:token` - Customer landing page
- `GET /api/customer/:token` - Customer data API

## 🛡️ Error Handling

The system handles various error scenarios:

- **Missing customers**: Creates new Shopify customers
- **API rate limits**: Built-in delays between requests
- **Invalid SKUs**: Continues processing, notes missing items
- **Network errors**: Retries and logs detailed error information
- **Invalid CSV data**: Skips problematic rows, continues processing

## 📝 CSV Requirements

### Required Columns:
- `email` - Customer email address
- `name` - Full customer name
- `pledge_amount` - Numeric amount (e.g., 50.00)
- `pledged_items` - Formatted as "Product Name (SKU) xQuantity"
- `backer_id` - Unique identifier for this backer
- `address1`, `city`, `province`, `zip`, `country` - Shipping address

### Optional Columns:
- `reward_tier` - Pledge tier name
- `kickstarter_order_id` - Original Kickstarter order reference

## 🔍 Testing with Sample Data

Use the included sample file:

```bash
# Copy sample data to main CSV
cp data/kickstarter-sample.csv data/kickstarter.csv

# Process the sample data
npm run start-simple
curl -X POST http://localhost:3000/process
```

## 🚨 Important Notes

1. **Shopify API Limits**: The system includes rate limiting, but monitor your API usage
2. **SKU Matching**: Ensure your Shopify product SKUs match those in the CSV
3. **Discount Codes**: Each code is single-use and customer-specific
4. **Landing Page URLs**: These contain sensitive tokens, share only with intended customers
5. **Results Backup**: Results are timestamped and preserved in the `/results` folder

## 📞 Support

If you encounter issues:

1. Run `npm run test` to verify configuration
2. Check the console logs for detailed error messages
3. Verify your CSV format matches the expected structure
4. Ensure your Shopify API permissions are correctly set

## 🔄 Next Steps

After processing:

1. **Review Results**: Check the generated CSV for any errors
2. **Test Landing Pages**: Visit a few customer landing pages to verify they work
3. **Update Store Domain**: Replace placeholder domains in landing pages with your actual store
4. **Monitor Usage**: Track discount code usage in your Shopify admin
5. **Customer Communication**: Share landing page URLs with your backers

The system is designed to be run once per fulfillment batch, creating all necessary discount codes and links for your Kickstarter backers to complete their orders seamlessly.
