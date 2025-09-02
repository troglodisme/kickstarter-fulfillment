# Kickstarter Fulfillment System

An automated system that processes Kickstarter backer data and creates personalized Shopify checkout experiences with discount codes.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- Shopify store with Admin API access
- Kickstarter CSV export file

### Setup
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Shopify credentials

# Start server
npm start
```

### Environment Configuration
Create `.env` file with your Shopify credentials:
```bash
SHOPIFY_SHOP=your-shop-name
SHOPIFY_ACCESS_TOKEN=shpat_your_access_token
BASE_URL=http://localhost:3000
```

### Required Shopify Permissions
- `write_customers` - Create customer accounts
- `write_discounts` - Generate discount codes  
- `write_price_rules` - Create price rules
- `read_products` - Load store products for frontend

## 🎯 System Overview

This system automates the Kickstarter fulfillment workflow:

1. **CSV Processing** → Reads Kickstarter export data
2. **Smart Product Mapping** → Maps pledge items to Shopify product variants
3. **Customer Creation** → Creates/updates Shopify customer accounts
4. **Discount Generation** → Creates personalized discount codes
5. **Landing Page Creation** → Generates unique URLs for each backer
6. **Integrated Checkout** → Single-page experience for pledged + extra items

## 🧪 Quick Demo (3 Steps)

**Try it right now with sample data:**

```bash
# 1. Start the server
npm start

# 2. Process sample customer to create discount codes
curl -X POST "http://localhost:3000/process" \
  -H "Content-Type: application/json" \
  -d '{"csvPath": "./data/kickstarter-real-sample.csv"}'

# 3. Open the generated URL in your browser
# Look for: "🔗 Landing: http://localhost:3000/fulfillment/XXXXXXX"
# Click "Review & Checkout" to test Shopify integration
```

**What you'll see:**
- ✅ Landing page showing Frederik's £253 pledge perfectly balanced
- ✅ Shopify checkout with automatic discount applied (£0 total)
- ✅ Complete end-to-end fulfillment workflow

## 🧪 Testing with Sample Data

The system includes sample data for immediate testing:

```bash
# Check API response
curl "http://localhost:3000/api/customer/MTQzODM5NzMzNV9LUzFfNTgzNDMy" | jq .

# View system status
curl http://localhost:3000
```

### Sample Customer Details
- **Name**: Frederik stott
- **Pledge**: £253.00
- **Items**: Ambient One (Black) £159 + Charging Dock + Sensor £72 + Accessories £22
- **Total**: £253 (perfectly balanced - customer pays £0)
- **Discount Code**: Auto-generated (e.g., KS1_583432)

## 📋 Production Usage

### 1. Process Your Own Kickstarter Data

```bash
# Start the server
npm start

# Process your CSV file
curl -X POST "http://localhost:3000/process" \
  -H "Content-Type: application/json" \
  -d '{"csvPath": "./data/your-kickstarter-export.csv"}'

# Monitor processing
curl http://localhost:3000/results
```

### 2. Kickstarter CSV Format
Your CSV export should include these columns:
- `Backer Name`, `Email`, `Pledge Amount`
- Product columns like `[Addon: XXXXX] product name`
- Count columns like `productname Count`

### 3. Product Mapping
The system uses smart mapping rules:
- `ambientone + blackanodising` → Ambient One (Black) £159
- `chargingdock + SFA30formaldehydesensor` → Charging Dock + Sensor £72
- `accessoriespack` → Accessories Pack £22

### 4. Generated URLs
Each customer gets a unique URL like:
```
http://localhost:3000/fulfillment/{BASE64_TOKEN}
```

### 5. Results Export
Processing creates CSV files in `./results/` with:
- Customer emails and names
- Generated discount codes
- Landing page URLs
- Cart links for Shopify checkout

## 🛒 Customer Experience

1. **Landing Page** → Shows pledged items + ability to add extras
2. **Smart Pricing** → Displays pledge credit vs item costs
3. **One-Click Checkout** → Direct to Shopify with discount applied
4. **Flexible Payment** → Pay only for extras beyond pledge value

## 🏗️ Technical Architecture

- **Backend:** Node.js/Express server with Shopify Admin API integration
- **Frontend:** Responsive landing pages with dynamic product loading
- **Data:** CSV parser for Kickstarter exports with smart product mapping
- **Storage:** In-memory customer data with file-based result exports
- **Security:** Base64 tokens for customer authentication

## 🔧 API Endpoints

- `GET /` → System status and stats
- `POST /process` → Start CSV processing
- `GET /results` → View processing results
- `GET /api/customer/:token` → Customer data API
- `GET /fulfillment/:token` → Customer landing page
- `GET /variant-mapping` → View product mapping rules

## � Deploy to Vercel

Deploy your system to the cloud in 2 minutes:

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy from your project directory
vercel

# 3. Set environment variables in Vercel dashboard:
# SHOPIFY_SHOP=your-shop-name
# SHOPIFY_ACCESS_TOKEN=shpat_your_token
# BASE_URL=https://your-app.vercel.app

# 4. Your app will be live at: https://your-app.vercel.app
```

**Benefits of Vercel deployment:**
- ✅ **Global CDN** - Fast loading worldwide
- ✅ **Auto HTTPS** - Secure by default
- ✅ **Zero config** - Works out of the box
- ✅ **Custom domain** - Use your own domain
- ✅ **Serverless** - Scales automatically

## �📁 Project Structure

```
├── app.js                    # Main server & fulfillment logic
├── package.json              # Dependencies & scripts
├── vercel.json               # Vercel deployment config
├── README.md                 # This documentation
├── .env                      # Shopify configuration (create from .env.example)
├── public/
│   └── integrated-checkout.html  # Minimal customer checkout page
├── data/
│   └── kickstarter-real-sample.csv  # Sample Kickstarter data for testing
└── results/                  # Generated CSV exports (auto-created)
```

## ⚙️ Key Features

- **Smart Variant Mapping** → Automatically combines products (e.g., Ambient One + Black Anodising)
- **Discount Code Generation** → Creates unique codes for each customer's pledge amount
- **Real-time Processing** → Handles Shopify API rate limits gracefully
- **Minimal Design** → Clean, fast-loading checkout experience
- **Flexible Checkout** → Supports pledged items + additional purchases
- **Export Results** → CSV files for tracking and analytics
- **Cloud Ready** → Deploy to Vercel with one command

## 🚨 Important Notes

- Discount codes are generated as fixed amounts (e.g., £253 off)
- Black anodising adds £20 to base Ambient One price (£139 → £159)
- System respects Shopify API rate limits during processing
- Customer data is stored in memory - restart server to reload CSV
- Checkout URLs include discount parameters for automatic application

## 📞 Support

For issues or questions:
1. Check the console output for error messages
2. Verify your `.env` configuration
3. Ensure CSV format matches expected columns
4. Test with the included sample data first
└── .env                      # Environment configuration
```

## 🔧 Deployment

For production deployment:

1. Update `.env` with production Shopify credentials
2. Replace sample CSV with real Kickstarter export data
3. Deploy to your preferred hosting platform (Heroku, Vercel, etc.)
4. Ensure environment variables are set in your deployment platform

## 📊 Token System

Landing page URLs use Base64 encoded tokens containing customer and discount information for secure access to personalized checkout experiences.
