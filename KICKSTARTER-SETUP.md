# Kickstarter Fulfillment System - Setup Guide

## 🎯 Your Kickstarter Export Detected

Your Kickstarter CSV has been successfully analyzed:
- ✅ **63 columns detected** - Full Kickstarter export format
- ✅ **Product count columns found** - ambientone Count, blackanodising Count, etc.
- ✅ **Shipping data available** - Full address information
- ✅ **Custom engraving data** - Personalization requests captured

## 📋 Current Status

### ✅ Working:
- CSV format detection and parsing
- Product mapping configuration
- SKU assignment system
- Landing page generation
- Results export functionality

### ⚠️ Needs Attention:
- **Shopify shop name verification** (getting 404 error)
- **SKU mapping validation** (ensure they match your actual Shopify SKUs)
- **Full CSV data** (currently using sample data)

## 🏪 Shopify Configuration Issue

The test shows a 404 error for shop "ambient-works". This could mean:

1. **Shop name is incorrect**
   - Verify the exact shop name in your Shopify admin URL
   - Update `SHOPIFY_SHOP` in `.env` file

2. **Shop is not accessible**
   - Ensure the shop is active
   - Check if the domain has changed

3. **API access is restricted**
   - Verify your API permissions
   - Check if the access token is still valid

## 🔧 SKU Mapping Configuration

The system will map your Kickstarter product counts to these Shopify SKUs:

| Kickstarter Item | → | Shopify SKU | Product Name |
|------------------|---|-------------|--------------|
| `ambientone Count` | → | `AMBIENT-ONE-001` | Ambient One |
| `blackanodising Count` | → | `BLACK-ANODISE-001` | Black Anodising |
| `accessoriespack Count` | → | `ACCESSORIES-001` | Accessories Pack |
| `usbccable Count` | → | `USB-CABLE-001` | USB-C Cable |
| `poweradaptor Count` | → | `POWER-ADAPTER-001` | Power Adaptor |
| `chargingdock Count` | → | `CHARGING-DOCK-001` | Charging Dock |
| `SFA30formaldehydesensor Count` | → | `SFA30-SENSOR-001` | SFA30 Formaldehyde Sensor |
| `AmbientWorksPoster Count` | → | `POSTER-001` | Ambient Works Poster |
| `ambientoneDIY Count` | → | `AMBIENT-DIY-001` | Ambient One - DIY Version |
| `1xambientworks Count` | → | `AMBIENT-WORKS-001` | 1x Ambient Works |
| `CustomEngraving Count` | → | `ENGRAVING-001` | Custom Engraving |

### 🚨 Important: Update SKU Mapping

**You MUST update the SKU mapping to match your actual Shopify product SKUs:**

1. Check your Shopify admin → Products
2. Note the actual SKU for each product
3. Edit `app-kickstarter.js` and update the `SKU_MAPPING` object:

```javascript
const SKU_MAPPING = {
  'ambientone': 'YOUR_ACTUAL_AMBIENT_ONE_SKU',
  'blackanodising': 'YOUR_ACTUAL_BLACK_ANODISE_SKU',
  // ... update all SKUs
};
```

## 📄 Your Sample Data Analysis

From your sample data row:

**Customer:** Frederik stott (Frederik2600@gmail.com)
**Pledge:** £253.00 (VIP Special tier)
**Products:** 
- 1x Ambient One 
- 1x Black Anodising
- 1x Accessories Pack
- 1x Charging Dock + Formaldehyde Sensor

This will create:
- Discount code: `KS1_XXXXXX` (reduces cart by £253.00)
- Pre-filled cart with 4 products
- Personalized landing page
- Direct checkout link with discount applied

## 🚀 Next Steps

### 1. Fix Shopify Connection
```bash
# Check your actual shop URL and update .env
# Visit your Shopify admin and note the exact shop name from the URL
# Update SHOPIFY_SHOP in .env file
```

### 2. Update SKU Mapping
```bash
# Edit app-kickstarter.js
# Update the SKU_MAPPING object with your actual Shopify SKUs
```

### 3. Add Full CSV Data
```bash
# Copy your complete Kickstarter export to:
cp your-full-kickstarter-export.csv ./data/kickstarter.csv
```

### 4. Test Again
```bash
npm run test-kickstarter
```

### 5. Start Processing
```bash
# Start the server
npm run start-kickstarter

# In another terminal, start processing
curl -X POST http://localhost:3000/process
```

## 📊 Expected Results

For each backer, the system will:

1. **Create Shopify customer** (or find existing)
2. **Generate discount code** (`KS{BackerNumber}_{Timestamp}`)
3. **Create personalized landing page** (`/fulfillment/{token}`)
4. **Generate pre-filled cart** with their exact pledged items
5. **Create checkout link** with discount auto-applied
6. **Export comprehensive CSV** with all results

## 🎨 Features Your Data Supports

Your Kickstarter export includes rich data that enables:

- ✅ **Custom engraving requests** - Captured and stored
- ✅ **Reward tier tracking** - "VIP Special", etc.
- ✅ **Full shipping addresses** - Ready for Shopify
- ✅ **Addon tracking** - All addon purchases mapped
- ✅ **Pledge manager data** - Additional items included
- ✅ **Fulfillment status** - Track completion

## 🔍 Troubleshooting

### CSV Issues
```bash
# Validate CSV format
npm run test-kickstarter
```

### Shopify Connection
```bash
# Test connection only
curl https://ambient-works.myshopify.com/admin/api/2023-10/shop.json \
  -H "X-Shopify-Access-Token: YOUR_TOKEN"
```

### SKU Matching
```bash
# View current mapping
curl http://localhost:3000/sku-mapping
```

## 📞 Support

If you encounter issues:

1. **Check the console logs** - Detailed error messages provided
2. **Verify Shopify setup** - Admin API access and permissions
3. **Validate CSV structure** - Use test-kickstarter.js
4. **Test with sample data first** - Before processing full export

The system is specifically designed for your Kickstarter format and will handle all the complexity of mapping addon counts to Shopify products automatically.
